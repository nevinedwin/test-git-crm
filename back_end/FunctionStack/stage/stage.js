/* eslint-disable no-continue */
/* eslint-disable camelcase */
import "../../NPMLayer/nodejs.zip";
import { v4 as uuidv4 } from "uuid";
import { failure, success } from "../libs/response-lib";
import {
  batchWriteItems,
  combineOrder,
  doPaginatedQueryDB,
  getParamsForQuery,
  getResources,
  initListAPI,
  listOrder,
  postResources,
  updateOrder,
  transactWriteItems,
  doPaginatedQueryEllastic,
  listEntitiesElastic,
  getResourceJSON,
  getStackOutputs,
} from "../libs/db";
import {
  checkUniqueDynamo,
  checkUniqueElastic,
} from "../validation/validation";
import { sendSesBulkEmail } from "../campaign/campaign";

const countryJson = require("../countrystatecity/country.json");
const stateJson = require("../countrystatecity/state.json");
const cityJson = require("../countrystatecity/city.json");

const getVal = (arr, id) => arr.filter((item) => item.id === id);

const createLotStage = async (stageId, hb_id) => {
  try {
    const batchParams = {
      RequestItems: {
        [process.env.entitiesTableName]: [],
      },
    };
    // Get all lots
    const params = {
      TableName: process.env.entitiesTableName,
      IndexName: process.env.entitiesTableByEntityAndId,
      KeyConditionExpression: "#entity = :entity",
      ExpressionAttributeNames: {
        "#entity": "entity",
      },
      ExpressionAttributeValues: {
        ":entity": `lot#${hb_id}`,
      },
    };
    const lots = await doPaginatedQueryDB({ params });
    console.log("lots", lots);

    const currentDate = Date.now();

    if (lots.length) {
      for (const lot of lots) {
        const lotStageUUID = uuidv4();
        const lotStageCreateItem = {
          id: lot.id,
          entity: `lot_stage#${hb_id}#${stageId}`,
          type: "lot_stage",
          hb_id,
          lot_id: lot.id,
          stage_id: stageId,
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

const createStage = async (data) => {
  try {
    const { hb_id, name, isActive = true } = data;
    if (!hb_id)
      return failure({ status: false, error: "Home Builder ID Required" });
    if (!name) return failure({ status: false, error: "Stage Name Required" });

    const stageUUID = uuidv4();

    const currentDate = Date.now();

    const stageCreateItem = {
      TableName: process.env.entitiesTableName,
      Item: {
        id: stageUUID,
        entity: `stage#${hb_id}`,
        type: "stage",
        hb_id,
        name,
        isActive,
        cdt: currentDate,
        mdt: currentDate,
      },
    };

    console.log("stageCreateItem", stageCreateItem);

    const postResourcesRes = await postResources(stageCreateItem, true);

    console.log("postResourcesRes", JSON.stringify(postResourcesRes));

    if (!postResourcesRes.status)
      return failure({ status: false, error: postResourcesRes.error });

    if (isActive) {
      const createLotStageRes = await createLotStage(stageUUID, data.hb_id);
      console.log("createLotStageRes", JSON.stringify(createLotStageRes));
    }

    return success({ status: true, item: { id: stageCreateItem.Item.id } });
  } catch (error) {
    console.log("error in stage creation", JSON.stringify(error.stacks));
    return failure({ status: false, error: error.message });
  }
};

const updateStageRow = async (data) => {
  try {
    const { id, hb_id, name, isActive = true, cdt = "" } = data;
    if (!hb_id)
      return failure({ status: false, error: "Home Builder ID Required" });
    if (!name) return failure({ status: false, error: "Stage Name Required" });
    if (!id) return failure({ status: false, error: "ID Required" });
    const isIdValid = await checkUniqueDynamo(id, hb_id, "stage");
    if (!isIdValid.status)
      return failure({ status: false, error: isIdValid.msg });

    if (!cdt) return failure({ status: false, error: "Created date Required" });

    const oldStage = isIdValid.result[0];

    const stageUpdateItem = {
      id,
      entity: `stage#${hb_id}`,
      type: "stage",
      hb_id,
      name,
      isActive,
      cdt,
      mdt: Date.now(),
    };

    const transArr = [
      /* required */
      {
        Put: {
          TableName: process.env.entitiesTableName /* required */,
          Item: stageUpdateItem,
          ReturnValuesOnConditionCheckFailure: "ALL_OLD",
        },
      },
    ];

    // get all lot stages
    const stageParams = {
      TableName: process.env.entitiesTableName,
      IndexName: process.env.entitiesTableByEntityAndId,
      KeyConditionExpression: "#entity = :entity",
      ExpressionAttributeNames: {
        "#entity": "entity",
      },
      ExpressionAttributeValues: {
        ":entity": `lot_stage#${hb_id}#${id}`,
      },
    };

    const lotStages = await doPaginatedQueryDB({ params: stageParams });
    console.log("lotStages", lotStages);

    const lotStageIds = lotStages.reduce((acc, crr, index) => {
      acc[index] = crr.id;
      return acc;
    }, []);

    console.log("lotStageIds", lotStageIds);

    // when a stage gets inactivate
    if (oldStage.isActive === true && isActive === false) {
      let deleteLotStages= [];
      for (const lotStage of lotStages) {
        console.log(`eachLotStage: ${JSON.stringify(lotStage)}`);
        if (!lotStage.start_dt && !lotStage.end_dt && !lotStage.note) {
          deleteLotStages.push(lotStage.id);
        }
      }
      
      deleteLotStages = [...new Set(deleteLotStages)];

      console.log(`deletedLotStage: ${JSON.stringify(deleteLotStages)}`);

      for (const eachLotId of deleteLotStages) {
        transArr.push({
          Delete: {
            Key: {
              id: eachLotId,
              entity: `lot_stage#${hb_id}#${id}`,
            },
            TableName: process.env.entitiesTableName /* required */,
            ReturnValuesOnConditionCheckFailure: "ALL_OLD",
          },
        });
      }
    }

    // when a stage gets activate
    if (oldStage.isActive === false && isActive === true) {
      // get all the lots
      const lotParams = {
        TableName: process.env.entitiesTableName,
        IndexName: process.env.entitiesTableByEntityAndId,
        KeyConditionExpression: "#entity = :entity",
        ExpressionAttributeNames: {
          "#entity": "entity",
        },
        ExpressionAttributeValues: {
          ":entity": `lot#${hb_id}`,
        },
      };
      const lots = await doPaginatedQueryDB({ params: lotParams });
      console.log("lots", lots);

      const lotIds = lots.reduce((acc, crr, index) => {
        acc[index] = crr.id;
        return acc;
      }, []);

      console.log("lotIds", lotIds);
      // filter the lot ids that doesn't have lotstage
      let newLotIds = [];
      for (const item of lotIds) {
        if (!lotStageIds.includes(item)) newLotIds.push(item);
      }

      console.log(
        "newLotIds before duplication check",
        JSON.stringify(newLotIds)
      );

      newLotIds = [...new Set(newLotIds)];

      console.log("newLotIds", JSON.stringify(newLotIds));

      const currentDate = Date.now();

      if (newLotIds && newLotIds.length) {
        // creating lot stages for new lot ids
        for (const lotId of newLotIds) {
          const lotStageUUID = uuidv4();
          const lotStageCreateItem = {
            id: lotId,
            entity: `lot_stage#${hb_id}#${id}`,
            type: "lot_stage",
            hb_id,
            lot_id: lotId,
            stage_id: id,
            data: lotStageUUID,
            cdt: currentDate,
            mdt: currentDate,
            start_dt: "",
            end_dt: "",
            note: "",
          };
          transArr.push({
            Put: {
              TableName: process.env.entitiesTableName /* required */,
              Item: lotStageCreateItem,
              ReturnValuesOnConditionCheckFailure: "ALL_OLD",
            },
          });
        }
      }
    }

    // if (oldStage.isActive === false && isActive === true) {
    //   // get all the lots
    //   const lotParams = {
    //     TableName: process.env.entitiesTableName,
    //     IndexName: process.env.entitiesTableByEntityAndId,
    //     KeyConditionExpression: "#entity = :entity",
    //     ExpressionAttributeNames: {
    //       "#entity": "entity",
    //     },
    //     ExpressionAttributeValues: {
    //       ":entity": `lot#${hb_id}`,
    //     },
    //   };
    //   const lots = await doPaginatedQueryDB({ params: lotParams });
    //   console.log("lots", lots);

    //   const lotIds = lots.reduce((acc, crr, index) => {
    //     acc[index] = crr.id;
    //     return acc;
    //   }, []);

    //   console.log("lotIds", lotIds);

    //   // get all lot stages
    //   const stageParams = {
    //     TableName: process.env.entitiesTableName,
    //     IndexName: process.env.entitiesTableByEntityAndId,
    //     KeyConditionExpression: "#entity = :entity",
    //     ExpressionAttributeNames: {
    //       "#entity": "entity",
    //     },
    //     ExpressionAttributeValues: {
    //       ":entity": `lot_stage#${hb_id}#${id}`,
    //     },
    //   };

    //   const lotStages = await doPaginatedQueryDB({ params: stageParams });
    //   console.log("lotStages", lotStages);

    //   const lotStageIds = lotStages.reduce((acc, crr, index) => {
    //     acc[index] = crr.id;
    //     return acc;
    //   }, []);

    //   console.log("lotStageIds", lotStageIds);

    //   // filter the lot ids that doesn't have lotstage
    //   let newLotIds = [];
    //   for (const item of lotIds) {
    //     if (!lotStageIds.includes(item)) newLotIds.push(item);
    //   }

    //   console.log(
    //     "newLotIds before duplication check",
    //     JSON.stringify(newLotIds)
    //   );

    //   newLotIds = [...new Set(newLotIds)];

    //   console.log("newLotIds", JSON.stringify(newLotIds));

    //   const currentDate = Date.now();

    //   if (newLotIds && newLotIds.length) {
    //     // creating lot stages for new lot ids
    //     for (const lotId of newLotIds) {
    //       const lotStageUUID = uuidv4();
    //       const lotStageCreateItem = {
    //         id: lotId,
    //         entity: `lot_stage#${hb_id}#${id}`,
    //         type: "lot_stage",
    //         hb_id,
    //         lot_id: lotId,
    //         stage_id: id,
    //         data: lotStageUUID,
    //         cdt: currentDate,
    //         mdt: currentDate,
    //         start_dt: "",
    //         end_dt: "",
    //         note: "",
    //       };
    //       transArr.push({
    //         Put: {
    //           TableName: process.env.entitiesTableName /* required */,
    //           Item: lotStageCreateItem,
    //           ReturnValuesOnConditionCheckFailure: "ALL_OLD",
    //         },
    //       });
    //     }
    //   }
    // }

    const transParams = {
      TransactItems: transArr,
    };

    console.log(`transArr: ${JSON.stringify(transArr)}`);
    return transactWriteItems(transParams);
  } catch (error) {
    console.log("error in stage updation", JSON.stringify(error.stacks));
    return failure({ status: false, error: error.message });
  }
};

const listStageElastic = async (data) => {
  let list;
  try {
    list = await initListAPI({ ...data, entity: "stage" });
  } catch (error) {
    console.log("error in stage list", JSON.stringify(error.stacks));
    return failure({ status: false, error: error.message });
  }
  return list;
};

const listStage = async (event) => {
  const hbidParam =
    event && event.pathParameters && event.pathParameters.hbid
      ? event.pathParameters.hbid
      : 0;

  const params = {
    TableName: process.env.entitiesTableName,
    IndexName: process.env.entitiesTableByEntityAndId,
    KeyConditionExpression: "#entity = :entity",
    ExpressionAttributeNames: {
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":entity": `stage#${hbidParam}`,
    },
  };

  console.log(params);
  const combineOrderRes = await combineOrder("stage", hbidParam, params);
  return combineOrderRes;
};

const getStage = (event) => {
  const params = getParamsForQuery(event, "stage");
  return getResources(params);
};

export const deleteStage = async (data) => {
  try {
    const { id = "", hb_id: hbid = "" } = data;

    if (!id && !hbid)
      return failure({ status: false, error: "Id and hbid are required" });

    // Get all lot-stages with this stage_id
    const customLotStageParams = [
      {
        match: {
          "stage_id.keyword": id,
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

    // Emptying the current stage of lot

    const customLotParams = [
      {
        match: {
          "stage_id.keyword": id,
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
          crr_st: "",
          stage_id: "",
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
            entity: `stage#${hbid}`,
          },
          TableName: process.env.entitiesTableName /* required */,
          ReturnValuesOnConditionCheckFailure: "ALL_OLD",
        },
      },
      ...deleteLotStagesArr,
      ...updateLotArr,
    ];

    console.log(`transArr: ${JSON.stringify(transArr)}`);
    const transParams = {
      TransactItems: transArr,
    };
    console.log(`transParams: ${JSON.stringify(transParams)}`);
    return transactWriteItems(transParams);
  } catch (error) {
    console.log("error in deleteStage", JSON.stringify(error.stacks));
    return failure({ status: false, error: error.message });
  }
};

const validateAlert = async (data, isUpdate = false) => {
  const alertStatusEnum = ["Quote", "Committed", "Approved", "Closed"];
  try {
    const { hb_id, tplt, stage_id, sts, tpltArn } = data;
    if (!hb_id) return { status: false, error: "Home Builder ID Required" };
    if (!tplt) return { status: false, error: "Template Name Required" };
    if (!tpltArn) return { status: false, error: "Template Arn Required" };
    if (!stage_id) return { status: false, error: "Stage Required" };
    if (!sts) return { status: false, error: "Status Required" };
    if (!alertStatusEnum.includes(sts))
      return { status: false, error: "Invalid Status" };

    if (isUpdate) {
      if (!data.id) return { status: false, error: "ID Required" };
      const isIdValid = await checkUniqueDynamo(data.id, hb_id, "alert");

      if (!isIdValid.status) return { status: false, error: isIdValid.msg };

      if (!data.cdt) return { status: false, error: "Created date Required" };
    }

    const isAlertValid = await checkUniqueElastic("alert", {
      entity: `alert#${hb_id}`,
      sts,
      stage_id,
      id: isUpdate ? data.id : "",
    });
    console.log("isAlertValid>>>", JSON.stringify(isAlertValid));
    if (!isAlertValid.status)
      return { status: false, error: isAlertValid.error };
    return { status: true };
  } catch (error) {
    return { status: false, error: error.message };
  }
};

const createAlert = async (data) => {
  try {
    console.log("data", JSON.stringify(data));
    const isValid = await validateAlert(data, false);
    console.log("isValid", JSON.stringify(isValid));
    if (!isValid.status)
      return failure({ status: false, error: isValid.error });
    const currentDate = Date.now();
    const alertItem = {
      type: "alert",
      hb_id: data.hb_id,
      tplt: data.tplt,
      tpltArn: data.tpltArn,
      cdt: currentDate,
      mdt: currentDate,
      isActive: data.isActive || false,
      sts: data.sts,
      stage_id: data.stage_id,
      data: data.stage_id,
    };

    const alertUUID = uuidv4();

    const alertCreateItem = {
      TableName: process.env.entitiesTableName,
      Item: {
        id: alertUUID,
        entity: `alert#${data.hb_id}`,
        ...alertItem,
      },
    };

    console.log("alertCreateItem", alertCreateItem);
    return postResources(alertCreateItem);
  } catch (error) {
    console.log("error in createAlert", JSON.stringify(error.stacks));
    return failure({ status: false, error: error.message });
  }
};

const updateAlert = async (data) => {
  try {
    console.log("data", JSON.stringify(data));
    const isValid = await validateAlert(data, true);
    if (!isValid.status)
      return failure({ status: false, error: isValid.error });

    const alertUpdateItem = {
      TableName: process.env.entitiesTableName,
      Item: {
        id: data.id,
        entity: `alert#${data.hb_id}`,
        type: "alert",
        hb_id: data.hb_id,
        tplt: data.tplt,
        tpltArn: data.tpltArn,
        cdt: data.cdt,
        mdt: Date.now(),
        isActive: data.isActive || false,
        sts: data.sts,
        stage_id: data.stage_id,
        data: data.stage_id,
      },
    };
    console.log("alertUpdateItem", alertUpdateItem);
    return postResources(alertUpdateItem);
  } catch (error) {
    console.log("error in updateAlert", JSON.stringify(error.stacks));
    return failure({ status: false, error: error.message });
  }
};

const getAlert = (event) => {
  const params = getParamsForQuery(event, "alert");
  return getResources(params);
};

const listAlertElastic = async (data) => {
  try {
    const { listAll = false } = data;

    const params = {
      ...data,
      entity: "alert",
    };

    if (listAll) {
      const allPlans = await doPaginatedQueryEllastic(params);
      return success({ status: true, data: allPlans });
    }

    const alerts = await listEntitiesElastic(params);

    if (!alerts.status) return failure({ ...alerts });

    return success({ ...alerts });
  } catch (error) {
    console.log("error in listAlertElastic", JSON.stringify(error.stacks));
    return failure({ status: false, error: error.message });
  }
};

export const deleteAlert = async (data) => {
  try {
    const { id = "", hb_id: hbid = "" } = data;
    if (!id && !hbid)
      return failure({ status: false, error: "Id and hbid are required" });

    const transArr = [
      {
        Delete: {
          Key: {
            id,
            entity: `alert#${hbid}`,
          },
          TableName: process.env.entitiesTableName /* required */,
          ReturnValuesOnConditionCheckFailure: "ALL_OLD",
        },
      },
    ];

    console.log(`transArr: ${JSON.stringify(transArr)}`);
    const transParams = {
      TransactItems: transArr,
    };
    console.log(`transParams: ${JSON.stringify(transParams)}`);
    return transactWriteItems(transParams);
  } catch (error) {
    console.log("error in deleteAlert", JSON.stringify(error.stacks));
    return failure({ status: false, error: error.message });
  }
};

const sendStageChangeMail = async (data) => {
  try {
    const { hb_id, lot_id, stage_id } = data;
    if (!hb_id || !lot_id || !stage_id)
      return { status: false, error: "All parameters are required" };

    // fetching all alerts of the stage
    const fetchAlertParams = {
      TableName: process.env.entitiesTableName,
      IndexName: process.env.entitiesTableByDataAndEntity,
      KeyConditionExpression: "#data = :data and #entity = :entity",
      ExpressionAttributeNames: {
        "#data": "data",
        "#entity": "entity",
      },
      ExpressionAttributeValues: {
        ":data": stage_id,
        ":entity": `alert#${hb_id}`,
      },
    };

    console.log("fetchAlertParams>>", fetchAlertParams);

    let fetchAlertResp = await getResourceJSON(fetchAlertParams);
    console.log("fetchAlertResp>>", fetchAlertResp);

    fetchAlertResp = fetchAlertResp.filter((item) => item.isActive);
    console.log("Filtered fetchAlertResp>>", fetchAlertResp);

    if (!fetchAlertResp || !fetchAlertResp.length)
      return { status: false, error: "No Alert list found" };

    // fetching the builder data
    const builderParams = {
      TableName: process.env.entitiesTableName,
      KeyConditionExpression: "#id = :id and #entity = :entity",
      ExpressionAttributeNames: {
        "#id": "id",
        "#entity": "entity",
      },
      ExpressionAttributeValues: {
        ":id": hb_id,
        ":entity": "builder",
      },
    };
    console.log("builderParams>>", builderParams);

    const getBuilderResp = await getResourceJSON(builderParams);

    console.log("getBuilderResp>>", getBuilderResp);
    if (!getBuilderResp || !getBuilderResp.length)
      return { status: false, error: "No Builder details found" };

    const builder = getBuilderResp[0];

    // fetching lot data

    const lotParams = {
      TableName: process.env.entitiesTableName,
      KeyConditionExpression: "#id = :id and #entity = :entity",
      ExpressionAttributeNames: {
        "#id": "id",
        "#entity": "entity",
      },
      ExpressionAttributeValues: {
        ":id": lot_id,
        ":entity": `lot#${hb_id}`,
      },
    };
    console.log("lotParams>>", lotParams);

    const getLotResp = await getResourceJSON(lotParams);

    console.log("getLotResp>>", getLotResp);

    if (!getLotResp || !getLotResp.length)
      return { status: false, error: "No Lot details found" };

    const lot = getLotResp[0];

    // Get the values for city, state and country from JSON
    const [{ name: cityName = "" }] = getVal(cityJson, builder.city);
    const [{ name: stateName = "" }] = getVal(stateJson, builder.state);
    const [{ name: countryName = "" }] = getVal(countryJson, builder.country);

    const templateData = {
      from_builder_address: builder.address || "",
      from_builder_city: cityName,
      from_builder_country: countryName,
      from_builder_email: builder.email || "",
      from_builder_name: builder.name || "",
      from_builder_phone: builder.phone || "",
      from_builder_ppurl: builder.ppurl || "",
      from_builder_state: stateName,
      from_builder_zip: builder.zip || "",
      lot_job_number: lot.num || "",
      lot_address: lot.addr || "",
      lot_name: lot.name || "",
      lot_premium: lot.premium || "",
      lot_current_stage: lot.crr_st ? JSON.parse(lot.crr_st)?.name || "" : "",
      lot_sales_status: lot.sts || "",
      lot_community: lot?.comm || "",
      lot_plan_name: lot?.plan || "",
    };

    // getting service endpoint
    const serviceEndpoint = await getStackOutputs({
      StackName: process.env.StackName,
      outputName: "ServiceEndpoint",
      all: false,
    });

    if (!serviceEndpoint)
      return { status: false, error: "Service endpoint not found" };

    for (const alert of fetchAlertResp) {
      // fetching all property Interest under the lot id
      const customPropIntParams = [
        {
          match: {
            "lot_id.keyword": lot_id,
          },
        },
        {
          match: {
            "type.keyword": "propInt",
          },
        },
        {
          match: {
            "sts.keyword": alert.sts,
          },
        },
      ];

      const propInts = await doPaginatedQueryEllastic({
        hb_id,
        isCustomParam: true,
        customParams: customPropIntParams,
      });

      console.log(`propInts: ${JSON.stringify(propInts)}`);

      if (!propInts || !propInts.length) continue;

      let customerIds = propInts.reduce((acc, crr, indx) => {
        acc[indx] = crr.id;
        return acc;
      }, []);

      customerIds = [...new Set(customerIds)];

      // fetching the customer details
      const filterParams = [
        {
          terms: {
            "id.keyword": customerIds,
          },
        },
      ];
      const CustomerFetchParams = {
        hb_id,
        entity: "customer",
        filterParams,
      };

      const customers = await doPaginatedQueryEllastic(CustomerFetchParams);

      if (!customers || !customers.length) continue;

      const Destinations = [];

      for (const customer of customers) {
        Destinations.push({
          Destination: {
            ToAddresses: [customer.email],
          },
          ReplacementTemplateData: JSON.stringify({
            ...templateData,
            to_email: customer.email,
            to_first_name: customer.fname || "",
            to_last_name: customer.lname || "",
            to_phone: customer.phone || "",
            unsubscribe_link: `${serviceEndpoint}/api/public/campaigns/endpoint/unsubscribe/${builder.appid}/${customer.id}`,
          }),
        });
      }

      const DefaultTemplateData = [
        ...Object.keys(templateData),
        "to_email",
        "to_first_name",
        "to_last_name",
        "to_phone",
        "unsubscribe_link",
      ].reduce((acc, crr) => {
        acc[crr] = "Sample";
        return acc;
      }, {});

      const mailParams = {
        Source: builder.email,
        Template: alert.tplt,
        TemplateArn: alert.tpltArn,
        Destinations,
        DefaultTemplateData: JSON.stringify(DefaultTemplateData),
      };

      if (process.env.SESConfigSetName !== "novalue")
        mailParams.ConfigurationSetName = process.env.SESConfigSetName;
      console.log("mailParams", JSON.stringify(mailParams));

      const mailSendResp = await sendSesBulkEmail(mailParams);
      console.log("mailSendResp", JSON.stringify(mailSendResp));
    }

    return { status: true };
  } catch (error) {
    console.log("error", error);
    console.log("error in sendStageChangeMail", JSON.stringify(error.stacks));
    return { status: false, error: error.message };
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
          response = await getStage(event);
        } else if (action === "get-alert") {
          response = await getAlert(event);
        } else if (action === "list_order") {
          response = await listOrder("stage", event);
        } else if (action === "list") {
          response = await listStage(event);
        } else {
          response = failure();
        }
        break;
      case "POST":
        data = JSON.parse(event.body);
        if (!data) {
          response = failure();
        } else if (action === "create") {
          response = await createStage(data);
        } else if (action === "update") {
          response = await updateStageRow(data);
        } else if (action === "list") {
          response = await listStageElastic(data);
        } else if (action === "update_order") {
          response = await updateOrder("stage", data);
        } else if (action === "create-alert") {
          response = await createAlert(data);
        } else if (action === "update-alert") {
          response = await updateAlert(data);
        } else if (action === "list-alert") {
          response = await listAlertElastic(data);
        } else if (action === "send-mail") {
          response = await sendStageChangeMail(data);
        }
        break;
      default:
        response = failure();
    }
  } catch (error) {
    console.log(`Exception in stage lambda: ${JSON.stringify(error.stacks)} `);
    return failure({ status: false, error: error.message });
  }
  return response;
}
