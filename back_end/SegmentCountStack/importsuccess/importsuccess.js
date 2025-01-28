/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import { v4 as uuidv4 } from "uuid";
import { getResourceJSON, postResources } from "../../FunctionStack/libs/db";
import { getFileFromS3 } from "../getsegmentlist/getsegmentlist";

// const CUSTOMER_FILE_STATUS_COMPLETED = "COMPLETED";
export const getEntities = async (entity) => {
  const params = {
    TableName: process.env.entitiesTableName,
    IndexName: process.env.entitiesTableByEntityAndId,
    KeyConditionExpression: "#entity = :entity",
    ExpressionAttributeNames: {
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":entity": entity,
    },
  };
  console.log(params);
  return getResourceJSON(params);
};
const saveToDB = async (obj) => {
  const { hbid, appid, segcount } = obj;
  const type = "count";
  const updatedDate = Date.now();
  let id = uuidv4();
  let creationDate = Date.now();
  // Decide whether it is create or update
  // Fetch count resource for the home builder
  const countResource = await getEntities(`${type}#${hbid}`);
  console.log(`countResource: ${JSON.stringify(countResource)}`);
  if (countResource && countResource.length) {
    // Already exists
    id = countResource[0].id;
    creationDate = countResource[0].cdt;
  }
  const params = {
    TableName: process.env.entitiesTableName,
    Item: {
      id,
      type,
      appid,
      entity: `${type}#${hbid}`,
      count: segcount,
      cdt: creationDate,
      mdt: updatedDate,
    },
  };
  console.log(params);
  return postResources(params);
};
export async function main(event) {
  console.log(`event: ${JSON.stringify(event)}`);
  const { fileKey } = event;
  // Get the campaignIdList file from s3
  const campaignIdList = await getFileFromS3(fileKey);
  console.log(`campaignIdList: ${JSON.stringify(campaignIdList)}`);
  const { appBuilderIds, segmentEndpointCount, segmentCampaignCount } =
    campaignIdList;
  // Save the count for each builder in DB
  for (const appId in segmentEndpointCount) {
    if (appId) {
      const saveToDBParams = {
        hbid: appBuilderIds[appId],
        appid: appId,
      };
      for (const segmentId in segmentEndpointCount[appId]) {
        if (segmentId) {
          saveToDBParams.segcount = {
            ...saveToDBParams.segcount,
            ...{
              [segmentId]: {
                ...segmentEndpointCount[appId][segmentId],
                ...segmentCampaignCount[appId][segmentId],
              },
            },
          };
        }
      }
      const saveToDBResp = await saveToDB(saveToDBParams);
      console.log(`saveToDBResp: ${JSON.stringify(saveToDBResp)}`);
    }
  }
  return { ...event };
}
