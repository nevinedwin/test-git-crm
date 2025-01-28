export async function main(event) {
  const sendResponse = {
    ...event,
    error: "",
    status: false,
  };
  try {

    let { rltrIdArray, realtorCount, hbId } = event;
    console.log(`event: ${JSON.stringify(event)}`);

    console.log(`rltrIdArray: ${JSON.stringify(rltrIdArray)}`);
    realtorCount += 1;

    sendResponse.status = true;
    sendResponse.realtorCount = realtorCount;
    sendResponse.rltrId = rltrIdArray[realtorCount];
    sendResponse.hasRealtor = realtorCount < rltrIdArray.length;
    return sendResponse;
  } catch (error) {
    console.log(`error: ${error.stack}`)
    sendResponse.error = error.message;
    sendResponse.status = false;
    return sendResponse;
  }
}