import {
    getFileFromS3,
    uploadExportStatusToS3,
    saveExportStatus,
  } from "../initExport/initExport";
  
  const STATUS_FAILED = "FAILED";
  
  export async function main(event) {
    console.log(`event: ${JSON.stringify(event)}`);
    const { statusFileKey, error, statusResId,purpose,hbId } = event;
    // Get the status file from S3 and update the status and error
    const statusFileResp = await getFileFromS3(statusFileKey);
    console.log(`statusFileResp: ${JSON.stringify(statusFileResp)}`);
    const statusFileJSON = statusFileResp?.status ? statusFileResp?.data : {};
    const currentDate = new Date().toISOString();
    statusFileJSON.status = STATUS_FAILED;
    statusFileJSON.mdt = currentDate;
    statusFileJSON.error = error;
    // Upload the export builder data error status
    const uploadStatusFileResp = await uploadExportStatusToS3(
      statusFileJSON,
      statusFileKey
    );
    console.log(`uploadStatusFileResp: ${JSON.stringify(uploadStatusFileResp)}`);
    // update the status in DB
    const saveExportStatusResp = await saveExportStatus(
      {
        status: STATUS_FAILED,
        mdt: currentDate,
        statusFileKey,
        error,
        hbId
      },
      statusResId,
      purpose
    );
    console.log(`saveExportStatusResp: ${JSON.stringify(saveExportStatusResp)}`);
    return { ...event };
  }
  