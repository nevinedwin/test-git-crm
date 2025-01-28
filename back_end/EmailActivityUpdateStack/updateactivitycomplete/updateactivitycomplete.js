/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import {
  getFileFromS3,
  uploadToS3,
} from "../getemailactivities/getemailactivities";

const EMAIL_ACTIVITY_UPDATE_STATUS_COMPLETED = "COMPLETED";
export async function main(event) {
  console.log(`event: ${JSON.stringify(event)}`);
  const {
    statusFileKey,
    hasAfter,
    ExclusiveStartKey,
    activityiterator = {},
  } = event;
  const { index, step = 100 } = activityiterator;

  // Check whether hasAfter and ExclusiveStartKey is null
  // If so, update the status to complete
  if (!hasAfter && !ExclusiveStartKey) {
    // Get the status file from S3 and update the status and error
    const statusFileJSON = await getFileFromS3(statusFileKey);
    console.log(`statusFileJSON: ${JSON.stringify(statusFileJSON)}`);
    // Upload the lead import start status with the getLeads response and the builderId and token used
    const currentDate = new Date().toISOString();
    statusFileJSON.status = EMAIL_ACTIVITY_UPDATE_STATUS_COMPLETED;
    statusFileJSON.mdt = currentDate;
    if (index && step)
      statusFileJSON.msg = `Email activity update completed for a total of ${
        index + step
      } records.`;

    const uploadInitiateStatusFileResp = await uploadToS3(
      statusFileKey,
      statusFileJSON
    );
    console.log(
      `uploadInitiateStatusFileResp: ${JSON.stringify(
        uploadInitiateStatusFileResp
      )}`
    );
  }
  return { ...event };
}
