import AWS from "aws-sdk";
import { initLambdaInvoke } from "../../FunctionStack/libs/lambda";
import { doPaginatedQueryEllastic } from "../../FunctionStack/libs/db";

const s3 = new AWS.S3({ apiVersion: "2006-03-01" });

const { FILE_MANAGER_BUCKET_NAME } = process.env;

export const getEntities = async (body, arn) => {
  try {
    const list = await initLambdaInvoke({
      action: "list",
      httpMethod: "GET",
      body,
      arn,
      getBody: true,
    });
    return { status: true, list };
  } catch (error) {
    console.log(`getEntities error : ${JSON.stringify(error.stack)}`);
    return {
      status: false,
      error: error.message,
    };
  }
};

const uploadFileToS3Generic = async (fileUploadParams) => {
  const fileUploadResp = await s3.upload(fileUploadParams).promise();
  console.log(`fileUploadResp: ${JSON.stringify(fileUploadResp)}`);
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
    return { status: true, response };
  } catch (error) {
    console.log("Error occured in uploadToS3");
    console.log(error);
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

export async function main(event) {
  console.log(JSON.stringify(event));
  const sendResponse = {
    ...event,
    status: true,
  };
  try {
    const {
      hb_id: hbId = "",
      type = "",
      communityLambdaArn = "",
      agencyLambdaArn = "",
      coBuyerLambdaArn = "",
      filter ={}
    } = event;

    if (!hbId || !type || !communityLambdaArn || !agencyLambdaArn) {
      sendResponse.status = false;
      sendResponse.error =
        "All feilds are required(hbId,type,communityLambdaArn,agencyLambdaArn)";
      return sendResponse;
    }

    if (type === "customer" && !coBuyerLambdaArn) {
      sendResponse.status = false;
      sendResponse.error = "coBuyerLambdaArn is required";
      return sendResponse;
    }

    if (!event?.entityListKey) {
      // means its the first iteration
      const entityListKey = `endpointUpdate/${new Date().toISOString()}_${hbId}_entitylist.json`;

      const customParams = [
          {
            match: {
              "entity.keyword": `${type}#${hbId}`
            },
          },
      ]

      if(type === "realtor" && filter?.agencyId){
        customParams.push({
          match: {
            "rel_id.keyword": filter.agencyId
          },
        })
      }

      if(type === "customer" && filter?.commId){
        customParams.push({
          terms: {
            "inte.keyword": filter.commId
          },
        })
      }

      const entities = await doPaginatedQueryEllastic({
        hb_id: hbId,
        isCustomParam: true,
        customParams
      });

      console.log(`entities: ${JSON.stringify(entities)}`);

      const doc = await getEntities(
        { hbid: hbId },
        type === "customer" ? communityLambdaArn : agencyLambdaArn
      );

      console.log(`doc: ${JSON.stringify(doc)}`);

      const idMappedValue = {};

      for (const item of doc.list) {
        idMappedValue[item.id] = type === "customer" ? item.rel_id : item.m_id;
      }

      console.log(`idMappedValue: ${JSON.stringify(idMappedValue)}`);

      const uploadToS3Resp = await uploadToS3(entityListKey, {
        entities,
        idMappedValue,
      });

      if (!uploadToS3Resp.status) {
        sendResponse.status = false;
        sendResponse.error = uploadToS3Resp.error;
        return sendResponse;
      }

      sendResponse.status = !!entities.length;
      sendResponse.count = entities.length;
      sendResponse.entityListKey = entityListKey;
      sendResponse.skipToIterator = false;
    }
    return sendResponse;
  } catch (error) {
    sendResponse.status = false;
    sendResponse.error = error.message;
    return sendResponse;
  }
}
