export const main = async (event) => {
  let sendResponse = {
    ...event,
    error: "",
    status: false
  };
  try {
    let { fieldArray, fieldCount } = event;
    console.log(`Event: ${JSON.stringify(event)}`);
    fieldCount += 1;
    sendResponse = {
      ...sendResponse,
      status: true,
      fieldId: fieldArray[fieldCount],
      hasField: fieldCount < fieldArray.length,
      fieldCount
    };
  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`);
    sendResponse = {
      ...sendResponse,
      error: error.message
    };
  };
  return sendResponse;
};