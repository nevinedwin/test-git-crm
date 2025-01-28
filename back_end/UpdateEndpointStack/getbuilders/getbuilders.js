import "../../NPMLayer/nodejs.zip";
import { invokeLambda } from "../../FunctionStack/libs/lambda";
import { getStackOutputs } from "../../FunctionStack/libs/db";
import { initStepFunctionExecution } from "../../FunctionStack/libs/step-function";

const { StackName, MACHINE_ARN } = process.env;
let BUILDER_LAMBDA_ARN = "";
let CUSTOMER_LAMBDA_ARN = "";
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
        case "CustomersApiFunctionArn":
          CUSTOMER_LAMBDA_ARN = stackOutput.OutputValue;
          break;
        default:
          break;
      }
    }
    console.log(`BUILDER_LAMBDA_ARN: ${BUILDER_LAMBDA_ARN}`);
    console.log(`CUSTOMER_LAMBDA_ARN: ${CUSTOMER_LAMBDA_ARN}`);
  } catch (error) {
    console.log("error in setLambdaARNs");
    console.log(error);
  }
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
      `Error occured in listBuilders getbuilders UpdateEndpointStack`
    );
    console.log(error);
    return [];
  }
  return builderList;
};
export async function main(event) {
  try {
    console.log(JSON.stringify(event));
    let hbidMappedBuilders;
    let builderDetail;
    await setLambdaARNs();
    const { hb_id: hbId, skipToGetCustomerIterator = false } = event;
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
          await initStepFunctionExecution(
            {
              ...hbidMappedBuilders[i],
              skipToGetCustomerIterator,
              BuildersApiFunctionArn: BUILDER_LAMBDA_ARN,
              CustomersApiFunctionArn: CUSTOMER_LAMBDA_ARN,
              purpose: ""
            },
            MACHINE_ARN
          );
        }
      }
    } else {
      // For all the executions except for the first, event will contain the builder config
      builderDetail = { ...event };
    }
    // returning the builderDetail
    return {
      ...builderDetail,
      isValidBuilder: !!builderDetail.hb_id,
      skipToGetCustomerIterator,
      BuildersApiFunctionArn: BUILDER_LAMBDA_ARN,
      CustomersApiFunctionArn: CUSTOMER_LAMBDA_ARN,
      purpose: ""
    };
  } catch (error) {
    console.log(`error: ${JSON.stringify(error)}`);
    return { isValidBuilder: false };
  }
}
