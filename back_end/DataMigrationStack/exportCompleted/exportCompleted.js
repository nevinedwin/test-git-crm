import "../../NPMLayer/nodejs.zip";

import { Parser } from "json2csv";

import {
  getFileFromS3,
  uploadExportStatusToS3,
  saveExportStatus,
} from "../initExport/initExport";

const STATUS_COMPLETED = "COMPLETED";

const customerFields = [
  "id",
  "first_name",
  "last_name",
  "email",
  "phone",
  "stage",
  "source",
  "influences",
  "grade",
  "contact_method",
  "realtor",
  "desired_features",
  "community_interests",
  "move_in_timeframe",
];

const realtorFields = [
  "id",
  "first_name",
  "last_name",
  "email",
  "phone",
  "agency_team_name",
  "agency_company_name",
  "agency_metros",
  "source",
  "influences",
  "contact_method",
  "agency_broker_fname",
  "agency_broker_lname",
  "agency_broker_email",
  "agency_broker_phone",
  "expertise",
  "specialties",
  "agency_specialties",
  "agency_id",
];

export async function main(event) {
  console.log(`event: ${JSON.stringify(event)}`);
  const {
    statusFileKey,
    dataFileKey,
    statusResId,
    exportFileKey,
    purpose,
    hbId,
  } = event;
  // read the json file and convert it to csv
  // Get the data file from S3
  const dataFileResp = await getFileFromS3(dataFileKey);
  console.log(`dataFileResp: ${JSON.stringify(dataFileResp)}`);
  const dataFileJSON = dataFileResp?.status ? dataFileResp?.data : null;
  if (dataFileJSON) {
    const listData =
      purpose === "exportCustomer"
        ? dataFileJSON?.customers
        : dataFileJSON?.realtors;
    const fields =
      purpose === "exportCustomer" ? customerFields : realtorFields;
    console.log(`listData: ${JSON.stringify(listData)}`);
    console.log(`fields: ${JSON.stringify(fields)}`);
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(listData);
    console.log(`csv: ${JSON.stringify(csv)}`);
    const uploadExportFileResp = await uploadExportStatusToS3(
      csv,
      exportFileKey,
      true
    );
    console.log(
      `uploadExportFileResp: ${JSON.stringify(uploadExportFileResp)}`
    );
  }

  // Get the status file from S3 and update the status and error
  const statusFileResp = await getFileFromS3(statusFileKey);
  console.log(`statusFileResp: ${JSON.stringify(statusFileResp)}`);
  const statusFileJSON = statusFileResp?.status ? statusFileResp?.data : {};
  const currentDate = new Date().toISOString();
  statusFileJSON.status = STATUS_COMPLETED;
  statusFileJSON.mdt = currentDate;
  statusFileJSON.fileKey = exportFileKey;
  statusFileJSON.hbId = hbId;
  // Upload the export builder data error status
  const uploadStatusFileResp = await uploadExportStatusToS3(
    statusFileJSON,
    statusFileKey
  );
  console.log(`uploadStatusFileResp: ${JSON.stringify(uploadStatusFileResp)}`);
  // update the status in DB
  const saveExportStatusResp = await saveExportStatus(
    {
      hbId,
      status: STATUS_COMPLETED,
      mdt: currentDate,
      statusFileKey,
      fileKey: exportFileKey,
    },
    statusResId,
    purpose
  );
  console.log(`saveExportStatusResp: ${JSON.stringify(saveExportStatusResp)}`);

  return { ...event };
}
