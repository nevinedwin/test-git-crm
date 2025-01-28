import { sendRequest } from "../libs/search-lib";
import kenesisMapping from "./kinesisMapping";
import { success, failure } from "../libs/response-lib";

const queryMaker = (method, path, payload) => {
  const params = {
    httpMethod: method,
    requestPath: path,
    isGlobal: true,
  };
  if (payload) {
    params.payload = payload;
  }
  console.log(`esParams: ${JSON.stringify(params)}`);
  return params;
};

export const getAllIndexes = async () => {
  try {
    const params = queryMaker("GET", "/_cat/indices", null);
    const resp = await sendRequest(params);
    console.log(`getAllIndexes-resp: ${JSON.stringify(resp)}`);
    return success({ status: true, result: resp });
  } catch (e) {
    console.log(`getAllIndexes-error: ${JSON.stringify(e.stack)}`);
    return failure({ status: false, error: e.message });
  }
};

export const getIndexCount = async (data) => {
  try {
    const { indexName = "" } = data;
    if (!indexName)
    return failure({ status: false, error: "IndexName is required" });
    const params = queryMaker("GET", `/_cat/count/${indexName}?h=count`, null);
    const resp = await sendRequest(params);
    return success({ status: true, result: resp });
  } catch (e) {
    console.log(`getAllIndexes-error: ${JSON.stringify(e.stack)}`);
    return failure({ status: false, error: e.message });
  }
};

export const createNewIndex = async (data) => {
  try {
    const { indexName = "" } = data;
    if (!indexName)
    return failure({ status: false, error: "IndexName is required" });
    const mapping = kenesisMapping.mappings;
    const payload = {
      mappings: mapping,
    };
    const params = queryMaker("PUT", `/${indexName}`, payload);
    const resp = await sendRequest(params);
    return success({ status: true, result: resp });
  } catch (e) {
    console.log(`createNewIndex-error: ${JSON.stringify(e.stack)}`);
    return failure({ status: false, error: e.message });
  }
};

export const reindex = async (data) => {
  try {
    const { src, dest } = data;
    if (!src || !dest)
      return failure({ status: false, error: "Source and destination are required" });
    const payload = {
      conflicts: "proceed",
      source: {
        index: src,
      },
      dest: {
        index: dest,
      },
    };
    const params = queryMaker(
      "POST",
      `/_reindex?wait_for_completion=${false}`,
      payload
    );
    const resp = await sendRequest(params);
    return success({ status: true, result: resp });
  } catch (e) {
    console.log(`reindex-error: ${JSON.stringify(e.stack)}`);
    return failure({ status: false, error: e.message });
  }
};

export const getTask = async (data) => {
  try {
    const { taskId = "" } = data;
    if (!taskId)
      return failure({ status: false, error: "taskId is required" });
    const params = queryMaker("GET", `/_tasks/${taskId}`, null);
    const resp = await sendRequest(params);
    return success({ status: true, result: resp });
  } catch (e) {
    console.log(`getTask-error: ${JSON.stringify(e.stack)}`);
    return failure({ status: false, error: e.message });
  }
};

export const deleteIndex = async (data) => {
  try {
    const { indexName = "" } = data;
    if (!indexName)
    return failure({ status: false, error: "IndexName is required" });
    const params = queryMaker("DELETE", `/${indexName}`, null);
    const resp = await sendRequest(params);
    return success({ status: true, result: resp });
  } catch (e) {
    console.log(`deleteIndex-error: ${JSON.stringify(e.stack)}`);
    return failure({ status: false, error: e.message });
  }
};

export const extentMappingLimit = async (data) => {
  try {
    const { indexName = "" } = data;
    if (!indexName)
      return failure({ status: false, error: "IndexName is required" });
    const payload = {
      "index.mapping.total_fields.limit": 3000,
    };
    const params = queryMaker("PUT", `/${indexName}/_settings`, payload);
    const resp = await sendRequest(params);
    return success({ status: true, result: resp });
  } catch (e) {
    console.log(`extentMappingLimit-error: ${JSON.stringify(e.stack)}`);
    return failure({ status: false, error: e.message });
  }
};

export const updateIndexbyQuery = async (data) => {
  try {
    const { indexName = "" } = data;
    if (!indexName)
    return failure({ status: false, error: "IndexName is required" });
    const payload = {
      "script": {
        "source": "ctx._source['fullname']= ctx._source['fname']+' '+ctx._source['lname']",
        "lang": "painless"
      },
      "query": {
        "bool": {
          "filter": [
            {
              "exists": {
                "field": "fname"
              }
            },
            {
              "exists": {
                "field": "lname"
              }
            }
          ]
        }
      }
    };
    const params = queryMaker("POST", `/${indexName}/_update_by_query?wait_for_completion=${false}`, payload);
    const resp = await sendRequest(params);
    return success({ status: true, result: resp });
  } catch (e) {
    console.log(`updateIndexbyQuery-error: ${JSON.stringify(e.stack)}`);
    return failure({ status: false, error: e.message });
  }
};
