import "../../NPMLayer/nodejs.zip";
import AWS from "aws-sdk";
import { invokeLambda } from "../../FunctionStack/libs/lambda";
import { getStackOutputs } from "../../FunctionStack/libs/db";

let BUILDER_LAMBDA_ARN = "";
let ACTIVITIES_LAMBDA_ARN = "";
const { MACHINE_ARN, StackName } = process.env;
const sfn = new AWS.StepFunctions();
export const initUpdateEmailActivityExecution = async (builderDetail) => {
  let nextEvent = {
    ...builderDetail,
  };
  nextEvent = JSON.stringify(nextEvent);
  const params = {
    input: nextEvent,
    stateMachineArn: MACHINE_ARN,
  };
  console.log(`params: ${JSON.stringify(params)}`);
  const startExecutionResp = await sfn.startExecution(params).promise();
  console.log(`startExecutionResp: ${JSON.stringify(startExecutionResp)}`);
};
const listBuilders = async () => {
  let builderList = [];
  try {
    // Get the list of builders
    const listBuildersParams = {
      httpMethod: "GET",
      pathParameters: {
        action: "listb",
      },
    };
    console.log(`listBuildersParams: ${JSON.stringify(listBuildersParams)}`);

    // Invoke builder lambda
    const builderListResp = await invokeLambda(
      BUILDER_LAMBDA_ARN,
      listBuildersParams,
      false
    );
    console.log(`builderListResp: ${JSON.stringify(builderListResp)}`);
    let { Payload: builderListBody } = builderListResp;
    builderListBody = JSON.parse(builderListBody);
    builderList = builderListBody;
    console.log(`builderList: ${JSON.stringify(builderList)}`);
  } catch (error) {
    console.log(
      `Error occured in listBuilders getbuilders EmailActivityUpdateStack`
    );
    console.log(error);
    return [];
  }
  return builderList;
};
const checkBuilderValidity = async (id) => {
  let isBuilderValid = [];
  try {
    // Get the builder detail
    const getBuilderParams = {
      httpMethod: "POST",
      pathParameters: {
        action: "getb",
      },
      body: JSON.stringify({ id }),
    };
    console.log(`getBuilderParams: ${JSON.stringify(getBuilderParams)}`);

    // Invoke builder lambda
    const getBuilderResp = await invokeLambda(
      BUILDER_LAMBDA_ARN,
      getBuilderParams,
      false
    );
    console.log(`getBuilderResp: ${JSON.stringify(getBuilderResp)}`);
    let { Payload: builderDetail } = getBuilderResp;
    builderDetail = JSON.parse(builderDetail);
    console.log(`builderDetail: ${JSON.stringify(builderDetail)}`);
    const { status, data } = builderDetail;
    isBuilderValid = !!(status && data?.id);
  } catch (error) {
    console.log(
      `Error occured in listBuilders getbuilders EmailActivityUpdateStack`
    );
    console.log(error);
    return [];
  }
  return isBuilderValid;
};
const setLambdaARNs = async () => {
  try {
    const stackOutputs = await getStackOutputs({
      StackName,
      outputName: "",
      all: true,
    });
    for (const stackOutput of stackOutputs) {
      switch (stackOutput.OutputKey) {
        case "BuildersApiFunctionArn":
          BUILDER_LAMBDA_ARN = stackOutput.OutputValue;
          break;
        case "ActivitiesApiFunctionArn":
          ACTIVITIES_LAMBDA_ARN = stackOutput.OutputValue;
          break;
        default:
          break;
      }
    }
    console.log(`BUILDER_LAMBDA_ARN: ${BUILDER_LAMBDA_ARN}`);
    console.log(`ACTIVITIES_LAMBDA_ARN: ${ACTIVITIES_LAMBDA_ARN}`);
  } catch (error) {
    console.log("error in setLambdaARNs");
    console.log(error);
  }
};
export async function main(event) {
  const { statusFileKey = "" } = event;
  let isValidBuilder;
  try {
    console.log(JSON.stringify(event));
    await setLambdaARNs();
    let hbidMappedBuilders;
    let builderDetail;
    const {
      hb_id: hbId,
      skipToEmailActivityUpdate = false,
      skipToGetEmailActivity = false,
    } = event;
    // Checking whether the event object has hb_id. If not this is the first execution
    if (!hbId) {
      // For the first execution
      const builderList = await listBuilders();
      console.log(`builderList: ${JSON.stringify(builderList)}`);
      hbidMappedBuilders = builderList.map((builder) => {
        builder.hb_id = builder.id;
        return builder;
      });
      // Spawning new executions for every builder config except for the first, which is executed in the current one
      for (let i = 0; i < hbidMappedBuilders.length; i += 1) {
        if (i === 0) {
          [builderDetail] = hbidMappedBuilders;
        } else {
          await initUpdateEmailActivityExecution({
            ...hbidMappedBuilders[i],
            skipToEmailActivityUpdate,
            skipToGetEmailActivity,
            statusFileKey,
            BuildersApiFunctionArn: BUILDER_LAMBDA_ARN,
            ActivitiesApiFunctionArn: ACTIVITIES_LAMBDA_ARN,
          });
        }
      }
    } else {
      // For all the executions except for the first, event will contain the builder config
      builderDetail = { ...event };
    }
    isValidBuilder = !!(await checkBuilderValidity(builderDetail.hb_id));
    // returning the builderDetail
    return {
      ...builderDetail,
      isValidBuilder,
      error: !isValidBuilder ? "Invalid builder id provided." : null,
      skipToEmailActivityUpdate,
      skipToGetEmailActivity,
      statusFileKey,
      BuildersApiFunctionArn: BUILDER_LAMBDA_ARN,
      ActivitiesApiFunctionArn: ACTIVITIES_LAMBDA_ARN,
    };
  } catch (error) {
    console.log(`error: ${JSON.stringify(error)}`);
    return { isValidBuilder: false, statusFileKey };
  }
}
