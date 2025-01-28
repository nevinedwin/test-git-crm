import AWS from "aws-sdk";
import { getResourceJSON } from "../../FunctionStack/libs/db";

const { LEAD_TRANSFER_STATE_MACHINE_ARN } = process.env;
const sfn = new AWS.StepFunctions();
const getBuilders = async (builderEmail) => {
  let builderResp;
  const params = {
    TableName: process.env.entitiesTableName,
    IndexName: process.env.entitiesTableByEntityAndId,
    KeyConditionExpression: "#entity = :entity",
    FilterExpression: "#email =:email",
    ExpressionAttributeNames: {
      "#entity": "entity",
      "#email": "email",
    },
    ExpressionAttributeValues: {
      ":entity": "builder",
      ":email": builderEmail,
    },
  };
  try {
    builderResp = await getResourceJSON(params);
    console.log(`builderResp: ${JSON.stringify(builderResp)}`);
  } catch (error) {
    console.log(`Exception at getBuilders`);
    console.log(error);
    builderResp = error;
  }
  return builderResp;
};
export async function main(event) {
  console.log(event);
  /* {
    token: 'MTU1ZTI5MTMtYzZjNS00ZjljLWJmMDgtNWVmNWY5YzgwOTc5',
    serviceMetadata: {
      executionDetails: {
        workflowId: 'w-2b5f622d8b4fb9da7',
        executionId: '9cae8e59-cb2c-4c35-946b-09ef164e0271'
      },
      transferDetails: {
        sessionId: '64d3f1aa1a3e7082',
        userName: 'dev@hyphencrm.com',
        serverId: 's-ecf12737580c4efaa'
      }
    },
    fileLocation: {
      domain: 'S3',
      bucket: 'crm-imp-frontend-dev-s3',
      key: 'transfer/dev@hyphencrm.com/leads.xml',
      eTag: 'eadb09de36978323387d2e96db5f1ca0',
      versionId: 'pxXtYRCOvWu78Q0T8b.O.YHQOu3.trip'
    }
  } */
  const {
    serviceMetadata: { transferDetails },
    fileLocation,
  } = event;
  const { userName: builderEmail } = transferDetails;
  if (builderEmail) {
    // Get the builder details for hb_id
    const getBuilderDetails = await getBuilders(builderEmail);
    console.log(`getBuilderDetails: ${JSON.stringify(getBuilderDetails)}`);

    const {
      rnstr,
      id,
      appid,
      zillow_psrc = "",
      zillow_infl = "",
      zillow_cmt_to_note_sub = "",
      zillow_cmt_to_note = false,
    } = getBuilderDetails?.length ? getBuilderDetails[0] : {};
    // Initiate the transfer process by starting step function execution
    const input = JSON.stringify({
      hb_id: id,
      fileLocation,
      builderEmail,
      rnstr,
      appid,
      zillow_psrc,
      zillow_infl,
      zillow_cmt_to_note_sub,
      zillow_cmt_to_note,
    });
    const params = {
      input,
      stateMachineArn: LEAD_TRANSFER_STATE_MACHINE_ARN,
    };
    try {
      console.log(`params: ${JSON.stringify(params)}`);
      const startExecutionResp = await sfn.startExecution(params).promise();
      console.log(`startExecutionResp: ${JSON.stringify(startExecutionResp)}`);
      return { status: true };
    } catch (error) {
      console.log(`error`);
      console.log(error);
      return { status: false, error };
    }
  }
  return true;
}
