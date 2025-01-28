import {
  listCampaigns,
  listJourney,
} from "../../FunctionStack/campaign/campaign";
// This import is required for adding the layer zip file to the .aws-sam/build/sdklayer during predeploy
import "../../NPMLayer/nodejs.zip";
import { getFileFromS3, uploadToS3 } from "../getsegmentlist/getsegmentlist";

/* eslint consistent-return: "off" */
const getCampaignCount = async ({
  appid: applicationId,
  ps: pageSize,
  nt: nextToken,
  isFirstCall,
  segmentId,
  campaignList,
}) => {
  // Do the call only if it is the initial call or paginated call
  if (isFirstCall || nextToken) {
    const getCountResp = await listCampaigns(
      {
        appid: applicationId,
        ps: pageSize,
        nt: nextToken,
      },
      true
    );
    console.log(`getCountResp: ${JSON.stringify(getCountResp)}`);
    if (getCountResp?.status && getCountResp?.data?.CampaignsResponse?.Item) {
      campaignList = [
        ...campaignList,
        ...getCountResp?.data?.CampaignsResponse?.Item,
      ];
    }
    return getCampaignCount({
      appid: applicationId,
      ps: pageSize,
      nt: getCountResp?.data?.CampaignsResponse?.NextToken ?? "",
      isFirstCall: false,
      segmentId,
      campaignList,
    });
  }
  console.log(`campaignList: ${JSON.stringify(campaignList)}`);
  // Reached the end of campaign list. Return the total count after filtering with segment id
  campaignList = campaignList.filter(
    (campaign) => campaign?.SegmentId === segmentId
  );
  console.log(`campaignList filtered: ${JSON.stringify(campaignList)}`);
  return campaignList.length;
};
const getJourneyCount = async ({
  appid: applicationId,
  ps: pageSize,
  nt: nextToken,
  isFirstCall,
  segmentId,
  journeyList,
}) => {
  // Do the call only if it is the initial call or paginated call
  if (isFirstCall || nextToken) {
    const getCountResp = await listJourney(
      {
        appid: applicationId,
        ps: pageSize,
        nt: nextToken,
      },
      true
    );
    console.log(`getCountResp: ${JSON.stringify(getCountResp)}`);
    if (getCountResp?.status && getCountResp?.data?.JourneysResponse?.Item) {
      journeyList = [
        ...journeyList,
        ...getCountResp?.data?.JourneysResponse?.Item,
      ];
    }
    return getJourneyCount({
      appid: applicationId,
      ps: pageSize,
      nt: getCountResp?.data?.JourneysResponse?.NextToken ?? "",
      isFirstCall: false,
      segmentId,
      journeyList,
    });
  }
  console.log(`journeyList: ${JSON.stringify(journeyList)}`);
  // Reached the end of journey list. Return the total count after filtering with segment id
  journeyList = journeyList.filter(
    (journey) =>
      journey?.StartCondition?.SegmentStartCondition?.SegmentId === segmentId
  );
  console.log(`journeyList filtered: ${JSON.stringify(journeyList)}`);
  return journeyList.length;
};
const initCampaignJourneyCountCalculation = async ({
  appSegments,
  applicationId,
  segmentIds,
  index,
}) => {
  const pageSize = "100";
  const segmentCampaignCount = {};
  try {
    console.log(`appSegments: ${JSON.stringify(appSegments)}`);
    console.log(`applicationId: ${JSON.stringify(applicationId)}`);
    console.log(`segmentIds: ${JSON.stringify(segmentIds)}`);
    console.log(`index: ${JSON.stringify(index)}`);
    // Current segmentId
    const segmentId = segmentIds[index];
    // Calculate the campaign and journey count
    if (applicationId) {
      const campaignCount = await getCampaignCount({
        appid: applicationId,
        ps: pageSize,
        nt: "",
        isFirstCall: true,
        segmentId,
        campaignList: [],
      });
      console.log(`campaignCount: ${campaignCount}`);
      const journeyCount = await getJourneyCount({
        appid: applicationId,
        ps: pageSize,
        nt: "",
        isFirstCall: true,
        segmentId,
        journeyList: [],
      });
      console.log(`journeyCount: ${journeyCount}`);
      if (!segmentCampaignCount[applicationId]) {
        segmentCampaignCount[applicationId] = {};
      }
      segmentCampaignCount[applicationId][segmentId] = {
        campaignCount,
        journeyCount,
      };
    }
  } catch (error) {
    console.log(`Exception occured: `);
    console.log(error);
  }
  return segmentCampaignCount;
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
    const { segmentIdIterator, fileKey, iterator } = event;
    const { index: appIdIndex } = iterator;
    const campaignIdList = await getFileFromS3(fileKey);
    console.log(`campaignIdList: ${JSON.stringify(campaignIdList)}`);
    const { appSegments, segmentIdArr } = campaignIdList;
    const segmentItem = segmentIdArr[appIdIndex];
    console.log(`segmentItem: ${JSON.stringify(segmentItem)}`);
    const { segmentIds } = segmentItem;
    console.log(`segmentIds: ${JSON.stringify(segmentIds)}`);
    const { segmentCampaignCount = {} } = campaignIdList;
    const { segmentIdIndex, applicationId } = segmentIdIterator;
    // Calculate campaign and journey count for the segment
    const segmentCampaignJourneyCount =
      await initCampaignJourneyCountCalculation({
        appSegments,
        applicationId,
        segmentIds,
        index: segmentIdIndex,
      });
    console.log(
      `segmentCampaignJourneyCount: ${JSON.stringify(
        segmentCampaignJourneyCount
      )}`
    );
    // Merge the existing result with other segment results
    segmentCampaignCount[applicationId] = {
      ...segmentCampaignCount[applicationId],
      ...segmentCampaignJourneyCount[applicationId],
    };
    // Merge it to campaignIdList for uploading to s3
    campaignIdList.segmentCampaignCount = segmentCampaignCount;
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
