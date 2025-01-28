/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import { v4 as uuidv4 } from "uuid";
import {
  getExpertiseCreateJSON,
  postResources,
  getResources,
  getParamsForQuery,
  updateResources,
  deleteResources,
  updateOrder,
  listOrder,
  combineOrder,
  initListAPI,
} from "../libs/db";
import { failure } from "../libs/response-lib";

export const createExpertise = (data) => {
  const expJSON = getExpertiseCreateJSON(data);
  const params = {
    TableName: process.env.entitiesTableName,
    Item: {
      type: "exp",
      hb_id: expJSON.hb_id,
      name: expJSON.name,
      mdt: expJSON.mod_dt,
      cdt: expJSON.cdt,
      entity: `exp#${expJSON.hb_id}`,
      id: uuidv4(),
    },
  };
  return postResources(params);
};
export const updateExpertiseRow = (data) => {
  const params = {
    TableName: process.env.entitiesTableName,
    Item: {
      type: "exp",
      hb_id: data.hb_id,
      name: data.name,
      mdt: Date.now(),
      cdt: data.cdt,
      entity: `exp#${data.hb_id}`,
      id: data.id,
    },
  };
  return postResources(params);
};
export const listExpertise = async (event) => {
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
      ":entity": `exp#${hbidParam}`,
    },
  };
  console.log(params);
  const combineOrderRes = await combineOrder("exp", hbidParam, params);
  return combineOrderRes;
};
const listExpertiseElastic = async (data) => {
  let list;
  try {
    list = await initListAPI({ ...data, entity: "exp" });
  } catch (error) {
    return failure({ status: false, error: "Expertise list failed." });
  }
  return list;
};
export const getExpertise = (event) => {
  const params = getParamsForQuery(event, "exp");
  return getResources(params);
};
export const updateExpertise = (data) => {
  const id = data.id ? data.id : "";
  const propName = data.attrn ? data.attrn : "";
  const propVal = data.attrv ? data.attrv : "";
  const hbid = data.hb_id ? data.hb_id : "";
  const modDt = Date.now();

  const params = {
    TableName: process.env.entitiesTableName,
    Key: {
      id,
      entity: `exp#${hbid}`,
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
export const deleteExpertise = (data) => {
  const id = data.id ? data.id : 0;
  const hbid = data.hb_id ? data.hb_id : "";
  const params = {
    TableName: process.env.entitiesTableName,
    Key: {
      id,
      entity: `exp#${hbid}`,
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
          response = await listExpertise(event);
        } else if (action === "list_order") {
          response = await listOrder("exp", event);
        } else if (action === "get") {
          response = await getExpertise(event);
        } else {
          response = failure();
        }
        break;
      case "POST":
        data = JSON.parse(event.body);
        if (!data) {
          response = failure();
        } else if (action === "create") {
          response = await createExpertise(data);
        } else if (action === "update_order") {
          response = await updateOrder("exp", data);
        } else if (action === "update") {
          response = await updateExpertise(data);
        } else if (action === "delete") {
          response = await deleteExpertise(data);
        } else if (action === "list") {
          response = await listExpertiseElastic(data);
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
