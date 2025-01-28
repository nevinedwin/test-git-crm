import AWS from "aws-sdk";
import { elasticExecuteQuery } from "../../FunctionStack/search/search";
import { doPaginatedQueryEllastic } from "../../FunctionStack/libs/db";

const { FILE_MANAGER_BUCKET_NAME } = process.env;
const s3 = new AWS.S3({ apiVersion: "2006-03-01" });

export const uploadDataToS3 = async (data, fileKey) => {
  try {
    const params = {
      Bucket: FILE_MANAGER_BUCKET_NAME,
      Key: `${fileKey}`,
      Body: JSON.stringify(data)
    };
    console.log(`Params: ${JSON.stringify(params)}`);
    const fileUploadResp = await s3.upload(params).promise();
    console.log(`fileUploadResp: ${JSON.stringify(fileUploadResp)}`);
    return { status: true, data: fileUploadResp };
  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`);
    return { status: false, error: error.message };
  };
};

export const getFileFromS3 = async (fileKey) => {
  try {
    const s3Params = {
      Bucket: FILE_MANAGER_BUCKET_NAME,
      Key: fileKey
    };
    console.log(`s3Params: ${JSON.stringify(s3Params)}`);
    const getObjectResp = await s3.getObject(s3Params).promise();
    console.log(`getObjectResp: ${JSON.stringify(getObjectResp)}`);
    const respBody = JSON.parse(Buffer.from(getObjectResp?.Body)) ?? [];
    return { status: true, data: respBody }
  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`);
    return { status: false, error: error.message };
  }
}

export const getCount = async ({ hbId, type, fieldId, field }) => {
  try {
    const customQuery = [
      {
        match: {
          "entity.keyword": `${type}#${hbId}`
        }
      }
    ]
    if (field === "rltr") {
      customQuery.push({
        bool: {
          should: [
            {
              match: {
                "rltr.data.keyword": fieldId,
              },
            },
            {
              match: {
                "rltr.id.keyword": fieldId,
              },
            },
          ]
        }
      });
    } else {
      customQuery.push({
        match: {
          [`${field}.keyword`]: fieldId
        }
      });
    }

    const fetchData = await doPaginatedQueryEllastic({
      hb_id: hbId,
      isCustomParam: true,
      customParams: customQuery
    })

    console.log(`fetchData: ${JSON.stringify(fetchData)}`);

    return { status: true, count: fetchData.length || 0, data: fetchData };

  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`);
    return { status: false, count: 0, error: error.message };
  }
}

export const main = async (event) => {
  let sendResponse = {
    ...event,
    status: false
  };

  try {
    console.log(`Event: ${JSON.stringify(event)}`);
    const { hbId = "", field = "", fieldId = "", type = "" } = event;
    if (!hbId || !fieldId) throw `Missing value for ${!hbId ? "hbId" : "fieldId"}`

    if (!event.dataFileKey) {
      const dataFileKey = `delete_profile_data/${hbId}_${field}_${type}_data.json`;
      // Get Total count
      const fetchDataResp = await getCount({ hbId, fieldId, field, type });
      console.log(`fetchDataResp: ${JSON.stringify(fetchDataResp)}`);

      if (!fetchDataResp.status) throw fetchDataResp.error;

      const uploadDataToS3Resp = await uploadDataToS3(fetchDataResp.data, dataFileKey);
      console.log(`uploadDataToS3Resp: ${JSON.stringify(uploadDataToS3Resp)}`);

      if (!uploadDataToS3Resp.status) throw uploadDataToS3Resp.error;

      sendResponse = {
        ...sendResponse,
        status: true,
        dataFileKey,
        count: fetchDataResp.count,
        hasCount: fetchDataResp.count !== 0
      };
    };
  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`);
    sendResponse = {
      ...sendResponse,
      error: error.message
    }
  };
  return sendResponse;
};