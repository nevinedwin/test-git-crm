/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import {
  postResources,
  getRecordByEntity,
  getAgencyCreateJSON,
  getBrokerCreateJSON,
  batchWriteItems,
  isCorrectFieldTypeAgency,
  isCorrectFieldTypeBroker,
} from "../libs/db";
import { failure, success } from "../libs/response-lib";
import { aggregate } from "../search/search";
import {
  validateFields,
  validateIdFieldsForAgency,
} from "../validation/validation";
import { getBuilderAsync } from "../builders/builders";
import { initLambdaInvoke } from "../libs/lambda";
import { getDynamicRequiredFields } from "../dynamicRequiredFields/dynamicRequiredFields";

const { FILE_MANAGER_BUCKET_NAME, METROS_LAMBDA_ARN } = process.env;

const csvToJSON = require("csvtojson");

const s3 = new AWS.S3({ apiVersion: "2006-03-01" });
const AGENCY_FILE_STATUS_COMPLETED = "COMPLETED";
const AGENCY_FILE_STATUS_PROCESSING = "PROCESSING";
const AGENCY_FILE_STATUS_FAILED = "FAILED";

const updateBulkAgencyCreateStatus = async (statusObj) => {
  const params = {
    TableName: process.env.entitiesTableName,
    Item: statusObj,
  };
  console.log(params);
  const agencyFileResp = await postResources(params);
  return agencyFileResp;
};
const convertCSVAndValidate = async (data) => {
  const bucketName = FILE_MANAGER_BUCKET_NAME;
  const fileKey = data.fileKey ? data.fileKey : "";

  const validFields = [
    "agency_tname",
    "agency_cname",
    "agency_m_id",
    "broker_fname",
    "broker_lname",
    "broker_email",
    "broker_phone",
    "broker_spec",
    "hb_id",
  ];
  // Get the agency creation file from S3
  const s3Params = {
    Bucket: bucketName,
    Key: fileKey,
  };
  // Create a read stream of the uploaded csv file
  const getObjectStream = s3.getObject(s3Params).createReadStream();

  // Convert the csv to json
  const agencies = await csvToJSON().fromStream(getObjectStream);
  // console.log(`agencies: ${JSON.stringify(agencies)}`);

  const testQuestionKey = /agency_qstn_[0-9]{1,2}/g;
  const testAnswerKey = /agency_optn_[0-9]{1,2}/g;

  // Check whether any agency exist
  if (agencies.length === 0) {
    // No agencies found in the request
    return { status: false, error: ["No agencies found in CSV"], agencies };
  }

  // Validate whether the fields in the converted JSON is valid for a agency
  // Checking only the first agency object since the csv headers will be same for each object
  const fieldErrors = [];
  for (const key in agencies[0]) {
    if (key) {
      const isKeyAQuestion = testQuestionKey.test(key);
      const isKeyAnAnswer = testAnswerKey.test(key);

      // console.log(`isKeyAQuestion: ${isKeyAQuestion}`);
      // console.log(`isKeyAnAnswer: ${isKeyAnAnswer}`);

      if (!validFields.includes(key)) {
        // Field not valid
        // Check whether it matches the demographics question or answer key
        if (!isKeyAQuestion && !isKeyAnAnswer) {
          fieldErrors.push(`${key} field is invalid`);
        }
      }
    }
  }
  // console.log(`fieldErrors: ${fieldErrors}`);

  // True if valid. False if invalid.
  const validationStatus = !(fieldErrors && fieldErrors.length);
  // console.log(`validationStatus: ${validationStatus}`);
  return { status: validationStatus, error: fieldErrors, agencies };
};
const uploadFileToS3Generic = async (fileUploadParams) => {
  // Upload status file to s3
  // console.log('fileUploadParams: ', fileUploadParams);
  const fileUploadResp = await s3.upload(fileUploadParams).promise();
  // console.log(`fileUploadResp: ${JSON.stringify(fileUploadResp)}`);
  return fileUploadResp;
};
const uploadStatusFile = async (
  bucketName,
  statusFileKey,
  statusFileContent
) => {
  const statusFileUploadParams = {
    Bucket: bucketName,
    Key: statusFileKey,
    Body: JSON.stringify(statusFileContent, null, 4),
  };
  const statusFileUploadResp = await uploadFileToS3Generic(
    statusFileUploadParams
  );
  return statusFileUploadResp;
};
const createBulkAgencyFileStatus = async (hbId, statusFileObject) => {
  // Create/Update the agency bulk creation status record for this home builder
  // First check for existing agency bulk creation status record for this home builder
  const bulkAgencyCreateStatusResp = await getRecordByEntity(
    `agency_create_status#${hbId}`
  );
  // console.log(`bulkAgencyCreateStatusResp: ${JSON.stringify(bulkAgencyCreateStatusResp)}`);

  const type = `agency_create_status`;
  let statusObj = {};
  if (bulkAgencyCreateStatusResp && bulkAgencyCreateStatusResp.length) {
    // Record exists. Update the status file path in the record
    // Modify the existing record object
    statusObj = { ...bulkAgencyCreateStatusResp[0] };
    statusObj.mdt = Date.now();

    // console.log(`statusFileObject: ${JSON.stringify(statusFileObject)}`);
    if (statusFileObject.status === AGENCY_FILE_STATUS_PROCESSING) {
      // Push the PROCESSING status
      statusObj.stfiles.push(statusFileObject);
    } else {
      // Check for the PROCESSING status object and update for COMPLETED or FAILED status
      statusObj.stfiles = statusObj.stfiles.map((stsfile) => {
        // console.log(`stsfile: ${JSON.stringify(stsfile)}`);
        if (stsfile.csv === statusFileObject.csv) {
          return statusFileObject;
        }

        return stsfile;
      });
      // console.log(`statusObj.stfiles: ${JSON.stringify(statusObj.stfiles)}`);
    }
  } else {
    // Record doesn't exist. So create a new record with the path to the status file in s3
    const creationDate = Date.now();
    statusObj = {
      id: uuidv4(),
      entity: `${type}#${hbId}`,
      type,
      cdt: creationDate,
      mdt: creationDate,
      stfiles: [statusFileObject],
      hb_id: hbId,
    };
  }
  const createBulkAgencyFileStatusResp = await updateBulkAgencyCreateStatus(
    statusObj
  );
  return createBulkAgencyFileStatusResp;
};
const formatBulkAgencyCreateReq = async (convertedAgencyArr) => {
  try {
    let status = true;
    const error = [];

    let metroListData = [];

    if (
      convertedAgencyArr &&
      convertedAgencyArr.length &&
      convertedAgencyArr[0].hb_id
    ) {
      try {
        const metroListResponse = await initLambdaInvoke({
          action: "list",
          httpMethod: "GET",
          body: { hbid: convertedAgencyArr[0].hb_id },
          arn: METROS_LAMBDA_ARN,
        });
        if (metroListResponse && metroListResponse.body) {
          console.log(
            `metroListResponse: ${JSON.stringify(
              metroListResponse.body,
              null,
              4
            )}`
          );
          metroListData = JSON.parse(metroListResponse.body);
        }
      } catch (exception) {
        console.log(
          `formatBulkAgencyCreateReq metro list exception: ${JSON.stringify(
            exception.stack,
            null,
            4
          )}`
        );
      }
    }

    const agencysArr = convertedAgencyArr.map((agency) => {
      // convert the email id to lowercase
      if (agency?.broker?.email)
        agency.broker.email = agency.broker.email?.toLowerCase();
      // convert the comma separated agency.agency_m_id to array of agency_m_id ids
      if (agency.agency_m_id && typeof agency.agency_m_id === "string") {
        const agencyMetroIds = agency.agency_m_id.split(",");
        agency.agency_m_id = agencyMetroIds;
      }

      // convert the comma separated agency.broker_spec to array of broker_spec ids
      if (agency.broker_spec && typeof agency.broker_spec === "string") {
        const brokerSpecIds = agency.broker_spec.split(",");
        agency.broker_spec = brokerSpecIds;
      }

      // convert the comma separated agency.dgraph_list to array of question id objects
      agency.dgraph_list = [];
      for (const agencyKey in agency) {
        if (
          agencyKey.startsWith("agency_qstn_") &&
          typeof agencyKey === "string"
        ) {
          // console.log(`agency: ${JSON.stringify(agency)}`);
          const qstnid = agencyKey.split("agency_qstn_").pop();
          const answersArr = agency[`agency_optn_${qstnid}`]
            ? agency[`agency_optn_${qstnid}`].split(",")
            : [];
          // console.log(`answersArr: ${JSON.stringify(answersArr)}`);
          // Check whether answers for the question is included in the request JSON
          if (answersArr && answersArr.length) {
            // Add the question and answers to dgraph_list array
            agency.dgraph_list.push({
              qstn_id: agency[agencyKey],
              option_id: agency[`agency_optn_${qstnid}`].split(","),
            });
            // Remove the used question and answer
            delete agency[agencyKey];
            delete agency[`agency_optn_${qstnid}`];
          } else {
            // Answers for the question is not available in the request JSON
            status = false;
            error.push(
              `agency_optn_${qstnid} field is missing for agency_qstn_${qstnid} ${
                agency.agency_tname ? agency.agency_tname : ""
              }`
            );
          }
        }
      }

      let filteredMetroList = [];

      if (
        metroListData &&
        metroListData.length &&
        agency.agency_m_id &&
        agency.agency_m_id.length
      ) {
        const filteredMetroListTemp = metroListData.filter((metroItem) =>
          agency.agency_m_id.includes(metroItem.id)
        );
        filteredMetroList = filteredMetroListTemp.map((metroItem1) => ({
          ...metroItem1,
          checked: true,
        }));
      }

      console.log(
        `filteredMetroList: ${JSON.stringify(filteredMetroList, null, 4)}`
      );

      return {
        agency: {
          hb_id: agency.hb_id,
          tname: agency.agency_tname,
          cname: agency.agency_cname,
          m_id: agency.agency_m_id,
          dgraph_list: agency.dgraph_list,
        },
        broker: {
          hb_id: agency.hb_id,
          fname: agency.broker_fname,
          lname: agency.broker_lname,
          email: agency.broker_email,
          phone: agency.broker_phone,
          spec: agency.broker_spec,
        },
        metro: filteredMetroList,
        hb_id: agency.hb_id,
      };
    });

    return { status, agencysArr, error };
  } catch (error) {
    console.log(
      `formatBulkAgencyCreateReq try catch : ${JSON.stringify(
        error.stack,
        null,
        4
      )}`
    );
    return { status: false, agencysArr: [], error: [{ error1: error.stack }] };
  }
};
const sendBulkCreateResponse = (resp, isExternalAPI) => {
  // Send success or failure response if it is the bulk external create API
  // Otherwise send as it is
  console.log(`isExternalAPI: ${isExternalAPI}`);
  console.log(`resp: ${JSON.stringify(resp)}`);
  if (isExternalAPI) {
    if (resp.status) {
      return success(resp);
    }

    return failure(resp);
  }

  return resp;
};
const doesEmailExist = async (emailArray, hbId) => {
  // Elastic query to validate the request email ids
  const queryReqObj = {
    httpMethod: "POST",
    requestPath: "/_search",
    payload: {
      query: {
        bool: {
          must: [
            {
              terms: {
                "email.keyword": emailArray,
              },
            },
            {
              match: {
                "type.keyword": "broker",
              },
            },
            {
              match: {
                "hb_id.keyword": hbId,
              },
            },
          ],
        },
      },
    },
  };
  const validateEmailResp = await aggregate(queryReqObj, true);
  console.log(`validateEmailResp: ${JSON.stringify(validateEmailResp)}`);

  if (validateEmailResp && validateEmailResp.status) {
    return { status: true, data: validateEmailResp.body.hits.hits };
  }

  // Error occured in validate API
  return validateEmailResp;
};
const batchProcessExternalCreateAgency = async (
  agencies,
  appid,
  isExternalAPI
) => {
  const batchParams = {
    RequestItems: {
      [process.env.entitiesTableName]: [],
    },
  };
  console.log(`agencies.length: ${agencies.length}`);
  for (const data of agencies) {
    const dynamicRequiredFieldData = await getDynamicRequiredFields({pathParameters: {id: data.agency.hb_id, type: "agency"}}, true);
    console.log(`dynamicRequiredFieldData: ${JSON.stringify(dynamicRequiredFieldData)}`);
    const agencyRequiredFields = dynamicRequiredFieldData?.data[0]?.required_fields || {};
    const retVal = validateFields(
      "agency",
      JSON.parse(JSON.stringify(data.agency)),
      false,
      agencyRequiredFields
    );
    console.log("retVal: ", retVal);
    if (retVal === "") {
      const agencyJSON = getAgencyCreateJSON(data.agency);
      const brokerJSON = getBrokerCreateJSON(data.broker);
      // Check for data type for the array/object fields
      const isCorrectFieldTypeAgencyResp = isCorrectFieldTypeAgency(
        agencyJSON,
        true
      );
      const isCorrectFieldTypeBrokerResp = isCorrectFieldTypeBroker(
        brokerJSON,
        true
      );
      console.log(
        `isCorrectFieldTypeAgencyResp: ${JSON.stringify(
          isCorrectFieldTypeAgencyResp
        )}`
      );
      console.log(
        `isCorrectFieldTypeBrokerResp: ${JSON.stringify(
          isCorrectFieldTypeBrokerResp
        )}`
      );
      if (
        !isCorrectFieldTypeAgencyResp.status ||
        !isCorrectFieldTypeBrokerResp.status
      ) {
        return {
          error: {
            msg: `Field type mismatch found${
              isExternalAPI
                ? ``
                : `. Please check the response file for further details.`
            }`,
            field: !isCorrectFieldTypeAgencyResp.status
              ? isCorrectFieldTypeAgencyResp.field
              : isCorrectFieldTypeBrokerResp.field,
          },
        };
      }

      // Do validation of UUIDs passed in the payload
      const errorsResp = await validateIdFieldsForAgency(data);
      console.log(`errorsResp: ${JSON.stringify(errorsResp, null, 4)}`);
      if (errorsResp && errorsResp.msg && errorsResp.msg.length) {
        // Errors found
        return { error: errorsResp };
      }
      let brokerCreateItem;
      const agencyData = data.agency;
      const brokerData = data.broker;
      const metroItems = data.metro;
      const { hb_id: hbId } = agencyJSON;
      console.log(`In isCorrectFieldType else`);
      // Proceed with the create operation
      const agencyItem = {
        type: agencyJSON.type,
        hb_id: agencyJSON.hb_id,
        tname: agencyJSON.tname,
        cname: agencyJSON.cname,
        jdt: agencyJSON.jdt,
        mdt: agencyJSON.mod_dt,
        cdt: agencyJSON.cdt,
        m_id: agencyJSON.m_id,
        stat: agencyJSON.stat,
      };
      const agencyUUID = uuidv4();
      agencyItem.gen_src = "bulk";
      agencyItem.dg = [];
      if (agencyData.dgraph_list && agencyData.dgraph_list.length > 0) {
        agencyData.dgraph_list.forEach((dgraphItem) => {
          agencyItem.dg.push({
            q: dgraphItem.qstn_id,
            a: dgraphItem.option_id,
          });
        });
      }

      // Generate Agency Create JSON
      const agencyCreateItem = {
        id: agencyUUID,
        entity: `agency#${hbId}`,
        data: `agency#${hbId}`,
        ...agencyItem,
      };
      batchParams.RequestItems[process.env.entitiesTableName].push({
        PutRequest: {
          Item: agencyCreateItem,
        },
      });

      // Generate the broker create JSON under the agency
      const brokerValidationResp = validateFields("broker", {
        ...brokerData,
        rel_id: agencyUUID,
      }, false, agencyRequiredFields.broker);
      console.log("brokerValidationResp broker: ", brokerValidationResp);
      if (brokerValidationResp === "") {
        const brokerItem = {
          type: brokerJSON.type,
          hb_id: brokerJSON.hb_id,
          fname: brokerJSON.fname,
          lname: brokerJSON.lname,
          jdt: brokerJSON.jdt,
          mdt: brokerJSON.mod_dt,
          cdt: brokerJSON.cdt,
          email: brokerJSON.email,
          phone: brokerJSON.phone,
          rel_id: agencyUUID,
          stat: brokerJSON.stat,
          spec: brokerJSON.spec,
        };
        const brokerUUID = uuidv4();
        brokerCreateItem = {
          id: agencyUUID,
          entity: `broker#${hbId}#${brokerUUID}`,
          data: `agency#${hbId}`,
          ...brokerItem,
        };
        batchParams.RequestItems[process.env.entitiesTableName].push({
          PutRequest: {
            Item: brokerCreateItem,
          },
        });
      } else {
        return failure({
          status: false,
          error: "Validation Failed",
          brokerValidationResp,
        });
      }

      // Generate Metro Create JSON under the agency
      if (agencyItem.m_id && agencyItem.m_id.length) {
        for (const metroItem of metroItems) {
          // Adding the metro id to the data field and removing the id field
          metroItem.data = metroItem.id;
          delete metroItem.id;
          delete metroItem.entity;

          const metroCreateItem = {
            id: agencyUUID,
            entity: `metro#${hbId}#agency#${metroItem.data}`,
            ...metroItem,
          };
          batchParams.RequestItems[process.env.entitiesTableName].push({
            PutRequest: {
              Item: metroCreateItem,
            },
          });
        }
      }

      console.log(`batchParams: ${JSON.stringify(batchParams, null, 4)}`);
    } else {
      return {
        status: false,
        error: {
          msg: `Validation failed${
            isExternalAPI
              ? ``
              : `. Please check the response file for further details.`
          }`,
          field: retVal,
        },
      };
    }
  }

  console.log(`batchParams final: ${JSON.stringify(batchParams, null, 4)}`);

  try {
    // Create agencies as a batch
    console.log(`batchParams: ${JSON.stringify(batchParams)}`);
    const batchWriteResp = await batchWriteItems(batchParams);
    console.log(`batchWriteResp: ${JSON.stringify(batchWriteResp)}`);
    const batchWriteBody = batchWriteResp.body
      ? JSON.parse(batchWriteResp.body)
      : {};
    console.log(`batchWriteBody: ${JSON.stringify(batchWriteBody)}`);
    const unProcessedItems =
      batchWriteBody &&
      batchWriteBody.resp &&
      batchWriteBody.resp.UnprocessedItems
        ? batchWriteBody.resp.UnprocessedItems
        : {};
    console.log(`unProcessedItems: ${JSON.stringify(unProcessedItems)}`);
    const isBatchSuccess = !!(
      Object.entries(unProcessedItems).length === 0 &&
      unProcessedItems.constructor === Object
    );
    console.log(`isBatchSuccess: ${JSON.stringify(isBatchSuccess)}`);
    const unProcessedItemsArr = unProcessedItems[process.env.entitiesTableName]
      ? [...unProcessedItems[process.env.entitiesTableName]]
      : [];
    console.log(`unProcessedItemsArr: ${JSON.stringify(unProcessedItemsArr)}`);

    if (isBatchSuccess) {
      return { status: isBatchSuccess, data: "Processed Successfully" };
    }

    return {
      status: isBatchSuccess,
      error: `Bulk agency creation failed with error(s).`,
    };
  } catch (error) {
    console.log(
      `Exception occured on bulk agency creation: ${JSON.stringify(error)}`
    );
    return { status: false, error };
  }
};
const initExternalCreateAgency = async (
  agencies,
  isExternalBulkAgency = false,
  hbId
) => {
  console.log(`in initExternalCreateAgency`);
  try {
    if (!isExternalBulkAgency && agencies && agencies.length > 50) {
      return sendBulkCreateResponse(
        {
          status: false,
          error: { msg: `Request contains more than 50 agencies` },
        },
        true
      );
    }
    if (agencies && agencies.length === 0) {
      return sendBulkCreateResponse(
        { status: false, error: { msg: `Empty request` } },
        !isExternalBulkAgency
      );
    }

    // Check whether the request agency array contains different hb_id or invalid hb_id
    const hbidArr = agencies.map((agency) => agency.hb_id);
    const uniqueHbidArr = [...new Set(hbidArr)];
    console.log(`uniqueHbidArr: ${uniqueHbidArr}`);
    if (uniqueHbidArr.length !== 1) {
      // hb_id provided for the agencies are not unique
      return sendBulkCreateResponse(
        {
          status: false,
          error: { msg: `Please provide the same hb_id for the agencies` },
        },
        !isExternalBulkAgency
      );
    }
    if (uniqueHbidArr.length === 1 && uniqueHbidArr[0] !== hbId) {
      // hb_id value is not valid for this home builder
      return sendBulkCreateResponse(
        {
          status: false,
          error: { msg: `Please provide a valid hb_id for the agencies` },
        },
        !isExternalBulkAgency
      );
    }

    // Check whether the hb_id value for the agency is valid in db
    const getBuilderResp = await getBuilderAsync(hbId);
    console.log(`getBuilderResp: ${JSON.stringify(getBuilderResp)}`);
    if (getBuilderResp && getBuilderResp.id) {
      // Check whether the request broker array contains duplicate emails
      const emailArray = agencies.map((agency) => agency.broker.email);
      console.log(`emailArray: ${emailArray}`);

      // Returns each email whose index is not equal to the first occurrence index of the email in the array
      const duplicateEmails = emailArray.filter(
        (item, index) => emailArray.indexOf(item) !== index
      );

      if (duplicateEmails.length) {
        return sendBulkCreateResponse(
          {
            status: false,
            error: {
              msg: `Request contains duplicate email id in the email field (${[
                ...new Set(duplicateEmails),
              ]})`,
              field: `email`,
            },
          },
          !isExternalBulkAgency
        );
      }

      let existingEmailArr = [];
      // Check whether the email addresses in the request does not exist in the application
      const existingEmailArrayResp = await doesEmailExist(
        emailArray,
        agencies[0].hb_id
      );

      if (
        existingEmailArrayResp.status &&
        existingEmailArrayResp.data &&
        existingEmailArrayResp.data.length
      ) {
        // return sendBulkCreateResponse({ status: false, error: { msg: `Broker(s) with email id ${[...new Set(existingEmailArrayResp.data.map(brokerItem => brokerItem._source.email))]} already exists in the application`, field: "email" } }, !isExternalBulkAgency);
        existingEmailArr = [
          ...new Set(
            existingEmailArrayResp.data.map((broker) => broker._source.email)
          ),
        ];
        console.log(
          `Broker(s) with email id ${JSON.stringify(
            existingEmailArr
          )} already exists in the application`
        );
        // Remove the existing agencies object from the request
        agencies = agencies.filter(
          (agency) => !existingEmailArr.includes(agency.broker.email)
        );
        console.log(
          `agencies after existing emails removed: ${JSON.stringify(agencies)}`
        );
      }
      if (agencies && agencies.length) {
        const batchExecuteResp = await batchProcessExternalCreateAgency(
          agencies,
          getBuilderResp.appid,
          !isExternalBulkAgency
        );
        console.log(`batchExecuteResp: ${JSON.stringify(batchExecuteResp)}`);
        return sendBulkCreateResponse(
          { ...batchExecuteResp, skipped: existingEmailArr ?? [] },
          !isExternalBulkAgency
        );
      }

      console.log(`No agencies to import`);
      return sendBulkCreateResponse(
        { status: true, skipped: existingEmailArr ?? [] },
        !isExternalBulkAgency
      );
    }

    return sendBulkCreateResponse(
      {
        status: false,
        error: { msg: `Please provide a valid hb_id for the agencies` },
      },
      !isExternalBulkAgency
    );
  } catch (error) {
    console.log(
      `initExternalCreateAgency try catch : ${JSON.stringify(
        error.stack,
        null,
        4
      )}`
    );
    return sendBulkCreateResponse(
      { status: false, error: { msg: JSON.stringify(error.stack, null, 4) } },
      !isExternalBulkAgency
    );
  }
};
const initCreateBulkAgencys = async (data) => {
  let creationStatus;
  console.log(`data: ${JSON.stringify(data)}`);
  const { fileKey = "", hb_id: hbId = "" } = data;
  const bucketName = FILE_MANAGER_BUCKET_NAME;
  const statusFileKey = `${fileKey}_response.json`;
  const formattedFileKey = `${fileKey}_formatted.json`;
  let createStartTimestamp;
  const uploadStatusFileAndUpdateDB = async (
    startTimestamp,
    status,
    resp,
    error = []
  ) => {
    const endTimestamp = new Date().toISOString();
    const statusFileContent = {
      status,
      start: startTimestamp,
      end: endTimestamp,
      response: resp,
    };
    await uploadStatusFile(bucketName, statusFileKey, statusFileContent);

    if (typeof error === "string") error = [error];
    const statusFileObject = {
      status,
      start: startTimestamp,
      end: endTimestamp,
      csv: fileKey,
      formatted: formattedFileKey,
      response: statusFileKey,
    };
    if (error && error?.length > 5)
      statusFileObject.error = [
        "Please refer to the status file for error details.",
      ];
    else statusFileObject.error = error;
    await createBulkAgencyFileStatus(hbId, statusFileObject);
  };

  // Get, convert and validate the csv file
  const validationStartTimestamp = new Date().toISOString();
  try {
    // Update the status of the bulk agency create with PROCESSING status
    await uploadStatusFileAndUpdateDB(
      validationStartTimestamp,
      AGENCY_FILE_STATUS_PROCESSING,
      [],
      []
    );

    const validateCSVResp = await convertCSVAndValidate(data);
    if (validateCSVResp && !validateCSVResp.status) {
      // Validation error occured
      // Upload status file to s3
      await uploadStatusFileAndUpdateDB(
        validationStartTimestamp,
        AGENCY_FILE_STATUS_FAILED,
        validateCSVResp,
        validateCSVResp.error
      );
      return validateCSVResp;
    }

    const convertedAgencyArr = validateCSVResp.agencies;
    createStartTimestamp = new Date().toISOString();

    // Format the converted JSON to match the agency
    const agencysArrResp = await formatBulkAgencyCreateReq(convertedAgencyArr);
    console.log(`agencysArrResp: ${JSON.stringify(agencysArrResp)}`);

    if (agencysArrResp && !agencysArrResp.status) {
      await uploadStatusFileAndUpdateDB(
        createStartTimestamp,
        AGENCY_FILE_STATUS_FAILED,
        agencysArrResp.error,
        agencysArrResp.error
      );
      return agencysArrResp;
    }

    const { agencysArr } = agencysArrResp;
    console.log(`agencysArr: ${JSON.stringify(agencysArr)}`);

    // Upload the formatted agency arr to S3
    const formatEndTimestamp = new Date().toISOString();
    const formattedJSONContent = {
      start: createStartTimestamp,
      end: formatEndTimestamp,
      agencies: agencysArr,
    };
    await uploadStatusFile(bucketName, formattedFileKey, formattedJSONContent);
    const agencyCreateResp = await initExternalCreateAgency(
      agencysArr,
      true,
      hbId
    );

    console.log(`completed initExternalCreateAgency`);

    let responseFunction;
    let errorMsg = [];
    if (agencyCreateResp.status) {
      // successful creation
      creationStatus = AGENCY_FILE_STATUS_COMPLETED;
      responseFunction = success;
    } else {
      // creation failed
      creationStatus = AGENCY_FILE_STATUS_FAILED;
      responseFunction = failure;
      const error =
        agencyCreateResp.error && agencyCreateResp.error.msg
          ? agencyCreateResp.error.msg
          : "";
      if (typeof error === "string") {
        errorMsg.push(error);
      } else if (Array.isArray(error)) {
        errorMsg = [...error];
      }
    }

    // Upload status file to s3
    await uploadStatusFileAndUpdateDB(
      createStartTimestamp,
      creationStatus,
      agencyCreateResp,
      errorMsg
    );
    // Remove the processedarr from the success message if available
    let bulkCreateResponse;
    if (
      agencyCreateResp &&
      agencyCreateResp.data &&
      agencyCreateResp.data.Body
    ) {
      bulkCreateResponse = JSON.parse(agencyCreateResp.data.Body);
      // If the processedarr key is present, remove it before sending the response
      if (bulkCreateResponse.processedarr) {
        delete bulkCreateResponse.processedarr;
      }
    }

    console.log(`initCreateBulkAgencys Completed`);

    return responseFunction({ bulkCreateResponse });
  } catch (error) {
    console.log(`Exception Caught: ${JSON.stringify(error)}`);
    return failure({ error });
  }
};
const getBulkAgencyStatus = async (data) => {
  console.log(`data: ${JSON.stringify(data)}`);
  const { hb_id: hbId = "" } = data;
  if (!hbId) {
    return failure({ status: false, error: "Home builder Id is missing" });
  }

  const bulkAgencyCreateStatusResp = await getRecordByEntity(
    `agency_create_status#${hbId}`
  );
  // console.log(`bulkAgencyCreateStatusResp: ${ JSON.stringify(bulkAgencyCreateStatusResp) }`);
  return success(bulkAgencyCreateStatusResp);
};

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */
export async function main(event) {
  let response;
  try {
    console.log(`event: ${JSON.stringify(event)}`);
    const action =
      event && event.pathParameters && event.pathParameters.action
        ? event.pathParameters.action
        : "";
    const isExternalAPI =
      event && event.path ? event.path.includes("external") : false;
    const isExternalBulkAgency =
      event && event.path ? event.path.includes("bulkagency") : false;
    const isExternalAgencyCreate =
      event && event.path ? event.path.includes("create") : false;
    console.log(`isExternalBulkAgency: ${isExternalBulkAgency}`);
    console.log(`isExternalAgencyCreate: ${isExternalAgencyCreate}`);
    console.log(`isExternalAPI: ${isExternalAPI}`);
    if (event.source !== "aws.events") {
      let data;
      switch (event.httpMethod) {
        case "POST":
          data = JSON.parse(event.body);
          if (!data) {
            response = failure();
          } else if (action === "initCreate") {
            response = await initCreateBulkAgencys(data);
          } else if (action === "getstatus") {
            response = await getBulkAgencyStatus(data);
          } else {
            response = failure();
          }
          break;
        default:
          response = failure();
      }
    }
    console.log(`response: ${JSON.stringify(response)}`);
  } catch (err) {
    console.log(`Exception in bulkagency lambda: ${err}`);
    return err;
  }
  return response;
}
