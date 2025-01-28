/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import { getFileFromS3 } from "../getsegmentlist/getsegmentlist";

export async function main(event) {
  let response;
  const { fileKey, iterator, segmentIdIterator } = event;
  const { index: appIdIndex } = iterator;
  let { segmentIdIndex } = segmentIdIterator;
  const { segmentIdStep } = segmentIdIterator;
  try {
    // Get the campaignIdList file from s3
    const campaignIdList = await getFileFromS3(fileKey);
    console.log(`campaignIdList: ${JSON.stringify(campaignIdList)}`);
    const { segmentIdArr } = campaignIdList;
    console.log(`segmentIdArr: ${JSON.stringify(segmentIdArr)}`);
    // Get the segment item of the current application (being processed by the iterator)
    console.log(`appIdIndex: ${appIdIndex}`);
    const segmentItem = segmentIdArr[appIdIndex];
    console.log(`segmentItem: ${JSON.stringify(segmentItem)}`);
    if (segmentItem) {
      const { appid: applicationId, segmentIds } = segmentItem;
      console.log(`applicationId: ${applicationId}`);
      console.log(`segmentIds: ${JSON.stringify(segmentIds)}`);
      const segmentIdCount = segmentIds.length;
      console.log(`segmentIdCount: ${segmentIdCount}`);
      if (segmentIdIndex === -1) {
        segmentIdIndex = 0;
      } else {
        segmentIdIndex += segmentIdStep;
      }
      console.log(`segmentIdIndex: ${segmentIdIndex}`);
      const doContinue = segmentIdIndex < segmentIdCount;
      response = {
        segmentIdIndex,
        segmentIdStep,
        segmentIdCount,
        segmentIdContinue: doContinue,
        applicationId,
      };
    }
  } catch (error) {
    console.log(`Exception occured: `);
    console.log(error);
  }
  return response;
}
