/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import AWS from "aws-sdk";
import { invokeLambda } from "../../FunctionStack/libs/lambda";
import { initUpdateEmailActivityExecution } from "../getbuilders/getbuilders";

const s3 = new AWS.S3({ apiVersion: "2006-03-01" });
let ACTIVITIES_LAMBDA_ARN;
const { FILE_MANAGER_BUCKET_NAME } = process.env;
const EMAIL_ACTIVITY_UPDATE_STATUS_PROCESSING = "PROCESSING";
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
export const getFileFromS3 = async (fileKey) => {
  const s3Params = {
    Bucket: FILE_MANAGER_BUCKET_NAME,
    Key: fileKey,
  };
  try {
    const getObjectResp = await s3.getObject(s3Params).promise();
    console.log(getObjectResp);
    let customers =
      getObjectResp && getObjectResp.Body
        ? Buffer.from(getObjectResp.Body)
        : "";
    customers = JSON.parse(customers);
    return customers;
  } catch (error) {
    console.log("error in getFileFromS3");
    console.log(error);
    return error;
  }
};
const getEmailActivityList = async ({
  hbId = "",
  ExclusiveStartKey = null,
  Limit = 100,
}) => {
  let activityList = [];
  try {
    if (hbId) {
      // Get the list of email activities
      const listActivitiesParams = {
        httpMethod: "POST",
        pathParameters: {
          action: "listact",
        },
        body: JSON.stringify({
          hbId,
          ExclusiveStartKey,
          Limit,
        }),
      };
      console.log(
        `listActivitiesParams: ${JSON.stringify(listActivitiesParams)}`
      );

      // Invoke customer lambda
      const activityListResp = await invokeLambda(
        ACTIVITIES_LAMBDA_ARN,
        listActivitiesParams,
        false
      );
      let { Payload: activityListBody } = activityListResp;
      activityListBody = JSON.parse(activityListBody);
      activityList = activityListBody;
    }
  } catch (error) {
    console.log(`Exception occured in getEmailActivityList`);
    console.log(error);
  }
  return activityList;
};
export async function main(event) {
  console.log(JSON.stringify(event));
  const {
    hb_id: hbId,
    statusFileKey = "",
    activityiterator,
    BuildersApiFunctionArn,
    ActivitiesApiFunctionArn,
  } = event; // rnstr, statusFileKey =""
  ACTIVITIES_LAMBDA_ARN = ActivitiesApiFunctionArn;
  const { index } = activityiterator;
  let { ExclusiveStartKey, allActivities = [] } = event;
  const { step: Limit = 100 } = event.activityiterator;
  let activityList;
  let hasAfter;
  let nextKey;
  if (hbId) {
    // Get the list of email activities
    const activityListResp = await getEmailActivityList({
      hbId,
      ExclusiveStartKey,
      Limit,
    });
    // console.log(`activityListResp: ${JSON.stringify(activityListResp)}`);
    // Extract the activity list from the response
    activityList = activityListResp?.activities || [];
    hasAfter = activityListResp?.hasAfter || false;
    nextKey = activityListResp?.ExclusiveStartKey || null;
    ExclusiveStartKey = nextKey;
    console.log(`hasAfter: ${hasAfter}`);
    console.log(`nextKey: ${JSON.stringify(nextKey)}`);
    console.log(`activityList.length: ${activityList.length}`);
    // Merge the results with allActivities
    if (activityList.length > 0)
      allActivities = [...allActivities, ...activityList];
    console.log(`allActivities.length: ${allActivities.length}`);
    // Upload a status file with PROCESSING status to indicate that the process has started
    if (index === 0) {
      const currentDate = new Date().toISOString();
      const uploadInitStatusResp = await uploadToS3(statusFileKey, {
        cdt: currentDate,
        status: EMAIL_ACTIVITY_UPDATE_STATUS_PROCESSING,
      });
      console.log(
        `uploadInitStatusResp: ${JSON.stringify(uploadInitStatusResp)}`
      );
    }
    // Doing a scan on DB for email activities in a loop.
    // This is done in a loop because, the scan operation doesn't always return a result.
    // So, looping till hasAfter and nextKey exists and allActivities.length < Limit.
    // Each iteration in this loop is done in a separate state machine execution,
    // to avoid the situation of hitting 25K limit of state machine execution history.
    if (hasAfter && nextKey && allActivities.length < Limit) {
      // Spawn a new execution and end this execution.
      await initUpdateEmailActivityExecution({
        ...event,
        allActivities,
        hasAfter,
        ExclusiveStartKey,
        skipToGetEmailActivity: true,
        statusFileKey,
        BuildersApiFunctionArn,
        ActivitiesApiFunctionArn,
      });
      return {
        hasAfter,
        ExclusiveStartKey,
        continueToUpdateActivity: false,
        BuildersApiFunctionArn,
        ActivitiesApiFunctionArn,
      };
    }

    if (event?.allActivities) delete event.allActivities;
    return {
      ...event,
      activityList: allActivities,
      isActivitiesFound: !!allActivities.length,
      hasAfter,
      ExclusiveStartKey: nextKey,
      doGetActivitiesExecution: !!(hasAfter && nextKey),
      continueToUpdateActivity: true,
      statusFileKey,
      BuildersApiFunctionArn,
      ActivitiesApiFunctionArn,
    };
  }

  // Builder id required for proceeding
  return {
    isActivitiesFound: false,
  };
}
