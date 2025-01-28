import "../../NPMLayer/nodejs.zip";
import {
  UPDATE_ENDPOINT_FILE_STATUS_FAILED,
  getFileFromS3,
  uploadToS3,
} from "../getcustomers/getcustomers";

export async function main(event) {
  console.log(`event: ${JSON.stringify(event)}`);
  const { statusFileKey, error,purpose } = event;
  if(purpose === "metroUpdation")  return { ...event };
  // Get the status file from S3 and update the status and error
  const statusFileJSON = await getFileFromS3(statusFileKey);
  console.log(`statusFileJSON: ${JSON.stringify(statusFileJSON)}`);
  // Upload the lead import start status with the getLeads response and the builderId and token used
  const currentDate = new Date().toISOString();
  statusFileJSON.status = UPDATE_ENDPOINT_FILE_STATUS_FAILED;
  statusFileJSON.mdt = currentDate;
  statusFileJSON.error = error;

  const uploadInitiateStatusFileResp = await uploadToS3(
    "",
    statusFileJSON,
    true,
    statusFileKey,
    currentDate
  );
  console.log(
    `uploadInitiateStatusFileResp: ${JSON.stringify(
      uploadInitiateStatusFileResp
    )}`
  );
  return { ...event };
}
