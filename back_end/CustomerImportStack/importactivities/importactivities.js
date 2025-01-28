/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import { createChangeActivity } from "../../FunctionStack/libs/change-activity";
import { invokeLambda } from "../../FunctionStack/libs/lambda";
import { incrementGoalCount } from "../../FunctionStack/goalSetting/goalSetting";

let ACTIVITIES_LAMBDA_ARN = "";

const createActivity = async (data) => {
  let createAct = [];
  try {
    // Get the list of builders
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

    // Invoke builder lambda
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
export async function main(event) {
  console.log(event);
  const { ActivitiesApiFunctionArn, BuildersApiFunctionArn } = event;
  ACTIVITIES_LAMBDA_ARN = ActivitiesApiFunctionArn;
  console.log(`ACTIVITIES_LAMBDA_ARN: ${ACTIVITIES_LAMBDA_ARN}`);
  const {
    status,
    stageChangeActivityParams,
    inteChangeActivityParams,
    noteActivityParams,
    customerMessagingParams,
  } = event;
  if (status) {
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
        if(inteChangeActivityItem?.stage){
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
      for (const noteActivityParam of noteActivityParams)
        await createActivity(noteActivityParam);
    }
    console.log(`===========Ending process===========`);
    return { status, customerMessagingParams, BuildersApiFunctionArn };
  }
  return { status, BuildersApiFunctionArn };
}
