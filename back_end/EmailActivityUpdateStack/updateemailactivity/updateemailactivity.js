/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import { postResources } from "../../FunctionStack/libs/db";

const updateActivity = async (Item) => {
  console.log("In updateActivity");
  console.log(`Item: ${JSON.stringify(Item)}`);
  let activityUpdateResp;
  try {
    activityUpdateResp = await postResources({
      TableName: process.env.entitiesTableName,
      Item,
    });
    console.log(`activityUpdateResp: ${JSON.stringify(activityUpdateResp)}`);
  } catch (error) {
    console.log(`Exception occured at updateActivity`);
    console.log(error);
    activityUpdateResp = error;
  }
  return activityUpdateResp;
};
export async function main(event) {
  console.log(JSON.stringify(event));
  let response;
  try {
    const { list: activity } = event;
    console.log(`activity: ${JSON.stringify(activity)}`);
    const {
      campsch: campaignSchedule = null,
      cdt: creationDate,
      csch: updatedCampaginSchedule = null,
    } = activity;
    console.log(`campaignSchedule: ${JSON.stringify(campaignSchedule)}`);
    console.log(`creationDate: ${creationDate}`);
    const { StartTime = "", Timezone = "", EndTime = "" } = campaignSchedule;
    console.log(`StartTime: ${StartTime}`);
    console.log(`Timezone: ${Timezone}`);
    console.log(`EndTime: ${EndTime}`);
    // If StartTime exists and updatedCampaginSchedule is not present already
    if (StartTime && !updatedCampaginSchedule) {
      console.log("In StartTime if");
      // This is a campaign activity
      const activityParams = JSON.parse(JSON.stringify(activity));
      activityParams.campsch = {};
      if (StartTime === "IMMEDIATE") {
        console.log("In StartTime === 'IMMEDIATE' if");
        activityParams.csch = {
          StartTimeText: StartTime,
          StartTimeDate: new Date(creationDate).toISOString(),
          Timezone,
        };
      } else if (Date.parse(StartTime)) {
        console.log("In Date.parse(StartTime) if");
        activityParams.csch = {
          StartTimeText: "",
          StartTimeDate: StartTime,
          Timezone,
        };
      }
      if (EndTime) {
        console.log("In EndTime if");
        activityParams.csch.EndTimeText = "";
        activityParams.csch.EndTimeDate = EndTime;
      }
      // Update the activity with new field
      const updateActivityResp = await updateActivity(activityParams);
      console.log(`updateActivityResp: ${JSON.stringify(updateActivityResp)}`);
    }
    response = true;
  } catch (error) {
    console.log(`Exception at main`);
    console.log(error);
    response = false;
  }
  return response;
}
