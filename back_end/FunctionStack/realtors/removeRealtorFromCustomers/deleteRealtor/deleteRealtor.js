import { updateResources } from "../../../libs/db";
import { getFileFromS3 } from "../intiRemoveRealtor/initRemoveRealtor";


export async function main(event) {
  const sendResponse = {
    ...event,
    error: "",
    status: false,
  };
  try {
    console.log(`event: ${event}`);
    const { index, step, nextIndexValue } = event.iterator;
    const { dataFileKey = "", purpose, hbId, rltrId } = event;

    // get RealtorIdArray from s3
    const statusFileResp = await getFileFromS3(dataFileKey);
    console.log(`statusFileResp: ${JSON.stringify(statusFileResp)}`);
    if (!statusFileResp?.status) {
      sendResponse.status = false;
      sendResponse.error = statusFileResp.error;
      return sendResponse;
    }

    console.log(`index: ${JSON.stringify(index)}`);
    console.log(`index + step: ${JSON.stringify(index+step)}`);
    let finalVal;
    if(statusFileResp?.data.length <= index+step){
      finalVal = statusFileResp?.data.length;
    }else{
      finalVal = index+step;
    }
    for(let i=index; i < finalVal; i++){
        let updateDataId = statusFileResp.data[i];
        console.log(`updateDataId: ${JSON.stringify(updateDataId)}`);
        const removeRealtorParams = {
            TableName: process.env.entitiesTableName,
            Key:{
                id: updateDataId,
                entity: `customer#${hbId}`
            },
            UpdateExpression: `set #rltr = :rltr`,
            ExpressionAttributeNames: {
              "#rltr": "rltr",
            },
            ExpressionAttributeValues: {
              ":rltr": {},
            },
        };
        console.log(`removeRealtorParams: ${JSON.stringify(removeRealtorParams)}`);

        const removeRealtorResp = await updateResources(removeRealtorParams);
        console.log(`removeRealtorResp: ${JSON.stringify(removeRealtorResp)}`);
    }
    sendResponse.nextIndexValue = index + step;
    sendResponse.status = true;
    return sendResponse;
  } catch (error) {
    sendResponse.status = false;
    sendResponse.error = error.message;
    return sendResponse;
  }
}
