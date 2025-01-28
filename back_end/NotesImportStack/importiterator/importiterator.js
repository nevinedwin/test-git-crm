import "../../NPMLayer/nodejs.zip";
import AWS from "aws-sdk";

const { MACHINE_ARN } = process.env;
const sfn = new AWS.StepFunctions();
export const initNoteImportExecution = async (executionDetails) => {
  let nextEvent = {
    ...executionDetails,
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
export async function main(event) {
  console.log(event);
  let { index } = event.importiterator;
  const { step } = event.importiterator;
  const {
    count,
    doImportNoteExecution = false,
    hb_id: hbId,
    validatedFileKey,
    statusFileKey,
    fileKey,
    formattedFileKey,
    startTimestamp,
    BuildersApiFunctionArn,
    SearchApiFunctionArn,
    ActivitiesApiFunctionArn,
  } = event;
  // Check whether doImportNoteExecution exists
  // and whether the total count is greater than step
  // That indicates, this is not the initial iteration.
  // So, spawn a new execution
  if (doImportNoteExecution && count > step) {
    await initNoteImportExecution({
      hb_id: hbId,
      importiterator: {
        index,
        count,
        step,
      },
      skipToNoteImport: true,
      validatedFileKey,
      statusFileKey,
      fileKey,
      formattedFileKey,
      startTimestamp,
      count,
      BuildersApiFunctionArn,
      SearchApiFunctionArn,
      ActivitiesApiFunctionArn,
    });
    return { continue: false, index, count };
  }
  if (index === -1) {
    index = 0;
  } else {
    index += step;
  }

  return {
    index,
    step,
    count,
    continue: index < count,
  };
}
