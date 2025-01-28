/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import AWS from "aws-sdk";
import { getResourceJSON } from "../../FunctionStack/libs/db";
import { listSegments } from "../../FunctionStack/campaign/campaign";

const s3 = new AWS.S3({ apiVersion: "2006-03-01" });
const { FILE_MANAGER_BUCKET_NAME } = process.env;
export const getEntities = async (entity) => {
  const params = {
    TableName: process.env.entitiesTableName,
    IndexName: process.env.entitiesTableByEntityAndId,
    KeyConditionExpression: "#entity = :entity",
    ExpressionAttributeNames: {
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":entity": entity,
    },
  };
  console.log(params);
  return getResourceJSON(params);
};
const getSegmentIds = async (appid) => {
  let segmentIds = [];
  try {
    const segmentList = await listSegments({ appid }, true, true);
    console.log(`segmentList: ${JSON.stringify(segmentList)}`);
    segmentIds = segmentList?.SegmentsResponse?.Item?.map(
      (segment) => segment.Id ?? []
    );
  } catch (error) {
    console.log(`Exception occured in getSegmentIds`);
    console.log(error);
  }
  return segmentIds;
};
const getSegmentIdList = async () => {
  // Get all the builders for getting the Pinpoint Application Ids
  const buildersList = await getEntities("builder");
  console.log(`buildersList: ${JSON.stringify(buildersList)}`);

  // Store the home builder ids associated with each appid
  const appBuilderIds = buildersList.reduce((builderAppIds, builder) => {
    if (builder?.appid) {
      if (builderAppIds[builder.appid]) {
        builderAppIds[builder.appid] = "";
      }
      builderAppIds[builder.appid] = builder.id;
    }
    return builderAppIds;
  }, {});
  console.log(`appBuilderIds: ${JSON.stringify(appBuilderIds)}`);

  const applicationIds = buildersList
    .map((builder) => builder.appid)
    .filter((appId) => !!appId);
  console.log(`applicationIds: ${JSON.stringify(applicationIds)}`);

  // Define an object which will hold all the segment ids under an application
  const appSegments = {};

  // Get all the Segment Ids under each application
  for (const appid of applicationIds) {
    try {
      const segmentIdList = await getSegmentIds(appid);
      if (segmentIdList && segmentIdList.length) {
        appSegments[appid] = segmentIdList;
      }
    } catch (error) {
      console.log("Exception occured when getting segmentList");
      console.log(error);
    }
  }
  console.log(`appSegments: ${JSON.stringify(appSegments)}`);
  const segmentIdArr = [];
  for (const appid in appSegments) {
    if (appid) {
      segmentIdArr.push({ appid, segmentIds: appSegments[appid] });
    }
  }
  return { appSegments, appBuilderIds, segmentIdArr, segmentEndpointCount: {} };
};
export const uploadToS3 = async ({
  campaignIdList,
  timestamp,
  fileKey: existingFileKey = "",
}) => {
  // Upload status file to s3
  // console.log('fileUploadParams: ', fileUploadParams);
  try {
    const fileKey = `${timestamp}_CampaignIdList.json`;
    const uploadJSONParams = {
      Bucket: FILE_MANAGER_BUCKET_NAME,
      Key: existingFileKey || `endpoint_count/${fileKey}`,
      Body: JSON.stringify(campaignIdList, null, 4),
    };
    console.log(`uploadJSONParams: ${JSON.stringify(uploadJSONParams)}`);
    const fileUploadResp = await s3.upload(uploadJSONParams).promise();
    console.log(`fileUploadResp: ${JSON.stringify(fileUploadResp)}`);
    return fileUploadResp;
  } catch (error) {
    console.log(`error: ${JSON.stringify(error)}`);
    return error;
  }
};
export const getFileFromS3 = async (fileKey) => {
  console.log(fileKey);
  const s3Params = {
    Bucket: FILE_MANAGER_BUCKET_NAME,
    Key: fileKey,
  };
  try {
    const getObjectResp = await s3.getObject(s3Params).promise();
    const fileBody =
      getObjectResp && getObjectResp.Body
        ? JSON.parse(Buffer.from(getObjectResp.Body))
        : {};
    console.log(`fileBody: ${JSON.stringify(fileBody)}`);
    return fileBody;
  } catch (error) {
    console.log(`error: ${JSON.stringify(error)}`);
    return error;
  }
};
export async function main(event) {
  let response;
  console.log(`event: ${JSON.stringify(event)}`);
  try {
    if (event.source === "aws.events") {
      // Check whether this is the CalculateSegmentEndpointCount event
      const isCalculateCount = event.resources.reduce((isFound, resource) => {
        if (resource.includes("SegmentCountStateMachine")) {
          isFound = true;
        }
        return isFound;
      }, false);
      if (isCalculateCount) {
        // Get segment id list
        const campaignIdList = await getSegmentIdList();
        console.log(`campaignIdList: ${JSON.stringify(campaignIdList)}`);

        // Upload the campaignIdList to s3 to consume from other Lambda
        const timestamp = new Date().toISOString();
        const uploadToS3Resp = await uploadToS3({
          campaignIdList,
          timestamp,
        });
        console.log(`uploadToS3Resp: ${JSON.stringify(uploadToS3Resp)}`);
        response = {
          doCount: true,
          fileKey: `endpoint_count/${timestamp}_CampaignIdList.json`,
        };
      }
    }
  } catch (err) {
    console.log(err);
    response = { doCount: false };
  }
  return response;
}
