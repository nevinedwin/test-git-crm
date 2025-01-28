import AWS from "aws-sdk";
import { call, queryPromise, putPromise } from "./dynamodb-lib";
import { success, failure } from "./response-lib";
import { elasticExecuteQuery, getSearchQuery } from "../search/search";
import { listBuilders } from "../builders/builders";


const ssm = new AWS.SSM();
const cloudformation = new AWS.CloudFormation();

export async function describeParameters(parameters, promiseOnly = false) {
  const params = {
    ParameterFilters: parameters,
  };
  console.log(`params: ${JSON.stringify(params)}`);

  // Return Promise only
  if (promiseOnly) {
    return ssm.describeParameters(params).promise();
  }
  let describeParametersResp;
  try {
    describeParametersResp = await ssm.describeParameters(params).promise();
    console.log(
      `describeParametersResp: ${JSON.stringify(describeParametersResp)}`
    );
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
  }
  return describeParametersResp;
}
export async function getParameter(parameterName, promiseOnly = false) {
  const params = {
    Name: parameterName /* required */,
    WithDecryption: true,
  };
  console.log(`params: ${JSON.stringify(params)}`);

  // Return Promise only
  if (promiseOnly) {
    return ssm.getParameter(params).promise();
  }
  let getParameterResp;
  try {
    getParameterResp = await ssm.getParameter(params).promise();
    console.log(`getParameterResp: ${JSON.stringify(getParameterResp)}`);
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
  }
  return getParameterResp;
}
export async function putParameter(obj, promiseOnly = false) {
  const parameterName = obj.parameterName ? obj.parameterName.trim() : "";
  const parameterValue = obj.parameterValue ? obj.parameterValue.trim() : "";
  const isUpdate = obj.isUpdate ? obj.isUpdate : "";

  const params = {
    Name: parameterName /* required */,
    Value: parameterValue /* required */,
    Type: "String",
  };
  if (isUpdate) {
    params.Overwrite = true;
  }
  console.log(`params: ${JSON.stringify(params)}`);

  // Return Promise only
  if (promiseOnly) {
    return ssm.putParameter(params).promise();
  }
  let getParameterResp;
  try {
    getParameterResp = await ssm.putParameter(params).promise();
    console.log(`getParameterResp: ${JSON.stringify(getParameterResp)}`);
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
  }
  return getParameterResp;
}
export function getQueryPromise(params) {
  return queryPromise(params);
}
export function postQueryPromise(params) {
  return putPromise(params);
}
export async function getResources(params, isJSONOnly = false) {
  try {
    const result = await call("query", params);
    console.log(result);
    if (isJSONOnly) {
      return { status: true, data: result?.Items || result };
    };
    return success(result.Items);
  } catch (e) {
    console.log(e);
    if (isJSONOnly) {
      return { status: false, error: error?.message || error };
    };
    return failure({ status: false, error: e.message });
  };
};
export async function scanResources(
  params,
  returnFullResult = false,
  isJSONOnly = false
) {
  try {
    const result = await call("scan", params);
    console.log(result);
    if (returnFullResult) {
      if (isJSONOnly) {
        return result;
      }

      return success(result);
    }

    if (isJSONOnly) {
      return result?.Items;
    }

    return success(result.Items);
  } catch (e) {
    console.log(e);
    return failure({ status: false, error: e.message });
  }
}
export async function getResourcesRaw(params) {
  try {
    let result = await call("query", params);
    console.log(result);
    if (result.Count && result.Count > 0) {
      [result] = result.Items;
    }
    return result;
  } catch (e) {
    console.log(e);
    return e;
  }
}

export async function getResourceJSON(params, returnFullResp = false) {
  try {
    console.log(`params: ${JSON.stringify(params)}`);
    const result = await call("query", params);
    console.log(result);
    if (returnFullResp) {
      return result;
    }

    return result.Items;
  } catch (e) {
    console.log(e);
    return [];
  }
}
const getBatchGetResp = async (params, isHydration) => {
  let resp;
  try {
    const result = await call("batchGet", params);
    console.log(result);
    if (
      result &&
      result.Responses &&
      result.Responses[process.env.entitiesTableName]
    ) {
      resp = result.Responses[process.env.entitiesTableName];
      if (!isHydration) {
        if (resp.length) {
          resp = resp.filter(
            (realtor, index, self) =>
              self.findIndex(
                (rtr) => rtr.email.toLowerCase() === realtor.email.toLowerCase()
              ) === index
          );
        }
      }
    }
  } catch (error) {
    return { status: false, error };
  }
  return { status: true, resp };
};
export async function batchGetResources(params, isHydration = false) {
  try {
    // Check whether the request has more than 100 items
    // If so split the request into multiple requests of 100 items
    const noOfItems =
      params?.RequestItems[process.env.entitiesTableName]?.Keys?.length;
    console.log(`noOfItems: ${noOfItems}`);
    if (noOfItems > 100) {
      let status = true;
      const respArr = [];
      // Handle here
      console.log(`noOfItems greater than 100: ${noOfItems}`);
      const iterations = Math.ceil(noOfItems / 100);
      // Split array into chunks of 100
      let arrIndex = 0;
      let arrIndexEnd = 100;
      for (let itemIndex = 0; itemIndex < iterations; itemIndex += 1) {
        const requestParams = {
          RequestItems: {
            [process.env.entitiesTableName]: {
              Keys: [],
            },
          },
        };
        requestParams.RequestItems[process.env.entitiesTableName].Keys =
          params?.RequestItems[process.env.entitiesTableName]?.Keys?.slice(
            arrIndex,
            arrIndexEnd
          );
        const response = await getBatchGetResp(requestParams, isHydration);
        console.log(`response: ${JSON.stringify(response)}`);
        if (!response.status) status = false;

        respArr.push(response);

        arrIndex += 100;
        arrIndexEnd += 100;
      }
      console.log(`respArr: ${JSON.stringify(respArr)}`);
      return status ? success(respArr) : failure(respArr);
    }

    if (noOfItems === 0) {
      return success({ status: true, msg: "No items found in the request" });
    }

    console.log(`In noOfItems else`);
    const resp = await getBatchGetResp(params, isHydration);
    console.log(`resp: ${JSON.stringify(resp)}`);
    if (resp?.status) return success(resp?.resp);
    return failure(resp?.error);
  } catch (e) {
    console.log(e);
    return failure({ status: false, error: e.message });
  }
}
const getTransactResp = async (params) => {
  try {
    console.log(`params: ${JSON.stringify(params)}`);
    const result = await call("transactWrite", params);
    console.log(`result: ${JSON.stringify(result)}`);
    const itemId =
      params.TransactItems &&
        params.TransactItems.length &&
        params.TransactItems[0] &&
        params.TransactItems[0].Put &&
        params.TransactItems[0].Put.Item &&
        params.TransactItems[0].Put.Item.id
        ? params.TransactItems[0].Put.Item.id
        : "";
    console.log(`itemId: ${JSON.stringify(itemId)}`);
    const response = { status: true, item: {} };
    if (itemId) {
      response.item.id = itemId;
    }
    console.log(`response: ${JSON.stringify(response)}`);
    return response;
  } catch (e) {
    console.log(e);
    return e;
  }
};
const getBatchResp = async (params) => {
  console.log(`params: ${JSON.stringify(params)}`);
  const result = await call("batchWrite", params);
  console.log(result);
  return result;
};
export async function transactWriteItems(params) {
  try {
    console.log(`params: ${JSON.stringify(params)}`);
    // only allow 25 items for transactItems
    // Do the checking
    const noOfItems = params.TransactItems.length;
    console.log(`noOfItems: ${noOfItems}`);
    if (noOfItems > 25) {
      // Handle here
      console.log(`noOfItems greater than 25: ${noOfItems}`);
      const respArr = [];
      const iterations = Math.ceil(noOfItems / 25);
      // Split array into chunks of 25
      let arrIndex = 0;
      let arrIndexEnd = 25;
      for (let itemIndex = 0; itemIndex < iterations; itemIndex += 1) {
        console.log(`itemIndex/iterations: ${itemIndex}/${iterations}`);
        console.log(`arrIndex/arrIndexEnd: ${arrIndex}/${arrIndexEnd}`);
        const response = await getTransactResp({
          TransactItems: params.TransactItems.slice(arrIndex, arrIndexEnd),
        });
        console.log(`response: ${JSON.stringify(response)}`);
        if (itemIndex === 0) {
          respArr.push(response);
        }
        arrIndex += 25;
        arrIndexEnd += 25;
      }
      console.log(`respArr: ${JSON.stringify(respArr)}`);
      return success(respArr[0]);
    }

    if (noOfItems === 0) {
      return success({ status: true, msg: "No Items found for Transaction" });
    }

    console.log(`In noOfItems else`);
    // console.log(`params: ${JSON.stringify(params)}`);
    const response = await getTransactResp(params);
    return success(response);
  } catch (e) {
    console.log(e);
    return failure({ status: false, error: e.message });
  }
}

export async function batchWriteItems(params) {
  let alreadyProcessedReqArr = [];
  try {
    console.log(`params: ${JSON.stringify(params)}`);
    // only allow 25 items for transactItems
    // Do the checking
    const noOfItems = params.RequestItems[process.env.entitiesTableName].length;
    console.log(`noOfItems: ${noOfItems}`);
    if (noOfItems > 25) {
      // Handle here
      console.log(`noOfItems greater than 25: ${noOfItems}`);
      const respObj = { UnprocessedItems: {} };
      const iterations = Math.ceil(noOfItems / 25);
      // Split array into chunks of 25
      let arrIndex = 0;
      let arrIndexEnd = 25;
      for (let itemIndex = 0; itemIndex < iterations; itemIndex += 1) {
        console.log(`itemIndex/iterations: ${itemIndex}/${iterations}`);
        console.log(`arrIndex/arrIndexEnd: ${arrIndex}/${arrIndexEnd}`);
        const customerReqObj = params.RequestItems[
          process.env.entitiesTableName
        ].slice(arrIndex, arrIndexEnd);
        const response = await getBatchResp({
          RequestItems: {
            [process.env.entitiesTableName]: customerReqObj,
          },
        });
        // Pushing already processed request objects to an array
        alreadyProcessedReqArr = [...customerReqObj];

        console.log(`response: ${JSON.stringify(response)}`);
        // If unprocessedItems are nil and it is the first iteration, then push the response to respObj
        // Otherwise if there are unprocessedItems push it regardless of which iteration
        const unprocessedItems = response.UnprocessedItems
          ? response.UnprocessedItems
          : {};
        const isBatchSuccess = !!(
          unprocessedItems &&
          Object.entries(unprocessedItems).length === 0 &&
          unprocessedItems.constructor === Object
        );
        if (itemIndex === 0 || !isBatchSuccess) {
          respObj.UnprocessedItems = { ...unprocessedItems };
        }
        arrIndex += 25;
        arrIndexEnd += 25;
        // throw "Testing exception after first iteration";
      }
      console.log(`respObj: ${JSON.stringify(respObj)}`);
      return success({ resp: respObj, processedarr: alreadyProcessedReqArr });
    }

    if (noOfItems === 0) {
      return success({
        status: true,
        msg: "No Items found for batch operation",
      });
    }

    console.log(`In noOfItems else`);
    // console.log(`params: ${JSON.stringify(params)}`);
    const response = await getBatchResp(params);
    // Pushing already processed request objects to an array
    alreadyProcessedReqArr = [
      ...params.RequestItems[process.env.entitiesTableName],
    ];
    return success({ resp: response, processedarr: alreadyProcessedReqArr });
  } catch (e) {
    console.log(e);
    throw new Error({
      status: false,
      error: e.message,
      completedarr: alreadyProcessedReqArr,
    });
  }
}
export async function postResources(params, isJSONOnly = false) {
  try {
    await call("put", params);
    if (isJSONOnly) {
      return { status: true, item: { id: params.Item.id } };
    };
    return success({ status: true, item: { id: params.Item.id } });
  } catch (e) {
    console.log(e);
    if (isJSONOnly) {
      return { status: false, error: e?.message || e };
    };
    return failure({ status: false, error: e?.message || e });
  };
};

export async function updateResources(params, isJSON = false) {
  try {
    await call("update", params);
    if (isJSON) return { status: true };
    return success({ status: true });
  } catch (e) {
    console.log(e);
    if (isJSON) return { status: false, error: e.message };
    return failure({ status: false, error: e.message });
  }
}

export async function deleteResources(params) {
  try {
    await call("delete", params);
    return success({ status: true });
  } catch (e) {
    console.log(e);
    return failure({ status: false, error: e.message });
  }
}

export async function deleteResourcesRaw(params) {
  try {
    const res = await call("delete", params);
    return res;
  } catch (error) {
    return failure({ status: false, error });
  }
}

/**
 *
 * @param {Object} data Request Data
 */
export function getUserCreateJSON(data, isAgent, isSuperAdmin = false) {
  const userJSON = {};
  const currentDate = Date.now();
  if (isSuperAdmin) {
    // userJSON.type = 'super_admin';
    userJSON.type = "agent";
  } else if (isAgent) {
    userJSON.type = "agent";
    userJSON.sign = data.sign ? data.sign : "";
  } else {
    userJSON.type = "customer";
  }
  userJSON.hb_id = data.hb_id ? data.hb_id : "";
  userJSON.fname = data.fname ? data.fname : "";
  userJSON.lname = data.lname ? data.lname : "";
  userJSON.email = data.email ? data.email.toLowerCase() : "";
  userJSON.phone = data.phone ? data.phone : "";
  userJSON.img = data.img ? data.img : "";
  userJSON.jdt = data.jdt ?? currentDate;
  userJSON.mod_dt = currentDate;
  userJSON.cdt = currentDate;
  if (data.utype !== "agent") {
    userJSON.rinfl = data?.rinfl || false;
  }
  if (!isAgent && !isSuperAdmin) {
    // Only for customers
    userJSON.fav = false;
    userJSON.addr = data.addr || "";
    userJSON.stage = data.stage ? data.stage : "";
    userJSON.psrc = data.psrc ? data.psrc : "";
    userJSON.cntm = data.cntm ? data.cntm : "";
    userJSON.grade = data.grade ? data.grade : "";
    userJSON.inte = data.inte ? data.inte : [];
    userJSON.desf = data.desf ? data.desf : [];
    userJSON.desm = data.desm ? data.desm : "";
    userJSON.agent = data.agent ? data.agent : 0;
    userJSON.infl = data.infl ? data.infl : [];
    userJSON.rltr = data.rltr ? data.rltr : {};
    userJSON.appid = data.appid ? data.appid : "";
    userJSON.brixid = data.brixid ? data.brixid : "";
    userJSON.brixappid = data.brixappid ? data.brixappid : "";
    userJSON.brixprojno = data.brixprojno ? data.brixprojno : [];
    userJSON.brixclientid = data.brixclientid ? data.brixclientid : "";
    userJSON.optst = data.optst ? data.optst : "";
    userJSON.newinte = data.newinte ?? [];
    if (userJSON.optst === "PENDING") userJSON.optindt = 0;
    else if (userJSON.optst === "NONE") userJSON.optindt = currentDate;
    else userJSON.optindt = 0;
    userJSON.optoutdt = 0;
    userJSON.ref = data.ref ? data.ref : "";
    userJSON.hfhbid = data.hfhbid ? data.hfhbid : "";
    userJSON.hfid = data.hfid ? data.hfid : "";
  }
  // Only for Agents
  else if (isSuperAdmin) userJSON.utype = "admin";
  else if (data.utype) userJSON.utype = data.utype;
  else userJSON.utype = "agent";
  // If the user is super_admin, add the privs array
  if (isSuperAdmin) {
    userJSON.privs = data.privs ? data.privs : [];
    userJSON.root = data.root ? data.root : false;
  }
  userJSON.comm = data.comm && data.comm.length ? data.comm : [];
  console.log(`getUserCreateJSON :: ${JSON.stringify(userJSON)}`);
  return userJSON;
}

export function getAgencyCreateJSON(data) {
  const agencyJSON = {};
  agencyJSON.type = "agency";
  agencyJSON.hb_id = data.hb_id ? data.hb_id : 0;
  agencyJSON.tname = data.tname ? data.tname : ""; // team_name
  agencyJSON.cname = data.cname ? data.cname : ""; // company_name
  agencyJSON.m_id = data.m_id ? data.m_id : []; // metro ID
  agencyJSON.stat = "active";
  agencyJSON.mod_dt = Date.now();
  agencyJSON.cdt = Date.now();
  agencyJSON.addr = data?.addr || "";
  return agencyJSON;
}
export function getBrokerCreateJSON(data) {
  const brokerJSON = {};
  brokerJSON.type = "broker";
  brokerJSON.hb_id = data.hb_id ? data.hb_id : 0;
  brokerJSON.fname = data.fname ? data.fname : "";
  brokerJSON.lname = data.lname ? data.lname : "";
  brokerJSON.email = data.email ? data.email.toLowerCase() : "";
  brokerJSON.phone = data.phone ? data.phone : "";
  brokerJSON.ag_id = data.ag_id ? data.ag_id : "";
  brokerJSON.spec = data.spec ? data.spec : [];
  brokerJSON.stat = "active";
  brokerJSON.mod_dt = Date.now();
  brokerJSON.cdt = Date.now();
  return brokerJSON;
}

export function getRealtorCreateJSON(data) {
  const currentDate = Date.now();
  const realtorJSON = {};
  realtorJSON.type = "realtor";
  realtorJSON.hb_id = data.hb_id ? data.hb_id : 0;
  realtorJSON.exp = data.exp ? data.exp : [];
  realtorJSON.spec = data.spec ? data.spec : [];
  realtorJSON.rel_id = data.rel_id ? data.rel_id : "";
  realtorJSON.c_id = data.c_id ? data.c_id : [];
  realtorJSON.psrc = data.psrc ? data.psrc : "";
  realtorJSON.fname = data.fname ? data.fname : "";
  realtorJSON.lname = data.lname ? data.lname : "";
  realtorJSON.phone = data.phone ? data.phone : "";
  realtorJSON.email = data.email ? data.email.toLowerCase() : "";
  realtorJSON.stat = "active";
  realtorJSON.fav = false;
  realtorJSON.infl = data.infl ? data.infl : [];
  realtorJSON.cntm = data.cntm ? data.cntm : "";
  realtorJSON.appid = data.appid ? data.appid : "";
  realtorJSON.comm = data.comm ? data.comm : [];
  realtorJSON.mod_dt = currentDate;
  realtorJSON.cdt = currentDate;
  realtorJSON.optst = data.optst ? data.optst : "";
  if (realtorJSON.optst === "PENDING") realtorJSON.optindt = 0;
  else if (realtorJSON.optst === "NONE") realtorJSON.optindt = currentDate;
  else realtorJSON.optindt = 0;
  realtorJSON.optoutdt = 0;
  realtorJSON.hfhbid = data.hfhbid ? data.hfhbid : "";
  realtorJSON.hfid = data.hfid ? data.hfid : "";
  return realtorJSON;
}

export function getRealtorCreateJSONBulk(data) {
  const currentDate = Date.now();
  const realtorJSON = {};
  realtorJSON.type = "realtor";
  realtorJSON.hb_id = data.hb_id ? data.hb_id : 0;
  realtorJSON.exp = data.exp ? data.exp : [];
  realtorJSON.spec = data.spec ? data.spec : [];
  realtorJSON.rel_id = data.agency_id ? data.agency_id : "";
  realtorJSON.c_id = data.c_id ? data.c_id : [];
  realtorJSON.psrc = data.psrc ? data.psrc : "";
  realtorJSON.fname = data.fname ? data.fname : "";
  realtorJSON.lname = data.lname ? data.lname : "";
  realtorJSON.phone = data.phone ? data.phone : "";
  realtorJSON.email = data.email ? data.email.toLowerCase() : "";
  realtorJSON.stat = "active";
  realtorJSON.fav = false;
  realtorJSON.infl = data.infl ? data.infl : [];
  realtorJSON.cntm = data.cntm ? data.cntm : "";
  realtorJSON.appid = data.appid ? data.appid : "";
  realtorJSON.comm = data.comm ? data.comm : [];
  realtorJSON.mod_dt = currentDate;
  realtorJSON.cdt = currentDate;
  realtorJSON.optst = data.optst ? data.optst : "";
  if (realtorJSON.optst === "PENDING") realtorJSON.optindt = 0;
  else if (realtorJSON.optst === "NONE") realtorJSON.optindt = currentDate;
  else realtorJSON.optindt = 0;
  realtorJSON.optoutdt = 0;
  return realtorJSON;
}

export function getCobuyerCreateJSON(data) {
  const currentDate = Date.now();
  const cobuyerJSON = {};
  cobuyerJSON.type = "cobuyer";
  cobuyerJSON.hb_id = data.hb_id ? data.hb_id : 0;
  cobuyerJSON.fname = data.fname ? data.fname : "";
  cobuyerJSON.lname = data.lname ? data.lname : "";
  cobuyerJSON.email = data.email ? data.email.toLowerCase() : "";
  cobuyerJSON.phone = data.phone ? data.phone : "";
  cobuyerJSON.cntm = data.cntm ? data.cntm : "";
  cobuyerJSON.infl = data.infl ? data.infl : [];
  cobuyerJSON.psrc = data.psrc ? data.psrc : "";
  cobuyerJSON.rel_id = data.rel_id ? data.rel_id : "";
  cobuyerJSON.appid = data.appid ? data.appid : "";
  cobuyerJSON.inte = data.inte ? data.inte : [];
  cobuyerJSON.m_id = data.m_id ? data.m_id : [];
  cobuyerJSON.stat = "active";
  cobuyerJSON.mod_dt = currentDate;
  cobuyerJSON.cdt = currentDate;
  cobuyerJSON.optst = data.optst ? data.optst : "";
  if (cobuyerJSON.optst === "PENDING") cobuyerJSON.optindt = 0;
  else if (cobuyerJSON.optst === "NONE") cobuyerJSON.optindt = currentDate;
  else cobuyerJSON.optindt = 0;
  cobuyerJSON.optoutdt = 0;
  cobuyerJSON.hfhbid = data.hfhbid ? data.hfhbid : "";
  cobuyerJSON.hfid = data.hfid ? data.hfid : "";
  return cobuyerJSON;
}

/* export function getCreateJSON(data) {
    let createJSON = {};
    //createJSON.type = data.type && data.type ? data.type : '';
    createJSON.hb_id = data.hb_id && data.hb_id ? data.hb_id : 0;
    createJSON.fname = data.fname && data.fname ? data.fname : '';
    createJSON.lname = data.lname && data.lname ? data.lname : '';
    createJSON.email = data.email && data.email ? data.email.toLowerCase() : '';
    createJSON.phone = data.phone && data.phone ? data.phone : '';
    createJSON.img = data.img && data.img ? data.img : '';
    createJSON.stage = data.stage && data.stage ? data.stage : '';
    createJSON.psrc = data.psrc && data.psrc ? data.psrc : '';
    createJSON.cntm = data.cntm && data.cntm ? data.cntm : '';
    createJSON.grade = data.grade && data.grade ? data.grade : '';
    createJSON.inte = data.inte && data.inte ? data.inte : [];
    createJSON.desf = data.desf && data.desf ? data.desf : [];
    createJSON.desm = data.desm && data.desm ? data.desm : '';
    createJSON.agent = data.agent && data.agent ? data.agent : 0;
    createJSON.infl = data.infl && data.infl ? data.infl : [];
    createJSON.rltr = data.rltr && data.rltr ? data.rltr : {};
    createJSON.exp = data.exp && data.exp ? data.exp : [];
    createJSON.spec = data.spec && data.spec ? data.spec : [];
    createJSON.rel_id = data.rel_id && data.rel_id ? data.rel_id : '';
    createJSON.ag_id = data.ag_id && data.ag_id ? data.ag_id : '';
    createJSON.c_id = data.c_id && data.c_id ? data.c_id : [];  //customer ID
    createJSON.tname = data.tname && data.tname ? data.tname : ''; //team_name
    createJSON.cname = data.cname && data.cname ? data.cname : ''; //company_name
    createJSON.m_id = data.m_id && data.m_id ? data.m_id : [];//metro ID
    createJSON.mod_dt = Date.now();
    createJSON.cdt = Date.now();
    createJSON.stat = 'active';
    return createJSON;
} */

export function getMetroCreateJSON(data) {
  const metroJSON = {};
  metroJSON.hb_id = data.hb_id ? data.hb_id : 0;
  metroJSON.name = data.name ? data.name : "";
  metroJSON.mod_dt = Date.now();
  metroJSON.cdt = Date.now();
  return metroJSON;
}
export function getExpertiseCreateJSON(data) {
  const expJSON = {};
  expJSON.hb_id = data.hb_id ? data.hb_id : 0;
  expJSON.name = data.name ? data.name : "";
  expJSON.mod_dt = Date.now();
  expJSON.cdt = Date.now();
  return expJSON;
}
export function getSpecialityCreateJSON(data) {
  const specJSON = {};
  specJSON.hb_id = data.hb_id ? data.hb_id : 0;
  specJSON.name = data.name ? data.name : "";
  specJSON.mod_dt = Date.now();
  specJSON.cdt = Date.now();
  return specJSON;
}
export function getContactMethodCreateJSON(data) {
  const specJSON = {};
  specJSON.hb_id = data.hb_id ? data.hb_id : 0;
  specJSON.name = data.name ? data.name : "";
  specJSON.mod_dt = Date.now();
  specJSON.cdt = Date.now();
  return specJSON;
}
export function getGradeCreateJSON(data) {
  const specJSON = {};
  specJSON.hb_id = data.hb_id ? data.hb_id : 0;
  specJSON.name = data.name ? data.name : "";
  specJSON.mod_dt = Date.now();
  specJSON.cdt = Date.now();
  return specJSON;
}

export function getDesiredFeatureCreateJSON(data) {
  const dfJSON = {};
  dfJSON.hb_id = data.hb_id ? data.hb_id : 0;
  dfJSON.name = data.name ? data.name : "";
  dfJSON.mod_dt = Date.now();
  dfJSON.cdt = Date.now();
  return dfJSON;
}

export function getInfluenceCreateJSON(data) {
  const specJSON = {};
  specJSON.hb_id = data.hb_id ? data.hb_id : 0;
  specJSON.name = data.name ? data.name : "";
  specJSON.mod_dt = Date.now();
  specJSON.cdt = Date.now();
  return specJSON;
}

export function getMoveInTimeFrameCreateJSON(data) {
  const specJSON = {};
  specJSON.hb_id = data.hb_id ? data.hb_id : 0;
  specJSON.name = data.name ? data.name : "";
  specJSON.mod_dt = Date.now();
  specJSON.cdt = Date.now();
  return specJSON;
}

export function getSourceCreateJSON(data) {
  const specJSON = {};
  specJSON.hb_id = data.hb_id ? data.hb_id : 0;
  specJSON.name = data.name ? data.name : "";
  specJSON.mod_dt = Date.now();
  specJSON.cdt = Date.now();
  return specJSON;
}
const fieldTypes = [
  { name: "inte", type: Array },
  { name: "desf", type: Array },
  { name: "infl", type: Array },
  { name: "rltr", type: Object },
  { name: "exp", type: Array },
  { name: "spec", type: Array },
  { name: "m_id", type: Array },
];
export function isCorrectFieldType(userJSON, sendErrorField = false) {
  const errorFields = [];
  for (const field of fieldTypes) {
    if (
      userJSON[field.name] &&
      userJSON[field.name].constructor !== field.type
    ) {
      if (sendErrorField) {
        // Add the error field and type expected
        errorFields.push(
          `${field.name} field should be of type ${field.name !== "rltr" ? "Array" : "Object"
          }`
        );
      } else {
        return false;
      }
    }
  }
  if (sendErrorField) {
    // Send the fields having type errors also
    return { status: !errorFields.length, field: errorFields };
  }

  return true;
}

const fieldTypesRealtor = [
  { name: "fname", type: String },
  { name: "lname", type: String },
  { name: "email", type: String },
  { name: "phone", type: String },
  { name: "psrc", type: String },
  { name: "infl", type: Array },
  { name: "cntm", type: String },
  { name: "exp", type: Array },
  { name: "spec", type: Array },
  { name: "comm", type: Array },
];
export function isCorrectFieldTypeRealtor(realtorJSON, sendErrorField = false) {
  const errorFields = [];
  for (const realtorFieldItem of fieldTypesRealtor) {
    if (
      realtorJSON[realtorFieldItem.name] &&
      realtorJSON[realtorFieldItem.name].constructor !== realtorFieldItem.type
    ) {
      if (sendErrorField) {
        // Add the error field and type expected
        errorFields.push(
          `${realtorFieldItem.name} field should be of type ${realtorFieldItem.name !== "fname" ||
            realtorFieldItem.name !== "email"
            ? "Array"
            : "String"
          }`
        );
      } else {
        return false;
      }
    }
  }
  if (sendErrorField) {
    // Send the fields having type errors also
    return { status: !errorFields.length, field: errorFields };
  }

  return true;
}
export function getParamsForQuery(event, type) {
  console.log(`event: ${JSON.stringify(event)}`);
  const idParam =
    event && event.pathParameters && event.pathParameters.id
      ? event.pathParameters.id
      : 0;
  const hbidParam =
    event && event.pathParameters && event.pathParameters.hbid
      ? event.pathParameters.hbid
      : 0;
  console.log(`idParam: ${idParam}`);
  const params = {
    TableName: process.env.entitiesTableName,
    KeyConditionExpression: "#id = :id and #entity = :entity",
    ExpressionAttributeNames: {
      "#id": "id",
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":id": idParam,
      ":entity": `${type}#${hbidParam}`,
    },
  };
  console.log(params);
  return params;
}
export function getHydrationParamsForQuery(
  id,
  type = "customer",
  isActivity = false,
  exactEntity = false,
  idOnly = false
) {
  console.log(`id: ${id}`);
  console.log(`type: ${type}`);
  console.log(`isActivity: ${isActivity}`);
  const params = {
    TableName: process.env.entitiesTableName,
    KeyConditionExpression: "",
    ExpressionAttributeNames: {},
    ExpressionAttributeValues: {},
  };
  // For activity, return data GSI get params
  if (isActivity) {
    params.IndexName = process.env.entitiesTableByDataAndEntity;
    params.KeyConditionExpression = "#data = :data";
    params.ExpressionAttributeNames = {
      "#data": "data",
    };
    params.ExpressionAttributeValues = {
      ":data": id,
    };
  } else {
    if (exactEntity) {
      params.KeyConditionExpression = "#id = :id and #entity = :entity";
    } else if (idOnly) {
      params.KeyConditionExpression = "#id = :id";
    } else {
      params.KeyConditionExpression =
        "#id = :id and begins_with(#entity, :entity)";
    }
    params.ExpressionAttributeNames = {
      "#id": "id",
    };
    params.ExpressionAttributeValues = {
      ":id": id,
    };
    if (!idOnly) {
      params.ExpressionAttributeNames["#entity"] = "entity";
      params.ExpressionAttributeValues[":entity"] = type;
    }
  }
  console.log(`params`);
  console.log(params);
  return params;
}

// ################################################################
export function getQuestionJSON(data) {
  const qstnJSON = {};
  qstnJSON.qstn_text = data.qstn_text && data.qstn_text ? data.qstn_text : "";
  qstnJSON.qstn_options =
    data.qstn_options && data.qstn_options ? data.qstn_options : [];
  qstnJSON.qstn_type =
    data.qstn_type && data.qstn_type ? data.qstn_type : "dropdown";
  qstnJSON.fltr_list = data.fltr_list && data.fltr_list ? data.fltr_list : [];
  qstnJSON.hb_id = data.hb_id && data.hb_id ? data.hb_id : 0;
  qstnJSON.rel_id = data.rel_id && data.rel_id ? data.rel_id : "";
  qstnJSON.active = true;
  if (
    data.active &&
    (typeof data.active === "boolean" || data.active instanceof Boolean)
  ) {
    qstnJSON.active = data.active;
  }
  qstnJSON.reqd = false;
  if (
    data.reqd &&
    (typeof data.reqd === "boolean" || data.reqd instanceof Boolean)
  ) {
    qstnJSON.reqd = data.reqd;
  }
  qstnJSON.mdt = Date.now();
  qstnJSON.cdt = Date.now();
  return qstnJSON;
}

export const getRecordByEntity = async (
  entity,
  filterFieldName = "",
  filterFieldValue = ""
) => {
  console.log(`in getRecordByEntity`);
  const params = {
    TableName: process.env.entitiesTableName,
    IndexName: process.env.entitiesTableByEntityAndId,
    KeyConditionExpression: "#entity = :entity",
    ExpressionAttributeNames: {
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":entity": `${entity}`,
    },
  };
  if (filterFieldName && filterFieldValue) {
    params.FilterExpression = "#filterfieldname =:filterfieldvalue";
    params.ExpressionAttributeNames["#filterfieldname"] = filterFieldName;
    params.ExpressionAttributeValues[":filterfieldvalue"] = filterFieldValue;
  }
  console.log(params);
  return getResourceJSON(params);
};
export const getRecordByIdAndEntity = async (id, entity) => {
  console.log(`in getRecordByEntity`);
  const params = {
    TableName: process.env.entitiesTableName,
    KeyConditionExpression: "#id = :id and #entity = :entity",
    ExpressionAttributeNames: {
      "#id": "id",
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":id": `${id}`,
      ":entity": `${entity}`,
    },
  };
  console.log(params);
  return getResourceJSON(params);
};
// ################################################################

const fieldTypesAgency = [
  { name: "hb_id", type: String, typeText: "String" },
  { name: "tname", type: String, typeText: "String" },
  { name: "cname", type: String, typeText: "String" },
  { name: "m_id", type: Array, typeText: "Array" },
];
export function isCorrectFieldTypeAgency(agencyJSON, sendErrorField = false) {
  const errorFields = [];
  for (const field of fieldTypesAgency) {
    if (
      agencyJSON[field.name] &&
      agencyJSON[field.name].constructor !== field.type
    ) {
      if (sendErrorField) {
        // Add the error field and type expected
        errorFields.push(
          `${field.name} field should be of type ${field.typeText}`
        );
      } else {
        return false;
      }
    }
  }
  if (sendErrorField) {
    // Send the fields having type errors also
    return { status: !errorFields.length, field: errorFields };
  }

  return true;
}

const fieldTypesBroker = [
  { name: "hb_id", type: String, typeText: "String" },
  { name: "fname", type: String, typeText: "String" },
  { name: "lname", type: String, typeText: "String" },
  { name: "email", type: String, typeText: "String" },
  { name: "phone", type: String, typeText: "String" },
  { name: "spec", type: Array, typeText: "Array" },
];
export function isCorrectFieldTypeBroker(brokerJSON, sendErrorField = false) {
  const errorFields = [];
  for (const field of fieldTypesBroker) {
    if (
      brokerJSON[field.name] &&
      brokerJSON[field.name].constructor !== field.type
    ) {
      if (sendErrorField) {
        // Add the error field and type expected
        errorFields.push(
          `${field.name} field should be of type ${field.typeText}`
        );
      } else {
        return false;
      }
    }
  }
  if (sendErrorField) {
    // Send the fields having type errors also
    return { status: !errorFields.length, field: errorFields };
  }

  return true;
}
export const updateOrder = async (type, data) => {
  try {
    const { hb_id: hbId = "", order_data: orderData = [] } = data;
    const mdt = Date.now();
    const orderParams = {
      TableName: process.env.entitiesTableName,
      Item: {
        id: hbId,
        type: `${type}_order`,
        entity: `${type}_order`,
        data: "order_data",
        hb_id: hbId,
        order_data: orderData,
        mdt,
      },
    };
    console.log(`orderParams: ${JSON.stringify(orderParams)}`);
    if (hbId === "" || type === "") {
      return failure({ status: false, error: "Required Fields Missing" });
    }
    return postResources(orderParams);
  } catch (error) {
    console.log(`error: ${JSON.stringify(error.stack)}`);
    return failure({ status: false, error: error.stack });
  }
};

export const listOrder = async (type, event, raw = false) => {
  try {
    const hbidParam =
      event && event.pathParameters && event.pathParameters.hbid
        ? event.pathParameters.hbid
        : "";
    const orderParams = {
      TableName: process.env.entitiesTableName,
      KeyConditionExpression: "#id = :id and #entity = :entity",
      ExpressionAttributeNames: {
        "#id": "id",
        "#entity": "entity",
      },
      ExpressionAttributeValues: {
        ":id": hbidParam,
        ":entity": `${type}_order`,
      },
    };
    console.log(`orderParams: ${JSON.stringify(orderParams)}`);
    if (hbidParam === "" || type === "") {
      return failure({ status: false, error: "Required Fields Missing" });
    }
    if (raw) {
      return getResourceJSON(orderParams);
    }
    return getResources(orderParams);
  } catch (error) {
    console.log(`error: ${JSON.stringify(error.stack)}`);
    return failure({ status: false, error: error.stack });
  }
};
export const combineOrder = async (type, hbidParam, params) => {
  const event = {
    pathParameters: {
      hbid: hbidParam,
    },
  };
  // eslint-disable-next-line no-use-before-define
  const listResp = await doPaginatedQueryDB({ params });
  console.log(`listResp: ${JSON.stringify(listResp)}`);

  let returnArray = listResp;

  try {
    if (type) {
      const listOrderResp = await listOrder(type, event, true);
      console.log(`listOrderResp: ${JSON.stringify(listOrderResp)}`);

      if (listOrderResp && listOrderResp.length) {
        const orderData = listOrderResp[0].order_data || [];
        const merged = [];
        for (let i = 0; i < listResp.length; i += 1) {
          merged.push({
            ...listResp[i],
            ...orderData.find((itmInner) => itmInner.id === listResp[i].id),
          });
        }
        returnArray = merged;
      }
    }
  } catch (error) {
    console.log(`error: ${JSON.stringify(error.stack)}`);
  }

  return success(returnArray);
};
export const combineOrderElastic = async (data) => {
  const {
    type,
    hb_id: hbId,
    result: listResp = [],
    after,
    hasAfter,
    totalResults,
    isJSONOnly = false,
  } = data;
  let returnArray = [...listResp];
  try {
    if (type) {
      const event = {
        pathParameters: {
          hbid: hbId,
        },
      };
      const listOrderResp = await listOrder(type, event, true);
      console.log(`listOrderResp: ${JSON.stringify(listOrderResp)}`);

      if (listOrderResp && listOrderResp.length) {
        const orderData = listOrderResp[0].order_data || [];
        const merged = [];
        for (let i = 0; i < listResp.length; i += 1) {
          merged.push({
            ...listResp[i],
            ...orderData.find((itmInner) => itmInner.id === listResp[i].id),
          });
        }
        returnArray = merged;
      }
    }
  } catch (error) {
    console.log(`error: ${JSON.stringify(error.stack)}`);
    return failure({ status: false, error: "Entity order processing failed." });
  }
  const responseObj = {
    result: returnArray,
    after,
    hasAfter,
    totalResults,
  };
  if (isJSONOnly) return responseObj;
  return success(responseObj);
};
export const getEntityByName = async (
  name,
  entity,
  returnArray = false,
  fieldName = null
) => {
  console.log(`name: ${name}`);
  const entityList = await getRecordByEntity(entity, fieldName ?? `name`, name);
  console.log(`entityList: ${JSON.stringify(entityList)}`);

  let entityIdArr = [];
  if (entityList && entityList.length) {
    if (fieldName === "cname") {
      entityIdArr = entityList;
    } else {
      entityIdArr = entityList.map((entityResp) => entityResp.id);
    }
    console.log(`entityIdArr: ${JSON.stringify(entityIdArr)}`);
  }
  if (returnArray) return entityIdArr;
  return entityIdArr && entityIdArr.length ? entityIdArr[0] : null;
};
export const listEntitiesElastic = async (data) => {
  try {
    const {
      hb_id: hbId = "",
      from = 0,
      size = 5,
      sort = [],
      filterKey = "",
      searchKey = "",
      after = [],
      entity = "",
      isDataCall = false,
      isCustomParam = false,
      customParams = [],
      filterParams = [],
      projectFields = [],
      eof = false
    } = data;
    let entitySearchQuery = {};
    // Get entity list
    const entityListQuery = {
      httpMethod: "POST",
      requestPath: "/_search",
      payload: {
        query: {
          bool: {
            must: [],
          },
        },
        size,
        from,
      },
    };

    if (eof) {
      entityListQuery.eof = true
    };

    if (hbId) {
      entityListQuery.payload.query.bool.must.push({
        match: {
          "hb_id.keyword": hbId,
        }
      })
    };

    // For queries using the data field. eg: question (demographics)
    if (isDataCall) {
      entityListQuery.payload.query.bool.must.push({
        match: {
          "data.keyword": `${entity}#${hbId}`,
        },
      });
    } else if (isCustomParam) {
      entityListQuery.payload.query.bool.must.push(...customParams);
    } else {
      entityListQuery.payload.query.bool.must.push({
        match: {
          "entity.keyword": `${entity}#${hbId}`,
        },
      });
    }

    if (projectFields && projectFields.length)
      entityListQuery.payload._source = {
        includes: projectFields,
      };

    // filter params
    if (filterParams && filterParams.length) {
      entityListQuery.payload.query.bool.must.push(...filterParams);
    }

    // Get search query if searchKey is provided
    if (searchKey && filterKey) {
      entitySearchQuery = getSearchQuery({
        filterKey,
        searchKey,
        type: entity,
      });
      console.log(`entitySearchQuery: ${JSON.stringify(entitySearchQuery)}`);
      entityListQuery.payload.query.bool.must.push(entitySearchQuery);
    }

    // Add sort field if supplied in the request
    if (sort.length) {
      let isIdFieldIncluded = false;
      entityListQuery.payload.sort = [];
      for (const sortField of sort) {
        // sortField = {"field": "email", "order": "asc/desc"}
        if (sortField.field === "id") isIdFieldIncluded = true;

        entityListQuery.payload.sort.push({
          [`${sortField.field}${sortField.field !== "cdt" &&
            sortField.field !== "mdt" &&
            sortField.field !== "pos" &&
            sortField.field !== "goal" &&
            sortField.field !== "crr_goal"
            ? ".keyword"
            : ""
            }`]: sortField.order,
        });
      }
      // Adding the id field as the tie-breaker field for sorting.
      if (!isIdFieldIncluded)
        entityListQuery.payload.sort.push({
          "id.keyword": "asc",
        });
    }
    // If after is provided and the from + size is greater than 10000, use the search_after parameter in the query.
    // This is done because of the index.max-result-window limit of 10000 set by Elasticsearch.
    if (from + size > 10000 && after.length) {
      entityListQuery.payload.search_after = after;
      // In this case we should set from as 0
      entityListQuery.payload.from = 0;
    }
    console.log(`entityListQuery: ${JSON.stringify(entityListQuery)}`);
    const entityList = await elasticExecuteQuery(entityListQuery, true);
    console.log(`entityList: ${JSON.stringify(entityList)}`);

    if (
      entityList &&
      entityList.statusCode === 200 &&
      entityList.body &&
      entityList.body.hits &&
      entityList.body.hits.hits
    ) {
      const { hits } = entityList.body.hits;
      const resultLength = hits.length;
      const totalResults = entityList.body.hits.total;
      console.log(`resultLength: ${resultLength}`);
      console.log(`totalResults: ${totalResults}`);
      const afterNext =
        resultLength && sort.length ? [...hits[resultLength - 1].sort] : [];
      const hasAfter = from + size < totalResults;
      const result = resultLength
        ? hits.map((entityRes) => {
          const entityResObj = {
            ...entityRes._source,
            _score: entityRes._score,
          };
          return entityResObj;
        })
        : [];
      return {
        status: true,
        result,
        after: afterNext,
        hasAfter,
        totalResults,
      };
    }
    console.log(`error in fetching entity list`);
    return { status: false, error: "Entity List Failed" };
  } catch (error) {
    console.log(`error`);
    console.log(error);
    return { status: false, error: error.message };
  }
};
export const initListAPI = async (data) => {
  let list;
  const { hb_id: hbId = "", entity = "", isJSONOnly = false, searchKey = "", filterKey = "" } = data;
  try {
    list = await listEntitiesElastic({ ...data, entity, searchKey, filterKey });
  } catch (error) {
    console.log(`Error in initListAPI`);
    console.log(error);
    return failure({ status: false, error: "Entity list failed." });
  }
  const combineOrderRes = await combineOrderElastic({
    type: entity,
    hb_id: hbId,
    isJSONOnly,
    ...list,
  });
  return combineOrderRes;
};

export const getStackOutputs = async ({
  StackName = "",
  outputName = "",
  all = false,
}) => {
  console.log(`StackName: ${StackName}`);
  console.log(`outputName: ${outputName}`);
  console.log(`all: ${all}`);
  let describeStacksResp;
  let outputValue = "";
  try {
    if (StackName) {
      const describeStackParams = { StackName };
      console.log(
        `describeStackParams: ${JSON.stringify(describeStackParams)}`
      );
      describeStacksResp = await cloudformation
        .describeStacks(describeStackParams)
        .promise();
      console.log(`describeStacksResp: ${JSON.stringify(describeStacksResp)}`);
      if (
        describeStacksResp?.Stacks.length &&
        describeStacksResp?.Stacks[0]?.Outputs
      ) {
        if (all) {
          outputValue = describeStacksResp.Stacks[0].Outputs;
        } else {
          outputValue = describeStacksResp.Stacks[0].Outputs.filter(
            (outputItem) => outputItem.OutputKey === outputName
          );
          console.log(`outputValue: ${JSON.stringify(outputValue)}`);
          if (outputValue && outputValue?.length)
            outputValue = outputValue[0].OutputValue;
        }
      }
    }
  } catch (error) {
    console.log("Exception occured at getStackOutputs");
    console.log(error);
  }
  return outputValue;
};
export const executeByBatch = async ({
  arr = [],
  executeFunction = null,
  arrayParamName = "",
  otherParams = {},
}) => {
  let responseArr = [];
  const iterations = Math.ceil(arr.length / 1000);
  // Split array into chunks of 1000
  let arrIndex = 0;
  let arrIndexEnd = 1000;
  for (let itemIndex = 0; itemIndex < iterations; itemIndex += 1) {
    console.log(`itemIndex/iterations: ${itemIndex}/${iterations}`);
    console.log(`arrIndex/arrIndexEnd: ${arrIndex}/${arrIndexEnd}`);
    const iterationExecutionResponse = await executeFunction({
      [arrayParamName]: arr.slice(arrIndex, arrIndexEnd),
      ...otherParams,
    });
    console.log(
      `iterationExecutionResponse: ${JSON.stringify(
        iterationExecutionResponse
      )}`
    );
    responseArr = [...responseArr, ...iterationExecutionResponse];
    arrIndex += 1000;
    arrIndexEnd += 1000;
  }
  return responseArr;
};
export const getEntityIdsArr = async ({
  idArr = [],
  hbId = "",
  entity = "",
}) => {
  if (idArr.length && hbId) {
    try {
      const listQuery = {
        httpMethod: "POST",
        requestPath: "/_search",
        payload: {
          query: {
            bool: {
              must: [
                {
                  bool: {
                    should: idArr,
                  },
                },
                {
                  match: {
                    "entity.keyword": `${entity}#${hbId}`,
                  },
                },
                {
                  match: {
                    "hb_id.keyword": hbId,
                  },
                },
              ],
            },
          },
          size: 5000,
        },
      };
      console.log(`listQuery: ${JSON.stringify(listQuery)}`);
      const listResp = await elasticExecuteQuery(listQuery);
      console.log(`listResp: ${JSON.stringify(listResp)}`);
      const listBody = listResp.body ? JSON.parse(listResp.body) : {};
      console.log(`listBody: ${JSON.stringify(listBody)}`);
      const resourceArr =
        listBody?.body?.hits?.hits?.map(
          (resource) => resource?._source ?? ""
        ) ?? [];
      console.log(`resourceArr: ${JSON.stringify(resourceArr)}`);
      return resourceArr;
    } catch (error) {
      console.log(`Error occured in getEntityIdsArr: ${JSON.stringify(error)}`);
      return null;
    }
  } else {
    return [];
  }
};
export const getEntityByIdsElastic = async (data) => {
  console.log(`In getEntityByIdsElastic`);
  let response;
  const { ids = [], hbId = "", isJSONOnly = false, entity = "" } = data;
  console.log(`ids: ${JSON.stringify(ids)}`);
  console.log(`hbId: ${hbId}`);
  const idQueryArr = ids.map((id) => ({
    match: {
      "id.keyword": id,
    },
  }));
  let idArr;
  try {
    // Max limit of conditions in a query is 1024 by default
    // So splitting the number of requests
    if (ids.length > 1000) {
      idArr = await executeByBatch({
        arr: idQueryArr,
        executeFunction: getEntityIdsArr,
        arrayParamName: "idArr",
        otherParams: { hbId, entity },
      });
    } else {
      idArr = await getEntityIdsArr({
        idArr: idQueryArr,
        hbId,
        entity,
      });
    }
    response = { status: true, data: idArr };
    if (isJSONOnly) return response;
    return success(response);
  } catch (error) {
    console.log(error);
    response = { status: false, error };
    if (isJSONOnly) return response;
    return failure(response);
  }
};
export const doPaginatedQueryDB = async ({ params = null }) => {
  const entityList = [];
  try {
    let hasNext = true;
    let ExclusiveStartKey;

    while (hasNext) {
      params = { ...params, ExclusiveStartKey };
      const response = await getResourceJSON(params, true);
      // Add entityList Items returned in this paged response.
      entityList.push(...response.Items);
      ExclusiveStartKey = response.LastEvaluatedKey;
      hasNext = !!ExclusiveStartKey;
    }
    console.log("entityList: ", JSON.stringify(entityList));
  } catch (error) {
    console.log(
      `Exception occured in doPaginatedQueryDB libs/db FunctionStack`
    );
    return [];
  }
  return entityList;
};

export const doPaginatedQueryEllastic = async (params) => {
  try {
    params.size = 5000;
    params.from = 0;
    let list = [];
    let hasAfter = false;
    params.sort =
      params.sort && params.sort.length
        ? params.sort
        : [
          {
            field: "id",
            order: "asc",
          },
        ];
    do {
      const res = await listEntitiesElastic(params);
      if (res.status) {
        list = [...list, ...res.result];
        params.from += params.size;
        hasAfter = res.hasAfter;
        params.after = res.after;
      } else {
        return [];
      }
    } while (hasAfter);
    return list;
  } catch (error) {
    console.log(
      `Exception occured in doPaginatedQueryEllastic libs/db FunctionStack`
    );
    return [];
  };
};

export const doAggregateElasticQuery = async (params) => {
  try {
    const { customQuery = [], aggregation = {} } = params;
    console.log(`params: ${JSON.stringify(params)}`);
    const entityListQuery = {
      httpMethod: "POST",
      requestPath: "/_search",
      eof: true,
      payload: {
        query: {
          bool: {
            must: customQuery
          }
        },
        aggs: aggregation,
        size: 0
      }
    };

    console.log(`entityListQuery: ${JSON.stringify(entityListQuery)}`);

    const elasticResult = await elasticExecuteQuery(entityListQuery, true);
    console.log(`elasticResult: ${JSON.stringify(elasticResult)}`);

    if (
      elasticResult &&
      elasticResult.statusCode === 200 &&
      elasticResult.body &&
      elasticResult.body.aggregations) {
      const { aggregations } = elasticResult.body;
      return { status: true, data: aggregations }
    };
    throw "Error in Elastic search result";
  } catch (error) {
    console.log(`Exception occured in doAggregateQueryElastic`);
    return { status: false, error: error?.message || error };
  };
}

export const fieldData = (type = "", isKeyOnly = false) => {
  const data = {
    "customer": {
      "cntm": true,
      "desf": false,
      "desm": false,
      "email": true,
      "fname": true,
      "grade": true,
      "infl": false,
      "inte": false,
      "lname": true,
      "phone": true,
      "psrc": true,
      "rltr": false,
      "stage": true
    },
    "realtor": {
      "agncy": true,
      "cntm": true,
      "email": true,
      "exp": false,
      "fname": true,
      "infl": false,
      "lname": true,
      "phone": true,
      "psrc": true,
      "spec": false
    },
    "agency": {
      "broker": {
        "email": true,
        "fname": true,
        "lname": true,
        "phone": true,
        "spec": false
      },
      "addr": false,
      "cname": true,
      "m_id": true,
      "tname": true,
    },
    "cobuyer": {
      "cntm": true,
      "email": true,
      "fname": true,
      "infl": false,
      "lname": true,
      "phone": true,
    }
  }
  if (type) {
    return data[type];
  }
  if (isKeyOnly) {
    return Object.keys(data);
  }
  return data;
};

/**
 * Function for adding or deleting data for existing builders (script);
 ItemArray Format should be: [
    {
      requestType: "PutResquest/DeleteRequest",
      item:{data added to db},
      keys: ['hb_id', 'id'] fields that has to add builder id
    }
  ]
**/
export const createDataInAllBuilder = async (tableName, ItemsArray = [], field = "") => {
  try {
    let builderList = await listBuilders(true);
    let batchWriteParams = {
      RequestItems: {
        [tableName]: []
      }
    };

    builderList.forEach((builder) => {
      for (const eachItem of ItemsArray) {
        let itemVal = { ...eachItem };
        console.log(`itemVal: ${JSON.stringify(itemVal)}`);
        if (itemVal.keys && itemVal.keys.length) {
          for (const eachKey of itemVal.keys) {
            if (eachKey === "entity") {
              itemVal.item[eachKey] = `${field}#${builder.id}`
            } else {
              itemVal.item[eachKey] = builder.id;
            };
          }
        };
        console.log(`itemVal: ${JSON.stringify(itemVal)}`);
        batchWriteParams.RequestItems[tableName].push({
          [itemVal?.requestType || "PutRequest"]: {
            [itemVal?.requestType === "PutRequest" ? "Item" : "Key"]: { ...itemVal.item }
          }
        });
      };
    })
    console.log(`batchWriteParams: ${JSON.stringify(batchWriteParams)}`);
    const batchWriteResp = await batchWriteItems(batchWriteParams);
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

    if (!isBatchSuccess) throw 'There are unprocessed batch items'

    return { status: true, data: 'Successfully created' };
  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`);
    return { status: false, error: error?.message || error };
  };
};
