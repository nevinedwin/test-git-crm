import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import { getEntityListsForImport } from "../importinit/importinit";
import { elasticExecuteQuery } from "../../FunctionStack/search/search";
import {
  getRecordByIdAndEntity,
  postResources,
} from "../../FunctionStack/libs/db";

const STATUS_PROCESSING = "PROCESSING";
const { FILE_MANAGER_BUCKET_NAME } = process.env;
const s3 = new AWS.S3({ apiVersion: "2006-03-01" });

export const uploadExportStatusToS3 = async (
  exportedData,
  fileKey,
  isCSV = false
) => {
  try {
    const params = {
      Bucket: FILE_MANAGER_BUCKET_NAME,
      Key: `${fileKey}`,
      Body: isCSV ? exportedData : JSON.stringify(exportedData, null, 4),
    };
    console.log(`Params: ${JSON.stringify(params)}`);
    const fileUploadResp = await s3.upload(params).promise();
    console.log(`fileUploadResp: ${JSON.stringify(fileUploadResp)}`);
    return { status: true, fileUploadResp };
  } catch (error) {
    console.log(`error: ${JSON.stringify(error)}`);
    return { status: false, error: error.message };
  }
};

export const getFileFromS3 = async (fileKey) => {
  const s3Params = {
    Bucket: FILE_MANAGER_BUCKET_NAME,
    Key: fileKey,
  };
  try {
    const getObjectResp = await s3.getObject(s3Params).promise();
    const exportStatus =
      getObjectResp && getObjectResp.Body
        ? JSON.parse(Buffer.from(getObjectResp.Body))
        : [];
    return { status: true, data: exportStatus };
  } catch (error) {
    console.log(`error`);
    console.log(error);
    return { status: false, error };
  }
};

const updateExportStatus = async (statusObj) => {
  const params = {
    TableName: process.env.entitiesTableName,
    Item: statusObj,
  };
  console.log(params);
  const customerFileResp = await postResources(params, true);
  return customerFileResp;
};

export const saveExportStatus = async (
  statusFileObject,
  id = null,
  purpose
) => {
  try {
    console.log(`statusFileObject: ${JSON.stringify(statusFileObject)}`);
    console.log(`id: ${id}`);
    const { hbId } = statusFileObject;
    const type =
      purpose === "exportCustomer"
        ? "customer_export_status"
        : "realtor_export_status";
    const entityType = `${type}#${hbId}`;
    let dataExportStatusResp;
    if (id) {
      // Create/Update the builder data export status record for this home builder
      // First check for existing builder data export status record for this home builder
      dataExportStatusResp = await getRecordByIdAndEntity(id, entityType);
      console.log(
        `dataExportStatusResp: ${JSON.stringify(dataExportStatusResp)}`
      );
    }

    let statusObj = {};
    if (dataExportStatusResp && dataExportStatusResp.length) {
      // Record exists. Update the status object path in the record
      // Modify the existing record object
      statusObj = { ...dataExportStatusResp[0] };
      console.log(`statusObj: ${JSON.stringify(statusObj)}`);
      statusObj.mdt = Date.now();
      if (statusObj.stso) {
        statusObj.stso = { ...statusObj.stso, ...statusFileObject };
      } else {
        statusObj.stso = statusFileObject;
      }
      console.log(`statusObj: ${JSON.stringify(statusObj)}`);
    } else {
      // Record doesn't exist. So create a new record with the status object in the db
      const creationDate = Date.now();
      statusObj = {
        id: uuidv4(),
        entity: entityType,
        type,
        cdt: creationDate,
        mdt: creationDate,
        stso: statusFileObject,
        hbId,
      };
    }
    const saveExportStatusResp = await updateExportStatus(statusObj);
    console.log(
      `saveExportStatusResp: ${JSON.stringify(saveExportStatusResp)}`
    );
    return { status: true, data: saveExportStatusResp };
  } catch (error) {
    console.log(`error: ${JSON.stringify(error)}`);
    return { status: false, error: error.message };
  }
};

const getCount = async (hbId, purpose) => {
  try {
    const countQuery = {
      httpMethod: "POST",
      requestPath: "/_count",
      payload: {
        query: {
          bool: {
            must: [
              {
                match: {
                  "entity.keyword":
                    purpose === "exportCustomer"
                      ? `customer#${hbId}`
                      : `realtor#${hbId}`,
                },
              },
            ],
          },
        },
      },
    };

    const count = await elasticExecuteQuery(countQuery, true);

    console.log("Count==>", count);

    if (!count.status) {
      return {
        status: false,
        error: "Customer count fetching Failed",
        count: 0,
      };
    }
    return {
      status: true,
      error: "",
      count: count?.body?.count || 0,
    };
  } catch (error) {
    console.log(`getcustomerCount error : ${JSON.stringify(error.stack)}`);
    return {
      status: false,
      count: 0,
      error: error.message,
    };
  }
};

export async function main(event) {
  const sendResponse = {
    ...event,
    status: false,
    error: "",
    count: 0,
  };
  try {
    console.log(JSON.stringify(event));
    const { hbId = "", purpose = "" } = event;
    if (!hbId) {
      sendResponse.status = false;
      sendResponse.error = "hb_id is required";
      return sendResponse;
    }
    // Upload the export customer data start status
    const currentDate = new Date().toISOString();
    let statusFileKey = "";
    let dataFileKey = "";
    let exportFileKey = "";
    if (purpose === "exportCustomer") {
      statusFileKey = `customer_exports/${currentDate}_${hbId}_status.json`;
      dataFileKey = `customer_exports/${currentDate}_${hbId}_data.json`;
      exportFileKey = `customer_exports/${currentDate}_${hbId}_export.csv`;
    } else {
      statusFileKey = `realtor_exports/${currentDate}_${hbId}_status.json`;
      dataFileKey = `realtor_exports/${currentDate}_${hbId}_data.json`;
      exportFileKey = `realtor_exports/${currentDate}_${hbId}_export.csv`;
    }

    let statusResId = "";
    const statusObj = {
      hbId,
      status: STATUS_PROCESSING,
      cdt: currentDate,
      mdt: currentDate,
      statusFileKey,
    };
    const uploadInitiateStatusFileResp = await uploadExportStatusToS3(
      statusObj,
      statusFileKey
    );
    if (!uploadInitiateStatusFileResp.status) {
      sendResponse.status = false;
      sendResponse.error = uploadInitiateStatusFileResp.error;
      return sendResponse;
    }
    // Create status object in the DB
    const saveExportStatusResp = await saveExportStatus(
      statusObj,
      null,
      purpose
    );

    if (!saveExportStatusResp.status) {
      sendResponse.status = false;
      sendResponse.error = saveExportStatusResp.error;
      return sendResponse;
    }

    statusResId = saveExportStatusResp?.data?.status
      ? saveExportStatusResp?.data?.item?.id
      : "";
    console.log(`statusResId: ${statusResId}`);

    // get the total count
    const countResp = await getCount(hbId, purpose);

    if (!countResp.status) {
      sendResponse.status = false;
      sendResponse.error = countResp.error;
      return sendResponse;
    }

    // Get the data for replacing the ids
    const entityListResp = await getEntityListsForImport(hbId, true);
    console.log(`entityListResp: ${JSON.stringify(entityListResp)}`);
    const { nameIdMappedList } = entityListResp;
    console.log(`nameIdMappedList: ${JSON.stringify(nameIdMappedList)}`);

    const statusParam =
      purpose === "exportCustomer"
        ? {
            nameIdMappedList,
            customers: [],
          }
        : {
            nameIdMappedList,
            realtors: [],
          };
    const uploadDataFileResp = await uploadExportStatusToS3(
      statusParam,
      dataFileKey
    );
    if (!uploadDataFileResp.status) {
      sendResponse.status = false;
      sendResponse.error = uploadDataFileResp.error;
      return sendResponse;
    }

    sendResponse.status = !!countResp.count;
    sendResponse.count = countResp.count;
    sendResponse.statusResId = statusResId;
    sendResponse.dataFileKey = dataFileKey;
    sendResponse.statusFileKey = statusFileKey;
    sendResponse.exportFileKey = exportFileKey;
    return sendResponse;
  } catch (error) {
    sendResponse.status = false;
    sendResponse.error = error.message;
    return sendResponse;
  }
}
