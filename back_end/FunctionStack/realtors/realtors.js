/* eslint-disable camelcase */
/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import {
  getRealtorCreateJSON,
  isCorrectFieldType,
  transactWriteItems,
  postResources,
  getResourceJSON,
  getParamsForQuery,
  getResources,
  // getQueryPromise,
  // batchGetResources,
  updateResources,
  getHydrationParamsForQuery,
  executeByBatch,
  getEntityByIdsElastic,
  getEntityIdsArr,
  getRecordByEntity,
  doPaginatedQueryDB,
  batchWriteItems,
} from "../libs/db";
import { deleteEntityEndpoint } from "../campaign/common";
import { publishEntityData } from "../libs/messaging";
import { success, failure } from "../libs/response-lib";
import { validateFields } from "../validation/validation";
import { elasticExecuteQuery, getSearchQuery } from "../search/search";
import { getBuilderAsync } from "../builders/builders";
import { getDynamicRequiredFields } from "../dynamicRequiredFields/dynamicRequiredFields";

const {
  STACK_PREFIX,
  DATA_MIGRAION_MACHINE_ARN,
  DELETE_REALTOR_FROM_CUSTOMER_STATEMACHINE_ARN,
} = process.env;
const sfn = new AWS.StepFunctions();

const getLeadProspectCustomers = async (realtorId, hbid) => {
  // Get all customers under the realtor with stage 'Lead' or 'Prospect'
  const params = {
    TableName: process.env.entitiesTableName,
    KeyConditionExpression: "#id = :id and begins_with(#entity, :entity)",
    ExpressionAttributeNames: {
      "#id": "id",
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":id": realtorId,
      ":entity": `customer#${hbid}#Lead`,
    },
  };
  console.log(params);
  const leadCustomers = await getResourceJSON(params);
  params.ExpressionAttributeValues[":entity"] = `customer#${hbid}#Prospect`;
  const prospectCustomers = await getResourceJSON(params);
  return [...leadCustomers, ...prospectCustomers];
};
const updateCustomerAgency = async (obj) => {
  const { rlt_id: realtorId = "", olda = "", propVal = "", hbid = "" } = obj;
  console.log(`realtorId: ${realtorId}`);
  console.log(`olda: ${olda}`);
  console.log(`propVal: ${propVal}`);
  console.log(`hbid: ${hbid}`);
  // Get all the customers under the realtor
  const leadProspectCustomers = await getLeadProspectCustomers(realtorId, hbid);
  console.log(
    `leadProspectCustomers: ${JSON.stringify(leadProspectCustomers)}`
  );
  if (leadProspectCustomers.length) {
    const agencyUpdateArr = [];
    // Delete the customers under the old agency of the realtor
    for (const customer of leadProspectCustomers) {
      agencyUpdateArr.push({
        Delete: {
          Key: {
            id: olda,
            entity: customer.entity,
          },
          TableName: process.env.entitiesTableName /* required */,
          ReturnValuesOnConditionCheckFailure: "ALL_OLD",
        },
      });
      // Now Create customer resource under the new agency
      customer.id = propVal;
      const customerCreateItem = customer;
      agencyUpdateArr.push({
        Put: {
          TableName: process.env.entitiesTableName /* required */,
          Item: customerCreateItem,
          ReturnValuesOnConditionCheckFailure: "ALL_OLD",
        },
      });
    }
    const transArr = [...agencyUpdateArr];
    const transParams = {
      TransactItems: transArr,
    };
    console.log(`transParams Customer: ${JSON.stringify(transParams)}`);
    return transactWriteItems(transParams);
  }
  // No lead/prospect customers exists under this realtor
  return success({ status: true });
};
// const getCommCreateArr = (comm, type, hbId, realtorItem, realtorUUID) => {
//   const communityCreateItemArr = [];
//   for (const communityId of comm) {
//     delete realtorItem.data;
//     delete realtorItem.id;
//     delete realtorItem.entity;
//     communityCreateItemArr.push({
//       Put: {
//         TableName: process.env.entitiesTableName /* required */,
//         Item: {
//           id: communityId,
//           entity: `${type}#${hbId}#community#${realtorUUID}`,
//           data: realtorUUID,
//           ...realtorItem,
//         },
//         ReturnValuesOnConditionCheckFailure: "ALL_OLD",
//       },
//     });
//   }
//   return communityCreateItemArr;
// };
const getMetroFromAgency = async (agencyId, hbId) => {
  try {
    const params = {
      TableName: process.env.entitiesTableName,
      KeyConditionExpression: "#id = :id and #entity = :entity",
      ExpressionAttributeNames: {
        "#id": "id",
        "#entity": "entity",
      },
      ExpressionAttributeValues: {
        ":id": agencyId,
        ":entity": `agency#${hbId}`,
      },
    };
    console.log(`params: ${JSON.stringify(params)}`);
    const agency = await getResourceJSON(params);
    if (agency && agency.length) return agency[0].m_id;
    return [];
  } catch (error) {
    console.log("Error occured in getMetroFromAgency");
    console.log(error);
    return [];
  }
};
export const createRealtor = async (data) => {
  const { hb_id: hbId } = data;
  const dynamicRequiredFieldData = await getDynamicRequiredFields({pathParameters: {id: hbId, type: "realtor"}}, true);
  console.log(`dynamicRequiredFieldData: ${JSON.stringify(dynamicRequiredFieldData)}`);
  const realtorRequiredFields = dynamicRequiredFieldData?.data[0]?.required_fields || {};
  const retVal = validateFields("realtor", data, false, realtorRequiredFields);
  if (retVal === "") {
    const getBuilderResp = await getBuilderAsync(hbId);
    if (getBuilderResp && getBuilderResp.id) {
      const realtorJSON = getRealtorCreateJSON(data);
      if (!isCorrectFieldType(realtorJSON)) {
        return failure({ status: false, error: "Field Type Error" });
      }
      // get the metros from agency
      const m_id = await getMetroFromAgency(
        realtorJSON.rel_id,
        realtorJSON.hb_id
      );
      // Proceed with create operation
      const realtorItem = {
        type: realtorJSON.type,
        hb_id: realtorJSON.hb_id,
        fname: realtorJSON.fname,
        lname: realtorJSON.lname,
        fullname: `${realtorJSON.fname} ${realtorJSON.lname || ""}`,
        phone: realtorJSON.phone,
        email: realtorJSON.email,
        exp: realtorJSON.exp,
        spec: realtorJSON.spec,
        mdt: realtorJSON.mod_dt,
        cdt: realtorJSON.cdt,
        infl: realtorJSON.infl,
        cntm: realtorJSON.cntm,
        psrc: realtorJSON.psrc,
        rel_id: realtorJSON.rel_id,
        fav: realtorJSON.fav,
        stat: realtorJSON.stat,
        appid: realtorJSON.appid,
        optindt: realtorJSON.optindt,
        optoutdt: realtorJSON.optoutdt,
        optst: "",
        gen_src: "",
        m_id,
      };
      if (!realtorJSON.optst) {
        if (getBuilderResp.optin) realtorItem.optst = "PENDING";
        else realtorItem.optst = "NONE";
      } else realtorItem.optst = realtorJSON.optst;
      // Setting non-mandatory fields based on it's availability
      if (realtorJSON.img) {
        realtorItem.img = realtorJSON.img;
      }
      const crby = data.crby ? data.crby : "";
      if (crby) {
        realtorItem.crby = crby;
      }
      if (data?.isSns) {
        if (data?.isHf) realtorItem.gen_src = "msg_hf";
        else realtorItem.gen_src = "msg_brix";
      } else realtorItem.gen_src = "app";
      if (realtorJSON.hfhbid) {
        realtorItem.hfhbid = realtorJSON.hfhbid;
      }
      if (realtorJSON.hfid) {
        realtorItem.hfid = realtorJSON.hfid;
      }
      realtorItem.dg = [];
      if (data.dgraph_list && data.dgraph_list.length > 0) {
        data.dgraph_list.forEach((dgraphItem) => {
          realtorItem.dg.push({
            q: dgraphItem.qstn_id,
            a: dgraphItem.option_id,
          });
        });
      }
      const agencyRow = data.agency ? data.agency : {};
      const realtorUUID = data.isSns ? data.id : uuidv4();
      realtorItem.data = `realtor#${realtorJSON.hb_id}`;
      realtorItem.agcnm = agencyRow.cname;
      realtorItem.agtnm = agencyRow.tname;
      const realtorCreateItem = {
        id: realtorUUID,
        entity: `${realtorJSON.type}#${realtorJSON.hb_id}`,
        ...realtorItem,
      };
      const transArr = [
        /* required */
        {
          Put: {
            TableName: process.env.entitiesTableName /* required */,
            Item: realtorCreateItem,
            ReturnValuesOnConditionCheckFailure: "ALL_OLD",
          },
        },
      ];
      // Skip agency part for messaging realtor creation
      if (!data.isSns) {
        const agencyId = agencyRow.id;
        delete realtorItem.data;
        const agencyRealtorCreateItem = {
          id: agencyId,
          entity: `${realtorJSON.type}#${realtorJSON.hb_id}#agency#${realtorUUID}`,
          data: realtorUUID,
          ...realtorItem,
        };
        realtorItem.data = `realtor#${realtorJSON.hb_id}`;
        delete agencyRow.id;
        delete agencyRow.entity;
        delete agencyRow.data;
        delete agencyRow.broker;
        const agencyCreateItem = {
          id: realtorUUID,
          entity: `agency#${realtorJSON.hb_id}#realtor#${agencyId}`,
          data: `realtor#${realtorJSON.hb_id}`,
          ...agencyRow,
        };
        /* const communityCreateItemArr = getCommCreateArr(
          realtorJSON.comm,
          realtorJSON.type,
          realtorJSON.hb_id,
          realtorItem,
          realtorUUID
        ); */
        transArr.push({
          Put: {
            TableName: process.env.entitiesTableName /* required */,
            Item: agencyCreateItem,
            ReturnValuesOnConditionCheckFailure: "ALL_OLD",
          },
        });

        transArr.push({
          Put: {
            TableName: process.env.entitiesTableName /* required */,
            Item: agencyRealtorCreateItem,
            ReturnValuesOnConditionCheckFailure: "ALL_OLD",
          },
        });
        // transArr.push(...communityCreateItemArr);
      }

      const transParams = {
        TransactItems: transArr,
      };
      console.log(`transArr: ${JSON.stringify(transArr)}`);
      const realtorCreateResp = await transactWriteItems(transParams);
      if (
        !data.isSns &&
        (STACK_PREFIX.includes("aws-crm") || STACK_PREFIX.includes("crm-test"))
      ) {
        const publishCustomerDataResponse = await publishEntityData({
          entityId: realtorCreateItem.id,
          entityType: "realtor",
          isBrix: false,
          isCreate: true,
          isHomefront: true,
          messageId: uuidv4(),
          HomebuilderID: hbId,
        });
        console.log(
          "publishCustomerDataResponse: ",
          publishCustomerDataResponse
        );
      }
      return realtorCreateResp;
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
export const updateRealtorRow = async (data) => {
  const { isHf = false } = data;
  console.log(`data: ${JSON.stringify(data)}`);
  // get the metros from agency
  const m_id = await getMetroFromAgency(data.rel_id, data.hb_id);
  const params = {
    TableName: process.env.entitiesTableName,
    Item: {
      type: "realtor",
      hb_id: data.hb_id,
      fname: data.fname,
      lname: data.lname,
      fullname: `${data.fname} ${data.lname || ""}`,
      phone: data.phone,
      email: data.email,
      exp: data.exp,
      spec: data.spec,
      mdt: Date.now(),
      cdt: data.cdt,
      infl: data.infl,
      cntm: data.cntm,
      psrc: data.psrc,
      rel_id: data.rel_id,
      fav: data.fav,
      stat: data.stat,
      appid: data.appid,
      entity: `realtor#${data.hb_id}`,
      data: `realtor#${data.hb_id}`,
      id: data.id,
      gen_src: "",
      m_id,
    },
  };
  if (data?.isSns) {
    if (data?.isHf) params.Item.gen_src = "msg_hf";
    else params.Item.gen_src = "msg_brix";
  } else params.Item.gen_src = "app";
  if (data?.hfhbid) {
    params.Item.hfhbid = data.hfhbid;
  }
  if (data?.hfid) {
    params.Item.hfid = data.hfid;
  }
  if (data?.agcnm) {
    params.Item.agcnm = data.agcnm;
  }
  if (data?.agtnm) {
    params.Item.agtnm = data.agtnm;
  }
  if (data?.isSns) {
    params.Item.isSns = data.isSns;
  }
  // Get the realtor Details
  const realtorGetParams = getHydrationParamsForQuery(
    data.id,
    `realtor#${data.hb_id}`,
    false,
    true
  );
  const realtorDetail = await getResourceJSON(realtorGetParams);
  const currentDate = Date.now();
  if (realtorDetail && realtorDetail.length) {
    const realtorDetailObj = realtorDetail[0];
    console.log(`realtorDetailObj: ${JSON.stringify(realtorDetailObj)}`);
    const cdt = realtorDetailObj?.cdt ?? "";
    // Merge the existing customer data with the request obj
    params.Item = { ...realtorDetailObj, ...params.Item };
    params.Item.cdt = cdt;
    params.Item.mdt = currentDate;
  }
  if (isHf) {
    params.Item.cdt = currentDate;
    params.Item.mdt = currentDate;
  }
  const dynamicRequiredFieldData = await getDynamicRequiredFields({pathParameters: {id: data.hb_id, type: "realtor"}}, true);
  console.log(`dynamicRequiredFieldData: ${JSON.stringify(dynamicRequiredFieldData)}`);
  const realtorRequiredFields = dynamicRequiredFieldData?.data[0]?.required_fields || {};
  const retVal = validateFields("realtor", params.Item, false, realtorRequiredFields);
  if (retVal === "") {
    if (!isCorrectFieldType(params.Item)) {
      return failure({ status: false, error: "Field Type Error" });
    }
    delete params.Item?.isSns;
    console.log(`params: ${JSON.stringify(params)}`);
    return postResources(params);
  }
  return failure({
    status: false,
    error: { msg: "Validation failed", field: retVal },
  });
};
export const listRealtors = async (event) => {
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
      ":data": `realtor#${hbidParam}`,
    },
  };
  console.log(params);
  const realtorWithAgency = await doPaginatedQueryDB({ params });
  console.log(`realtorWithAgency: ${JSON.stringify(realtorWithAgency)}`);
  console.log(`realtorWithAgency.length: ${realtorWithAgency.length}`);
  let realtorArr = [];
  let agencyArr = [];
  if (realtorWithAgency.length) {
    // Filter the realtor resources to this array
    realtorArr = realtorWithAgency.filter(
      (realtor) =>
        realtor.entity.indexOf("realtor#") !== -1 &&
        realtor.entity.indexOf("agency#") === -1 &&
        realtor.entity.indexOf(`realtor#${hbidParam}#community#`) === -1
    );
    agencyArr = realtorWithAgency.filter(
      (agency) => agency.entity.indexOf("agency#") !== -1
    );
    console.log(`realtorArr: ${JSON.stringify(realtorArr)}`);
    console.log(`agencyArr: ${JSON.stringify(agencyArr)}`);
    realtorArr = realtorArr.map((realtor) => {
      for (const agency of agencyArr) {
        if (agency.id === realtor.id) {
          realtor.agency = agency;
          break;
        }
      }
      return realtor;
    });
    return success(realtorArr);
  }
  return success(realtorWithAgency);
};

const fixRealtorAgency = async (data = [], invalidRows = []) => {
  try {
    console.log("----inside fixRealtorAgency-----");

    const hbId = data[0].hb_id;

    const referenceIds = invalidRows.reduce(
      (acc, crr) => {
        acc.realtorIds.push(crr?.id || "");
        acc.agencyIds.push(crr?.rel_id || "");
        return acc;
      },
      { realtorIds: [], agencyIds: [] }
    );

    console.log(
      "referenceIds=>",
      JSON.stringify({
        hbId,
        referenceIds,
      })
    );

    // fetching the agency detail rows
    const agencyListQuery = {
      httpMethod: "POST",
      requestPath: "/_search",
      payload: {
        query: {
          bool: {
            must: [
              {
                terms: {
                  "id.keyword": [...new Set(referenceIds.agencyIds)],
                },
              },
              {
                match: {
                  "entity.keyword": `agency#${hbId}`,
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
        size: 50,
      },
    };

    console.log(`agencyListQuery: ${JSON.stringify(agencyListQuery)}`);
    let agencyResp = await elasticExecuteQuery(agencyListQuery);
    console.log(`agencyResp: ${JSON.stringify(agencyResp)}`);
    agencyResp = agencyResp.body ? JSON.parse(agencyResp.body) : {};
    agencyResp =
      agencyResp?.body?.hits?.hits?.map((agency) => agency?._source) ?? [];

    const idMappedAgency = agencyResp.reduce((acc, crr) => {
      acc[crr.id] = crr;
      return acc;
    }, {});

    console.log("idMappedAgency>>", JSON.stringify(idMappedAgency));

    const updateRow = [];

    data = data.map((realtor) => {
      if (referenceIds.realtorIds.includes(realtor.id)) {
        realtor.agtnm = idMappedAgency[realtor.rel_id]?.tname || "";
        realtor.agcnm = idMappedAgency[realtor.rel_id]?.cname || "";
        updateRow.push(realtor);
      }
      return realtor;
    });

    console.log("data>>", JSON.stringify(data));

    const batchParams = {
      RequestItems: {
        [process.env.entitiesTableName]: [],
      },
    };

    for (const item of updateRow) {
      batchParams.RequestItems[process.env.entitiesTableName].push({
        PutRequest: {
          Item: item,
        },
      });
    }

    console.log(`batchParams: ${JSON.stringify(batchParams)}`);
    const batchWriteResp = await batchWriteItems(batchParams);
    console.log(`batchWriteResp: ${JSON.stringify(batchWriteResp)}`);
    const batchWriteBody = batchWriteResp.body
      ? JSON.parse(batchWriteResp.body)
      : {};
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

    return data;
  } catch (error) {
    console.log("error in fixRealtorAgency", error);
    return data;
  }
};

export const listRealtorElastic = async (data) => {
  try {
    const {
      hb_id: hbId = "",
      from = 0,
      size = 5,
      sort = [],
      filterKey = "",
      searchKey = "",
      after = [],
      comm = [],
      m_id: metroIds = [],
      utype,
    } = data;
    console.log(`comm: ${JSON.stringify(comm)}`);
    console.log(`metroIds: ${JSON.stringify(metroIds)}`);
    // let agencyIdArr = [];
    const agencyObj = { status: false, query: {} };
    // If community filtering is enabled for the user
    // Get the agency ids that matches the metro ids in the request
    // Pass it along with the realtor list query
    // Add community filter if comm is provided
    if (!comm.length && utype === "agent") {
      return success({
        realtors: [],
        after: [],
        hasAfter: false,
        totalResults: 0,
      });
    }
    if (metroIds?.length && utype !== "admin" && utype !== "online_agent") {
      // Metro agency query
      const metroIdArr = [...new Set(metroIds)].map((metroId) => ({
        match: {
          "m_id.keyword": metroId,
        },
      }));
      const agencyListQuery = {
        httpMethod: "POST",
        requestPath: "/_search",
        payload: {
          query: {
            bool: {
              must: [
                {
                  bool: {
                    should: metroIdArr,
                  },
                },
                {
                  match: {
                    "entity.keyword": `agency#${hbId}`,
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
      console.log(`agencyListQuery: ${JSON.stringify(agencyListQuery)}`);
      const metroAgencyResp = await elasticExecuteQuery(agencyListQuery);
      console.log(`metroAgencyResp: ${JSON.stringify(metroAgencyResp)}`);
      const metroAgencyBody = metroAgencyResp.body
        ? JSON.parse(metroAgencyResp.body)
        : {};
      console.log(`metroAgencyBody: ${JSON.stringify(metroAgencyBody)}`);
      const agencyArr =
        metroAgencyBody?.body?.hits?.hits?.map((agency) => agency?._source) ??
        [];
      console.log(`agencyArr: ${JSON.stringify(agencyArr)}`);
      const agencyIds = agencyArr?.map((agency) => agency?.id ?? "");
      console.log(`agencyIds: ${JSON.stringify(agencyIds)}`);

      if (agencyIds?.length) {
        // Agency realtor query
        // agencyIdArr = [...new Set(agencyIds)].map((agencyId) => ({
        //   match: {
        //     "rel_id.keyword": agencyId,
        //   },
        // }));
        agencyObj.status = true;
        agencyObj.query = {
          terms: {
            "rel_id.keyword": [...new Set(agencyIds)],
          },
        };
      }
    }
    let realtorSearchQuery = {};
    const realtorListQuery = {
      httpMethod: "POST",
      requestPath: "/_search",
      payload: {
        query: {
          bool: {
            must: [
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
        size,
        from,
      },
    };

    // // Add agency id filtering for the list query if exists
    // if (agencyIdArr?.length) {
    //   realtorListQuery.payload.query.bool.must.push({
    //     bool: {
    //       should: agencyIdArr,
    //     },
    //   });
    // } else if (metroIds?.length && agencyIdArr?.length === 0) {
    //   // return empty response since there are no agencies and thereby realtors in the metro of the community
    //   return success({
    //     realtors: [],
    //     after: [],
    //     hasAfter: false,
    //     totalResults: 0,
    //   });
    // }

    // Add agency id filtering for the list query if exists
    if (agencyObj.status) {
      realtorListQuery.payload.query.bool.must.push(agencyObj.query);
    } else if (metroIds?.length && !agencyObj.status) {
      // return empty response since there are no agencies and thereby realtors in the metro of the community
      return success({
        realtors: [],
        after: [],
        hasAfter: false,
        totalResults: 0,
      });
    }

    // Get search query if searchKey is provided
    if (searchKey && filterKey) {
      realtorSearchQuery = getSearchQuery({
        filterKey,
        searchKey,
        type: "realtor",
      });
      console.log(`realtorSearchQuery: ${JSON.stringify(realtorSearchQuery)}`);
      realtorListQuery.payload.query.bool.must.push(realtorSearchQuery);
    }
    // Add sort field if supplied in the request
    if (sort.length) {
      realtorListQuery.payload.sort = [];
      for (const sortField of sort) {
        // sortField = {"field": "email", "order": "asc/desc"}
        realtorListQuery.payload.sort.push({
          [`${sortField.field === "agency" ? "agcnm" : sortField.field}${
            sortField.field !== "cdt" && sortField.field !== "mdt"
              ? ".keyword"
              : ""
          }`]: sortField.order,
        });
      }
      // Adding the id field as the tie-breaker field for sorting.
      realtorListQuery.payload.sort.push({
        "id.keyword": "asc",
      });
    }
    // If after is provided and the from + size is greater than 10000, use the search_after parameter in the query.
    // This is done because of the index.max-result-window limit of 10000 set by Elasticsearch.
    if (from + size > 10000 && after.length) {
      realtorListQuery.payload.search_after = after;
      // In this case we should set from as 0
      realtorListQuery.payload.from = 0;
    }
    console.log(`realtorListQuery: ${JSON.stringify(realtorListQuery)}`);
    const realtorList = await elasticExecuteQuery(realtorListQuery, true);
    console.log(`realtorList: ${JSON.stringify(realtorList)}`);

    if (
      realtorList &&
      realtorList.statusCode === 200 &&
      realtorList.body &&
      realtorList.body.hits &&
      realtorList.body.hits.hits
    ) {
      const { hits } = realtorList.body.hits;
      const resultLength = hits.length;
      const totalResults = realtorList.body.hits.total;
      console.log(`resultLength: ${resultLength}`);
      console.log(`totalResults: ${totalResults}`);
      console.log(`Before success call`);
      const invalidRows = []; // realtor rows that doesn't include value for fields agtnm or agcnm
      let realtors = resultLength
        ? hits.map((realtor) => {
            const realtorObj = { ...realtor._source, _score: realtor._score };
            if (!realtorObj.agtnm || !realtorObj.agcnm)
              invalidRows.push(realtorObj);
            return realtorObj;
          })
        : [];
      const afterNext =
        resultLength && sort.length ? [...hits[resultLength - 1].sort] : [];
      const hasAfter = from + size < totalResults;
      // if any of the realtor rows does'nt include agtnm or agcnm
      console.log("invalid rows==>", JSON.stringify(invalidRows));
      if (invalidRows.length)
        realtors = await fixRealtorAgency(realtors, invalidRows);
      return success({ realtors, after: afterNext, hasAfter, totalResults });
    }
    return failure(realtorList);
  } catch (error) {
    return failure(error);
  }
};
export const getRealtor = (event) => {
  const params = getParamsForQuery(event, "realtor");
  return getResources(params);
};
export const getRealtorAgencyId = async (realtorId, hbid) => {
  const params = {
    TableName: process.env.entitiesTableName,
    IndexName: process.env.entitiesTableByEntityAndId,
    KeyConditionExpression: "#entity = :entity",
    ExpressionAttributeNames: {
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":entity": `realtor#${hbid}#agency#${realtorId}`,
    },
  };
  console.log(params);
  const realtorAgencyItems = await getResourceJSON(params);
  console.log(`realtorAgencyItems: ${JSON.stringify(realtorAgencyItems)}`);
  if (realtorAgencyItems && realtorAgencyItems.length) {
    return realtorAgencyItems[0].id;
  }
  return false;
};
const getMetroIdsByCommunities = async ({ communities = [], hbId = "" }) => {
  try {
    if (communities.length) {
      const communityIdArr = [...communities].map((communityId) => ({
        match: {
          "id.keyword": communityId,
        },
      }));
      console.log(`communityIdArr: ${JSON.stringify(communityIdArr)}`);
      // Get all community metro ids
      const communityListQuery = {
        httpMethod: "POST",
        requestPath: "/_search",
        payload: {
          query: {
            bool: {
              must: [
                {
                  bool: {
                    should: communityIdArr,
                  },
                },
                {
                  match: {
                    "entity.keyword": `community#${hbId}`,
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
      console.log(`communityListQuery: ${JSON.stringify(communityListQuery)}`);
      const communityMetroResp = await elasticExecuteQuery(communityListQuery);
      console.log(`communityMetroResp: ${JSON.stringify(communityMetroResp)}`);
      const communityMetroBody = communityMetroResp.body
        ? JSON.parse(communityMetroResp.body)
        : {};
      console.log(`communityMetroBody: ${JSON.stringify(communityMetroBody)}`);
      const metroIds = communityMetroBody?.body?.hits?.hits?.map(
        (community) => community?._source?.rel_id ?? ""
      );
      console.log(`metroIds: ${JSON.stringify(metroIds)}`);
      console.log(`metroIds.length: ${metroIds.length}`);
      const metroIdsUnique = [...new Set(metroIds)];
      console.log(`metroIdsUnique: ${JSON.stringify(metroIdsUnique)}`);
      console.log(`metroIdsUnique.length: ${metroIdsUnique.length}`);
      return metroIdsUnique;
    }
    return [];
  } catch (error) {
    console.log("Error occured in getMetroIdsByCommunities");
    console.log(error);
    return [];
  }
};
const getRealtorByCommunitiesElastic = async (data, isJSONOnly = false) => {
  let response;
  const sendResponse = (returnFn) => {
    if (isJSONOnly) return response;
    return returnFn(response);
  };
  try {
    console.log("In getRealtorByCommunities elastic");
    const {
      comm: communities = [],
      hb_id: hbId = "",
      fromActivityLambda = false,
    } = data;
    let { m_id: metroIds = [] } = data;
    console.log(`communities: ${JSON.stringify(communities)}`);
    console.log(`metroIds: ${JSON.stringify(metroIds)}`);
    console.log(`hbId: ${JSON.stringify(hbId)}`);
    // Get the metroIds, if only the community ids are given
    // This primarily happens when the
    if (metroIds?.length === 0 && communities?.length) {
      metroIds = await getMetroIdsByCommunities({ communities, hbId });
      console.log(
        `metroIds in getRealtorByCommunitiesElastic: ${JSON.stringify(
          metroIds
        )}`
      );
    }
    if (metroIds?.length) {
      // Metro agency query
      const metroIdArr = [...new Set(metroIds)].map((metroId) => ({
        match: {
          "m_id.keyword": metroId,
        },
      }));
      const agencyListQuery = {
        httpMethod: "POST",
        requestPath: "/_search",
        payload: {
          query: {
            bool: {
              must: [
                {
                  bool: {
                    should: metroIdArr,
                  },
                },
                {
                  match: {
                    "entity.keyword": `agency#${hbId}`,
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
      console.log(`agencyListQuery: ${JSON.stringify(agencyListQuery)}`);
      const metroAgencyResp = await elasticExecuteQuery(agencyListQuery);
      console.log(`metroAgencyResp: ${JSON.stringify(metroAgencyResp)}`);
      const metroAgencyBody = metroAgencyResp.body
        ? JSON.parse(metroAgencyResp.body)
        : {};
      console.log(`metroAgencyBody: ${JSON.stringify(metroAgencyBody)}`);
      const agencyArr =
        metroAgencyBody?.body?.hits?.hits?.map((agency) => agency?._source) ??
        [];
      console.log(`agencyArr: ${JSON.stringify(agencyArr)}`);
      const agencyIds = agencyArr?.map((agency) => agency?.id ?? "");
      console.log(`agencyIds: ${JSON.stringify(agencyIds)}`);

      if (fromActivityLambda) {
        return { status: true, data: agencyIds?.length ? agencyIds : [] };
      }

      if (agencyIds?.length) {
        let realtorArr = [];
        // Agency realtor query
        const agencyIdArr = [...new Set(agencyIds)].map((agencyId) => ({
          match: {
            "rel_id.keyword": agencyId,
          },
        }));
        // Max limit of conditions in a query is 1024 by default
        // So splitting the number of requests
        if (agencyIdArr.length > 1000) {
          realtorArr = await executeByBatch({
            arr: agencyIdArr,
            executeFunction: getEntityIdsArr,
            arrayParamName: "idArr",
            otherParams: { hbId, entity: `realtor` },
          });
        } else {
          realtorArr = await getEntityIdsArr({
            idArr: agencyIdArr,
            hbId,
            entity: `realtor`,
          });
        }

        // Merge the real cname and tname to realtorArr
        const agencyCTNames = agencyArr.reduce(
          (agencyCTNamesObject, agencyCTName) => {
            agencyCTNamesObject[agencyCTName.id] = {
              cname: agencyCTName.cname,
              tname: agencyCTName.tname,
            };
            return agencyCTNamesObject;
          },
          {}
        );
        console.log("agencyCTNames: ", JSON.stringify(agencyCTNames));
        realtorArr = realtorArr.map((realtor) => {
          if (realtor.agcnm) {
            realtor.agcnm =
              agencyCTNames[realtor.rel_id] &&
              agencyCTNames[realtor.rel_id].cname
                ? agencyCTNames[realtor.rel_id].cname
                : "";
          }
          if (realtor.agtnm) {
            realtor.agtnm =
              agencyCTNames[realtor.rel_id] &&
              agencyCTNames[realtor.rel_id].tname
                ? agencyCTNames[realtor.rel_id].tname
                : "";
          }
          return realtor;
        });
        console.log(
          `realtorArr after cname tname merge: ${JSON.stringify(realtorArr)}`
        );
        response = realtorArr;
        return sendResponse(success);
      }
      response = [];
      return sendResponse(success);
    }
    response = {
      status: false,
      error: `Please provide valid metro identifiers.`,
    };
    return sendResponse(success);

    /* }
        else {
            response = { status: false, error: `Please provide valid community identifiers.` };
            return sendResponse(badRequest);
        } */
  } catch (error) {
    console.log("error");
    console.log(error);
    response = { status: false, error };
    return sendResponse(failure);
  }
};
// const getRealtorByCommunities = async (data, isJSONOnly) => {
//   console.log("In getRealtorByCommunities");
//   const communities = data.comm ? data.comm : [];
//   const hbid = data.hb_id ? data.hb_id : "";
//   console.log("getCommunitiesByIdList");
//   let params;
//   const realtorsByCommReqArr = [];
//   console.log(`communities: ${JSON.stringify(communities)}`);
//   for (const community of communities) {
//     console.log(`community: ${community}`);
//     params = {
//       TableName: process.env.entitiesTableName,
//       KeyConditionExpression: "#id = :id and begins_with(#entity, :entity)",
//       ExpressionAttributeNames: {
//         "#id": "id",
//         "#entity": "entity",
//       },
//       ExpressionAttributeValues: {
//         ":id": community,
//         ":entity": `realtor#${hbid}#community`,
//       },
//     };
//     console.log(`params: ${JSON.stringify(params)}`);
//     try {
//       realtorsByCommReqArr.push(getQueryPromise(params));
//     } catch (error) {
//       console.log(`error: ${error.stack}`);
//     }
//   }
//   const communityRealtorArr = await Promise.all(realtorsByCommReqArr);
//   console.log(`communityRealtorArr: ${JSON.stringify(communityRealtorArr)}`);
//   let realtorsUnderCommArr = [];
//   for (const resp of communityRealtorArr) {
//     realtorsUnderCommArr.push(...resp.Items);
//   }
//   // Remove duplicate objects based on entity
//   // Self in the filter points to the full array. Checking whether each object is present in the array as a duplicate
//   // by comparing the current index to the matched index
//   realtorsUnderCommArr = realtorsUnderCommArr.filter(
//     (realtor, index, self) =>
//       self.findIndex((rtr) => rtr.entity === realtor.entity) === index
//   );
//   console.log(`realtorsUnderCommArr: ${JSON.stringify(realtorsUnderCommArr)}`);

//   // Find all the agencies and replace the agcnm and agtnm values for getting the updated values of the same
//   let realtorAgencyIds = realtorsUnderCommArr.length
//     ? [...realtorsUnderCommArr].map((realtor) => realtor.rel_id)
//     : [];
//   realtorAgencyIds = [...new Set(realtorAgencyIds)];
//   console.log(`realtorAgencyIds: ${JSON.stringify(realtorAgencyIds)}`);
//   if (realtorAgencyIds.length) {
//     const realtorAgencyParams = {
//       RequestItems: {
//         /* required */
//         [process.env.entitiesTableName]: {
//           Keys: [],
//           AttributesToGet: ["id", "cname", "tname"],
//         },
//       },
//     };
//     for (const agencyId of realtorAgencyIds) {
//       if (agencyId) {
//         realtorAgencyParams.RequestItems[
//           process.env.entitiesTableName
//         ].Keys.push({
//           id: agencyId,
//           entity: `agency#${hbid}`,
//         });
//       }
//     }
//     console.log("realtorAgencyParams: ", JSON.stringify(realtorAgencyParams));
//     const agencyCTnamesResp = await batchGetResources(
//       realtorAgencyParams,
//       true
//     );
//     console.log("agencyCTnamesResp: ", JSON.stringify(agencyCTnamesResp));
//     const agencyCTnamesBody =
//       agencyCTnamesResp &&
//       agencyCTnamesResp.statusCode === 200 &&
//       agencyCTnamesResp.body
//         ? JSON.parse(agencyCTnamesResp.body)
//         : [];
//     console.log("agencyCTnamesBody: ", JSON.stringify(agencyCTnamesBody));
//     const agencyCTNames = agencyCTnamesBody.reduce(
//       (agencyCTNamesObject, agencyCTName) => {
//         agencyCTNamesObject[agencyCTName.id] = {
//           cname: agencyCTName.cname,
//           tname: agencyCTName.tname,
//         };
//         return agencyCTNamesObject;
//       },
//       {}
//     );
//     console.log("agencyCTNames: ", JSON.stringify(agencyCTNames));
//     realtorsUnderCommArr = realtorsUnderCommArr.map((realtor) => {
//       if (realtor.agcnm) {
//         realtor.agcnm =
//           agencyCTNames[realtor.rel_id] && agencyCTNames[realtor.rel_id].cname
//             ? agencyCTNames[realtor.rel_id].cname
//             : "";
//       }
//       if (realtor.agtnm) {
//         realtor.agtnm =
//           agencyCTNames[realtor.rel_id] && agencyCTNames[realtor.rel_id].tname
//             ? agencyCTNames[realtor.rel_id].tname
//             : "";
//       }
//       return realtor;
//     });
//   }
//   if (isJSONOnly) {
//     return realtorsUnderCommArr;
//   }
//   return success(realtorsUnderCommArr);
// };

// isJSONOnly - is a boolean. if true returns only the transact params array
// newCommIds - new community array
// commIds - old community array
// const deleteRealtorUnderComm = async (
//   commIds,
//   hbid,
//   realtorId,
//   isJSONOnly,
//   newCommIds,
//   isChangeAgency
// ) => {
//   const communityDeleteArr = [];
//   console.log(`commIds: ${JSON.stringify(commIds)}`);
//   console.log(`hbid: ${hbid}`);
//   console.log(`realtorId: ${realtorId}`);
//   console.log(`isJSONOnly: ${isJSONOnly}`);
//   console.log(`newCommIds: ${JSON.stringify(newCommIds)}`);
//   if (isChangeAgency) {
//     // Only delete realtor resource under old communities that are not present in the new community array.
//     commIds = commIds.filter((commId) => !newCommIds.includes(commId));
//     const realtorsUnderComm = await getRealtorByCommunitiesElastic(
//       { hb_id: hbid, comm: commIds },
//       true
//     );
//     console.log(`realtorsUnderComm: ${JSON.stringify(realtorsUnderComm)}`);
//     for (const commId of commIds) {
//       // Looping through old community ids
//       for (const realtor of realtorsUnderComm) {
//         // Creating the Delete Object for the community from the realtors received from the above call
//         if (realtor.id === commId && realtor.data === realtorId) {
//           communityDeleteArr.push({
//             Delete: {
//               Key: {
//                 id: commId,
//                 entity: realtor.entity,
//               },
//               TableName: process.env.entitiesTableName /* required */,
//               ReturnValuesOnConditionCheckFailure: "ALL_OLD",
//             },
//           });
//           break;
//         }
//       }
//     }
//   } else {
//     for (const commId of commIds) {
//       communityDeleteArr.push({
//         Delete: {
//           Key: {
//             id: commId,
//             entity: `realtor#${hbid}#community#${realtorId}`,
//           },
//           TableName: process.env.entitiesTableName /* required */,
//           ReturnValuesOnConditionCheckFailure: "ALL_OLD",
//         },
//       });
//     }
//   }
//   if (isJSONOnly) {
//     return communityDeleteArr;
//   }
//   if (deleteRealtorUnderComm.length) {
//     const transArr = [...communityDeleteArr];
//     const transParams = {
//       TransactItems: transArr,
//     };
//     return transactWriteItems(transParams);
//   }
//   return success({ status: true });
// };
const updateRealtorAgency = async (obj) => {
  const {
    // oldc = [],
    olda = "",
    // type = "",
    realtorItem = {},
    agency: agencyItem = {},
    params = {},
    propVal = "",
    hbid = "",
    id: rltId = "",
  } = obj;
  // const { comm = [] } = obj;

  // Delete the realtor resources under the communities
  /* const realtorUnderCommDelete = await deleteRealtorUnderComm(
    oldc,
    hbid,
    rltId,
    false,
    comm,
    true
  );
  console.log(
    `After deleteRealtorUnderComm: ${JSON.stringify(realtorUnderCommDelete)}`
  ); */

  // Filter out the community ids that are present in old community array
  // comm = comm.filter((commId) => !oldc.includes(commId));

  // Now Create realtor entries under the new communities
  /* const communityCreateItemArr = getCommCreateArr(
    comm,
    type,
    hbid,
    realtorItem,
    realtorItem.id
  );
  console.log(
    `communityCreateItemArr: ${JSON.stringify(communityCreateItemArr)}`
  ); */
  const oldRealtorAgencyParams = [];
  // Delete old agency from the realtor
  oldRealtorAgencyParams.push({
    Delete: {
      Key: {
        id: rltId,
        entity: `agency#${hbid}#realtor#${olda}`,
      },
      TableName: process.env.entitiesTableName /* required */,
      ReturnValuesOnConditionCheckFailure: "ALL_OLD",
    },
  });
  // Delete realtor resource from old agency
  oldRealtorAgencyParams.push({
    Delete: {
      Key: {
        id: olda,
        entity: `realtor#${hbid}#agency#${rltId}`,
      },
      TableName: process.env.entitiesTableName /* required */,
      ReturnValuesOnConditionCheckFailure: "ALL_OLD",
    },
  });

  const transArr = [...oldRealtorAgencyParams];
  const transParams = {
    TransactItems: transArr,
  };
  console.log(`transParams: ${JSON.stringify(transParams)}`);
  const oldRealtorAgencyUpdateResp = await transactWriteItems(transParams);
  console.log(
    `oldRealtorAgencyUpdateResp: ${JSON.stringify(oldRealtorAgencyUpdateResp)}`
  );
  // Update the agency id in the realtor resource
  const updateAgencyIdResp = await updateResources(params);

  const newAgencyCreateArr = [];
  // Create new agency under the realtor
  delete agencyItem.id;
  delete agencyItem.entity;
  delete agencyItem.data;
  newAgencyCreateArr.push({
    Put: {
      TableName: process.env.entitiesTableName /* required */,
      Item: {
        id: rltId,
        entity: `agency#${hbid}#realtor#${realtorItem.rel_id}`,
        data: `realtor#${hbid}`,
        ...agencyItem,
      },
      ReturnValuesOnConditionCheckFailure: "ALL_OLD",
    },
  });

  // Create realtor resource under the new agency
  delete realtorItem.id;
  delete realtorItem.entity;
  delete realtorItem.agency;
  newAgencyCreateArr.push({
    Put: {
      TableName: process.env.entitiesTableName /* required */,
      Item: {
        id: realtorItem.rel_id,
        entity: `realtor#${hbid}#agency#${rltId}`,
        data: rltId,
        ...realtorItem,
      },
      ReturnValuesOnConditionCheckFailure: "ALL_OLD",
    },
  });
  const agRelCreateParam = {
    TransactItems: newAgencyCreateArr,
  };
  console.log(`agRelCreateParam: ${JSON.stringify(agRelCreateParam)}`);
  const agRelCreateResp = await transactWriteItems(agRelCreateParam);
  console.log(`agRelCreateResp: ${JSON.stringify(agRelCreateResp)}`);

  if (updateAgencyIdResp && updateAgencyIdResp.statusCode === 200) {
    // Update Realtor's Agency Id got succeeded
    // Update Agency Id of all the customers under this realtor with status 'lead' or 'prospect'
    const customerAgencyUpdate = await updateCustomerAgency({
      propVal,
      rlt_id: rltId,
      olda,
      hbid,
    });
    if (customerAgencyUpdate && customerAgencyUpdate.statusCode === 200) {
      // Customer Agency Id Update Success
      return success({ status: true });
    }
    return failure({
      status: false,
      error: "Update Realtor Success. Update Customers Failed",
    });
  }
  return failure({ status: false, error: "Update Failed" });
};

const getRealtorDetails = async (hbid, id) => {
  const params = getParamsForQuery(
    {
      pathParameters: { id, hbid },
    },
    "realtor"
  );
  return getResourceJSON(params);
};

export const updateRealtor = async (data) => {
  // comm - Community ids for updating realtor resource under communities
  const {
    id = "",
    attrn: propName = "",
    attrv: propVal = "",
    hb_id: hbid = "",
    oldc = [],
    comm = [],
    olda = "",
    realtor: realtorItem = {},
  } = data;
  // const propVal = propName === "fav" ? data.attrv : data.attrv ? data.attrv : "";
  const modDt = Date.now();

  const params = {
    TableName: process.env.entitiesTableName,
    Key: {
      id,
      entity: `realtor#${hbid}`,
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
  const realtorDetails = await getRealtorDetails(hbid, id);
  console.log("realtorDetails: ", realtorDetails);

  const realtorFname =
    realtorDetails && realtorDetails.length ? realtorDetails[0].fname : "";
  const realtorLname =
    realtorDetails && realtorDetails.length ? realtorDetails[0].lname : "";

  if (propName === "fname") {
    params.UpdateExpression = `set #propName = :pval, mdt = :modDate, #fullname = :fullname`;
    params.ExpressionAttributeNames["#fullname"] = "fullname";
    params.ExpressionAttributeValues[
      ":fullname"
    ] = `${propVal} ${realtorLname}`;
  }
  if (propName === "lname" && realtorFname) {
    params.UpdateExpression = `set #propName = :pval, mdt = :modDate, #fullname = :fullname`;
    params.ExpressionAttributeNames["#fullname"] = "fullname";
    params.ExpressionAttributeValues[":fullname"] = `${realtorFname} ${
      propVal || ""
    }`;
  }

  console.log(params);

  if (propName === "rel_id") {
    console.log(`In realtor update if`);
    // get the metros from agency
    const m_id = await getMetroFromAgency(propVal, hbid);
    params.UpdateExpression += `, #agtnm = :agtnm, #agcnm = :agcnm , #m_id = :m_id`;
    params.ExpressionAttributeNames["#agtnm"] = "agtnm";
    params.ExpressionAttributeNames["#agcnm"] = "agcnm";
    params.ExpressionAttributeNames["#m_id"] = "m_id";
    params.ExpressionAttributeValues[":agtnm"] =
      realtorItem && realtorItem.agtnm ? realtorItem.agtnm : "";
    params.ExpressionAttributeValues[":agcnm"] =
      realtorItem && realtorItem.agcnm ? realtorItem.agcnm : "";
    params.ExpressionAttributeValues[":m_id"] = m_id;
    return updateRealtorAgency({
      oldc,
      hbid,
      type: "realtor",
      realtorItem,
      params,
      propVal,
      id,
      olda,
      comm,
    });
  }
  const updateRealtorArr = [];
  // let communityUpdateItemArr = [];
  if (propName !== "agcnm" && propName !== "agtnm") {
    // Now update realtor entries under the new communities
    /* communityUpdateItemArr = getCommCreateArr(
      comm,
      "realtor",
      hbid,
      realtorItem,
      realtorItem.id
    ); */
    delete realtorItem.id;
    delete realtorItem.entity;
    updateRealtorArr.push({
      Update: params,
    });
    if (realtorItem.rel_id) {
      updateRealtorArr.push({
        Put: {
          TableName: process.env.entitiesTableName /* required */,
          Item: {
            id: realtorItem.rel_id,
            entity: `realtor#${hbid}#agency#${id}`,
            data: id,
            ...realtorItem,
          },
          ReturnValuesOnConditionCheckFailure: "ALL_OLD",
        },
      });
    }
    /* console.log(
      `communityUpdateItemArr: ${JSON.stringify(communityUpdateItemArr)}`
    ); */
  } else {
    updateRealtorArr.push({
      Update: params,
    });
  }
  console.log(`updateRealtorArr: ${JSON.stringify(updateRealtorArr)}`);
  const transParams = {
    TransactItems: updateRealtorArr,
  };
  console.log(`transParams: ${JSON.stringify(transParams)}`);
  const realtorCreateResp = await transactWriteItems(transParams);
  if (
    !data.isSns &&
    (STACK_PREFIX.includes("aws-crm") || STACK_PREFIX.includes("crm-test"))
  ) {
    console.log(`In Messaging if`);
    const publishCustomerDataResponse = await publishEntityData({
      entityId: id,
      entityType: "realtor",
      isBrix: false,
      isCreate: false,
      isHomefront: true,
      messageId: uuidv4(),
      HomebuilderID: hbid,
    });
    console.log("publishCustomerDataResponse: ", publishCustomerDataResponse);
  }
  return realtorCreateResp;
};
export const deleteRealtor = async (data, type = "delete") => {
  const {
    id = "",
    hb_id: hbid = "",
    agency_id: agencyId = "",
    // comm = [],
    isSns = false,
  } = data;
  const getDeleteEndpoint = await deleteEntityEndpoint(id, `realtor#${hbid}`);
  console.log(`getDeleteEndpoint: ${JSON.stringify(getDeleteEndpoint)}`);

  // Get the realtor details JSON for sending message to Homefront
  let hfhbid;
  let hfid;
  if (!isSns) {
    const entityGetParams = getHydrationParamsForQuery(
      id,
      `realtor#${hbid}`,
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

  const realtorDeleteArr = [];
  // realtorDeleteArr = await deleteRealtorUnderComm(comm, hbid, id, true);
  realtorDeleteArr.push({
    Delete: {
      Key: {
        id,
        entity: `realtor#${hbid}`,
      },
      TableName: process.env.entitiesTableName /* required */,
      ReturnValuesOnConditionCheckFailure: "ALL_OLD",
    },
  });
  if (agencyId) {
    realtorDeleteArr.push({
      Delete: {
        Key: {
          id,
          entity: `agency#${hbid}#realtor#${agencyId}`,
        },
        TableName: process.env.entitiesTableName /* required */,
        ReturnValuesOnConditionCheckFailure: "ALL_OLD",
      },
    });
    realtorDeleteArr.push({
      Delete: {
        Key: {
          id: agencyId,
          entity: `realtor#${hbid}#agency#${id}`,
        },
        TableName: process.env.entitiesTableName /* required */,
        ReturnValuesOnConditionCheckFailure: "ALL_OLD",
      },
    });
  }
  console.log(`realtorDeleteArr: ${JSON.stringify(realtorDeleteArr)}`);
  const transArr = [...realtorDeleteArr];
  const transParams = {
    TransactItems: transArr,
  };
  const realtorDeleteResp = await transactWriteItems(transParams);
  console.log(`realtorDeleteResp: ${JSON.stringify(realtorDeleteResp)}`);
  // Do a homefront publish if this call is not originated from messaging (isSns)
  if (
    !isSns &&
    (STACK_PREFIX.includes("aws-crm") || STACK_PREFIX.includes("crm-test"))
  ) {
    // Homefront message
    const publishEntityDataHfResp = await publishEntityData({
      entityId: id,
      entityType: "realtor",
      isBrix: false,
      isCreate: false,
      isHomefront: true,
      isDelete: true,
      messageId: uuidv4(),
      HomebuilderID_HF: hfhbid,
      Id: hfid,
      HomebuilderID: hbid,
    });
    console.log("publishEntityDataHfResp: ", publishEntityDataHfResp);
  }

  if (type === "delete") {
    // delete realtor from customers where the realtor is assigned
    const input = JSON.stringify({
      hbId: hbid,
      rltrIdArray: [id],
      purpose: "realtor",
    });
    const stateMachineParams = {
      input,
      stateMachineArn: DELETE_REALTOR_FROM_CUSTOMER_STATEMACHINE_ARN,
    };

    console.log(`stateMachineParams: ${JSON.stringify(stateMachineParams)}`);
    const startExecutionResp = await sfn
      .startExecution(stateMachineParams)
      .promise();
    console.log(`stateExecutionResp: ${JSON.stringify(startExecutionResp)}`);
  }

  return realtorDeleteResp;
};
const getCustomersUnderRealtor = async (data) => {
  const { hb_id: hbId = "", rel_id: relId = "" } = data;

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
  params.KeyConditionExpression = "#id = :id and begins_with(#entity ,:entity)";
  params.ExpressionAttributeValues[":entity"] = `customer#${hbId}`;
  return getResources(params);
};
const updateAgencyName = async (realtorIdArr, propName, propVal, hbId) => {
  for (const realtorId of realtorIdArr) {
    console.log(
      `in if (propName === 'cname' || propName === 'tname'): ${propName}`
    );
    const realtorUpdateObj = {
      id: realtorId,
      attrn: propName,
      attrv: propVal,
      hb_id: hbId,
    };
    console.log(`realtorUpdateObj: ${JSON.stringify(realtorUpdateObj)}`);

    // Update realtor agcnm or agtnm
    const updateRealtorResp = await updateRealtor(realtorUpdateObj);
    console.log(`updateRealtorResp: ${JSON.stringify(updateRealtorResp)}`);

    // Update realtor resource under community
  }
};
const updateAgencyUnderRealtor = async (obj) => {
  const { hbid, agencyId, propName, propVal } = obj;
  let { agencyRow } = obj;
  const realtorIdArr = [];
  delete agencyRow.id;
  delete agencyRow.entity;

  // DynamoDB Query
  /* const params = {
    TableName: process.env.entitiesTableName,
    IndexName: process.env.entitiesTableByEntityAndId,
    KeyConditionExpression: "#entity = :entity",
    ExpressionAttributeNames: {
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":entity": `agency#${hbid}#realtor#${agencyId}`,
    },
  };
  console.log(`params: ${JSON.stringify(params)}`);
  const realtorAgencyItems = await getResourceJSON(params);
  console.log(`realtorAgencyItems: ${JSON.stringify(realtorAgencyItems)}`); */

  console.log(
    `==========Fetch this agency's resources associated with realtors under this agency==========`
  );
  // Elastic query
  const realtorsUnderAgencyQuery = {
    httpMethod: "POST",
    requestPath: "/_search",
    payload: {
      query: {
        bool: {
          must: [
            {
              match: {
                "entity.keyword": `agency#${hbid}#realtor#${agencyId}`,
              },
            },
            {
              match: {
                "hb_id.keyword": hbid,
              },
            },
          ],
        },
      },
      size: 5000,
    },
  };
  console.log(
    `realtorsUnderAgencyQuery: ${JSON.stringify(realtorsUnderAgencyQuery)}`
  );
  const agenecyRealtorsResp = await elasticExecuteQuery(
    realtorsUnderAgencyQuery
  );
  console.log(`agenecyRealtorsResp: ${JSON.stringify(agenecyRealtorsResp)}`);
  const agencyRealtorsBody = agenecyRealtorsResp.body
    ? JSON.parse(agenecyRealtorsResp.body)
    : {};
  console.log(`agencyRealtorsBody: ${JSON.stringify(agencyRealtorsBody)}`);
  const realtorAgencyItems =
    agencyRealtorsBody?.body?.hits?.hits?.map((realtor) => realtor?._source) ??
    [];
  console.log(`realtorAgencyItems: ${JSON.stringify(realtorAgencyItems)}`);

  console.log(
    `==========Done fetching this agency's resources associated with realtors under this agency==========`
  );

  console.log(
    `==========Preparing delete and create params for agency resources under realtors==========`
  );
  const agencyUpdateArr = [];
  const agencyDeleteArr = [];
  console.log(`propName: ${propName}`);
  console.log(`propVal: ${propVal}`);

  // As a fallback, if agencyRow doesn't exist, add hb_id field in agencyRow
  // for facilitating agency realtor query which relies on hb_id
  if (!agencyRow?.hb_id) agencyRow = { hb_id: hbid };

  for (const realtorAgency of realtorAgencyItems) {
    const realtorId = realtorAgency.id;
    console.log(`realtorId: ${realtorId}`);
    // If the update agency is for cname or tname, update the realtor with new agcnm or agtnm values
    // Also push to realtorIdArr when propName is not defined. This means the update is from admin settings and is a row update
    if (propName === "cname" || propName === "tname" || !propName) {
      realtorIdArr.push(realtorId);
    }
    agencyDeleteArr.push({
      Delete: {
        Key: {
          id: realtorId,
          entity: `agency#${hbid}#realtor#${agencyId}`,
        },
        TableName: process.env.entitiesTableName /* required */,
        ReturnValuesOnConditionCheckFailure: "ALL_OLD",
      },
    });
    agencyUpdateArr.push({
      Put: {
        TableName: process.env.entitiesTableName /* required */,
        Item: {
          id: realtorId,
          entity: `agency#${hbid}#realtor#${agencyId}`,
          data: `realtor#${hbid}`,
          ...agencyRow,
        },
        ReturnValuesOnConditionCheckFailure: "ALL_OLD",
      },
    });
  }
  console.log(`==========Done creating delete and update params==========`);
  if (realtorIdArr.length) {
    if (propName && propVal) {
      console.log(
        `==========Starting agency cname or tname update for agency attribute update==========`
      );
      const updateAgencyNameResp = await updateAgencyName(
        realtorIdArr,
        propName === "cname" ? "agcnm" : "agtnm",
        propVal,
        hbid
      );
      console.log(
        `updateAgencyNameResp: ${JSON.stringify(updateAgencyNameResp)}`
      );
      console.log(
        `==========Done agency cname or tname update for agency attribute update==========`
      );
    } else {
      console.log(
        `==========Starting agency cname and tname update for agency row update==========`
      );
      // This is an update from the admin settings. Hence a row update.
      // Update both agcnm and agtnm in this case since we don't know whether any of them have changed
      // Update agcnm
      const updateAgencyCNameResp = await updateAgencyName(
        realtorIdArr,
        "agcnm",
        agencyRow.cname,
        hbid
      );
      console.log(
        `updateAgencyCNameResp: ${JSON.stringify(updateAgencyCNameResp)}`
      );

      // Update agtnm
      const updateAgencyTNameResp = await updateAgencyName(
        realtorIdArr,
        "agtnm",
        agencyRow.tname,
        hbid
      );
      console.log(
        `updateAgencyTNameResp: ${JSON.stringify(updateAgencyTNameResp)}`
      );
      console.log(
        `==========Done agency cname and tname update for agency row update==========`
      );
    }
  }
  // return { agencyDeleteArr, agencyUpdateArr };
  console.log(
    `==========Starting delete agency resources under realtor==========`
  );
  const deleteAgencyParams = {
    TransactItems: [...agencyDeleteArr],
  };
  console.log(`deleteAgencyParams: ${JSON.stringify(deleteAgencyParams)}`);
  // Do the update agency and delete agency resources under realtor
  const deleteAgencyResp = await transactWriteItems(deleteAgencyParams);
  console.log(`deleteAgencyResp: ${JSON.stringify(deleteAgencyResp)}`);
  console.log(`==========Done delete agency resources under realtor==========`);

  console.log(
    `==========Starting create agency resources under realtor==========`
  );
  // Create new agency resources under the realtors
  const putAgencyUnderRealtorsParam = {
    TransactItems: [...agencyUpdateArr],
  };
  // Doing a separate transactWriteItems for this since the API doesn't allow different operations on the same item in one call
  const putAgencyUnderRealtor = await transactWriteItems(
    putAgencyUnderRealtorsParam
  );
  console.log(
    `putAgencyUnderRealtor: ${JSON.stringify(putAgencyUnderRealtor)}`
  );
  console.log(`==========Done create agency resources under realtor==========`);
  return putAgencyUnderRealtor;
};
const getRealtorsByIds = async (data) => {
  console.log(`In getRealtorsByIds`);
  return getEntityByIdsElastic({ ...data, entity: `realtor` });
};

const exportRealtorData = async (data) => {
  const { hb_id: hbId } = data;
  const input = JSON.stringify({
    hbId,
    purpose: "exportRealtor",
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
      return failure({ status: false, error: "Home builder Id is missing" });
    }

    const exportStatusResp = await getRecordByEntity(
      `realtor_export_status#${hbid}`
    );
    console.log(`exportStatusResp: ${JSON.stringify(exportStatusResp)}`);
    return success(exportStatusResp);
  } catch (error) {
    return failure({ status: false, error });
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
  console.log(`event: ${JSON.stringify(event)}`);
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
          response = await listRealtors(event);
        } else if (action === "get") {
          response = await getRealtor(event);
        } else {
          response = failure();
        }
        break;
      case "POST":
        data = JSON.parse(event.body);
        if (!data) {
          response = failure();
        } else if (action === "create") {
          response = await createRealtor(data);
        } else if (action === "update") {
          response = await updateRealtor(data);
        } else if (action === "updateRow") {
          response = await updateRealtorRow(data);
        } else if (action === "delete") {
          response = await deleteRealtor(data);
        } else if (action === "grbyce") {
          response = await getRealtorByCommunitiesElastic(data);
        } else if (action === "customers") {
          response = await getCustomersUnderRealtor(data);
        } else if (action === "list") {
          response = await listRealtorElastic(data);
        } else if (action === "upagrel") {
          // upagrel - Update Agency under Realtor
          response = await updateAgencyUnderRealtor(data);
        } else if (action === "grbyids") {
          // grbyids - Get Realtors by Ids
          response = await getRealtorsByIds(data);
        } else if (action === "exportRealtorData") {
          response = await exportRealtorData(data);
        } else if (action === "getestatus") {
          response = await getExportStatus(data);
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
