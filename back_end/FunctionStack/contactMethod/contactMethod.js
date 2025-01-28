/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";

import { v4 as uuidv4 } from "uuid";

import {
  getContactMethodCreateJSON,
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

export const createContactMethod = (data) => {
  const expJSON = getContactMethodCreateJSON(data);
  const params = {
    TableName: process.env.entitiesTableName,
    Item: {
      type: "cntm",
      hb_id: expJSON.hb_id,
      name: expJSON.name,
      mdt: expJSON.mod_dt,
      cdt: expJSON.cdt,
      id: uuidv4(),
      entity: `cntm#${expJSON.hb_id}`,
    },
  };
  return postResources(params);
};
export const updateContactMethodRow = (data) => {
  const params = {
    TableName: process.env.entitiesTableName,
    Item: {
      type: "cntm",
      hb_id: data.hb_id,
      name: data.name,
      mdt: Date.now(),
      cdt: data.cdt,
      id: data.id,
      entity: `cntm#${data.hb_id}`,
    },
  };
  return postResources(params);
};
export const listContactMethod = async (event, isExternalAPI) => {
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
      ":entity": `cntm#${hbidParam}`,
    },
  };
  console.log(params);
  if (isExternalAPI) {
    const listCntmResp = await getResourceJSON(params);
    // Only fetch id, name and any other important fields only
    const cntmList = listCntmResp.map((item) => ({
      id: item.id,
      name: item.name,
    }));
    return success(cntmList);
  }

  const combineOrderRes = await combineOrder("cntm", hbidParam, params);
  return combineOrderRes;
};
const listContactMethodElastic = async (data) => {
  let list;
  try {
    list = await initListAPI({ ...data, entity: "cntm" });
  } catch (error) {
    return failure({ status: false, error: "Contact method list failed." });
  }
  return list;
};
export const getContactMethod = (event) => {
  const params = getParamsForQuery(event, "cntm");
  return getResources(params);
};
export const updateContactMethod = (data) => {
  const {
    cntm_id: cntmId = "",
    attrn: propName = "",
    attrv: propVal = "",
    hb_id: hbid = "",
  } = data;
  const modDt = Date.now();

  const params = {
    TableName: process.env.entitiesTableName,
    Key: {
      id: cntmId,
      entity: `cntm#${hbid}`,
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
export const deleteContactMethod = (data) => {
  const { id: cntmId = "", hb_id: hbid = "" } = data;
  const params = {
    TableName: process.env.entitiesTableName,
    Key: {
      id: cntmId,
      entity: `cntm#${hbid}`,
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
    const isExternalCntmList =
      event && event.path ? event.path.includes("list") : false;
    let data;
    switch (event.httpMethod) {
      case "GET":
        if (action === "list" || (isExternalAPI && isExternalCntmList)) {
          response = await listContactMethod(event, isExternalAPI);
        } else if (action === "list_order") {
          response = await listOrder("cntm", event);
        } else if (action === "get") {
          response = await getContactMethod(event);
        } else {
          response = failure();
        }
        break;
      case "POST":
        data = JSON.parse(event.body);
        if (!data) {
          response = failure();
        } else if (action === "create") {
          response = await createContactMethod(data);
        } else if (action === "update_order") {
          response = await updateOrder("cntm", data);
        } else if (action === "update") {
          response = await updateContactMethod(data);
        } else if (action === "delete") {
          response = await deleteContactMethod(data);
        } else if (action === "list") {
          response = await listContactMethodElastic(data);
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
