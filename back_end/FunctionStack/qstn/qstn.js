/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import { v4 as uuidv4 } from "uuid";
import {
  getQuestionJSON,
  transactWriteItems,
  postResources,
  getResourceJSON,
  getResources,
  deleteResources,
  updateResources,
  updateOrder,
  listOrder,
  combineOrder,
  initListAPI,
} from "../libs/db";
import { success, failure } from "../libs/response-lib";
import { validateFields } from "../validation/validation";
import { updateSegmentRule, removeQuestions } from "../campaign/campaign";

export const createQuestion = (data) => {
  const retVal = validateFields("question", data);
  if (retVal === "") {
    console.log("validation Success");
    const dgraphJSON = getQuestionJSON(data);
    const transArr = [];
    console.log(dgraphJSON);
    console.log("validation Success");
    data.type.forEach((typeItem) => {
      const tempUUid = uuidv4();
      let proceedCreate = true;
      if (
        dgraphJSON.rel_id === "community" &&
        ["agency", "realtor"].indexOf(typeItem) !== -1
      ) {
        proceedCreate = false;
      }
      /* if (
        dgraphJSON.rel_id === "metro" &&
        ["cobuyer"].indexOf(typeItem) !== -1
      ) {
        proceedCreate = false;
      } */
      if (proceedCreate) {
        transArr.push({
          Put: {
            TableName: process.env.entitiesTableName,
            Item: {
              id: tempUUid,
              type: `question_${typeItem}`,
              rel_id: dgraphJSON.rel_id,
              qstn_text: dgraphJSON.qstn_text,
              qstn_options: dgraphJSON.qstn_options,
              qstn_type: dgraphJSON.qstn_type,
              fltr_list: dgraphJSON.fltr_list,
              active: dgraphJSON.active,
              reqd: dgraphJSON.reqd,
              hb_id: dgraphJSON.hb_id,
              deleted: false,
              mdt: dgraphJSON.mdt,
              cdt: dgraphJSON.cdt,
              entity: `question#${dgraphJSON.hb_id}#${typeItem}`,
              data: `question#${dgraphJSON.hb_id}`,
            },
            ReturnValuesOnConditionCheckFailure: "ALL_OLD",
          },
        });
      }
    });
    const transParams = {
      TransactItems: transArr,
    };
    console.log(`transArr: ${JSON.stringify(transArr)}`);
    return transactWriteItems(transParams);
  }
  return failure({ status: false, error: "Validation Failed", retVal });
};

export const updateQuestionRow = (data) => {
  const params = {
    TableName: process.env.entitiesTableName,
    Item: {
      id: data.id,
      type: "",
      rel_id: data.rel_id,
      qstn_text: data.qstn_text,
      qstn_options: data.qstn_options,
      qstn_type: data.qstn_type,
      fltr_list: data.fltr_list,
      active: data.active,
      reqd: data.reqd,
      deleted: data.deleted,
      hb_id: data.hb_id,
      mdt: Date.now(),
      cdt: data.cdt,
    },
  };
  switch (data.type) {
    case "realtor":
      params.Item.type = "question_realtor";
      break;
    case "customer":
      params.Item.type = "question_customer";
      break;
    case "cobuyer":
      params.Item.type = "question_cobuyer";
      break;
    case "agency":
      params.Item.type = "question_agency";
      break;
    default:
      break;
  }
  params.Item.entity = `question#${params.Item.hb_id}#${data.type}`;
  params.Item.data = `question#${params.Item.hb_id}`;
  if (params.Item.type.length) {
    return postResources(params);
  }
  return failure({ status: false, error: "Type field required" });
};

export const listQuestion = async (event, isExternalAPI) => {
  const hbidParam =
    event && event.pathParameters && event.pathParameters.hbid
      ? event.pathParameters.hbid
      : 0;
  const params = {
    TableName: process.env.entitiesTableName,
    IndexName: process.env.entitiesTableByDataAndEntity,
    KeyConditionExpression: "#data = :data",
    ExpressionAttributeNames: {
      "#data": "data",
    },
    ExpressionAttributeValues: {
      ":data": `question#${hbidParam}`,
    },
  };
  console.log(params);
  if (isExternalAPI) {
    const listQstnResp = await getResourceJSON(params);
    // Only fetch id, name and any other important fields only
    const qstnList = listQstnResp
      .filter(
        (question) => question.active && question.type === "question_customer"
      )
      .map((item) => ({
        id: item.id,
        qstn_text: item.qstn_text,
        qstn_options: item.qstn_options,
        qstn_type: item.qstn_type,
        reqd: item.reqd,
      }));
    return success(qstnList);
  }

  const combineOrderRes = await combineOrder("question", hbidParam, params);
  return combineOrderRes;
};
const listQuestionElastic = async (data) => {
  let list;
  try {
    list = await initListAPI({ ...data, entity: "question", isDataCall: true });
  } catch (error) {
    return failure({ status: false, error: "Demographics list failed." });
  }
  return list;
};
/* export const listQuestionReusable = async (event) => {
    const hbidParam = event && event.pathParameters && event.pathParameters.hbid ? event.pathParameters.hbid : 0;
    const params = {
        TableName: process.env.entitiesTableName,
        IndexName: process.env.entitiesTableByDataAndEntity,
        KeyConditionExpression: "#data = :data",
        ExpressionAttributeNames: {
            "#data": "data",
        },
        ExpressionAttributeValues: {
            ":data": `question#${hbidParam}`
        }
    };
    console.log(params);
    return dynamoDbLib.call("query", params);
} */

export const listQuestionByType = (event) => {
  const hbidParam =
    event && event.pathParameters && event.pathParameters.hbid
      ? event.pathParameters.hbid
      : 0;
  const typeParam =
    event && event.pathParameters && event.pathParameters.id
      ? event.pathParameters.id
      : "";
  const params = {
    TableName: process.env.entitiesTableName,
    IndexName: process.env.entitiesTableByEntityAndId,
    KeyConditionExpression: "#entity = :entity",
    ExpressionAttributeNames: {
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":entity": `question#${hbidParam}#${typeParam}`,
    },
  };
  console.log(params);
  return getResources(params);
};

export const getQuestion = (data) => {
  const params = {
    TableName: process.env.entitiesTableName,
    KeyConditionExpression: "#id = :id and #entity = :entity",
    ExpressionAttributeNames: {
      "#id": "id",
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":id": data.id,
      ":entity": `question#${data.hbid}#${data.type}`,
    },
  };
  console.log(params);
  return getResources(params);
};

export const deleteQuestion = async (data) => {
  const { id: dGraphId = "", hb_id: hbId = "", type = "", appid = "" } = data;
  const params = {
    TableName: process.env.entitiesTableName,
    Key: {
      id: dGraphId,
      entity: `question#${hbId}#${type}`,
    },
  };
  console.log(params);
  const updateSegmentRuleResp = await updateSegmentRule(dGraphId, appid);
  console.log(
    `updateSegmentRuleResp: ${JSON.stringify(updateSegmentRuleResp)}`
  );
  const removeQuestionsResp = await removeQuestions({
    appid,
    qstns: [dGraphId],
  });
  console.log(`removeQuestionsResp: ${JSON.stringify(removeQuestionsResp)}`);
  return deleteResources(params);
};

export const deleteQuestionStatusChange = async (data) => {
  const { id: dGraphId = "", hb_id: hbId = "", type = "", appid = "" } = data;
  const propName = "deleted";
  const propVal = true;
  const params = {
    TableName: process.env.entitiesTableName,
    Key: {
      id: dGraphId,
      entity: `question#${hbId}#${type}`,
    },
    UpdateExpression: `set #propName = :pval`,
    ExpressionAttributeNames: {
      "#propName": propName,
    },
    ExpressionAttributeValues: {
      ":pval": propVal,
    },
  };
  console.log(params);
  const deleteQuestionResp = await updateResources(params);
  console.log(`deleteQuestionResp: ${JSON.stringify(deleteQuestionResp)}`);
  const updateSegmentRuleResp = await updateSegmentRule(dGraphId, appid);
  console.log(
    `updateSegmentRuleResp: ${JSON.stringify(updateSegmentRuleResp)}`
  );
  return deleteQuestionResp;
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
  let data;
  try {
    const action =
      event && event.pathParameters && event.pathParameters.action
        ? event.pathParameters.action
        : 0;
    const isExternalAPI =
      event && event.path ? event.path.includes("external") : false;
    const isExternalQstnList =
      event && event.path ? event.path.includes("list") : false;
    switch (event.httpMethod) {
      case "GET":
        if (action === "list" || (isExternalAPI && isExternalQstnList)) {
          response = await listQuestion(event, isExternalAPI);
        } else if (action === "list_order") {
          response = await listOrder("question", event);
        } else {
          response = failure();
        }
        break;
      case "POST":
        data = JSON.parse(event.body);
        if (!data) {
          response = failure();
        } else if (action === "create") {
          response = await createQuestion(data);
        } else if (action === "update_order") {
          response = await updateOrder("question", data);
        } else if (action === "update") {
          response = await updateQuestionRow(data);
        } else if (action === "delete") {
          response = await deleteQuestion(data);
        } else if (action === "get") {
          response = await getQuestion(data);
        } else if (action === "list") {
          response = await listQuestionElastic(data);
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
