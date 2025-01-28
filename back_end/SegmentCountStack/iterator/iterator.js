/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import { getFileFromS3 } from "../getsegmentlist/getsegmentlist";

export async function main(event) {
  let response;
  const { iterator, fileKey } = event;
  let { index } = iterator;
  const { step } = iterator;
  try {
    // Get the campaignIdList file from s3
    const campaignIdList = await getFileFromS3(fileKey);
    console.log(`campaignIdList: ${JSON.stringify(campaignIdList)}`);
    const { segmentIdArr } = campaignIdList;
    console.log(`segmentIdArr: ${JSON.stringify(segmentIdArr)}`);
    const count = segmentIdArr.length;
    console.log(`count: ${count}`);
    if (index === -1) {
      index = 0;
    } else {
      index += step;
    }
    const doContinue = index < count;
    console.log(`doContinue: ${doContinue}`);
    response = {
      index,
      step,
      count,
      continue: doContinue,
    };
  } catch (error) {
    console.log(`Exception occured: `);
    console.log(error);
  }
  return response;
}
