/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import AWS from "aws-sdk";
// This import is required for adding the layer zip file to the .aws-sam/build/sdklayer during predeploy
import "../../NPMLayer/nodejs.zip";
import { getFileFromS3, uploadToS3 } from "../getsegmentlist/getsegmentlist";

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
    // console.log(`getObjectResp: ${JSON.stringify(getObjectResp)}`);

    const unzippedFile = await gunzip(getObjectResp.Body);
    // console.log(`unzippedFile: ${unzippedFile}`);
    const unzippedFileString = unzippedFile.toString("utf-8").trim();
    // console.log(`unzippedFileString: ${unzippedFileString}`);
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
  console.log(`In getSegmentCount`);
  console.log(`params: ${JSON.stringify(params)}`);
  const exportJobWithRetry = async (maxRetries = 5) => {
    let retry = 0;
    while (retry < maxRetries) {
        try {
            const resp = await pinpoint
                .createExportJob(params)
                .promise();
            console.log("Export job created:", resp);
            return resp; // Exit function if successful
        } catch (error) {
            if (
                error.message.includes("Maximum concurrent exports limit exceeded")
            ) {
                retry += 1;
                console.log(`Retrying... (${retry}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, retry) * 1000)); // Exponential backoff
            } else {
                throw error; // Re-throw other errors
            }
      }
    }
    console.log("Max retries reached. Export job creation failed.");
    return ""
  };
  try {
    const createExportJobResp = await exportJobWithRetry();
    console.log(`createExportJobResp: ${JSON.stringify(createExportJobResp)}`);
    jobid =
      createExportJobResp.ExportJobResponse &&
      createExportJobResp.ExportJobResponse.Id
        ? createExportJobResp.ExportJobResponse.Id
        : "";
  } catch (e) {
    console.log(`exception at getSegmentCount: ${JSON.stringify(e)}`);
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
const initEndpointCountCalculation = async ({
  appSegments,
  applicationId,
  segmentIds,
  index,
}) => {
  console.log(`appSegments: ${JSON.stringify(appSegments)}`);
  // Current segmentId
  const segmentId = segmentIds[index];
  // Calculate the endpoint count for each of the segments in each of the application
  const segmentEndpointCount = {};
  if (applicationId) {
    const getCountResp = await getSegmentCount({
      appid: applicationId,
      segid: segmentId,
    });
    console.log(`getCountResp: ${JSON.stringify(getCountResp)}`);
    if (!segmentEndpointCount[applicationId]) {
      segmentEndpointCount[applicationId] = {};
    }
    segmentEndpointCount[applicationId][segmentId] =
      getCountResp !== "Job failed" ? getCountResp : {};
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
    // Get the campaignIdList file from s3
    const { segmentIdIterator = {}, fileKey = "", iterator = {} } = event;
    const { index: appIdIndex } = iterator;
    const campaignIdList = await getFileFromS3(fileKey);
    console.log(`campaignIdList: ${JSON.stringify(campaignIdList)}`);
    const { appSegments, segmentIdArr } = campaignIdList;
    const segmentItem = segmentIdArr[appIdIndex];
    console.log(`segmentItem: ${JSON.stringify(segmentItem)}`);
    const { segmentIds } = segmentItem;
    console.log(`segmentIds: ${JSON.stringify(segmentIds)}`);
    const { segmentEndpointCount } = campaignIdList;
    const { segmentIdIndex, applicationId } = segmentIdIterator;
    // CalculateEndpointCount event - Init calculation
    const endpointCountObj = await initEndpointCountCalculation({
      appSegments,
      applicationId,
      segmentIds,
      index: segmentIdIndex,
    });
    console.log(`endpointCountObj: ${JSON.stringify(endpointCountObj)}`);
    // Merge the endpointCountObj inside the segmentEndpointCount.applicationId
    segmentEndpointCount[applicationId] = {
      ...segmentEndpointCount[applicationId],
      ...endpointCountObj[applicationId],
    };

    campaignIdList.segmentEndpointCount = segmentEndpointCount;
    // Upload the campaignIdList to s3 to consume from other Lambda
    const uploadToS3Resp = await uploadToS3({
      campaignIdList,
      timestamp: "",
      fileKey,
    });
    console.log(`uploadToS3Resp: ${JSON.stringify(uploadToS3Resp)}`);
    response = { ...event };
  } catch (error) {
    console.log(error);
    response = { ...event, error };
  }
  return response;
}
