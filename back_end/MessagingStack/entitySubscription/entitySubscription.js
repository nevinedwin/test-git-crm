/* eslint-disable camelcase */
/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import AWS from "aws-sdk";
import https from "https";
import http from "http";
import { v4 as uuidv4 } from "uuid";
// import aws4 from 'aws4';
import * as log from "../logger";
// import { failure, success } from "../../FunctionStack/libs/response-lib";
import {
  getRecordByIdAndEntity,
  getEntityByName,
  getHydrationParamsForQuery,
  getResourceJSON,
} from "../../FunctionStack/libs/db";
import {
  getMessagingParams,
  listBuilders,
} from "../../FunctionStack/builders/builders";
import { initLambdaInvoke } from "../../FunctionStack/libs/lambda";
// const credentials = new AWS.EnvironmentCredentials('AWS');
const s3 = new AWS.S3();
const lambda = new AWS.Lambda();
// const ssm = new AWS.SSM();
let BUILDER_NAME = "";
let BUILDER_EMAIL = "";
let BuilderID_HF = "";
let BuilderID_CRM = "";
const {
  S3_BUCKET_ARN,
  CUSTOMER_LAMBDA_ARN,
  REALTORS_LAMBDA_ARN,
  COBUYER_LAMBDA_ARN,
  AGENCIES_LAMBDA_ARN,
  ACTIVITIES_LAMBDA_ARN,
  COMMUNITIES_LAMBDA_ARN,
} = process.env;
const activityTypes = [
  "note_activity",
  "task_activity",
  "appointment_activity",
  "call_activity",
  "email_activity",
];
const invokeMainLambda = async (functionArn, payload) => {
  const lambdaInvokeParams = {
    FunctionName: functionArn,
    Payload: JSON.stringify(payload, null, 2),
  };
  const invokeResp = await lambda.invoke(lambdaInvokeParams).promise();
  log.info("invokeResp: ", invokeResp);
  return invokeResp;
};
const uploadToS3 = async (uploadObj) => {
  const {
    message,
    subject,
    messageId,
    isHydrated,
    isTransformed,
    messageType,
    messageDataId,
    isError,
  } = uploadObj;
  const params = {
    Body: JSON.stringify(message),
    ContentType: "application/json",
    Bucket: S3_BUCKET_ARN,
    Key: "",
  };

  if (isHydrated) {
    params.Key = `${messageType}/${subject}/rehydrated/homefrontCustomer/${messageId}-${messageDataId}.json`;
  } else if (isTransformed) {
    params.Key = `${messageType}/${subject}/transformed/crmCustomer/${messageId}-${messageDataId}.json`;
  } else if (isError) {
    params.Key = `${messageType}/${subject}/error/crmCustomer/${messageId}-${messageDataId}.json`;
  } else {
    params.Key = `${messageType}/${subject}/${messageId}-${messageDataId}.json`;
  }
  log.info("params.Key: ", params.Key);
  const s3UploadResp = await s3.putObject(params).promise();
  log.info("s3UploadResp: ", s3UploadResp);
  return s3UploadResp;
};

const hydrateData = async (hydrationParams = {}) => {
  try {
    let dataString = "";
    const messagingParamsResp = await getMessagingParams(true);
    console.log(`messagingParamsResp: ${JSON.stringify(messagingParamsResp)}`);
    const {
      hydrationHostHf = "",
      hydrationPathHf = "",
      keyValHf = "",
    } = messagingParamsResp;
    console.log("hydrationHostHf: ", hydrationHostHf);
    console.log("hydrationPathHf: ", hydrationPathHf);
    console.log("keyValHf: ", keyValHf);
    if (hydrationHostHf && hydrationPathHf && keyValHf) {
      // http://uat.homefrontcrm.com/api/Homefront/data
      const isHttp = hydrationHostHf.split("://");
      const hostname =
        isHttp && isHttp.length === 2 ? isHttp[1] : hydrationHostHf;
      const protocol = isHttp && isHttp.length === 2 && isHttp[0] === 'http' ? http : https;
      const postBody = JSON.stringify(hydrationParams);
      log.info(`postBody: ${JSON.stringify(postBody)}`);
      const options = {
        hostname,
        path: hydrationPathHf,
        method: "POST",
        region: "us-west-2",
        service: "execute-api",
        headers: {
          "Content-Type": "application/json",
          ApiKey: keyValHf,
          "Content-Length": postBody.length,
        },
      };
      log.info(`options: ${JSON.stringify(options)}`);
      // const opts = aws4.sign(options, credentials);
      const hydratedResp = await new Promise((resolve, reject) => {
        const req = protocol.request(options, (res) => {
          log.info(`statusCode: ${res.statusCode}`);
          log.info("headers:", res.headers);
          res.on("data", (chunk) => {
            // process.stdout.write(d)
            dataString += chunk;
          });
          res.on("end", () => {
            resolve({
              statusCode: 200,
              body: JSON.stringify(JSON.parse(dataString), null, 4),
            });
          });
        });
        req.on("error", (error) => {
          console.error(error);
          reject(
            new Error({
              statusCode: 500,
              body: JSON.stringify(error),
            })
          );
        });
        req.write(postBody);
        req.end();
      });
      log.info("hydratedResp: ", hydratedResp);
      return hydratedResp;
    }

    return {
      status: false,
      error: `Invalid hydration parameters set. Please verify that the host, path and/or API key is set.`,
    };
  } catch (error) {
    log.error(error);
    return { status: false, error };
  }
};
const formatPhoneNumber = (phoneNumberString) => {
  const cleaned = `${phoneNumberString}`.replace(/\D/g, "");
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return "";
};
const doHomefrontHydration = async (hydrationParams) => {
  hydrationParams.HomebuilderID_HF = BuilderID_HF;
  hydrationParams.HomebuilderID = BuilderID_CRM;
  const hydratedResp = await hydrateData(hydrationParams);
  log.info("hydratedResp: ", hydratedResp);
  if (hydratedResp && hydratedResp?.status !== false) {
    const hydratedRespBody =
      hydratedResp && hydratedResp?.body ? JSON.parse(hydratedResp.body) : {};
    log.info("hydratedRespBody: ", hydratedRespBody);
    const hydratedData = hydratedRespBody?.result ?? {};
    log.info("hydratedData: ", hydratedData);
    return hydratedData;
  }

  return hydratedResp;
};
const getEntityDetail = async (id, entity, isDataCall = false) => {
  const entityGetParams = getHydrationParamsForQuery(
    id,
    entity,
    isDataCall,
    true
  );
  const entityDetail = await getResourceJSON(entityGetParams);
  console.log(`entityDetail: ${JSON.stringify(entityDetail)}`);
  return entityDetail;
};
const getCommonEntityParams = async ({
  data,
  entityType,
  builderPinpointAppId,
  isUpdate,
}) => {
  let entityCreateUpdateParams = {};
  let phoneNumber = "";
  let contactMethod = "";
  let source = "";
  const {
    HomebuilderID,
    HomebuilderID_HF: HomebuilderIDHf,
    OpportunityID,
    ID_Hyphen: idHyphen = "",
    FirstName,
    LastName,
    Email,
    HomePhone,
    WorkPhone,
    PreferredContactMethod: contactMethodName,
    Source: sourceName,
    ContactID = "",
    NoteID = "",
    TaskID = "",
    AppointmentID = "",
  } = data;
  entityCreateUpdateParams = {
    hb_id: HomebuilderID,
    hfhbid: HomebuilderIDHf,
    isSns: true,
    isHf: true,
  };
  const isActivity = activityTypes.includes(entityType);
  if (isActivity) {
    switch (entityType) {
      case "note_activity":
        entityCreateUpdateParams.hfid = NoteID;
        break;
      case "task_activity":
      case "call_activity":
      case "email_activity":
        entityCreateUpdateParams.hfid = TaskID;
        break;
      case "appointment_activity":
        entityCreateUpdateParams.hfid = AppointmentID;
        break;
      default:
        entityCreateUpdateParams.hfid = "";
        break;
    }
    entityCreateUpdateParams.id = idHyphen || "";
  } else {
    entityCreateUpdateParams.hfid =
      entityType === "opportunity" ? OpportunityID : ContactID;
    entityCreateUpdateParams.id =
      idHyphen || (entityType === "opportunity" ? OpportunityID : ContactID);

    entityCreateUpdateParams = {
      ...entityCreateUpdateParams,
      fname: FirstName,
      lname: LastName,
      email: Email,
      appid: builderPinpointAppId,
      crby: "Homefront",
    };
    phoneNumber = HomePhone || WorkPhone || "";
    if (phoneNumber) {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      entityCreateUpdateParams.phone = formattedPhone;
      // comment this. Only for testing
      // entityCreateUpdateParams['phone'] = '(123) 456-7890';
    } else if (!isUpdate) {
      entityCreateUpdateParams.phone = "";
    }

    // Get the contact method based on the PreferredContactMethod field
    contactMethod = contactMethodName
      ? await getEntityByName(contactMethodName, `cntm#${HomebuilderID}`, false)
      : "";
    log.info("contactMethod: ", JSON.stringify(contactMethod));
    entityCreateUpdateParams.cntm = contactMethod || "Sample-Contact-Method";

    // Get the source based on the Source field
    source = sourceName
      ? await getEntityByName(sourceName, `psrc#${HomebuilderID}`, false)
      : "";
    log.info("source: ", JSON.stringify(source));
    entityCreateUpdateParams.psrc = source || "Sample-Primary-Source-Id";

    if (!isUpdate) {
      entityCreateUpdateParams.grade = "Sample-Grade";
    }
  }
  console.log(`entityCreateUpdateParams`);
  console.log(entityCreateUpdateParams);
  return entityCreateUpdateParams;
};
const processRealtor = async (
  Realtor,
  HomebuilderID,
  message,
  subject,
  messageId
) => {
  console.log(`==========Processing Realtor==========`);
  console.log(`Realtor: ${JSON.stringify(Realtor)}`);
  console.log(`HomebuilderID: ${HomebuilderID}`);
  console.log(`message: ${JSON.stringify(message)}`);
  console.log(`subject: ${subject}`);
  console.log(`messageId: ${JSON.stringify(messageId)}`);
  const { OpportunityID = "" } = message?.data;
  // Check whether realtor present in the response is present in our DB
  if (Realtor?.EntityId) {
    console.log(`in realtor processing`);
    Realtor.OpportunityID = OpportunityID;
    // Realtor doesn't exist in the db. Do Homefront hydration for getting the realtor id.
    const realtorHydrationResp = await doHomefrontHydration(Realtor);
    console.log(
      `realtorHydrationResp: ${JSON.stringify(realtorHydrationResp)}`
    );
    if (realtorHydrationResp && realtorHydrationResp?.status !== false) {
      // Check whether the ID_Hyphen field exists. If so, get the realtor info from our db.
      if (realtorHydrationResp?.ID_Hyphen) {
        // code change //
        // updating the realtor for removing the update realtor publish
        const updateRealtorResp = await processEntity(
          Realtor,
          {
            id: message.id,
            type: message.type,
            data: { ...Realtor, ...realtorHydrationResp },
          },
          subject,
          messageId
        );
        console.log(`updateRealtorResp: ${JSON.stringify(updateRealtorResp)}`);

        // code change //

        const realtorDetail = await getEntityDetail(
          realtorHydrationResp?.ID_Hyphen, // code changed
          `${Realtor?.EntityType}#${HomebuilderID}`
        );
        console.log(`realtorDetail: ${JSON.stringify(realtorDetail)}`);
        if (realtorDetail && realtorDetail.length) {
          // Realtor exists in the db
          return realtorDetail[0];
        }

        // This realtor resource doesn't exist in CRM
        // Upload error log
        await uploadToS3({
          message: {
            error: `Realtor doesn't exist in CRM. Please verify the logs for messaging issues.`,
          },
          subject,
          messageId,
          isHydrated: false,
          isTransformed: false,
          messageType: message.type,
          messageDataId: message.id,
          isError: true,
        });
      } else {
        // This realtor resource doesn't exist in both systems or there has been some issue in messaging

        // Upload error log
        // await uploadToS3({ message: { error: `Realtor exists neither in CRM nor in Homefront. Please verify the logs for messaging issues.` }, subject, messageId, isHydrated: false, isTransformed: false, messageType: message.type, messageDataId: message.id, isError: true });

        // code change //
        if (subject === "update") {
          // updating the realtor for removing the update realtor publish
          const updateRealtorResp = await processEntity(
            Realtor,
            {
              id: message.id,
              type: message.type,
              data: { ...Realtor, ...realtorHydrationResp },
            },
            subject,
            messageId
          );
          console.log(
            `updateRealtorResp: ${JSON.stringify(updateRealtorResp)}`
          );
        }

        // code change //

        const realtorDetail = await getEntityDetail(
          Realtor?.EntityId,
          `${Realtor?.EntityType}#${HomebuilderID}`
        );
        console.log(`realtorDetail: ${JSON.stringify(realtorDetail)}`);
        if (realtorDetail && realtorDetail.length) {
          // Realtor exists in the db
          return realtorDetail[0];
        }
        /* eslint no-use-before-define: "off" */
        // Create the realtor if the customer message is for create.
        const createRealtorResp = await processEntity(
          Realtor,
          {
            id: message.id,
            type: message.type,
            data: { ...Realtor, ...realtorHydrationResp },
          },
          subject,
          messageId
        );
        console.log(`createRealtorResp: ${JSON.stringify(createRealtorResp)}`);

        if (createRealtorResp?.StatusCode === 200) {
          // Get the realtorDetail to return
          const createdRealtorDetail = await getEntityDetail(
            Realtor?.EntityId,
            `${Realtor?.EntityType}#${HomebuilderID}`
          );
          console.log(
            `createdRealtorDetail: ${JSON.stringify(createdRealtorDetail)}`
          );
          if (createdRealtorDetail && createdRealtorDetail.length) {
            // Realtor exists in the db
            return createdRealtorDetail[0];
          }
        } else {
          // Upload error log
          await uploadToS3({
            message: {
              error: `Realtor creation failed. ${createRealtorResp?.body}`,
            },
            subject,
            messageId,
            isHydrated: false,
            isTransformed: false,
            messageType: message.type,
            messageDataId: message.id,
            isError: true,
          });
        }
      }
    } else {
      await uploadToS3({
        message: { error: realtorHydrationResp?.error },
        subject,
        messageId,
        isHydrated: false,
        isTransformed: false,
        messageType: message.type,
        messageDataId: message.id,
        isError: true,
      });
    }
  }
  return null;
};
const processCobuyers = async (Cobuyers, message, subject, messageId) => {
  console.log(`==========Processing Cobuyers==========`);
  const repsonseArr = [];
  const {
    OpportunityID = "",
    ID_Hyphen = "",
    HomebuilderID = "",
  } = message?.data;

  // code change
  if (subject === "update") {
    // list all the cobuyers under the given customer
    const params = {
      id: ID_Hyphen || OpportunityID,
      hbid: HomebuilderID,
      isJSONOnly: true,
    };

    const invokeParams = {
      httpMethod: "GET",
      pathParameters: {
        action: "list",
        ...params,
      },
    };
    console.log("invokeParams>>", invokeParams);

    let cobuyersList = await invokeMainLambda(COBUYER_LAMBDA_ARN, invokeParams);
    cobuyersList = cobuyersList?.Payload || [];
    cobuyersList = JSON.parse(cobuyersList);
    console.log("cobuyersList>>", cobuyersList);

    // deleting all cobuyers
    if (cobuyersList.length) {
      for (const co of cobuyersList) {
        const body = {
          id: co?.data || "",
          hb_id: co?.hb_id || "",
          rel_id: co?.id || "",
          isSns: true,
        };
        const invokeParam = {
          httpMethod: "POST",
          pathParameters: {
            action: "delete",
          },
          body: JSON.stringify(body),
        };

        console.log("cobuyerdeleteparams>>", invokeParam);

        const cobuyerDeleteRes = await invokeMainLambda(
          COBUYER_LAMBDA_ARN,
          invokeParam
        );

        console.log("cobuyerDeleteRes>>", cobuyerDeleteRes);
      }
    }
  }
  // code change

  // Proceed with cobuyer creation if subject is create only
  for (const Cobuyer of Cobuyers) {
    console.log(`Cobuyer: ${JSON.stringify(Cobuyer)}`);
    // Check whether Cobuyer present in the response is present in our DB
    if (Cobuyer?.EntityId) {
      Cobuyer.OpportunityID = OpportunityID;
      // Do Homefront hydration for getting the Cobuyer id.
      const cobuyerHydrationResp = await doHomefrontHydration(Cobuyer);
      console.log(
        `cobuyerHydrationResp: ${JSON.stringify(cobuyerHydrationResp)}`
      );

      if (cobuyerHydrationResp && cobuyerHydrationResp?.status !== false) {
        // Create the Cobuyer
        const createCobuyerResp = await processEntity(
          Cobuyer,
          {
            id: message.id,
            type: message.type,
            data: { ...Cobuyer, ...cobuyerHydrationResp },
          },
          subject,
          messageId,
          true
        );
        console.log(`createCobuyerResp: ${JSON.stringify(createCobuyerResp)}`);
        repsonseArr.push(createCobuyerResp);
      } else {
        await uploadToS3({
          message: { error: cobuyerHydrationResp?.error },
          subject,
          messageId,
          isHydrated: false,
          isTransformed: false,
          messageType: message.type,
          messageDataId: message.id,
          isError: true,
        });
      }
    }
  }
  return repsonseArr.length ? repsonseArr : null;
};
const doAgencyCreate = async (data) => {
  const ENTITY_LAMBDA_EVENT = {
    httpMethod: "POST",
    pathParameters: {
      action: "create",
    },
    body: JSON.stringify(data, null, 2),
  };
  const LAMBDA_ARN = AGENCIES_LAMBDA_ARN;
  console.log(`LAMBDA_ARN: ${LAMBDA_ARN}`);
  console.log(`ENTITY_LAMBDA_EVENT: ${JSON.stringify(ENTITY_LAMBDA_EVENT)}`);
  const entityActionResp = await invokeMainLambda(
    LAMBDA_ARN,
    ENTITY_LAMBDA_EVENT
  );
  log.info("entityActionResp: ", entityActionResp);
  return entityActionResp;
};
const processAgency = async (
  AgencyName,
  HomebuilderID,
  message,
  subject,
  messageId
) => {
  console.log(`AgencyName: ${JSON.stringify(AgencyName)}`);
  console.log(`HomebuilderID: ${HomebuilderID}`);
  console.log(`message: ${JSON.stringify(message)}`);
  console.log(`subject: ${subject}`);
  console.log(`messageId: ${JSON.stringify(messageId)}`);
  const agencyDetailObj = {};
  // Check whether agency is present in the response is present in our DB
  const agencyRes =
    (await getEntityByName(
      AgencyName,
      `agency#${HomebuilderID}`,
      false,
      "cname"
    )) ?? "";
  console.log(`agencyRes: ${JSON.stringify(agencyRes)}`);
  let agencyId = agencyRes?.id ?? "";
  console.log(`agencyId: ${agencyId}`);
  if (!agencyId) {
    // Create agency with cname and tname as AgencyName. Leave metro as blank or all
    // Create the realtor if the customer message is for create.
    const agency = { id: uuidv4(), entity: `agency#${HomebuilderID}` };
    console.log(`agency: ${JSON.stringify(agency)}`);
    const createAgencyResp = await doAgencyCreate({
      agency: {
        id: agency?.id,
        cname: AgencyName,
        tname: AgencyName,
        hb_id: HomebuilderID,
        m_id: [],
      },
      isHf: true,
    });
    console.log(`createAgencyResp: ${JSON.stringify(createAgencyResp)}`);

    if (createAgencyResp?.StatusCode === 200) {
      // Get the agencyDetail to return
      const agencyDetail = await getEntityDetail(agency?.id, agency?.entity);
      console.log(`agencyDetail: ${JSON.stringify(agencyDetail)}`);
      if (agencyDetail && agencyDetail.length) {
        // agency exists in the db
        agencyId = agencyDetail[0]?.id;
        agencyDetailObj.agencyId = agencyId;
        agencyDetailObj.agcnm = AgencyName;
        agencyDetailObj.agtnm = AgencyName;
        // eslint-disable-next-line prefer-destructuring
        agencyDetailObj.agency = agencyDetail[0];
      }
    }
  } else {
    agencyDetailObj.agencyId = agencyId;
    agencyDetailObj.agcnm = agencyRes?.cname;
    agencyDetailObj.agtnm = agencyRes?.tname;
    agencyDetailObj.agency = agencyRes;
  }
  return agencyDetailObj;
};
const getCustomerRealtorParams = async ({
  Realtor,
  HomebuilderID,
  message,
  subject,
  messageId,
}) => {
  const realtorResource = await processRealtor(
    Realtor,
    HomebuilderID,
    message,
    subject,
    messageId
  );
  console.log(`realtorResource: ${JSON.stringify(realtorResource)}`);
  return realtorResource;
};
const createCustomerCobuyers = async ({
  Cobuyers,
  message,
  subject,
  messageId,
}) => {
  const cobuyerProcessResp = await processCobuyers(
    Cobuyers,
    message,
    subject,
    messageId
  );
  console.log(`cobuyerProcessResp: ${JSON.stringify(cobuyerProcessResp)}`);
};
const getCustomerEntityParams = async ({ message, subject, messageId }) => {
  const entityCreateUpdateParams = {};
  const {
    HomebuilderID,
    Stage: homefrontStage = "",
    Community: communityName = "",
    Cobuyers,
    Realtor,
  } = message?.data;
  let interestArr = [];
  let realtorResource;
  entityCreateUpdateParams.type = "customer";
  entityCreateUpdateParams.stage = homefrontStage;
  // Get the Interests based on Community name
  interestArr = communityName
    ? await getEntityByName(communityName, `community#${HomebuilderID}`, true)
    : [];
  log.info("interestArr: ", JSON.stringify(interestArr));
  entityCreateUpdateParams.inte = interestArr;

  console.log(`Realtor: ${JSON.stringify(Realtor)}`);
  console.log(`============Starting realtor process============`);
  // Process realtor if specified
  if (Realtor?.EntityId) {
    console.log(`in Realtor?.EntityId`);
    realtorResource = await getCustomerRealtorParams({
      Realtor,
      HomebuilderID,
      message,
      subject,
      messageId,
    });
    if (realtorResource) {
      const dataVal = realtorResource?.id;
      console.log(`created realtor id: ${dataVal}`);
      // delete realtorResource?.id;
      realtorResource.data = dataVal;
      if (realtorResource) {
        entityCreateUpdateParams.rltr = realtorResource;
      }
    }
  }
  console.log(`============Ending realtor process============`);
  console.log(`============Starting cobuyer process============`);
  // Process cobuyers if any
  if (Cobuyers?.length) {
    console.log(`in Cobuyers.length`);
    await createCustomerCobuyers({
      Cobuyers,
      message,
      subject,
      messageId,
    });
  }
  console.log(`============Ending cobuyer process============`);
  return entityCreateUpdateParams;
};
const getRealtorEntityParams = async ({
  message,
  subject,
  messageId,
  HomebuilderID,
  // id,
}) => {
  const entityCreateUpdateParams = {};
  let agencyId = "";
  const { CompanyName: AgencyName = "" } = message?.data;
  let { agencyDetails = {} } = message?.data;
  entityCreateUpdateParams.type = "realtor";
  // Process agency if AgencyName is valid.
  agencyDetails = AgencyName
    ? await processAgency(
        AgencyName,
        HomebuilderID,
        message,
        subject,
        messageId
        // id
      )
    : {};
  console.log(`agencyDetails: ${JSON.stringify(agencyDetails)}`);
  agencyId = agencyDetails?.agencyId ?? "";
  log.info("agencyId: ", agencyId);
  // Attach the agency id as rel_id of the realtor
  entityCreateUpdateParams.rel_id = agencyId;
  if (agencyDetails?.agcnm && agencyDetails?.agtnm) {
    entityCreateUpdateParams.agcnm = agencyDetails.agcnm;
    entityCreateUpdateParams.agtnm = agencyDetails.agtnm;
    entityCreateUpdateParams.agency = agencyDetails.agency;
  }
  return entityCreateUpdateParams;
};
const getCobuyerEntityParams = async ({
  CustomerIDHyphen,
  OpportunityID,
  HomebuilderID,
  cobuyerFromCustomer,
}) => {
  const entityCreateUpdateParams = {};
  const customerIdRel =
    CustomerIDHyphen?.toLowerCase() || OpportunityID?.toLowerCase();
  let customerDetail = [];
  if (!cobuyerFromCustomer) {
    customerDetail = await getEntityDetail(
      customerIdRel,
      `customer#${HomebuilderID}`,
      false
    );
    console.log(`customerDetail: ${JSON.stringify(customerDetail)}`);
    // Check whether the customerIdRel id exists in the system
    // If yes, go ahead with the creation. Else halt the process and log the error.
    if (customerDetail && customerDetail.length) {
      entityCreateUpdateParams.type = "cobuyer";
      entityCreateUpdateParams.rel_id = customerIdRel;
    } else {
      entityCreateUpdateParams.error = `Customer associated with the cobuyer doesn't exist in the system.`;
    }
  } else {
    // Process cobuyer call from customer message
    entityCreateUpdateParams.type = "cobuyer";
    entityCreateUpdateParams.rel_id = customerIdRel;
  }
  return entityCreateUpdateParams;
};
const getEntityField = async (id, type, fieldName, returnJSON = false) => {
  if (!id) return "";
  let fieldVal = "";
  const queryParams = getHydrationParamsForQuery(
    id,
    type,
    false,
    false,
    type === "agent"
  );
  console.log(queryParams);
  try {
    const entityDetails = await getResourceJSON(queryParams);
    if (returnJSON) {
      // Return full JSON
      return entityDetails && entityDetails.length ? entityDetails[0] : {};
    }

    if (entityDetails && entityDetails.length) {
      if (type === "cobuyer") {
        fieldVal = [];
        for (const entityDetail of entityDetails) {
          fieldVal.push(entityDetail[fieldName]);
        }
      } else {
        fieldVal = entityDetails[0][fieldName]
          ? entityDetails[0][fieldName]
          : "";
      }
    }
    return fieldVal;
  } catch (error) {
    return fieldVal;
  }
};
const getActivityEntityParams = async ({
  CustomerIDHyphen,
  OpportunityID,
  HomebuilderID,
  entityType,
  message,
}) => {
  const entityCreateUpdateParams = {};
  const {
    Subject = "",
    Description = "",
    DueDate = "",
    AssignedToEmail = "",
    StartingAt = "",
    Status = "",
    Body = "",
  } = message?.data;
  const customerIdRel =
    CustomerIDHyphen?.toLowerCase() ?? OpportunityID?.toLowerCase();
  const customerDetail = await getEntityDetail(
    customerIdRel,
    `customer#${HomebuilderID}`,
    false
  );
  console.log(`customerDetail: ${JSON.stringify(customerDetail)}`);
  // Check whether the customerIdRel id exists in the system
  // If yes, go ahead with the creation. Else halt the process and log the error.
  if (customerDetail && customerDetail.length) {
    entityCreateUpdateParams.type = "activity";
    entityCreateUpdateParams.rel_id = customerIdRel;

    // Prepare the activity data based on activity type
    let actiObj;
    let assi;
    let userDetails;
    let wit;
    let userFname;
    let userLname;
    let userName;
    let customerName = "";
    let customerEmail = "";
    let status = "";
    const {
      customerFname = "",
      customerLname = "",
      emailIdCustomer = "",
    } = customerDetail[0];
    switch (entityType) {
      case "note_activity":
        actiObj = { atype: "note", sub: Subject, note: Description };
        break;
      case "task_activity":
        assi = AssignedToEmail
          ? await getEntityField(AssignedToEmail, "agent", "email")
          : "";
        console.log(`assi: ${assi}`);
        actiObj = {
          atype: "task",
          sub: Subject,
          note: Description,
          dt: new Date(DueDate).getTime(),
          assi,
        };
        break;
      case "appointment_activity":
        userDetails = AssignedToEmail
          ? await getEntityField(AssignedToEmail, "agent", "", true)
          : {};
        console.log(`userDetails: ${JSON.stringify(userDetails)}`);
        wit = userDetails?.email ?? "";
        console.log(`wit: ${wit}`);
        userFname = userDetails?.fname ?? "";
        console.log(`userFname: ${userFname}`);
        userLname = userDetails?.lname ?? "";
        console.log(`userLname: ${userLname}`);
        userName = `${userFname}${userFname ? " " : ""}${userLname}`;
        console.log(`userName: ${userName}`);
        customerName = `${customerFname}${
          customerFname ? " " : ""
        }${customerLname}`;
        customerEmail = emailIdCustomer;

        // Only add appointmentEmailData if the mandatory fields are available
        if (wit && userName && customerName && customerEmail) {
          entityCreateUpdateParams.appointmentEmailData = {
            userName,
            userEmail: wit,
            fromName: BUILDER_NAME,
            fromEmail: BUILDER_EMAIL,
            customerName,
            customerEmail,
            communityName: "",
          };
        }
        // const duration = (new Date(EndingAt).getTime() - new Date(StartingAt).getTime()) / 60000;
        if (Status === "Scheduled" || Status === "Rescheduled") {
          status = "SCHEDULED";
        } else if (Status === "Completed") {
          status = "COMPLETE";
        } else if (Status === "Cancelled") {
          status = "NO_SHOW";
        } else {
          status = "SCHEDULED";
        }
        actiObj = {
          atype: "appointment",
          sub: Subject,
          note: Description,
          dt: new Date(StartingAt).getTime(),
          wit,
          status,
          dur: "",
        };
        break;
      case "call_activity":
        actiObj = {
          atype: "call",
          sub: Subject,
          note: Description,
          dt: new Date(DueDate).getTime(),
        };
        break;
      case "email_activity":
        actiObj = { atype: "mail", sub: Subject, note: Body };
        break;
      default:
        break;
    }
    entityCreateUpdateParams.acti = actiObj;
  } else {
    entityCreateUpdateParams.error = `Customer associated with the activity doesn't exist in the system.`;
  }
  return entityCreateUpdateParams;
};
const getEntityParams = async (
  message,
  isUpdate = false,
  entityType,
  builderPinpointAppId,
  subject,
  messageId,
  cobuyerFromCustomer
) => {
  // Process the data
  let entityCreateUpdateParams = {};

  const {
    HomebuilderID,
    OpportunityID,
    CustomerID_Hyphen: CustomerIDHyphen = "",
  } = message?.data;

  // Fields common to all entities
  entityCreateUpdateParams = {
    ...(await getCommonEntityParams({
      data: message?.data,
      entityType,
      builderPinpointAppId,
      isUpdate,
    })),
  };
  // Prepare the specific data for each entity
  switch (entityType) {
    case "opportunity":
      entityCreateUpdateParams = {
        ...entityCreateUpdateParams,
        ...(await getCustomerEntityParams({
          message,
          subject,
          messageId,
        })),
      };
      break;
    case "realtor":
      entityCreateUpdateParams = {
        ...entityCreateUpdateParams,
        ...(await getRealtorEntityParams({
          message,
          subject,
          messageId,
          HomebuilderID,
          id: entityCreateUpdateParams.id,
        })),
      };
      break;
    case "cobuyer":
      entityCreateUpdateParams = {
        ...entityCreateUpdateParams,
        ...(await getCobuyerEntityParams({
          CustomerIDHyphen,
          OpportunityID,
          HomebuilderID,
          cobuyerFromCustomer,
        })),
      };
      break;
    case "note_activity":
    case "task_activity":
    case "appointment_activity":
    case "call_activity":
    case "email_activity":
      entityCreateUpdateParams = {
        ...entityCreateUpdateParams,
        ...(await getActivityEntityParams({
          CustomerIDHyphen,
          OpportunityID,
          HomebuilderID,
          entityType,
          message,
        })),
      };
      break;
    default:
      break;
  }
  return entityCreateUpdateParams;
};
const processEntity = async (
  hydrationParams,
  message,
  subject,
  messageId,
  cobuyerFromCustomer = false
) => {
  let entityActionResp;
  console.log(`hydrationParams: ${JSON.stringify(hydrationParams)}`);
  console.log(`message: ${JSON.stringify(message)}`);
  console.log(`subject: ${JSON.stringify(subject)}`);
  console.log(`messageId: ${JSON.stringify(messageId)}`);
  const { EntityType } = hydrationParams;
  const { HomebuilderID: BUILDER_ID = "" } = message?.data;

  const builderDetails = await getRecordByIdAndEntity(BUILDER_ID, `builder`);
  console.log(`builderDetails: ${JSON.stringify(builderDetails)}`);
  const builderPinpointAppId =
    (builderDetails && builderDetails.length && builderDetails[0]?.appid) ?? "";
  const isUpdate = subject === "update";

  // Get the transformed data for the entity
  const entityActionParams = await getEntityParams(
    message,
    isUpdate,
    EntityType,
    builderPinpointAppId,
    subject,
    messageId,
    cobuyerFromCustomer
  );
  log.info("transformedData: ", entityActionParams);

  // If there is an error, log it and halt the process.
  if (entityActionParams?.error) {
    // Upload error log
    await uploadToS3({
      message: { error: entityActionParams?.error },
      subject,
      messageId,
      isHydrated: false,
      isTransformed: false,
      messageType: message.type,
      messageDataId: message.id,
      isError: true,
    });
  } else {
    // Upload transformed data
    await uploadToS3({
      message: entityActionParams,
      subject,
      messageId,
      isHydrated: false,
      isTransformed: true,
      messageType: message.type,
      messageDataId: message.id,
    });

    // Prepare the data for lambda event
    const ENTITY_LAMBDA_EVENT = {
      httpMethod: "POST",
      pathParameters: {
        action: "",
      },
      body: JSON.stringify(entityActionParams, null, 2),
    };
    let LAMBDA_ARN = "";
    switch (subject) {
      case "create":
        // Create Entity
        ENTITY_LAMBDA_EVENT.pathParameters.action = "create";
        break;
      case "update":
        // Update Entity
        ENTITY_LAMBDA_EVENT.pathParameters.action = "updateRow";
        break;
      default:
        ENTITY_LAMBDA_EVENT.pathParameters.action = "";
    }
    // Based on the subject create/update the entity
    if (EntityType === "opportunity") {
      LAMBDA_ARN = CUSTOMER_LAMBDA_ARN;
    } else if (EntityType === "realtor") {
      LAMBDA_ARN = REALTORS_LAMBDA_ARN;
    } else if (EntityType === "cobuyer") {
      LAMBDA_ARN = COBUYER_LAMBDA_ARN;
    } else if (activityTypes.includes(EntityType)) {
      LAMBDA_ARN = ACTIVITIES_LAMBDA_ARN;
    }
    console.log(`LAMBDA_ARN: ${LAMBDA_ARN}`);
    console.log(`ENTITY_LAMBDA_EVENT: ${JSON.stringify(ENTITY_LAMBDA_EVENT)}`);
    entityActionResp = await invokeMainLambda(LAMBDA_ARN, ENTITY_LAMBDA_EVENT);
    log.info("entityActionResp: ", entityActionResp);
  }
  return entityActionResp;
};
const getCommunityIds = (metroId, communities) => {
  console.log(`metroId: ${metroId}`);
  const commUnderMetro = communities
    .filter((community) => community.rel_id === metroId)
    .map((community) => community.id);
  console.log(`commUnderMetro: ${JSON.stringify(commUnderMetro)}`);
  return commUnderMetro;
};
const getAgencyCommunities = async (agencyId, HomebuilderID) => {
  try {
    let data = [];
    // Get the agency metros
    const entityDetail = await getEntityDetail(
      agencyId,
      `agency#${HomebuilderID}`
    );
    console.log(`entityDetail: ${JSON.stringify(entityDetail)}`);
    if (entityDetail && entityDetail.length) {
      // Get the metro ids
      const { m_id = [] } = entityDetail[0];
      console.log(`m_id: ${JSON.stringify(m_id)}`);

      // Get the community ids under those metros
      const communities = await initLambdaInvoke({
        action: "list",
        httpMethod: "GET",
        body: { hbid: HomebuilderID },
        arn: COMMUNITIES_LAMBDA_ARN,
        getBody: true,
      });
      console.log(`communities: ${JSON.stringify(communities)}`);

      // Extract the community ids matching the metro ids
      data = getCommunityIds(m_id, communities);
      console.log(`data: ${JSON.stringify(data)}`);
    }
    return { status: true, data };
  } catch (error) {
    console.log(`error`);
    console.log(error);
    return { status: false, error };
  }
};
const deleteEntity = async (message, subject, messageId) => {
  let entityActionResp;
  try {
    console.log(`message: ${JSON.stringify(message)}`);
    console.log(`subject: ${JSON.stringify(subject)}`);
    console.log(`messageId: ${JSON.stringify(messageId)}`);
    const {
      HomebuilderID = "",
      ID_Hyphen: IDHyphen = null,
      EntityType = "",
      EntityId = "",
      OpportunityID = "",
      OpportunityID_Hyphen: OpportunityIDHyphen = "",
    } = message?.data;
    console.log(`HomebuilderID: ${HomebuilderID}`);
    console.log(`ID_Hyphen: ${IDHyphen}`);
    console.log(`EntityType: ${EntityType}`);
    console.log(`EntityId: ${EntityId}`);
    console.log(`OpportunityID: ${OpportunityID}`);
    console.log(`OpportunityID_Hyphen: ${OpportunityIDHyphen}`);
    let entityActionParams = {};
    /* const builderDetails = await getRecordByIdAndEntity(BUILDER_ID, `builder`);
        console.log(`builderDetails: ${JSON.stringify(builderDetails)}`);
        const builderPinpointAppId = (builderDetails && builderDetails.length && builderDetails[0]?.appid) ?? "";
        const isUpdate = subject === 'update' ? true : false; */

    /* // Get the transformed data for the entity
        const entityActionParams = await getEntityParams(message, isUpdate, EntityType, builderPinpointAppId, subject, messageId);
        log.info('transformedData: ', entityActionParams);
    
        // Upload transformed data    
        await uploadToS3({ message: entityActionParams, subject, messageId, isHydrated: false, isTransformed: true, messageType: message.type, messageDataId: message.id }); */

    // Set the id to fetch from DB. If ID_Hyphen exists, take it.
    // Otherwise use the OpportunityID
    const entityId = IDHyphen?.toLowerCase() || EntityId?.toLowerCase();
    const entityType = EntityType === "opportunity" ? "customer" : EntityType;
    console.log(`entityId: ${entityId}`);
    console.log(`entityType: ${entityType}`);
    if (entityId && HomebuilderID) {
      const isActivity = activityTypes.includes(entityType);
      const isDataCall = !!(entityType === "cobuyer" || isActivity);
      const entityDetail = await getEntityDetail(
        entityId,
        `${entityType}#${HomebuilderID}`,
        isDataCall
      );
      console.log(`entityDetail: ${JSON.stringify(entityDetail)}`);
      if (entityDetail && entityDetail.length) {
        if (EntityType === "opportunity") {
          const {
            id,
            hb_id: hbId,
            rltr: { data: realtor_id = "", rel_id: agency_id = "" },
            cdt,
            stage,
          } = entityDetail[0];
          entityActionParams = {
            id,
            hb_id: hbId,
            realtor_id,
            agency_id,
            cdt,
            stage,
            isSns: true,
            isHf: true,
          };
        } else if (EntityType === "realtor") {
          const { id, hb_id: hbId, rel_id: agencyId = "" } = entityDetail[0];
          const commResp = agencyId
            ? await getAgencyCommunities(agencyId, HomebuilderID)
            : {};
          console.log(`commResp: ${JSON.stringify(commResp)}`);
          const comm = commResp?.status ? commResp?.data : [];
          console.log(`comm: ${JSON.stringify(comm)}`);
          entityActionParams = {
            id,
            hbId,
            hb_id: hbId,
            agencyId,
            comm,
            isSns: true,
            isHf: true,
          };
        } else if (EntityType === "cobuyer") {
          const { id, data, hb_id: hbId } = entityDetail[0];
          entityActionParams = {
            id: data,
            hbId,
            hb_id: hbId,
            rel_id: id,
            isSns: true,
            isHf: true,
          };
        } else if (isActivity) {
          const { id, atype, data } = entityDetail[0];
          entityActionParams = {
            id: data,
            hb_id: HomebuilderID,
            rel_id: id,
            atype,
            isSns: true,
            isHf: true,
          };
        }
        const ENTITY_LAMBDA_EVENT = {
          httpMethod: "POST",
          pathParameters: {
            action: "delete",
          },
          body: JSON.stringify(entityActionParams, null, 2),
        };
        let LAMBDA_ARN = "";
        // Based on the subject create/update the entity
        if (EntityType === "opportunity") {
          LAMBDA_ARN = CUSTOMER_LAMBDA_ARN;
        } else if (EntityType === "realtor") {
          LAMBDA_ARN = REALTORS_LAMBDA_ARN;
        } else if (EntityType === "cobuyer") {
          LAMBDA_ARN = COBUYER_LAMBDA_ARN;
        } else if (activityTypes.includes(EntityType)) {
          LAMBDA_ARN = ACTIVITIES_LAMBDA_ARN;
        }
        console.log(`LAMBDA_ARN: ${LAMBDA_ARN}`);
        console.log(
          `ENTITY_LAMBDA_EVENT: ${JSON.stringify(ENTITY_LAMBDA_EVENT)}`
        );
        entityActionResp = await invokeMainLambda(
          LAMBDA_ARN,
          ENTITY_LAMBDA_EVENT
        );
        log.info("entityActionResp: ", entityActionResp);
        return entityActionResp;
      }

      // Entity with the provided Id doesn't exist in our system
      console.log(`Entity does not exist in the system`);
      await uploadToS3({
        message: { error: "Entity does not exist in the system." },
        subject,
        messageId,
        isHydrated: false,
        isTransformed: false,
        messageType: message.type,
        messageDataId: message.id,
        isError: true,
      });
    } else {
      // No Id provided. Log error
      console.log(`Invalid entity id provided.`);
      await uploadToS3({
        message: { error: "Invalid entity id provided." },
        subject,
        messageId,
        isHydrated: false,
        isTransformed: false,
        messageType: message.type,
        messageDataId: message.id,
        isError: true,
      });
    }
  } catch (error) {
    console.log(`error`);
    console.log(error);
  }
  return entityActionResp;
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
export async function main(event, context) {
  let message;
  let messageId;
  let subject;
  let response;
  try {
    log.info("Received event:", JSON.stringify(event, null, 2));
    log.info("Received context:", JSON.stringify(context, null, 2));
    const snsMessage =
      event && event.Records && event.Records.length && event.Records[0].Sns
        ? event.Records[0].Sns
        : {};
    message = snsMessage.Message ? JSON.parse(snsMessage.Message) : {};
    log.info("Received message:", JSON.stringify(message, null, 2));
    messageId = snsMessage.MessageId ? snsMessage.MessageId : "";
    log.info("MessageId: ", messageId);
    subject = message.subject ? message.subject : "";
    snsMessage.MessageAttributes = {
      subject: {
        Type: "String",
        Value: subject,
      },
    };

    // Upload the message to bucket
    await uploadToS3({
      message: snsMessage,
      subject,
      messageId,
      isHydrated: false,
      isTransformed: false,
      messageType: message.type,
      messageDataId: message.id,
    });

    /* const applicationguid = message.data && message.data.applicationguid ? message.data.applicationguid.toLowerCase() : '';
        let clientGuid = message.data && message.data.clientid ? message.data.clientid : '';
        const customerGuid = message.data && message.data.customerguid ? message.data.customerguid.toLowerCase() : ''; */
    if (subject === "delete") {
      // For delete, we are expecting the hyphen id to be passed in the message.
      // Therefore no hydration call is needed.
      response = await deleteEntity(message, subject, messageId);
      return response;
    }

    const { data: hydrationParams } = message;
    // Get builder id mapped to HomebuilderID_HF in the hydrationParams
    const { HomebuilderID_HF: HomebuilderIDHF = "" } = hydrationParams;
    BuilderID_HF = HomebuilderIDHF;
    if (HomebuilderIDHF) {
      // Get the list of builders
      const builderList = await listBuilders(true);
      console.log(`builderList: ${JSON.stringify(builderList)}`);
      if (builderList?.length) {
        const HomebuilderID = builderList.reduce((hbid, builder) => {
          if (
            builder?.hfhbid?.toLowerCase() === HomebuilderIDHF.toLowerCase()
          ) {
            hbid = builder?.id;
            BUILDER_NAME = builder?.name;
            BUILDER_EMAIL = builder?.email;
          }
          return hbid;
        }, "");
        console.log(`HomebuilderID: ${HomebuilderID}`);
        BuilderID_CRM = HomebuilderID;
        hydrationParams.HomebuilderID = HomebuilderID;
      }
    }
    const hydratedResp = await hydrateData(hydrationParams);
    log.info("hydratedResp: ", hydratedResp);
    if (hydratedResp && hydratedResp?.status !== false) {
      const hydratedRespBody =
        hydratedResp && hydratedResp?.body ? JSON.parse(hydratedResp.body) : {};
      log.info("hydratedRespBody: ", hydratedRespBody);
      const hydratedData = hydratedRespBody?.result ?? {};
      log.info("hydratedData: ", hydratedData);

      // Write to S3 the hydrated message
      message.data = { ...message.data, ...hydratedData };
      await uploadToS3({
        message: hydratedData,
        subject,
        messageId,
        isHydrated: true,
        isTransformed: false,
        messageType: message.type,
        messageDataId: message.id,
      });
      response = await processEntity(
        hydrationParams,
        message,
        subject,
        messageId
      );
    }

    // Hydration returned false value. Failed.
    // Upload error log
    await uploadToS3({
      message: { error: hydratedResp?.error },
      subject,
      messageId,
      isHydrated: false,
      isTransformed: false,
      messageType: message.type,
      messageDataId: message.id,
      isError: true,
    });
  } catch (error) {
    log.info("Exception Occured: ", error.stack);
    // Upload error log
    await uploadToS3({
      message: { error },
      subject,
      messageId,
      isHydrated: false,
      isTransformed: false,
      messageType: message.type,
      messageDataId: message.id,
      isError: true,
    });
  }
  return response;
}
