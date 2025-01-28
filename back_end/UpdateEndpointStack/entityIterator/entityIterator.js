import { initStepFunctionExecution } from "../../FunctionStack/libs/step-function";

const { MACHINE_ARN } = process.env;

export async function main(event) {
  console.log(event);
  const { count, type } = event;
  let { index } = event.iterator;
  const step = type === "customer" ? 200 : 500;

  const {
    hb_id: hbId,
    communityLambdaArn,
    agencyLambdaArn,
    coBuyerLambdaArn,
    entityListKey,
    purpose,
    doSpawnExecution = false
  } = event;

  if(doSpawnExecution){
    await initStepFunctionExecution(
      {
        hb_id: hbId,
        iterator: {
          index,
          count,
          step,
        },
        purpose,
        count,
        type,
        skipToIterator: true,
        communityLambdaArn,
        agencyLambdaArn,
        coBuyerLambdaArn,
        entityListKey
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
  return {
    index,
    step,
    count,
    continue: index < count,
  };
}
