/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import { success, failure } from "../libs/response-lib";
import { sendRequest } from "../libs/search-lib";
import kinesisMapping from "./kinesisMapping";
import {
  getAllIndexes,
  getIndexCount,
  createNewIndex,
  reindex,
  getTask,
  deleteIndex,
  extentMappingLimit,
  updateIndexbyQuery,
} from "./es";

const ELASTIC_SEARCH_DYNAMODB_INDEX = "entitiessearchindex";
const ELASTIC_SEARCH_KINESIS_INDEX = "crmeskinesisindex";

const searchEntities = async (data, api) => {
  const { hb_id: hbId = "" } = data;
  let { search: searchString = "" } = data;
  const whiteSpaceSplit = searchString ? searchString.split(" ") : [];
  let entitiyType;
  let isWhiteSpaceWord = 0;
  if (whiteSpaceSplit.length) {
    // Search String has Whitespaces
    if (whiteSpaceSplit.length === 2) {
      // Search String has two words only
      // If the second word is blank, then ignore it and consider as Search String without Whitespaces
      isWhiteSpaceWord = whiteSpaceSplit[1] ? whiteSpaceSplit.length : 0;
    } else {
      // Search String has more than two words
      isWhiteSpaceWord = whiteSpaceSplit.length;
    }
  } else {
    // Search String has only one word
    isWhiteSpaceWord = 1;
  }
  switch (api) {
    case "customers":
      entitiyType = "customer";
      break;
    case "realtors":
      entitiyType = "realtor";
      break;
    default:
      break;
  }
  const specCharRegex = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;
  console.log(`searchString: ${searchString}`);
  const containsSpecialChar = specCharRegex.test(searchString);
  console.log(`containsSpecialChar: ${containsSpecialChar}`);
  const defOp = isWhiteSpaceWord === 1 || containsSpecialChar ? "and" : "or";
  searchString = `${searchString}|(${searchString}*)`;

  // If the search term has special characters such as email id
  // or if it is a single word
  // We will search with "or"
  // Otherwise with "and"
  const params = {
    httpMethod: "POST",
    requestPath: "/_search",
    payload: {
      query: {
        bool: {
          must: {
            simple_query_string: {
              query: searchString,
              default_operator: defOp,
            },
          },
        },
      },
      highlight: {
        fields: {
          "*": {},
        },
      },
    },
  };
  /* {
        from: offset,
        "query": {
            "simple_query_string": {
                "query": `(${searchString}*)`,
                "default_operator": defOp
            }
        },
        "highlight": {
            "fields": {
                "*": {}
            }
        }
    } */
  if (api !== "global") {
    // Add field restriction for search results
    params.payload.query.bool.must.simple_query_string.fields = [
      "fname",
      "lname",
      "phone",
      "email",
      "stage",
    ];
    params.payload.query.bool.filter = {
      term: {
        entity: `${entitiyType}#${hbId}`,
        hb_id: hbId,
      },
    };
  } else {
    params.payload.query.bool.filter = {
      term: {
        hb_id: hbId,
      },
    };
  }
  console.log(`params: ${JSON.stringify(params)}`);
  const searchResult = await sendRequest(params).then((result) => {
    console.info(result);
    // result = JSON.parse(result);
    if (result.statusCode === 200) {
      const recordData =
        result && result.body && result.body.hits && result.body.hits.hits
          ? result.body.hits.hits
          : [];
      return success({ status: true, result: recordData });
    }

    return failure({ status: false, error: result });
  });
  console.log(`searchResult: ${JSON.stringify(searchResult)}`);
  return searchResult;
  // Search using elasticsearch.js and httpAwsEs npm modules
  /* const searchResult = await es.search({
        index: esDomain.index,
        body: {
            from: offset,
            "query": {
                "simple_query_string": {
                    "query": `(${searchString}*)`
                }
            },
            "highlight": {
                "fields": {
                    "*": {}
                }
            }
        },
        refresh: '',
        timeout: '5m'
    }, (err, result) => {
        if (err) {
            console.log(err);
            return failure({ status: false, error: err });
        } else {
            console.log(result);
            return success({ status: true, result: result });
        }
    });
    return searchResult; */
};
export const paginate = async (
  requestBody,
  isJSONOnly,
  isPublicValidate = false,
) => {
  let paramsArray = "?";
  const mustArray = [];

  if (
    requestBody.queryString &&
    Object.keys(requestBody.queryString).length > 0
  ) {
    paramsArray += `q=`;
    if (Object.keys(requestBody.queryString).length === 1) {
      if (requestBody.queryString) {
        Object.keys(requestBody.queryString).forEach((key) => {
          paramsArray += `${key}:${requestBody.queryString[key]}`;
        });
      }
    } else {
      paramsArray += "%2B";
      if (requestBody.queryString) {
        Object.keys(requestBody.queryString).forEach((key) => {
          paramsArray += `${key}:${requestBody.queryString[key]}%20%2B`;
        });
      }
      paramsArray = paramsArray.substring(0, paramsArray.lastIndexOf("%20%2B"));
    }
    paramsArray += "&";
  }
  if (requestBody.queryParams) {
    Object.keys(requestBody.queryParams).forEach((key) => {
      paramsArray += `${key}=${requestBody.queryParams[key]}&`;
    });
  }
  paramsArray = paramsArray.substring(0, paramsArray.length - 1);
  if (requestBody.queryMust) {
    if (!requestBody.queryMust.atype) {
      Object.keys(requestBody.queryMust).forEach((key) => {
        if (requestBody.queryMust[key].length) {
          const tempKey = {};
          tempKey[key] = `${requestBody.queryMust[key]}`;
          mustArray.push({ match: tempKey });
        }
      });
      // add conition to exclude profile changes
      const notProfile = {
        bool: {
          must_not: [
            {
              match_phrase_prefix: {
                "atype.keyword": "profile_"
              }
            }
          ]
        }
      }
      mustArray.push(notProfile)
    }else {
      Object.keys(requestBody.queryMust).forEach((key) => {
        if (requestBody.queryMust[key].length) {
          const tempKey = {};
          tempKey[key] = `${requestBody.queryMust[key]}`;
          if (requestBody.queryMust[key] === "profile_") {
            mustArray.push({ match_phrase_prefix: tempKey });
          }else {
            mustArray.push({ match: tempKey });
          }
        }
      });
    }
  }

  let tempPayload = {};

  if (mustArray.length > 0) {
    tempPayload = {
      query: {
        bool: {
          must: mustArray,
        },
      },
    };
  }

  const params = {
    httpMethod: "POST",
    requestPath: `/_search${paramsArray}`,
    payload: tempPayload,
  };
  console.log(`params: ${JSON.stringify(params)}`);
  const searchResult = await sendRequest(params).then((result) => {
    const recordData = [];
    if (result.body.hits && result.body.hits.hits.length > 0) {
      result.body.hits.hits.forEach((entry) => {
        recordData.push(entry._source);
      });
    }
    result.body = result.body.hits ? result.body.hits : [];
    console.log(`result.body.hits: ${JSON.stringify(result.body.hits)}`);
    if (result.statusCode === 200 || result.statusCode === 400) {
      if (isJSONOnly) {
        return { status: true, data: recordData };
      }

      if (isPublicValidate) {
        // If this is for public validate email, then only give minimum data.
        return success({ status: !!(recordData && recordData.length) });
      }
      return success({ status: true, data: recordData });
    }

    if (isJSONOnly) {
      return { status: false, error: result };
    }

    return failure({ status: false, error: result });
  });
  return searchResult;
};
export const aggregate = async (requestBody, isJSONOnly = false) => {
  const searchResult = await sendRequest(requestBody)
    .then((result) => {
      if (isJSONOnly) {
        return result.body && result.body.aggregations
          ? { ...result, aggregations: result.body.aggregations, status: true }
          : { ...result, status: true };
      }

      return result.body && result.body.aggregations
        ? success({
          ...result,
          aggregations: result.body.aggregations,
          status: true,
        })
        : success({ ...result, status: true });
    })
    .catch((result) => {
      if (isJSONOnly) {
        return { ...result, status: false };
      }

      return failure({ ...result, status: false });
    });
  return searchResult;
};
const reIndexES = async (oldIndex, newIndex, mapping) => {
  // Create new index
  const newIndexRequestBody = {
    httpMethod: "PUT",
    requestPath: `/${newIndex}`,
    payload: {
      mappings: mapping,
    },
    isGlobal: true,
  };
  console.log(`newIndexRequestBody: ${JSON.stringify(newIndexRequestBody)}`);
  const newIndexResp = await sendRequest(newIndexRequestBody);
  console.log(`newIndexResp: ${JSON.stringify(newIndexResp)}`);
  if (
    newIndexResp &&
    newIndexResp.statusCode &&
    newIndexResp.statusCode === 200 &&
    newIndexResp.body &&
    newIndexResp.body.acknowledged
  ) {
    console.log(`reindexed from : ${oldIndex} to ${newIndex}`);
    // New index created successfully
    // Re-index existing to new
    const reIndexRequestBody = {
      httpMethod: "POST",
      requestPath: `/_reindex`,
      payload: {
        source: {
          index: oldIndex,
        },
        dest: {
          index: newIndex,
        },
      },
      isGlobal: true,
    };
    console.log(`reIndexRequestBody: ${JSON.stringify(reIndexRequestBody)}`);
    const reIndexResp = await sendRequest(reIndexRequestBody);
    console.log(`reIndexResp: ${JSON.stringify(reIndexResp)}`);
    if (
      reIndexResp &&
      reIndexResp.statusCode &&
      reIndexResp.statusCode === 200
    ) {
      // Re-indexed successfully
      // Delete old index
      const deleteIndexRequestBody = {
        httpMethod: "DELETE",
        requestPath: `/${oldIndex}`,
        isGlobal: true,
      };
      const deleteIndexResp = await sendRequest(deleteIndexRequestBody);
      console.log(`deleteIndexResp: ${JSON.stringify(deleteIndexResp)}`);
      if (
        deleteIndexResp &&
        deleteIndexResp.statusCode &&
        deleteIndexResp.statusCode === 200
      ) {
        return { status: true };
      }

      return { status: false, error: "Delete index failed" };
    }

    return { status: false, error: "Re-index failed" };
  }

  return { status: false, error: "Failed to create index" };
};
const initReIndexES = async (data) => {
  let index;
  let mapping;
  // Whether to create new index, reindex to it and delete the old index
  const newReIndex = data.ni ? data.ni : false;

  // Whether to create the old index again, reindex it from the new index and delete the new index
  const oldReIndex = data.oi ? data.oi : false;

  if (data?.index === "dynamoDB") {
    index = ELASTIC_SEARCH_DYNAMODB_INDEX;
    mapping = "";
  } else if (data?.index === "kinesis") {
    index = ELASTIC_SEARCH_KINESIS_INDEX;
    mapping = kinesisMapping.mappings;
  } else {
    return failure({ status: false, data: "Invalid index parameter" });
  }

  let reIndexResp;
  if (newReIndex) {
    reIndexResp = await reIndexES(index, `${index}_v2`, mapping);
  } else if (oldReIndex) {
    reIndexResp = await reIndexES(`${index}_v2`, index, mapping);
  } else {
    return failure({ status: false, data: "Re-indexing parameter not found" });
  }
  console.log(`reIndexResp: ${JSON.stringify(reIndexResp)}`);
  if (reIndexResp) {
    return success({ status: true, data: "Re-indexed successfully" });
  }

  return failure({ status: false, data: "Re-indexing failed" });
};
export const elasticExecuteQuery = async (requestBody, isJSONOnly = false) => {
  console.log(`elasticExecuteQuery :: `, requestBody);
  const sendResponse = (response) => {
    console.log(`elasticExecuteQuery :: `, response);
    if (isJSONOnly) {
      return response;
    }

    if (response.status === false) {
      return failure(response);
    }

    return success(response);
  };
  const searchResult = await sendRequest(requestBody)
    .then((result) => {
      if (result && result.statusCode && result.statusCode === 200) {
        return sendResponse({ ...result, status: true });
      }

      return sendResponse({ ...result, status: false });
    })
    .catch((result) => sendResponse({ ...result, status: false }));
  return searchResult;
};
export const executeByBatch = async ({
  arr = [],
  executeFunction = null,
  arrayParamName = "",
  otherParams = {},
}) => {
  let responseArr = [];
  const step = 1000;
  const iterations = Math.ceil(arr.length / step);
  // Split array into chunks of step
  let arrIndex = 0;
  let arrIndexEnd = step;
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
    responseArr = [
      ...responseArr,
      ...(iterationExecutionResponse?.body?.hits?.hits || []),
    ];
    console.log(`responseArr.length: ${responseArr.length}`);
    arrIndex += step;
    arrIndexEnd += step;
  }
  console.log(`responseArr.length final: ${responseArr.length}`);
  return responseArr;
};
export const initAggregateJSONOnlyList = async ({
  arr = [],
  requestBody = null,
  isJSONOnly = true,
}) => {
  console.log(`arr: ${JSON.stringify(arr)}`);
  console.log(`arr.length: ${arr.length}`);
  console.log(`requestBody: ${JSON.stringify(requestBody)}`);
  console.log(`isJSONOnly: ${JSON.stringify(isJSONOnly)}`);
  // Cloning the requestBody to create a new query object
  const queryObj = JSON.parse(JSON.stringify(requestBody));
  if (arr.length && requestBody) {
    try {
      // Set the array in the query
      if (
        queryObj?.payload?.query?.bool?.must &&
        queryObj.payload.query.bool.must.length
      )
        queryObj.payload.query.bool.must.push({
          terms: {
            "email.keyword": arr,
          },
        });
      console.log(`queryObj: ${JSON.stringify(queryObj)}`);
      return aggregate(queryObj, isJSONOnly);
    } catch (error) {
      console.log(`Error occured in getEntityIdsArr`);
      console.log(error);
      return null;
    }
  } else {
    return {};
  }
};
const aggregateJSONOnly = async (data) => {
  console.log(`aggregateJSONOnly data: ${JSON.stringify(data)}`);
  let response;
  const {
    requestBody = null,
    isJSONOnly = true,
    list = [],
    getForCobuyer = false,
  } = data;
  console.log(`aggregateJSONOnly list: ${JSON.stringify(list)}`);
  try {
    let emailArr;
    // Max limit of conditions in a query is 1024 by default
    // So splitting the number of requests
    if (list.length > 1000) {
      console.log(`list.length in list.length > 1000: ${list.length}`);
      emailArr = await executeByBatch({
        arr: list,
        executeFunction: initAggregateJSONOnlyList,
        arrayParamName: "arr",
        otherParams: { requestBody, isJSONOnly },
      });
    } else {
      console.log(`list.length else: ${list.length}`);
      emailArr = await initAggregateJSONOnlyList({
        arr: list,
        requestBody,
        isJSONOnly,
      });
      emailArr = emailArr?.body?.hits?.hits || [];
    }
    // const validateEmailResp = await aggregate(requestBody, isJSONOnly);
    console.log(`emailArr: ${JSON.stringify(emailArr)}`);
    console.log(`emailArr.length: ${emailArr.length}`);
    response = {
      status: true,
      data: [],
    };
    console.log(`getForCobuyer: ${getForCobuyer}`);
    if (getForCobuyer) {
      console.log(`In getForCobuyer`);
      response.data =
        emailArr && emailArr?.length
          ? emailArr?.map((customer) => ({
            id: customer._source.id,
            entity: customer._source.entity,
            data: customer._source.data,
            email: customer._source.email,
            psrc: customer._source.psrc,
            appid: customer._source.appid,
            inte: customer._source.inte,
            optst: customer._source.optst,
          }))
          : [];
    } else {
      console.log(`In getForCobuyer else`);
      response.data =
        emailArr && emailArr?.length
          ? emailArr?.map((customer) => ({
            id: customer._source.id,
            entity: customer._source.entity,
            data: customer._source.data,
            email: customer._source.email,
          }))
          : [];
    }
  } catch (error) {
    console.log("error aggregateJSONOnly ");
    console.log(error);
    response = { status: false, error };
  }
  return response;
};
const queryJSONOnly = async (data) => {
  let response;
  const { queryObj = null } = data;
  try {
    const result = await aggregate(queryObj, true);
    response = { status: true, data: result?.body?.hits?.hits || [] };
  } catch (error) {
    console.log("error aggregateJSONOnly ");
    console.log(error);
    response = { status: false, error };
  }
  return response;
};
const testEs = async (requestBody) => {
  // eof - true if searching for firehose. false if searching for elastic
  /* const params = {
        httpMethod: 'POST',
        requestPath: '/_search',
        payload: requestBody,
        eof: true
    }; */
  const searchResult = await sendRequest(requestBody)
    .then((result) => {
      if (result && result.statusCode && result.statusCode === 200) {
        // return success({ data: result.body && result.body.hits && result.body.hits.hits ? result.body.hits.hits : [], status: true });
        return success({ ...result, status: true });
      }

      return failure({ ...result, status: false });
    })
    .catch((result) => failure({ ...result, status: false }));
  return searchResult;
};
export async function validate(eve) {
  const data = JSON.parse(eve.body);
  if (!data) {
    const response = failure();
    return response;
  }
  return paginate(data);
}
const validatePhone = (phone) => {
  const re = /^\((\d{3})\)[ ](\d{3})[-](\d{4})$/;
  return phone ? re.test(String(phone).toLowerCase()) : true;
};
const searchapp = async (requestBody) => {
  const { searchKey, hb_id: hbId, type, size, hlead } = requestBody;
  let searchKeyTemp = searchKey || {};
  if (
    ["all", "customer", "realtor", "broker,agent", "cobuyer"].indexOf(type) !==
    -1 &&
    searchKey.match(/^\d{10}$/)
  ) {
    const match = searchKey.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      searchKeyTemp = `(${match[1]}) ${match[2]}-${match[3]}`;
    }
  }
  if (searchKeyTemp.startsWith("@")) {
    searchKeyTemp = searchKeyTemp.slice(1);
  }
  if (validatePhone(searchKeyTemp)) {
    searchKeyTemp = searchKeyTemp.replace(/\s/g, "");
  }
  const multiMatchFields = [
    "address",
    "agcnm",
    "agencyTemp",
    "agtnm",
    "assi",
    "broker",
    "campdsc",
    "campnm",
    "campsch",
    "campst",
    "city",
    "cname",
    "cntm",
    "country",
    "email",
    "fname",
    "lname",
    "loc",
    "name",
    "note",
    "phone",
    "ppurl",
    "qstn_options",
    "qstn_text",
    "spec",
    "stage",
    "stat",
    "sub",
    "tname",
    "tplt",
    "wit",
    "zip",
  ];
  console.log(`SearchkeyTemp: ${JSON.stringify(searchKeyTemp)}`);
  const shouldQuery = [
    {
      query_string: {
        query: `*${encodeURIComponent(searchKeyTemp)}*`,
        default_operator: "AND",
        fields: multiMatchFields,
      },
    },
    {
      multi_match: {
        query: `*${encodeURIComponent(searchKeyTemp)}*`,
        operator: "or",
        fields: multiMatchFields,
      },
    },
    {
      query_string: {
        query: `*${encodeURIComponent(searchKeyTemp)}*`,
        default_operator: "OR",
        fields: multiMatchFields,
      },
    },
    {
      multi_match: {
        query: `*${encodeURIComponent(searchKeyTemp)}*`,
        fields: multiMatchFields,
      },
    },
    {
      query_string: {
        query: `*${searchKeyTemp}*`,
        default_operator: "AND",
        fields: multiMatchFields,
      },
    },
    {
      multi_match: {
        query: `*${searchKeyTemp}*`,
        operator: "or",
        fields: multiMatchFields,
      },
    },
    {
      query_string: {
        query: `*${searchKeyTemp}*`,
        default_operator: "OR",
        fields: multiMatchFields,
      },
    },
    {
      multi_match: {
        query: `*${searchKeyTemp}*`,
        fields: multiMatchFields,
      },
    },
  ];
  const typeQuery = [];
  const mustCondition = [{ term: { "hb_id.keyword": `${hbId}` } }];
  const mustNotConditions = [];
  if (type !== "all") {
    switch (type) {
      case "cobuyer":
        mustCondition.push({ term: { type } });
        break;
      case "agent":
        mustCondition.push(
          { term: { type } },
          { term: { "data.keyword": `agent#${hbId}` } }
        );
        break;
      case "broker":
        mustCondition.push({ term: { type } });
        break;
      default:
        mustCondition.push(
          {
            term: {
              type: `${type === "community interest" ? "community" : type}`,
            },
          },
          {
            term: {
              "entity.keyword": `${type === "community interest" ? "community" : type
                }#${hbId}`,
            },
          }
        );
        break;
    }
  } else {
    typeQuery.push(
      { match: { "entity.keyword": `customer#${hbId}` } },
      { match: { "entity.keyword": `community#${hbId}` } },
      { match: { "entity.keyword": `realtor#${hbId}` } },
      { match: { "data.keyword": `agent#${hbId}` } },
      { match: { "entity.keyword": `agency#${hbId}` } },
      { match: { "type.keyword": `broker` } },
      { match: { "type.keyword": `cobuyer` } }
    );
  }
  if ((type === "customer" || type === "all") && hlead) {
    mustNotConditions.push({
      term: {
        "stage.keyword": "Lead",
      },
    });
    mustNotConditions.push({
      term: {
        "stage.keyword": "Dead_Lead",
      },
    });
  }
  const payload = {
    httpMethod: "POST",
    requestPath: `/_search?size=${size}`,
    payload: {
      query: {
        bool: {
          must: [
            {
              bool: {
                should: shouldQuery,
              },
            },
            ...mustCondition,
            {
              bool: {
                should: typeQuery,
              },
            },
          ],
          must_not: mustNotConditions,
        },
      },
      highlight: {
        fields: {
          "*": {},
        },
      },
    },
  };
  console.log(`searchApp payload: ${JSON.stringify(payload)}`);
  const searchResult = await sendRequest(payload)
    .then((result) =>
      result.body && result.body.aggregations
        ? success({
          ...result,
          aggregations: result.body.aggregations,
          status: true,
        })
        : success({ ...result, status: true })
    )
    .catch((result) => failure({ ...result, status: false }));
  return searchResult;
};
export const validateEmail = (email) => {
  const re = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}$/;
  return re.test(String(email).toLowerCase());
};
export const getSearchQuery = (params) => {
  console.log(`params: ${JSON.stringify(params)}`);
  let { searchKey } = params;
  const { filterKey, type } = params;
  if (
    ["All", "Phone"].indexOf(filterKey) !== -1 &&
    searchKey.match(/^\d{10}$/)
  ) {
    const match = searchKey.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      searchKey = `(${match[1]}) ${match[2]}-${match[3]}`;
    }
  }
  let fieldName;
  switch (type) {
    case "customer":
      fieldName = {
        fields: [
          "fname",
          "lname",
          "cntm",
          "email",
          "email.keyword",
          "grade",
          "desf",
          "phone",
          "psrc",
          "stage",
        ],
      };
      break;
    case "realtor":
      fieldName = {
        fields: ["fname","lname", "cntm", "email", "email.keyword", "phone", "psrc"],
      };
      break;
    case "agent":
      fieldName = {
        fields : ["fname", "lname"]
      }
      break;
    default:
      break;
  }
  if (searchKey.startsWith("@")) {
    searchKey = searchKey.slice(1);
  }
  console.log(`searchKey: ${JSON.stringify(searchKey)}`);
  switch (filterKey) {
    case "Name":
      fieldName = { fields: ["fname","lname"] };
      break;
    case "Email":
      fieldName = { fields: ["email", "email.keyword"] };
      break;
    case "Phone":
      fieldName = { fields: ["phone"] };
      break;
    case "Grade":
      fieldName = { fields: ["grade"] };
      break;
    case "Desired Features":
      fieldName = { fields: ["desf"] };
      break;
    case "Contact Method":
      fieldName = { fields: ["cntm"] };
      break;
    case "Source":
      fieldName = { fields: ["psrc"] };
      break;
    case "Stage":
      fieldName = { fields: ["stage"] };
      break;
    default:
      break;
  }
  let shouldQuery = [
    {
      multi_match: {
        query: `*${encodeURIComponent(searchKey)}*`,
        operator: "and",
        ...fieldName,
      },
    },
    {
      query_string: {
        query: `*${encodeURIComponent(searchKey)}*`,
        default_operator: "AND",
        ...fieldName,
      },
    },
    {
      multi_match: {
        query: `*${encodeURIComponent(searchKey)}*`,
        operator: "or",
        ...fieldName,
      },
    },
    {
      query_string: {
        query: `*${encodeURIComponent(searchKey)}*`,
        default_operator: "OR",
        ...fieldName,
      },
    },
    // { multi_match: { query: `'${encodeURIComponent(searchKey)}'`, ...fieldName } },
    // { query_string: { query: `'${encodeURIComponent(searchKey)}'`, ...fieldName } },
    {
      query_string: {
        query: `*${searchKey}*`,
        default_operator: "OR",
        ...fieldName,
        type: "cross_fields",
      },
    },
    {
      query_string: {
        query: `*${searchKey}*`,
        default_operator: "AND",
        ...fieldName,
        type: "cross_fields",
      },
    },
    {
      multi_match: {
        query: `*${searchKey}*`,
        operator: "and",
        ...fieldName,
        type: "cross_fields",
      },
    },
    {
      multi_match: {
        query: `*${searchKey}*`,
        operator: "or",
        ...fieldName,
        type: "cross_fields",
      },
    },
  ];
  console.log(`shouldQuery: ${JSON.stringify(shouldQuery)}`);
  if (filterKey === "All") {
    console.log(`filterKey === 'All'`);
    if (validateEmail(searchKey)) {
      shouldQuery = [
        {
          multi_match: {
            query: `${searchKey}`,
            operator: "and",
            fields: ["email", "email.keyword"],
          },
        },
        {
          query_string: {
            query: `${searchKey}`,
            default_operator: "AND",
            fields: ["email", "email.keyword"],
          },
        },
      ];
    } else if (validatePhone(searchKey)) {
      const whiteSpaceRemoved = searchKey.replace(/\s/g, "");
      shouldQuery = [
        {
          multi_match: {
            query: `${encodeURIComponent(whiteSpaceRemoved)}`,
            operator: "and",
            fields: ["phone"],
          },
        },
        {
          query_string: {
            query: `${encodeURIComponent(whiteSpaceRemoved)}`,
            default_operator: "AND",
            fields: ["phone"],
          },
        },
      ];
    }
  } else if (filterKey === "Email") {
    console.log(`filterKey === 'Email'`);
    if (validateEmail(searchKey)) {
      shouldQuery = [
        {
          multi_match: {
            query: `${searchKey}`,
            operator: "and",
            fields: ["email", "email.keyword"],
          },
        },
        {
          query_string: {
            query: `${searchKey}`,
            default_operator: "AND",
            fields: ["email", "email.keyword"],
          },
        },
      ];
    } else {
      shouldQuery = [
        {
          multi_match: {
            query: `*${encodeURIComponent(searchKey)}*`,
            operator: "and",
            fields: ["email", "email.keyword"],
          },
        },
        {
          query_string: {
            query: `*${encodeURIComponent(searchKey)}*`,
            default_operator: "AND",
            fields: ["email", "email.keyword"],
          },
        },
        {
          multi_match: {
            query: `*${encodeURIComponent(searchKey)}*`,
            operator: "or",
            fields: ["email", "email.keyword"],
          },
        },
        {
          query_string: {
            query: `*${encodeURIComponent(searchKey)}*`,
            default_operator: "OR",
            fields: ["email", "email.keyword"],
          },
        },
        {
          multi_match: {
            query: `'${encodeURIComponent(searchKey)}'`,
            fields: ["email", "email.keyword"],
          },
        },
        {
          query_string: {
            query: `'${encodeURIComponent(searchKey)}'`,
            fields: ["email", "email.keyword"],
          },
        },
      ];
    }
  } else if (filterKey === "Phone") {
    console.log(`filterKey === 'Phone'`);
    if (validatePhone(searchKey)) {
      const whiteSpaceRemoved = searchKey.replace(/\s/g, "");
      shouldQuery = [
        {
          multi_match: {
            query: `${encodeURIComponent(whiteSpaceRemoved)}`,
            operator: "and",
            fields: ["phone"],
          },
        },
        {
          query_string: {
            query: `${encodeURIComponent(whiteSpaceRemoved)}`,
            default_operator: "AND",
            fields: ["phone"],
          },
        },
      ];
    } else {
      let specialCharAndSpaceRemoved = searchKey;
      if (searchKey.includes("_")) {
        specialCharAndSpaceRemoved = searchKey.substring(
          0,
          searchKey.indexOf("_")
        );
      }
      specialCharAndSpaceRemoved = specialCharAndSpaceRemoved.replace(
        /\s/g,
        ""
      );
      shouldQuery = [
        {
          multi_match: {
            query: `*${encodeURIComponent(specialCharAndSpaceRemoved)}*`,
            operator: "and",
            fields: ["phone"],
          },
        },
        {
          query_string: {
            query: `*${encodeURIComponent(specialCharAndSpaceRemoved)}*`,
            default_operator: "AND",
            fields: ["phone"],
          },
        },
        {
          multi_match: {
            query: `*${encodeURIComponent(specialCharAndSpaceRemoved)}*`,
            operator: "or",
            fields: ["phone"],
          },
        },
        {
          query_string: {
            query: `*${encodeURIComponent(specialCharAndSpaceRemoved)}*`,
            default_operator: "OR",
            fields: ["phone"],
          },
        },
        {
          multi_match: {
            query: `'${encodeURIComponent(specialCharAndSpaceRemoved)}'`,
            fields: ["phone"],
          },
        },
        {
          query_string: {
            query: `'${encodeURIComponent(specialCharAndSpaceRemoved)}'`,
            fields: ["phone"],
          },
        },
      ];
    }
  } else if (filterKey === "Name") {
    console.log(`filterKey === 'Name'`);
    let strArr = searchKey.split(" ");
    strArr = strArr.filter((item) => item);
    const wildCardStr = strArr.reduce((acc, crr) => {
      acc += `${crr}*`;
      return acc;
    }, "*");
    if (type === 'agent') {
      shouldQuery = [
        {
          multi_match: {
            query: wildCardStr,
            fields: ["fname", "lname"],
          },
        },
        {
          query_string: {
            query: wildCardStr,
            fields: ["fname", "lname"],
          },
        },
      ];
    } else {
      shouldQuery = [
        {
          multi_match: {
            query: wildCardStr,
            fields: [type === "agency" ? "cname" : "fullname"],
          },
        },
        {
          query_string: {
            query: wildCardStr,
            fields: [type === "agency" ? "cname" : "fullname"],
          },
        },
      ];
    }
  }
  console.log(`shouldQuery after: ${JSON.stringify(shouldQuery)}`);
  const query = {
    bool: {
      should: shouldQuery,
    },
  };
  console.log(`query: ${JSON.stringify(query)}`);
  return query;
};
export const searchtable = async (params) => {
  let { searchKey } = params;
  const { filterKey, type, hb_id: hbId, comm, utype, size, hlead } = params;
  if (
    ["All", "Phone"].indexOf(filterKey) !== -1 &&
    searchKey.match(/^\d{10}$/)
  ) {
    const match = searchKey.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      searchKey = `(${match[1]}) ${match[2]}-${match[3]}`;
    }
  }
  let communitExists = false;
  if (comm && comm.length) {
    communitExists = true;
  }
  if (utype === "admin" || utype === "online_agent") {
    communitExists = false;
  }
  let fieldName;
  switch (type) {
    case "customer":
      fieldName = {
        fields: [
          "fname",
          "lname",
          "cntm",
          "email",
          "grade",
          "desf",
          "phone",
          "psrc",
          "stage",
        ],
      };
      break;
    case "realtor":
      fieldName = { fields: ["fname","lname", "cntm", "email", "phone", "psrc"] };
      break;
    default:
      break;
  }
  if (searchKey.startsWith("@")) {
    searchKey = searchKey.slice(1);
  }
  switch (filterKey) {
    case "Name":
      fieldName = { fields: ["fname","lname"] };
      break;
    case "Email":
      fieldName = { fields: ["email"] };
      break;
    case "Phone":
      fieldName = { fields: ["phone"] };
      break;
    case "Grade":
      fieldName = { fields: ["grade"] };
      break;
    case "Desired Features":
      fieldName = { fields: ["desf"] };
      break;
    case "Contact Method":
      fieldName = { fields: ["cntm"] };
      break;
    case "Source":
      fieldName = { fields: ["psrc"] };
      break;
    case "Stage":
      fieldName = { fields: ["stage"] };
      break;
    default:
      break;
  }
  let shouldQuery = [
    {
      multi_match: {
        query: `*${encodeURIComponent(searchKey)}*`,
        operator: "and",
        ...fieldName,
      },
    },
    {
      query_string: {
        query: `*${encodeURIComponent(searchKey)}*`,
        default_operator: "AND",
        ...fieldName,
      },
    },
    {
      multi_match: {
        query: `*${encodeURIComponent(searchKey)}*`,
        operator: "or",
        ...fieldName,
      },
    },
    {
      query_string: {
        query: `*${encodeURIComponent(searchKey)}*`,
        default_operator: "OR",
        ...fieldName,
      },
    },
    {
      multi_match: {
        query: `'${encodeURIComponent(searchKey)}'`,
        ...fieldName,
      },
    },
    {
      query_string: {
        query: `'${encodeURIComponent(searchKey)}'`,
        ...fieldName,
      },
    },
  ];
  if (filterKey === "All") {
    if (validateEmail(searchKey)) {
      shouldQuery = [
        {
          multi_match: {
            query: `${encodeURIComponent(searchKey)}`,
            operator: "and",
            fields: ["email"],
          },
        },
        {
          query_string: {
            query: `${encodeURIComponent(searchKey)}`,
            default_operator: "AND",
            fields: ["email"],
          },
        },
      ];
    } else if (validatePhone(searchKey)) {
      const whiteSpaceRemoved = searchKey.replace(/\s/g, "");
      shouldQuery = [
        {
          multi_match: {
            query: `${encodeURIComponent(whiteSpaceRemoved)}`,
            operator: "and",
            fields: ["phone"],
          },
        },
        {
          query_string: {
            query: `${encodeURIComponent(whiteSpaceRemoved)}`,
            default_operator: "AND",
            fields: ["phone"],
          },
        },
      ];
    }
  } else if (filterKey === "Email") {
    if (validateEmail(searchKey)) {
      shouldQuery = [
        {
          multi_match: {
            query: `${encodeURIComponent(searchKey)}`,
            operator: "and",
            fields: ["email"],
          },
        },
        {
          query_string: {
            query: `${encodeURIComponent(searchKey)}`,
            default_operator: "AND",
            fields: ["email"],
          },
        },
      ];
    } else {
      shouldQuery = [
        {
          multi_match: {
            query: `*${encodeURIComponent(searchKey)}*`,
            operator: "and",
            fields: ["email"],
          },
        },
        {
          query_string: {
            query: `*${encodeURIComponent(searchKey)}*`,
            default_operator: "AND",
            fields: ["email"],
          },
        },
        {
          multi_match: {
            query: `*${encodeURIComponent(searchKey)}*`,
            operator: "or",
            fields: ["email"],
          },
        },
        {
          query_string: {
            query: `*${encodeURIComponent(searchKey)}*`,
            default_operator: "OR",
            fields: ["email"],
          },
        },
        {
          multi_match: {
            query: `'${encodeURIComponent(searchKey)}'`,
            fields: ["email"],
          },
        },
        {
          query_string: {
            query: `'${encodeURIComponent(searchKey)}'`,
            fields: ["email"],
          },
        },
      ];
    }
  } else if (filterKey === "Phone") {
    if (validatePhone(searchKey)) {
      const whiteSpaceRemoved = searchKey.replace(/\s/g, "");
      shouldQuery = [
        {
          multi_match: {
            query: `${encodeURIComponent(whiteSpaceRemoved)}`,
            operator: "and",
            fields: ["phone"],
          },
        },
        {
          query_string: {
            query: `${encodeURIComponent(whiteSpaceRemoved)}`,
            default_operator: "AND",
            fields: ["phone"],
          },
        },
      ];
    } else {
      let specialCharAndSpaceRemoved = searchKey;
      if (searchKey.includes("_")) {
        specialCharAndSpaceRemoved = searchKey.substring(
          0,
          searchKey.indexOf("_")
        );
      }
      specialCharAndSpaceRemoved = specialCharAndSpaceRemoved.replace(
        /\s/g,
        ""
      );
      shouldQuery = [
        {
          multi_match: {
            query: `*${encodeURIComponent(specialCharAndSpaceRemoved)}*`,
            operator: "and",
            fields: ["phone"],
          },
        },
        {
          query_string: {
            query: `*${encodeURIComponent(specialCharAndSpaceRemoved)}*`,
            default_operator: "AND",
            fields: ["phone"],
          },
        },
        {
          multi_match: {
            query: `*${encodeURIComponent(specialCharAndSpaceRemoved)}*`,
            operator: "or",
            fields: ["phone"],
          },
        },
        {
          query_string: {
            query: `*${encodeURIComponent(specialCharAndSpaceRemoved)}*`,
            default_operator: "OR",
            fields: ["phone"],
          },
        },
        {
          multi_match: {
            query: `'${encodeURIComponent(specialCharAndSpaceRemoved)}'`,
            fields: ["phone"],
          },
        },
        {
          query_string: {
            query: `'${encodeURIComponent(specialCharAndSpaceRemoved)}'`,
            fields: ["phone"],
          },
        },
      ];
    }
  }
  let mustConditions = [
    { term: { type } },
    { term: { "entity.keyword": `${type}#${hbId}` } },
    { term: { "hb_id.keyword": `${hbId}` } },
  ];

  const shouldConditions = [];
  if (communitExists) {
    switch (type) {
      case "customer":
        mustConditions = [
          { term: { type } },
          { term: { "entity.keyword": `${type}#${hbId}` } },
          { term: { "hb_id.keyword": `${hbId}` } },
        ];
        comm.forEach((commId) => {
          shouldConditions.push({
            match_phrase: {
              "inte.keyword": commId,
            },
          });
        });
        break;
      case "realtor":
        mustConditions = [
          { term: { type } },
          { match_phrase: { entity: `${type}#${hbId}#community#*` } },
          { term: { "hb_id.keyword": `${hbId}` } },
        ];
        comm.forEach((commId) => {
          shouldConditions.push({ term: { "id.keyword": commId } });
        });
        break;
      default:
        break;
    }
  }
  const mustNotConditions = [];
  if (type === "customer" && hlead) {
    mustNotConditions.push({
      term: {
        "stage.keyword": "Lead",
      },
    });
    mustNotConditions.push({
      term: {
        "stage.keyword": "Dead_Lead",
      },
    });
  }
  const payload = {
    httpMethod: "POST",
    requestPath: `/_search?size=${size}`,
    payload: {
      query: {
        bool: {
          must: [
            ...mustConditions,
            {
              bool: {
                should: shouldConditions,
              },
            },
            {
              bool: {
                should: shouldQuery,
              },
            },
          ],
          must_not: mustNotConditions,
        },
      },
      highlight: {
        fields: {
          "*": {},
        },
      },
    },
  };
  const searchResult = await sendRequest(payload)
    .then((result) =>
      result.body && result.body.aggregations
        ? success({
          ...result,
          aggregations: result.body.aggregations,
          status: true,
        })
        : success({ ...result, status: true })
    )
    .catch((result) => failure({ ...result, status: false }));
  return searchResult;
};

const esReindex = async (data) => {
  try {
    const purpose = data.purpose ? data.purpose : "";
    switch (purpose) {
      case "listIndexes":
        return await getAllIndexes();
      case "getIndexCount":
        return await getIndexCount(data);
      case "createIndex":
        return await createNewIndex(data);
      case "reindex":
        return await reindex(data);
      case "getTask":
        return await getTask(data);
      case "deleteIndex":
        return await deleteIndex(data);
      case "extentMappingLimit":
        return await extentMappingLimit(data);
      case "updateFullNameScript":
        return await updateIndexbyQuery(data);
      default:
        return failure({
          status: false,
          err: "Invalid Purpose key",
        });
    }
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
    return failure({
      status: false,
      err: e.message,
    });
  }
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
    const path = event && event.path ? event.path : "";
    const isPublicValidate = path.indexOf("public/search/validate") !== -1;
    let data;
    if (event.httpMethod === "POST") {
      data = JSON.parse(event.body);
      if (!data) {
        response = failure();
      } else if (
        action === "customers" ||
        action === "realtors" ||
        action === "global"
      ) {
        response = await searchEntities(data, action);
      } else if (
        action === "paginate" ||
        action === "validate" ||
        isPublicValidate
      ) {
        response = await paginate(data, false, isPublicValidate);
      } else if (action === "aggregate") {
        response = await aggregate(data);
      } else if (action === "queryj") {
        response = await queryJSONOnly(data);
      } else if (action === "aggregatej") {
        response = await aggregateJSONOnly(data);
      } else if (action === "searchapp") {
        response = await searchapp(data);
      } else if (action === "searchtable") {
        response = await searchtable(data);
      } else if (action === "testes") {
        response = await testEs(data);
      } else if (action === "reindex") {
        response = await initReIndexES(data);
      } else if (action === "esReindex") {
        response = await esReindex(data);
      } else {
        response = failure();
      }
    } else {
      response = failure();
    }
  } catch (err) {
    console.log(err);
    return failure({ status: false, error: err });
  }

  return response;
}
