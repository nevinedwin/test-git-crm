/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import { getFileFromS3 } from "../processleads/processleads";
import { uploadLeadsToS3 } from "../getleads/getleads";

const CUSTOMER_FILE_STATUS_COMPLETED = "COMPLETED";
export async function main(event) {
  console.log(`event: ${JSON.stringify(event)}`);
  const { statusFileKey, resp } = event;
  console.log(`resp: ${JSON.stringify(resp)}`);
  const sortedResp = resp.sort((a, b) => {
    if (a.time > b.time) return 1;
    if (b.time > a.time) return -1;
    return 0;
  });
  console.log(`sortedResp: ${JSON.stringify(sortedResp)}`);
  // Get the status file from S3 and update the status and error
  const statusFileJSON = await getFileFromS3(statusFileKey);
  console.log(`statusFileJSON: ${JSON.stringify(statusFileJSON)}`);
  // Upload the lead import start status with the getLeads response and the builderId and token used
  const currentDate = new Date().toISOString();
  statusFileJSON.status = CUSTOMER_FILE_STATUS_COMPLETED;
  statusFileJSON.mdt = currentDate;
  statusFileJSON.lastProcessedLeadId =
    sortedResp[sortedResp.length - 1].lastProcessedLeadId;
  console.log(
    `statusFileJSON["lastProcessedLeadId"]: ${statusFileJSON.lastProcessedLeadId}`
  );

  const uploadInitiateStatusFileResp = await uploadLeadsToS3({
    rnstr: "",
    leads: statusFileJSON,
    isStatus: true,
    statusFileKey,
    timestamp: currentDate,
  });
  console.log(
    `uploadInitiateStatusFileResp: ${JSON.stringify(
      uploadInitiateStatusFileResp
    )}`
  );
  return { ...event };
}
