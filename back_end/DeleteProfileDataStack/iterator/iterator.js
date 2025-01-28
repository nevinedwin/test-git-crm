import { initStepFunctionExecution } from "../../FunctionStack/libs/step-function";

const {DELETE_PROFILE_DATA_STATEMACHINE_ARN} = process.env;

export const main = async (event) => {
  let sendResponse = {
    ...event,
    status: false
  };
  try {
    console.log(`Event: ${JSON.stringify(event)}`);
    let {
      count,
      doNewExecution = false,
      iterator: {
        index,
        step
      }
    } = event;

    console.log(`index: ${index}`)
    console.log(`step: ${step}`)
    if(index === -1){
      index = 0;
    };

    if (doNewExecution) {
      await initStepFunctionExecution({
        ...event,
        isStart: count !== 0 && index > count,
        doNewExecution: false,
      }, DELETE_PROFILE_DATA_STATEMACHINE_ARN)
      sendResponse = {
        ...sendResponse,
        status: true,
        newStepFunctionStarted: true,
        iterator: {
          ...sendResponse.iterator,
          continue: false
        }
      };

      return sendResponse;
    };

    sendResponse = {
      ...sendResponse,
      status: true,
      newStepFunctionStarted: false,
      takeIndex: false,
      iterator: {
        ...sendResponse.iterator,
        index,
        step,
        count,
        continue: count !== 0 && index < count,
      }
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