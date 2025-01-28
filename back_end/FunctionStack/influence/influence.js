/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import { v4 as uuidv4 } from "uuid";
import {
  getInfluenceCreateJSON,
  postResources,
  getResourceJSON,
  getResources,
  getParamsForQuery,
  updateResources,
  deleteResources,
  updateOrder,
  listOrder,
  combineOrder,
  initListAPI,
} from "../libs/db";
import { success, failure } from "../libs/response-lib";

export const createInfluence = (data) => {
  const expJSON = getInfluenceCreateJSON(data);
  const params = {
    TableName: process.env.entitiesTableName,
    Item: {
      type: "infl",
      hb_id: expJSON.hb_id,
      name: expJSON.name,
      mdt: expJSON.mod_dt,
      cdt: expJSON.cdt,
      entity: `infl#${expJSON.hb_id}`,
      id: uuidv4(),
    },
  };
  return postResources(params);
};
export const updateInfluenceRow = (data) => {
  const params = {
    TableName: process.env.entitiesTableName,
    Item: {
      type: "infl",
      hb_id: data.hb_id,
      name: data.name,
      mdt: Date.now(),
      cdt: data.cdt,
      id: data.id,
      entity: `infl#${data.hb_id}`,
    },
  };
  return postResources(params);
};
export const listInfluence = async (event, isJSONOnly, isExternalAPI) => {
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
      ":entity": `infl#${hbidParam}`,
    },
  };
  console.log(params);
  if (isJSONOnly) {
    return getResourceJSON(params);
  }

  if (isExternalAPI) {
    const listInflResp = await getResourceJSON(params);
    // Only fetch id, name and any other important fields only
    const inflList = listInflResp.map((item) => ({
      id: item.id,
      name: item.name,
    }));
    return success(inflList);
  }

  const combineOrderRes = await combineOrder("infl", hbidParam, params);
  return combineOrderRes;
};
const listInfluenceElastic = async (data) => {
  let list;
  try {
    list = await initListAPI({ ...data, entity: "infl" });
  } catch (error) {
    return failure({ status: false, error: "Influence list failed." });
  }
  return list;
};
export const getInfluence = (event) => {
  const params = getParamsForQuery(event, "infl");
  return getResources(params);
};
export const updateInfluence = (data) => {
  const id = data.id ? data.id : "";
  const hbid = data.hb_id ? data.hb_id : "";
  const propName = data.attrn ? data.attrn : "";
  const propVal = data.attrv ? data.attrv : "";
  const modDt = Date.now();

  const params = {
    TableName: process.env.entitiesTableName,
    Key: {
      id,
      entity: `infl#${hbid}`,
    },
    UpdateExpression: `set #propName = :pval, mdt = :modDate`,
    ExpressionAttributeNames: {
      "#propName": propName,
    },
    ExpressionAttributeValues: {
      ":pval": propVal,
      ":modDate": modDt,
    },
  };
  console.log(params);
  return updateResources(params);
};
export const deleteInfluence = (data) => {
  const id = data.id ? data.id : "";
  const hbid = data.hb_id ? data.hb_id : "";
  const params = {
    TableName: process.env.entitiesTableName,
    Key: {
      id,
      entity: `infl#${hbid}`,
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
    const isExternalAPI =
      event && event.path ? event.path.includes("external") : false;
    const isExternalInflList =
      event && event.path ? event.path.includes("list") : false;
    let data;
    switch (event.httpMethod) {
      case "GET":
        if (action === "list" || (isExternalAPI && isExternalInflList)) {
          response = await listInfluence(event, false, isExternalAPI);
        } else if (action === "list_order") {
          response = await listOrder("infl", event);
        } else if (action === "get") {
          response = await getInfluence(event);
        } else {
          response = failure();
        }
        break;
      case "POST":
        data = JSON.parse(event.body);
        if (!data) {
          response = failure();
        } else if (action === "create") {
          response = await createInfluence(data);
        } else if (action === "update_order") {
          response = await updateOrder("infl", data);
        } else if (action === "update") {
          response = await updateInfluence(data);
        } else if (action === "delete") {
          response = await deleteInfluence(data);
        } else if (action === "list") {
          response = await listInfluenceElastic(data);
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
