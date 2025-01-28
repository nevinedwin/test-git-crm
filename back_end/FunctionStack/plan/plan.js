/* eslint-disable camelcase */
import "../../NPMLayer/nodejs.zip";
import { v4 as uuidv4 } from "uuid";
import { failure, success } from "../libs/response-lib";
import { validate } from "../validation/validation";
import {
  doPaginatedQueryEllastic,
  getParamsForQuery,
  getResources,
  listEntitiesElastic,
  postResources,
  transactWriteItems,
} from "../libs/db";

const createPlan = async (data) => {
  try {
    const isValid = await validate("plan", data, "create");
    if (!isValid.status)
      return failure({ status: false, error: { msg: isValid.msg } });

    const currentDate = Date.now();

    const planItem = {
      type: "plan",
      hb_id: data.hb_id,
      name: data.name,
      cdt: currentDate,
      mdt: currentDate,
      isActive: data.isActive || false,
      num: data.num,
      ele: data.ele || "",
      comm_id: data.comm_id,
      base_prc: data.base_prc || "",
      img_file: data.img_file || "",
      img_thumb: data.img_thumb || "",
      des: data.des || "",
      bed: data.bed || "",
      bath: data.bath || "",
      sqft: data.sqft || "",
    };

    const planUUID = uuidv4();

    const planCreateItem = {
      TableName: process.env.entitiesTableName,
      Item: {
        id: planUUID,
        entity: `plan#${data.hb_id}`,
        ...planItem,
      },
    };

    console.log("planCreateItem", planCreateItem);

    return postResources(planCreateItem);
  } catch (error) {
    console.log("error in plan creation ", JSON.stringify(error.stacks));
    return failure({ status: false, error: error.message });
  }
};

const updatePlanRow = async (data) => {
  try {
    const isValid = await validate("plan", data, "update");
    if (!isValid.status)
      return failure({ status: false, error: { msg: isValid.msg } });

    const planUpdateItem = {
      TableName: process.env.entitiesTableName,
      Item: {
        id: data.id,
        entity: `plan#${data.hb_id}`,
        type: "plan",
        hb_id: data.hb_id,
        name: data.name,
        cdt: data.cdt,
        mdt: Date.now(),
        isActive: data.isActive || false,
        num: data.num,
        ele: data.ele || "",
        comm_id: data.comm_id,
        base_prc: data.base_prc || "",
        img_file: data.img_file || "",
        img_thumb: data.img_thumb || "",
        des: data.des || "",
        bed: data.bed || "",
        bath: data.bath || "",
        sqft: data.sqft || "",
      },
    };

    console.log("planUpdateItem", planUpdateItem);

    return postResources(planUpdateItem);
  } catch (error) {
    console.log("error in plan updation", JSON.stringify(error.stacks));
    return failure({ status: false, error: error.message });
  }
};

const getPlan = (event) => {
  const params = getParamsForQuery(event, "plan");
  return getResources(params);
};

export const listPlan = async (data) => {
  try {
    const filterParams = [];
    // filters = {
    // [
    // {
    //   key : 'Community',
    //   value:[]
    // },
    // {
    //   key:'isActive',
    //   value:true/false
    // }
    // ]
    // }//
    const { filters = [], listAll = false,isJSON=false } = data;

    for (const filter of filters) {
      if (filter.key === "Community" && filter.value && filter.value.length) {
        filterParams.push({
          terms: {
            "comm_id.keyword": filter.value,
          },
        });
      }
      if (filter.key === "isActive") {
        filterParams.push({
          match: {
            isActive: filter.value,
          },
        });
      }
    }

    const params = {
      ...data,
      entity: "plan",
      filterParams,
    };

    if (listAll) {
      const allPlans = await doPaginatedQueryEllastic(params);
      if(isJSON) return allPlans
      return success({ status: true, data: allPlans });
    }

    const plans = await listEntitiesElastic(params);

    if (!plans.status) return failure({ ...plans });

    return success({ ...plans });
  } catch (error) {
    console.log("error in plan listing", JSON.stringify(error.stacks));
    return failure({ status: false, error: error.message });
  }
};

export const deletePlan = async (data) => {
  try {
    const { id = "", hb_id: hbid = "", isTransArrOnly = false } = data;
    if (!id && !hbid)
      return failure({ status: false, error: "Id and hbid are required" });

    // deleting the respective property interests

    const customPropIntParams = [
      {
        match: {
          "plan_id.keyword": id,
        },
      },
      {
        match: {
          "type.keyword": "propInt",
        },
      },
    ];

    const propInts = await doPaginatedQueryEllastic({
      hb_id: hbid,
      isCustomParam: true,
      customParams: customPropIntParams,
    });

    console.log(`propInts: ${JSON.stringify(propInts)}`);

    const deletePropIntsArr = propInts.map((item) => ({
      Delete: {
        Key: {
          id: item.id,
          entity: item.entity,
        },
        TableName: process.env.entitiesTableName /* required */,
        ReturnValuesOnConditionCheckFailure: "ALL_OLD",
      },
    }));

    // Emptying the plan from the lot

    const customLotParams = [
      {
        match: {
          "plan_id.keyword": id,
        },
      },
      {
        match: {
          "type.keyword": "lot",
        },
      },
    ];

    const lots = await doPaginatedQueryEllastic({
      hb_id: hbid,
      isCustomParam: true,
      customParams: customLotParams,
    });

    console.log(`lots: ${JSON.stringify(lots)}`);

    const updateLotArr = lots.map((item) => ({
      Put: {
        Item: {
          ...item,
          plan_id: "",
        },
        TableName: process.env.entitiesTableName /* required */,
        ReturnValuesOnConditionCheckFailure: "ALL_OLD",
      },
    }));

    const transArr = [
      {
        Delete: {
          Key: {
            id,
            entity: `plan#${hbid}`,
          },
          TableName: process.env.entitiesTableName /* required */,
          ReturnValuesOnConditionCheckFailure: "ALL_OLD",
        },
      },
      ...deletePropIntsArr,
      ...updateLotArr,
    ];

    console.log(`transArr: ${JSON.stringify(transArr)}`);

    if (isTransArrOnly)
      return [
        {
          Delete: {
            Key: {
              id,
              entity: `plan#${hbid}`,
            },
            TableName: process.env.entitiesTableName /* required */,
            ReturnValuesOnConditionCheckFailure: "ALL_OLD",
          },
        },
        ...deletePropIntsArr,
      ];

    const transParams = {
      TransactItems: transArr,
    };
    console.log(`transParams: ${JSON.stringify(transParams)}`);
    return transactWriteItems(transParams);
  } catch (error) {
    console.log("error in deleteLot", JSON.stringify(error.stacks));
    return failure({ status: false, error: error.message });
  }
};

export async function main(event) {
  let response;
  try {
    console.log(`event: ${JSON.stringify(event)} `);
    const action =
      event && event.pathParameters && event.pathParameters.action
        ? event.pathParameters.action
        : 0;
    let data;
    switch (event.httpMethod) {
      case "GET":
        if (action === "get") {
          response = await getPlan(event);
        } else {
          response = failure();
        }
        break;
      case "POST":
        data = JSON.parse(event.body);
        if (!data) {
          response = failure();
        } else if (action === "create") {
          response = await createPlan(data);
        } else if (action === "update") {
          response = await updatePlanRow(data);
        } else if (action === "list") {
          response = await listPlan(data);
        }
        break;
      default:
        response = failure();
    }
  } catch (error) {
    console.log(`Exception in plan lambda: ${JSON.stringify(error.stacks)} `);
    return failure({ status: false, error: error.message });
  }
  return response;
}
