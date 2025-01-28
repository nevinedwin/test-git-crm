import "../../NPMLayer/nodejs.zip";
import AWS from 'aws-sdk';
import { v4 as uuidv4 } from "uuid";
import {
  combineOrder,
  deleteResources,
  getMoveInTimeFrameCreateJSON,
  getParamsForQuery,
  getResourceJSON,
  getResources,
  initListAPI,
  listOrder,
  postResources,
  updateOrder,
  updateResources,
  batchWriteItems
} from "../libs/db";
import { failure, success } from "../libs/response-lib";
import { listBuilders } from "../builders/builders";
import { isDuplicated } from "../validation/validation";

const { DELETE_PROFILE_DATA_STATE_MACHINE_ARN } = process.env;
const sfn = new AWS.StepFunctions();

export const createMoveInTimeFrame = async (data) => {
  try {
    const expJSON = getMoveInTimeFrameCreateJSON(data);
    const params = {
      TableName: process.env.entitiesTableName,
      Item: {
        type: "desm",
        hb_id: expJSON.hb_id,
        name: expJSON.name,
        mdt: expJSON.mod_dt,
        cdt: expJSON.cdt,
        entity: `desm#${expJSON.hb_id}`,
        id: uuidv4()
      }
    };

    // check the name is duplicated
    const isDuplicateName = await isDuplicated({ hbid: expJSON.hb_id, key: "name", val: expJSON.name, entity: "desm" });
    console.log(`isDuplicateName": ${JSON.stringify(isDuplicateName)}`);
    if (!isDuplicateName.status) throw isDuplicateName.error;
    return postResources(params);
  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`);
    return failure({ status: false, error: error?.message || error });
  };
};

export const getMoveInTimeFrame = async (event) => {
  try {
    const params = getParamsForQuery(event, "desm");
    return getResources(params);
  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`);
    return failure({ status: false, error: error?.message || error });
  };
};

export const updateMoveInTimeFrameRow = async (data) => {
  try {
    const {
      hb_id = "",
      name = "",
      cdt = "",
      id = ""
    } = data;

    const params = {
      TableName: process.env.entitiesTableName,
      Item: {
        id,
        hb_id,
        type: "desm",
        name,
        mdt: Date.now(),
        cdt,
        entity: `desm#${hb_id}`
      }
    };

    // check the name is duplicated
    const isDuplicateName = await isDuplicated({ hbid: hb_id, key: "name", val: name, entity: "desm", id });
    if (!isDuplicateName.status) throw isDuplicateName.error;
    return postResources(params);
  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`);
    return failure({ status: false, error: error?.message || error });
  };
};

export const updateMoveInTimeFrame = async (data) => {
  try {
    const {
      id = "",
      hb_id: hbid = "",
      attrn: propName = "",
      attrv: propVal = "",
    } = data;

    const modDt = Date.now();

    // check the name is duplicated
    if (propName === "name") {
      const isDuplicateName = await isDuplicated({ hbid: hbid, key: "name", val: propVal, entity: "desm", id });
      if (!isDuplicateName.status) throw isDuplicateName.error;
    };

    const params = {
      TableName: process.env.entitiesTableName,
      Key: {
        id,
        entity: `desm#${hbid}`
      },
      UpdateExpression: "set #propName = :pval, mdt = :modDate",
      ExpressionAttributeNames: {
        "#propName": propName
      },
      ExpressionAttributeValues: {
        ":pval": propVal,
        ":modDate": modDt
      }
    };

    console.log(`update params: ${JSON.stringify(params)}`);
    return updateResources(params);
  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`);
    return failure({ status: false, error: error?.message || error });
  };
};

export const deleteMoveInTimeFrame = async (data) => {
  try {
    const {
      id = "",
      hb_id: hbid = ""
    } = data;

    const params = {
      TableName: process.env.entitiesTableName,
      Key: {
        id,
        entity: `desm#${hbid}`
      }
    };
    console.log(`delete params: ${JSON.stringify(params)}`);

    // delete the Move In Time Frame from All customer which having that Move In Time Frame 
    const input = JSON.stringify({
      hbId: hbid,
      type: "customer",
      field: "desm",
      fieldArray: [id],
      isStart: true,
      setVal: ""
    });

    const deleteResp = deleteResources(params);
    console.log(`deleteResp: ${JSON.stringify(deleteResp)}`);
    const stateMachineParams = {
      input,
      stateMachineArn: DELETE_PROFILE_DATA_STATE_MACHINE_ARN
    };

    console.log(`stateMachineParams: ${JSON.stringify(stateMachineParams)}`);
    const stateExecutionResp = await sfn.startExecution(stateMachineParams).promise();
    console.log(`stateExecutionResp: ${JSON.stringify(stateExecutionResp)}`);

    return deleteResp;
  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`);
    return failure({ status: false, error: error?.message || error });
  };
};

export const listMoveInTimeFrame = async (event, isJSONOnly, isExternalAPI) => {
  try {
    const hbidParam = event?.pathParameters?.hbid || 0;
    const params = {
      TableName: process.env.entitiesTableName,
      IndexName: process.env.entitiesTableByEntityAndId,
      KeyConditionExpression: "#entity = :entity",
      ExpressionAttributeNames: {
        "#entity": "entity",
      },
      ExpressionAttributeValues: {
        ":entity": `desm#${hbidParam}`
      }
    };
    console.log(`List desm Params: ${JSON.stringify(params)}`);
    if (isJSONOnly) {
      return getResourceJSON(params);
    };

    if (isExternalAPI) {
      const listDesmResp = await getResourceJSON(params);
      const desmList = listDesmResp.map(item => ({
        id: item?.id || "",
        name: item?.name || ""
      }));
      return success(desmList);
    };

    const combineOrderResp = await combineOrder("desm", hbidParam, params);
    return combineOrderResp;
  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`);
    return failure({ status: false, error: error?.message || error });
  }
};

export const listMoveInTimeFrameElastic = async (data) => {
  let list;
  try {
    list = await initListAPI({ ...data, entity: "desm" });
  } catch (error) {
    return failure({ status: false, error: "Move-In-Time-Frame List Failed" })
  }
  return list;
};

export const createMoveInPutRequest = (builderId) => {
  const desiredMoveIns = ["As soon as possible", "2-3 Months", "Over 3 Months"];
  const putRequest = []
  desiredMoveIns.forEach(moveIn => {
    putRequest.push({
      PutRequest: {
        Item: {
          type: 'desm',
          hbd_id: builderId,
          name: moveIn,
          mdt: Date.now(),
          cdt: Date.now(),
          entity: `desm#${builderId}`,
          id: moveIn,
        }
      },
    })
  });
  return putRequest;
};

const updateMoveInForBuilders = async () => {
  let builderList = [];
  try {

    builderList = await listBuilders(true);

    const batchMoveInParams = {
      RequestItems: {
        [process.env.entitiesTableName]: []
      }
    }

    builderList.forEach(async (builder) => {
      const data = createMoveInPutRequest(builder.id);
      batchMoveInParams.RequestItems[process.env.entitiesTableName].push(...data);
    })

    const batchWriteResp = await batchWriteItems(batchMoveInParams);
    console.log(`batchWriteResp: ${JSON.stringify(batchWriteResp)}`);

    const batchWriteBody = batchWriteResp.body ? JSON.parse(batchWriteResp.body) : {};
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

    if (!isBatchSuccess) {
      return failure({ status: false, error: 'There are unprocessed batch items' })
    }

    return success(200, 'Successfully updated MoveIns', true);

  } catch (error) {
    return failure({ status: false, error: error?.message || error })
  }

};

/**
 * Move In Time Frame Main Function
 * @param {Object} event 
 * @returns {Object} 
 */

export async function main(event) {
  let response;
  try {
    console.log(`Event: ${JSON.stringify(event)}`);
    const action = event?.pathParameters?.action || 0;
    const isExternalAPI = event?.path?.includes("external") || false;
    const isExternalDesmList = event?.path?.includes("list") || false;
    let data;
    switch (event.httpMethod) {
      case "GET":
        if (action === "list" || (isExternalAPI && isExternalDesmList)) {
          response = await listMoveInTimeFrame(event, false, isExternalAPI);
        } else if (action === "list_order") {
          response = await listOrder("desm", event);
        } else if (action === "get") {
          response = await getMoveInTimeFrame(event);
        } else {
          response = failure();
        }
        break;
      case "POST":
        data = JSON.parse(event.body);
        if (!data) {
          response = failure();
        } else if (action === "create") {
          response = await createMoveInTimeFrame(data)
        } else if (action === "update") {
          response = await updateMoveInTimeFrame(data);
        } else if (action === "delete") {
          response = await deleteMoveInTimeFrame(data);
        } else if (action === "update_order") {
          response = await updateOrder("desm", data);
        } else if (action === "list") {
          response = await listMoveInTimeFrameElastic(data);
        } else if (action === "script") {
          response = await updateMoveInForBuilders();
        } else {
          response = failure();
        }
        break;
      default:
        response = failure();
        break;
    };
  } catch (error) {
    console.log(error);
    return failure({ status: false, error: error?.message || error });
  }
  return response;
}