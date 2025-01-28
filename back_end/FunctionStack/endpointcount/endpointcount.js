/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import { failure } from "../libs/response-lib";
import { getResourceJSON, postResources } from "../libs/db";
// This import is required for adding the layer zip file to the .aws-sam/build/sdklayer during predeploy
import "../../NPMLayer/nodejs.zip";
import { listSegments } from "../campaign/campaign";

const util = require("util");
const zlib = require("zlib");

const gunzip = util.promisify(zlib.gunzip);
const { EXPORT_JOB_ROLE_ARN, EXPORT_JOB_BUCKET_NAME } = process.env;
const pinpoint = new AWS.Pinpoint({ apiVersion: "2016-12-01" });
const s3 = new AWS.S3({ apiVersion: "2006-03-01" });

const listExportedObjects = async (data) => {
  const prefix = data.prefix ? data.prefix : "";
  const s3Params = {
    Bucket: EXPORT_JOB_BUCKET_NAME,
    Prefix: prefix,
  };
  try {
    const listObjectsResp = await s3.listObjectsV2(s3Params).promise();
    console.log(`listObjectsResp: ${JSON.stringify(listObjectsResp)}`);
    return listObjectsResp;
  } catch (e) {
    console.log(`e: ${JSON.stringify(e)}`);
    return e;
  }
};
const getObjectS3 = async (data) => {
  const fileKey = data.fileKey ? data.fileKey : "";
  const s3Params = {
    Bucket: EXPORT_JOB_BUCKET_NAME,
    Key: fileKey,
  };
  try {
    const getObjectResp = await s3.getObject(s3Params).promise();
    console.log(`getObjectResp: ${JSON.stringify(getObjectResp)}`);

    const unzippedFile = await gunzip(getObjectResp.Body);
    console.log(`unzippedFile: ${unzippedFile}`);
    const unzippedFileString = unzippedFile.toString("utf-8").trim();
    console.log(`unzippedFileString: ${unzippedFileString}`);
    const splitObjects = unzippedFileString.split("\n");
    const totalEndpoints = splitObjects.map((record) => JSON.parse(record));
    const eligibleEndpoints = totalEndpoints.filter(
      (endpoint) => endpoint.OptOut === "NONE"
    );
    // const stringOccurCount = (objectData.match(/ACTIVE/g) || []).length;
    console.log(`Total number of endpoints: ${totalEndpoints.length}`);
    console.log(
      `Total number of eligible endpoints: ${eligibleEndpoints.length}`
    );
    console.log(`totalEndpoints: ${totalEndpoints}`);
    console.log(`eligibleEndpoints: ${eligibleEndpoints}`);
    return {
      totalEndpoints: totalEndpoints.length,
      eligibleEndpoints: eligibleEndpoints.length,
    };
  } catch (e) {
    console.log(`e: ${JSON.stringify(e)}`);
    return e;
  }
};
const isExportJobComplete = async (data) => {
  const jobid = data.jobid ? data.jobid : "";
  const appid = data.appid ? data.appid : "";
  const params = {
    ApplicationId: appid /* required */,
    JobId: jobid /* required */,
  };
  try {
    const getExportJobStatusResp = await pinpoint
      .getExportJob(params)
      .promise();
    console.log(
      `getExportJobStatusResp: ${JSON.stringify(getExportJobStatusResp)}`
    );
    console.log(
      `getExportJobStatusResp.ExportJobResponse.JobStatus: ${getExportJobStatusResp.ExportJobResponse.JobStatus}`
    );
    if (
      getExportJobStatusResp.ExportJobResponse &&
      getExportJobStatusResp.ExportJobResponse.JobStatus === "COMPLETED"
    ) {
      console.log("In return true");
      return true;
    }

    console.log("In recursion else");
    return await isExportJobComplete(data);
  } catch (e) {
    console.log(`e: ${JSON.stringify(e)}`);
    return false;
  }
};
const getSegmentCount = async (data) => {
  const appid = data.appid ? data.appid : "";
  const segmentId = data.segid ? data.segid : "";
  const exportFolderPrefix = `Exports/${appid}_${segmentId}_${new Date().toISOString()}/`;
  let jobid = "";
  const params = {
    ApplicationId: appid /* required */,
    ExportJobRequest: {
      /* required */ RoleArn: EXPORT_JOB_ROLE_ARN /* required */,
      S3UrlPrefix: `s3://${EXPORT_JOB_BUCKET_NAME}/${exportFolderPrefix}` /* required */,
      SegmentId: segmentId,
    },
  };
  try {
    const createExportJobResp = await pinpoint
      .createExportJob(params)
      .promise();
    console.log(`createExportJobResp: ${JSON.stringify(createExportJobResp)}`);
    jobid =
      createExportJobResp.ExportJobResponse &&
      createExportJobResp.ExportJobResponse.Id
        ? createExportJobResp.ExportJobResponse.Id
        : "";
  } catch (e) {
    console.log(`e: ${JSON.stringify(e)}`);
    // return failure({ status: false, error: e });
  }
  const isJobComplete = await isExportJobComplete({ appid, jobid });
  console.log(`isJobComplete: ${isJobComplete}`);
  if (isJobComplete) {
    const listExportedObjectsResp = await listExportedObjects({
      prefix: exportFolderPrefix,
    });
    const exportedFiles = listExportedObjectsResp.Contents.filter((fileItem) =>
      fileItem.Key.includes(".gz")
    );
    console.log(`exportedFiles: ${JSON.stringify(exportedFiles)}`);
    const exportedFileObjectResp = { totalEndpoints: 0, eligibleEndpoints: 0 };
    for (const exportedFile of exportedFiles) {
      const endpointCount = await getObjectS3({ fileKey: exportedFile.Key });
      exportedFileObjectResp.totalEndpoints += endpointCount.totalEndpoints;
      exportedFileObjectResp.eligibleEndpoints +=
        endpointCount.eligibleEndpoints;
    }
    return exportedFileObjectResp;
  }

  return "Job failed";
};
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
  const segmentList = await listSegments({ appid }, true, true);
  console.log(`segmentList: ${JSON.stringify(segmentList)}`);
  const segmentIds =
    segmentList.SegmentsResponse &&
    segmentList.SegmentsResponse.Item &&
    segmentList.SegmentsResponse.Item.map((segment) => segment.Id);
  return segmentIds;
};
const saveToDB = async (obj) => {
  const { hbid } = obj;
  const { appid } = obj;
  const { segcount } = obj;
  const type = "count";
  const updatedDate = Date.now();
  let id = uuidv4();
  let creationDate = Date.now();
  // Decide whether it is create or update
  // Fetch count resource for the home builder
  const countResource = await getEntities(`${type}#${hbid}`);
  console.log(`countResource: ${JSON.stringify(countResource)}`);
  if (countResource && countResource.length) {
    // Already exists
    id = countResource[0].id;
    creationDate = countResource[0].cdt;
  }
  const params = {
    TableName: process.env.entitiesTableName,
    Item: {
      id,
      type,
      appid,
      entity: `${type}#${hbid}`,
      count: segcount,
      cdt: creationDate,
      mdt: updatedDate,
    },
  };
  console.log(params);
  return postResources(params);
};
const initEndpointCountCalculation = async () => {
  // Get all the builders for getting the Pinpoint Application Ids
  const buildersList = await getEntities("builder");
  console.log(`buildersList: ${JSON.stringify(buildersList)}`);

  // Store the home builder ids associated with each appid
  const appBuilderIds = buildersList.reduce((builderAppIds, builder) => {
    if (builderAppIds[builder.id]) {
      builderAppIds[builder.id] = {};
    }
    builderAppIds[builder.appid] = builder.id;
    return builderAppIds;
  }, {});
  console.log(`appBuilderIds: ${JSON.stringify(appBuilderIds)}`);

  const applicationIds = buildersList.map((builder) => builder.appid);
  console.log(`applicationIds: ${JSON.stringify(applicationIds)}`);

  // Define an object which will hold all the segment ids under an application
  const appSegments = {};

  // Get all the Segment Ids under each application
  for (const appid of applicationIds) {
    const segmentIdList = await getSegmentIds(appid);
    if (segmentIdList && segmentIdList.length) {
      appSegments[appid] = segmentIdList;
    }
  }
  console.log(`appSegments: ${JSON.stringify(appSegments)}`);

  // Calculate the endpoint count for each of the segments in each of the application
  const segmentEndpointCount = {};
  for (const applicationId in appSegments) {
    if (applicationId) {
      const segmentIds = appSegments[applicationId];
      for (const segmentId of segmentIds) {
        const getCountResp = await getSegmentCount({
          appid: applicationId,
          segid: segmentId,
        });
        console.log(`getCountResp: ${JSON.stringify(getCountResp)}`);
        if (!segmentEndpointCount[applicationId]) {
          segmentEndpointCount[applicationId] = {};
        }
        segmentEndpointCount[applicationId][segmentId] = getCountResp;
      }
    }
  }

  // Save the count for each builder in DB
  for (const appId in segmentEndpointCount) {
    if (appId) {
      const saveToDBResp = await saveToDB({
        hbid: appBuilderIds[appId],
        appid: appId,
        segcount: segmentEndpointCount[appId],
      });
      console.log(`saveToDBResp: ${JSON.stringify(saveToDBResp)}`);
    }
  }
  return segmentEndpointCount;
};
/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */
export async function main(event) {
  let response;
  console.log(`event: ${JSON.stringify(event)}`);
  try {
    if (event.source === "aws.events") {
      // Check whether this is the CalculateSegmentEndpointCount event
      const isCalculateCount = event.resources.reduce((isFound, resource) => {
        if (resource.includes("CalculateSegmentEndpointCount")) {
          isFound = true;
        }
        return isFound;
      }, false);
      if (isCalculateCount) {
        // CalculateEndpointCount event - Init calculation
        const endpointCountResp = await initEndpointCountCalculation();
        console.log(`endpointCountResp: ${JSON.stringify(endpointCountResp)}`);
      }
    }
  } catch (err) {
    console.log(err);
    return failure({ status: false, error: err });
  }
  return response;
}
