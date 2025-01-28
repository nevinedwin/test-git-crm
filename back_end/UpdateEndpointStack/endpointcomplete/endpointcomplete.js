import "../../NPMLayer/nodejs.zip";
import {
  UPDATE_ENDPOINT_STATUS_COMPLETED,
  getFileFromS3,
  uploadToS3,
} from "../getcustomers/getcustomers";

export async function main(event) {
  console.log(`event: ${JSON.stringify(event)}`);
  const { statusFileKey, hasAfter = false, ExclusiveStartKey = null,purpose } = event;
  if(purpose === "metroUpdation")  return { ...event };
  // Check whether all the UpdateEndpoint processing iterations have complated
  // If so, update the status to complete
  if (!hasAfter && !ExclusiveStartKey) {
    // Get the status file from S3 and update the status and error
    const statusFileJSON = await getFileFromS3(statusFileKey);
    console.log(`statusFileJSON: ${JSON.stringify(statusFileJSON)}`);
    // Upload the lead import start status with the getLeads response and the builderId and token used
    const currentDate = new Date().toISOString();
    statusFileJSON.status = UPDATE_ENDPOINT_STATUS_COMPLETED;
    statusFileJSON.mdt = currentDate;
    statusFileJSON.msg = `Update Endpoint completed.`;

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
  }
  return { ...event };
}
