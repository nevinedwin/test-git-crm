import { getFileFromS3, saveDRFCStatus, uploadDRFCStatusToS3 } from "../intiRemoveRealtor/initRemoveRealtor";


const STATUS_COMPLETED = 'COMPLETED';

export async function main(event) {
  console.log(`event: ${event}`);
  const {
    statusFileKey,
    dataFileKey,
    statusResId,
    purpose,
    hbId,
    rltrId
  } = event;
  // Get the status file from S3 and update the status and error
  const statusFileResp = await getFileFromS3(statusFileKey);
  console.log(`statusFileResp: ${JSON.stringify(statusFileResp)}`);
  const statusFileJSON = statusFileResp?.status ? statusFileResp?.data : {};
  const currentDate = new Date().toISOString();
  statusFileJSON.status = STATUS_COMPLETED;
  statusFileJSON.mdt = currentDate;
  statusFileJSON.statusFileKey = statusFileKey;
  statusFileJSON.hbId = hbId;
  statusFileJSON.rltrId = rltrId;

  const uploadStatusFileResp = await uploadDRFCStatusToS3(statusFileJSON, statusFileKey);
  console.log(`uploadStatusFileResp: ${JSON.stringify(uploadStatusFileResp)}`);

  // update the status in DB
  const saveExportStatusResp = await saveDRFCStatus(
    {
      hbId,
      rltrId,
      status: STATUS_COMPLETED,
      mdt: currentDate,
      statusFileKey,
    },
    statusResId
  );
  console.log(`saveExportStatusResp: ${JSON.stringify(saveExportStatusResp)}`);
  return {...event};
}
