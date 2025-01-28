import "../../NPMLayer/nodejs.zip";
import { v4 as uuidv4 } from "uuid";
import AWS from "aws-sdk";
import { postResources, getRecordByEntity } from "../../FunctionStack/libs/db";

const csvToJSON = require("csvtojson");

const STATUS_LOG_LIMIT = 10;

const s3 = new AWS.S3({ apiVersion: "2006-03-01" });
const { FILE_MANAGER_BUCKET_NAME } = process.env;
const CUSTOMER_FILE_STATUS_PROCESSING = "PROCESSING";
const CUSTOMER_IMPORT_LIMIT = 5000;
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
    `customer_create_status#${hbId}`
  );
  // console.log(`bulkCustomerCreateStatusResp: ${JSON.stringify(bulkCustomerCreateStatusResp)}`);

  const type = `customer_create_status`;
  let statusObj = {};
  if (bulkCustomerCreateStatusResp && bulkCustomerCreateStatusResp.length) {
    // Record exists. Update the status file path in the record
    // Modify the existing record object
    statusObj = { ...bulkCustomerCreateStatusResp[0] };
    statusObj.mdt = Date.now();

    // console.log(`statusFileObject: ${JSON.stringify(statusFileObject)}`);
    if (statusFileObject.status === CUSTOMER_FILE_STATUS_PROCESSING) {
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

    // Allow only the latest 10 items in statusObj.stfiles
    // This is to mitigate the risk of this record in DynamoDB getting bigger in size
    statusObj.stfiles = statusObj.stfiles.sort((a, b) => a.start - b.start);
    const stsfilesLength = statusObj.stfiles.length;
    if (stsfilesLength > STATUS_LOG_LIMIT) {
      statusObj.stfiles.splice(0, stsfilesLength - STATUS_LOG_LIMIT);
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
  s3UpdateOnly = false,
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

  if (s3UpdateOnly) return { status: true };

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
  return createBulkCustomerFileStatus(hbId, statusFileObject);
};
const convertCSVAndValidate = async (data) => {
  const bucketName = FILE_MANAGER_BUCKET_NAME;
  const fileKey = data.fileKey ? data.fileKey : "";
  const validFields = [
    "fname",
    "lname",
    "email",
    "phone",
    "stage",
    "psrc",
    "grade",
    "cntm",
    "infl",
    "inte",
    "desf",
    "desm",
    "type",
    "hb_id",
    "optst",
    "agent",
    "address",
    "reg_date"
  ];
  // Get the customer creation file from S3
  const s3Params = {
    Bucket: bucketName,
    Key: fileKey,
  };
  // Create a read stream of the uploaded csv file
  const getObjectStream = s3.getObject(s3Params).createReadStream();

  // Convert the csv to json
  const customers = await csvToJSON().fromStream(getObjectStream);
  console.log(`customers: ${JSON.stringify(customers)}`);

  const testQuestionKey = /qstn_[0-9]{1,2}/g;
  const testAnswerKey = /optn_[0-9]{1,2}/g;

  const testNoteKey = /note_[0-9]{1,2}/g;
  const testNoteSubjectKey = /sub_[0-9]{1,2}/g;

  const testCobuyerFnameKey = /cobuyer_fname_[0-9]{1,2}/g;
  const testCobuyerLnameKey = /cobuyer_lname_[0-9]{1,2}/g;
  const testCobuyerEmailKey = /cobuyer_email_[0-9]{1,2}/g;
  const testCobuyerPhoneKey = /cobuyer_phone_[0-9]{1,2}/g;
  const testCobuyerCntmKey = /cobuyer_cntm_[0-9]{1,2}/g;
  const testCobuyerInflKey = /cobuyer_infl_[0-9]{1,2}/g;
  const testCobuyerQuestionKey = /cobuyer_qstn_[0-9]{1,2}/g;
  const testCobuyerAnswerKey = /cobuyer_optn_[0-9]{1,2}/g;

  // Check whether any customer exist
  if (customers.length === 0) {
    // No customers found in the request
    return { status: false, error: ["No customers found in CSV"], customers };
  }

  // Validate whether the fields in the converted JSON is valid for a customer
  // Checking only the first customer object since the csv headers will be same for each object
  const fieldErrors = [];
  // console.log(`customers.length: ${customers.length}`);
  for (const key in customers[0]) {
    if (key) {
      // console.log(`key: ${key}`);
      const isKeyAQuestion = testQuestionKey.test(key);
      const isKeyAnAnswer = testAnswerKey.test(key);

      const isKeyANote = testNoteKey.test(key);
      const isKeyASubject = testNoteSubjectKey.test(key);

      const isKeyACobuyerFname = testCobuyerFnameKey.test(key);
      const isKeyACobuyerLname = testCobuyerLnameKey.test(key);
      const isKeyACobuyerEmail = testCobuyerEmailKey.test(key);
      const isKeyACobuyerPhone = testCobuyerPhoneKey.test(key);
      const isKeyACobuyerCntm = testCobuyerCntmKey.test(key);
      const isKeyACobuyerInfl = testCobuyerInflKey.test(key);
      const isKeyACobuyerQuestion = testCobuyerQuestionKey.test(key);
      const isKeyACobuyerAnswer = testCobuyerAnswerKey.test(key);

      console.log(`isKeyACobuyerFname: ${isKeyACobuyerFname}`);
      console.log(`isKeyACobuyerLname: ${isKeyACobuyerLname}`);
      console.log(`isKeyACobuyerEmail: ${isKeyACobuyerEmail}`);
      console.log(`isKeyACobuyerPhone: ${isKeyACobuyerPhone}`);
      console.log(`isKeyACobuyerCntm: ${isKeyACobuyerCntm}`);
      console.log(`isKeyACobuyerInfl: ${isKeyACobuyerInfl}`);
      console.log(`isKeyACobuyerQuestion: ${isKeyACobuyerQuestion}`);
      console.log(`isKeyACobuyerAnswer: ${isKeyACobuyerAnswer}`);

      if (!validFields.includes(key)) {
        // console.log(`In !validFields.includes(key)`);
        // Field not valid
        // Check whether it matches the demographics question or answer key
        // And Check whether it matches the note or subject key
        if (
          !isKeyAQuestion &&
          !isKeyAnAnswer &&
          !isKeyANote &&
          !isKeyASubject &&
          !isKeyACobuyerFname &&
          !isKeyACobuyerLname &&
          !isKeyACobuyerEmail &&
          !isKeyACobuyerPhone &&
          !isKeyACobuyerCntm &&
          !isKeyACobuyerInfl &&
          !isKeyACobuyerQuestion &&
          !isKeyACobuyerAnswer
        ) {
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
  return { status: validationStatus, error: fieldErrors, customers };
};
export async function main(event) {
  let isValidCSV = false;
  let sendResponse;

  try {
    console.log(JSON.stringify(event));
    const {
      fileKey = "",
      hb_id: hbId = "",
      isExternalBulkCustomer = true,
    } = event;
    const statusFileKey = `${fileKey}_response.json`;
    const customersFileKey = `${fileKey}_customers.json`;
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
      customersFileKey,
      startTimestamp: validationStartTimestamp,
    });
    // Update the status of the bulk customer create with PROCESSING status
    await uploadStatusFileAndUpdateDB({
      startTimestamp: validationStartTimestamp,
      status: CUSTOMER_FILE_STATUS_PROCESSING,
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
      customers = [],
    } = await convertCSVAndValidate(event);
    console.log(`status: ${status}`);
    console.log(`error: ${error}`);
    // console.log(`customers: ${JSON.stringify(customers)}`);

    const customersCount = customers?.length || 0;
    if (customersCount === 0) {
      console.log(`Empty request`);
      isValidCSV = false;
      return sendResponse({
        error: [`Empty request`],
      });
    }
    // Check whether the number of customers to import is greater than CUSTOMER_IMPORT_LIMIT.
    // If so, abort the import operation since we limited the import to that number.
    if (customersCount > CUSTOMER_IMPORT_LIMIT) {
      console.log(
        `Request contains more than ${CUSTOMER_IMPORT_LIMIT} customers`
      );
      isValidCSV = false;
      return sendResponse({
        error: [
          `Request contains more than ${CUSTOMER_IMPORT_LIMIT} customers`,
        ],
      });
    }
    // Check whether this is from external API customer import
    // If so, only allow less than or equal to 50 customers to import
    if (!isExternalBulkCustomer && customersCount > 50) {
      console.log(`Request contains more than 50 customers`);
      isValidCSV = false;
      return sendResponse({
        error: [`Request contains more than 50 customers`],
      });
    }
    if (!status) {
      // Validation error occured
      isValidCSV = false;
      return sendResponse({ error });
    }
    isValidCSV = true;
    // Upload the customers to s3
    await uploadToS3(customersFileKey, customers);
    return sendResponse({});
  } catch (error) {
    console.log(`error`);
    console.log(error);
    isValidCSV = false;
    return sendResponse({ error });
  }
}
