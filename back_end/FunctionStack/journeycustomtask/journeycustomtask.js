import { invokeLambda } from "../libs/lambda";
import { getStackOutputs } from "../libs/db";

const { ACTIVITIES_LAMBDA_ARN, StackName } = process.env;
let CAMPAIGN_LAMBDA_ARN = "";

const setLambdaARNs = async () => {
  try {
    CAMPAIGN_LAMBDA_ARN = await getStackOutputs({
      StackName,
      outputName: "CampaignApiFunctionArn",
    });
    console.log(`CAMPAIGN_LAMBDA_ARN: ${CAMPAIGN_LAMBDA_ARN}`);
  } catch (error) {
    console.log("error in setLambdaARNs");
    console.log(error);
  }
};
const createActivity = async (data) => {
  let createAct = [];
  try {
    // Create task activity
    const createActivityParams = {
      httpMethod: "POST",
      pathParameters: {
        action: "create",
      },
      body: JSON.stringify(data),
    };
    console.log(
      `createActivityParams: ${JSON.stringify(createActivityParams)}`
    );

    // Invoke activities lambda
    const createActResp = await invokeLambda(
      ACTIVITIES_LAMBDA_ARN,
      createActivityParams,
      false
    );
    console.log(`createActResp: ${JSON.stringify(createActResp)}`);
    const { Payload: createActBody } = createActResp;
    createAct = JSON.parse(createActBody);
  } catch (error) {
    console.log(`Error occured in createActivity`);
    console.log(error);
    return {};
  }
  return createAct;
};
const getTaskContent = async (data) => {
  let response;
  try {
    // Get the task content
    const getTaskContentParams = {
      httpMethod: "POST",
      pathParameters: {
        action: "gettask",
        type: "journey",
      },
      body: JSON.stringify({ ...data, isJSONOnly: true }),
    };
    console.log(
      `getTaskContentParams: ${JSON.stringify(getTaskContentParams)}`
    );

    // Invoke Campaign lambda
    const getTaskResp = await invokeLambda(
      CAMPAIGN_LAMBDA_ARN,
      getTaskContentParams,
      false
    );
    console.log(`getTaskResp: ${JSON.stringify(getTaskResp)}`);
    const { Payload: getTaskBody } = getTaskResp;
    response = JSON.parse(getTaskBody);
  } catch (error) {
    console.log(`Error occured in getTaskContent`);
    console.log(error);
    return {};
  }
  return response;
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
export async function main(event, context, callback) {
  console.log("Received event:", JSON.stringify(event, null, 2));
  try {
    // Get the campaign API function ARN
    await setLambdaARNs();

    // Start the task creation process
    let userAttr;
    const {
      ApplicationId,
      JourneyId,
      Endpoints = [],
      Data: taskDataString = "",
    } = event;

    // Extract the task content id from taskData
    const taskData = taskDataString.split("|");
    const [noteId = ""] = taskData;
    console.log(`noteId: ${noteId}`);

    // Get the task note content
    const { data: { params: taskParams = {} } = {} } = await getTaskContent({
      noteId,
      ApplicationId,
      JourneyId,
    });
    console.log(`taskParams: ${JSON.stringify(taskParams)}`);

    // Loop through each endpoint and prepare the endpoint data for the task creation
    for (const key in Endpoints) {
      if (Endpoints[key]) {
        const endpoint = Endpoints[key];
        userAttr = endpoint?.User?.UserAttributes;

        // If user attributes doesn't exist, initialize as an empty object
        if (!userAttr) {
          userAttr = {};
          endpoint.UserAttributes = userAttr;
        }
        const [hbId = ""] = userAttr?.hb_id;

        // Prepare task activity creation params
        const activityParams = {
          rel_id: key,
          hb_id: hbId,
          acti: { ...taskParams, dt: Date.now() },
        };

        // Create task activity
        console.log(`===========Starting Create task===========`);
        console.log(`activityParams: ${JSON.stringify(activityParams)}`);
        await createActivity(activityParams);
        console.log(`===========Ending process===========`);
      }
    }
    console.log(`event.Endpoints: ${JSON.stringify(event.Endpoints)}`);
  } catch (error) {
    console.log("Error occured");
    console.log(error);
  }
  callback(null, event.Endpoints);
}
