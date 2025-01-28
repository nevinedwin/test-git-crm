import { batchWriteItems } from "../../FunctionStack/libs/db";
import { getFileFromS3 } from "../fetchEntities/fetchEntities";

export async function main(event) {
  const sendResponse = {
    ...event,
    status: false,
    error: "",
  };
  try {
    console.log("event", JSON.stringify(event));
    const { entityListKey } = event;
    const { index, step } = event.iterator;
    // Get the customers from S3
    const entityFileResp = await getFileFromS3(entityListKey);
    console.log(`entityFileResp: ${JSON.stringify(entityFileResp)}`);
    if (!entityFileResp?.status) {
      sendResponse.status = false;
      sendResponse.error = entityFileResp.error;
      return sendResponse;
    }

    let realtorList = entityFileResp?.data?.entities;

    realtorList = realtorList.slice(index, index + step);
    console.log("realtorList", JSON.stringify(realtorList));

    const idMappedValue = entityFileResp?.data?.idMappedValue;
    console.log("idMappedValue", JSON.stringify(idMappedValue));

    const batchParams = {
      RequestItems: {
        [process.env.entitiesTableName]: [],
      },
    };

    for (const item of realtorList) {
      batchParams.RequestItems[process.env.entitiesTableName].push({
        PutRequest: {
          Item: {
            ...item,
            m_id:idMappedValue[item.rel_id]
          },
        },
      });
    }

    console.log(`batchParams: ${JSON.stringify(batchParams)}`);
    const batchWriteResp = await batchWriteItems(batchParams);
    console.log(`batchWriteResp: ${JSON.stringify(batchWriteResp)}`);
    const batchWriteBody = batchWriteResp.body
      ? JSON.parse(batchWriteResp.body)
      : {};
    console.log(`batchWriteBody: ${JSON.stringify(batchWriteBody)}`);
    const unProcessedItems =
      batchWriteBody &&
      batchWriteBody.resp &&
      batchWriteBody.resp.UnprocessedItems
        ? batchWriteBody.resp.UnprocessedItems
        : {};
    console.log(`unProcessedItems: ${JSON.stringify(unProcessedItems)}`);
    const isBatchSuccess = !!(
      Object.entries(unProcessedItems).length === 0 &&
      unProcessedItems.constructor === Object
    );
    console.log(`isBatchSuccess: ${JSON.stringify(isBatchSuccess)}`);

    if (!isBatchSuccess) {
      sendResponse.status = false;
      sendResponse.error = "Batch write failed";
      return sendResponse;
    }

    sendResponse.status = true;
    return sendResponse;
  } catch (error) {
    console.log("error in updateRealtor Lambda", JSON.stringify(error.stack));
    sendResponse.status = false;
    sendResponse.error = error.message;
    return sendResponse;
  }
}
