/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import { v4 as uuidv4 } from "uuid";
import {
  getGradeCreateJSON,
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

export const createGrade = (data) => {
  const expJSON = getGradeCreateJSON(data);
  const params = {
    TableName: process.env.entitiesTableName,
    Item: {
      type: "grade",
      hb_id: expJSON.hb_id,
      name: expJSON.name,
      mdt: expJSON.mod_dt,
      cdt: expJSON.cdt,
      id: uuidv4(),
      entity: `grade#${expJSON.hb_id}`,
    },
  };
  return postResources(params);
};
export const updateGradeRow = (data) => {
  const params = {
    TableName: process.env.entitiesTableName,
    Item: {
      type: "grade",
      hb_id: data.hb_id,
      name: data.name,
      mdt: Date.now(),
      cdt: data.cdt,
      id: data.id,
      entity: `grade#${data.hb_id}`,
    },
  };
  return postResources(params);
};
export const listGrade = async (event, isExternalAPI, isJSONOnly = false) => {
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
      ":entity": `grade#${hbidParam}`,
    },
  };
  console.log(params);

  if (isJSONOnly) {
    return getResourceJSON(params);
  }

  if (isExternalAPI) {
    const listGradeResp = await getResourceJSON(params);
    // Only fetch id, name and any other important fields only
    const gradeList = listGradeResp.map((item) => ({
      id: item.id,
      name: item.name,
    }));
    return success(gradeList);
  }

  const combineOrderRes = await combineOrder("grade", hbidParam, params);
  return combineOrderRes;
};
const listGradeElastic = async (data) => {
  let list;
  try {
    list = await initListAPI({ ...data, entity: "grade" });
  } catch (error) {
    return failure({ status: false, error: "Grade list failed." });
  }
  return list;
};
export const getGrade = (event) => {
  const params = getParamsForQuery(event, "grade");
  return getResources(params);
};
export const updateGrade = (data) => {
  const {
    grade_id: gradeId = "",
    attrn: propName = "",
    attrv: propVal = "",
    hb_id: hbid = "",
  } = data;
  const modDt = Date.now();

  const params = {
    TableName: process.env.entitiesTableName,
    Key: {
      id: gradeId,
      entity: `grade#${hbid}`,
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
export const deleteGrade = (data) => {
  const { id: gradeId = "", hb_id: hbid = "" } = data;
  const params = {
    TableName: process.env.entitiesTableName,
    Key: {
      id: gradeId,
      entity: `grade#${hbid}`,
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
    const isExternalGradeList =
      event && event.path ? event.path.includes("list") : false;
    let data;
    switch (event.httpMethod) {
      case "GET":
        if (action === "list" || (isExternalAPI && isExternalGradeList)) {
          response = await listGrade(event, isExternalAPI);
        } else if (action === "list_order") {
          response = await listOrder("grade", event);
        } else if (action === "get") {
          response = await getGrade(event);
        } else {
          response = failure();
        }
        break;
      case "POST":
        data = JSON.parse(event.body);
        if (!data) {
          response = failure();
        } else if (action === "create") {
          response = await createGrade(data);
        } else if (action === "update_order") {
          response = await updateOrder("grade", data);
        } else if (action === "update") {
          response = await updateGrade(data);
        } else if (action === "delete") {
          response = await deleteGrade(data);
        } else if (action === "list") {
          response = await listGradeElastic(data);
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
