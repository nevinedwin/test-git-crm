import { getFileFromS3 } from "../fetchEntities/fetchEntities";

export async function main(event) {
  const sendResponse = {
    ...event,
    status: false,
    error: "",
  };
  try {
    console.log(JSON.stringify(event));
    const { entityListKey, count } = event;
    const { index, step } = event.iterator;
    // Get the customers from S3
    const entityFileResp = await getFileFromS3(entityListKey);
    console.log(`entityFileResp: ${JSON.stringify(entityFileResp)}`);
    if (!entityFileResp?.status) {
      sendResponse.status = false;
      sendResponse.error = entityFileResp.error;
      return sendResponse;
    }

    let customerList = entityFileResp?.data?.entities;

    customerList = customerList.slice(index, index + step);
    console.log("customerList", JSON.stringify(customerList));

    const idMappedValue = entityFileResp?.data?.idMappedValue;
    console.log("idMappedValue", JSON.stringify(idMappedValue));

    sendResponse.status = !!customerList.length;
    sendResponse.customerList = customerList;
    sendResponse.idMappedValue = idMappedValue;
    sendResponse.doSpawnExecution = index < count;
    return sendResponse;
  } catch (error) {
    console.log("error in prepareCustomer Lambda", JSON.stringify(error.stack));
    sendResponse.status = false;
    sendResponse.error = error.message;
    return sendResponse;
  }
}
