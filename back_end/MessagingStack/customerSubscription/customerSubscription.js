/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import AWS from "aws-sdk";
import https from "https";
import aws4 from "aws4";
import * as log from "../logger";
import {
  getMessagingParams,
  listBuilders,
} from "../../FunctionStack/builders/builders";

const credentials = new AWS.EnvironmentCredentials("AWS");
const s3 = new AWS.S3();
const lambda = new AWS.Lambda();
// const ssm = new AWS.SSM();
const { S3_BUCKET_ARN, CUSTOMER_LAMBDA_ARN, COMMUNITY_LAMBDA_ARN } =
  process.env;
// const paramStorePublicPath = '/CRM/CustomerData/PublicConfig';
let BUILDER_IDS = {};

/* const getParameter = async parameterName => {
    const params = {
        Name: parameterName,
        WithDecryption: true
    };
    console.log(`params: ${JSON.stringify(params)}`);
    try {
        const getParameterResp = await ssm.getParameter(params).promise();
        console.log(`getParameterResp: ${JSON.stringify(getParameterResp)}`);
        return getParameterResp;
    }
    catch (e) {
        console.log(`e: ${JSON.stringify(e.stack)}`);
    }
} */
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
  } = uploadObj;
  const params = {
    Body: JSON.stringify(message),
    ContentType: "application/json",
    Bucket: S3_BUCKET_ARN,
    Key: "",
  };

  if (isHydrated) {
    params.Key = `${messageType}/${subject}/rehydrated/brixCustomer/${messageId}-${messageDataId}.json`;
  } else if (isTransformed) {
    params.Key = `${messageType}/${subject}/transformed/crmCustomer/${messageId}-${messageDataId}.json`;
  } else {
    params.Key = `${messageType}/${subject}/${messageId}-${messageDataId}.json`;
  }
  log.info("params.Key: ", params.Key);
  const s3UploadResp = await s3.putObject(params).promise();
  log.info("s3UploadResp: ", s3UploadResp);
  return s3UploadResp;
};

const hydrateData = async (applicationguid, clientGuid, customerGuid) => {
  let dataString = "";
  /* const messagingPublicConfigResp = await db.getParameter(`${paramStorePublicPath}`);
    const messagingPublicConfig = messagingPublicConfigResp && messagingPublicConfigResp.Parameter && messagingPublicConfigResp.Parameter.Value ? JSON.parse(messagingPublicConfigResp.Parameter.Value) : {}; */
  const messagingParamsResp = await getMessagingParams(true);
  console.log(`messagingParamsResp: ${JSON.stringify(messagingParamsResp)}`);
  const messagingHydrationPath = messagingParamsResp.hydrationPath
    ? messagingParamsResp.hydrationPath
    : "";
  const messagingHydrationHost = messagingParamsResp.hydrationHost
    ? messagingParamsResp.hydrationHost
    : "";
  console.log("messagingHydrationPath: ", messagingHydrationPath);
  console.log("messagingHydrationHost: ", messagingHydrationHost);
  const options = {
    hostname: messagingHydrationHost,
    path: `${messagingHydrationPath}?applicationGuid=${applicationguid}&clientID=${clientGuid}&customerGuid=${customerGuid}`,
    method: "GET",
    region: "us-west-2",
    service: "execute-api",
  };
  const opts = aws4.sign(options, credentials);
  const hydratedResp = await new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      log.info(`statusCode: ${res.statusCode}`);
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
    req.end();
  });
  log.info("hydratedResp: ", hydratedResp);
  return hydratedResp;
};
const getInterestsForProjNo = async (proj, hbid) => {
  const gcbpParams = { hbid, proj };
  console.log(gcbpParams);
  const interestDetails = await invokeMainLambda(COMMUNITY_LAMBDA_ARN, {
    httpMethod: "POST",
    pathParameters: {
      action: "gcbp",
    },
    body: JSON.stringify(gcbpParams, null, 2),
  });
  log.info("interestDetails: ", interestDetails);
  /* [
          {
              "Items": [
                  {
                      "entity": "community#a07c0af0-884b-11ea-811a-7f1d91d0645c",
                      "pjct_no": "00002",
                      "rel_id": "e7eb4060-8aa6-11ea-b7e0-eda21b2e561e",
                      "cdt": 1588967826041,
                      "hb_id": "a07c0af0-884b-11ea-811a-7f1d91d0645c",
                      "id": "17cfd690-9166-11ea-9aec-19afee78d7a4",
                      "name": "Southern Oaks",
                      "mdt": 1588968230643,
                      "type": "community"
                  }
              ],
              "Count": 1,
              "ScannedCount": 17
          }
          ,
          {
              "Items": [
                  {
                      "entity": "community#a07c0af0-884b-11ea-811a-7f1d91d0645c",
                      "pjct_no": "00009",
                      "rel_id": "e7eb4060-8aa6-11ea-b7e0-eda21b2e561e",
                      "cdt": 1588967716030,
                      "hb_id": "a07c0af0-884b-11ea-811a-7f1d91d0645c",
                      "id": "d63d7de0-9165-11ea-b63b-5d8c89314ebc",
                      "name": "Buttercup Creek",
                      "mdt": 1588968015399,
                      "type": "community"
                  }
              ],
              "Count": 1,
              "ScannedCount": 17
          }
      ] */
  const interestArrResp =
    interestDetails &&
    interestDetails.StatusCode === 200 &&
    interestDetails.Payload
      ? JSON.parse(interestDetails.Payload)
      : [];
  const interestArr = interestArrResp.map((interestResp) =>
    interestResp.Items && interestResp.Items.length ? interestResp.Items[0] : {}
  );
  // const interestArr = interestArrResp && interestArrResp.length && interestArrResp[0].Items ? interestArrResp[0].Items : [];
  return interestArr;
};
const getCustomerParams = async (
  message,
  builderPinpointAppId,
  clientId,
  applicationguid,
  isUpdate
) => {
  const BUILDER_ID = BUILDER_IDS[clientId];
  let brixStage;

  switch (message.data.Status) {
    case "Contact":
      brixStage = "Lead";
      break;
    case "Prospect":
      brixStage = "Prospect";
      break;
    case "Buyer":
      brixStage = "Buyer";
      break;
    case "Bustout":
      brixStage = "Bust_Out";
      break;
    case "Closed":
      brixStage = "Closed";
      break;
    case "Dead Lead":
      brixStage = "Dead_Lead";
      break;
    default:
      break;
  }
  /* {
        CustomerID: 101756,
        CustomerProfileID: 1854,
        ProfileNumber: 1,
        CustomerName: 'Smith, Jolli',
        CustomerSort: 'SmithJolli',
        HomePhone: '(123) 456-7894',
        WorkPhone: '(123) 456-7894',
        EmailAddress: 'JollySmith@test.com',
        ProjectID: 147,
        ProjectNumber: '00086',
        ProjectName: 'Austin G&A',
        RegistrationDate: '2020-05-08T00:00:00.000Z',
        HotCode: 'Ready ',
        Status: 'Prospect',
        HotCodeReady: 'Ready',
        HotCodeWilling: '',
        HotCodeAble: '',
        HotcodeNone: false,
        CustomerLastName: 'Smith',
        CustomerFirstName: 'Jolli'
    } */
  const customerCreateParams = {
    type: "customer",
    hb_id: BUILDER_ID, // Hard Coded for the timebeing
    fname: message.data.CustomerFirstName,
    lname: message.data.CustomerLastName,
    email: message.data.EmailAddress,
    stage: brixStage,
    appid: builderPinpointAppId,
    brixid: message.data.CustomerID,
    brixappid: applicationguid,
    brixprojno: message.data.ProjectNumber,
    brixclientid: clientId,
    crby: "BRIX",
    isSns: true,
    id: message.data.customerguid,
  };
  let phoneNumber;
  if (message.data.HomePhone) phoneNumber = message.data.HomePhone;
  else if (message.data.WorkPhone) phoneNumber = message.data.WorkPhone;
  else phoneNumber = "";
  if (phoneNumber) {
    customerCreateParams.phone = phoneNumber;
  } else if (!isUpdate) {
    customerCreateParams.phone = "(123) 456-7890";
  }
  if (!isUpdate) {
    customerCreateParams.psrc = "Sample-Primary-Source-Id";
    customerCreateParams.cntm = "Sample-Contact-Method";
    customerCreateParams.grade = "Sample-Grade";
  }

  // Get the Interests based on projectNumber
  let proj;
  if (typeof message.data.ProjectNumber === "string") {
    proj = [message.data.ProjectNumber];
  } else {
    proj = message.data.ProjectNumber;
  }
  const interestArrResp = await getInterestsForProjNo(proj, BUILDER_ID);
  const interestArr = interestArrResp.reduce((idArr, community) => {
    if (community.id) {
      idArr.push(community.id);
    }
    return idArr;
  }, []);
  log.info("interestArr: ", JSON.stringify(interestArr));
  customerCreateParams.inte = interestArr;
  return customerCreateParams;
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
  try {
    log.info("Received event:", JSON.stringify(event, null, 2));
    log.info("Received context:", JSON.stringify(context, null, 2));
    const snsMessage =
      event && event.Records && event.Records.length && event.Records[0].Sns
        ? event.Records[0].Sns
        : {};
    const message = snsMessage.Message ? JSON.parse(snsMessage.Message) : {};
    log.info("Received message:", JSON.stringify(message, null, 2));
    const messageId = snsMessage.MessageId ? snsMessage.MessageId : "";
    log.info("MessageId: ", messageId);
    const subject = message.subject ? message.subject : "";
    snsMessage.MessageAttributes = {
      subject: {
        Type: "String",
        Value: subject,
      },
    };
    // log.info('From SNS:', message);

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

    // Hydrate the message using the BRIX API
    /* {
                    "specversion": "1.0",
                "source": "https://www.hyphensolutions.com/brix",
                    "id": "61af0b92-8477-11ea-bc55-0242ac130003",
                        "time": "2020-04-23T10:53:52.244Z",
                            "datacontenttype": "application/json",
                                "type": "com-brix-customerData",
                                    "subject": "created",
                                        "data": {
                    "applicationguid": "56D074D0-D940-4B35-8CEB-CD1FE2A8BBE0",
                    "clientGuid": "3",
                        "customerGuid": "56D074D0-D940-4B35-8CEB-CD1FE2A8BBE0",
                            "emailAddress": "Brix customer’s email address."
            }
        } */
    const applicationguid =
      message.data && message.data.applicationguid
        ? message.data.applicationguid.toLowerCase()
        : "";
    const clientGuid =
      message.data && message.data.clientid ? message.data.clientid : "";
    const customerGuid =
      message.data && message.data.customerguid
        ? message.data.customerguid.toLowerCase()
        : "";

    const hydratedResp = await hydrateData(
      applicationguid,
      clientGuid,
      customerGuid
    );
    const hydratedRespBody =
      hydratedResp && hydratedResp.body ? JSON.parse(hydratedResp.body) : {};
    const hydratedData =
      hydratedRespBody.result && hydratedRespBody.result.length
        ? hydratedRespBody.result[0]
        : {};
    /* const hydratedData = {
            CustomerID: 100909,
            CustomerProfileID: 1486,
            ProfileNumber: 1,
            CustomerName: 'Carlos, Joshua',
            CustomerSort: 'CarlosJoshua',
            HomePhone: '',
            WorkPhone: '',
            Email: 'aholladay@ihyphen.com',
            ProjectID: [Array],
            ProjectNumber: '00001',
            ProjectName: 'Happy Valley',
            UserName: 'Ken  Harvey',
            RegistrationDate: '2015-08-19T00:00:00.000Z',
            HotCode: '',
            Status: 'Buyer',
            HotCodeReady: '',
            HotCodeWilling: '',
            HotCodeAble: '',
            HotcodeNone: true,
            CustomerLastName: 'Carlos',
            CustomerFirstName: 'Joshua',
            EmailAddress: 'kennharv@sbcglobal.net',
            SecondaryProfile: false
        }; */
    log.info("hydratedData: ", hydratedData);
    /* {
                    CustomerID: 100909,
            CustomerProfileID: 1486,
            ProfileNumber: 1,
            CustomerName: 'Carlos, Joshua',
            CustomerSort: 'CarlosJoshua',
            HomePhone: '',
            WorkPhone: '',
            Email: 'aholladay@ihyphen.com',
            ProjectID: [Array],
            ProjectNumber: '00001',
            ProjectName: 'Happy Valley',
            UserName: 'Ken  Harvey',
            RegistrationDate: '2015-08-19T00:00:00.000Z',
            HotCode: '',
            Status: 'Buyer',
            HotCodeReady: '',
            HotCodeWilling: '',
            HotCodeAble: '',
            HotcodeNone: true,
            CustomerLastName: 'Carlos',
            CustomerFirstName: 'Joshua',
            EmailAddress: 'kennharv@sbcglobal.net',
            SecondaryProfile: false
          } */
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
    /* if (STAGE === 'dev') {
            // Develop
            BUILDER_IDS = {
                '3': '7b62c500-73ca-11ea-9685-2b6a19ad2aa9'
            };
        }
        else {
            // Production
            BUILDER_IDS = {
                '3': 'a07c0af0-884b-11ea-811a-7f1d91d0645c',
                '13000': 'e67a4940-884b-11ea-811a-7f1d91d0645c'
            };
        } */
    // const messagingPublicConfigResp = await db.getParameter(`${paramStorePublicPath}`);
    // const messagingPublicConfig = messagingPublicConfigResp && messagingPublicConfigResp.Parameter && messagingPublicConfigResp.Parameter.Value ? JSON.parse(messagingPublicConfigResp.Parameter.Value) : {};
    const buildersList = await listBuilders(true);
    console.log(`buildersList: ${JSON.stringify(buildersList)}`);
    const messagingPublicConfig = buildersList.reduce(
      (publicConfig, builder) => {
        if (builder.clientid) {
          publicConfig.builderIds[builder.clientid] = builder.id;
          publicConfig.pinpointAppIds[builder.clientid] = builder.appid;
        }
        if (builder.appguid) {
          publicConfig.builderIds[builder.appguid] = builder.id;
        }
        return publicConfig;
      },
      { builderIds: {}, pinpointAppIds: {} }
    );
    console.log(
      `messagingPublicConfig: ${JSON.stringify(messagingPublicConfig)}`
    );
    const { builderIds } = messagingPublicConfig;
    BUILDER_IDS = builderIds;
    // Prepare payload for create/Update from the hydrated data
    // const builderPinpointAppId = await getBuilderAppId(clientGuid);
    const builderPinpointAppId =
      messagingPublicConfig.pinpointAppIds[clientGuid];
    const isUpdate = subject === "update";
    const customerActionParams = await getCustomerParams(
      message,
      builderPinpointAppId,
      clientGuid,
      applicationguid,
      isUpdate
    );
    log.info("transformedData: ", customerActionParams);

    // Upload transformed data
    await uploadToS3({
      message: customerActionParams,
      subject,
      messageId,
      isHydrated: false,
      isTransformed: true,
      messageType: message.type,
      messageDataId: message.id,
    });

    const CUSTOMER_LAMBDA_EVENT = {
      httpMethod: "POST",
      pathParameters: {
        action: "",
      },
      body: JSON.stringify(customerActionParams, null, 2),
    };
    // Based on the subject create/update the customer
    switch (subject) {
      case "create":
        // Create Customer
        CUSTOMER_LAMBDA_EVENT.pathParameters.action = "create";
        break;
      case "update":
        // Update Customer
        CUSTOMER_LAMBDA_EVENT.pathParameters.action = "updateRow";
        break;
      default:
        break;
    }
    const customerActionResp = await invokeMainLambda(
      CUSTOMER_LAMBDA_ARN,
      CUSTOMER_LAMBDA_EVENT
    );
    log.info("customerActionResp: ", customerActionResp);
  } catch (error) {
    log.info("Exception Occured: ", error.stack);
  }
}
