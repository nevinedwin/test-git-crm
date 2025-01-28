/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
// import { getFileFromS3 } from "../processleads/processleads";
// import { uploadLeadsToS3 } from "../getleads/getleads";

// const CUSTOMER_FILE_STATUS_FAILED = "FAILED";
export async function main(event) {
  console.log(`event: ${JSON.stringify(event)}`);
  /* const { statusFileKey, error } = event;
  // Get the status file from S3 and update the status and error
  const statusFileJSON = await getFileFromS3(statusFileKey);
  console.log(`statusFileJSON: ${JSON.stringify(statusFileJSON)}`);
  // Upload the lead import start status with the getLeads response and the builderId and token used
  const currentDate = new Date().toISOString();
  statusFileJSON.status = CUSTOMER_FILE_STATUS_FAILED;
  statusFileJSON.mdt = currentDate;
  statusFileJSON.error = error;

  const uploadInitiateStatusFileResp = await uploadLeadsToS3(
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
  ); */
  return { ...event };
}
