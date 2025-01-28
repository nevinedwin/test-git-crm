import AWS from "aws-sdk";
import moment from "moment-timezone";

import { invokeLambda } from "../../FunctionStack/libs/lambda";
import { elasticExecuteQuery } from "../../FunctionStack/search/search";
// import { createActivity } from "../../FunctionStack/activities/activities";
// import { getCampaign, getJourney } from "../../FunctionStack/campaign/campaign";

const cloudformation = new AWS.CloudFormation({ apiVersion: "2010-05-15" });
console.log("Loading function");
let ACTIVITY_LAMBDA_ARN = "";
let CAMPAIGN_LAMBDA_ARN = "";
const { PROJECT_NAME } = process.env;
const getStackOutputs = async () => {
  // Get the outputs of the root stack
  const cloudformationParams = {
    StackName: PROJECT_NAME,
  };
  console.log("cloudformationParams: ", cloudformationParams);
  try {
    const describeStacksResp = await cloudformation
      .describeStacks(cloudformationParams)
      .promise();
    console.log(`describeStacksResp: ${JSON.stringify(describeStacksResp)}`);
    const stackOutputs =
      describeStacksResp &&
      describeStacksResp.Stacks &&
      describeStacksResp.Stacks.length &&
      describeStacksResp.Stacks[0].Outputs
        ? describeStacksResp.Stacks[0].Outputs
        : [];
    console.log(`stackOutputs: ${JSON.stringify(stackOutputs)}`);
    for (const stackOutput of stackOutputs) {
      switch (stackOutput.OutputKey) {
        case "ActivitiesApiFunctionArn":
          ACTIVITY_LAMBDA_ARN = stackOutput.OutputValue;
          break;
        case "CampaignApiFunctionArn":
          CAMPAIGN_LAMBDA_ARN = stackOutput.OutputValue;
          break;
        default:
          break;
      }
    }
  } catch (error) {
    console.log(`error: `);
    console.log(error);
  }
};
const initLambdaInvoke = async ({
  action = "",
  httpMethod = "",
  body = null,
  arn = "",
  type = "",
  isActivity = false,
}) => {
  if (action && httpMethod && body && arn) {
    // Prepare the data for lambda event
    const eventObj = {
      httpMethod,
      pathParameters: {
        action,
      },
    };
    // Use body inside eventObj.pathParameters if httpMethod is GET. Otherwise as Body
    if (httpMethod === "GET")
      eventObj.pathParameters = { ...eventObj.pathParameters, ...body };
    else eventObj.body = JSON.stringify(body, null, 2);
    // Add type if supplied as a parameter
    if (type) eventObj.pathParameters.type = type;
    console.log(`arn: ${arn}`);
    console.log(`eventObj: ${JSON.stringify(eventObj)}`);
    const invokeEventResp = await invokeLambda(arn, eventObj, false);
    let { Payload: response } = invokeEventResp;
    response = JSON.parse(response);
    let { body: respBody } = response;
    respBody = JSON.parse(respBody);
    if (!isActivity) {
      return respBody?.data || {};
    }
    return respBody;
  }
  return { status: false, error: "Please provide valid parameters" };
};
const getActivityParams = async ({
  isJourneySend,
  appId,
  campaignOrJourneyId,
  journeyActivityId,
}) => {
  console.log(`isJourneySend: ${isJourneySend}`);
  console.log(`appId: ${appId}`);
  console.log(`campaignOrJourneyId: ${campaignOrJourneyId}`);
  console.log(`journeyActivityId: ${journeyActivityId}`);
  let campaignReqObj;
  let campJourneyResp;
  let segmentId;
  let campaignName;
  let journeySchedule;
  let campaignStatus;
  let campaignDescription;
  let journeyActivityType;
  let isJourney;
  let campaignSchedule;
  const doGetCall = async () =>
    initLambdaInvoke({
      action: "get",
      httpMethod: isJourney ? "POST" : "GET",
      body: campaignReqObj,
      arn: CAMPAIGN_LAMBDA_ARN,
      type: isJourney ? "journey" : "campaign",
    });
  if (isJourneySend) {
    isJourney = true;
    campaignReqObj = {
      appid: appId,
      jid: campaignOrJourneyId,
    };
    // Get journey details
    try {
      campJourneyResp = await doGetCall();
      console.log("campJourneyResp Journey: ", campJourneyResp);
    } catch (error) {
      console.log("Exception get campaign: ");
      console.log(error);
    }
    // campJourneyResp = await getJourney(campaignReqObj, true);
    console.log("campJourneyResp: ", campJourneyResp);
    const {
      JourneyResponse: {
        Activities = {},
        StartCondition: {
          SegmentStartCondition: { SegmentId = "" } = {},
          Description = "",
        } = {},
        Name = "",
        Schedule = {},
        State = "",
      } = {},
    } = campJourneyResp;
    segmentId = SegmentId;
    campaignName = Name;
    journeySchedule = Schedule;
    campaignStatus = State;
    campaignDescription = Description;

    // Find the journey activity type
    for (const [key, item] of Object.entries(Activities)) {
      console.log(key);
      // Find the matching item
      if (key === journeyActivityId) {
        console.log(item);
        const { CUSTOM: { MessageConfig: { Data = "" } = {} } = {} } = item;
        const [, activityType = "EMAIL"] = Data?.split("|") || [];
        journeyActivityType = activityType;
      }
    }
  } else {
    campaignReqObj = {
      hbid: appId,
      id: campaignOrJourneyId,
    };
    // Get campaign details
    try {
      campJourneyResp = await doGetCall();
      console.log("campJourneyResp Campaign: ", campJourneyResp);
    } catch (error) {
      console.log("Exception get campaign: ");
      console.log(error);
    }
    const {
      CampaignResponse: {
        SegmentId = "",
        Name = "",
        Schedule = {},
        State: { CampaignStatus = "" } = {},
        Description = "",
      } = {},
    } = campJourneyResp;
    segmentId = SegmentId;
    campaignName = Name;
    campaignSchedule = Schedule;
    campaignStatus = CampaignStatus;
    campaignDescription = Description;
  }
  return {
    campaignSchedule,
    journeySchedule,
    segmentId,
    campaignName,
    campaignStatus,
    campaignDescription,
    journeyActivityType,
    isJourney,
  };
};
const createCampaignActivity = async ({
  campaignSchedule = {},
  endpointId,
  homeBuilderId,
  appId,
  campaignOrJourneyId,
  segmentId,
  campaignName,
  journeySchedule,
  campaignStatus,
  campaignDescription,
  isJourney,
  journeyActivityType,
}) => {
  const createActRespArr = [];
  const { Timezone = "", StartTime = "" } = campaignSchedule;
  const csch = { Timezone };
  if (StartTime === "IMMEDIATE") {
    console.log("In StartTime === 'IMMEDIATE' if");
    csch.StartTimeText = StartTime;
    const creationDate = Date.now();
    csch.StartTimeDate = new Date(creationDate).toISOString();
  } else if (Date.parse(StartTime)) {
    console.log("In Date.parse(StartTime) if");
    csch.StartTimeText = "";
    csch.StartTimeDate = StartTime;
  }
  const activityReqObj = {
    rel_id: endpointId,
    hb_id: homeBuilderId,
    acti: {
      appid: appId,
      campid: campaignOrJourneyId,
      atype: "campaign",
      segid: segmentId,
      campnm: campaignName,
      csch: campaignSchedule,
      jsch: journeySchedule,
      campst: campaignStatus,
      campdsc: campaignDescription,
      isj: isJourney,
      jatype: isJourney ? journeyActivityType : null,
    },
    isAnalytics: true,
  };
  console.log(`activityReqObj: ${JSON.stringify(activityReqObj)}`);
  // Create activity
  try {
    // const createActResp = await createActivity(activityReqObj);
    const createActivityResp = await initLambdaInvoke({
      action: "create",
      httpMethod: "POST",
      body: activityReqObj,
      arn: ACTIVITY_LAMBDA_ARN,
      isActivity: true,
    });
    console.log("createActivityResp: ", createActivityResp);
    createActRespArr.push(createActivityResp);
  } catch (error) {
    console.log("Exception create activity: ");
    console.log(error);
  }
  return createActRespArr;
};
const processRecordsForActivity = async (records) => {
  console.log(`records: ${JSON.stringify(records)}`);
  let createActRespArr = [];
  try {
    // Get the stack outputs for getting the ARN of lambda functions
    // This is done this way due to circular dependency when passed through the template
    await getStackOutputs();

    for (const record of records) {
      const message = Buffer.from(record.data, "base64");
      const payloadString = message.toString("utf8");
      const payload = JSON.parse(payloadString);
      console.log(`Decoded payload: ${JSON.stringify(payload)}`);
      const isJourneySend = payload.event_type === "_journey.send";
      const isCampaignSend = payload.event_type === "_campaign.send";

      // Only proceed for campaign or journey send events
      if (isCampaignSend || isJourneySend) {
        // Extract campaign or journey event info
        let {
          client_context: { custom: { endpoint: endpointInfo = {} } = {} } = {},
        } = payload;
        endpointInfo = JSON.parse(endpointInfo);
        const {
          client: { client_id: endpointId = "" } = {},
          application: { app_id: appId = "" } = {},
          attributes: {
            campaign_id: campaignId = "",
            journey_id: journeyId = "",
            journey_activity_id: journeyActivityId = "",
          } = {},
        } = payload;
        const { User: { UserAttributes: { hb_id: hbId = "" } = {} } = {} } =
          endpointInfo;
        const [homeBuilderId] = hbId;

        let campaignOrJourneyId = "";
        if (isCampaignSend) {
          campaignOrJourneyId = campaignId;
        } else campaignOrJourneyId = journeyId;

        /* ####################### 
        This check is added to prevent campaign duplication issue, if same event comes again within 30 minutes.
        #############################
        */
        if (isCampaignSend) {
          const campaignCheckQuery = {
            httpMethod: "POST",
            requestPath: "/_count",
            payload: {
              query: {
                bool: {
                  must: [
                    {
                      match: {
                        "id.keyword": endpointId,
                      },
                    },
                    {
                      match: {
                        "atype.keyword": "campaign",
                      },
                    },
                    {
                      match: {
                        "appid.keyword": appId,
                      },
                    },
                    {
                      match: {
                        "campid.keyword": campaignOrJourneyId,
                      },
                    },
                    {
                      range: {
                        cdt: {
                          gte: moment(Date.now())
                            .subtract(30, "minutes")
                            .valueOf(),
                        },
                      },
                    },
                  ],
                },
              },
            },
          };

          const campaignCount = await elasticExecuteQuery(
            campaignCheckQuery,
            true
          );

          console.log("campaignCount==>", campaignCount);

          if (!campaignCount.status)
            return { status: "false", msg: "Campaign count fetching Failed" };

          if (campaignCount?.body?.count)
            return {
              status: "false",
              msg: "Campaign activity is already created for this event",
            };
        }

        // Get activity params
        const {
          campaignSchedule,
          journeySchedule,
          segmentId,
          campaignName,
          campaignStatus,
          campaignDescription,
          journeyActivityType,
          isJourney,
        } = await getActivityParams({
          isJourneySend,
          appId,
          campaignOrJourneyId,
          journeyActivityId,
        });

        console.log("campaignSchedule: ", campaignSchedule);
        console.log("journeySchedule: ", journeySchedule);

        // Create activities
        createActRespArr = await createCampaignActivity({
          campaignSchedule,
          endpointId,
          homeBuilderId,
          appId,
          campaignOrJourneyId,
          segmentId,
          campaignName,
          journeySchedule,
          campaignStatus,
          campaignDescription,
          isJourney,
          journeyActivityType,
        });
        console.log(`createActRespArr: ${JSON.stringify(createActRespArr)}`);
      }
    }
  } catch (error) {
    console.log("Exception occured in processRecordsForActivity: ");
    console.log(error);
  }
  return createActRespArr;
};
export async function main(event) {
  try {
    console.log(`event: ${JSON.stringify(event)}`);
    /* Process the list of records and transform them */
    const processAndCreateActivityResp = await processRecordsForActivity(
      event.records
    );
    console.log(
      `processAndCreateActivityResp: ${JSON.stringify(
        processAndCreateActivityResp
      )}`
    );
  } catch (error) {
    console.log("Exception creating activity: ");
    console.log(error);
  }
  const output = event.records.map((record) => ({
    /* This transformation is the "identity" transformation, the data is left intact */
    recordId: record.recordId,
    result: "Ok",
    data: record.data,
  }));
  console.log(`Processing completed.  Successful records ${output.length}.`);
  return { records: output };
}
