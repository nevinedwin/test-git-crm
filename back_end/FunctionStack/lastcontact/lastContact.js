import { initLambdaInvoke } from "../libs/lambda";
import { failure, success } from "../libs/response-lib";

const aws = require("aws-sdk");

const { CUSTOMER_LAMBDA_ARN } = process.env;
const cwEvents = new aws.CloudWatchEvents();

export async function deleteSchedule({ruleName, targetId}){
  try {

    // First remove the targets in the rule
    const removeTargetParams = {
      Ids: [
        targetId
      ],
      Rule: ruleName,
      Force: true
    }
    console.log(`removeTargetParams :: ${JSON.stringify(removeTargetParams)}`);
    const removeTargetResp = await cwEvents.removeTargets(removeTargetParams).promise();
    console.log(`removeTargetResp :: `, removeTargetResp);
    
    // Finally remove the rule
    const deleteRuleParams = {
      Name: ruleName,
      Force: true
    }
    console.log(`deleteRuleParams :: ${JSON.stringify(deleteRuleParams)}`);
    const deleteRuleResp = await cwEvents.deleteRule(deleteRuleParams).promise();
    console.log(`deleteRuleResp :: `, deleteRuleResp);
    return success({status: true})
  } catch (error) {
    console.log(`Error in deleteSchedule :: `, error);
    throw new Error(error);
  }
}

export async function main(event){
  try {
    console.log(`Event :: ${JSON.stringify(event)}`);
    const { hbId, id } = event;
    const customerLambdaParams = {
      arn: CUSTOMER_LAMBDA_ARN,
      action: "update",
      httpMethod: "POST",
      body: {hb_id: hbId, id, attrn: 'dt', attrv: Date.now()}
    }
    // Update the dt field in customer to track last contact
    const updateResp = await initLambdaInvoke(customerLambdaParams);
    console.log(`updateResp :: ${JSON.stringify(updateResp)}`);
    // Now delete the schedule rule created
    const deleteResp = await deleteSchedule(event);
    console.log(`deleteResp :: `, deleteResp);
    return success({status: true});
  } catch (error) {
    console.log(`lastContact error :: `, error);
    return failure({status: false, error})
  }
}