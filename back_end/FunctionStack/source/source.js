/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import { v4 as uuidv4 } from "uuid";
import {
  getSourceCreateJSON,
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
  createDataInAllBuilder,
} from "../libs/db";
import { failure, success } from "../libs/response-lib";

export const createSource = async (data, isJSONOnly = false) => {
  try {
    console.log(`CreateSource: ${JSON.stringify(data)}`);
    const expJSON = getSourceCreateJSON(data);
    if(!expJSON.hb_id) throw "hb_id is Required";

    if(expJSON?.name.toLowerCase() === "unknown"){
      const isUnknownExistResp = await isUnknownNotExists(expJSON.hb_id);
      if(!isUnknownExistResp.status) throw isUnknownExistResp.error;
    };

    const params = {
      TableName: process.env.entitiesTableName,
      Item: {
        type: "psrc",
        hb_id: expJSON.hb_id,
        name: expJSON.name,
        mdt: expJSON.mod_dt,
        cdt: expJSON.cdt,
        id: uuidv4(),
        entity: `psrc#${expJSON.hb_id}`,
      },
    };
		if(isJSONOnly) {
			return postResources(params, true);
		};
    return postResources(params);
  }catch (error) {
		console.log(`Error: ${JSON.stringify(error)}`);
		if(isJSONOnly) return {status: false, error: error?.message || error};
    return failure ({status: false, error: error?.message || error});
  };
};

export const updateSourceRow = async (data) => {
	try {
		
    if(!data.hb_id) throw "hb_id is Required";

    if(data?.name.toLowerCase() === "unknown"){
      const isUnknownExistResp = await isUnknownNotExists(data.hb_id);
      if(!isUnknownExistResp.status) throw isUnknownExistResp.error;
    };

		const params = {
			TableName: process.env.entitiesTableName,
			Item: {
				type: "psrc",
				hb_id: data.hb_id,
				name: data.name,
				mdt: Date.now(),
				cdt: data.cdt,
				id: data.id,
				entity: `psrc#${data.hb_id}`,
			},
		};
		return postResources(params);
	} catch (error) {
		console.log(`Error: ${JSON.stringify(error)}`);
		return failure({status: false, error: error?.message || error});
	};
};
export const listSource = async (event, isJSONOnly, isExternalAPI) => {
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
      ":entity": `psrc#${hbidParam}`,
    },
  };
  console.log(params);
  if (isJSONOnly) {
    return getResourceJSON(params);
  }

  if (isExternalAPI) {
    const listSourceResp = await getResourceJSON(params);
    // Only fetch id, name and any other important fields only
    const sourceList = listSourceResp.map((item) => ({
      id: item.id,
      name: item.name,
    }));
    return success(sourceList);
  }

  const combineOrderRes = await combineOrder("psrc", hbidParam, params);
  return combineOrderRes;
};
const listSourceElastic = async (data) => {
  let list;
  try {
    list = await initListAPI({ ...data, entity: "psrc" });
  } catch (error) {
    return failure({ status: false, error: "Source list failed." });
  }
  return list;
};
export const getSource = (event) => {
  const params = getParamsForQuery(event, "psrc");
  return getResources(params);
};
export const updateSource = (data) => {
  const {
    source_id: sourceId = "",
    attrn: propName = "",
    attrv: propVal = "",
    hb_id: hbId = "",
  } = data;
  const modDt = Date.now();

  const params = {
    TableName: process.env.entitiesTableName,
    Key: {
      id: sourceId,
      entity: `psrc#${hbId}`,
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
export const deleteSource = (data) => {
	try {
		const { id: sourceId = "", hb_id: hbId = "" } = data;
		const params = {
			TableName: process.env.entitiesTableName,
			Key: {
				id: sourceId,
				entity: `psrc#${hbId}`,
			},
		};
		console.log(params);
		return deleteResources(params);
	} catch (error) {
		console.log(`Error: ${JSON.stringify(error)}`);
		return failure({status: false, error: error?.message || error})
	};
};

// check the unknown source is not exists;
export const isUnknownNotExists = async (hbid) => {
  try {
    const listSouceParams = {
      pathParameters: {
        hb_id: hbid
      }
    };
    const getSourceListResp = await listSource(listSouceParams, true);
    console.log(`getSourceListResp: ${JSON.stringify(getSourceListResp)}`);
    if(getSourceListResp.length){
      getSourceListResp.forEach(eachSource => {
        if(eachSource?.name.toLowerCase() === "unknown") throw "Unknown Source Already Exists";
      });
    };
    return {status: true, data: "Unknown Not Exists"};
  } catch (error) {
    console.log(`Error: ${error}`);
    return {status: false, error: error?.message || error};
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
    const isExternalSrcList =
      event && event.path ? event.path.includes("list") : false;
    let data;
    switch (event.httpMethod) {
      case "GET":
        if (action === "list" || (isExternalAPI && isExternalSrcList)) {
          response = await listSource(event, false, isExternalAPI);
        } else if (action === "list_order") {
          response = await listOrder("psrc", event);
        } else if (action === "get") {
          response = await getSource(event);
        } else {
          response = failure();
        }
        break;
      case "POST":
        data = JSON.parse(event.body);
        if (!data) {
          response = failure();
        } else if (action === "create") {
          response = await createSource(data);
        } else if (action === "update_order") {
          response = await updateOrder("psrc", data);
        } else if (action === "update") {
          response = await updateSource(data);
        } else if (action === "delete") {
          response = await deleteSource(data);
        } else if (action === "list") {
          response = await listSourceElastic(data);
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
