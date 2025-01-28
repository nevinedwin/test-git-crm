import "../../NPMLayer/nodejs.zip";
import { initStepFunctionExecution } from "../../FunctionStack/libs/step-function";

const { MACHINE_ARN } = process.env;
export async function main(event) {
  console.log(event);
  let { index } = event.getcustomeriterator;
  const { step = 500, count = 100 } = event.getcustomeriterator;
  console.log(`index: ${index}`);
  console.log(`step: ${step}`);
  const {
    hb_id: hbId,
    statusFileKey = "",
    hasAfter = false,
    ExclusiveStartKey,
    doGetCustomerExecution = false,
    optin = false,
    BuildersApiFunctionArn = "",
    CustomersApiFunctionArn = "",
  } = event;
  console.log(`statusFileKey: ${statusFileKey}`);
  console.log(`doGetCustomerExecution: ${doGetCustomerExecution}`);
  console.log(`hasAfter: ${hasAfter}`);
  console.log(`ExclusiveStartKey: ${JSON.stringify(ExclusiveStartKey)}`);

  // Check whether doUpdate exists.
  // That indicates, this is not the initial iteration.
  // So, spawn a new execution, with updated index
  if (doGetCustomerExecution) {
    await initStepFunctionExecution(
      {
        hb_id: hbId,
        getcustomeriterator: {
          index,
          count,
          step,
        },
        skipToGetCustomerIterator: true,
        statusFileKey,
        hasAfter,
        ExclusiveStartKey,
        optin,
        BuildersApiFunctionArn,
        CustomersApiFunctionArn,
        purpose: ''
      },
      MACHINE_ARN
    );
    return { continue: false };
  }
  if (index === -1) {
    index = 0;
  } else {
    index += step;
  }
  console.log(`index updated: ${index}`);
  const continueGetCustomer = !!(index === 0 || hasAfter);
  console.log(`continueGetCustomer: ${continueGetCustomer}`);
  return {
    index,
    step,
    count,
    continue: continueGetCustomer,
    skipToGetCustomerIterator: false,
    purpose: ''
  };
}
