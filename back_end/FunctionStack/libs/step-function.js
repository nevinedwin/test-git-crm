import AWS from "aws-sdk";

const sfn = new AWS.StepFunctions();
export const initStepFunctionExecution = async (
  executionDetails,
  stateMachineArn
) => {
  let input = {
    ...executionDetails,
  };
  input = JSON.stringify(input);
  const params = {
    input,
    stateMachineArn,
  };
  console.log(`params: ${JSON.stringify(params)}`);
  const startExecutionResp = await sfn.startExecution(params).promise();
  console.log(`startExecutionResp: ${JSON.stringify(startExecutionResp)}`);
};
