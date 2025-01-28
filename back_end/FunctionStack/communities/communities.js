import "../../NPMLayer/nodejs.zip";
// import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import AWS from "aws-sdk";

import {
  getResourceJSON,
  getResources,
  transactWriteItems,
  updateResources,
  getParamsForQuery,
  getQueryPromise,
  updateOrder,
  listOrder,
  combineOrder,
  initListAPI,
  getEntityByIdsElastic,
  getStackOutputs,
} from "../libs/db";
import { success, failure } from "../libs/response-lib";
import { deleteLot, listLot } from "../lot/lot";
import { deletePlan, listPlan } from "../plan/plan";

const sfn = new AWS.StepFunctions();

const { StackName, ENDPOINT_UPDATE_MACHINE_ARN } = process.env;
let COMMUNITY_LAMBDA_ARN = "";
let AGENCIES_LAMBDA_ARN = "";
let COBUYER_LAMBDA_ARN = "";

// const dynamoDb = new AWS.DynamoDB.DocumentClient();
const listCommunities = async (event, isJSONOnly, isExternalAPI) => {
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
      ":entity": `community#${hbidParam}`,
    },
  };
  console.log(params);
  if (isJSONOnly) {
    return getResourceJSON(params);
  }

  if (isExternalAPI) {
    const listCommResp = await getResourceJSON(params);
    // Only fetch id, name and any other important fields only
    const commList = listCommResp.map((item) => ({
      id: item.id,
      name: item.name,
      active: item.isActive,
    }));
    return success(commList);
  }

  const combineOrderRes = await combineOrder("community", hbidParam, params);
  return combineOrderRes;
};
export const listCommunitiesElastic = async (data) => {
  let list;
  try {
    list = await initListAPI({ ...data, entity: "community" });
  } catch (error) {
    return failure({ status: false, error: "Community list failed." });
  }
  return list;
};
// export const getRealtorsAssoWithMetro = async (
//   hbid,
//   relId,
//   isDelete,
//   commUUID
// ) => {
//   // Check for realtors under the agencies associated with this metro
//   // metro#5f25bb50-3d14-11ea-b62f-b9dbb0008371#agency#d3835020-3d14-11ea-b909-ad6a317b1cb0
//   // Get all agencies with this metro
//   console.log(`hbid: ${hbid}`);
//   console.log(`relId: ${relId}`);
//   console.log(`isDelete: ${isDelete}`);
//   console.log(`commUUID: ${commUUID}`);
//   let realtorsArr = [];
//   if (isDelete) {
//     const communityRealtors = {
//       TableName: process.env.entitiesTableName,
//       KeyConditionExpression: "#id = :id and begins_with(#entity, :entity)",
//       ExpressionAttributeNames: {
//         "#id": "id",
//         "#entity": "entity",
//       },
//       ExpressionAttributeValues: {
//         ":id": commUUID,
//         ":entity": `realtor#${hbid}#community#`,
//       },
//     };
//     console.log(communityRealtors);
//     realtorsArr = await getResourceJSON(communityRealtors);
//     console.log(`realtorsArr: ${JSON.stringify(realtorsArr)}`);
//   } else {
//     const metroAgencyParams = {
//       TableName: process.env.entitiesTableName,
//       IndexName: process.env.entitiesTableByEntityAndId,
//       KeyConditionExpression: "#entity = :entity",
//       ExpressionAttributeNames: {
//         "#entity": "entity",
//       },
//       ExpressionAttributeValues: {
//         ":entity": `metro#${hbid}#agency#${relId}`,
//       },
//     };
//     console.log(metroAgencyParams);
//     const metroAgencyItems = await getResourceJSON(metroAgencyParams);
//     console.log(`metroAgencyItems: ${JSON.stringify(metroAgencyItems)}`);
//     // Get the realtors associated with this agency
//     // realtor#5f25bb50-3d14-11ea-b62f-b9dbb0008371#agency#1ea0be80-3d15-11ea-bfd7-a1ca4ff7161f
//     let agencyRealtorParams;
//     const realtorByAgencyReqArr = [];
//     for (const agency of metroAgencyItems) {
//       console.log(`agency: ${agency}`);
//       agencyRealtorParams = {
//         TableName: process.env.entitiesTableName,
//         KeyConditionExpression: "#id = :id and begins_with(#entity, :entity)",
//         ExpressionAttributeNames: {
//           "#id": "id",
//           "#entity": "entity",
//         },
//         ExpressionAttributeValues: {
//           ":id": agency.id,
//           ":entity": `realtor#${hbid}#agency#`,
//         },
//       };
//       console.log(
//         `agencyRealtorParams: ${JSON.stringify(agencyRealtorParams)}`
//       );
//       realtorByAgencyReqArr.push(dynamoDb.query(agencyRealtorParams).promise());
//     }
//     const agencyRealtorArr = await Promise.all(realtorByAgencyReqArr);
//     console.log(`agencyRealtorArr: ${JSON.stringify(agencyRealtorArr)}`);
//     for (const resp of agencyRealtorArr) {
//       realtorsArr.push(...resp.Items);
//     }
//     realtorsArr = realtorsArr.filter(
//       (realtor, index, self) =>
//         self.findIndex((rtr) => rtr.entity === realtor.entity) === index
//     );
//     console.log(`realtorsArr: ${JSON.stringify(realtorsArr)}`);
//   }
//   const transArr = [];
//   for (const realtor of realtorsArr) {
//     const realtorUUID = realtor.data;
//     if (isDelete) {
//       transArr.push({
//         Delete: {
//           Key: {
//             id: realtor.id,
//             entity: realtor.entity,
//           },
//           TableName: process.env.entitiesTableName,
//           ReturnValuesOnConditionCheckFailure: "ALL_OLD",
//         },
//       });
//     } else {
//       delete realtor.id;
//       delete realtor.entity;
//       delete realtor.data;
//       transArr.push({
//         Put: {
//           TableName: process.env.entitiesTableName,
//           Item: {
//             id: commUUID,
//             entity: `realtor#${hbid}#community#${realtorUUID}`,
//             data: realtorUUID,
//             ...realtor,
//           },
//           ReturnValuesOnConditionCheckFailure: "ALL_OLD",
//         },
//       });
//     }
//   }
//   return transArr;
// };
export const createCommunity = async (data) => {
  const {
    hb_id: hbid = "",
    name = "",
    rel_id: relId = "",
    isActive = "true",
    pjct_no: projectNumber = [],
    img_file = "",
    img_thumb = "",
    des = "",
  } = data;
  const modifiedDate = Date.now();
  const cdt = Date.now();

  const commUUID = uuidv4();
  const commCreateItem = {
    id: commUUID,
    type: "community",
    entity: `community#${hbid}`,
    hb_id: hbid,
    name,
    rel_id: relId,
    pjct_no: projectNumber,
    mdt: modifiedDate,
    cdt,
    isActive,
    img_file,
    img_thumb,
    des,
  };
  console.log(commCreateItem);
  /* const realtorsTransArr = await getRealtorsAssoWithMetro(
    hbid,
    relId,
    false,
    commUUID
  ); */
  // Create community + realtor resources under the community
  const transArr = [
    /* required */
    {
      Put: {
        TableName: process.env.entitiesTableName /* required */,
        Item: commCreateItem,
        ReturnValuesOnConditionCheckFailure: "ALL_OLD",
      },
    },
  ];
  const transParams = {
    TransactItems: transArr,
  };
  console.log(`transArr: ${JSON.stringify(transArr)}`);
  return transactWriteItems(transParams);
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

export const updateCommunityRow = async (data) => {
  /* const realtorsTransArr = await getRealtorsAssoWithMetro(
    data.hb_id,
    data.rel_id,
    false,
    data.id
  ); */
  const isActive = data.isActive ? data.isActive : "true";
  const updateCommunityItem = {
    type: "community",
    entity: `community#${data.hb_id}`,
    id: data.id,
    hb_id: data.hb_id,
    name: data.name,
    rel_id: data.rel_id,
    pjct_no: data.pjct_no ? data.pjct_no : [],
    mdt: Date.now(),
    cdt: data.cdt,
    isActive,
    img_file: data?.img_file || "",
    img_thumb: data?.img_thumb || "",
    des: data?.des || "",
  };
  // Update community + realtor resources under the community
  const transArr = [
    /* required */
    {
      Put: {
        TableName: process.env.entitiesTableName /* required */,
        Item: updateCommunityItem,
        ReturnValuesOnConditionCheckFailure: "ALL_OLD",
      },
    },
  ];
  const transParams = {
    TransactItems: transArr,
  };
  console.log(`transArr: ${JSON.stringify(transArr)}`);

  // get community
  const getCommunityParams = {
    TableName: process.env.entitiesTableName,
    KeyConditionExpression: "#id = :id and #entity = :entity",
    ExpressionAttributeNames: {
      "#id": "id",
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":id": data.id,
      ":entity": `community#${data.hb_id}`,
    },
  };

  const community = await getResourceJSON(getCommunityParams);

  if (community && community.length && community[0].rel_id !== data.rel_id) {
    await setLambdaARNs();

    const input = JSON.stringify({
      hb_id: data.hb_id,
      purpose: "metroUpdation",
      type: "customer",
      filter: { commId: [data.id] },
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

  return transactWriteItems(transParams);
};
export const updateCommunity = (data) => {
  const id = data.id ? data.id : 0;
  const propName = data.attrn ? data.attrn : "";
  const propVal = data.attrv ? data.attrv : "";
  const hbid = data.hb_id ? data.hb_id : "";
  const modifiedDate = Date.now();

  const params = {
    TableName: process.env.entitiesTableName,
    Key: {
      id,
      entity: `community#${hbid}`,
    },
    UpdateExpression: `set #propName = :pval, mdt = :modDate`,
    ExpressionAttributeNames: {
      "#propName": propName,
    },
    ExpressionAttributeValues: {
      ":pval": propVal,
      ":modDate": modifiedDate,
    },
  };
  console.log(params);
  return updateResources(params);
};
export const deleteCommunity = async (data) => {
  const { id = "", hb_id: hbid = "" } = data;
  /* const realtorsTransArr = await getRealtorsAssoWithMetro(
    hbid,
    relId,
    true,
    id
  ); */
  if (!id || !hbid)
    return failure({ status: false, error: "Id and hbId are required" });

  // Delete All the lots + plans under the community
  let delArr = [];

  const lots = await listLot({
    hb_id: hbid,
    listAll: true,
    isJSON: true,
    filters: [
      {
        key: "Community",
        value: [id],
      },
    ],
  });
  console.log(`lots: ${JSON.stringify(lots)}`);

  for (const lot of lots) {
    const transArr = await deleteLot({
      id: lot.id,
      hb_id: hbid,
      isTransArrOnly: true,
    });
    delArr.push(...transArr);
  }

  const plans = await listPlan({
    hb_id: hbid,
    listAll: true,
    isJSON: true,
    filters: [
      {
        key: "Community",
        value: [id],
      },
    ],
  });
  console.log(`plans: ${JSON.stringify(plans)}`);

  for (const plan of plans) {
    const transArr = await deletePlan({
      id: plan.id,
      hb_id: hbid,
      isTransArrOnly: true,
    });
    delArr.push(...transArr);
  }

  delArr = delArr.filter(
    (value, index, self) =>
      index ===
      self.findIndex(
        (t) =>
          t.Delete.Key.id === value.Delete.Key.id &&
          t.Delete.Key.entity === value.Delete.Key.entity
      )
  );

  console.log(`delArr: ${JSON.stringify(delArr)}`);

  const transArr = [
    /* required */
    {
      Delete: {
        Key: {
          id,
          entity: `community#${hbid}`,
        },
        TableName: process.env.entitiesTableName /* required */,
        ReturnValuesOnConditionCheckFailure: "ALL_OLD",
      },
    },
    ...delArr,
  ];
  const transParams = {
    TransactItems: transArr,
  };
  console.log(`transArr: ${JSON.stringify(transArr)}`);
  return transactWriteItems(transParams);
};
export const getCommunity = (event) => {
  const params = getParamsForQuery(event, "community");
  return getResources(params);
};
export const getCommunityBasedOnProjNo = async (data) => {
  const projNumbers = data.proj ? data.proj : [];
  const hbid = data.hbid ? data.hbid : "";
  let params;
  const commQueryArr = [];
  for (const projNumber of projNumbers) {
    console.log(`projNumber: ${projNumber}`);
    params = {
      TableName: process.env.entitiesTableName,
      IndexName: process.env.entitiesTableByEntityAndId,
      KeyConditionExpression: "#entity = :entity",
      FilterExpression: "#pjct_no =:pjct_no",
      ExpressionAttributeNames: {
        "#entity": "entity",
        "#pjct_no": "pjct_no",
      },
      ExpressionAttributeValues: {
        ":entity": `community#${hbid}`,
        ":pjct_no": projNumber,
      },
    };
    console.log(`params: ${JSON.stringify(params)}`);
    try {
      commQueryArr.push(getQueryPromise(params));
    } catch (error) {
      console.log(`error: ${error.stack}`);
    }
  }
  const commProjectResp = await Promise.all(commQueryArr);
  console.log(`commProjectResp: ${JSON.stringify(commProjectResp)}`);
  return commProjectResp;
};
const getCommunityBasedOnMetroIds = async (data) => {
  try {
    const { m_id: metroIds = [], hbid = "", ido: idOnly = false } = data;
    let params;
    const commQueryArr = [];
    for (const metroId of metroIds) {
      console.log(`metroId: ${metroId}`);
      params = {
        TableName: process.env.entitiesTableName,
        IndexName: process.env.entitiesTableByEntityAndId,
        KeyConditionExpression: "#entity = :entity",
        FilterExpression: "#rel_id =:rel_id",
        ExpressionAttributeNames: {
          "#entity": "entity",
          "#rel_id": "rel_id",
        },
        ExpressionAttributeValues: {
          ":entity": `community#${hbid}`,
          ":rel_id": metroId,
        },
      };
      console.log(`params: ${JSON.stringify(params)}`);
      try {
        commQueryArr.push(getQueryPromise(params));
      } catch (error) {
        console.log(`error: ${error.stack}`);
      }
    }
    const commMetroResp = await Promise.all(commQueryArr);
    console.log(`commMetroResp: ${JSON.stringify(commMetroResp)}`);
    const { Items: communityItems = [] } = commMetroResp?.length
      ? commMetroResp[0]
      : { Items: [] };
    // Return only community ids if "ido" is true
    // Otherwise return the full resource
    return success(
      idOnly ? communityItems.map((community) => community.id) : communityItems
    );
  } catch (error) {
    console.log("Exception occured in getCommunityBasedOnMetroIds");
    console.log(error);
    return failure({ status: false, error: "Community list failed." });
  }
};
const getCommunityByIds = async (data) => {
  console.log(`In getCommunityByIds`);
  return getEntityByIdsElastic({ ...data, entity: `community` });
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
    const isExternalCommList =
      event && event.path ? event.path.includes("list") : false;
    let data;
    switch (event.httpMethod) {
      case "GET":
        if (action === "list" || (isExternalAPI && isExternalCommList)) {
          response = await listCommunities(event, false, isExternalAPI);
        } else if (action === "list_order") {
          response = await listOrder("community", event);
        } else if (action === "get") {
          response = await getCommunity(event);
        } else {
          response = failure();
        }
        break;
      case "POST":
        data = JSON.parse(event.body);
        if (!data) {
          response = failure();
        } else if (action === "create") {
          response = await createCommunity(data);
        } else if (action === "update_order") {
          response = await updateOrder("community", data);
        } else if (action === "update") {
          response = await updateCommunity(data);
        } else if (action === "delete") {
          response = await deleteCommunity(data);
        } else if (action === "list") {
          response = await listCommunitiesElastic(data);
        } else if (action === "gcbm") {
          // Get communities by metro ids
          response = await getCommunityBasedOnMetroIds(data);
        } else if (action === "gcbp") {
          // gcbp - get communities by project number
          response = await getCommunityBasedOnProjNo(data);
        } else if (action === "gcbids") {
          // gcbids - get communities by community ids
          response = await getCommunityByIds(data);
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
