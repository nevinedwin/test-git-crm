import {
  getFileFromS3,
  saveDRFCStatus,
  uploadDRFCStatusToS3,
} from "../intiRemoveRealtor/initRemoveRealtor";

const STATUS_FAILED = "FAILED";

export async function main(event) {
  console.log(`event: ${JSON.stringify(event)}`);
  const { statusFileKey, error, statusResId, purpose, hbId, rltrId } = event;
  // Get the status file from S3 and update the status and error
  const statusFileResp = await getFileFromS3(statusFileKey);
  console.log(`statusFileResp: ${JSON.stringify(statusFileResp)}`);
  const statusFileJSON = statusFileResp?.status ? statusFileResp?.data : {};
  const currentDate = new Date().toISOString();
  statusFileJSON.status = STATUS_FAILED;
  statusFileJSON.mdt = currentDate;
  statusFileJSON.error = error;
  // Upload the export builder data error status
  const uploadStatusFileResp = await uploadDRFCStatusToS3(
    statusFileJSON,
    statusFileKey
  );
  console.log(`uploadStatusFileResp: ${JSON.stringify(uploadStatusFileResp)}`);
  // update the status in DB
  const saveDRFCStatusResp = await saveDRFCStatus(
    {
      status: STATUS_FAILED,
      mdt: currentDate,
      statusFileKey,
      error,
      hbId,
      rltrId
    },
    statusResId,
    purpose
  );
  console.log(`saveDRFCStatusResp: ${JSON.stringify(saveDRFCStatusResp)}`);
  return { ...event };
}
