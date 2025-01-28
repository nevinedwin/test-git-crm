import "../../NPMLayer/nodejs.zip";

import { paginate } from "../../FunctionStack/search/search";
import { postResources } from "../../FunctionStack/libs/db";

export async function main(event) {
  // const retVal = { ...event };
  console.log(`import customer event: ${JSON.stringify(event)}`);
  try {
    const { id } = event;
    const requestBody = {
      queryParams: {
        size: 50,
        from: 0,
        sort: "mdt:desc",
      },
      queryMust: {
        type: "activity",
        "rel_id.keyword": id,
        atype: "stage_change",
      },
    };
    console.log(`requestBody: ${JSON.stringify(requestBody)}`);

    const recentStageActivityRes = await paginate(requestBody, true, false);
    console.log(
      `recentStageActivityRes: ${JSON.stringify(recentStageActivityRes)}`
    );

    const { data: stageActivityList } = recentStageActivityRes;
    console.log(`stageActivityList: ${JSON.stringify(stageActivityList)}`);

    if (stageActivityList && stageActivityList.length) {
      const { mdt } = stageActivityList[0];

      console.log(
        `stageActivityList[0]: ${JSON.stringify(stageActivityList[0])}`
      );

      if (mdt) {
        console.log(`In customer update if mdt`);
        const isoStringDate = new Date(mdt).toISOString();
        console.log(`isoStringDate: ${JSON.stringify(isoStringDate)}`);

        const updateCustomerRowParams = {
          TableName: process.env.entitiesTableName,
          Item: { ...event, mdt: Date.now(), stage_mdt_iso: isoStringDate },
        };

        console.log(
          `updateCustomerRowParams: ${JSON.stringify(updateCustomerRowParams)}`
        );

        const updateCustomerRes = await postResources(updateCustomerRowParams);
        console.log(`updateCustomerRes: ${JSON.stringify(updateCustomerRes)}`);
      }

      return true;
    }
  } catch (error) {
    console.log(`error: ${JSON.stringify(error)}`);
    return false;
  }
  return true;
}
