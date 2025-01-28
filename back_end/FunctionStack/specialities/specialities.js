/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import { v4 as uuidv4 } from "uuid";
import {
  getSpecialityCreateJSON,
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

export const createSpeciality = (data) => {
  const expJSON = getSpecialityCreateJSON(data);
  const params = {
    TableName: process.env.entitiesTableName,
    Item: {
      type: "spec",
      hb_id: expJSON.hb_id,
      name: expJSON.name,
      mdt: expJSON.mod_dt,
      cdt: expJSON.cdt,
      entity: `spec#${expJSON.hb_id}`,
      id: uuidv4(),
    },
  };
  return postResources(params);
};
export const updateSpecialityRow = (data) => {
  const params = {
    TableName: process.env.entitiesTableName,
    Item: {
      type: "spec",
      hb_id: data.hb_id,
      name: data.name,
      mdt: Date.now(),
      cdt: data.cdt,
      entity: `spec#${data.hb_id}`,
      id: data.id,
    },
  };
  return postResources(params);
};
export const listSpeciality = async (event) => {
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
      ":entity": `spec#${hbidParam}`,
    },
  };
  console.log(params);
  const combineOrderRes = await combineOrder("spec", hbidParam, params);
  return combineOrderRes;
};
const listSpecialitiesElastic = async (data) => {
  let list;
  try {
    list = await initListAPI({ ...data, entity: "spec" });
  } catch (error) {
    return failure({ status: false, error: "Specialities list failed." });
  }
  return list;
};
export const getSpeciality = (event) => {
  const params = getParamsForQuery(event, "spec");
  return getResources(params);
};
export const updateSpeciality = (data) => {
  const id = data.id ? data.id : 0;
  const propName = data.attrn ? data.attrn : "";
  const propVal = data.attrv ? data.attrv : "";
  const hbid = data.hb_id ? data.hb_id : "";
  const modDt = Date.now();

  const params = {
    TableName: process.env.entitiesTableName,
    Key: {
      id,
      entity: `spec#${hbid}`,
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
export const deleteSpeciality = (data) => {
  const id = data.id ? data.id : "";
  const hbid = data.hb_id ? data.hb_id : "";
  const params = {
    TableName: process.env.entitiesTableName,
    Key: {
      id,
      entity: `spec#${hbid}`,
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
          response = await listSpeciality(event);
        } else if (action === "list_order") {
          response = await listOrder("spec", event);
        } else if (action === "get") {
          response = await getSpeciality(event);
        } else {
          response = failure();
        }
        break;
      case "POST":
        data = JSON.parse(event.body);
        if (!data) {
          response = failure();
        } else if (action === "create") {
          response = await createSpeciality(data);
        } else if (action === "update_order") {
          response = await updateOrder("spec", data);
        } else if (action === "update") {
          response = await updateSpeciality(data);
        } else if (action === "delete") {
          response = await deleteSpeciality(data);
        } else if (action === "list") {
          response = await listSpecialitiesElastic(data);
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
