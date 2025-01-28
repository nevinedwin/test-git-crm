/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import {
  uploadImportExportStatusToS3,
  getFileFromS3,
  saveBuilderImportExportStatus,
} from "../exportentities/exportentities";

const CUSTOMER_FILE_STATUS_COMPLETED = "COMPLETED";
export async function main(event) {
  console.log(`event: ${JSON.stringify(event)}`);
  const { statusFileKey, statusResId, importComplete = null, fileKey } = event;
  // Get the status file from S3 and update the status and error
  const statusFileResp = await getFileFromS3(statusFileKey);
  console.log(`statusFileResp: ${JSON.stringify(statusFileResp)}`);
  const statusFileJSON = statusFileResp?.status ? statusFileResp?.data : {};
  // Upload the lead import start status with the getLeads response and the builderId and token used
  const currentDate = new Date().toISOString();
  statusFileJSON.status = CUSTOMER_FILE_STATUS_COMPLETED;
  statusFileJSON.mdt = currentDate;
  statusFileJSON.statusFileKey = statusFileKey;
  statusFileJSON.fileKey = fileKey;

  // Upload the export builder data success status
  const uploadInitiateStatusFileResp = await uploadImportExportStatusToS3(
    statusFileJSON,
    statusFileKey
  );
  console.log(
    `uploadInitiateStatusFileResp: ${JSON.stringify(
      uploadInitiateStatusFileResp
    )}`
  );

  // Update status object in the DB
  const saveBuilderImportExportStatusResp = await saveBuilderImportExportStatus(
    importComplete
      ? {
          status: CUSTOMER_FILE_STATUS_COMPLETED,
          mdt: currentDate,
          statusFileKey,
          fileKey,
        }
      : statusFileJSON,
    statusResId,
    !!importComplete
  );
  console.log(
    `saveBuilderImportExportStatusResp: ${JSON.stringify(
      saveBuilderImportExportStatusResp
    )}`
  );
  return { ...event };
}
