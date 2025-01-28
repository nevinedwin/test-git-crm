/* eslint-disable camelcase */
/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import {
  getUserCreateJSON,
  isCorrectFieldType,
  getResourceJSON,
  transactWriteItems,
  getQueryPromise,
  getParamsForQuery,
  getResources,
  updateResources,
  postResources,
  postQueryPromise,
  getHydrationParamsForQuery,
  getRecordByEntity,
  batchGetResources,
  deleteResources,
  doPaginatedQueryEllastic,
  listEntitiesElastic,
  getEntityByIdsElastic
} from "../libs/db";
import { deleteEntityEndpoint } from "../campaign/common";
import { badRequest, failure, success } from "../libs/response-lib";
import { validateFields } from "../validation/validation";
import { getRealtorAgencyId } from "../realtors/realtors";
import { getBuilderAsync } from "../builders/builders";
import { getEntities } from "../endpointcount/endpointcount";
import { elasticExecuteQuery, getSearchQuery } from "../search/search";
import { getCommunityBasedOnProjNo } from "../communities/communities";
import { listCobuyers } from "../cobuyers/cobuyers";
import { initLambdaInvoke } from "../libs/lambda";
import { publishEntityData } from "../libs/messaging";
import { createChangeActivity } from "../libs/change-activity";
import utils from "../libs/utils";
import { incrementGoalCount } from "../goalSetting/goalSetting";
import { getDynamicRequiredFields } from "../dynamicRequiredFields/dynamicRequiredFields";

const {
  STACK_PREFIX,
  CLEANUP_MACHINE_ARN,
  ACTIVITY_LAMBDA_ARN,
  DATA_MIGRAION_MACHINE_ARN,
  NOTIFICATION_LAMBDA_ARN
} = process.env;
const sfn = new AWS.StepFunctions();

const getMetroFromCommunity = async (inte, hbId) => {
  try {
    if (!inte.length) return [];
    const customParams = [
      {
        terms: {
          "id.keyword": inte,
        },
      },
      {
        match: {
          "entity.keyword": `community#${hbId}`,
        },
      },
      {
        match: {
          "type.keyword": "community",
        },
      },
    ];

    const communities = await doPaginatedQueryEllastic({
      hb_id: hbId,
      isCustomParam: true,
      customParams,
    });

    return [
      ...new Set(
        communities.reduce((acc, crr) => {
          if (crr?.rel_id) acc.push(crr.rel_id);
          return acc;
        }, [])
      ),
    ];
  } catch (error) {
    console.log("error in getMetroFromCommunity", JSON.stringify(error.stack));
    return [];
  }
};

export const createCustomer = async (data) => {
  const { hb_id: hbId, crby: userid = "", isSns = false, isHf = false } = data;
  const dynamicRequiredFieldData = await getDynamicRequiredFields({ pathParameters: { id: hbId, type: "customer" } }, true);
  console.log(`dynamicRequiredFieldData: ${JSON.stringify(dynamicRequiredFieldData)}`);
  const customerRequiredFields = dynamicRequiredFieldData?.data[0]?.required_fields || {};
  const retVal = validateFields("customer", data, false, customerRequiredFields);
  console.log("retVal: ", retVal);
  if (retVal === "") {
    const getBuilderResp = await getBuilderAsync(hbId);
    if (getBuilderResp && getBuilderResp.id) {
      const userJSON = getUserCreateJSON(data);
      // Check for data type for the array/object fields
      if (!isCorrectFieldType(userJSON)) {
        return failure({ status: false, error: "Field Type Error" });
      }

      // check email exists in the appication
      const queryParam = {
        httpMethod: "POST",
        requestPath: "/_count",
        payload: {
          query: {
            bool: {
              must: [
                {
                  match: {
                    "email.keyword": userJSON.email,
                  },
                },
                {
                  match: {
                    "type.keyword": "customer",
                  },
                },
                {
                  match: {
                    "entity.keyword": `${userJSON.type}#${userJSON.hb_id}`,
                  },
                },
                {
                  match: {
                    "hb_id.keyword": userJSON.hb_id,
                  },
                },
              ],
            },
          },
        },
      };

      console.log("Email check query", queryParam);

      const customerCount = await elasticExecuteQuery(queryParam, true);
      console.log("customerCount==>", customerCount);

      if (!customerCount.status) {
        return failure({
          status: false,
          error: "Customer count fetching Failed",
        });
      }

      if (customerCount?.body?.count) {
        return failure({
          status: false,
          error:
            "Unable to create.Customer with same email already exists in the application.",
        });
      }

      // Proceed with the create operation
      const customerItem = {
        type: userJSON.type,
        hb_id: userJSON.hb_id,
        fname: userJSON.fname,
        lname: userJSON.lname,
        fullname: `${userJSON.fname} ${userJSON.lname || ""}`,
        email: userJSON.email,
        jdt: userJSON.jdt,
        mdt: userJSON.mod_dt,
        cdt: userJSON.cdt,
        inte: userJSON.inte,
        infl: userJSON.infl,
        rltr: userJSON.rltr,
        desf: userJSON.desf,
        fav: userJSON.fav,
        stage: userJSON.stage,
        rel_id: userJSON.rel_id,
        ag_id: userJSON.ag_id,
        appid: getBuilderResp.appid,
        optindt: userJSON.optindt,
        optoutdt: userJSON.optoutdt,
        newinte: userJSON.newinte,
        addr: userJSON.addr
      };
      if (!userJSON.optst) {
        if (getBuilderResp.optin) customerItem.optst = "PENDING";
        else customerItem.optst = "NONE";
      } else {
        customerItem.optst = userJSON.optst;
      }
      // Setting non-mandatory fields based on it's availability
      if (userJSON.img) {
        customerItem.img = userJSON.img;
      }
      if (userJSON.psrc) {
        customerItem.psrc = userJSON.psrc;
      }
      if (userJSON.cntm) {
        customerItem.cntm = userJSON.cntm;
      }
      if (userJSON.grade) {
        customerItem.grade = userJSON.grade;
      }
      if (userJSON.desf) {
        customerItem.desf = userJSON.desf;
      }
      if (userJSON.desm) {
        customerItem.desm = userJSON.desm;
      }
      if (userJSON.agent) {
        customerItem.agent = userJSON.agent;
      }
      if (userJSON.phone) {
        customerItem.phone = userJSON.phone;
      }
      if (userJSON.brixid) {
        customerItem.brixid = userJSON.brixid;
      }
      if (userJSON.brixappid) {
        customerItem.brixappid = userJSON.brixappid;
      }
      if (userJSON.brixprojno) {
        customerItem.brixprojno = userJSON.brixprojno;
      }
      if (userJSON.brixclientid) {
        customerItem.brixclientid = userJSON.brixclientid;
      }
      if (userJSON.ref) {
        customerItem.ref = userJSON.ref;
      }
      if (userJSON.hfhbid) {
        customerItem.hfhbid = userJSON.hfhbid;
      }
      if (userJSON.hfid) {
        customerItem.hfid = userJSON.hfid;
      }
      if (data?.isSns) {
        if (data?.isHf) customerItem.gen_src = "msg_hf";
        else customerItem.gen_src = "msg_brix";
      } else {
        customerItem.gen_src = "app";
      }
      // // Get builder details for the optout settings
      // const getBuilderAsyncResponse = await getBuilderAsync(userJSON.hb_id);
      // console.log('getBuilderAsyncResponse:', JSON.stringify(getBuilderAsyncResponse));
      const crby = data.crby ? data.crby : "";
      if (crby) {
        customerItem.crby = crby;
      }
      let isStageOkay = false;
      if (customerItem.stage !== "Lead" && customerItem.stage !== "Dead_Lead") {
        console.log("customerItem.stage if: ", customerItem.stage);
        customerItem.inbrix = true;
        isStageOkay = true;
      } else {
        console.log("customerItem.stage else: ", customerItem.stage);
        customerItem.inbrix = false;
        isStageOkay = false;
      }
      console.log("isStageOkay: ", isStageOkay);
      console.log("customerItem[inbrix]: ", customerItem.inbrix);
      const customerUUID = data.isSns ? data.id : uuidv4();
      customerItem.dg = [];
      if (data.dgraph_list && data.dgraph_list.length > 0) {
        data.dgraph_list.forEach((dgraphItem) => {
          customerItem.dg.push({
            q: dgraphItem.qstn_id,
            a: dgraphItem.option_id,
          });
        });
      }

      // getting the metros from community Ids
      if (userJSON.inte && userJSON.inte.length) {
        const m_id = await getMetroFromCommunity(userJSON.inte, hbId);
        console.log("m_id ", m_id);
        customerItem.m_id = m_id;
      }

      const transParams = {
        TransactItems: [],
      };
      const customerCreateItem = {
        id: customerUUID,
        entity: `${userJSON.type}#${userJSON.hb_id}`,
        ...customerItem,
      };
      transParams.TransactItems.push({
        Put: {
          TableName: process.env.entitiesTableName /* required */,
          Item: customerCreateItem,
          ReturnValuesOnConditionCheckFailure: "ALL_OLD",
        },
      });
      customerItem.data = customerUUID;
      const customerMessageParams = { ...customerCreateItem };
      // customerItem.rltr.data contains the realtor uuid
      if (customerItem.rltr.data) {
        const realtorCreateItem = {
          id: customerItem.rltr.data,
          entity: `${userJSON.type}#${userJSON.hb_id}#${customerItem.stage}#${customerItem.cdt}`,
          ...customerItem,
        };

        transParams.TransactItems.push({
          Put: {
            TableName: process.env.entitiesTableName /* required */,
            Item: realtorCreateItem,
            ReturnValuesOnConditionCheckFailure: "ALL_OLD",
          },
        });

        const realtorAgencyParams = {
          TableName: process.env.entitiesTableName,
          KeyConditionExpression: "#id = :id and begins_with(#entity, :entity)",
          ExpressionAttributeNames: {
            "#id": "id",
            "#entity": "entity",
          },
          ExpressionAttributeValues: {
            ":id": customerItem.rltr.data,
            ":entity": `agency#${userJSON.hb_id}`,
          },
        };
        console.log(`GetRealtorAgency: ${realtorAgencyParams}`);
        const realtorAgencyJSON = await getResourceJSON(realtorAgencyParams);
        console.log(`realtorAgencyJSON: ${JSON.stringify(realtorAgencyJSON)}`);
        // get the agency id from the response
        const agencyId =
          realtorAgencyJSON &&
            realtorAgencyJSON.length &&
            realtorAgencyJSON[0].entity
            ? realtorAgencyJSON[0].entity.split(
              `agency#${userJSON.hb_id}#realtor#`
            )[1]
            : "";
        console.log(`agencyId: ${agencyId}`);
        if (agencyId) {
          const agencyCreateItem = {
            id: agencyId,
            entity: `${userJSON.type}#${userJSON.hb_id}#${customerItem.stage}#${customerItem.cdt}`,
            ...customerItem,
          };
          transParams.TransactItems.push({
            Put: {
              TableName: process.env.entitiesTableName /* required */,
              Item: agencyCreateItem,
              ReturnValuesOnConditionCheckFailure: "ALL_OLD",
            },
          });
        }
      }
      const customerCreateResp = await transactWriteItems(transParams);

      // Create Sales agent added activity
      await createChangeActivity({
        profileChange: 'profile_sa',
        userid,
        customerUUID,
        hbId,
        oldinte: [],
        inte: userJSON.newinte ?? []
      });
      // Create stage change activity
      await createChangeActivity({
        stage: userJSON.stage,
        userid,
        customerUUID,
        hbId,
        isSns,
        isHf,
      });

      if (userJSON.inte.length) {
        // Create inte change activity
        await createChangeActivity({
          inte: userJSON.inte,
          userid,
          customerUUID,
          hbId,
          isSns,
          isHf,
          inteChange: true,
        });

        // increment the goal count
        const increResp = await incrementGoalCount({
          hbId,
          stage: userJSON.stage,
          comm: userJSON.inte,
        });
        console.log(`increResp: ${JSON.stringify(increResp)}`);
      }

      if (
        !data.isSns &&
        isStageOkay &&
        (STACK_PREFIX.includes("aws-crm") || STACK_PREFIX.includes("crm-test"))
      ) {
        // Brix message
        const publishCustomerDataResponse = await publishEntityData({
          entityId: customerMessageParams.id,
          isBrix: true,
          isCreate: true,
          messageId: uuidv4(),
        });
        console.log(
          "publishCustomerDataResponse: ",
          publishCustomerDataResponse
        );
      }
      // Do a homefront publish if this call is not originated from messaging (isSns)
      // or from a BRIX message (data.isSns && !data.isHf)
      if (
        (!data.isSns || (data.isSns && !data.isHf)) &&
        isStageOkay &&
        (STACK_PREFIX.includes("aws-crm") || STACK_PREFIX.includes("crm-test"))
      ) {
        // Homefront message
        const publishEntityDataHfResp = await publishEntityData({
          entityId: customerMessageParams.id,
          entityType: "customer",
          isBrix: false,
          isCreate: true,
          isHomefront: true,
          messageId: uuidv4(),
          HomebuilderID: hbId,
        });
        console.log("publishEntityDataHfResp: ", publishEntityDataHfResp);
        // saving the oppertunityId(MessageID) of Homefront
        if (
          publishEntityDataHfResp?.Code === "200" ||
          publishEntityDataHfResp?.Code === 200
        ) {
          const customerUpdateParams = {
            TableName: process.env.entitiesTableName,
            Key: {
              id: customerCreateItem.id,
              entity: customerCreateItem.entity,
            },
            UpdateExpression: `set #hfid = :hfid`,
            ExpressionAttributeNames: {
              "#hfid": "hfid",
            },
            ExpressionAttributeValues: {
              ":hfid": publishEntityDataHfResp?.MessageID || "",
            },
            ReturnValuesOnConditionCheckFailure: "ALL_OLD",
          };
          console.log(
            `customerUpdateParams: ${JSON.stringify(customerUpdateParams)}`
          );
          const updateCustomerRes = await updateResources(customerUpdateParams);
          console.log(
            `updateCustomerRes: ${JSON.stringify(updateCustomerRes)}`
          );
        }
      }
      return customerCreateResp;
    }
    return failure({
      status: false,
      error: { msg: "Builder doesn't exist.", field: "hb_id" },
    });
  }
  return failure({
    status: false,
    error: { msg: "Validation failed", field: retVal },
  });
};
export const oldListCustomers = async (data) => {
  const { hb_id: hbid = "", comm = [], hlead = false } = data;
  const sendFilteredCustomerList = (customerList) => {
    let filteredCustomerList;
    if (hlead) {
      filteredCustomerList = customerList.filter(
        (customer) =>
          customer.stage !== "Lead" && customer.stage !== "Dead_Lead"
      );
    } else {
      filteredCustomerList = customerList;
    }
    return filteredCustomerList;
  };
  const params = {
    TableName: process.env.entitiesTableName,
    IndexName: process.env.entitiesTableByEntityAndId,
    KeyConditionExpression: "#entity = :entity",
    ExpressionAttributeNames: {
      "#entity": "entity",
    },
    ExpressionAttributeValues: {},
  };

  if (comm.length) {
    // Filter by communities
    const queryList = [];
    for (const commId of comm) {
      params.FilterExpression = `contains (inte, :commId)`;
      params.ExpressionAttributeValues = {
        ":entity": `customer#${hbid}`,
        ":commId": commId,
      };
      queryList.push(getQueryPromise(params));
    }
    const customersList = await Promise.all(queryList);
    console.log(`customersList: ${JSON.stringify(customersList)}`);
    let customerUnderComm = [];
    for (const resp of customersList) {
      customerUnderComm.push(...resp.Items);
    }
    const customerIds = [];
    customerUnderComm = customerUnderComm.filter((customer) => {
      if (!customerIds.includes(customer.id)) {
        customerIds.push(customer.id);
        return true;
      }
      return false;
    });
    const filteredList = sendFilteredCustomerList(customerUnderComm);
    return success(filteredList);
  }
  params.ExpressionAttributeValues = {
    ":entity": `customer#${hbid}`,
  };
  console.log(params);
  const customerList = await getResourceJSON(params);
  console.log("customerList: ", JSON.stringify(customerList));
  const filteredList = sendFilteredCustomerList(customerList);
  return success(filteredList);
};
export const listCustomers = async (data) => {
  /* const hbid = data.hb_id ? data.hb_id : '';
    const comm = data.comm ? data.comm : [];
    const hlead = data.hlead ? data.hlead : false;
    const limit = data.limit ? data.limit : null;
    const cursor = data.cursor ? data.cursor : '';
    let params, hasAfter;
    const getLeadFilteredList = (customerList) => {
        let filteredCustomerList;
        if (hlead) {
            // Filter out Lead and Dead_Lead customers
            filteredCustomerList = customerList.filter(customer => customer.stage !== 'Lead' && customer.stage !== 'Dead_Lead');
        }
        else {
            filteredCustomerList = customerList;
        }
        return filteredCustomerList;
    }

    console.log(`cursor: ${cursor}`);
    // Check whether before or after is provided. If yes use it. Otherwise generate the query.
    if (cursor) {
        // Pagination. base64 decode the after, decrypt and parse the JSON to get the query
        const beforeDecString = await decryptString(Buffer.from(cursor, 'base64'));
        params = JSON.parse(Buffer.from(beforeDecString, 'base64').toString('ascii'));
    }
    else {
        // Initial call
        params = {
            TableName: process.env.entitiesTableName,
            IndexName: process.env.entitiesTableByEntityAndId,
            KeyConditionExpression: "#entity = :entity",
            ExpressionAttributeNames: {
                "#entity": "entity",
            },
            ExpressionAttributeValues: {},
            ExclusiveStartKey: null
        };
        if (limit) {
            params["Limit"] = limit;
        }
        if (comm.length) {
            // Filter by communities
            // const queryList = [];
            params.ExpressionAttributeValues = {
                ':entity': `customer#${hbid}`
            };
            for (let i = 1; i <= comm.length; i++) {
                params['FilterExpression'] += params['FilterExpression'] ? ` OR contains (inte, :commId${i})` : `contains (inte, :commId${i})`;
                params.ExpressionAttributeValues[`:commId${i}`] = comm[i];
                // queryList.push(getQueryPromise(params));
            }
            console.log(`params comm: ${params}`);
        }
        else {
            params.ExpressionAttributeValues = {
                ':entity': `customer#${hbid}`
            };
            console.log(params);
        }
    }
    const customerList = await getResourceJSON(params, true);
    console.log("customerList: ", JSON.stringify(customerList));
    const filteredList = getLeadFilteredList(customerList.Items);
    const nextQuery = { ...params };
    // If LastEvaluatedKey is empty or not defined then set hasAfter to false
    if (!customerList.LastEvaluatedKey) {
        hasAfter = false;
    }
    else {
        hasAfter = true;
        nextQuery['ExclusiveStartKey'] = customerList.LastEvaluatedKey;
    }
    // Encode the after as base64 string
    const nextCursor = await encryptString(JSON.stringify(nextQuery));
    return success({ customers: filteredList, cursor: nextCursor, hasAfter }); */
  const {
    hb_id: hbid = "",
    comm = [],
    hlead = false,
    limit = null,
    token = null,
  } = data;
  const getLeadFilteredList = (customerList) => {
    let filteredCustomerList;
    if (hlead) {
      // Filter out Lead and Dead_Lead customers
      filteredCustomerList = customerList.filter(
        (customer) =>
          customer.stage !== "Lead" && customer.stage !== "Dead_Lead"
      );
    } else {
      filteredCustomerList = customerList;
    }
    return filteredCustomerList;
  };

  const params = {
    TableName: process.env.entitiesTableName,
    IndexName: process.env.entitiesTableByEntityAndId,
    KeyConditionExpression: "#entity = :entity",
    ExpressionAttributeNames: {
      "#entity": "entity",
    },
    ExpressionAttributeValues: {},
    ExclusiveStartKey: null,
  };
  if (limit) {
    params.Limit = limit;
  }
  if (comm.length) {
    // Filter by communities
    // const queryList = [];
    params.ExpressionAttributeValues = {
      ":entity": `customer#${hbid}`,
    };
    params.FilterExpression = "";
    for (let i = 0; i < comm.length; i += 1) {
      params.FilterExpression += params.FilterExpression
        ? ` OR contains (inte, :commId${i})`
        : `contains (inte, :commId${i})`;
      params.ExpressionAttributeValues[`:commId${i}`] = comm[i];
      // queryList.push(getQueryPromise(params));
    }
    console.log(`params comm: ${params}`);
  } else {
    params.ExpressionAttributeValues = {
      ":entity": `customer#${hbid}`,
    };
    console.log(params);
  }
  // Add the exclusive start key provided in the request if it exists
  if (token) {
    params.ExclusiveStartKey = token;
  }
  const customerList = await getResourceJSON(params, true);
  console.log("customerList: ", JSON.stringify(customerList));
  const filteredList = getLeadFilteredList(customerList.Items);
  return success({
    customers: filteredList,
    token: customerList.LastEvaluatedKey,
  });
};
/**
 * List customers API with pagination and sorting from Elasticsearch
 */
export const listCustomerElastic = async (data, isJSON = false) => {
  try {
    const {
      hb_id: hbId = "",
      from = 0,
      size = 5,
      sort = [],
      comm = [],
      grade = [],
      hlead = false,
      filterKey = "",
      searchKey = "",
      utype,
      after = [],
      newinte = []
    } = data;
    let customerSearchQuery = {};
    if (!comm.length && utype === "agent") {
      return success({
        customers: [],
        after: [],
        hasAfter: false,
        totalResults: 0,
      });
    }

    const customerListQuery = {
      httpMethod: "POST",
      requestPath: "/_search",
      payload: {
        query: {
          bool: {
            must: [
              {
                match: {
                  "entity.keyword": `customer#${hbId}`,
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
        size,
        from,
      },
    };
    
    if (filterKey === 'Sales Agent' && newinte.length) {
      customerListQuery.payload.query.bool.must.push({
        terms: {
          "newinte.keyword": newinte
        }
      })
    }

    // Add must_not field for hlead true. hlead true means hide customers
    // with the stages Lead and Dead_lead
    if (hlead) {
      customerListQuery.payload.query.bool.must_not = [
        {
          match: {
            "stage.keyword": "Lead",
          },
        },
        {
          match: {
            "stage.keyword": "Dead_Lead",
          },
        },
      ];
    }
    // Get search query if searchKey is provided
    if (searchKey && filterKey) {
      customerSearchQuery = getSearchQuery({
        filterKey,
        searchKey,
        type: "customer",
      });
      console.log(
        `customerSearchQuery: ${JSON.stringify(customerSearchQuery)}`
      );
      customerListQuery.payload.query.bool.must.push(customerSearchQuery);
    }
    // Add community filter if comm is provided
    if (
      (comm.length && utype !== "admin" && utype !== "online_agent") ||
      (comm.length && filterKey === "Community")
    ) {
      customerListQuery.payload.query.bool.must.push({
        terms: {
          "inte.keyword": comm,
        },
      });
    }

    // Add grade filter if grade is provided
    if (grade.length && filterKey === "Grade") {
      customerListQuery.payload.query.bool.must.push({
        bool: {
          should: grade.map(eachGrade => ({
            match: {
              "grade.keyword": eachGrade
            }
          }))
        }
      })
    };

    // Add sort field if supplied in the request
    if (sort.length) {
      customerListQuery.payload.sort = [];
      for (const sortField of sort) {
        // sortField = {"field": "email", "order": "asc/desc"}
        customerListQuery.payload.sort.push({
          [`${sortField.field}${sortField.field !== "cdt" && sortField.field !== "jdt" && sortField.field !== "mdt"
            ? ".keyword"
            : ""
            }`]: sortField.order,
        });
      }
      // Adding the id field as the tie-breaker field for sorting.
      customerListQuery.payload.sort.push({
        "id.keyword": "asc",
      });
    }
    // If after is provided and the from + size is greater than 10000, use the search_after parameter in the query.
    // This is done because of the index.max-result-window limit of 10000 set by Elasticsearch.
    if (from + size > 10000 && after.length) {
      customerListQuery.payload.search_after = after;
      // In this case we should set from as 0
      customerListQuery.payload.from = 0;
    }
    console.log(`customerListQuery: ${JSON.stringify(customerListQuery)}`);
    const customerList = await elasticExecuteQuery(customerListQuery, true);
    console.log(`customerList: ${JSON.stringify(customerList)}`);

    if (
      customerList &&
      customerList.statusCode === 200 &&
      customerList.body &&
      customerList.body.hits &&
      customerList.body.hits.hits
    ) {
      const { hits } = customerList.body.hits;
      const resultLength = hits.length;
      const totalResults = customerList.body.hits.total;
      console.log(`resultLength: ${resultLength}`);
      console.log(`totalResults: ${totalResults}`);
      const customers = resultLength
        ? hits.map((customer) => {
          const customerObj = {
            ...customer._source,
            _score: customer._score,
          };
          return customerObj;
        })
        : [];
      const afterNext =
        resultLength && sort.length ? [...hits[resultLength - 1].sort] : [];
      const hasAfter = from + size < totalResults;
      if (isJSON) {
        return { customers, after: afterNext, hasAfter, totalResults };
      }
      return success({ customers, after: afterNext, hasAfter, totalResults });
    }
    if (isJSON) {
      return customerList;
    }
    return failure(customerList);
  } catch (error) {
    console.log(`error`);
    console.log(error);
    if (isJSON) {
      return error;
    }
    return failure(error);
  }
};

export const getCustomer = (event) => {
  const params = getParamsForQuery(event, "customer");
  return getResources(params);
};
const updateCustomerRealtorOrStage = async (obj) => {
  const {
    oldr = "",
    olda = "",
    type = "",
    customerItem = {},
    params = {},
    propVal = "",
    hb_id: hbId = "",
    isRealtorUpdate = false,
    isFromRowUpdate = false,
    olds = "",
  } = obj;
  const customerUpdateArr = [];
  const stageName = isRealtorUpdate ? customerItem.stage : olds;
  const newAgencyId =
    isRealtorUpdate && propVal && propVal.rel_id ? propVal.rel_id : "";
  const isHf = obj && obj.isHf ? obj.isHf : false;
  // In the case of realtor update, If old agency id and new agency id are equal, then no need to delete the customer associated with the agency
  // In the case of any stage update, delete the customer resource associated to the agency by setting this to true
  const deleteCustomerUnderAgency = isRealtorUpdate
    ? olda !== newAgencyId
    : true;

  let cleanCustomerParams = null;
  // Delete the customer under the realtor, only if realtor is added to the customer
  // In the case of stage update, oldr refers to realtor id
  if (oldr) {
    console.log(`in oldr`);
    customerUpdateArr.push({
      Delete: {
        Key: {
          id: oldr,
          entity: `${type}#${hbId}#${stageName}#${customerItem.cdt}`,
        },
        TableName: process.env.entitiesTableName /* required */,
        ReturnValuesOnConditionCheckFailure: "ALL_OLD",
      },
    });
    if (deleteCustomerUnderAgency) {
      // Delete the customer under the agency, only if a realtor is already added to the customer
      // In the case of stage update, olda refers to agency id
      customerUpdateArr.push({
        Delete: {
          Key: {
            id: olda,
            entity: `customer#${hbId}#${stageName}#${customerItem.cdt}`,
          },
          TableName: process.env.entitiesTableName /* required */,
          ReturnValuesOnConditionCheckFailure: "ALL_OLD",
        },
      });

      // Clean the customer resource from other agencies if exists
      cleanCustomerParams = {
        TableName: process.env.entitiesTableName,
        IndexName: process.env.entitiesTableByEntityAndId,
        KeyConditionExpression: "#entity = :entity",
        ExpressionAttributeNames: {
          "#entity": "entity",
        },
        ExpressionAttributeValues: {
          ":entity": `customer#${hbId}#${stageName}#${customerItem.cdt}`,
        },
      };
      console.log(`cleanCustomerParams: ${cleanCustomerParams}`);
    }
  }
  // Now Create customer resource under the new realtor
  customerItem.data = customerItem.id;
  delete customerItem.id;
  delete customerItem.entity;
  const realtorCreateItem = {
    entity: `${type}#${hbId}#${customerItem.stage}#${customerItem.cdt}`,
    ...customerItem,
  };
  const agencyCreateItem = {
    entity: `${type}#${hbId}#${customerItem.stage}#${customerItem.cdt}`,
    ...customerItem,
  };
  if (isRealtorUpdate) {
    if (propVal.id) {
      // Don't do this step if the realtor is chosen as blank
      realtorCreateItem.id = propVal.id;
      agencyCreateItem.id = propVal.rel_id;
      customerUpdateArr.push({
        Put: {
          TableName: process.env.entitiesTableName /* required */,
          Item: realtorCreateItem,
          ReturnValuesOnConditionCheckFailure: "ALL_OLD",
        },
      });
      customerUpdateArr.push({
        Put: {
          TableName: process.env.entitiesTableName /* required */,
          Item: agencyCreateItem,
          ReturnValuesOnConditionCheckFailure: "ALL_OLD",
        },
      });
    }
    // Only do the customer update if it is not from homefront messaging
    if (!isHf) {
      // Update operation for Updating the rel_id of the customer
      customerUpdateArr.unshift({
        Update: params,
      });
    }
    const transArr = [...customerUpdateArr];
    const transParams = {
      TransactItems: transArr,
    };
    console.log(`transParams: ${JSON.stringify(transParams)}`);
    return transactWriteItems(transParams);
  }
  // During stage update, we can't do it in a single transaction. Because it doesn't
  // support multiple operations on the same item. Here Delete and Put on the Same Realtor and Agency
  // So we first execute the delete operations+(update customer) and then put operations
  // Update operation for Updating the rel_id of the customer
  if (isFromRowUpdate) {
    customerUpdateArr.unshift({
      Put: params,
    });
  } else {
    customerUpdateArr.unshift({
      Update: params,
    });
  }
  const transArr = [...customerUpdateArr];
  const transParams = {
    TransactItems: transArr,
  };
  console.log(`transParams: ${JSON.stringify(transParams)}`);
  // Updates the customer stage in the customer resource and
  // deletes the customer resource under the realtor and agency
  const deleteUpdateCustomer = await transactWriteItems(transParams);
  console.log(`deleteUpdateCustomer: ${JSON.stringify(deleteUpdateCustomer)}`);

  let createUnderRealtorAgency;
  // In case of stage update, oldr contains the realtor id and olda has the agency
  if (oldr) {
    realtorCreateItem.id = oldr;
    agencyCreateItem.id = olda;
    const createTransParam = {
      TransactItems: [
        {
          Put: {
            TableName: process.env.entitiesTableName /* required */,
            Item: realtorCreateItem,
            ReturnValuesOnConditionCheckFailure: "ALL_OLD",
          },
        },
        {
          Put: {
            TableName: process.env.entitiesTableName /* required */,
            Item: agencyCreateItem,
            ReturnValuesOnConditionCheckFailure: "ALL_OLD",
          },
        },
      ],
    };
    createUnderRealtorAgency = await transactWriteItems(createTransParam);
    console.log(
      `createUnderRealtorAgency: ${JSON.stringify(createUnderRealtorAgency)}`
    );
  }
  if (deleteUpdateCustomer.statusCode === 200) {
    if (cleanCustomerParams) {
      // Clean the customer resource from other agencies and realtors if exists
      const customerResourceList = await getResourceJSON(cleanCustomerParams);
      console.log(
        `customerResourceList: ${JSON.stringify(customerResourceList)}`
      );

      // Loop through each customer resource and add it to a transactwrite parameter array
      const cleanupTransactParamsArr = customerResourceList.map(
        (customerResource) => ({
          Delete: {
            Key: {
              id: customerResource.id,
              entity: customerResource.entity,
            },
            TableName: process.env.entitiesTableName /* required */,
            ReturnValuesOnConditionCheckFailure: "ALL_OLD",
          },
        })
      );
      console.log(
        `cleanupTransactParamsArr: ${JSON.stringify(cleanupTransactParamsArr)}`
      );
      // Perform the delete
      const cleanupTransactParams = {
        TransactItems: cleanupTransactParamsArr,
      };
      const deleteCustomerRes = await transactWriteItems(cleanupTransactParams);
      console.log(`deleteCustomerRes: ${JSON.stringify(deleteCustomerRes)}`);
    }
    return success({ status: true });
  }
  return failure({
    status: false,
    error: `${deleteUpdateCustomer} : ${createUnderRealtorAgency}`,
  });
};
const getCustomerDetails = async (hbid, id) => {
  const params = getParamsForQuery(
    {
      pathParameters: { id, hbid },
    },
    "customer"
  );
  return getResourceJSON(params);
  /* const params = {
        TableName: process.env.entitiesTableName,
        IndexName: process.env.entitiesTableByEntityAndId,
        KeyConditionExpression: "#entity = :entity",
        ExpressionAttributeNames: {
            "#entity": "entity",
            "#brixid": "brixid"
        },
        ExpressionAttributeValues: {
            ':entity': `customer#${hb_id}`,
            ':brixid': brixid
        },
        FilterExpression: '#brixid = :brixid'
    };
    console.log(`getCustomerDetails: ${params}`);
    return getResourceJSON(params); */
};
const getCustomerCobuyers = async (customerId, hbid) => {
  // Get all Cobuyers under the Customer
  const params = {
    TableName: process.env.entitiesTableName,
    KeyConditionExpression: "#id = :id and begins_with(#entity, :entity)",
    ExpressionAttributeNames: {
      "#id": "id",
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":id": customerId,
      ":entity": `cobuyer#${hbid}`,
    },
  };
  console.log(params);
  return getResourceJSON(params);
};
export const updateCustomer = async (data) => {
  const {
    id = "",
    attrn: propName = "",
    attrv: propVal = "",
    hb_id: hbId = "",
    oldr = "",
    olda = "",
    olds = "",
    customer: customerItem = {},
    realtor_id: realtorId = "",
    userid = "",
    isSns = false,
    isHf = false,
    stage = "",
    comm = []
  } = data;
  // const propVal =
  //   propName === "fav" ? data.attrv : data.attrv ? data.attrv : "";
  // const agencyId = data.agency_id ? data.agency_id : '';
  const agencyId = await getRealtorAgencyId(realtorId, hbId);
  const modDate = Date.now();
  const messagingEnabledStages = ["Prospect", "Buyer", "Bust_Out", "Closed"];
  const params = {
    TableName: process.env.entitiesTableName,
    Key: {
      id,
      entity: `customer#${hbId}`,
    },
    UpdateExpression: `set #propName = :pval, mdt = :modDate`,
    ExpressionAttributeNames: {
      "#propName": propName,
    },
    ExpressionAttributeValues: {
      ":pval": propVal,
      ":modDate": modDate,
    },
    ReturnValuesOnConditionCheckFailure: "ALL_OLD",
  };

  const customerDetails = await getCustomerDetails(hbId, id);
  console.log("customerDetails: ", customerDetails);
  const customerFname =
    customerDetails && customerDetails.length ? customerDetails[0].fname : "";
  const customerLname =
    customerDetails && customerDetails.length ? customerDetails[0].lname : "";
  if (propName === "fname") {
    params.UpdateExpression = `set #propName = :pval, mdt = :modDate, #fullname = :fullname`;
    params.ExpressionAttributeNames["#fullname"] = "fullname";
    params.ExpressionAttributeValues[
      ":fullname"
    ] = `${propVal} ${customerLname}`;
  }
  if (propName === "lname" && customerFname) {
    params.UpdateExpression = `set #propName = :pval, mdt = :modDate, #fullname = :fullname`;
    params.ExpressionAttributeNames["#fullname"] = "fullname";
    params.ExpressionAttributeValues[":fullname"] = `${customerFname} ${propVal || ""
      }`;
  }
  console.log(params);
  const customerStage =
    customerDetails && customerDetails.length ? customerDetails[0].stage : "";
  const customerInBRIX =
    customerDetails && customerDetails.length
      ? customerDetails[0].inbrix
      : false;
  let isStageOkay = false;
  let inbrixVal;
  let inbrixParam = {};
  if (propName !== "stage") {
    if (customerStage !== "Lead" && customerStage !== "Dead_Lead") {
      isStageOkay = true;
    } else {
      isStageOkay = false;
    }
    inbrixVal = customerInBRIX || false;
  } else {
    // Checking the status to be updated and deciding whether to send message or not
    // Also setting the inbrix value and updating it for the customer
    // Also Check whether the previous stage is messaging stage
    if (
      (propVal !== "Lead" && propVal !== "Dead_Lead") ||
      messagingEnabledStages.includes(customerStage)
    ) {
      isStageOkay = true;
    } else {
      isStageOkay = false;
    }
    inbrixVal = customerInBRIX || false;
    if (!inbrixVal) {
      inbrixParam = {
        TableName: process.env.entitiesTableName,
        Key: {
          id,
          entity: `customer#${hbId}`,
        },
        UpdateExpression: `set #propName = :pval, mdt = :modDate`,
        ExpressionAttributeNames: {
          "#propName": "inbrix",
        },
        ExpressionAttributeValues: {
          ":pval": !inbrixVal,
          ":modDate": modDate,
        },
        ReturnValuesOnConditionCheckFailure: "ALL_OLD",
      };
    } else {
      inbrixParam = false;
    }
    console.log("inbrixParam: ", inbrixParam);
  }
  console.log("isStageOkay: ", isStageOkay);
  console.log("inbrixVal: ", inbrixVal);
  let realtorUpdateResp;
  if (propName === "rltr") {
    // Realtor Update
    realtorUpdateResp = await updateCustomerRealtorOrStage({
      oldr,
      olda,
      olds,
      hb_id: hbId,
      type: "customer",
      customerItem,
      params,
      propVal,
      id,
      isRealtorUpdate: true,
    });
    // Create realtor change activity
    await createChangeActivity({
      userid,
      profileChange: `profile_${propName}`,
      stage: propVal?.fullname ?? "",
      oldst: customerDetails[0]?.rltr?.fullname ?? "",
      oldinte: [customerDetails[0]?.rltr?.id ?? ""],
      inte: [propVal?.id ?? ""],
      hbId,
      customerUUID: id
    })
  } else if (propName === "stage") {
    // Stage Update
    if (inbrixParam) {
      const inbrixUpdateResp = await updateResources(inbrixParam);
      console.log("inbrixUpdateResp: ", inbrixUpdateResp);
    }
    realtorUpdateResp = await updateCustomerRealtorOrStage({
      oldr: realtorId,
      olds,
      olda: agencyId,
      type: "customer",
      customerItem,
      params,
      propVal,
      id,
      hb_id: hbId,
      isRealtorUpdate: false,
    });
    // Create stage change activity
    console.log(`Before starting activity create`);
    await createChangeActivity({
      stage: propVal,
      oldst: customerStage,
      userid,
      customerUUID: id,
      hbId,
      isSns,
      isHf,
    });
    console.log(`After activity create`);
    // increment the goal count
    const increResp = await incrementGoalCount({
      hbId,
      stage: propVal,
      comm:
        customerDetails && customerDetails.length
          ? customerDetails[0].inte
          : [],
    });
    console.log(`increResp: ${JSON.stringify(increResp)}`);
  } else if (propName === "newinte") {
    realtorUpdateResp = await updateResources(params);
    const agentChangeActivity = {
      profileChange: `profile_sa`,
      oldinte: customerDetails[0].newinte ?? [],
      inte: [...propVal],
      customerUUID: id,
      userid,
      hbId
    }
    const changeResp = await createChangeActivity(agentChangeActivity);
    console.log("ActivityChangeResp :: ", changeResp);

    const allowNotif = !!((stage.toLowerCase() === "lead") && (propVal.length > (customerDetails[0].newinte?.length || 0)));
    console.log("allowNotif :: ", allowNotif);
    if (allowNotif) {
      console.log("Inside allowNotif :: ");
      let targetUserId = propVal[0];
      console.log("Default targetUserId :: ", targetUserId);
      if (customerDetails[0].newinte?.length) {
        const prevAgentSet = new Set(customerDetails[0].newinte);
        for(const val of propVal){
          if (!prevAgentSet.has(val)) {
            targetUserId = val;
            break;
          }
        }
        console.log("Modified targetUserId :: ", targetUserId);
      }
      const customerData = {
        fullname: customerDetails[0].fullname ?? `${customerDetails[0].fname} ${customerDetails[0].lname}`,
        rel_id: customerDetails[0].id,
        comm,
        crby: userid,
        stage,
        data: "false",
        type: "assign",
        gen_src: customerDetails[0].gen_src ?? ""
      };
      const notifParams = {
        action: "assignleads",
        httpMethod: "POST",
        arn: NOTIFICATION_LAMBDA_ARN,
        body: {hbId, customerData, userId: targetUserId}
      };
      await initLambdaInvoke(notifParams);
    }

  } else if (propName === "inte") {
    const m_id = await getMetroFromCommunity(propVal, hbId);
    params.UpdateExpression = `set #propName = :pval, mdt = :modDate, #m_id = :m_id`;
    params.ExpressionAttributeNames["#m_id"] = "m_id";
    params.ExpressionAttributeValues[":m_id"] = m_id;
    // Interest Update
    const cobuyerUpdateRespArr = [];
    // Update the inte for all the cobuyers
    const cobuyersUnderCustomer = await getCustomerCobuyers(id, hbId);
    if (cobuyersUnderCustomer && cobuyersUnderCustomer.length) {
      // Cobuyers exists
      for (const cobuyer of cobuyersUnderCustomer) {
        const cobuyerModDate = Date.now();
        const cobuyerParams = {
          TableName: process.env.entitiesTableName,
          Key: {
            id: cobuyer.id,
            entity: cobuyer.entity,
          },
          UpdateExpression: `set #propName = :pval, mdt = :modDate, #m_id = :m_id`,
          ExpressionAttributeNames: {
            "#propName": "inte",
            "#m_id": "m_id",
          },
          ExpressionAttributeValues: {
            ":pval": propVal,
            ":modDate": cobuyerModDate,
            ":m_id": m_id,
          },
          ReturnValuesOnConditionCheckFailure: "ALL_OLD",
        };
        console.log(cobuyerParams);
        cobuyerUpdateRespArr.push(await updateResources(cobuyerParams));
      }
    }
    realtorUpdateResp = await updateResources(params);
    const customerInte =
      customerDetails && customerDetails.length ? customerDetails[0].inte : [];
    // Create inte change activity
    await createChangeActivity({
      inte: propVal,
      oldinte: customerInte,
      userid,
      customerUUID: id,
      hbId,
      isSns,
      isHf,
      inteChange: true,
    });

    const oldInte =
      customerDetails && customerDetails.length ? customerDetails[0].inte : [];

    if (propVal.length > oldInte.length) {
      const uniqueArr = propVal.filter((item) => oldInte.indexOf(item) === -1);
      const increResp = await incrementGoalCount({
        hbId,
        stage:
          customerDetails && customerDetails.length
            ? customerDetails[0].stage
            : "",
        comm: uniqueArr,
      });
      console.log(`increResp: ${JSON.stringify(increResp)}`);
    }
  } else {
    realtorUpdateResp = await updateResources(params);
    if (propName !== "dt") {
      console.log(`propName !== "dt" .... true`);
      const activityParams = {
        profileChange: `profile_${propName}`,
        userid,
        customerUUID: id,
        hbId
      }
      if (propName === "infl") {
        activityParams.oldinte = [...customerDetails[0].infl];
        activityParams.inte = [...propVal];
      } else {
        activityParams.oldst = customerDetails[0][propName] ?? "";
        activityParams.stage = propVal;
      }
      await createChangeActivity(activityParams);
    }
  }
  if (isStageOkay) {
    console.log("isInStageOkay Update");
    let isCreate = false;
    if (inbrixVal) {
      isCreate = false;
    } else {
      isCreate = true;
    }
    console.log("isCreate: ", isCreate);
    if (STACK_PREFIX.includes("aws-crm") || STACK_PREFIX.includes("crm-test")) {
      // Brix message
      const publishCustomerDataResponse = await publishEntityData({
        entityId: id,
        isBrix: true,
        isCreate,
        messageId: uuidv4(),
      });
      console.log("publishCustomerDataResponse: ", publishCustomerDataResponse);

      // Homefront message
      const publishEntityDataHfResp = await publishEntityData({
        entityId: id,
        entityType: "customer",
        isBrix: false,
        isCreate: false,
        isHomefront: true,
        messageId: uuidv4(),
        HomebuilderID: hbId,
      });
      console.log("publishEntityDataHfResp: ", publishEntityDataHfResp);
    }
  }
  return realtorUpdateResp;
};
export const deleteCustomer = async (data) => {
  const {
    id = "",
    hb_id: hbId = "",
    realtor_id: realtorId = "",
    cdt = "",
    stage = "",
    agency_id: agencyId = "",
    isSns = false,
  } = data;
  const getDeleteEndpoint = await deleteEntityEndpoint(id, `customer#${hbId}`);
  console.log(`getDeleteEndpoint: ${JSON.stringify(getDeleteEndpoint)}`);

  // Get the customer details JSON for sending message to Homefront
  let hfhbid;
  let hfid;
  if (!isSns) {
    const entityGetParams = getHydrationParamsForQuery(
      id,
      `customer#${hbId}`,
      false,
      true
    );
    const entityDetail = await getResourceJSON(entityGetParams);
    console.log(`entityDetail: ${JSON.stringify(entityDetail)}`);
    if (entityDetail && entityDetail.length) {
      hfhbid = entityDetail[0]?.hfhbid ?? "";
      hfid = entityDetail[0]?.hfid ?? "";
      console.log(`hfhbid: ${hfhbid}`);
      console.log(`hfid: ${hfid}`);
    }
  }

  // Delete customer resource from realtor & agency
  const customerDeleteArr = [];
  customerDeleteArr.push({
    Delete: {
      Key: {
        id,
        entity: `customer#${hbId}`,
      },
      TableName: process.env.entitiesTableName /* required */,
      ReturnValuesOnConditionCheckFailure: "ALL_OLD",
    },
  });
  if (realtorId) {
    customerDeleteArr.push({
      Delete: {
        Key: {
          id: realtorId,
          entity: `customer#${hbId}#${stage}#${cdt}`,
        },
        TableName: process.env.entitiesTableName /* required */,
        ReturnValuesOnConditionCheckFailure: "ALL_OLD",
      },
    });
  }
  if (agencyId) {
    customerDeleteArr.push({
      Delete: {
        Key: {
          id: agencyId,
          entity: `customer#${hbId}#${stage}#${cdt}`,
        },
        TableName: process.env.entitiesTableName /* required */,
        ReturnValuesOnConditionCheckFailure: "ALL_OLD",
      },
    });
  }
  console.log(`customerDeleteArr: ${JSON.stringify(customerDeleteArr)}`);

  // Delete the cobuyers associated with the customer
  const cobuyers = await listCobuyers(
    { pathParameters: { id, hbid: hbId } },
    true
  );
  console.log(`cobuyers: ${JSON.stringify(cobuyers)}`);
  if (cobuyers?.length) {
    for (const cobuyer of cobuyers) {
      customerDeleteArr.push({
        Delete: {
          Key: {
            id,
            entity: cobuyer.entity,
          },
          TableName: process.env.entitiesTableName /* required */,
          ReturnValuesOnConditionCheckFailure: "ALL_OLD",
        },
      });
    }
  }

  // Delete the activities associated with the customer
  let activities = null;
  // const activities = await listActivities({ pathParameters: { id } }, true);
  // console.log(`activities: ${JSON.stringify(activities)}`);
  try {
    activities = await initLambdaInvoke({
      action: "listj",
      httpMethod: "GET",
      body: { rel_id: id, hbid: hbId },
      arn: ACTIVITY_LAMBDA_ARN,
    });
    console.log(`activities: ${JSON.stringify(activities)}`);
  } catch (error) {
    console.log("Exception list activity: ");
    console.log(error);
    activities = [];
  }
  if (activities?.length) {
    for (const activity of activities) {
      customerDeleteArr.push({
        Delete: {
          Key: {
            id,
            entity: activity.entity,
          },
          TableName: process.env.entitiesTableName /* required */,
          ReturnValuesOnConditionCheckFailure: "ALL_OLD",
        },
      });
    }
  }
  const transArr = [...customerDeleteArr];
  const transParams = {
    TransactItems: transArr,
  };
  const updateRealtorResp = await transactWriteItems(transParams);
  console.log(`updateRealtorResp: ${JSON.stringify(updateRealtorResp)}`);
  // Do a homefront publish if this call is not originated from messaging (isSns)
  if (
    !isSns &&
    (STACK_PREFIX.includes("aws-crm") || STACK_PREFIX.includes("crm-test"))
  ) {
    // Homefront message
    const publishEntityDataHfResp = await publishEntityData({
      entityId: id,
      entityType: "customer",
      isBrix: false,
      isCreate: false,
      isHomefront: true,
      isDelete: true,
      messageId: uuidv4(),
      HomebuilderID_HF: hfhbid,
      Id: hfid,
      HomebuilderID: hbId,
    });
    console.log("publishEntityDataHfResp: ", publishEntityDataHfResp);

    // Homefront message for deleting Cobuyers
    /* for (let cobuyer of cobuyers) {
            const publishEntityDataHfResp = await publishEntityData({ entityId: cobuyer.data, entityType: "cobuyer", isBrix: false, isCreate: false, isHomefront: true, isDelete: true, messageId: uuidv4(), HomebuilderID_HF: cobuyer?.hfhbid, Id: cobuyer?.hfid, OpportunityID: id, OpportunityID_Hyphen: hfid, HomebuilderID: hb_id });
            console.log('publishEntityDataHfResp: ', publishEntityDataHfResp);
        } */
    // Homefront message for deleting activities
    /* for (let activity of activities) {
            const publishEntityDataHfResp = await publishEntityData({ entityId: activity.data, entityType: "activity", isBrix: false, isCreate: false, isHomefront: true, isDelete: true, messageId: uuidv4(), HomebuilderID_HF: activity?.hfhbid, Id: activity?.hfid, OpportunityID: id, OpportunityID_Hyphen: hfid, HomebuilderID: hb_id });
            console.log('publishEntityDataHfResp: ', publishEntityDataHfResp);
        } */
  }
  return updateRealtorResp;
};
const customerAnalytics = async (data) => {
  try {
    const { hb_id: hbId = "", stage = "", rel_id: relId = "" } = data;
    const params = {
      TableName: process.env.entitiesTableName,
      ExpressionAttributeNames: {
        "#id": "id",
        "#entity": "entity",
      },
      ExpressionAttributeValues: {
        ":id": relId,
      },
    };
    // Last 30 days analytics Grouped By stage
    const currentDate = new Date();
    const currentDateMills = currentDate.getTime();
    currentDate.setDate(currentDate.getDate() - 30);
    const days30BeforeDateMills = currentDate.getTime();
    params.KeyConditionExpression =
      "#id = :id and #entity between :start AND :end";
    params.ExpressionAttributeValues[
      ":start"
    ] = `customer#${hbId}#${stage}#${days30BeforeDateMills}`;
    params.ExpressionAttributeValues[
      ":end"
    ] = `customer#${hbId}#${stage}#${currentDateMills}`;
    console.log(params);
    let analyticsLast30Data = await getResourceJSON(params);
    analyticsLast30Data = analyticsLast30Data.length;

    // Grouped by stage analytics
    params.KeyConditionExpression =
      "#id = :id and begins_with(#entity ,:entity)";
    params.ExpressionAttributeValues[":entity"] = `customer#${hbId}#${stage}`;
    delete params.ExpressionAttributeValues[":start"];
    delete params.ExpressionAttributeValues[":end"];
    console.log(params);
    let analyticsData = await getResourceJSON(params);
    analyticsData = analyticsData.length;
    return success({ last30: analyticsLast30Data, all: analyticsData });
  } catch (error) {
    return failure(error);
  }
};
const getStatsObj = (statsArr) => {
  const stats = statsArr.reduce((statObj, stat) => {
    statObj[stat.key] = stat.doc_count;
    return statObj;
  }, {});
  return stats;
};
const customerAnalyticsElastic = async (data) => {
  try {
    const { hb_id: hbId = "", rel_id: relId = "", agid: agencyId = "" } = data;
    let realtorAnalyticsAllTime;
    let realtorAnalyticsLast30;
    let agencyAnalyticsAllTime;
    let agencyAnalyticsLast30;
    let realtorAllTime;
    let realtorLast30;
    let agencyAllTime;
    let agencyLast30;

    // For realtor analytics
    if (relId) {
      const realtorQuery = {
        httpMethod: "POST",
        requestPath: "/_search",
        payload: {
          query: {
            bool: {
              must: [
                {
                  match: {
                    "rltr.data.keyword": relId,
                  },
                },
                {
                  match: {
                    "entity.keyword": `customer#${hbId}`,
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
          aggs: {
            stage_counts: {
              terms: {
                field: "stage.keyword",
                size: 6,
              },
            },
          },
          size: 0,
        },
      };
      console.log(`realtorQuery: ${JSON.stringify(realtorQuery)}`);
      realtorAnalyticsAllTime = await elasticExecuteQuery(realtorQuery);
      console.log(
        `realtorAnalyticsAllTime: ${JSON.stringify(realtorAnalyticsAllTime)}`
      );
      const realtorAllTimeBody = JSON.parse(
        realtorAnalyticsAllTime.body ? realtorAnalyticsAllTime.body : {}
      );
      realtorAllTime =
        realtorAllTimeBody.body &&
          realtorAllTimeBody.body.aggregations &&
          realtorAllTimeBody.body.aggregations &&
          realtorAllTimeBody.body.aggregations.stage_counts &&
          realtorAllTimeBody.body.aggregations.stage_counts.buckets
          ? realtorAllTimeBody.body.aggregations.stage_counts.buckets
          : [];
      realtorAllTime = getStatsObj([...realtorAllTime]);

      // Last 30 days analytics Grouped By stage
      const currentDate = new Date();
      const currentDateMills = currentDate.getTime();
      currentDate.setDate(currentDate.getDate() - 30);
      const days30BeforeDateMills = currentDate.getTime();
      // Adding a creation date range
      realtorQuery.payload.query.bool.must.push({
        range: {
          cdt: {
            gte: days30BeforeDateMills,
            lte: currentDateMills,
          },
        },
      });
      console.log(`realtorQuery: ${JSON.stringify(realtorQuery)}`);
      realtorAnalyticsLast30 = await elasticExecuteQuery(realtorQuery);
      console.log(
        `realtorAnalyticsLast30: ${JSON.stringify(realtorAnalyticsLast30)}`
      );
      const realtorLast30Body = JSON.parse(
        realtorAnalyticsLast30.body ? realtorAnalyticsLast30.body : {}
      );
      realtorLast30 =
        realtorLast30Body.body &&
          realtorLast30Body.body.aggregations &&
          realtorLast30Body.body.aggregations &&
          realtorLast30Body.body.aggregations.stage_counts &&
          realtorLast30Body.body.aggregations.stage_counts.buckets
          ? realtorLast30Body.body.aggregations.stage_counts.buckets
          : [];
      realtorLast30 = getStatsObj([...realtorLast30]);
    }
    if (agencyId) {
      // Get all the realtors under the agency
      /* const agencyRealtorQuery = {
        httpMethod: "POST",
        requestPath: "/_search",
        payload: {
          _source: ["id"],
          query: {
            bool: {
              must: [
                {
                  match: {
                    rel_id: agencyId,
                  },
                },
                {
                  match: {
                    "entity.keyword": `realtor#${hbId}`,
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
        },
      };
      console.log(`agencyRealtorQuery: ${JSON.stringify(agencyRealtorQuery)}`);
      const agencyRealtorResp = await elasticExecuteQuery(agencyRealtorQuery);
      console.log(`agencyRealtorResp: ${JSON.stringify(agencyRealtorResp)}`);
      const agencyRealtorBody = agencyRealtorResp.body
        ? JSON.parse(agencyRealtorResp.body)
        : {};
      console.log(`agencyRealtorBody: ${JSON.stringify(agencyRealtorBody)}`);
      const realtorIds = (
        agencyRealtorBody.body &&
        agencyRealtorBody.body.hits &&
        agencyRealtorBody.body.hits.hits
          ? agencyRealtorBody.body.hits.hits
          : []
      ).map((realtor) =>
        realtor._source && realtor._source.id ? realtor._source.id : ""
      );
      console.log(`realtorIds: ${JSON.stringify(realtorIds)}`);
      const realtorIdMatchArr = realtorIds.map((realtorId) => ({
        match: {
          "rltr.data.keyword": realtorId,
        },
      }));
      console.log(`realtorIdMatchArr: ${JSON.stringify(realtorIdMatchArr)}`); */
      // Get the customers with agency id
      const agencyQuery = {
        httpMethod: "POST",
        requestPath: "/_search",
        payload: {
          query: {
            bool: {
              must: [
                {
                  match: {
                    "rltr.rel_id.keyword": agencyId,
                  },
                },
                {
                  match: {
                    "entity.keyword": `customer#${hbId}`,
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
          aggs: {
            stage_counts: {
              terms: {
                field: "stage.keyword",
                size: 6,
              },
            },
          },
          size: 0,
        },
      };
      console.log(`agencyQuery: ${JSON.stringify(agencyQuery)}`);
      agencyAnalyticsAllTime = await elasticExecuteQuery(agencyQuery);
      console.log(
        `agencyAnalyticsAllTime: ${JSON.stringify(agencyAnalyticsAllTime)}`
      );

      const agencyAllTimeBody = JSON.parse(
        agencyAnalyticsAllTime.body ? agencyAnalyticsAllTime.body : {}
      );
      agencyAllTime =
        agencyAllTimeBody.body &&
          agencyAllTimeBody.body.aggregations &&
          agencyAllTimeBody.body.aggregations &&
          agencyAllTimeBody.body.aggregations.stage_counts &&
          agencyAllTimeBody.body.aggregations.stage_counts.buckets
          ? agencyAllTimeBody.body.aggregations.stage_counts.buckets
          : [];
      agencyAllTime = getStatsObj([...agencyAllTime]);

      // Last 30 days analytics Grouped By stage
      const currentDate = new Date();
      const currentDateMills = currentDate.getTime();
      currentDate.setDate(currentDate.getDate() - 30);
      const days30BeforeDateMills = currentDate.getTime();
      // Adding a creation date range
      agencyQuery.payload.query.bool.must.push({
        range: {
          cdt: {
            gte: days30BeforeDateMills,
            lte: currentDateMills,
          },
        },
      });
      console.log(`agencyQuery: ${JSON.stringify(agencyQuery)}`);
      agencyAnalyticsLast30 = await elasticExecuteQuery(agencyQuery);
      console.log(
        `agencyAnalyticsLast30: ${JSON.stringify(agencyAnalyticsLast30)}`
      );

      const agencyLast30Body = JSON.parse(
        agencyAnalyticsLast30.body ? agencyAnalyticsLast30.body : {}
      );
      agencyLast30 =
        agencyLast30Body.body &&
          agencyLast30Body.body.aggregations &&
          agencyLast30Body.body.aggregations &&
          agencyLast30Body.body.aggregations.stage_counts &&
          agencyLast30Body.body.aggregations.stage_counts.buckets
          ? agencyLast30Body.body.aggregations.stage_counts.buckets
          : [];
      agencyLast30 = getStatsObj([...agencyLast30]);
    }
    return success({
      realtorAllTime,
      realtorLast30,
      agencyAllTime,
      agencyLast30,
    });
  } catch (error) {
    return failure(error);
  }
};
const updateCustomerRow = async (data) => {
  console.log("data: ", data);
  const { id, isHf = false } = data;
  if (id) {
    const params = {
      TableName: process.env.entitiesTableName,
      Item: {
        type: data.type,
        hb_id: data.hb_id,
        fname: data.fname,
        lname: data.lname,
        fullname: `${data.fname} ${data.lname || ""}`,
        email: data.email,
        stage: data.stage,
        appid: data.appid,
        // crby: data.crby,
        phone: data.phone,
        psrc: data.psrc,
        cntm: data.cntm,
        grade: data.grade,
        desf: data.desf,
        brixid: data.brixid,
        brixappid: data.brixappid,
        brixprojno: data.brixprojno,
        brixclientid: data.brixclientid,
        entity: `customer#${data.hb_id}`,
        inte: data.inte,
        id,
        // gen_src: "",
      },
    };
    // if (data?.isSns) {
    //   if (isHf) params.Item.gen_src = "msg_hf";
    //   else params.Item.gen_src = "msg_brix";
    // } else {
    //   params.Item.gen_src = "app";
    // }
    if (data?.hfhbid) {
      params.Item.hfhbid = data.hfhbid;
    }
    if (data?.hfid) {
      params.Item.hfid = data.hfid;
    }
    if (data?.rltr) {
      params.Item.rltr = data.rltr;
    }
    if (data?.isSns) {
      params.Item.isSns = data.isSns;
    }
    if (data?.desm) {
      params.Item.desm = data.desm;
    }

    // Get the Customer Details
    const customerDetails = await getCustomerDetails(data.hb_id, id);
    console.log("customerDetails: ", customerDetails);
    let customerId;
    if (customerDetails && customerDetails.length) {
      customerId = customerDetails[0].id;
    } else if (isHf) customerId = id;
    else customerId = "";
    const currentDate = Date.now();
    if (customerId) {
      const customerStage =
        customerDetails && customerDetails.length
          ? customerDetails[0].stage
          : "";
      const customerInte =
        customerDetails && customerDetails.length
          ? customerDetails[0].inte
          : [];
      const realtorId =
        customerDetails && customerDetails.length
          ? customerDetails[0].rel_id || customerDetails[0]?.rltr?.data
          : "";
      let cdt;
      if (customerDetails && customerDetails.length) {
        cdt = customerDetails[0].cdt;
      } else if (isHf) cdt = currentDate;
      else cdt = "";
      let jdt;
      if (customerDetails && customerDetails.length) {
        jdt = customerDetails[0].jdt;
      } else if (isHf) jdt = currentDate;
      else jdt = "";
      const ref =
        customerDetails && customerDetails.length ? customerDetails[0].ref : "";

      const agencyId = realtorId
        ? await getRealtorAgencyId(realtorId, data.hb_id)
        : "";
      // Merge the existing customer data with the request obj
      if (customerDetails && customerDetails.length)
        params.Item = { ...customerDetails[0], ...params.Item };
      params.Item.id = customerId;
      params.Item.cdt = cdt;
      params.Item.mdt = currentDate;
      params.Item.jdt = jdt;
      if (ref) {
        params.Item.ref = ref;
      }
      console.log("params: ", params);
      const customerItem = { ...params.Item };
      const dynamicRequiredFieldData = await getDynamicRequiredFields({ pathParameters: { id: data.hb_id, type: "customer" } }, true);
      console.log(`dynamicRequiredFieldData: ${JSON.stringify(dynamicRequiredFieldData)}`);
      const customerRequiredFields = dynamicRequiredFieldData?.data[0]?.required_fields || {};
      const retVal = validateFields("customer", customerItem, false, customerRequiredFields);
      console.log("retVal: ", retVal);
      if (retVal === "") {
        // Check for data type for the array/object fields
        if (!isCorrectFieldType(customerItem)) {
          return failure({ status: false, error: "Field Type Error" });
        }
        delete customerItem?.isSns;
        // Check whether the realtorId is empty. If not empty,
        // verify whether the id data.rltr.data is equal to realtorId
        // If it is not equal, that means the realtor id of the customer has changed
        // In that case, do the necessary steps
        if (data?.rltr?.data && realtorId && realtorId !== data.rltr.data) {
          // Realtor Update
          const customerRealtorChange = await updateCustomerRealtorOrStage({
            oldr: realtorId,
            olda: agencyId,
            olds: "",
            hb_id: data.hb_id,
            type: "customer",
            customerItem,
            params,
            propVal: data.rltr,
            id,
            isRealtorUpdate: true,
            isFromRowUpdate: true,
            isHf,
          });
          console.log(
            `customerRealtorChange: ${JSON.stringify(customerRealtorChange)}`
          );
        }

        // Update the Customer Stage if stage is different
        if (customerStage && customerStage !== data.stage) {
          // Change the stage value in params.Item
          params.Item.stage = data.stage;
          const updateCustomerWithStage = await updateCustomerRealtorOrStage({
            oldr: realtorId,
            olds: customerStage,
            olda: agencyId,
            type: "customer",
            customerItem,
            params,
            propVal: data.stage,
            id: customerId,
            hb_id: data.hb_id,
            isRealtorUpdate: false,
            isFromRowUpdate: true,
          });
          console.log("updateCustomerWithStage: ", updateCustomerWithStage);
          // Create stage change activity
          await createChangeActivity({
            stage: data.stage,
            oldst: customerStage,
            userid: data.userid,
            customerUUID: id,
            hbId: data.hb_id,
          });

          // increment the goal count
          const increResp = await incrementGoalCount({
            hbId: data.hb_id,
            stage: data.stage,
            comm: data.inte,
          });
          console.log(`increResp: ${JSON.stringify(increResp)}`);

          // return updateCustomerWithStage;
        }
        const changedInterests = utils.findArraySymmetricDifference(
          data.inte,
          customerInte
        );
        console.log(`changedInterests: ${JSON.stringify(changedInterests)}`);

        if (changedInterests.diff.length) {
          const m_id = await getMetroFromCommunity(data.inte, data.hb_id);
          console.log("m_id ", m_id);
          params.Item.m_id = m_id;

          await createChangeActivity({
            inte: data.inte,
            oldinte: customerInte,
            userid: data.userid,
            customerUUID: id,
            hbId: data.hb_id,
            inteChange: true,
          });

          if (changedInterests.added.length) {
            const increResp = await incrementGoalCount({
              hbId: data.hb_id,
              stage: data.stage,
              comm: changedInterests.added,
            });
            console.log(`increResp: ${JSON.stringify(increResp)}`);
          }

          // Update the metro for all the cobuyers
          const cobuyerUpdateRespArr = [];

          const cobuyersUnderCustomer = await getCustomerCobuyers(
            id,
            data.hb_id
          );

          if (cobuyersUnderCustomer && cobuyersUnderCustomer.length) {
            // Cobuyers exists
            for (const cobuyer of cobuyersUnderCustomer) {
              const cobuyerModDate = Date.now();
              const cobuyerParams = {
                TableName: process.env.entitiesTableName,
                Key: {
                  id: cobuyer.id,
                  entity: cobuyer.entity,
                },
                UpdateExpression: `set #inte = :inte, mdt = :modDate, #m_id = :m_id`,
                ExpressionAttributeNames: {
                  "#inte": "inte",
                  "#m_id": "m_id",
                },
                ExpressionAttributeValues: {
                  ":inte": data.inte,
                  ":modDate": cobuyerModDate,
                  ":m_id": m_id,
                },
                ReturnValuesOnConditionCheckFailure: "ALL_OLD",
              };
              console.log(cobuyerParams);
              cobuyerUpdateRespArr.push(await updateResources(cobuyerParams));
            }
          }
        }
        return postResources(params);
      }
      return failure({
        status: false,
        error: { msg: "Validation failed", field: retVal },
      });
    }
    return badRequest({ status: false, error: `Customer doesn't exist.` });
  }
  return badRequest({ status: false, error: `id field is invalid.` });
};
const updateCustomerDesf = async () => {
  try {
    // Get all the builders for getting the builder ids
    const buildersList = await getEntities("builder");
    console.log(`buildersList: ${JSON.stringify(buildersList)}`);

    if (buildersList && buildersList.length) {
      // Get all the customers under each builders
      const params = {
        TableName: process.env.entitiesTableName,
        IndexName: process.env.entitiesTableByEntityAndId,
        KeyConditionExpression: "#entity = :entity",
        ExpressionAttributeNames: {
          "#entity": "entity",
        },
      };
      const queryList = [];
      for (const builder of buildersList) {
        params.ExpressionAttributeValues = {
          ":entity": `customer#${builder.id}`,
        };
        queryList.push(getQueryPromise(params));
      }
      const customersList = await Promise.all(queryList);
      console.log(`customersList: ${JSON.stringify(customersList)}`);
      if (customersList && customersList.length) {
        const customers = [];
        for (const resp of customersList) {
          customers.push(...resp.Items);
        }

        // Check for customers with old desf data. Update their desf to []
        const desfUpdatedCustomers = customers
          .filter((customer) => customer.desf && customer.desf.length)
          .map((customer) => {
            // Take backup of desf to olddesf field
            customer.olddesf = [...customer.desf];
            customer.desf = [];
            return customer;
          });
        if (desfUpdatedCustomers && desfUpdatedCustomers.length) {
          // Update the customer resources to the DB
          const updateParams = {
            TableName: process.env.entitiesTableName,
            Item: {},
          };
          // return postResources(updateParams);
          const putList = [];
          for (const desfUpdateCustomer of desfUpdatedCustomers) {
            updateParams.Item = desfUpdateCustomer;
            updateParams.Item.mdt = Date.now();
            putList.push(postQueryPromise(updateParams));
          }
          const updateCustomerResp = await Promise.all(putList);
          console.log(
            `updateCustomerResp: ${JSON.stringify(updateCustomerResp)}`
          );
          return success({ status: true, data: "Updated successfully" });
        }
        return success({
          status: true,
          data: "No customers to update with invalid desf",
        });
      }
      return success({ status: true, data: "No customers found" });
    }
    return success({ status: true, data: "No builders found" });
  } catch (error) {
    return failure({ status: false, error });
  }
};
const getInterestsForProjNo = async (proj, hbid) => {
  const gcbpParams = { hbid, proj };
  console.log(gcbpParams);
  const interestDetails = await getCommunityBasedOnProjNo(gcbpParams);
  console.info("interestDetails: ", interestDetails);
  const interestArr = interestDetails.map((interestResp) =>
    interestResp.Items && interestResp.Items.length ? interestResp.Items[0] : {}
  );
  // const interestArr = interestArrResp && interestArrResp.length && interestArrResp[0].Items ? interestArrResp[0].Items : [];
  return interestArr;
};
const updateCustomerInteWithCommNumber = async () => {
  try {
    // Get all the builders for getting the builder id
    const buildersList = await getEntities("builder");
    console.log(`buildersList: ${JSON.stringify(buildersList)}`);

    if (buildersList && buildersList.length) {
      // Get all the customers under each builders
      const params = {
        TableName: process.env.entitiesTableName,
        IndexName: process.env.entitiesTableByEntityAndId,
        KeyConditionExpression: "#entity = :entity",
        ExpressionAttributeNames: {
          "#entity": "entity",
        },
      };
      const queryList = [];
      for (const builder of buildersList) {
        params.ExpressionAttributeValues = {
          ":entity": `customer#${builder.id}`,
        };
        queryList.push(getQueryPromise(params));
      }
      const customersList = await Promise.all(queryList);
      console.log(`customersList: ${JSON.stringify(customersList)}`);
      if (customersList && customersList.length) {
        let customers = [];
        for (const resp of customersList) {
          customers.push(...resp.Items);
        }
        // Filter out customers with no commNumber field
        customers = customers.filter(
          (customer) => customer.commNumber && customer.commNumber.length
        );
        // Create an object with commNumber values for each home builder
        const commNumbers = customers.reduce((commIds, customer) => {
          if (customer && customer.commNumber && customer.commNumber.length) {
            if (!commIds[customer.hb_id]) {
              commIds[customer.hb_id] = [];
            }
            commIds[customer.hb_id] = [
              ...commIds[customer.hb_id],
              ...customer.commNumber,
            ];
          }
          return commIds;
        }, {});
        console.info("commNumbers: ", JSON.stringify(commNumbers));
        // Get community ids for each builder's commNumbers
        let interestObj = {};
        for (const hbId in commNumbers) {
          if (hbId) {
            console.log(`hbId: ${hbId}`);
            // Get the interests based on community number
            const interestArrResp = await getInterestsForProjNo(
              [...new Set(commNumbers[hbId])],
              hbId
            );
            console.info("interestArrResp: ", JSON.stringify(interestArrResp));
            interestObj = interestArrResp.reduce((hbidCommIdObj, community) => {
              if (community.hb_id && !hbidCommIdObj[community.hb_id]) {
                hbidCommIdObj[community.hb_id] = {};
              }
              if (community.id && community.hb_id && community.pjct_no) {
                hbidCommIdObj[community.hb_id][community.pjct_no] =
                  community.id;
              }
              return hbidCommIdObj;
            }, interestObj);
            console.info("interestObj: ", JSON.stringify(interestObj));
          }
        }
        console.info("interestObj final: ", JSON.stringify(interestObj));
        console.log(`before customers.map: ${JSON.stringify(customers)}`);
        // Check for customers with commNumber field
        const commNumberCustomers = customers
          .map((commNumberCustomer) => {
            console.log(`in customers.map`);
            // If the inte field is missing add it and initialize with empty array
            if (!commNumberCustomer.inte) {
              commNumberCustomer.inte = [];
            }
            console.log(`before doUpdate false`);
            commNumberCustomer.doUpdate = false;
            // Check whether the commNumberCustomer.inte has all the community ids in interestObj[commNumberCustomer.hb_id]
            // If not, push them to inte and update those customers
            const interestArr = commNumberCustomer.commNumber.reduce(
              (arr, commNumber) => {
                console.log(`arr: ${JSON.stringify(arr)}`);
                console.log(`commNumber: ${JSON.stringify(commNumber)}`);
                console.log(
                  `interestObj[commNumberCustomer.hb_id][commNumber]: ${interestObj[commNumberCustomer.hb_id][commNumber]
                  }`
                );
                arr.push(interestObj[commNumberCustomer.hb_id][commNumber]);
                return arr;
              },
              []
            );
            console.log(`interestArr: ${JSON.stringify(interestArr)}`);
            console.log(
              `commNumberCustomer.inte: ${JSON.stringify(
                commNumberCustomer.inte
              )}`
            );
            if (commNumberCustomer.inte.length !== interestArr.length) {
              // Array lengths are different. So do a merge and update the customer
              // Add the interestId to the currentCustomer
              commNumberCustomer.inte = [
                ...new Set([...commNumberCustomer.inte, ...interestArr]),
              ];
              commNumberCustomer.doUpdate = true;
            } else {
              // Check whether commNumberCustomer.inte contains all the elements from the interestArr
              // If not, add them. Else don't update the customer.
              for (let i = 0; i < interestArr.length; i += 1) {
                if (!commNumberCustomer.inte.includes(interestArr[i])) {
                  commNumberCustomer.inte = [
                    ...new Set([...commNumberCustomer.inte, ...interestArr]),
                  ];
                  commNumberCustomer.doUpdate = true;
                  break;
                }
              }
            }
            return commNumberCustomer;
          })
          .filter((toUpdateCustomer) => toUpdateCustomer.doUpdate)
          .map((customerData) => {
            delete customerData.doUpdate;
            return customerData;
          });
        console.log(
          `commNumberCustomers: ${JSON.stringify(commNumberCustomers)}`
        );
        console.log(
          `commNumberCustomers.length: ${commNumberCustomers.length}`
        );
        if (commNumberCustomers && commNumberCustomers.length) {
          // Only do the update if "doUpdate" is true
          // Update the customer resources to the DB
          const updateParams = {
            TableName: process.env.entitiesTableName,
            Item: {},
          };
          // return postResources(updateParams);
          const putList = [];
          for (const commNumberCustomer of commNumberCustomers) {
            updateParams.Item = commNumberCustomer;
            updateParams.Item.mdt = Date.now();
            putList.push(postQueryPromise(updateParams));
          }
          const updateCustomerResp = await Promise.all(putList);
          console.log(
            `updateCustomerResp: ${JSON.stringify(updateCustomerResp)}`
          );
          return success({ status: true, data: "Updated successfully" });
        }
        return success({
          status: true,
          data: "No customers to update with invalid desf",
        });
      }
      return success({ status: true, data: "No customers found" });
    }
    return success({ status: true, data: "No builders found" });
  } catch (error) {
    return failure({ status: false, error });
  }
};

const cleanupData = async (data) => {
  const {
    type = "",
    doDelete = false,
    hb_id: hbId = "",
    purpose = "",
    oldAgencyId = "",
    newAgencyId = "",
    campId = "",
  } = data;
  if (purpose) {
    const input = JSON.stringify({
      type,
      doDelete,
      hb_id: hbId,
      purpose,
      oldAgencyId,
      newAgencyId,
      skipToFetchRealtor: false,
      campId,
    });
    const params = {
      input,
      stateMachineArn: CLEANUP_MACHINE_ARN,
    };
    try {
      console.log(`params: ${JSON.stringify(params)}`);
      const startExecutionResp = await sfn.startExecution(params).promise();
      console.log(`startExecutionResp: ${JSON.stringify(startExecutionResp)}`);
      return success({ status: true });
    } catch (error) {
      console.log(`error`);
      console.log(error);
      return failure({ status: false, error });
    }
  } else {
    return badRequest({
      status: false,
      error: "Please provide a valid entity type",
    });
  }
};

const exportCustomerData = async (data) => {
  const { hb_id: hbId } = data;
  const input = JSON.stringify({
    hbId,
    purpose: "exportCustomer",
  });
  const params = {
    input,
    stateMachineArn: DATA_MIGRAION_MACHINE_ARN,
  };
  try {
    console.log(`params: ${JSON.stringify(params)}`);
    const startExecutionResp = await sfn.startExecution(params).promise();
    console.log(`startExecutionResp: ${JSON.stringify(startExecutionResp)}`);
    return success({ status: true });
  } catch (error) {
    console.log(`error`);
    console.log(error);
    return failure({ status: false, error });
  }
};

const getExportStatus = async (data) => {
  console.log(`data: ${JSON.stringify(data)}`);
  const { hb_id: hbid = "" } = data;
  try {
    if (!hbid) {
      return badRequest({ status: false, error: "Home builder Id is missing" });
    }

    const exportStatusResp = await getRecordByEntity(
      `customer_export_status#${hbid}`
    );
    console.log(`exportStatusResp: ${JSON.stringify(exportStatusResp)}`);
    return success(exportStatusResp);
  } catch (error) {
    return failure({ status: false, error });
  }
};

const listCustomersPaginated = async ({
  hbId = "",
  ExclusiveStartKey = null,
  Limit = 500,
}) => {
  let customerResponse;
  try {
    const params = {
      TableName: process.env.entitiesTableName,
      IndexName: process.env.entitiesTableByEntityAndId,
      KeyConditionExpression: "#entity = :entity",
      ExpressionAttributeNames: {
        "#entity": `entity`,
      },
      ExpressionAttributeValues: {
        ":entity": `customer#${hbId}`,
      },
      ExclusiveStartKey,
      Limit,
    };
    // return doPaginatedQueryDB({ params });
    const response = await getResourceJSON(params, true);
    console.log("response: ", JSON.stringify(response));
    let hasAfter = false;
    let nextKey = null;
    // If LastEvaluatedKey is empty or not defined then set hasAfter to false
    if (!response.LastEvaluatedKey) {
      hasAfter = false;
    } else {
      hasAfter = true;
      nextKey = response.LastEvaluatedKey;
    }
    customerResponse = {
      hasAfter,
      ExclusiveStartKey: nextKey,
      customers: response.Items,
    };
    console.log(`customerResponse: ${JSON.stringify(customerResponse)}`);
  } catch (error) {
    console.log("Exception occured at listCustomerPagination customer.js");
    console.log(error);
  }
  return customerResponse;
};

const getBatchGetParams = (data = []) => {
  let keys = [];
  const params = {
    RequestItems: {
      /* required */
      [process.env.entitiesTableName]: {
        Keys: [],
      },
    },
  };
  for (const item of data) {
    keys.push({
      id: item.comm_id,
      entity: `community#${item.hb_id}`,
    });
    if (item.customer_id) {
      keys.push({
        id: item.customer_id,
        entity: `customer#${item.hb_id}`,
      });
    }
    if (item.lot_id) {
      keys.push({
        id: item.lot_id,
        entity: `lot#${item.hb_id}`,
      });
    }
    if (item.plan_id) {
      keys.push({
        id: item.plan_id,
        entity: `plan#${item.hb_id}`,
      });
    }
  }

  keys = keys.filter(
    (value, index, self) =>
      index ===
      self.findIndex((t) => t.id === value.id && t.entity === value.entity)
  );

  params.RequestItems[process.env.entitiesTableName].Keys = keys;
  console.log("batchGet: ", JSON.stringify(params));
  return params;
};

const validatePropIntData = async (data, isUpdate) => {
  const propIntStatusEnum = ["Quote", "Committed", "Approved", "Closed"];
  try {
    const {
      comm_id,
      lot_id = "",
      plan_id = "",
      hb_id,
      customer_id,
      id,
      entity,
      cdt,
      sts,
      data: PropIntUUID = "",
    } = data;
    if (!hb_id) return { status: false, error: "Home Builder ID Required" };
    if (!comm_id) return { status: false, error: "Community is Required" };
    if (!sts) return { status: false, error: "Status is Required" };
    if (!propIntStatusEnum.includes(sts))
      return { status: false, error: "Invalid Status" };
    if (!lot_id && !plan_id)
      return {
        status: false,
        error: "A Property Interest must contain either a Lot or a Plan.",
      };
    if (isUpdate) {
      if (!id) return { status: false, error: "ID Required" };
      if (!entity) return { status: false, error: "Entity Required" };
      if (!cdt) return { status: false, error: "Created Date Required" };
      if (!PropIntUUID) return { status: false, error: "Data feild Required" };
    } else {
      // eslint-disable-next-line no-lonely-if
      if (!customer_id) return { status: false, error: "Customer is Required" };
    }
    const params = getBatchGetParams([data]);
    const batchGetResp = await batchGetResources(params, true);
    console.log("batchGetResp: ", JSON.stringify(batchGetResp));
    const batchGetRespBody =
      batchGetResp && batchGetResp.statusCode === 200 && batchGetResp.body
        ? JSON.parse(batchGetResp.body)
        : [];
    console.log("batchGetRespBody: ", JSON.stringify(batchGetRespBody));
    const idArr = batchGetRespBody.reduce((acc, crr, index) => {
      acc[index] = crr.id;
      return acc;
    }, []);
    if (!idArr.includes(comm_id))
      return { status: false, error: "Invalid Community" };
    if (customer_id && !idArr.includes(customer_id))
      return { status: false, error: "Invalid Customer" };
    if (plan_id && !idArr.includes(plan_id))
      return { status: false, error: "Invalid Plan" };
    if (lot_id && !idArr.includes(lot_id))
      return { status: false, error: "Invalid Lot" };

    return { status: true };
  } catch (error) {
    return { status: false, error: error.message };
  }
};

const createPropertyInterest = async (data) => {
  try {
    const {
      comm_id,
      lot_id = "",
      plan_id = "",
      hb_id,
      customer_id,
      note,
      sts,
    } = data;

    const isValid = await validatePropIntData(data, false);
    if (!isValid.status)
      return failure({ status: false, error: isValid.error });

    const currentDate = Date.now();

    const propIntItem = {
      type: "propInt",
      hb_id,
      cdt: currentDate,
      mdt: currentDate,
      comm_id,
      lot_id,
      plan_id,
      note,
      sts,
    };

    const propIntUUID = uuidv4();

    const propIntCreateItem = {
      TableName: process.env.entitiesTableName,
      Item: {
        id: customer_id,
        entity: `propInt#${hb_id}#${propIntUUID}`,
        data: propIntUUID,
        ...propIntItem,
      },
    };

    console.log("propIntCreateItem", propIntCreateItem);

    const resp = await postResources(propIntCreateItem, true);
    resp.item.cdt = currentDate;
    resp.item.data = propIntUUID;
    return success(resp);
  } catch (error) {
    console.log(
      "error in createPropertyInterest",
      JSON.stringify(error.stacks)
    );
    return failure({ status: false, error: error.message });
  }
};

const updatePropertyInterest = async (data) => {
  try {
    const isValid = await validatePropIntData(data, true);
    if (!isValid.status)
      return failure({ status: false, error: isValid.error });

    const propIntUpdateItem = {
      TableName: process.env.entitiesTableName,
      Item: {
        id: data.id,
        entity: data.entity,
        type: "propInt",
        hb_id: data.hb_id,
        cdt: data.cdt,
        mdt: Date.now(),
        comm_id: data.comm_id,
        lot_id: data?.lot_id || "",
        plan_id: data?.plan_id || "",
        data: data.data,
        note: data?.note || "",
        sts: data.sts,
      },
    };

    console.log("propIntUpdateItem", propIntUpdateItem);

    return postResources(propIntUpdateItem);
  } catch (error) {
    console.log(
      "error in updatePropertyInterest",
      JSON.stringify(error.stacks)
    );
    return failure({ status: false, error: error.message });
  }
};

const getPropertyInterest = async (data) => {
  try {
    const { data: propIntUUID = "", hb_id } = data;
    if (!propIntUUID)
      return failure({ status: false, error: "Data feild is Required" });
    if (!hb_id) return { status: false, error: "Home Builder ID Required" };

    const params = {
      TableName: process.env.entitiesTableName,
      IndexName: process.env.entitiesTableByDataAndEntity,
      KeyConditionExpression: "#data = :data",
      ExpressionAttributeNames: {
        "#data": "data",
      },
      ExpressionAttributeValues: {
        ":data": propIntUUID,
      },
    };
    console.log("getPropIntParams", params);
    const propIntResp = await getResourceJSON(params);
    console.log(`PropIntResp: ${JSON.stringify(propIntResp)}`);
    if (propIntResp && propIntResp.length) {
      const batchGetParams = getBatchGetParams(propIntResp);
      const batchGetResp = await batchGetResources(batchGetParams, true);
      console.log("batchGetResp: ", JSON.stringify(batchGetResp));
      const batchGetRespBody =
        batchGetResp && batchGetResp.statusCode === 200 && batchGetResp.body
          ? JSON.parse(batchGetResp.body)
          : [];
      console.log("batchGetRespBody: ", JSON.stringify(batchGetRespBody));
      const propInt = {
        ...propIntResp[0],
        comm: batchGetRespBody.find(
          (value) =>
            value.id === propIntResp[0].comm_id &&
            value.entity === `community#${propIntResp[0].hb_id}`
        ),
        plan: propIntResp[0].plan_id
          ? batchGetRespBody.find(
            (value) =>
              value.id === propIntResp[0].plan_id &&
              value.entity === `plan#${propIntResp[0].hb_id}`
          )
          : undefined,
        lot: propIntResp[0].lot_id
          ? batchGetRespBody.find(
            (value) =>
              value.id === propIntResp[0].lot_id &&
              value.entity === `lot#${propIntResp[0].hb_id}`
          )
          : undefined,
      };
      return success([propInt]);
    }
    return failure({ status: false, error: "Invalid Data feild" });
  } catch (error) {
    console.log("error in getPropertyInterest", JSON.stringify(error.stacks));
    return failure({ status: false, error: error.message });
  }
};

const deletePropertyInterest = async (data) => {
  try {
    const { id, entity } = data;
    if (!id || !entity)
      return failure({ status: false, error: "Id and Entity are required" });
    const params = {
      TableName: process.env.entitiesTableName,
      Key: {
        id,
        entity,
      },
    };
    console.log(params);
    const deletePropIntResp = await deleteResources(params);
    console.log(`deletePropIntResp: ${JSON.stringify(deletePropIntResp)}`);
    return deletePropIntResp;
  } catch (error) {
    console.log(
      "error in deletePropertyInterest",
      JSON.stringify(error.stacks)
    );
    return failure({ status: false, error: error.message });
  }
};

const combinePropIntData = async (data = []) => {
  console.log(`Inside combinePropIntData: ${JSON.stringify(data)}`);
  const transformed = [];
  try {
    const batchGetParams = getBatchGetParams(data);
    const batchGetResp = await batchGetResources(batchGetParams, true);
    console.log("batchGetResp: ", JSON.stringify(batchGetResp));
    const batchGetRespBody =
      batchGetResp && batchGetResp.statusCode === 200 && batchGetResp.body
        ? JSON.parse(batchGetResp.body)
        : [];
    console.log("batchGetRespBody: ", JSON.stringify(batchGetRespBody));
    for (const item of data) {
      transformed.push({
        ...item,
        comm: batchGetRespBody.find(
          (value) =>
            value.id === item.comm_id &&
            value.entity === `community#${item.hb_id}`
        ),
        plan: item.plan_id
          ? batchGetRespBody.find(
            (value) =>
              value.id === item.plan_id &&
              value.entity === `plan#${item.hb_id}`
          )
          : undefined,
        lot: item.lot_id
          ? batchGetRespBody.find(
            (value) =>
              value.id === item.lot_id && value.entity === `lot#${item.hb_id}`
          )
          : undefined,
      });
    }
    return transformed;
  } catch (error) {
    return [];
  }
};

const listPropertyInterest = async (data) => {
  try {
    const { hb_id: hbId = "", customer_id = "", listAll = false } = data;
    if (!customer_id || !hbId)
      return failure({
        status: false,
        error: { msg: "Customer Id and hb_id are required" },
      });

    const customParams = [
      {
        match: {
          "id.keyword": customer_id,
        },
      },
      {
        match: {
          "type.keyword": "propInt",
        },
      },
    ];

    const params = {
      ...data,
      isCustomParam: true,
      customParams,
    };

    console.log("listPropertyInterestParams", params);

    if (listAll) {
      let allPropInt = await doPaginatedQueryEllastic(params);
      allPropInt = await combinePropIntData(allPropInt);
      return success({ status: true, data: allPropInt });
    }

    const propInts = await listEntitiesElastic(params);

    if (!propInts.status) return failure({ ...propInts });

    propInts.result = await combinePropIntData(propInts.result);

    return success({ ...propInts });
  } catch (error) {
    console.log("error in listPropertyInterest", JSON.stringify(error.stacks));
    return failure({ status: false, error: error.message });
  }
};

// function for list customer based on community and stage
const listCommunityCustomer = async (event, isJSON = false) => {
  try {

    console.log(`Event: ${JSON.stringify(event)}`);

    const {
      from = 0,
      size = 5,
      comm = [],
      stage = [],
      sort = [
        {
          field: "fname",
          order: "asc"
        }
      ],
      hb_id: hbId = "",
      after = []
    } = event;

    const customerQuery = {
      httpMethod: "POST",
      requestPath: "/_search",
      payload: {
        query: {
          bool: {
            must: [
              {
                match: {
                  "entity.keyword": `customer#${hbId}`,
                },
              },
              {
                match: {
                  "hb_id.keyword": hbId,
                },
              },
            ]
          }
        },
        from,
        size,
        sort: []
      }
    };

    if (comm.length) {
      customerQuery.payload.query.bool.must.push({
        terms: {
          'inte.keyword': comm
        }
      })
    };

    if (stage.length) {
      customerQuery.payload.query.bool.must.push({
        bool: {
          should: stage.map(eachStage => ({
            match: {
              'stage.keyword': eachStage
            }
          }))
        }
      })
    };

    // for sorting
    if (sort.length) {
      for (const sortField of sort) {
        // sortField = {"field": "email", "order": "asc/desc"}
        customerQuery.payload.sort.push({
          [`${sortField.field}${sortField.field !== "cdt" && sortField.field !== "jdt" && sortField.field !== "mdt"
            ? ".keyword"
            : ""
            }`]: sortField.order,
        });
      }
      // Adding the id field as the tie-breaker field for sorting.
      customerQuery.payload.sort.push({
        "id.keyword": "asc",
      });
    }

    // If after is provided and the from + size is greater than 10000, use the search_after parameter in the query.
    // This is done because of the index.max-result-window limit of 10000 set by Elasticsearch.
    if (from + size > 10000 && after.length) {
      customerQuery.payload.search_after = after;
      // In this case we should set from as 0
      customerQuery.payload.from = 0;
    }

    console.log(`CustomerQuery: ${JSON.stringify(customerQuery)}`);

    const elasticResult = await elasticExecuteQuery(customerQuery, true);
    console.log(`elasticResult: ${JSON.stringify(elasticResult)}`);

    if (
      elasticResult &&
      elasticResult.statusCode === 200 &&
      elasticResult.body &&
      elasticResult.body.hits &&
      elasticResult.body.hits.hits
    ) {
      const { hits } = elasticResult.body.hits;
      const resultLength = hits.length;
      const totalResults = elasticResult.body.hits.total;
      console.log(`resultLength: ${resultLength}`);
      console.log(`totalResults: ${totalResults}`);
      const customers = resultLength
        ? hits.map((customer) => {
          const customerObj = {
            ...customer._source,
            _score: customer._score,
          };
          return customerObj;
        })
        : [];
      const afterNext =
        resultLength ? [...hits[resultLength - 1].sort] : [];
      const hasAfter = from + size < totalResults;
      if (isJSON) {
        return { customers, after: afterNext, hasAfter, totalResults };
      }
      return success({ customers, after: afterNext, hasAfter, totalResults });
    }
    if (isJSON) {
      return elasticResult;
    }
    return failure(elasticResult);

  } catch (error) {

    console.log(`Error: ${JSON.stringify(error)}`);

    return failure({ status: false, error });

  };
};

export const getCustomerListById = async (data) => {
  const { ids = [], hb_id = '' } = data;
  try {
    const customerlist = await getEntityByIdsElastic({
      ids,
      hbId: hb_id,
      isJSONOnly: true,
      entity: "customer"
    });
    console.log(`customerlist: ${JSON.stringify(customerlist)}`);
    return success({ customers: customerlist });
  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`);

    return failure({ status: false, error });
  }
};


/* const customerAnalyticsDB = async (data) => {
  const { hb_id: hbId = "", rel_id: realtorId = "" } = data;
  let response = {
    realtorAllTime: {},
    realtorLast30: {},
    agencyAllTime: {},
    agencyLast30: {},
  };
  const prepareAnalyticsResponse = ({ res, type }) => {
    // Get the analytics object from the resource
    const { count = {} } = res;
    console.log(`count: ${JSON.stringify(count)}`);

    // Extract allTime and last30 analytics from the analytics count object
    const { allTime, last30 } = count;
    console.log(`allTime: ${JSON.stringify(allTime)}`);
    console.log(`last30: ${JSON.stringify(last30)}`);

    if (allTime) response[`${type}AllTime`] = allTime;
    if (last30) response[`${type}Last30`] = last30;
  };
  try {
    // Get realtor analytics
    const params = {
      TableName: process.env.entitiesTableName,
      KeyConditionExpression: "#id = :id and begins_with(#entity, :entity)",
      ExpressionAttributeNames: {
        "#id": "id",
        "#entity": "entity",
      },
      ExpressionAttributeValues: {
        ":id": realtorId,
        ":entity": `analytics#${hbId}#customer#`,
      },
    };
    console.log(`Realtor Analytics params: ${JSON.stringify(params)}`);
    const analyticsResources = await getResourceJSON(params);
    console.log(`analyticsResources: ${JSON.stringify(analyticsResources)}`);

    for (const analytics of analyticsResources) {
      console.log(`analytics: ${JSON.stringify(analytics)}`);
      if (analytics?.entity === `analytics#${hbId}#customer#realtor`) {
        // Realtor analytics
        prepareAnalyticsResponse({ res: analytics, type: "realtor" });
      } else if (analytics?.entity === `analytics#${hbId}#customer#agency`) {
        // Agency analytics
        prepareAnalyticsResponse({ res: analytics, type: "agency" });
      }
    }
    response = success(response);
  } catch (error) {
    console.log(`Exception occured at customerAnalyticsDB customer.js`);
    console.log(error);
    response = failure(response);
  }
  return response;
}; */
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
    console.log(`event: ${JSON.stringify(event)} `);
    const action =
      event && event.pathParameters && event.pathParameters.action
        ? event.pathParameters.action
        : 0;
    let data;
    switch (event.httpMethod) {
      case "GET":
        if (action === "get") {
          response = await getCustomer(event);
        } else {
          /* else if (event.path.indexOf('testsign') !== -1) {
                    response = await testSign(event);
                } */
          response = failure();
        }
        break;
      case "POST":
        data = JSON.parse(event.body);
        if (!data) {
          response = failure();
        } else if (action === "create") {
          response = await createCustomer(data);
        } else if (action === "update") {
          response = await updateCustomer(data);
        } else if (action === "delete") {
          response = await deleteCustomer(data, event);
        } else if (action === "analytics") {
          response = await customerAnalytics(data);
        } else if (action === "eanalytics") {
          response = await customerAnalyticsElastic(data);
          // response = await customerAnalyticsDB(data);
        } else if (action === "list") {
          // response = await listCustomers(data);
          response = await listCustomerElastic(data);
        } else if (action === "listc") {
          // List customer JSON for other Lambdas
          response = await listCustomersPaginated(data);
        } else if (action === "olist") {
          response = await oldListCustomers(data);
        } else if (action === "elist") {
          response = await listCustomerElastic(data);
        } else if (action === "updateRow") {
          response = await updateCustomerRow(data);
        } else if (action === "updesf") {
          response = await updateCustomerDesf();
        } else if (action === "upinte") {
          response = await updateCustomerInteWithCommNumber();
        } else if (action === "cleanup") {
          response = await cleanupData(data);
        } else if (action === "exportCustomerData") {
          response = await exportCustomerData(data);
        } else if (action === "getestatus") {
          response = await getExportStatus(data);
        } else if (action === "create-propInt") {
          response = await createPropertyInterest(data);
        } else if (action === "update-propInt") {
          response = await updatePropertyInterest(data);
        } else if (action === "get-propInt") {
          response = await getPropertyInterest(data);
        } else if (action === "delete-propInt") {
          response = await deletePropertyInterest(data);
        } else if (action === "list-propInt") {
          response = await listPropertyInterest(data);
        } else if (action === "listCommunityCustomer") {
          response = await listCommunityCustomer(data);
        } else if (action === 'getCustomerListById') {
          response = await getCustomerListById(data);
        }
        else {
          response = failure();
        }
        break;
      default:
        response = failure();
    }
  } catch (err) {
    console.log(`Exception in customers lambda: ${err} `);
    return failure({ status: false, error: err });
  }

  return response;
}
