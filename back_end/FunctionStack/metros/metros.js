/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import { v4 as uuidv4 } from "uuid";
import {
  getMetroCreateJSON,
  postResources,
  getResourceJSON,
  transactWriteItems,
  getResources,
  getParamsForQuery,
  deleteResources,
  updateOrder,
  listOrder,
  combineOrder,
  initListAPI,
} from "../libs/db";
import { failure } from "../libs/response-lib";

export const createMetro = (data) => {
  const metroJSON = getMetroCreateJSON(data);
  const params = {
    TableName: process.env.entitiesTableName,
    Item: {
      type: "metro",
      hb_id: metroJSON.hb_id,
      name: metroJSON.name,
      mdt: metroJSON.mod_dt,
      cdt: metroJSON.cdt,
      id: uuidv4(),
      entity: `metro#${metroJSON.hb_id}`,
    },
  };
  return postResources(params);
};
const updateAgencyMetro = async (obj) => {
  const { hbid } = obj;
  const { metroId } = obj;
  const { metroRow } = obj;
  const params = {
    TableName: process.env.entitiesTableName,
    IndexName: process.env.entitiesTableByEntityAndId,
    KeyConditionExpression: "#entity = :entity",
    ExpressionAttributeNames: {
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":entity": `metro#${hbid}#agency#${metroId}`,
    },
  };
  console.log(params);
  const agencyMetroItems = await getResourceJSON(params);
  console.log(`agencyMetroItems: ${JSON.stringify(agencyMetroItems)}`);
  const metroUpdateArr = [];
  for (const metroItem of agencyMetroItems) {
    metroUpdateArr.push({
      Put: {
        TableName: process.env.entitiesTableName /* required */,
        Item: {
          id: metroItem.id,
          entity: `metro#${hbid}#agency#${metroId}`,
          data: `${metroId}`,
          ...metroRow,
        },
        ReturnValuesOnConditionCheckFailure: "ALL_OLD",
      },
    });
  }
  const transParams = {
    TransactItems: metroUpdateArr,
  };
  return transParams;
};
export const updateMetroRow = async (data) => {
  const metroItem = {
    type: "metro",
    hb_id: data.hb_id,
    name: data.name,
    mdt: Date.now(),
    cdt: data.cdt,
    id: data.id,
    entity: `metro#${data.hb_id}`,
  };
  const metroId = metroItem.id;
  const metroEntity = metroItem.entity;
  delete metroItem.id;
  delete metroItem.entity;
  const metroUpdateArr = await updateAgencyMetro({
    hbid: data.hb_id,
    metroId: data.id,
    metroRow: metroItem,
  });
  console.log(`metroUpdateArr: ${JSON.stringify(metroUpdateArr)}`);
  metroItem.id = metroId;
  metroItem.entity = metroEntity;
  metroUpdateArr.TransactItems.unshift({
    Put: {
      TableName: process.env.entitiesTableName,
      Item: metroItem,
      ReturnValuesOnConditionCheckFailure: "ALL_OLD",
    },
  });
  console.log(`metroUpdateArr: ${JSON.stringify(metroUpdateArr)}`);
  return transactWriteItems(metroUpdateArr);
};
const listMetros = async (event, isJSONOnly = false) => {
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
      ":entity": `metro#${hbidParam}`,
    },
  };
  console.log(params);
  if (isJSONOnly) {
    return getResourceJSON(params);
  }

  const combineOrderRes = await combineOrder("metro", hbidParam, params);
  return combineOrderRes;
};
const listMetrosElastic = async (data) => {
  let list;
  try {
    list = await initListAPI({ ...data, entity: "metro" });
  } catch (error) {
    return failure({ status: false, error: "Metro list failed." });
  }
  return list;
};
export const getMetro = (event) => {
  const params = getParamsForQuery(event, "metro");
  return getResources(params);
};
export const updateMetro = async (data) => {
  const id = data.id ? data.id : 0;
  const hbid = data.hb_id ? data.hb_id : 0;
  const propName = data.attrn ? data.attrn : "";
  const propVal = data.attrv ? data.attrv : "";
  const metroItem = data.metro ? data.metro : {};
  const modDt = Date.now();

  const metroUpdateParams = {
    TableName: process.env.entitiesTableName,
    Key: {
      id,
      type: "metro",
    },
    UpdateExpression: `set #propName = :pval, mdt = :modDate`,
    ExpressionAttributeNames: {
      "#propName": propName,
    },
    ExpressionAttributeValues: {
      ":pval": propVal,
      ":modDate": modDt,
    },
    ReturnValuesOnConditionCheckFailure: "ALL_OLD",
  };
  console.log(metroUpdateParams);
  const metroUpdateArr = await updateAgencyMetro({
    hbid,
    metroId: id,
    metroRow: metroItem,
  });
  metroUpdateArr.TransactItems.unshift({
    Put: {
      TableName: process.env.entitiesTableName,
      Item: metroItem,
      ReturnValuesOnConditionCheckFailure: "ALL_OLD",
    },
  });
  metroUpdateArr.TransactItems.unshift({
    Update: metroUpdateParams,
  });
  return transactWriteItems(metroUpdateArr);
};
export const deleteMetro = (data) => {
  const id = data.id ? data.id : "";
  const hbid = data.hb_id ? data.hb_id : "";
  const params = {
    TableName: process.env.entitiesTableName,
    Key: {
      id,
      entity: `metro#${hbid}`,
    },
  };
  console.log(params);
  return deleteResources(params);
};
/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */
export async function main(event) {
  let response;
  try {
    const action =
      event && event.pathParameters && event.pathParameters.action
        ? event.pathParameters.action
        : 0;
    let data;
    switch (event.httpMethod) {
      case "GET":
        if (action === "list") {
          response = await listMetros(event);
        } else if (action === "list_order") {
          response = await listOrder("metro", event);
        } else if (action === "get") {
          response = await getMetro(event);
        } else {
          response = failure();
        }
        break;
      case "POST":
        data = JSON.parse(event.body);
        if (!data) {
          response = failure();
        } else if (action === "create") {
          response = await createMetro(data);
        } else if (action === "update_order") {
          response = await updateOrder("metro", data);
        } else if (action === "update") {
          response = await updateMetro(data);
        } else if (action === "delete") {
          response = await deleteMetro(data);
        } else if (action === "list") {
          response = await listMetrosElastic(data);
        } else {
          response = failure();
        }
        break;
      default:
        response = failure();
    }
  } catch (err) {
    console.log(err);
    return failure({ status: false, error: err });
  }

  return response;
}
