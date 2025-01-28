/* eslint-disable camelcase */
/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import {
  postResources,
  getRecordByEntity,
  getUserCreateJSON,
  batchWriteItems,
  isCorrectFieldType,
  getParamsForQuery,
  getResourceJSON,
  getEntityByIdsElastic
} from "../libs/db";
import { badRequest, failure, success } from "../libs/response-lib";
import { aggregate, elasticExecuteQuery } from "../search/search";
import {
  validateFields,
  validateFieldsV2,
  validateIdFieldsForExternal,
} from "../validation/validation";
import { getBuilderAsync, getMessagingParams } from "../builders/builders";
import { publishEntityData } from "../libs/messaging";
import { createChangeActivity } from "../libs/change-activity";
import { initLambdaInvoke } from "../libs/lambda";
import utils from "../libs/utils";
import { incrementGoalCount } from "../goalSetting/goalSetting";
import { getDynamicRequiredFields } from "../dynamicRequiredFields/dynamicRequiredFields";
import { getEmailNotitificationParams } from "../campaign/campaign";
import { getSource } from "../source/source";

const {
  STACK_PREFIX,
  FILE_MANAGER_BUCKET_NAME,
  ACTIVITY_LAMBDA_ARN,
  COMMUNITY_LAMBDA_ARN,
  NOTIFICATION_LAMBDA_ARN,
  USER_LAMBDA_ARN
} = process.env;
const csvToJSON = require("csvtojson");

const s3 = new AWS.S3({ apiVersion: "2006-03-01" });
const ses = new AWS.SES({
  region: "us-west-2",
});
const CUSTOMER_FILE_STATUS_COMPLETED = "COMPLETED";
const CUSTOMER_FILE_STATUS_PROCESSING = "PROCESSING";
const CUSTOMER_FILE_STATUS_FAILED = "FAILED";


// const userAgentLookup = async (email) => {
//   try {
//     const userQuery = {
//       httpMethod: "POST",
//       requestPath: "/_search",
//       payload: {
//         query: {
//           bool: {
//             filter: [
//               {
//                 terms: {
//                   "utype.keyword": ["admin", "agent", "online_agent"]
//                 }
//               },
//               {
//                 term: {
//                   "email.keyword": email
//                 }
//               }
//             ]
//           }
//         },
//         _source: {
//           includes: [
//             "id", "email", "fname", "lname", "utype", "entity"
//           ]
//         },
//       }
//     }
//     console.log(`memoizedAgentLookup :: userQuery :: ${JSON.stringify(userQuery)}`);
//     const userResp = await elasticExecuteQuery(userQuery, true);
//     console.log(`memoizedAgentLookup :: user :: ${JSON.stringify(userResp)}`);
//     if (userResp?.body?.hits?.hits.length) {
//       const user = userResp?.body?.hits?.hits[0]._source;
//       const fields = {
//         fname: user.fname,
//         lname: user.lname,
//         utype: user.utype,
//         entity: user.entity,
//         id: user.id
//       }
//       return { status: true, user: { ...fields } }
//     }
//     return { status: false, msg: `User with email ${email} not found.` }
//   } catch (error) {
//     console.log("An error occured in lookup", error);
//     return { status: false, msg: "An error occured in lookup" }
//   }
// }

// const memoizedLookup = async (email, callback) => {
//   const cache = {};
//   if (cache[email]) {
//     return { ...cache[email], status: true }
//   }
//   const resp = await callback(email);
//   if (resp.status) {
//     cache[email] = { ...resp.user }
//   }
//   return resp;
// }

const updateBulkCustomerCreateStatus = async (statusObj) => {
  const params = {
    TableName: process.env.entitiesTableName,
    Item: statusObj,
  };
  console.log(params);
  const customerFileResp = await postResources(params);
  return customerFileResp;
};
const convertCSVAndValidate = async (data) => {
  const bucketName = FILE_MANAGER_BUCKET_NAME;
  const fileKey = data.fileKey ? data.fileKey : "";
  const validFields = [
    "fname",
    "lname",
    "email",
    "phone",
    "stage",
    "psrc",
    "grade",
    "cntm",
    "infl",
    "inte",
    "desf",
    "desm",
    "type",
    "hb_id",
    "optst",
  ];
  // Get the customer creation file from S3
  const s3Params = {
    Bucket: bucketName,
    Key: fileKey,
  };
  // Create a read stream of the uploaded csv file
  const getObjectStream = s3.getObject(s3Params).createReadStream();

  // Convert the csv to json
  const customers = await csvToJSON().fromStream(getObjectStream);
  // console.log(`customers: ${JSON.stringify(customers)}`);

  const testQuestionKey = /qstn_[0-9]{1,2}/g;
  const testAnswerKey = /optn_[0-9]{1,2}/g;

  const testNoteKey = /note_[0-9]{1,2}/g;
  const testNoteSubjectKey = /sub_[0-9]{1,2}/g;

  // Check whether any customer exist
  if (customers.length === 0) {
    // No customers found in the request
    return { status: false, error: ["No customers found in CSV"], customers };
  }

  // Validate whether the fields in the converted JSON is valid for a customer
  // Checking only the first customer object since the csv headers will be same for each object
  const fieldErrors = [];
  // console.log(`customers.length: ${customers.length}`);
  for (const key in customers[0]) {
    if (key) {
      // console.log(`key: ${key}`);
      const isKeyAQuestion = testQuestionKey.test(key);
      const isKeyAnAnswer = testAnswerKey.test(key);

      const isKeyANote = testNoteKey.test(key);
      const isKeyASubject = testNoteSubjectKey.test(key);

      /* console.log(`isKeyAQuestion: ${isKeyAQuestion}`);
      console.log(`isKeyAnAnswer: ${isKeyAnAnswer}`);

      console.log(`isKeyANote: ${isKeyANote}`);
      console.log(`isKeyASubject: ${isKeyASubject}`); */

      if (!validFields.includes(key)) {
        // console.log(`In !validFields.includes(key)`);
        // Field not valid
        // Check whether it matches the demographics question or answer key
        // And Check whether it matches the note or subject key
        if (
          !isKeyAQuestion &&
          !isKeyAnAnswer &&
          !isKeyANote &&
          !isKeyASubject
        ) {
          // console.log(`In !isKeyAQuestion && !isKeyAnAnswer`);
          fieldErrors.push(`${key} field is invalid`);
        }
      }
    }
  }
  // console.log(`fieldErrors: ${fieldErrors}`);

  // True if valid. False if invalid.
  const validationStatus = !(fieldErrors && fieldErrors.length);
  // console.log(`validationStatus: ${validationStatus}`);
  return { status: validationStatus, error: fieldErrors, customers };
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
const createBulkCustomerFileStatus = async (hbId, statusFileObject) => {
  console.log(
    `In createBulkCustomerFileStatus statusFileObject: ${JSON.stringify(
      statusFileObject
    )}`
  );
  // Create/Update the customer bulk creation status record for this home builder
  // First check for existing customer bulk creation status record for this home builder
  const bulkCustomerCreateStatusResp = await getRecordByEntity(
    `customer_create_status#${hbId}`
  );
  // console.log(`bulkCustomerCreateStatusResp: ${JSON.stringify(bulkCustomerCreateStatusResp)}`);

  const type = `customer_create_status`;
  let statusObj = {};
  if (bulkCustomerCreateStatusResp && bulkCustomerCreateStatusResp.length) {
    // Record exists. Update the status file path in the record
    // Modify the existing record object
    statusObj = { ...bulkCustomerCreateStatusResp[0] };
    statusObj.mdt = Date.now();

    // console.log(`statusFileObject: ${JSON.stringify(statusFileObject)}`);
    if (statusFileObject.status === CUSTOMER_FILE_STATUS_PROCESSING) {
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
  const createBulkCustomerFileStatusResp = await updateBulkCustomerCreateStatus(
    statusObj
  );
  return createBulkCustomerFileStatusResp;
};
const formatBulkCustomerCreateReq = (convertedCustomerArr) => {
  let status = true;
  const error = [];
  const customersArr = convertedCustomerArr.map((customer) => {
    // convert the email id to lowercase
    if (customer?.email) customer.email = customer.email?.toLowerCase();
    // convert the comma separated customer.inte to array of inte ids
    if (customer.inte && typeof customer.inte === "string") {
      const inteIds = customer.inte.split(",");
      customer.inte = inteIds;
    }
    // convert the comma separated customer.infl to array of infl ids
    if (customer.infl && typeof customer.infl === "string") {
      const inflIds = customer.infl.split(",");
      customer.infl = inflIds;
    }
    // convert the comma separated customer.desf to array of desf ids
    if (customer.desf && typeof customer.desf === "string") {
      const desfIds = customer.desf.split(",");
      customer.desf = desfIds;
    }

    // convert the comma separated customer.dgraph_list to array of question id objects
    customer.dgraph_list = [];
    customer.notes_list = [];
    for (const customerKey in customer) {
      if (customerKey.startsWith("qstn_") && typeof customerKey === "string") {
        // console.log(`customer: ${JSON.stringify(customer)}`);
        const qstnid = customerKey.split("qstn_").pop();
        const answersArr = customer[`optn_${qstnid}`]
          ? customer[`optn_${qstnid}`].split(",")
          : [];
        // console.log(`answersArr: ${JSON.stringify(answersArr)}`);
        // Check whether answers for the question is included in the request JSON
        if (answersArr && answersArr.length) {
          // Add the question and answers to dgraph_list array
          customer.dgraph_list.push({
            qstn_id: customer[customerKey],
            option_id: customer[`optn_${qstnid}`].split(","),
          });
          // Remove the used question and answer
          delete customer[customerKey];
          delete customer[`optn_${qstnid}`];
        } else {
          // Answers for the question is not available in the request JSON
          status = false;
          error.push(
            `optn_${qstnid} field is missing for qstn_${qstnid} ${customer.email ? customer.email : ""
            }`
          );
        }
      } else if (
        customerKey.startsWith("note_") &&
        typeof customerKey === "string"
      ) {
        // console.log(`customer: ${JSON.stringify(customer)}`);
        const noteid = customerKey.split("note_").pop();
        const subject = customer[`sub_${noteid}`] || "";
        const note = customer[customerKey];
        // console.log(`answersArr: ${JSON.stringify(answersArr)}`);
        // Check whether answers for the question is included in the request JSON
        if (subject) {
          // Add the question and answers to dgraph_list array
          customer.notes_list.push({ note, subject });
          // Remove the used question and answer
          delete customer[customerKey];
          delete customer[`sub_${noteid}`];
        } else {
          // Answers for the question is not available in the request JSON
          status = false;
          error.push(
            `sub_${noteid} field is missing for note_${noteid} ${customer.email ? customer.email : ""
            }`
          );
        }
      }
    }
    return customer;
  });
  return { status, customersArr, error };
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
const getCustomerDetails = async (hbid, id) => {
  const params = getParamsForQuery(
    {
      pathParameters: { id, hbid },
    },
    "customer"
  );
  return getResourceJSON(params);
};

const notifyLeadFn = async (leadsArray, builderData, notesArray) => {
  try {

    //debugger
    console.log(`leadsArray: ${JSON.stringify(leadsArray)}`);
    console.log(`builderEmailId: ${JSON.stringify(builderData.email)}`);
    console.log(`notesArray: ${JSON.stringify(notesArray)}`);

    const formateDate = (date) => {
      const dateResp = date ?
        Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short' })
          .format(new Date(date))
        :
        '';

      //debugger
      console.log(`dateResp: ${JSON.stringify(dateResp)}`);
      return dateResp;
    };

    const getCommNames = async (commIds, hbId) => {
      if (!commIds.length) return '';

      const { status, data } = await getEntityByIdsElastic({
        ids: commIds,
        hbId,
        isJSONOnly: true,
        entity: "community"
      })

      return status ? data?.map(c => c.name).join(', ') : '';
    };

    const getSourceName = async (sourceId, hbId) => {
      if (!sourceId) return '';
      const response = await getSource({
        pathParameters: { id: sourceId, hbid: hbId }
      });
      const sourceResult = JSON.parse(response?.body || '[]');
      return sourceResult.length ? sourceResult[0].name : '';
    };

    for (const lead of leadsArray) {

      const notesData = notesArray.find(eachNote => eachNote.email.toLowerCase() === lead.email.toLowerCase());

      //debugger
      console.log(`notesData: ${JSON.stringify(notesData)}`);

      let leadData = {
        name: lead.fullname,
        email: lead.email,
        phone: lead.phone,
        date: formateDate(parseInt(lead.jdt)),
        community: await getCommNames(lead?.inte, builderData.id),
        source: await getSourceName(lead?.psrc, builderData.id),
        notes: notesData && Object.keys(notesData).length ? notesData : ''
      };

      //debugger
      console.log(`leadData before params: ${JSON.stringify(leadData)}`);

      const emailParams = getEmailNotitificationParams({
        leadData,
        builderName: builderData.name,
        toAddress: builderData.notifyEmailId,
        fromAddress: builderData.email
      })

      if (!emailParams.status) throw new Error(emailParams.error);

      const emailResult = await ses.sendEmail(emailParams.result).promise();

      //debugger
      console.log(`emailResult: ${JSON.stringify(emailResult)}`);
    };
    return { status: true }
  } catch (error) {
    return { status: false, error };
  }
};

const handleActivitiesAndMessaging = async ({
  stage,
  userid,
  customerUUID,
  hbId,
  isExternalAPI,
  inte,
  note,
  noteSub,
  notesArr,
  isSns,
  isStageOkay,
  paramItem,
  isUpdate,
  oldinte,
  oldst,
  doCreateNote,
  isApiV2
}) => {
  console.log(`stage: ${stage}`);
  console.log(`userid: ${userid}`);
  console.log(`customerUUID: ${customerUUID}`);
  console.log(`hbId: ${hbId}`);
  console.log(`isExternalAPI: ${isExternalAPI}`);
  console.log(`inte: ${JSON.stringify(inte)}`);
  console.log(`note: ${note}`);
  console.log(`noteSub: ${noteSub}`);
  console.log(`doCreateNote: ${doCreateNote}`);
  console.log(`notesArr: ${JSON.stringify(notesArr)}`);
  console.log(`isSns: ${isSns}`);
  console.log(`isStageOkay: ${isStageOkay}`);
  console.log(`paramItem: ${JSON.stringify(paramItem)}`);
  console.log(`isUpdate: ${isUpdate}`);
  console.log(`oldinte: ${JSON.stringify(oldinte)}`);
  console.log(`oldst: ${oldst}`);
  console.log(`isApiV2: ${isApiV2}`);
  const response = {};

  if (!isUpdate) {
    console.log(`In !isUpdate: Create customer `);
    // Push the activity create params into an array so that we can run them one by one after creating customers in batch
    // Create stage change activity
    const stageChangeActivityObj = {
      stage,
      userid,
      customerUUID,
      hbId,
      inte,
    };

    if (isExternalAPI) {
      stageChangeActivityObj.isBulkAPI = true;
    } else {
      stageChangeActivityObj.isBulk = true;
    }
    console.log(
      `stageChangeActivityObj:${JSON.stringify(stageChangeActivityObj)}`
    );
    response.stageChangeActivityObj = stageChangeActivityObj;

    if (inte.length) {
      console.log(`In inte.length: Create customer`);
      // Create interest activity change
      const inteChangeActivityObj = {
        inte,
        userid,
        customerUUID,
        hbId,
        inteChange: true,
      };
      if (isExternalAPI) {
        inteChangeActivityObj.isBulkAPI = true;
      } else {
        inteChangeActivityObj.isBulk = true;
      }
      console.log(
        `inteChangeActivityObj:${JSON.stringify(inteChangeActivityObj)}`
      );
      response.inteChangeActivityObj = inteChangeActivityObj;
    }
  } else {
    console.log(`In !isUpdate else: Update customer `);
    if (oldst !== stage) {
      console.log(`In oldst !== stage: Update customer `);
      const stageChangeActivityObj = {
        stage,
        oldst,
        userid,
        customerUUID,
        hbId,
        inte,
      };

      if (isExternalAPI) {
        stageChangeActivityObj.isBulkAPI = true;
      } else {
        stageChangeActivityObj.isBulk = true;
      }
      console.log(
        `stageChangeActivityObj: ${JSON.stringify(stageChangeActivityObj)}`
      );
      response.stageChangeActivityObj = stageChangeActivityObj;
    }
    const changedInterests = utils.findArraySymmetricDifference(oldinte, inte);
    console.log(`changedInterests: ${JSON.stringify(changedInterests)}`);
    // Check whether any of the items in the interests array in the request
    // is not present in the existing inte array of the cusomer
    // changedInterests.removed is an array consisting of all the interests
    // that are not present in the customer's inte array
    if (changedInterests.removed.length) {
      console.log(`In changedInterests.removed.length: Update customer `);
      // New interests found in the request
      // Create interest activity change
      const inteChangeActivityObj = {
        inte: [
          ...(oldinte && oldinte?.length ? oldinte : []),
          ...(inte && inte?.length ? inte : []),
        ],
        oldinte,
        userid,
        customerUUID,
        hbId,
        inteChange: true,
        stage,
        addedInte: changedInterests.removed,
      };
      if (isExternalAPI) {
        inteChangeActivityObj.isBulkAPI = true;
      } else {
        inteChangeActivityObj.isBulk = true;
      }
      console.log(
        `inteChangeActivityObj: ${JSON.stringify(inteChangeActivityObj)}`
      );
      response.inteChangeActivityObj = inteChangeActivityObj;
    }
  }
  const getNoteReqObj = async ({ noteText = "", noteSubject = "" }) => {
    let activityReqObj;
    try {
      console.log(`In try note: activity creation `);
      activityReqObj = {
        rel_id: customerUUID,
        hb_id: hbId,
        acti: {
          sub: noteSubject || "",
          note: noteText || `<!DOCTYPE html>\n<html>\n<head>\n</head>\n<body>\n\n</body>\n</html>`,
          dt: Date.now(),
          atype: "note",
        },
        isBulkAPI: false,
        isBulk: false,
      };

      if (isApiV2) {
        console.log(`In isApiV2 cmpby`);

        activityReqObj.acti.cmpby = {
          fname: `API`,
          lname: `Import`,
          utype: `external`,
          entity: `zapier`
        }
      }

      if (isExternalAPI) {
        activityReqObj.isBulkAPI = true;
      } else {
        activityReqObj.isBulk = true;
      }
      console.log(`activityReqObj: ${JSON.stringify(activityReqObj)}`);
    } catch (error) {
      console.log(`note create error: ${JSON.stringify(error.stack)}`);
    }
    return activityReqObj;
  };
  if (isExternalAPI) {
    // Check for note to be created in external API
    if (doCreateNote) {
      response.activityReqObjArr = [
        await getNoteReqObj({ noteText: note, noteSubject: noteSub }),
      ];
    }
  } else {
    // For customer bulk import using file upload
    // Use the notesArr to create multiple notes for the customer
    response.activityReqObjArr = [];
    for (const noteObj of notesArr) {
      response.activityReqObjArr.push(
        await getNoteReqObj({ noteText: noteObj.note, noteSubject: noteObj.subject })
      );
    }
  }
  // Push the messaging params into an array so that we can run them one by one after creating customers in batch
  if (
    !isSns &&
    isStageOkay &&
    (STACK_PREFIX.includes("aws-crm") || STACK_PREFIX.includes("crm-test"))
  ) {
    console.log(`paramItem: ${JSON.stringify(paramItem)}`);
    response.messagingObj = { ...paramItem };
  }
  console.log(`response at the end: ${JSON.stringify(response)}`);
  return response;
};
const getCustomerUpdateParams = async (customerItem) => {
  console.log("customerItem: ", customerItem);
  const {
    id = "",
    type = "",
    hb_id: hbId = "",
    fname = "",
    lname = "",
    email = "",
    stage = "",
    appid = "",
    phone = "",
    psrc = "",
    infl = [],
    inte = [],
    grade = "",
    desf = [],
    cntm = "",
    dg = [],
    gen_src = "",
    m_id,
    desm = "",
    addr = "",
  } = customerItem;
  const item = {
    type,
    hb_id: hbId,
    email,
    appid,
    entity: `customer#${hbId}`,
    m_id,
  };
  // Get the Customer Details
  const customerDetails = await getCustomerDetails(hbId, id);
  console.log("customerDetails: ", customerDetails);
  const customerObj = customerDetails?.length && customerDetails[0];
  const customerId = customerObj?.id || "";
  const cdt = customerObj?.cdt || "";
  const jdt = customerObj?.jdt || "";
  const currentStage = customerObj?.stage || "";
  const interests = customerObj?.inte || [];
  const influences = customerObj?.infl || [];
  const desiredFeatures = customerObj?.desf || [];
  const demographics = customerObj?.dg || [];
  const address = customerObj?.addr || "";


  item.addr = addr || address;

  item.gen_src = customerObj?.gen_src || gen_src;

  const enddt = customerObj?.enddt || 0;

  if (customerObj.newst) {
    item.oldst = customerObj.newst
  };

  item.id = customerId;
  item.cdt = cdt;
  item.mdt = Date.now();
  item.jdt = jdt;

  // beback field adding
  item.newst = true;

  // count for update
  item.enddt = enddt + 1;

  if (fname) item.fname = fname;
  if (lname) item.lname = lname;
  if (phone) item.phone = phone;
  if (stage) item.stage = stage;
  if (desm) item.desm = desm;

  item.fullname = `${item.fname} ${item.lname || ""}`;

  if (psrc) item.psrc = psrc;
  if (grade) item.grade = grade;
  if (cntm) item.cntm = cntm;

  item.inte = [...new Set([...interests, ...inte])];
  item.infl = [...new Set([...influences, ...infl])];
  item.desf = [...new Set([...desiredFeatures, ...desf])];

  // const dgToAdd = dg.filter((currentDg) =>
  //   demographics.findIndex(
  //     (demographic) => (demographic.q === currentDg.q) === -1
  //   )
  // );

  dg.forEach(currentDg => {
    const index = demographics.findIndex(demographic => demographic.q === currentDg.q)

    if (index === -1) {
      console.log(`dgToAdd: ${JSON.stringify(currentDg)}`);
      demographics.push(currentDg);
    } else {
      demographics[index] = currentDg;
    };
  })

  item.dg = [...demographics];
  item.newinte = customerItem.newinte;

  console.log("item: ", item);
  console.log("inte: ", inte);
  console.log("oldst: ", currentStage);
  return { item, oldinte: interests, oldst: currentStage };
};
const batchProcessExternalCreateCustomer = async ({
  customers,
  appid,
  isExternalAPI,
  builderOptin,
  existingEmailArr,
  emailCustomerIdObj,
  commMappedMetro,
  isApiV2,
  builderData
}) => {
  const batchParams = {
    RequestItems: {
      [process.env.entitiesTableName]: [],
    },
  };
  let customerMessagingParams = [];
  let stageChangeActivityParams = [];
  let inteChangeActivityParams = [];
  let noteActivityParams = [];
  const notificationArgs = [];
  console.log(`customers.length: ${customers.length}`);
  console.log(`isApiV2 ${isApiV2}`);
  const v2ErrorObj = { errors: [], warnings: [] };
  const notesArrayForNotification = [];
  for (const data of customers) {

    console.log(`Each data: ${JSON.stringify(data)}`);
    const {
      note = "",
      noteSub = "",
      email = "",
      agent_email = "",
      notes_list: notesArr = [],
      dg = {}
    } = data;

    const doCreateNote = !((!noteSub));
    console.log(`noteSub : ${noteSub}`);
    console.log(`note : ${note}`);
    console.log(`Agent Email : ${agent_email}`);
    console.log(`batchProcessExternalCreateCustomer :: doCreateNote : ${doCreateNote}`);

    if (doCreateNote) {
      notesArrayForNotification.push({
        note,
        noteSub,
        email
      })
    };

    const dynamicRequiredFieldData = await getDynamicRequiredFields({ pathParameters: { id: data.hb_id, type: "customer" } }, true);
    console.log(`dynamicRequiredFieldData: ${JSON.stringify(dynamicRequiredFieldData)}`);
    const customerRequiredFields = dynamicRequiredFieldData?.data[0]?.required_fields || {};
    let retVal;
    let v2Customer = {};
    if (isApiV2) {
      try {
        const { status, errors: v2Errors, customer } = await validateFieldsV2("customer", data);
        console.log(`customer: ${JSON.stringify(customer)}`);
        const minReqFields = ["fname", "lname", "email", "stage", "psrc"];
        const builderEnabledFields = Object.keys(customerRequiredFields).filter(field => customerRequiredFields[field]);
        const totalReqFields = new Set([...minReqFields, ...builderEnabledFields]);
        for (const errKey in v2Errors) {
          if (totalReqFields.has(errKey)) {
            v2ErrorObj.errors.push(v2Errors[errKey])
          } else {
            v2ErrorObj.warnings.push(v2Errors[errKey])
          }
        }
        if (!doCreateNote && note && note.length) {
          v2ErrorObj.warnings.push('Cannot add notes without subject')
        }
        console.log("v2Status : ", status);
        console.log("v2Errors : ", JSON.stringify(v2Errors));
        console.log("v2ErrorObj : ", JSON.stringify(v2ErrorObj));

        if (v2ErrorObj.errors.length) {
          return {
            statusCode: 400,
            error: {
              msg: `Unable to create customer. ${v2ErrorObj.errors.join(', ')}`
            }
          }
        }
        retVal = "";
        v2Customer = { ...customer }
      } catch (error) {
        console.log("Error in validateFieldsV2", error);
        return {
          error: {
            msg: error.errorMessage
          }
        }
      }
    } else {
      retVal = validateFields("customer", JSON.parse(JSON.stringify(data)), false, customerRequiredFields);
    }
    console.log("retVal: ", retVal);
    if (retVal === "") {
      const userJSON = isApiV2 ? getUserCreateJSON({ ...data, ...v2Customer }) : getUserCreateJSON(data);
      // Check for data type for the array/object fields
      const isCorrectFieldTypeResp = isCorrectFieldType(userJSON, true);
      console.log(
        `isCorrectFieldTypeResp: ${JSON.stringify(isCorrectFieldTypeResp)}`
      );
      if (!isCorrectFieldTypeResp.status) {
        return {
          error: {
            msg: `Field type mismatch found${isExternalAPI
              ? ``
              : `. Please check the response file for further details.`
              }`,
            field: isCorrectFieldTypeResp.field,
          },
        };
      }

      // Do validation of UUIDs passed in the payload
      const errorsResp = isApiV2 ? await validateIdFieldsForExternal({ ...data, ...v2Customer }) : await validateIdFieldsForExternal(data);
      if (errorsResp && errorsResp.msg && errorsResp.msg.length) {
        // Errors found
        return { error: errorsResp };
      }

      // Proceed with the create operation
      const customerItem = {
        type: userJSON.type,
        hb_id: userJSON.hb_id,
        fname: userJSON.fname,
        lname: userJSON.lname,
        fullname: `${userJSON.fname} ${userJSON.lname || ""}`,
        email: userJSON.email,
        jdt: userJSON.jdt,
        mdt: userJSON.mod_dt,
        cdt: userJSON.cdt,
        inte: userJSON.inte,
        infl: userJSON.infl,
        rltr: userJSON.rltr,
        desf: userJSON.desf,
        fav: userJSON.fav,
        stage: userJSON.stage,
        rel_id: userJSON.rel_id,
        ag_id: userJSON.ag_id,
        appid,
        optindt: userJSON.optindt,
        optoutdt: userJSON.optoutdt,
        optst: "",
        addr: userJSON.addr
      };

      if (isApiV2 && customerItem.inte && customerItem.inte.length) {
        const lambdaParams = {
          comm: customerItem.inte,
          hbId: customerItem.hb_id,
          size: 1000,
          type: "agent"
        }
        const commAgents = await initLambdaInvoke({
          action: "community",
          type: "agent",
          httpMethod: "POST",
          getBody: true,
          arn: USER_LAMBDA_ARN,
          body: lambdaParams
        });
        const filteredAgent = commAgents.filter(agent => agent.email === agent_email);
        console.log(`isApiV2 :: filteredAgent :: ${JSON.stringify(filteredAgent)}`);
        // const userResp = await memoizedLookup(agent_email, userAgentLookup);
        // console.log(`isApiV2 :: ${isApiV2} :: getNoteReqObj :: userResp :: ${JSON.stringify(userResp)}`);
        if (filteredAgent && filteredAgent.length) {
          customerItem.newinte = [filteredAgent[0].id]
        } else {
          v2ErrorObj.warnings.push(`Unable to assign agent with email ${agent_email} for the communities - ${data.inte.join(', ')}`);
        }
      }

      if (isApiV2 && agent_email && !customerItem.inte.length) {
        v2ErrorObj.warnings.push(`Provide community interest to assign the sales agent with email : ${agent_email}`);
      }

      if (customerItem.optst) {
        if (builderOptin) customerItem.optst = "PENDING";
        else customerItem.optst = "NONE";
      } else customerItem.optst = userJSON.optst;
      // Setting non-mandatory fields based on it's availability
      if (userJSON.img) {
        customerItem.img = userJSON.img;
      }
      if (userJSON.psrc) {
        customerItem.psrc = userJSON.psrc;
      }
      if (userJSON.cntm) {
        customerItem.cntm = userJSON.cntm;
      }
      if (userJSON.grade) {
        customerItem.grade = userJSON.grade;
      }
      if (userJSON.desf) {
        customerItem.desf = userJSON.desf;
      }
      if (userJSON.desm) {
        customerItem.desm = userJSON.desm;
      }
      if (userJSON.agent) {
        customerItem.agent = userJSON.agent;
      }
      if (userJSON.phone) {
        customerItem.phone = userJSON.phone;
      }
      if (userJSON.brixid) {
        customerItem.brixid = userJSON.brixid;
      }
      if (userJSON.brixappid) {
        customerItem.brixappid = userJSON.brixappid;
      }
      if (userJSON.brixprojno) {
        customerItem.brixprojno = userJSON.brixprojno;
      }
      if (userJSON.brixclientid) {
        customerItem.brixclientid = userJSON.brixclientid;
      }
      if (userJSON.ref) {
        customerItem.ref = userJSON.ref;
      }

      if (isExternalAPI) {
        customerItem.gen_src = "bulk_api";
      } else {
        customerItem.gen_src = "bulk";
      }

      const crby = data.crby ? data.crby : "";
      if (crby) {
        customerItem.crby = crby;
      }
      let isStageOkay = false;
      if (customerItem.stage !== "Lead" && customerItem.stage !== "Dead_Lead") {
        console.log("customerItem.stage if: ", customerItem.stage);
        customerItem.inbrix = true;
        isStageOkay = true;
      } else {
        console.log("customerItem.stage else: ", customerItem.stage);
        customerItem.inbrix = false;
        isStageOkay = false;
      }
      console.log("isStageOkay: ", isStageOkay);
      console.log("customerItem[inbrix]: ", customerItem.inbrix);
      customerItem.dg = [];
      console.log(`dgraph: ${JSON.stringify(data)}`);
      console.log(`v2Customer: ${JSON.stringify(v2Customer)}`);
      if (isApiV2) {
        if (v2Customer.dgraph_list && v2Customer.dgraph_list.length > 0) {
          v2Customer.dgraph_list.forEach((dgraphItem) => {
            customerItem.dg.push({
              q: dgraphItem.qstn_id,
              a: dgraphItem.option_id,
            });
          });
        }
      } else {
        if (data.dgraph_list && data.dgraph_list.length > 0) {
          data.dgraph_list.forEach((dgraphItem) => {
            customerItem.dg.push({
              q: dgraphItem.qstn_id,
              a: dgraphItem.option_id,
            });
          });
        }
      }

      // adding metros
      let m_id = [];

      for (const comm of userJSON.inte) {
        m_id.push(commMappedMetro[comm]);
      }
      m_id = [...new Set(m_id)];
      console.log("m_id", JSON.stringify(m_id));
      customerItem.m_id = m_id;

      if (existingEmailArr.includes(email.toLowerCase())) {


        console.log(`emailCustomerIdObj: ${JSON.stringify(emailCustomerIdObj)}`);

        // Customer exists. Do update.
        customerItem.id = emailCustomerIdObj[email.toLowerCase()]?.id || "";
        customerItem.entity = emailCustomerIdObj[email.toLowerCase()]?.entity || "";
        customerItem.data = emailCustomerIdObj[email.toLowerCase()]?.data || customerItem.id;
        console.log(`customerItem.id: ${customerItem.id}`);

        // check the dg exists

        const {
          item: paramItem = null,
          oldinte = [],
          oldst = "",
        } = await getCustomerUpdateParams(customerItem);
        console.log(
          `oldinte in batchProcessExternalCreateCustomer: ${JSON.stringify(
            oldinte
          )}`
        );
        console.log(`oldst batchProcessExternalCreateCustomer: ${oldst}`);
        console.log(`customerItem: ${JSON.stringify(customerItem)}`);
        batchParams.RequestItems[process.env.entitiesTableName].push({
          PutRequest: {
            Item: paramItem,
          },
        });
        // Handle change activities, note creation, and messaging
        const {
          stageChangeActivityObj = null,
          inteChangeActivityObj = null,
          activityReqObjArr = null,
          messagingObj = null,
        } = await handleActivitiesAndMessaging({
          stage: userJSON.stage,
          userid: crby,
          customerUUID: customerItem.id,
          hbId: userJSON.hb_id,
          isExternalAPI,
          inte: userJSON.inte,
          note,
          noteSub,
          notesArr,
          isSns: data.isSns,
          isStageOkay,
          paramItem,
          isUpdate: true,
          oldst,
          oldinte,
          doCreateNote,
          isApiV2
        });
        console.log(
          `stageChangeActivityObj: ${JSON.stringify(stageChangeActivityObj)}`
        );
        console.log(
          `inteChangeActivityObj: ${JSON.stringify(inteChangeActivityObj)}`
        );
        console.log(`activityReqObjArr: ${JSON.stringify(activityReqObjArr)}`);
        console.log(`messagingObj: ${JSON.stringify(messagingObj)}`);
        if (stageChangeActivityObj)
          stageChangeActivityParams.push(stageChangeActivityObj);
        if (inteChangeActivityObj)
          inteChangeActivityParams.push(inteChangeActivityObj);
        if (activityReqObjArr && activityReqObjArr?.length) {
          if (isExternalAPI) noteActivityParams.push(activityReqObjArr[0]);
          else {
            for (const activityReqObj of activityReqObjArr) {
              noteActivityParams.push(activityReqObj);
            }
          }
        }
        if (messagingObj) customerMessagingParams.push(messagingObj);
      } else {

        // Do create customer
        const customerUUID = uuidv4();
        const paramItem = {
          id: customerUUID,
          entity: `${userJSON.type}#${userJSON.hb_id}`,
          ...customerItem,
        };
        batchParams.RequestItems[process.env.entitiesTableName].push({
          PutRequest: {
            Item: paramItem,
          },
        });
        customerItem.data = customerUUID;
        // Push notification lambda promise. Allow only `Leads`
        if (customerItem.stage && (customerItem.stage.toLowerCase() === "lead")) {
          const customerData = {
            fullname: customerItem.fullname ?? `${customerItem.fname} ${customerItem.lname}`,
            rel_id: customerUUID,
            crby: customerItem.crby ?? "",
            comm: customerItem.inte ?? [],
            data: 'false',
            stage: customerItem.stage,
            type: 'external',
            gen_src: customerItem.gen_src ?? ""
          }
          // Arguments for notification lambda
          notificationArgs.push({
            action: "createCustomer",
            httpMethod: "POST",
            arn: NOTIFICATION_LAMBDA_ARN,
            body: { hbId: userJSON.hb_id, customerData }
          });
        }

        // Handle change activities, note creation, and messaging
        const {
          stageChangeActivityObj = null,
          inteChangeActivityObj = null,
          activityReqObjArr = null,
          messagingObj = null,
        } = await handleActivitiesAndMessaging({
          stage: userJSON.stage,
          userid: crby,
          customerUUID,
          hbId: userJSON.hb_id,
          isExternalAPI,
          inte: userJSON.inte,
          note,
          noteSub,
          notesArr,
          isSns: data.isSns,
          isStageOkay,
          paramItem,
          doCreateNote,
          isApiV2
        });
        console.log(
          `stageChangeActivityObj: ${JSON.stringify(stageChangeActivityObj)}`
        );
        console.log(
          `inteChangeActivityObj: ${JSON.stringify(inteChangeActivityObj)}`
        );
        console.log(`activityReqObjArr: ${JSON.stringify(activityReqObjArr)}`);
        console.log(`messagingObj: ${JSON.stringify(messagingObj)}`);
        if (stageChangeActivityObj)
          stageChangeActivityParams.push(stageChangeActivityObj);
        if (inteChangeActivityObj)
          inteChangeActivityParams.push(inteChangeActivityObj);
        if (activityReqObjArr && activityReqObjArr?.length) {
          if (isExternalAPI) noteActivityParams.push(activityReqObjArr[0]);
          else {
            for (const activityReqObj of activityReqObjArr) {
              noteActivityParams.push(activityReqObj);
            }
          }
        }
        if (messagingObj) customerMessagingParams.push(messagingObj);
      }
    } else {
      return {
        status: false,
        error: {
          msg: `Validation failed${isExternalAPI
            ? ``
            : `. Please check the response file for further details.`
            }`,
          field: retVal,
        },
      };
    }
  }
  try {
    // Create customers as a batch
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
    let filteredNotificationArgs = notificationArgs;
    if (unProcessedItemsArr.length) {
      // There are unprocessed items. So remove those from the customerMessagingParams
      const unProcessedItemIds = unProcessedItemsArr.map((unProcessedItem) =>
        unProcessedItem &&
          unProcessedItem.PutRequest &&
          unProcessedItem.PutRequest.Item &&
          unProcessedItem.PutRequest.Item.id
          ? unProcessedItem.PutRequest.Item.id
          : ""
      );
      console.log(`unProcessedItemIds: ${unProcessedItemIds}`);
      // Remove notification args with unprocessed item id
      console.log(`unFilteredNotificationArgs: ${notificationArgs}`);
      filteredNotificationArgs = notificationArgs.filter(arg => !unProcessedItemIds.includes(arg.body.customerData.rel_id));
      console.log(`filteredNotificationArgs: ${filteredNotificationArgs}`);
      customerMessagingParams = customerMessagingParams.filter(
        (customerMessagingItem) =>
          !unProcessedItemIds.includes(customerMessagingItem.id)
      );
      console.log(
        `customerMessagingParams: ${JSON.stringify(customerMessagingParams)}`
      );
      stageChangeActivityParams = stageChangeActivityParams.filter(
        (stageChangeActivityItem) =>
          !unProcessedItemIds.includes(stageChangeActivityItem.customerUUID)
      );
      console.log(
        `stageChangeActivityParams: ${JSON.stringify(
          stageChangeActivityParams
        )}`
      );
      inteChangeActivityParams = inteChangeActivityParams.filter(
        (inteChangeActivityItem) =>
          !unProcessedItemIds.includes(inteChangeActivityItem.customerUUID)
      );
      console.log(
        `inteChangeActivityParams: ${JSON.stringify(inteChangeActivityParams)}`
      );
      noteActivityParams = noteActivityParams.filter(
        (noteActivityItem) =>
          !unProcessedItemIds.includes(noteActivityItem.rel_id)
      );
      console.log(`noteActivityParams: ${JSON.stringify(noteActivityParams)}`);
    }
    // notify email when leads is created;
    if (builderData?.notifyLead && builderData?.notifyEmailId) {
      const leadsData = batchParams.RequestItems[process.env.entitiesTableName]
        .filter(eachParams => eachParams.PutRequest.Item.stage === 'Lead')
        .map(eachParams => eachParams.PutRequest.Item);

      //debugger
      console.log(`leadsData before processing: ${JSON.stringify(leadsData)}`);

      const notifyLeadResp = await notifyLeadFn(leadsData, builderData, notesArrayForNotification);

      //debugger
      console.log(`notifyLeadResp: ${JSON.stringify(notifyLeadResp)}`);

    };

    try {
      const notificationPromise = [];
      console.log(`filteredNotificationArgs: ${JSON.stringify(filteredNotificationArgs)}`);
      filteredNotificationArgs.forEach(arg => notificationPromise.push(initLambdaInvoke(arg)));
      const combinedResults = await Promise.allSettled(notificationPromise);
      console.log("combined lambda invoke results ::: ");
      console.log(combinedResults);
    } catch (error) {
      console.log("Error in notification invoke");
      console.log(error);
    }
    // Initiate sending messages to BRIX for customers created
    console.log(
      `customerMessagingParams: ${JSON.stringify(customerMessagingParams)}`
    );
    console.log(`===========Started Import===========`);
    if (customerMessagingParams.length) {
      // Get the messaging params
      /* messagingPublicConfig = await getMessagingParams();
            const publishCustomerDataResponse = await publishCustomerData(customerMessagingParam.id, true);
            console.log('publishCustomerDataResponse: ', publishCustomerDataResponse); */
      const messagingPublicConfig = await getMessagingParams(true);
      for (const customerMessagingParam of customerMessagingParams) {
        // Brix message
        const publishCustomerDataResponse = await publishEntityData({
          entityId: customerMessagingParam.id,
          isBrix: true,
          isCreate: false,
          messageId: uuidv4(),
          messagingParams: messagingPublicConfig,
        });
        console.log(
          "publishCustomerDataResponse: ",
          publishCustomerDataResponse
        );

        // Homefront message
        const publishEntityDataHfResp = await publishEntityData({
          entityId: customerMessagingParam.id,
          entityType: "customer",
          isBrix: false,
          isCreate: false,
          isHomefront: true,
          messageId: uuidv4(),
          messagingParams: messagingPublicConfig,
          HomebuilderID: customerMessagingParam?.hb_id,
        });
        console.log("publishEntityDataHfResp: ", publishEntityDataHfResp);
      }
    }
    // Create stage change activity if any
    if (stageChangeActivityParams.length) {
      console.log(`===========In stageChangeActivityParams.length===========`);
      console.log(
        `stageChangeActivityParams: ${JSON.stringify(
          stageChangeActivityParams
        )}`
      );

      for (const stageChangeActivityItem of stageChangeActivityParams) {
        await createChangeActivity(stageChangeActivityItem);
        // increment the goal count
        const increResp = await incrementGoalCount({
          hbId: stageChangeActivityItem?.hbId,
          stage: stageChangeActivityItem?.stage,
          comm: stageChangeActivityItem?.inte,
        });
        console.log(`increResp: ${JSON.stringify(increResp)}`);
      }
    }

    // Create inte change activty if any
    if (inteChangeActivityParams.length) {
      console.log(`===========In inteChangeActivityParams.length===========`);
      console.log(
        `inteChangeActivityParams: ${JSON.stringify(inteChangeActivityParams)}`
      );
      for (const inteChangeActivityItem of inteChangeActivityParams) {
        await createChangeActivity(inteChangeActivityItem);
        // increment the goal count
        if (inteChangeActivityItem?.stage) {
          const increResp = await incrementGoalCount({
            hbId: inteChangeActivityItem?.hbId,
            stage: inteChangeActivityItem?.stage,
            comm: inteChangeActivityItem?.addedInte || [],
          });
          console.log(`increResp: ${JSON.stringify(increResp)}`);
        }
      }
    }

    // Create note activity if any
    if (noteActivityParams.length) {
      console.log(`===========In noteActivityParams.length===========`);
      console.log(`noteActivityParams: ${JSON.stringify(noteActivityParams)}`);
      // await createActivity(noteActivityParam);
      for (const noteActivityParam of noteActivityParams) {
        try {
          const createActivityResp = await initLambdaInvoke({
            action: "create",
            httpMethod: "POST",
            body: noteActivityParam,
            arn: ACTIVITY_LAMBDA_ARN,
            getBody: true,
          });
          console.log("createActivityResp: ", createActivityResp);
        } catch (error) {
          console.log("Exception create activity: ");
          console.log(error);
        }
      }
    }
    console.log(`===========Ending process===========`);
    if (isApiV2) {
      if (isBatchSuccess && v2ErrorObj.warnings.length) {
        return { status: true, statusCode: 207, data: "Customer created with errors", error: v2ErrorObj?.warnings?.join(', ') }
      }
      if (isBatchSuccess && !v2ErrorObj.warnings.length) {
        return { status: true, statusCode: 201, data: "Processed Successfully", }
      }
    }
    if (isBatchSuccess) {
      return { status: isBatchSuccess, data: "Processed Successfully" };
    }

    return {
      status: isBatchSuccess,
      error: `Bulk customer creation failed with error(s).`,
    };
  } catch (error) {
    console.log(
      `Exception occured on bulk customer creation: ${JSON.stringify(error)}`
    );
    return { status: false, error };
  }
};
const doesEmailExist = async (emailArray, hbId) => {
  // Elastic query to validate the request email ids
  let responseArr = [];
  try {
    for (const email of emailArray) {
      const queryParam = {
        httpMethod: "POST",
        requestPath: "/_search",
        payload: {
          query: {
            bool: {
              must: [
                {
                  match: {
                    "email.keyword": email.toLowerCase(),
                  },
                },
                {
                  match: {
                    "type.keyword": "customer",
                  },
                },
                {
                  match: {
                    "entity.keyword": `customer#${hbId}`,
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
      console.log(`queryParam: ${JSON.stringify(queryParam)}`);
      const validateEmailResp = await aggregate(queryParam, true);
      console.log(`validateEmailResp: ${JSON.stringify(validateEmailResp)}`);

      if (validateEmailResp && validateEmailResp.status) {
        responseArr = [...responseArr, ...validateEmailResp.body.hits.hits];
      }
    }
    return { status: true, data: responseArr };
  } catch (error) {
    console.log(`error in doesEmailExist: ${JSON.stringify(error.stack)}`);
    return { status: false, data: [] };
  }

  // const queryReqObj = {
  //   httpMethod: "POST",
  //   requestPath: "/_search",
  //   payload: {
  //     query: {
  //       bool: {
  //         must: [
  //           {
  //             terms: {
  //               "email.keyword": emailArray,
  //             },
  //           },
  //           {
  //             match: {
  //               "type.keyword": "customer",
  //             },
  //           },
  //           {
  //             match: {
  //               "hb_id.keyword": hbId,
  //             },
  //           },
  //         ],
  //       },
  //     },
  //   },
  // };
  // const validateEmailResp = await aggregate(queryReqObj, true);
  // console.log(`validateEmailResp: ${JSON.stringify(validateEmailResp)}`);

  // if (validateEmailResp && validateEmailResp.status) {
  //   return { status: true, data: validateEmailResp.body.hits.hits };
  // }
};
export const initExternalCreateCustomer = async (
  customers,
  isExternalBulkCustomer = false,
  hbId,
  isApiV2
) => {
  console.log(`in initExternalCreateCustomer`);
  // Check whether this is from external API customer import
  // If so, only allow less than or equal to 50 customers to import
  if (!isExternalBulkCustomer && customers && customers.length > 50) {
    return sendBulkCreateResponse(
      {
        status: false,
        error: { msg: `Request contains more than 50 customers` },
      },
      true
    );
  }
  if (customers && customers.length === 0) {
    return sendBulkCreateResponse(
      { status: false, error: { msg: `Empty request` } },
      !isExternalBulkCustomer
    );
  }

  // Check whether the request customer array contains different hb_id or invalid hb_id
  const hbidArr = customers.map((customer) => customer.hb_id);
  const uniqueHbidArr = [...new Set(hbidArr)];
  console.log(`uniqueHbidArr: ${uniqueHbidArr}`);
  if (uniqueHbidArr.length !== 1) {
    // hb_id provided for the customers are not unique
    return sendBulkCreateResponse(
      {
        status: false,
        error: { msg: `Please provide the same hb_id for the customers` },
      },
      !isExternalBulkCustomer
    );
  }
  if (uniqueHbidArr.length === 1 && uniqueHbidArr[0] !== hbId) {
    // hb_id value is not valid for this home builder
    return sendBulkCreateResponse(
      {
        status: false,
        error: { msg: `Please provide a valid hb_id for the customers` },
      },
      !isExternalBulkCustomer
    );
  }

  // Check whether the hb_id value for the customer is valid in db
  const getBuilderResp = await getBuilderAsync(hbId);
  console.log(`getBuilderResp: ${JSON.stringify(getBuilderResp)}`);
  const allowUpdates = getBuilderResp?.ext_allow_updates || false;
  if (getBuilderResp && getBuilderResp.id) {
    // Check whether the request customer array contains duplicate emails
    const emailArray = customers.map((customer) => customer.email);
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
        !isExternalBulkCustomer
      );
    }

    let existingEmailArr = [];
    let emailCustomerIdObj = {};
    // Check whether the email addresses in the request does not exist in the application
    const existingEmailArrayResp = await doesEmailExist(
      emailArray,
      customers[0].hb_id
    );

    if (!existingEmailArrayResp?.status) {
      return sendBulkCreateResponse(
        {
          status: false,
          error: { msg: "Email check failed" },
        },
        true
      );
    }

    if (
      existingEmailArrayResp.status &&
      existingEmailArrayResp.data &&
      existingEmailArrayResp.data.length
    ) {
      existingEmailArr = [
        ...new Set(
          existingEmailArrayResp.data.map((customer) => customer._source.email)
        ),
      ];
      console.log(
        `Customer(s) with email id ${JSON.stringify(
          existingEmailArr
        )} already exists in the application`
      );
      // Check whether overwrite customers is enabled in builder settings
      if (!allowUpdates) {
        // Remove the existing customer object from the request
        customers = customers.filter(
          (customer) => !existingEmailArr.includes(customer.email)
        );
        console.log(
          `customers after existing emails removed: ${JSON.stringify(
            customers
          )}`
        );
      } else {
        emailCustomerIdObj = existingEmailArrayResp.data.reduce(
          (obj, customer) => {
            if (!obj[customer._source.email])
              obj[customer._source.email] = {
                id: customer._source.id,
                entity: customer._source.entity,
                data: customer._source.data,
                dg: customer._source.dg
              };
            return obj;
          },
          {}
        );
        console.log(
          `emailCustomerIdObj: ${JSON.stringify(emailCustomerIdObj)}`
        );
      }
    }

    // adding metroIds to customers and coBuyers
    const communities = await initLambdaInvoke({
      action: "list",
      httpMethod: "GET",
      body: { hbid: hbId },
      arn: COMMUNITY_LAMBDA_ARN,
      getBody: true,
    });

    const commMappedMetro = {};

    for (const item of communities) {
      commMappedMetro[item.id] = item.rel_id;
    }

    console.log(`commMappedMetro: ${JSON.stringify(commMappedMetro)}`);

    if (customers && customers.length) {
      const batchExecuteResp = await batchProcessExternalCreateCustomer({
        customers,
        appid: getBuilderResp.appid,
        isExternalAPI: !isExternalBulkCustomer,
        builderOptin: getBuilderResp.optin,
        existingEmailArr,
        emailCustomerIdObj,
        commMappedMetro,
        isApiV2,
        builderData: getBuilderResp
      });

      console.log(`batchExecuteResp: ${JSON.stringify(batchExecuteResp)}`);

      return sendBulkCreateResponse(
        {
          ...batchExecuteResp,
          skipped: (!allowUpdates && (existingEmailArr ?? [])) || [],
        },
        !isExternalBulkCustomer
      );
    }

    console.log(`No customers to import`);
    return sendBulkCreateResponse(
      {
        status: true,
        skipped: (!allowUpdates && (existingEmailArr ?? [])) || [],
      },
      !isExternalBulkCustomer
    );
  }

  return sendBulkCreateResponse(
    {
      status: false,
      error: { msg: `Please provide a valid hb_id for the customers` },
    },
    !isExternalBulkCustomer
  );
};
const initCreateBulkCustomers = async (data) => {
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

    await createBulkCustomerFileStatus(hbId, statusFileObject);
  };

  // Get, convert and validate the csv file
  const validationStartTimestamp = new Date().toISOString();
  try {
    // Update the status of the bulk customer create with PROCESSING status
    await uploadStatusFileAndUpdateDB(
      validationStartTimestamp,
      CUSTOMER_FILE_STATUS_PROCESSING,
      [],
      []
    );

    const validateCSVResp = await convertCSVAndValidate(data);
    console.log(`validateCSVResp: ${JSON.stringify(validateCSVResp)}`);
    if (validateCSVResp && !validateCSVResp.status) {
      // Validation error occured
      // Upload status file to s3
      await uploadStatusFileAndUpdateDB(
        validationStartTimestamp,
        CUSTOMER_FILE_STATUS_FAILED,
        validateCSVResp,
        validateCSVResp.error
      );
      return validateCSVResp;
    }

    const convertedCustomerArr = validateCSVResp.customers;
    createStartTimestamp = new Date().toISOString();

    // Format the converted JSON to match the customer
    const customersArrResp = formatBulkCustomerCreateReq(convertedCustomerArr);
    console.log(`customersArrResp: ${JSON.stringify(customersArrResp)}`);
    if (customersArrResp && !customersArrResp.status) {
      await uploadStatusFileAndUpdateDB(
        createStartTimestamp,
        CUSTOMER_FILE_STATUS_FAILED,
        customersArrResp.error,
        customersArrResp.error
      );
      return customersArrResp;
    }

    const { customersArr } = customersArrResp;
    console.log(`customersArr: ${JSON.stringify(customersArr)}`);

    // Upload the formatted customer arr to S3
    const formatEndTimestamp = new Date().toISOString();
    const formattedJSONContent = {
      start: createStartTimestamp,
      end: formatEndTimestamp,
      customers: customersArr,
    };
    await uploadStatusFile(bucketName, formattedFileKey, formattedJSONContent);
    const customerCreateResp = await initExternalCreateCustomer(
      customersArr,
      true,
      hbId
    );
    let responseFunction;
    let errorMsg = [];
    if (customerCreateResp.status) {
      // successful creation
      creationStatus = CUSTOMER_FILE_STATUS_COMPLETED;
      responseFunction = success;
    } else {
      // creation failed
      creationStatus = CUSTOMER_FILE_STATUS_FAILED;
      responseFunction = failure;
      const error =
        customerCreateResp.error && customerCreateResp.error.msg
          ? customerCreateResp.error.msg
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
      customerCreateResp,
      errorMsg
    );
    // Remove the processedarr from the success message if available
    let bulkCreateResponse;
    if (
      customerCreateResp &&
      customerCreateResp.data &&
      customerCreateResp.data.Body
    ) {
      bulkCreateResponse = JSON.parse(customerCreateResp.data.Body);
      // If the processedarr key is present, remove it before sending the response
      if (bulkCreateResponse.processedarr) {
        delete bulkCreateResponse.processedarr;
      }
    }
    return responseFunction({ bulkCreateResponse });
  } catch (error) {
    console.log(`Exception Caught`);
    console.log(error);
    return failure({ error });
  }
};
const initdoesEmailExist = async (data) => {
  console.log(`data: ${JSON.stringify(data)}`);
  const { email: emailArray = [], hb_id: hbId = "" } = data;
  const doesEmailExistResp = await doesEmailExist(emailArray, hbId);
  return success(doesEmailExistResp);
};
const getImportStatusFile = async (data, type = "customer") => {
  console.log(`data: ${JSON.stringify(data)}`);
  const { hb_id: hbId = "" } = data;
  try {
    if (!hbId) {
      return badRequest({ status: false, error: "Home builder Id is missing" });
    }

    const importStatusResp = await getRecordByEntity(
      `${type}_create_status#${hbId}`
    );
    // console.log(`importStatusResp: ${ JSON.stringify(importStatusResp) }`);
    return success(importStatusResp);
  } catch (error) {
    return failure({ status: false, error });
  }
};
const getS3PreSignedURLFileManager = async (data) => {
  const { key: fileKey = "" } = data;
  try {
    const params = {
      Bucket: FILE_MANAGER_BUCKET_NAME,
      Fields: {
        key: fileKey,
      },
    };
    const createPreSignedPost = new Promise((resolve, reject) => {
      s3.createPresignedPost(params, (err, response) => {
        if (err) reject(err);
        resolve(response);
      });
    });
    const signedURLObj = await createPreSignedPost;
    return success(signedURLObj);
  } catch (err) {
    console.log(`Error creating presigned URL: ${err}`);
    return failure(`Error creating presigned URL: ${err}`);
  }
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
    const isExternalBulkCustomer =
      event && event.path ? event.path.includes("bulkcustomers") : false;
    const isExternalCustomerCreate =
      event && event.path ? event.path.includes("create") : false;
    const isApiV2 =
      event && event.path ? event.path.includes("v2") : false;
    console.log(`isExternalBulkCustomer: ${isExternalBulkCustomer}`);
    console.log(`isExternalCustomerCreate: ${isExternalCustomerCreate}`);
    console.log(`isApiV2: ${isApiV2}`);
    console.log(`isExternalAPI: ${isExternalAPI}`);
    if (event.source !== "aws.events") {
      let data;
      switch (event.httpMethod) {
        case "POST":
          data = JSON.parse(event.body);
          if (!data) {
            response = failure();
          } else if (action === "initCreate") {
            response = await initCreateBulkCustomers(data);
          } else if (isExternalAPI && isExternalCustomerCreate) {
            response = await initExternalCreateCustomer(
              data.customers,
              isExternalBulkCustomer,
              data.hb_id,
              isApiV2
            );
          } else if (action === "getstatus") {
            response = await getImportStatusFile(data, "customer");
          } else if (action === "notestatus") {
            response = await getImportStatusFile(data, "note");
          } else if (action === "cobuyerstatus") {
            response = await getImportStatusFile(data, "cobuyer");
          } else if (action === "emailvalidate") {
            response = await initdoesEmailExist(data);
          } else if (action === "gets3url") {
            response = await getS3PreSignedURLFileManager(data);
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
    console.log(`Exception in bulkcustomer lambda: ${err}`);
    return err;
  }
  return response;
}
