/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import {
  getHydrationParamsForQuery,
  getResourceJSON,
  batchGetResources,
} from "../../FunctionStack/libs/db";
import {
  success,
  failure,
  badRequest,
} from "../../FunctionStack/libs/response-lib";
import { listBuilders } from "../../FunctionStack/builders/builders";
// const paramStorePublicPath = '/CRM/CustomerData/PublicConfig';
// const { STAGE } = process.env;
let CLIENT_IDS = {};
let APP_GUIDS = {};

const getCustomer = async (id, correlationId) => {
  const params = getHydrationParamsForQuery(id);
  const customerDetails = await getResourceJSON(params);
  let response = {};
  let projectNumbers = [];
  if (customerDetails && customerDetails.length) {
    // Get the Project Numbers of Customer's Interests
    const interests = customerDetails[0].inte ? customerDetails[0].inte : [];
    const hbId = customerDetails[0].hb_id ? customerDetails[0].hb_id : "";
    if (interests && interests.length) {
      const communityGetParams = {
        RequestItems: {
          /* required */
          [process.env.entitiesTableName]: {
            Keys: [],
            AttributesToGet: ["pjct_no"],
          },
        },
      };
      for (const interestId of interests) {
        communityGetParams.RequestItems[
          process.env.entitiesTableName
        ].Keys.push({
          id: interestId,
          entity: `community#${hbId}`,
        });
      }
      console.log("communityGetParams: ", JSON.stringify(communityGetParams));
      const projectNumbersResp = await batchGetResources(
        communityGetParams,
        true
      );
      const projectNumbersBody =
        projectNumbersResp &&
        projectNumbersResp.statusCode === 200 &&
        projectNumbersResp.body
          ? JSON.parse(projectNumbersResp.body)
          : [];
      projectNumbers = projectNumbersBody.map(
        (projectNumber) => projectNumber.pjct_no
      );
      console.log("projectNumbers: ", projectNumbers);
    }
    // Customer Details Found
    // ProjectNumber: customerDetails[0].brixprojno,
    // Convert the CRM Stage to BRIX Stage
    let brixStage;
    switch (customerDetails[0].stage) {
      case "Lead":
        brixStage = "T";
        break;
      case "Prospect":
        brixStage = "P";
        break;
      case "Buyer":
        brixStage = "B";
        break;
      case "Bust_Out":
        brixStage = "O";
        break;
      case "Closed":
        brixStage = "C";
        break;
      case "Dead_Lead":
        brixStage = "D";
        break;
      default:
        break;
    }
    response = {
      header: {
        params: {
          customerId: id,
        },
        otherinfo: {
          correlationId,
        },
      },
      result: [
        {
          FirstName: customerDetails[0].fname,
          LastName: customerDetails[0].lname,
          Email: customerDetails[0].email,
          Phone: customerDetails[0].phone,
          Status: brixStage,
          CustomerId: customerDetails[0].id,
          HomebuilderId: hbId,
          ApplicationGUID: customerDetails[0].brixappid
            ? customerDetails[0].brixappid
            : APP_GUIDS[hbId],
          ProjectNumber: projectNumbers,
          ClientId: customerDetails[0].brixclientid
            ? customerDetails[0].brixclientid
            : CLIENT_IDS[hbId],
        },
      ],
    };
    return success(response);
  }

  // Customer doesn't exist
  response = {
    errorText: "Customer does not exist",
    correlationId,
  };
  return badRequest(response);
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
  let response;
  try {
    console.log(`event: ${JSON.stringify(event)}`);
    if (event.source !== "aws.events") {
      const customerId =
        event &&
        event.queryStringParameters &&
        event.queryStringParameters.customerId
          ? event.queryStringParameters.customerId
          : "";
      const correlationId = context.awsRequestId;
      /* if (STAGE === 'dev') {
                // Develop
                CLIENT_IDS = {
                    '7b62c500-73ca-11ea-9685-2b6a19ad2aa9': '3'
                };
            }
            else {
                // Production
                CLIENT_IDS = {
                    'a07c0af0-884b-11ea-811a-7f1d91d0645c': '3',
                    'e67a4940-884b-11ea-811a-7f1d91d0645c': '13000'
                };
            } */
      /* const messagingPublicConfigResp = await getParameter(`${paramStorePublicPath}`);
            const messagingPublicConfig = messagingPublicConfigResp && messagingPublicConfigResp.Parameter && messagingPublicConfigResp.Parameter.Value ? JSON.parse(messagingPublicConfigResp.Parameter.Value) : {};
            console.log("messagingPublicConfig: ", messagingPublicConfig); */
      const buildersList = await listBuilders(true);
      console.log(`buildersList: ${JSON.stringify(buildersList)}`);
      const messagingPublicConfig = buildersList.reduce(
        (publicConfig, builder) => {
          publicConfig.clientIds[builder.id] = builder.clientid
            ? builder.clientid
            : "";
          publicConfig.appGuids[builder.id] = builder.appguid
            ? builder.appguid
            : "";
          return publicConfig;
        },
        { clientIds: {}, appGuids: {} }
      );
      console.log(
        `messagingPublicConfig: ${JSON.stringify(messagingPublicConfig)}`
      );
      const clientIds = messagingPublicConfig.clientIds
        ? messagingPublicConfig.clientIds
        : "";
      const applicationGuids = messagingPublicConfig.appGuids
        ? messagingPublicConfig.appGuids
        : "";
      CLIENT_IDS = clientIds;
      APP_GUIDS = applicationGuids;
      console.log("CLIENT_IDS: ", CLIENT_IDS);
      console.log("APP_GUIDS: ", APP_GUIDS);
      response = await getCustomer(customerId, correlationId);
    }
  } catch (err) {
    console.log(err);
    return failure({ status: false, error: err });
  }
  return response;
}
