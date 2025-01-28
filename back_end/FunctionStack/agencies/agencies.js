/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import { v4 as uuidv4 } from "uuid";
import AWS from "aws-sdk";
import {
  getResources,
  getAgencyCreateJSON,
  isCorrectFieldType,
  getBrokerCreateJSON,
  transactWriteItems,
  deleteResources,
  getQueryPromise,
  getResourceJSON,
  getStackOutputs,
  doPaginatedQueryEllastic,
} from "../libs/db";
import { invokeLambda } from "../libs/lambda";
import { failure, success } from "../libs/response-lib";
import { validateFields } from "../validation/validation";
import { getEntities } from "../endpointcount/endpointcount";
import { elasticExecuteQuery, getSearchQuery } from "../search/search";
import utils from "../libs/utils";
import { getDynamicRequiredFields } from "../dynamicRequiredFields/dynamicRequiredFields";

const sfn = new AWS.StepFunctions();

const { REALTOR_LAMBDA_ARN, StackName, ENDPOINT_UPDATE_MACHINE_ARN } =
  process.env;
let COMMUNITY_LAMBDA_ARN = "";
let AGENCIES_LAMBDA_ARN = "";
let COBUYER_LAMBDA_ARN = "";

export const createAgency = async (data) => {
  const { isHf = false } = data;
  const dynamicRequiredFieldData = await getDynamicRequiredFields({ pathParameters: { id: data.agency.hb_id, type: "agency" } }, true);
  console.log(`dynamicRequiredFieldData: ${JSON.stringify(dynamicRequiredFieldData)}`);
  const agencyRequiredFields = dynamicRequiredFieldData?.data[0]?.required_fields || {};
  const retVal = validateFields("agency", data.agency, false, agencyRequiredFields);
  console.log(`After validateFields`);
  if (retVal === "") {
    let brokerCreateItem;
    const agencyData = data?.agency ?? {};
    const brokerData = data?.broker ?? {};
    const metroItems = data?.metro ?? [];
    const agencyJSON = getAgencyCreateJSON(agencyData);
    const { hb_id: hbId } = agencyJSON;
    if (!isCorrectFieldType(agencyJSON)) {
      return failure({ status: false, error: "Field Type Error" });
    }

    console.log(`In isCorrectFieldType else`);
    // Proceed with the create operation
    const agencyItem = {
      type: agencyJSON.type,
      hb_id: agencyJSON.hb_id,
      tname: agencyJSON.tname,
      cname: agencyJSON.cname,
      jdt: agencyJSON.jdt,
      mdt: agencyJSON.mod_dt,
      cdt: agencyJSON.cdt,
      m_id: agencyJSON.m_id,
      stat: agencyJSON.stat,
      addr: agencyJSON.addr,
    };
    const agencyUUID = isHf ? agencyData?.id || uuidv4() : uuidv4();
    agencyItem.gen_src = isHf ? "msg_hf" : "app";
    agencyItem.dg = [];
    if (agencyData.dgraph_list && agencyData.dgraph_list.length > 0) {
      agencyData.dgraph_list.forEach((dgraphItem) => {
        agencyItem.dg.push({ q: dgraphItem.qstn_id, a: dgraphItem.option_id });
      });
    }
    const transParams = {
      TransactItems: [],
    };
    // Generate Agency Create JSON
    const agencyCreateItem = {
      id: agencyUUID,
      entity: `agency#${hbId}`,
      data: `agency#${hbId}`,
      ...agencyItem,
    };
    transParams.TransactItems.push({
      Put: {
        TableName: process.env.entitiesTableName /* required */,
        Item: agencyCreateItem,
        ReturnValuesOnConditionCheckFailure: "ALL_OLD",
      },
    });

    // Only do broker create if not isHf
    if (!isHf) {
      // Generate the broker create JSON under the agency
      const validationResp = validateFields("broker", {
        ...brokerData,
        rel_id: agencyUUID,
      }, false, agencyRequiredFields.broker);
      console.log("validationResp broker: ", validationResp);
      if (validationResp === "") {
        const brokerJSON = getBrokerCreateJSON(brokerData);
        const brokerItem = {
          type: brokerJSON.type,
          hb_id: brokerJSON.hb_id,
          fname: brokerJSON.fname,
          lname: brokerJSON.lname,
          fullname: `${brokerJSON.fname} ${brokerJSON.lname}`,
          jdt: brokerJSON.jdt,
          mdt: brokerJSON.mod_dt,
          cdt: brokerJSON.cdt,
          email: brokerJSON.email,
          phone: brokerJSON.phone,
          rel_id: agencyUUID,
          stat: brokerJSON.stat,
          spec: brokerJSON.spec,
        };
        const brokerUUID = uuidv4();
        brokerCreateItem = {
          id: agencyUUID,
          entity: `broker#${hbId}#${brokerUUID}`,
          data: `agency#${hbId}`,
          ...brokerItem,
        };
        transParams.TransactItems.push({
          Put: {
            TableName: process.env.entitiesTableName /* required */,
            Item: brokerCreateItem,
            ReturnValuesOnConditionCheckFailure: "ALL_OLD",
          },
        });
      } else {
        return failure({
          status: false,
          error: "Validation Failed",
          validationResp,
        });
      }
    }

    // Generate Metro Create JSON under the agency
    if (agencyItem.m_id && agencyItem.m_id.length) {
      for (const metroItem of metroItems) {
        // Adding the metro id to the data field and removing the id field
        metroItem.data = metroItem.id;
        delete metroItem.id;
        delete metroItem.entity;

        const metroCreateItem = {
          id: agencyUUID,
          entity: `metro#${hbId}#agency#${metroItem.data}`,
          ...metroItem,
        };
        transParams.TransactItems.push({
          Put: {
            TableName: process.env.entitiesTableName,
            Item: metroCreateItem,
            ReturnValuesOnConditionCheckFailure: "ALL_OLD",
          },
        });
      }
    }
    console.log(`transParams: ${JSON.stringify(transParams)}`);
    const agencyTransactWriteResp = await transactWriteItems(transParams);
    console.log(
      `agencyTransactWriteResp: ${JSON.stringify(agencyTransactWriteResp)}`
    );
    return success({
      status: true,
      item: { ...agencyCreateItem, broker: brokerCreateItem },
    });
  }
  return failure({ status: false, error: "Validation Failed", retVal });
};
const deleteMetroUnderAgency = async (agencyId, hbid, metroObj) => {
  const metroId = metroObj && metroObj.id ? metroObj.id : "";
  const params = {
    TableName: process.env.entitiesTableName,
    Key: {
      id: agencyId,
      entity: `metro#${hbid}#agency#${metroId}`,
    },
  };
  console.log(params);
  return deleteResources(params);
};
const getMetroCreateArr = (type, hbId, metroItems, agencyId) => {
  const metroCreateItemsArr = [];
  for (const metroItem of metroItems) {
    const metroId = metroItem.id;
    delete metroItem.id;
    delete metroItem.entity;
    metroCreateItemsArr.push({
      Put: {
        TableName: process.env.entitiesTableName /* required */,
        Item: {
          id: agencyId,
          entity: `${type}#${hbId}#agency#${metroId}`,
          data: metroId,
          ...metroItem,
        },
        ReturnValuesOnConditionCheckFailure: "ALL_OLD",
      },
    });
  }
  return metroCreateItemsArr;
};
/* const getCommunityIds = async (metroId, communities) => {
  console.log(`metroId: ${metroId}`);
  const commUnderMetro = communities.filter((community) => {
    console.log(`community.rel_id: ${community.rel_id}`);
    return community.rel_id === metroId;
  });
  console.log(`commUnderMetro: ${JSON.stringify(commUnderMetro)}`);
  return commUnderMetro;
}; */
export const updateAgencyMetro = async (obj) => {
  const hbid = obj && obj.hbid ? obj.hbid : "";
  const agencyId = obj && obj.agencyId ? obj.agencyId : "";
  const metroRow = obj && obj.metroRow ? obj.metroRow : [];
  const oldMetrosIdArr = obj && obj.oldm ? obj.oldm : [];
  const metroRowIds = [...metroRow].map((metro) => metro.id);
  const toDeleteMetros = [...oldMetrosIdArr].filter(
    (metroId) => !metroRowIds.includes(metroId)
  );
  const toInsertMetros = [...metroRowIds].filter(
    (metroId) => !oldMetrosIdArr.includes(metroId)
  );

  console.log(`metroRow: ${JSON.stringify(metroRow)}`);
  console.log(`oldMetrosIdArr: ${JSON.stringify(oldMetrosIdArr)}`);
  console.log(`metroRowIds: ${JSON.stringify(metroRowIds)}`);
  console.log(`toDeleteMetros: ${JSON.stringify(toDeleteMetros)}`);
  console.log(`toInsertMetros: ${JSON.stringify(toInsertMetros)}`);

  // Delete the metro resource under the agency
  for (const metro of metroRow) {
    // Check whether this metro is deleted. Only then remove the metro resource from the agency
    if (toDeleteMetros.includes(metro.id)) {
      const deleteMetroResp = await deleteMetroUnderAgency(
        agencyId,
        hbid,
        metro
      );
      console.log(`deleteMetroResp: ${JSON.stringify(deleteMetroResp)}`);
    }
  }
  // Generate the update queries for creating metro resources under the agency
  // Giving only the metro rows which are newly inserted
  const metroCreateItem = getMetroCreateArr(
    "metro",
    hbid,
    [...metroRow].filter((metro) => toInsertMetros.includes(metro.id)),
    agencyId
  );
  const transArr = [...metroCreateItem];
  const transParams = {
    TransactItems: transArr,
  };
  /* const createAgencyUnderMetroResp = await transactWriteItems(transParams);
  console.log(
    `createAgencyUnderMetroResp: ${JSON.stringify(createAgencyUnderMetroResp)}`
  ); */
  return transParams;
};
const fixAgencyUnderRealtor = async () => {
  try {
    // Get all the builders for getting the Pinpoint Application Ids
    const buildersList = await getEntities("builder");
    console.log(`buildersList: ${JSON.stringify(buildersList)}`);

    if (buildersList && buildersList.length) {
      // Get all the realtors under each builders
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
          ":entity": `realtor#${builder.id}`,
        };
        queryList.push(getQueryPromise(params));
      }
      const realtorList = await Promise.all(queryList);
      console.log(`realtorList: ${JSON.stringify(realtorList)}`);
      if (realtorList && realtorList.length) {
        const realtors = [];
        const realtorAgencyIdObj = {};
        const realtorHbidObj = {};
        for (const resp of realtorList) {
          realtors.push(...resp.Items);
        }

        // Check for realtors with corrupt agency resource and fix it
        const agencyRealtorParams = {
          TableName: process.env.entitiesTableName,
          IndexName: process.env.entitiesTableByEntityAndId,
          KeyConditionExpression: "#entity = :entity",
          ExpressionAttributeNames: {
            "#entity": "entity",
          },
        };
        const corruptDataQueryList = [];
        for (const realtor of realtors) {
          realtorAgencyIdObj[realtor.id] = realtor.rel_id;
          realtorHbidObj[realtor.id] = realtor.hb_id;
          agencyRealtorParams.ExpressionAttributeValues = {
            ":entity": `agency#${realtor.hb_id}#realtor#${realtor.id}`,
          };
          corruptDataQueryList.push(getQueryPromise(agencyRealtorParams));
        }
        const corruptAgencyData = await Promise.all(corruptDataQueryList);
        console.log(`corruptAgencyData: ${JSON.stringify(corruptAgencyData)}`);
        const corruptData = [];
        for (const resp of corruptAgencyData) {
          corruptData.push(...resp.Items);
        }
        if (corruptData && corruptData.length) {
          // Update the realtor agency resources to the DB
          const agencyDeleteArr = [];
          const agencyUpdateArr = [];
          for (const corruptDataToUpdate of corruptData) {
            const realtorId = corruptDataToUpdate.id;
            const realtorAgencyEntity = corruptDataToUpdate.entity;
            const realtorHbId = realtorHbidObj[realtorId];
            const realtorAgencyId = realtorAgencyIdObj[realtorId];
            const agencyRow = { ...corruptDataToUpdate };
            delete agencyRow.id;
            delete agencyRow.entity;
            delete agencyRow.data;
            agencyDeleteArr.push({
              Delete: {
                Key: {
                  id: realtorId,
                  entity: realtorAgencyEntity,
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
                  entity: `agency#${realtorHbId}#realtor#${realtorAgencyId}`,
                  data: `realtor#${realtorHbId}`,
                  ...agencyRow,
                },
                ReturnValuesOnConditionCheckFailure: "ALL_OLD",
              },
            });
          }
          const updateAgencyResp = {
            TransactItems: [],
          };
          // Get the delete agency under realtor request array from updateAgencyRequestObj
          updateAgencyResp.TransactItems = [...agencyDeleteArr];
          console.log(`updateAgencyResp: ${JSON.stringify(updateAgencyResp)}`);
          // Do the update agency and delete agency resources under realtor
          const upAgencyDelAgencyUnderRealtorResp = await transactWriteItems(
            updateAgencyResp
          );
          console.log(
            `upAgencyDelAgencyUnderRealtorResp: ${JSON.stringify(
              upAgencyDelAgencyUnderRealtorResp
            )}`
          );

          // Get the put agency under realtor request array from updateAgencyRequestObj
          const updateAgencyUnderRealtorResp = {
            TransactItems: [...agencyUpdateArr],
          };
          // Doing a separate transactWriteItems for this since the API doesn't allow different operations on the same item in one call
          const putAgencyUnderRealtor = await transactWriteItems(
            updateAgencyUnderRealtorResp
          );
          console.log(
            `putAgencyUnderRealtor: ${JSON.stringify(putAgencyUnderRealtor)}`
          );
          return success({ status: true, data: "Updated successfully" });
        }

        return success({
          status: true,
          data: "No realtors to update with invalid agency resource",
        });
      }

      return success({ status: true, data: "No realtors found" });
    }

    return success({ status: true, data: "No builders found" });
  } catch (error) {
    return failure({ status: false, error });
  }
};
const fixBrokerRes = async () => {
  try {
    // Get all the builders for getting the Pinpoint Application Ids
    const buildersList = await getEntities("builder");
    console.log(`buildersList: ${JSON.stringify(buildersList)}`);

    if (buildersList && buildersList.length) {
      // Get all the realtors under each builders
      const params = {
        TableName: process.env.entitiesTableName,
        IndexName: process.env.entitiesTableByDataAndEntity,
        KeyConditionExpression: "#data = :data",
        ExpressionAttributeNames: {
          "#data": "data",
        },
      };
      const queryList = [];
      for (const builder of buildersList) {
        params.ExpressionAttributeValues = {
          ":data": `agency#${builder.id}`,
        };
        queryList.push(getQueryPromise(params));
      }
      const agencyAndBrokerResp = await Promise.all(queryList);
      console.log(
        `agencyAndBrokerResp: ${JSON.stringify(agencyAndBrokerResp)}`
      );
      if (agencyAndBrokerResp && agencyAndBrokerResp.length) {
        const agencyAndBrokers = [];
        for (const resp of agencyAndBrokerResp) {
          agencyAndBrokers.push(...resp.Items);
        }
        // Extract broker resources
        const brokers = agencyAndBrokers.filter((res) => res.type === "broker");
        console.log(`brokers: ${JSON.stringify(brokers)}`);

        // Check for brokers with corrupt data
        const brokerDeleteArr = [];
        for (const broker of brokers) {
          if (broker.entity.includes(broker.rel_id)) {
            // Corrupt data. Delete this.
            brokerDeleteArr.push({
              Delete: {
                Key: {
                  id: broker.id,
                  entity: broker.entity,
                },
                TableName: process.env.entitiesTableName /* required */,
                ReturnValuesOnConditionCheckFailure: "ALL_OLD",
              },
            });
          }
        }
        if (brokerDeleteArr && brokerDeleteArr.length) {
          const updateAgencyResp = {
            TransactItems: [],
          };
          updateAgencyResp.TransactItems = [...brokerDeleteArr];
          console.log(`updateAgencyResp: ${JSON.stringify(updateAgencyResp)}`);
          // Do the delete broker
          const upAgencyDelAgencyUnderRealtorResp = await transactWriteItems(
            updateAgencyResp
          );
          console.log(
            `upAgencyDelAgencyUnderRealtorResp: ${JSON.stringify(
              upAgencyDelAgencyUnderRealtorResp
            )}`
          );
          return success({ status: true, data: "Updated successfully" });
        }

        return success({
          status: true,
          data: "No agencies with corrupt broker found",
        });
      }

      return success({ status: true, data: "No agencies found" });
    }

    return success({ status: true, data: "No builders found" });
  } catch (error) {
    return failure({ status: false, error });
  }
};

const setLambdaARNs = async () => {
  try {
    const stackOutputs = await getStackOutputs({
      StackName,
      outputName: "",
      all: true,
    });
    for (const stackOutput of stackOutputs) {
      switch (stackOutput.OutputKey) {
        case "CommunitiesApiFunctionArn":
          COMMUNITY_LAMBDA_ARN = stackOutput.OutputValue;
          break;
        case "AgenciesApiFunctionArn":
          AGENCIES_LAMBDA_ARN = stackOutput.OutputValue;
          break;
        case "CobuyersApiFunctionArn":
          COBUYER_LAMBDA_ARN = stackOutput.OutputValue;
          break;
        default:
          break;
      }
    }
    console.log(`COMMUNITY_LAMBDA_ARN: ${COMMUNITY_LAMBDA_ARN}`);
    console.log(`AGENCIES_LAMBDA_ARN: ${AGENCIES_LAMBDA_ARN}`);
    console.log(`COBUYER_LAMBDA_ARN: ${COBUYER_LAMBDA_ARN}`);
  } catch (error) {
    console.log("error in setLambdaARNs");
    console.log(error);
  }
};

export const updateAgencyRow = async (data) => {
  const metroRow = data.metro ? data.metro : [];
  const oldm = data.oldm ? data.oldm : [];
  const agencyUpdateItem = {
    type: "agency",
    id: data.id,
    hb_id: data.hb_id,
    tname: data.tname,
    cname: data.cname,
    jdt: data.jdt,
    mdt: Date.now(),
    cdt: data.cdt,
    m_id: data.m_id,
    stat: data.stat,
    entity: `agency#${data.hb_id}`,
    data: `agency#${data.hb_id}`,
    dg: [],
    addr: data?.addr || "",
  };
  agencyUpdateItem.gen_src = "app";
  console.log(`agencyUpdateItem: ${JSON.stringify(agencyUpdateItem)}`);
  if (data.dgraph_list && data.dgraph_list.length > 0) {
    data.dgraph_list.forEach((dgraphItem) => {
      agencyUpdateItem.dg.push({
        q: dgraphItem.qstn_id,
        a: dgraphItem.option_id,
      });
    });
  }
  console.log(
    `agencyUpdateItem after dg insert: ${JSON.stringify(agencyUpdateItem)}`
  );
  const updateAgencyResp = await updateAgencyMetro({
    metroRow,
    oldm,
    hbid: data.hb_id,
    agencyId: data.id,
  });
  // get Agency
  const getAgencyparams = {
    TableName: process.env.entitiesTableName,
    KeyConditionExpression: "#id = :id and #entity = :entity",
    ExpressionAttributeNames: {
      "#id": "id",
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":id": data.id,
      ":entity": `agency#${data.hb_id}`,
    },
  };

  const agency = await getResourceJSON(getAgencyparams);
  // invoke the metroUpdate step function to add metros in realtor rows
  if (
    agency &&
    agency.length &&
    utils.findArraySymmetricDifference(data.m_id, agency[0].m_id).diff.length
  ) {
    await setLambdaARNs();

    const input = JSON.stringify({
      hb_id: data.hb_id,
      purpose: "metroUpdation",
      type: "realtor",
      filter: { agencyId: data.id },
      communityLambdaArn: COMMUNITY_LAMBDA_ARN,
      agencyLambdaArn: AGENCIES_LAMBDA_ARN,
      coBuyerLambdaArn: COBUYER_LAMBDA_ARN,
    });

    const params = {
      input,
      stateMachineArn: ENDPOINT_UPDATE_MACHINE_ARN,
    };

    console.log(`params: ${JSON.stringify(params)}`);
    const startExecutionResp = await sfn.startExecution(params).promise();
    console.log(`startExecutionResp: ${JSON.stringify(startExecutionResp)}`);
  }

  // Do broker Update Row
  console.log(`data.broker: ${JSON.stringify(data.broker)}`);
  const brokerData = {
    ...data.broker,
    fullname: `${data?.broker?.fname || ""} ${data?.broker?.lname || ""}`,
  };
  console.log(`brokerData: ${JSON.stringify(brokerData)}`);
  const brokerId = data.broker.id;
  console.log(`brokerId: ${brokerId}`);
  delete brokerData.id;
  console.log(`brokerId: ${brokerId}`);
  updateAgencyResp.TransactItems.unshift({
    Put: {
      TableName: process.env.entitiesTableName,
      Item: {
        id: data.id,
        entity: `broker#${data.hb_id}#${brokerId}`,
        data: `agency#${data.hb_id}`,
        ...brokerData,
      },
      ReturnValuesOnConditionCheckFailure: "ALL_OLD",
    },
  });
  // Do Agency Update Row
  updateAgencyResp.TransactItems.unshift({
    Put: {
      TableName: process.env.entitiesTableName,
      Item: agencyUpdateItem,
      ReturnValuesOnConditionCheckFailure: "ALL_OLD",
    },
  });
  console.log(`updateAgencyResp: ${JSON.stringify(updateAgencyResp)}`);
  // Delete the agency resource under the realtor
  const updateRealtorUnderAgencyEvent = {
    httpMethod: "POST",
    pathParameters: {
      action: "upagrel",
    },
    body: JSON.stringify({
      agencyId: data.id,
      hbid: data.hb_id,
      agencyRow: { ...agencyUpdateItem },
    }),
  };
  console.log(
    `updateRealtorUnderAgencyEvent: ${JSON.stringify(
      updateRealtorUnderAgencyEvent
    )}`
  );
  console.log(`REALTOR_LAMBDA_ARN: ${REALTOR_LAMBDA_ARN}`);
  // Asynchronously invoking realtor lambda to delete the realtors
  const agencyRealtorUpdateRes = await invokeLambda(
    REALTOR_LAMBDA_ARN,
    updateRealtorUnderAgencyEvent,
    true
  );
  console.log(
    `agencyRealtorUpdateRes: ${JSON.stringify(agencyRealtorUpdateRes)}`
  );
  /* const updateAgencyRequestObj = await updateAgencyUnderRealtor({
    agencyId: data.id,
    hbid: data.hb_id,
    agencyRow: { ...agencyUpdateItem },
  });

  // Get the delete agency under realtor request array from updateAgencyRequestObj
  const updateAgencyArr = updateAgencyRequestObj.agencyDeleteArr
    ? updateAgencyRequestObj.agencyDeleteArr
    : [];
  console.log(`updateAgencyArr: ${JSON.stringify(updateAgencyArr)}`);
  updateAgencyResp.TransactItems = [
    ...updateAgencyResp.TransactItems,
    ...updateAgencyArr,
  ];
  console.log(`updateAgencyResp: ${JSON.stringify(updateAgencyResp)}`); */

  // Do the update agency
  const updateAgencyAndBrokerResp = await transactWriteItems(updateAgencyResp);
  console.log(
    `updateAgencyAndBrokerResp: ${JSON.stringify(updateAgencyAndBrokerResp)}`
  );

  // Get the put agency under realtor request array from updateAgencyRequestObj
  /* const agencyUpdateArr = updateAgencyRequestObj.agencyUpdateArr
    ? updateAgencyRequestObj.agencyUpdateArr
    : [];
  console.log(`agencyUpdateArr: ${JSON.stringify(agencyUpdateArr)}`);
  const updateAgencyUnderRealtorResp = {
    TransactItems: [...agencyUpdateArr],
  };
  // Doing a separate transactWriteItems for this since the API doesn't allow different operations on the same item in one call
  const putAgencyUnderRealtor = await transactWriteItems(
    updateAgencyUnderRealtorResp
  );
  console.log(
    `putAgencyUnderRealtor: ${JSON.stringify(putAgencyUnderRealtor)}`
  ); */
  return updateAgencyAndBrokerResp;
};
export const getAgencyBrokersElastic = async (data) => {
  const { hbId = "", agencyIds = [] } = data;
  let brokersGetQuery = {};
  let brokers;
  try {
    // Add agency ids in the query
    const brokerAgencyIdQuery = agencyIds.map((agencyId) => ({
      match: {
        "rel_id.keyword": agencyId,
      },
    }));
    console.log(`brokerAgencyIdQuery: ${JSON.stringify(brokerAgencyIdQuery)}`);
    // Get agency brokers
    brokersGetQuery = {
      httpMethod: "POST",
      requestPath: "/_search",
      payload: {
        query: {
          bool: {
            must: [
              {
                bool: {
                  should: brokerAgencyIdQuery,
                },
              },
              {
                match: {
                  "hb_id.keyword": hbId,
                },
              },
              {
                prefix: {
                  "entity.keyword": `broker#${hbId}#`,
                },
              },
            ],
          },
        },
        size: agencyIds.length,
      },
    };

    // Get the brokers
    console.log(`brokersGetQuery: ${JSON.stringify(brokersGetQuery)}`);
    const brokerGetResults = await elasticExecuteQuery(brokersGetQuery, true);
    console.log(`brokerGetResults: ${JSON.stringify(brokerGetResults)}`);
    if (
      brokerGetResults &&
      brokerGetResults.statusCode === 200 &&
      brokerGetResults.body &&
      brokerGetResults.body.hits &&
      brokerGetResults.body.hits.hits
    ) {
      const { hits } = brokerGetResults.body.hits;
      const resultLength = hits.length;
      console.log(`resultLength: ${resultLength}`);
      const brokersArr = resultLength
        ? hits.map((broker) => broker._source)
        : [];
      let brokerObjArr = [];
      brokers = agencyIds.reduce((brokersObj, agencyId) => {
        if (!brokersObj[agencyId]) brokersObj[agencyId] = {};
        brokerObjArr = brokersArr.filter(
          (broker) => broker.rel_id === agencyId
        );
        brokersObj[agencyId] = brokerObjArr?.length ? brokerObjArr[0] : {};
        console.log(`brokersObj: ${JSON.stringify(brokersObj)}`);
        return brokersObj;
      }, {});
    }
    return { status: true, data: brokers };
  } catch (error) {
    console.log(`Error in getAgencyBrokersElastic`);
    console.log(error);
    return { status: false, error };
  }
};
/**
 * List agency API with pagination and sorting from Elasticsearch
 */
export const listAgencyElastic = async (data) => {
  try {
    const {
      hb_id: hbId = "",
      from = 0,
      size = 5,
      sort = [],
      filterKey = "",
      searchKey = "",
      after = [],
    } = data;
    let agencySearchQuery = {};
    // Get agency list
    const agencyListQuery = {
      httpMethod: "POST",
      requestPath: "/_search",
      payload: {
        query: {
          bool: {
            must: [
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
        size,
        from,
      },
    };
    // Get search query if searchKey is provided
    if (searchKey && filterKey) {
      agencySearchQuery = getSearchQuery({
        filterKey,
        searchKey,
        type: "agency",
      });
      console.log(`agencySearchQuery: ${JSON.stringify(agencySearchQuery)}`);
      agencyListQuery.payload.query.bool.must.push(agencySearchQuery);
    }
    // Add sort field if supplied in the request
    if (sort.length) {
      agencyListQuery.payload.sort = [];
      for (const sortField of sort) {
        // sortField = {"field": "email", "order": "asc/desc"}
        agencyListQuery.payload.sort.push({
          [`${sortField.field}${sortField.field !== "cdt" && sortField.field !== "mdt"
              ? ".keyword"
              : ""
            }`]: {
            order: sortField.order,
            missing: "_last",
            unmapped_type: "string",
          },
        });
      }
      // Adding the id field as the tie-breaker field for sorting.
      agencyListQuery.payload.sort.push({
        "id.keyword": "asc",
      });
    }
    // If after is provided and the from + size is greater than 10000, use the search_after parameter in the query.
    // This is done because of the index.max-result-window limit of 10000 set by Elasticsearch.
    if (from + size > 10000 && after.length) {
      agencyListQuery.payload.search_after = after;
      // In this case we should set from as 0
      agencyListQuery.payload.from = 0;
    }
    console.log(`agencyListQuery: ${JSON.stringify(agencyListQuery)}`);
    const agencyList = await elasticExecuteQuery(agencyListQuery, true);
    console.log(`agencyList: ${JSON.stringify(agencyList)}`);

    if (
      agencyList &&
      agencyList.statusCode === 200 &&
      agencyList.body &&
      agencyList.body.hits &&
      agencyList.body.hits.hits
    ) {
      const { hits } = agencyList.body.hits;
      const resultLength = hits.length;
      const totalResults = agencyList.body.hits.total;
      console.log(`resultLength: ${resultLength}`);
      console.log(`totalResults: ${totalResults}`);
      const agencies = resultLength
        ? hits.map((agency) => {
          const agencyObj = {
            ...agency._source,
            _score: agency._score,
          };
          return agencyObj;
        })
        : [];
      // Filter unwanted realtor resources which are part of some other resources
      const agenciesWithoutBroker = agencies.filter((resource) => {
        if (resource.entity.includes(`#realtor#`)) {
          return false;
        }
        return true;
      });

      // Get the brokers
      const agencyIds = agenciesWithoutBroker.map((agency) => agency.id);
      const brokersResult = await getAgencyBrokersElastic({ hbId, agencyIds });
      console.log(`brokersResult: ${JSON.stringify(brokersResult)}`);
      const { status, error, data: brokers } = brokersResult;
      console.log(`brokers: ${JSON.stringify(brokers)}`);
      if (status) {
        // Combine the agency and broker resources for sending the response
        let agencyArr = [];
        if (agenciesWithoutBroker.length) {
          agencyArr = agenciesWithoutBroker.map((agencyObj) => {
            console.log(`agencyObj: ${JSON.stringify(agencyObj)}`);
            console.log(`agencyObj.id: ${agencyObj.id}`);
            console.log(`brokers[agencyObj.id]: ${brokers[agencyObj.id]}`);
            // Set the broker object in broker key of agency
            agencyObj.broker = brokers[agencyObj.id];
            return agencyObj;
          });
          agencyArr = agencyArr.filter((agency) => agency || false);
          console.log(`agencyArr: ${JSON.stringify(agencyArr)}`);
        }
        const afterNext =
          resultLength && sort.length ? [...hits[resultLength - 1].sort] : [];
        const hasAfter = from + size < totalResults;
        return success({
          result: agencyArr,
          after: afterNext,
          hasAfter,
          totalResults,
        });
      }
      console.log(`error in brokersResult`);
      console.log(error);
      return failure({ status: false, error: "Agency List Failed" });
    }
    return failure(agencyList);
  } catch (error) {
    console.log(`error`);
    console.log(error);
    return failure(error);
  }
};
const getAgenciesWithBroker = async (params) => {
  const agencyWithBrokerResp = await getResourceJSON(params);
  const agencyWithBroker = agencyWithBrokerResp.filter((resource) => {
    if (
      resource.entity.includes(`#realtor#`) ||
      resource.entity.includes(`#agency#`)
    ) {
      return false;
    }
    return true;
  });
  let agencyArr = [];
  if (agencyWithBroker.length) {
    agencyArr = agencyWithBroker.map((agencyOrBroker) => {
      if (agencyOrBroker.entity.indexOf("agency#") !== -1) {
        // if agency, set the broker object in broker key of agency
        agencyOrBroker.broker = agencyWithBroker.filter((broker) => {
          if (
            broker.entity.indexOf("broker#") !== -1 &&
            broker.id === agencyOrBroker.id
          ) {
            // if broker object and broker id = agency id (partition key)
            return true;
          }
          return false;
        });
        // Make broker array of length 1 as an object
        agencyOrBroker.broker = { ...agencyOrBroker.broker[0] };
        return agencyOrBroker;
      }
      return false;
    });
    agencyArr = agencyArr.filter((agency) => agency || false);
    return success(agencyArr);
  }

  return success(agencyWithBroker);
};
const listAgencies = async (event) => {
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
      ":data": `agency#${hbidParam}`,
    },
  };
  console.log(params);
  return getAgenciesWithBroker(params);
};
/* const getAgencyData = async (metros) => {
    let agencyDetailsArr = [];
    let AttributeValuesObject = {
        ":type": "agency",
        ":metroVal": ''
    };
    let params = {
        TableName: process.env.entitiesTableName,
        IndexName: process.env.entitiesTableByType,
        KeyConditionExpression: "#type = :type",
        FilterExpression: "contains (#m_id, :metroVal)",
        ExpressionAttributeNames: {
            "#type": "type",
            "#m_id": "m_id"
        },
        ExpressionAttributeValues: {}
    };
    for (let metroId of metros) {
        AttributeValuesObject[':metroVal'] = metroId;
        params.ExpressionAttributeValues = AttributeValuesObject;
        console.log(params);
        const agencyDetails = await getResources(params);
        console.log(`agencyDetails: ${JSON.stringify(agencyDetails)}`);
        const agencyDetailObj = agencyDetails ? JSON.parse(agencyDetails.body) : {};
        console.log(`agencyDetailObj: ${JSON.stringify(agencyDetailObj)}`);
        agencyDetailsArr = [...agencyDetailsArr, ...agencyDetailObj];
    }
    // returning the agency id array without any duplicates
    return [...new Set(agencyDetailsArr)];
} */
/* export async function getAgenciesByMetroList(metros) {
    console.log("getAgenciesByIdList");
    const agencyDataWithMetros = await getAgencyData(metros);
    console.log(`agencyDataWithMetros: ${JSON.stringify(agencyDataWithMetros)}`);
    return agencyDataWithMetros;
} */
/* export async function getAgencyForRealtor(idParam) {
    console.log("In getAgencyForRealtor");
    console.log("idParam: " + idParam);
    const params = {
        TableName: process.env.entitiesTableName,
        KeyConditionExpression: "#id = :id and #type = :type",
        ExpressionAttributeNames: {
            "#id": "id",
            "#type": "type"
        },
        ExpressionAttributeValues: {
            ":id": idParam,
            ":type": 'agency'
        }
    };
    console.log(params);
    return getResources(params);
} */
export const getAgency = async (event) => {
  console.log("In getAgency");
  console.log(`event: ${JSON.stringify(event)}`);
  const idParam =
    event && event.pathParameters && event.pathParameters.id
      ? event.pathParameters.id
      : 0;
  console.log(`idParam: ${idParam}`);
  const params = {
    TableName: process.env.entitiesTableName,
    KeyConditionExpression: "#id = :id",
    ExpressionAttributeNames: {
      "#id": "id",
    },
    ExpressionAttributeValues: {
      ":id": idParam,
    },
  };
  console.log(params);
  return getAgenciesWithBroker(params);
};

const getAgencyJSON = async (data) => {
  try {
    console.log("In getAgencyJSON");
    console.log(`data: ${JSON.stringify(data)}`);
    const { id } = data;
    console.log(`id: ${id}`);
    const params = {
      TableName: process.env.entitiesTableName,
      KeyConditionExpression: "#id = :id",
      ExpressionAttributeNames: {
        "#id": "id",
      },
      ExpressionAttributeValues: {
        ":id": id,
      },
    };
    console.log(params);
    const agencyWithBrokerResp = await getResourceJSON(params);
    if (agencyWithBrokerResp && agencyWithBrokerResp.length) {
      const agencyDetails = agencyWithBrokerResp.filter((resource) => {
        if (resource.entity.startsWith(`agency#`)) {
          return true;
        }
        return false;
      });
      console.log(`agencyDetails: ${JSON.stringify(agencyDetails)}`);
      return (agencyDetails && agencyDetails.length && agencyDetails[0]) || {};
    }
    return [];
  } catch (error) {
    console.log(`getAgencyPure error: ${JSON.stringify(error)}`);
    return {};
  }
};

export const updateAgency = async (data) => {
  const id = data.id ? data.id : 0;
  const propName = data.attrn ? data.attrn : "";
  const propVal = data.attrv ? data.attrv : "";
  const hbid = data.hb_id ? data.hb_id : "";
  const oldm = data.oldm ? data.oldm : [];
  const metroRow = data.metro ? data.metro : [];
  const modDt = Date.now();

  const agencyUpdateParams = {
    TableName: process.env.entitiesTableName,
    Key: {
      id,
      entity: `agency#${hbid}`,
    },
    UpdateExpression: `set #propName = :pval, mdt = :modDate`,
    ExpressionAttributeNames: {
      "#propName": propName,
    },
    ExpressionAttributeValues: {
      ":pval": propVal,
      ":modDate": modDt,
    },
    ReturnValuesOnConditionCheckFailure: "ALL_OLD",
  };
  console.log(`agencyUpdateParams: ${JSON.stringify(agencyUpdateParams)}`);
  let updateAgencyResp = {};

  if (propName === "m_id") {
    updateAgencyResp = await updateAgencyMetro({
      metroRow,
      oldm,
      hbid,
      agencyId: id,
    });

    // invoke the metroUpdate step function to add metros in realtor rows
    await setLambdaARNs();

    const input = JSON.stringify({
      hb_id: hbid,
      purpose: "metroUpdation",
      type: "realtor",
      filter: { agencyId: id },
      communityLambdaArn: COMMUNITY_LAMBDA_ARN,
      agencyLambdaArn: AGENCIES_LAMBDA_ARN,
      coBuyerLambdaArn: COBUYER_LAMBDA_ARN,
    });

    const params = {
      input,
      stateMachineArn: ENDPOINT_UPDATE_MACHINE_ARN,
    };

    console.log(`params: ${JSON.stringify(params)}`);
    const startExecutionResp = await sfn.startExecution(params).promise();
    console.log(`startExecutionResp: ${JSON.stringify(startExecutionResp)}`);
  } else {
    updateAgencyResp = {
      TransactItems: [],
    };
  }
  console.log(`before agency update params`);
  // Do Agency Update Row
  updateAgencyResp.TransactItems.unshift({
    Update: agencyUpdateParams,
  });
  console.log(`before updateAgencyUnderRealtor`);
  // Delete the agency resource under the realtor
  /* const updateAgencyRequestObj = await updateAgencyUnderRealtor({
    agencyId: id,
    hbid,
    agencyRow: agencyUpdateItem,
    propName,
    propVal,
  });
  console.log(
    `updateAgencyRequestObj: ${JSON.stringify(updateAgencyRequestObj)}`
  ); */
  const agencyUpdateItem = await getAgencyJSON({ id });
  console.log(`agencyUpdateItem: ${JSON.stringify(agencyUpdateItem)}`);
  // Delete the agency resource under the realtor
  const updateRealtorUnderAgencyEvent = {
    httpMethod: "POST",
    pathParameters: {
      action: "upagrel",
    },
    body: JSON.stringify({
      agencyId: id,
      hbid,
      agencyRow: agencyUpdateItem,
      propName,
      propVal,
    }),
  };
  console.log(
    `updateRealtorUnderAgencyEvent: ${JSON.stringify(
      updateRealtorUnderAgencyEvent
    )}`
  );
  console.log(`REALTOR_LAMBDA_ARN: ${REALTOR_LAMBDA_ARN}`);
  // Asynchronously invoking realtor lambda to delete the realtors
  const agencyRealtorUpdateRes = await invokeLambda(
    REALTOR_LAMBDA_ARN,
    updateRealtorUnderAgencyEvent,
    true
  );
  console.log(
    `agencyRealtorUpdateRes: ${JSON.stringify(agencyRealtorUpdateRes)}`
  );

  // Get the delete agency under realtor request array from updateAgencyRequestObj
  /* const updateAgencyArr = updateAgencyRequestObj.agencyDeleteArr
    ? updateAgencyRequestObj.agencyDeleteArr
    : [];
  console.log(`updateAgencyArr: ${JSON.stringify(updateAgencyArr)}`);
  updateAgencyResp.TransactItems = [
    ...updateAgencyResp.TransactItems,
    ...updateAgencyArr,
  ];
  console.log(`updateAgencyResp: ${JSON.stringify(updateAgencyResp)}`); */
  // Do the update agency and delete agency resources under realtor
  const updateAgencyResponse = await transactWriteItems(updateAgencyResp);
  console.log(`updateAgencyResponse: ${JSON.stringify(updateAgencyResponse)}`);

  // Get the put agency under realtor request array from updateAgencyRequestObj
  /* const agencyUpdateArr = updateAgencyRequestObj.agencyUpdateArr
    ? updateAgencyRequestObj.agencyUpdateArr
    : [];
  console.log(`agencyUpdateArr: ${JSON.stringify(agencyUpdateArr)}`);
  const updateAgencyUnderRealtorResp = {
    TransactItems: [...agencyUpdateArr],
  };
  // Doing a separate transactWriteItems for this since the API doesn't allow different operations on the same item in one call
  const putAgencyUnderRealtor = await transactWriteItems(
    updateAgencyUnderRealtorResp
  );
  console.log(
    `putAgencyUnderRealtor: ${JSON.stringify(putAgencyUnderRealtor)}`
  ); */
  return updateAgencyResponse;
};
const getRealtorsUnderAgency = async (data, isJSONOnly) => {
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
  params.ExpressionAttributeValues[":entity"] = `realtor#${hbId}#agency`;
  if (isJSONOnly) {
    return getResourceJSON(params);
  }

  return getResources(params);
};
const getAgencyBroker = async (data) => {
  const { agencyId = "", hbId = "", isJSONOnly = false } = data;
  try {
    const params = {
      TableName: process.env.entitiesTableName,
      ExpressionAttributeNames: {
        "#id": "id",
        "#entity": "entity",
      },
      ExpressionAttributeValues: {
        ":id": agencyId,
      },
    };
    params.KeyConditionExpression =
      "#id = :id and begins_with(#entity ,:entity)";
    params.ExpressionAttributeValues[":entity"] = `broker#${hbId}#`;
    if (isJSONOnly) {
      return getResourceJSON(params);
    }
    return getResources(params);
  } catch (error) {
    console.log(`Exception occured in getAgencyBroker`);
    console.log(error);
    return [];
  }
};
export const deleteAgency = async (data) => {
  const id = data.id ? data.id : 0;
  const hbid = data.hb_id ? data.hb_id : 0;
  const metroIds = data.m_id ? data.m_id : [];

  console.log(`deleteAgency :: ${JSON.stringify(data)}`);
  
  // If the agency has any realtors under it, don't delete the agency.
  const realtorCountQuery = {
    httpMethod: "POST",
    requestPath: "/_count",
    payload: {
      query: {
        bool: {
          must: [
            {
              match: {
                "entity.keyword": `realtor#${hbid}`,
              },
            },
            {
              match: {
                "rel_id.keyword": id,
              },
            },
          ],
        },
      },
    },
  };

  const realtorCount = await elasticExecuteQuery(realtorCountQuery, true);

  console.log("realtorCount==>", realtorCount);

  if (!realtorCount.status) {
    return failure({
      status: false,
      error: "Agency Realtor count fetching Failed",
    });
  }

  if (realtorCount?.body?.count) {
    return failure({
      status: false,
      error:
        "Unable to delete.One or more Realtors are assigned to this Agency.",
    });
  }

  const brokerResp = await getAgencyBroker({
    agencyId: id,
    hbId: hbid,
    isJSONOnly: true,
  });
  console.log(`brokerResp: ${JSON.stringify(brokerResp)}`);
  const brokerEntity =
    brokerResp && brokerResp?.length ? brokerResp[0]?.entity : "";
  console.log(`brokerEntity: ${brokerEntity}`);
  const brokerIdArr = brokerEntity.split(`broker#${hbid}#`);
  console.log(`brokerIdArr: ${JSON.stringify(brokerIdArr)}`);
  const brokerId = brokerIdArr && brokerIdArr?.length > 1 ? brokerIdArr[1] : "";
  console.log(`brokerId: ${brokerId}`);

  const deleteMetroArr = metroIds.map((metroId) => ({
    Delete: {
      Key: {
        id,
        entity: `metro#${hbid}#agency#${metroId}`,
      },
      TableName: process.env.entitiesTableName /* required */,
      ReturnValuesOnConditionCheckFailure: "ALL_OLD",
    },
  }));
  // Delete agency resources under realtors and realtor resources under this agency
  // Get all the realtors under this agency
  const realtorsUnderAgencyResp = await getRealtorsUnderAgency(
    { hb_id: hbid, rel_id: id },
    true
  );
  console.log(
    `realtorsUnderAgencyResp: ${JSON.stringify(realtorsUnderAgencyResp)}`
  );

  // Delete agency row under the realtor and realtor item under the agency
  const deleteAgencyRealtorArr = realtorsUnderAgencyResp.map((realtorItem) => ({
    Delete: {
      Key: {
        id: realtorItem.data,
        entity: `agency#${hbid}#realtor#${id}`,
      },
      TableName: process.env.entitiesTableName /* required */,
      ReturnValuesOnConditionCheckFailure: "ALL_OLD",
    },
  }));
  console.log(
    `deleteAgencyRealtorArr: ${JSON.stringify(deleteAgencyRealtorArr)}`
  );
  const deleteRealtorAgencyArr = realtorsUnderAgencyResp.map((agencyItem) => ({
    Delete: {
      Key: {
        id,
        entity: `realtor#${hbid}#agency#${agencyItem.data}`,
      },
      TableName: process.env.entitiesTableName /* required */,
      ReturnValuesOnConditionCheckFailure: "ALL_OLD",
    },
  }));
  console.log(
    `deleteRealtorAgencyArr: ${JSON.stringify(deleteRealtorAgencyArr)}`
  );
  const transArr = [
    {
      Delete: {
        Key: {
          id,
          entity: `agency#${hbid}`,
        },
        TableName: process.env.entitiesTableName,
        ReturnValuesOnConditionCheckFailure: "ALL_OLD",
      },
    },
    {
      Delete: {
        Key: {
          id,
          entity: `broker#${hbid}#${brokerId}`,
        },
        TableName: process.env.entitiesTableName,
        ReturnValuesOnConditionCheckFailure: "ALL_OLD",
      },
    },
    ...deleteMetroArr,
    ...deleteAgencyRealtorArr,
    ...deleteRealtorAgencyArr,
  ];
  console.log(`transArr: ${JSON.stringify(transArr)}`);
  const transParams = {
    TransactItems: transArr,
  };
  console.log(`transParams: ${JSON.stringify(transParams)}`);
  return transactWriteItems(transParams);
};

const bulkDeleteAgencies = async (data) => {

  const deleteBulkAgencyStateMachineArn = process.env.AGENCIES_BULK_DELETE_MACHINE_ARN

  const timeRangeStart = data?.start_time
  const timeRangeEnd = data?.end_time
  const hbId = data?.hb_id

  try {
    const elasticParams = {
      hb_id: hbId,
      projectFields: ["id", "m_id"],
      sort: [{ field: "id", order: "asc" }],
      isCustomParam: true,
      customParams: [
        {
          "bool": {
            must: [
              {
                term: { "hb_id.keyword": hbId, }
              },
              {
                term: { "entity.keyword": `agency#${hbId}` }
              },
              {
                "range": {
                  "cdt": {
                    "gte": timeRangeStart,
                    "lte": timeRangeEnd,
                  }
                }
              }
            ]
          }
        }
      ]
    }
    console.log(`bulkDeleteAgencies :: elasticParams :: ${JSON.stringify(elasticParams)}`);
    
    const agencyResp = await doPaginatedQueryEllastic({ ...elasticParams })

    const deleteBatchCount = 25

    if (agencyResp?.length) {
      const chunkArrayIntoBatches = (array, chunkSize = deleteBatchCount) => {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
          chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
      }

      const agencyChunks = chunkArrayIntoBatches(agencyResp);

      console.log(`bulkDeleteAgencies :: chunkLength :: ${agencyChunks.length}`);
      console.log(`bulkDeleteAgencies :: chunks :: ${agencyChunks}`);
      
      for (const chunk of agencyChunks) {
        const stateMachineExecutionParams = {
          stateMachineArn: deleteBulkAgencyStateMachineArn,
          input: JSON.stringify({ items: chunk, hb_id: hbId })
        }
        try {
          const executionResult = await sfn.startExecution(stateMachineExecutionParams).promise();
          console.log('State machine execution started:', executionResult);
        } catch (error) {
          console.log("Error in state machine execution", error);
          throw error;
        }
      }
      return success({
        status: true,
        message: `Deleted ${agencyResp.length} agencie(s).`
      });
    }
    return success({
      status: true,
      message: "No agencies found for the given date range"
    });

  } catch (error) {
    console.log("Cant bulk delete agencies ", error)
    return failure({ status: false, error });
  }
}

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
          response = await listAgencies(event);
        } else if (action === "get") {
          response = await getAgency(event);
        } else {
          response = failure();
        }
        break;
      case "POST":
        data = JSON.parse(event.body);
        if (!data) {
          response = failure();
        } else if (action === "create") {
          response = await createAgency(data);
        } else if (action === "list") {
          response = await listAgencyElastic(data);
        } else if (action === "update") {
          response = await updateAgency(data);
        } else if (action === "delete") {
          response = await deleteAgency(data, event);
        } else if (action === "realtors") {
          response = await getRealtorsUnderAgency(data);
        } else if (action === "fixagdata") {
          response = await fixAgencyUnderRealtor();
        } else if (action === "fixbrdata") {
          response = await fixBrokerRes();
        } else if (action === "bulkRemoveAgencies") {
          response = await bulkDeleteAgencies(data);
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
