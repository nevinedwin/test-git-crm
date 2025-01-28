/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import {
  getFileFromS3,
  uploadToS3,
} from "../getemailactivities/getemailactivities";

const EMAIL_ACTIVITY_UPDATE_STATUS_FAILED = "FAILED";
export async function main(event) {
  console.log(`event: ${JSON.stringify(event)}`);
  const { statusFileKey, error } = event;
  // Get the status file from S3 and update the status and error
  let statusFileJSON = await getFileFromS3(statusFileKey);
  console.log(`statusFileJSON: ${JSON.stringify(statusFileJSON)}`);
  const currentDate = new Date().toISOString();
  if (!statusFileJSON?.cdt && statusFileJSON?.statusCode === 403)
    statusFileJSON = { cdt: currentDate };
  statusFileJSON.status = EMAIL_ACTIVITY_UPDATE_STATUS_FAILED;
  statusFileJSON.mdt = currentDate;
  statusFileJSON.error = error;

  const uploadInitiateStatusFileResp = await uploadToS3(
    statusFileKey,
    statusFileJSON
  );
  console.log(
    `uploadInitiateStatusFileResp: ${JSON.stringify(
      uploadInitiateStatusFileResp
    )}`
  );
  return { ...event };
}
