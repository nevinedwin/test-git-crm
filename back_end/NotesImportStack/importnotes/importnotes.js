/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import { invokeLambda } from "../../FunctionStack/libs/lambda";

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
  const { ActivitiesApiFunctionArn } = event;
  ACTIVITIES_LAMBDA_ARN = ActivitiesApiFunctionArn;
  console.log(`ACTIVITIES_LAMBDA_ARN: ${ACTIVITIES_LAMBDA_ARN}`);
  const { list: noteActivityParams } = event;

  // Create note activity
  console.log(`===========Starting Create Note===========`);
  console.log(`noteActivityParams: ${JSON.stringify(noteActivityParams)}`);
  await createActivity(noteActivityParams);
  console.log(`===========Ending process===========`);
  return { status: true };
}
