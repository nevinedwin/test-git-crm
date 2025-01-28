import "../../NPMLayer/nodejs.zip";
import { initUpdateEmailActivityExecution } from "../getbuilders/getbuilders";

export async function main(event) {
  console.log(event);
  let { index } = event.activityiterator;
  const { step = 100, count = 100 } = event.activityiterator;
  console.log(`index: ${index}`);
  console.log(`step: ${step}`);
  const {
    hb_id: hbId,
    hasAfter = false,
    ExclusiveStartKey,
    doGetActivitiesExecution = false,
    statusFileKey = "",
    BuildersApiFunctionArn,
    ActivitiesApiFunctionArn,
  } = event;
  console.log(`statusFileKey: ${statusFileKey}`);
  console.log(`doGetActivitiesExecution: ${doGetActivitiesExecution}`);
  console.log(`hasAfter: ${hasAfter}`);
  console.log(`ExclusiveStartKey: ${JSON.stringify(ExclusiveStartKey)}`);

  // Check whether doGetActivitiesExecution exists.
  // That indicates, this is not the initial iteration.
  // So, spawn a new execution, with updated index
  if (doGetActivitiesExecution) {
    await initUpdateEmailActivityExecution({
      hb_id: hbId,
      activityiterator: {
        index,
        count,
      },
      skipToEmailActivityUpdate: true, // This flag helps to skip straight to activity update iterator
      statusFileKey,
      hasAfter,
      ExclusiveStartKey,
      BuildersApiFunctionArn,
      ActivitiesApiFunctionArn,
    });
    return { continue: false };
  }
  if (index === -1) {
    index = 0;
  } else {
    index += step;
  }
  console.log(`index updated: ${index}`);
  const continueGetActivities = !!(index === 0 || hasAfter);
  console.log(`continueGetActivities: ${continueGetActivities}`);
  return {
    index,
    step,
    count,
    continue: continueGetActivities,
  };
}
