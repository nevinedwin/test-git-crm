import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import { getRecordByIdAndEntity, postResources } from "../../../libs/db";
import { elasticExecuteQuery } from "../../../search/search";

const STATUS_PROCESSING = "PROCESSING";
const { FILE_MANAGER_BUCKET_NAME } = process.env;
const s3 = new AWS.S3({ apiVersion: "2006-03-01" });

// Delete Realtor From Customer - DRFC

export const uploadDRFCStatusToS3 = async (data, fileKey) => {
  try {
    const params = {
      Bucket: FILE_MANAGER_BUCKET_NAME,
      Key: `${fileKey}`,
      Body: JSON.stringify(data),
    };
    console.log(`Params: ${JSON.stringify(params)}`);
    console.log(`Params data: ${JSON.stringify(data)}`);
    const fileUploadResp = await s3.upload(params).promise();
    console.log(`fileUploadResp: ${JSON.stringify(fileUploadResp)}`);
    return { status: true, fileUploadResp };
  } catch (error) {
    console.log(`error: ${JSON.stringify(error)}`);
    return { status: false, error: error.message };
  }
};

export const updateDRFCStatus = async (statusObj) => {
  try {
    const params = {
      TableName: process.env.entitiesTableName,
      Item: statusObj,
    };
    console.log(params);
    const fileUploadDBResp = await postResources(params, true);
    return fileUploadDBResp;
  } catch (error) {
    console.log(`error: ${JSON.stringify(error.message)}`);
    console.log(`error: ${JSON.stringify(error.stack)}`);
  };
}

export const getFileFromS3 = async (fileKey) => {
  try {
    const s3Params = {
      Bucket: FILE_MANAGER_BUCKET_NAME,
      Key: fileKey,
    };
    console.log(`s3Params: ${JSON.stringify(s3Params)}`);
    const getObjectResp = await s3.getObject(s3Params).promise();
    console.log(`getObjectResp: ${JSON.stringify(getObjectResp)}`);
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

export const saveDRFCStatus = async (statusFileObject, id = null) => {
  try {
    console.log(`StatusFileObject: ${JSON.stringify(statusFileObject)}`);
    console.log(`id: ${id}`);
    const { hbId, rltrId } = statusFileObject;
    const enitityType = `delete_realtor_from_customer#${hbId}#${rltrId}`;
    console.log(`EntityType: ${enitityType}`);
    let dataExportStatusResp;
    if (id) {
      dataExportStatusResp = await getRecordByIdAndEntity(id, enitityType);
      console.log(
        `dataExportStatusResp: ${JSON.stringify(dataExportStatusResp)}`
      );
    }

    let statusObj = {};
    if (dataExportStatusResp && dataExportStatusResp.length) {
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
      const creationDate = Date.now();
      statusObj = {
        id: uuidv4(),
        entity: enitityType,
        cdt: creationDate,
        mdt: creationDate,
        stso: statusFileObject,
        hbId,
      };
    }
    const saveDRFCStatusResp = await updateDRFCStatus(statusObj);
    console.log(`saveDRFCStatusResp: ${JSON.stringify(saveDRFCStatusResp)}`);
    return { status: true, data: saveDRFCStatusResp };
  } catch (error) {
    console.log(`error: ${JSON.stringify(error)}`);
    return { status: false, error: error.message };
  }
};

export const getCount = async (hbId, rltrId) => {
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
                  "entity.keyword": `customer#${hbId}`,
                },
              },
              {
                match: {
                  "hb_id.keyword": hbId,
                },
              },
              {
                bool: {
                  should: [
                    {
                      match: {
                        "rltr.data.keyword": rltrId,
                      },
                    },
                    {
                      match: {
                        "rltr.id.keyword": rltrId,
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    };

    const count = await elasticExecuteQuery(countQuery, true);
    console.log(`count==>`, count);


    if (!count.status) {
      return {
        satus: false,
        error: "Customer count fetching failed",
        count: 0,
      };
    }

    return {
      status: true,
      error: "",
      count: count?.body?.count || 0,
    };
  } catch (error) {
    console.log(`getCustomerCount error: ${JSON.stringify(error.stack)}`);
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
    error: "",
    status: false,
  };

  try {
    console.log(`event: ${JSON.stringify(event)}`);
    const { hbId = "", purpose = "", rltrId = "" } = event;
    if (!hbId || !rltrId) {
      console.log("hbId and rltrId is required");
      sendResponse.status = false;
      sendResponse.error = `${!hbId ? "hb_id" : "rltrId"} is required`;
      return sendResponse;
    }
    // upload the status of customer with the given realtor fetch status

    console.log(`======>>>>>>>>>>> if exit`);
    const currentDate = new Date().toISOString();
    let statusFileKey = `delete_realtor_from_customer/${currentDate}_${hbId}_${rltrId}_status.json`;
    console.log(`statusFileKey: ${JSON.stringify(statusFileKey)}`);
    let dataFileKey = `delete_realtor_from_customer/${currentDate}_${hbId}_${rltrId}_data.json`;

    let statusResId = "";

    const statusObj = {
      hbId,
      rltrId,
      status: STATUS_PROCESSING,
      cdt: currentDate,
      mdt: currentDate,
      statusFileKey,
    };

    console.log(`statusObj: ${JSON.stringify(statusObj)}`);
    const uploadIntiateStatusFieldResp = await uploadDRFCStatusToS3(
      statusObj,
      statusFileKey
    );
    console.log(
      `uploadIntiateStatusFieldResp: ${JSON.stringify(
        uploadIntiateStatusFieldResp
      )}`
    );

    if (!uploadIntiateStatusFieldResp.status) {
      sendResponse.status = false;
      sendResponse.error = uploadIntiateStatusFieldResp.error;
      return sendResponse;
    }

    const uploadRltrIdFileResponse = await uploadDRFCStatusToS3(
      [],
      dataFileKey
    );
    console.log(
      `uploadRltrIdFileResponse: ${JSON.stringify(uploadRltrIdFileResponse)}`
    );

    if (!uploadRltrIdFileResponse.status) {
      sendResponse.status = false;
      sendResponse.error = uploadRltrIdFileResponse.error;
      return sendResponse;
    }

    // create status Object in DB
    const saveDRFCStatusResp = await saveDRFCStatus(statusObj, null);

    if (!saveDRFCStatusResp.status) {
      sendResponse.status = false;
      sendResponse.error = saveDRFCStatusResp.error;
      return sendResponse;
    }
    console.log(`saveDRFCStatusResp: ${JSON.stringify(saveDRFCStatusResp)}`);
    statusResId = saveDRFCStatusResp?.data?.status
      ? saveDRFCStatusResp?.data?.item?.id
      : "";
    console.log(`statusResId: ${statusResId}`);

    // get Total customer Count
    const countResp = await getCount(hbId, rltrId);
    console.log(`countResp: ${JSON.stringify(countResp)}`);
    if (!countResp.status) {
      sendResponse.status = false;
      sendResponse.error = countResp.error;
      return sendResponse;
    }

    sendResponse.status = true;
    sendResponse.count = countResp.count;
    sendResponse.statusResId = statusResId;
    sendResponse.dataFileKey = dataFileKey;
    sendResponse.statusFileKey = statusFileKey;
    console.log(`sendResponse: ${JSON.stringify(sendResponse)}`);
    return sendResponse;
  } catch (error) {
    sendResponse.status = false;
    sendResponse.error = error.message;
    return sendResponse;
  }
}
