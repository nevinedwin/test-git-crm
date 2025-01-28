/* eslint-disable camelcase */
import "../../NPMLayer/nodejs.zip";
import { v4 as uuidv4 } from "uuid";
import { failure, success } from "../libs/response-lib";
import { validate } from "../validation/validation";
import {
  batchWriteItems,
  doPaginatedQueryEllastic,
  getParamsForQuery,
  getResources,
  listEntitiesElastic,
  listOrder,
  postResources,
  transactWriteItems,
  updateResources,
} from "../libs/db";
import { initLambdaInvoke, invokeLambda } from "../libs/lambda";

const { STAGE_LAMBDA_ARN } = process.env;

const createLotStage = async (lotId, hb_id) => {
  try {
    const batchParams = {
      RequestItems: {
        [process.env.entitiesTableName]: [],
      },
    };
    // Get all the stages
    let stages = await initLambdaInvoke({
      action: "list",
      httpMethod: "GET",
      body: { hbid: hb_id, id: 0 },
      arn: STAGE_LAMBDA_ARN,
      getBody: true,
    });
    console.log("stages", stages);

    // filter active stages
    stages = stages.filter((stage) => stage.isActive === true);
    console.log("Filtered stage", stages);

    const currentDate = Date.now();

    if (stages.length) {
      for (const stage of stages) {
        const lotStageUUID = uuidv4();
        const lotStageCreateItem = {
          id: lotId,
          entity: `lot_stage#${hb_id}#${stage.id}`,
          type: "lot_stage",
          hb_id,
          lot_id: lotId,
          stage_id: stage.id,
          data: lotStageUUID,
          cdt: currentDate,
          mdt: currentDate,
          start_dt: "",
          end_dt: "",
          note: "",
        };
        batchParams.RequestItems[process.env.entitiesTableName].push({
          PutRequest: {
            Item: lotStageCreateItem,
          },
        });
      }

      console.log(`batchParams: ${JSON.stringify(batchParams)}`);
      const batchWriteResp = await batchWriteItems(batchParams);
      console.log(`batchWriteResp: ${JSON.stringify(batchWriteResp)}`);
      const batchWriteBody = batchWriteResp.body
        ? JSON.parse(batchWriteResp.body)
        : {};
      console.log(`batchWriteBody: ${JSON.stringify(batchWriteBody)}`);
      const unProcessedItems =
        batchWriteBody &&
        batchWriteBody.resp &&
        batchWriteBody.resp.UnprocessedItems
          ? batchWriteBody.resp.UnprocessedItems
          : {};
      console.log(`unProcessedItems: ${JSON.stringify(unProcessedItems)}`);
      const isBatchSuccess = !!(
        Object.entries(unProcessedItems).length === 0 &&
        unProcessedItems.constructor === Object
      );
      console.log(`isBatchSuccess: ${JSON.stringify(isBatchSuccess)}`);

      if (isBatchSuccess) {
        return { status: isBatchSuccess, data: "Processed Successfully" };
      }
      return {
        status: isBatchSuccess,
        error: `Lot stage creation failed with error(s).`,
      };
    }
    return {
      status: true,
      error: `No stages are present`,
    };
  } catch (error) {
    console.log("error in createLotStage", JSON.stringify(error.stacks));
    return { status: false, error: error.message };
  }
};

function parseData(data) {
  if (!data) return "";
  if (typeof data === "object") return data;
  if (typeof data === "string") return JSON.parse(data);

  return "";
}

const createLot = async (data) => {
  try {
    const isValid = await validate("lot", data, "create");
    if (!isValid.status)
      return failure({ status: false, error: { msg: isValid.msg } });

    const currentDate = Date.now();

    const crr_st = parseData(data?.crr_st);

    const lotItem = {
      type: "lot",
      hb_id: data.hb_id,
      name: data.name,
      cdt: currentDate,
      mdt: currentDate,
      isActive: data.isActive || false,
      num: data.num,
      sts: data.sts,
      plan_id: data.plan_id || "",
      plan:isValid?.result?.plan ||"",
      comm_id: data.comm_id,
      comm:isValid?.result?.comm ||"",
      addr: data.addr || "",
      img_file: data.img_file || "",
      img_thumb: data.img_thumb || "",
      premium: data.premium || "",
      des: data.des || "",
      sqft: data.sqft || "",
      crr_st: crr_st ? JSON.stringify(crr_st) : "",
      stage_id: crr_st ? crr_st?.id : "",
    };

    const lotUUID = uuidv4();

    const lotCreateItem = {
      TableName: process.env.entitiesTableName,
      Item: {
        id: lotUUID,
        entity: `lot#${data.hb_id}`,
        ...lotItem,
      },
    };

    console.log("lotCreateItem", lotCreateItem);

    const postResourcesRes = await postResources(lotCreateItem, true);

    console.log("postResourcesRes", JSON.stringify(postResourcesRes));

    if (!postResourcesRes.status)
      return failure({ status: false, error: postResourcesRes.error });

    const createLotStageRes = await createLotStage(lotUUID, data.hb_id);

    console.log("createLotStageRes", JSON.stringify(createLotStageRes));

    return success({ status: true, item: { id: lotCreateItem.Item.id } });
  } catch (error) {
    console.log("error in lot creation", JSON.stringify(error.stacks));
    return failure({ status: false, error: error.message });
  }
};

const updateLotRow = async (data) => {
  try {
    const isValid = await validate("lot", data, "update");
    if (!isValid.status)
      return failure({ status: false, error: { msg: isValid.msg } });

    const crr_st = parseData(data?.crr_st);

    const lotUpdateItem = {
      TableName: process.env.entitiesTableName,
      Item: {
        id: data.id,
        entity: `lot#${data.hb_id}`,
        type: "lot",
        hb_id: data.hb_id,
        name: data.name,
        cdt: data.cdt,
        mdt: Date.now(),
        isActive: data.isActive || false,
        num: data.num,
        sts: data.sts,
        plan_id: data.plan_id || "",
        comm_id: data.comm_id,
        addr: data.addr || "",
        img_file: data.img_file || "",
        img_thumb: data.img_thumb || "",
        premium: data.premium || "",
        des: data.des || "",
        sqft: data.sqft || "",
        crr_st: crr_st ? JSON.stringify(crr_st) : "",
        stage_id: crr_st ? crr_st?.id : "",
        plan:isValid?.result?.plan ||"",
        comm:isValid?.result?.comm ||"",
      },
    };

    console.log("lotUpdateItem", lotUpdateItem);

    return postResources(lotUpdateItem);
  } catch (error) {
    console.log("error in lot updation", JSON.stringify(error.stacks));
    return failure({ status: false, error: error.message });
  }
};

export const listLot = async (data) => {
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
    // }
    const { filters = [], listAll = false, isJSON = false } = data;

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
      entity: "lot",
      filterParams,
    };

    if (listAll) {
      const allLots = await doPaginatedQueryEllastic(params);
      if (isJSON) return allLots;
      return success({ status: true, data: allLots });
    }

    const lots = await listEntitiesElastic(params);

    if (!lots.status) return failure({ ...lots });

    return success({ ...lots });
  } catch (error) {
    console.log("error in lot listing", JSON.stringify(error.stacks));
    return failure({ status: false, error: error.message });
  }
};

const getLot = (event) => {
  const params = getParamsForQuery(event, "lot");
  return getResources(params);
};

const applyStageOrder = async (data = [], hbId) => {
  let result = data;
  try {
    const event = {
      pathParameters: {
        hbid: hbId,
      },
    };

    const StageOrderResp = await listOrder("stage", event, true);
    console.log(`StageOrderResp: ${JSON.stringify(StageOrderResp)}`);

    const orderData = StageOrderResp[0].order_data || [];
    const merged = [];
    for (let i = 0; i < data.length; i += 1) {
      const pos = orderData.find(
        (itmInner) => itmInner.id === data[i].stage_id
      );
      merged.push({
        ...data[i],
        pos: pos ? pos?.pos : undefined,
      });
    }
    result = merged;
  } catch (error) {
    console.log("error in applyStageOrder", JSON.stringify(error.stacks));
  }
  return result;
};

const listLotStage = async (data) => {
  try {
    const { hb_id: hbId = "", lot_id = "", listAll = false } = data;

    if (!lot_id || !hbId)
      return failure({
        status: false,
        error: { msg: "Lot Id and hb_id are required" },
      });

    const customParams = [
      {
        match: {
          "id.keyword": lot_id,
        },
      },
      {
        match: {
          "type.keyword": "lot_stage",
        },
      },
    ];

    const params = {
      ...data,
      isCustomParam: true,
      customParams,
    };

    if (listAll) {
      let allPlans = await doPaginatedQueryEllastic(params);
      if (allPlans && allPlans.length) {
        allPlans = await applyStageOrder(allPlans, hbId);
      }
      return success({ status: true, data: allPlans });
    }

    const lotStages = await listEntitiesElastic(params);

    if (!lotStages.status) return failure({ ...lotStages });

    if (lotStages.result && lotStages.result.length) {
      // combining the result with the stage order
      lotStages.result = await applyStageOrder(lotStages.result, hbId);
    }

    return success({ ...lotStages });
  } catch (error) {
    console.log("error in listLotStage", JSON.stringify(error.stacks));
    return failure({ status: false, error: error.message });
  }
};

const updateLotStage = async (data) => {
  try {
    const {
      id,
      entity,
      hb_id,
      cdt = "",
      note = "",
      start_dt = "",
      end_dt = "",
      lot_id = "",
      stage_id = "",
      sendMail = false,
    } = data;
    if (!hb_id)
      return failure({ status: false, error: "Home Builder ID Required" });
    if (!id) return failure({ status: false, error: "ID Required" });
    if (!cdt) return failure({ status: false, error: "Created date Required" });
    if (!entity) return failure({ status: false, error: "Entity Required" });
    if (!lot_id) return failure({ status: false, error: "Lot Required" });
    if (!stage_id) return failure({ status: false, error: "Stage Required" });

    const modDt = Date.now();
    const updateParams = {
      TableName: process.env.entitiesTableName,
      Key: {
        id,
        entity,
      },
      UpdateExpression: `set start_dt = :start_dt,end_dt = :end_dt,note = :note, mdt = :modDate`,
      ExpressionAttributeValues: {
        ":start_dt": start_dt,
        ":end_dt": end_dt,
        ":note": note,
        ":modDate": modDt,
      },
    };
    console.log("updateParams", updateParams);
    const updateParamsResp = await updateResources(updateParams, true);
    console.log("updateParamsResp", updateParamsResp);
    if (!updateParamsResp.status) failure(updateParamsResp);
    if (sendMail) {
      const payload = {
        httpMethod: "POST",
        pathParameters: {
          action: "send-mail",
        },
        body: JSON.stringify({
          hb_id,
          lot_id,
          stage_id,
        }),
      };
      const mailSendResp = await invokeLambda(STAGE_LAMBDA_ARN, payload, true);
      console.log("mailSendResp", mailSendResp);
    }

    return success(updateParamsResp);
  } catch (error) {
    console.log("error in updateLotStage", JSON.stringify(error.stacks));
    return failure({ status: false, error: error.message });
  }
};

const getLotStage = (data) => {
  try {
    const { data: lotStageUUID = "" } = data;
    if (!lotStageUUID)
      return failure({ status: false, error: "Data feild Required" });

    const params = {
      TableName: process.env.entitiesTableName,
      IndexName: process.env.entitiesTableByDataAndEntity,
      KeyConditionExpression: "#data = :data ",
      ExpressionAttributeNames: {
        "#data": "data",
      },
      ExpressionAttributeValues: {
        ":data": lotStageUUID,
      },
    };
    console.log(params);
    return getResources(params);
  } catch (error) {
    console.log("error in getLotStage", JSON.stringify(error.stacks));
    return failure({ status: false, error: error.message });
  }
};

export const deleteLot = async (data) => {
  try {
    const { id = "", hb_id: hbid = "", isTransArrOnly = false } = data;

    if (!id && !hbid)
      return failure({ status: false, error: "Id and hbid are required" });

    // Get all lot-stages with this stage_id
    const customLotStageParams = [
      {
        match: {
          "id.keyword": id,
        },
      },
      {
        match: {
          "type.keyword": "lot_stage",
        },
      },
    ];

    const lotStages = await doPaginatedQueryEllastic({
      hb_id: hbid,
      isCustomParam: true,
      customParams: customLotStageParams,
    });

    console.log(`lotStages: ${JSON.stringify(lotStages)}`);

    const deleteLotStagesArr = lotStages.map((item) => ({
      Delete: {
        Key: {
          id: item.id,
          entity: item.entity,
        },
        TableName: process.env.entitiesTableName /* required */,
        ReturnValuesOnConditionCheckFailure: "ALL_OLD",
      },
    }));

    // deleting the respective property interests

    const customPropIntParams = [
      {
        match: {
          "lot_id.keyword": id,
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

    const transArr = [
      {
        Delete: {
          Key: {
            id,
            entity: `lot#${hbid}`,
          },
          TableName: process.env.entitiesTableName /* required */,
          ReturnValuesOnConditionCheckFailure: "ALL_OLD",
        },
      },
      ...deleteLotStagesArr,
      ...deletePropIntsArr,
    ];

    console.log(`transArr: ${JSON.stringify(transArr)}`);

    if (isTransArrOnly) return transArr;
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
          response = await getLot(event);
        } else {
          response = failure();
        }
        break;
      case "POST":
        data = JSON.parse(event.body);
        if (!data) {
          response = failure();
        } else if (action === "create") {
          response = await createLot(data);
        } else if (action === "update") {
          response = await updateLotRow(data);
        } else if (action === "list") {
          response = await listLot(data);
        } else if (action === "list-lot-stage") {
          response = await listLotStage(data);
        } else if (action === "update-lot-stage") {
          response = await updateLotStage(data);
        } else if (action === "get-lot-stage") {
          response = await getLotStage(data);
        }
        break;
      default:
        response = failure();
    }
  } catch (error) {
    console.log(`Exception in lot lambda: ${JSON.stringify(error.stacks)} `);
    return failure({ status: false, error: error.message });
  }
  return response;
}
