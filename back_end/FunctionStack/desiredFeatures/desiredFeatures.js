/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import AWS from 'aws-sdk';
import { v4 as uuidv4 } from "uuid";
import {
  getDesiredFeatureCreateJSON,
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
import { isDuplicated } from "../validation/validation";

const { DELETE_PROFILE_DATA_STATE_MACHINE_ARN } = process.env;
const sfn = new AWS.StepFunctions();

export const createDesiredFeature = async (data) => {
  try {

    const dfJSON = getDesiredFeatureCreateJSON(data);
    const params = {
      TableName: process.env.entitiesTableName,
      Item: {
        type: "desf",
        hb_id: dfJSON.hb_id,
        name: dfJSON.name,
        mdt: dfJSON.mod_dt,
        cdt: dfJSON.cdt,
        id: uuidv4(),
        entity: `desf#${dfJSON.hb_id}`,
      },
    };
    // check the name is duplicated
    const isDuplicateName = await isDuplicated({ hbid: dfJSON.hb_id, key: "name", val: dfJSON.name, entity: "desf" });
    if (!isDuplicateName.status) throw isDuplicateName.error;

    return postResources(params);
  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`)
    return failure({ status: false, error: error?.message || error });
  };
};
export const updateDesiredFeatureRow = async (data) => {
  try {

    const params = {
      TableName: process.env.entitiesTableName,
      Item: {
        type: "desf",
        hb_id: data.hb_id,
        name: data.name,
        mdt: Date.now(),
        cdt: data.cdt,
        id: data.id,
        entity: `desf#${data.hb_id}`,
      },
    };
    // check the name is duplicated
    const isDuplicateName = await isDuplicated({ hbid: data.hb_id, key: "name", val: data.name, entity: "desf", id: data.id });
    if (!isDuplicateName.status) throw isDuplicateName.error;

    return postResources(params);
  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`);
    return failure({ status: false, error: error?.message || error });
  };
};
export const listDesiredFeatures = async (event, isExternalAPI) => {
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
      ":entity": `desf#${hbidParam}`,
    },
  };
  console.log(params);
  if (isExternalAPI) {
    const listDesiredFeaturesResp = await getResourceJSON(params);
    // Only fetch id, name and any other important fields only
    const desiredFeaturesList = listDesiredFeaturesResp.map((item) => ({
      id: item.id,
      name: item.name,
    }));
    return success(desiredFeaturesList);
  }

  const combineOrderRes = await combineOrder("desf", hbidParam, params);
  return combineOrderRes;
};
const listDesiredFeaturesElastic = async (data) => {
  let list;
  try {
    list = await initListAPI({ ...data, entity: "desf" });
  } catch (error) {
    return failure({ status: false, error: "Desired features list failed." });
  }
  return list;
};
export const getDesiredFeature = (event) => {
  const params = getParamsForQuery(event, "desf");
  return getResources(params);
};
export const updateDesiredFeature = async (data) => {
  try {
    const {
      desf_id: desfId = "",
      attrn: propName = "",
      attrv: propVal = "",
      hb_id: hbid = "",
    } = data;
    const modDt = Date.now();

    // check the name is duplicated
    if (propName === 'name') {
      const isDuplicateName = await isDuplicated({ hbid: hbid, key: "name", val: propVal, entity: "desf", id: desfId });
      if (!isDuplicateName.status) throw isDuplicateName.error;
    };

    const params = {
      TableName: process.env.entitiesTableName,
      Key: {
        id: desfId,
        entity: `desf#${hbid}`,
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
  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`);
    return failure({ status: false, error: error?.message || error });
  };
};
export const deleteDesiredFeature = async (data) => {
  try {
    const { id: desfId = "", hb_id: hbid = "" } = data;
    const params = {
      TableName: process.env.entitiesTableName,
      Key: {
        id: desfId,
        entity: `desf#${hbid}`,
      },
    };
    console.log(params);
    const deleteResp = deleteResources(params);

    // delete desf from all customers that having deleted desf
    const input = JSON.stringify({
      hbId: hbid,
      type: "customer",
      field: "desf",
      fieldArray: [desfId],
      isStart: true,
      setVal: []
    });
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
    const isExternalDesiredFeatureList =
      event && event.path ? event.path.includes("list") : false;
    let data;
    switch (event.httpMethod) {
      case "GET":
        if (
          action === "list" ||
          (isExternalAPI && isExternalDesiredFeatureList)
        ) {
          response = await listDesiredFeatures(event, isExternalAPI);
        } else if (action === "list_order") {
          response = await listOrder("desf", event);
        } else if (action === "get") {
          response = await getDesiredFeature(event);
        } else {
          response = failure();
        }
        break;
      case "POST":
        data = JSON.parse(event.body);
        if (!data) {
          response = failure();
        } else if (action === "create") {
          response = await createDesiredFeature(data);
        } else if (action === "update_order") {
          response = await updateOrder("desf", data);
        } else if (action === "update") {
          response = await updateDesiredFeatureRow(data);
        } else if (action === "delete") {
          response = await deleteDesiredFeature(data);
        } else if (action === "list") {
          response = await listDesiredFeaturesElastic(data);
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
