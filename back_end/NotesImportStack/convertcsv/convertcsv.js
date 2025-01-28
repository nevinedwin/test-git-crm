import "../../NPMLayer/nodejs.zip";
import { v4 as uuidv4 } from "uuid";
import AWS from "aws-sdk";
import { postResources, getRecordByEntity } from "../../FunctionStack/libs/db";

const csvToJSON = require("csvtojson");

const s3 = new AWS.S3({ apiVersion: "2006-03-01" });
const { FILE_MANAGER_BUCKET_NAME } = process.env;
const NOTES_FILE_STATUS_PROCESSING = "PROCESSING";
const NOTES_IMPORT_LIMIT = 5000;
const updateBulkCustomerCreateStatus = async (statusObj) => {
  const params = {
    TableName: process.env.entitiesTableName,
    Item: statusObj,
  };
  console.log(params);
  const customerFileResp = await postResources(params);
  return customerFileResp;
};
const createBulkCustomerFileStatus = async (hbId, statusFileObject) => {
  /* console.log(
    `In createBulkCustomerFileStatus statusFileObject: ${JSON.stringify(
      statusFileObject
    )}`
  ); */
  // Create/Update the customer bulk creation status record for this home builder
  // First check for existing customer bulk creation status record for this home builder
  const bulkCustomerCreateStatusResp = await getRecordByEntity(
    `note_create_status#${hbId}`
  );
  // console.log(`bulkCustomerCreateStatusResp: ${JSON.stringify(bulkCustomerCreateStatusResp)}`);

  const type = `note_create_status`;
  let statusObj = {};
  if (bulkCustomerCreateStatusResp && bulkCustomerCreateStatusResp.length) {
    // Record exists. Update the status file path in the record
    // Modify the existing record object
    statusObj = { ...bulkCustomerCreateStatusResp[0] };
    statusObj.mdt = Date.now();

    // console.log(`statusFileObject: ${JSON.stringify(statusFileObject)}`);
    if (statusFileObject.status === NOTES_FILE_STATUS_PROCESSING) {
      // Push the PROCESSING status
      statusObj.stfiles.push(statusFileObject);
    } else {
      // Check for the PROCESSING status object and update for COMPLETED or FAILED status
      statusObj.stfiles = statusObj.stfiles.map((stsfile) => {
        // console.log(`stsfile: ${JSON.stringify(stsfile)}`);
        if (stsfile.csv === statusFileObject.csv) {
          return statusFileObject;
        }

        return stsfile;
      });
      // console.log(`statusObj.stfiles: ${JSON.stringify(statusObj.stfiles)}`);
    }
  } else {
    // Record doesn't exist. So create a new record with the path to the status file in s3
    const creationDate = Date.now();
    statusObj = {
      id: uuidv4(),
      entity: `${type}#${hbId}`,
      type,
      cdt: creationDate,
      mdt: creationDate,
      stfiles: [statusFileObject],
      hb_id: hbId,
    };
  }
  const createBulkCustomerFileStatusResp = await updateBulkCustomerCreateStatus(
    statusObj
  );
  return createBulkCustomerFileStatusResp;
};
const uploadFileToS3Generic = async (fileUploadParams) => {
  // Upload status file to s3
  // console.log('fileUploadParams: ', fileUploadParams);
  const fileUploadResp = await s3.upload(fileUploadParams).promise();
  // console.log(`fileUploadResp: ${JSON.stringify(fileUploadResp)}`);
  return fileUploadResp;
};
export const uploadToS3 = async (statusFileKey, statusFileContent) => {
  let response;
  try {
    const statusFileUploadParams = {
      Bucket: FILE_MANAGER_BUCKET_NAME,
      Key: statusFileKey,
      Body: JSON.stringify(statusFileContent, null, 4),
    };
    response = await uploadFileToS3Generic(statusFileUploadParams);
  } catch (error) {
    console.log("Error occured in uploadToS3");
    console.log(error);
    response = error;
  }
  return response;
};
export const uploadStatusFileAndUpdateDB = async ({
  startTimestamp,
  status,
  resp,
  error = [],
  statusFileKey,
  fileKey,
  formattedFileKey,
  hbId,
  field,
}) => {
  const endTimestamp = new Date().toISOString();
  const statusFileContent = {
    status,
    start: startTimestamp,
    end: endTimestamp,
    response: resp,
    error,
    field,
  };
  await uploadToS3(statusFileKey, statusFileContent);

  if (typeof error === "string") error = [error];
  const statusFileObject = {
    status,
    start: startTimestamp,
    end: endTimestamp,
    csv: fileKey,
    formatted: formattedFileKey,
    response: statusFileKey,
  };
  if (error && error?.length > 5)
    statusFileObject.error = [
      "Please refer to the status file for error details.",
    ];
  else {
    statusFileObject.error = error;
    statusFileObject.field = field;
  }
  await createBulkCustomerFileStatus(hbId, statusFileObject);
};
const convertCSVAndValidate = async (data) => {
  const bucketName = FILE_MANAGER_BUCKET_NAME;
  const fileKey = data.fileKey ? data.fileKey : "";
  const validFields = ["email"];
  // Get the note creation file from S3
  const s3Params = {
    Bucket: bucketName,
    Key: fileKey,
  };
  // Create a read stream of the uploaded csv file
  const getObjectStream = s3.getObject(s3Params).createReadStream();

  // Convert the csv to json
  const notes = await csvToJSON().fromStream(getObjectStream);
  // console.log(`notes: ${JSON.stringify(notes)}`);

  const testNoteKey = /note_[0-9]{1,2}/g;
  const testNoteSubjectKey = /sub_[0-9]{1,2}/g;

  // Check whether any note exist
  if (notes.length === 0) {
    // No notes found in the request
    return { status: false, error: ["No notes found in CSV"], notes };
  }

  // Validate whether the fields in the converted JSON is valid for a note
  // Checking only the first note object since the csv headers will be same for each object
  const fieldErrors = [];
  // console.log(`notes.length: ${notes.length}`);
  for (const key in notes[0]) {
    if (key) {
      // console.log(`key: ${key}`);
      const isKeyANote = testNoteKey.test(key);
      const isKeyASubject = testNoteSubjectKey.test(key);

      /* console.log(`isKeyAQuestion: ${isKeyAQuestion}`);
      console.log(`isKeyAnAnswer: ${isKeyAnAnswer}`);

      console.log(`isKeyANote: ${isKeyANote}`);
      console.log(`isKeyASubject: ${isKeyASubject}`); */

      if (!validFields.includes(key)) {
        // console.log(`In !validFields.includes(key)`);
        // Field not valid
        // Check whether it matches the demographics question or answer key
        // And Check whether it matches the note or subject key
        if (!isKeyANote && !isKeyASubject) {
          // console.log(`In !isKeyAQuestion && !isKeyAnAnswer`);
          fieldErrors.push(`${key} field is invalid`);
        }
      }
    }
  }
  // console.log(`fieldErrors: ${fieldErrors}`);

  // True if valid. False if invalid.
  const validationStatus = !(fieldErrors && fieldErrors.length);
  // console.log(`validationStatus: ${validationStatus}`);
  return { status: validationStatus, error: fieldErrors, notes };
};
export async function main(event) {
  let isValidCSV = false;
  let sendResponse;

  try {
    console.log(JSON.stringify(event));
    const { fileKey = "", hb_id: hbId = "" } = event;
    const statusFileKey = `${fileKey}_response.json`;
    const notesFileKey = `${fileKey}_notes.json`;
    const formattedFileKey = `${fileKey}_formatted.json`;
    // Get, convert and validate the csv file
    const validationStartTimestamp = new Date().toISOString();
    sendResponse = ({ error = null }) => ({
      ...event,
      statusFileKey,
      fileKey,
      formattedFileKey,
      hbId,
      isValidCSV,
      error,
      notesFileKey,
      startTimestamp: validationStartTimestamp,
    });
    // Update the status of the bulk customer create with PROCESSING status
    await uploadStatusFileAndUpdateDB({
      startTimestamp: validationStartTimestamp,
      status: NOTES_FILE_STATUS_PROCESSING,
      resp: [],
      error: [],
      statusFileKey,
      fileKey,
      formattedFileKey,
      hbId,
    });

    // Do convert csv and validation
    const {
      status = false,
      error = null,
      notes = [],
    } = await convertCSVAndValidate(event);
    console.log(`status: ${status}`);
    console.log(`error: ${error}`);
    // console.log(`notes: ${JSON.stringify(notes)}`);

    const noteCount = notes?.length || 0;
    if (noteCount === 0) {
      console.log(`Empty request`);
      isValidCSV = false;
      return sendResponse({
        error: [`Empty request`],
      });
    }
    // Check whether the number of notes to import is greater than NOTES_IMPORT_LIMIT.
    // If so, abort the import operation since we limited the import to that number.
    if (noteCount > NOTES_IMPORT_LIMIT) {
      console.log(`Request contains more than ${NOTES_IMPORT_LIMIT} notes`);
      isValidCSV = false;
      return sendResponse({
        error: [`Request contains more than ${NOTES_IMPORT_LIMIT} notes`],
      });
    }
    if (!status) {
      // Validation error occured
      isValidCSV = false;
      return sendResponse({ error });
    }
    isValidCSV = true;
    // Upload the notes to s3
    await uploadToS3(notesFileKey, notes);
    return sendResponse({});
  } catch (error) {
    console.log(`error`);
    console.log(error);
    isValidCSV = false;
    return sendResponse({ error });
  }
}
