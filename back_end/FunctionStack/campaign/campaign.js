import "../../NPMLayer/nodejs.zip";
import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import {
  failure,
  success,
  badRequest,
  notFound,
  successHTML,
} from "../libs/response-lib";
import {
  updateResources,
  getResourceJSON,
  postResources,
  getResources,
  getRecordByIdAndEntity,
  deleteResources,
  batchWriteItems,
  listEntitiesElastic,
  doAggregateElasticQuery,
  getEntityByIdsElastic,
  doPaginatedQueryEllastic,
} from "../libs/db";
import { validateFields } from "../validation/validation";
import { unsubscribeHtmlString } from "./unsubscribeHtml";
import { subscribeHtmlString } from "./subscribeHtml";
import { elasticExecuteQuery } from "../search/search";
import { PinpointEmail } from "aws-sdk";
import { notificationEmailTemplate } from "./leadNotificationHtml";
// SES_IP_POOL_NAME
const {
  FIREHOSE_ARN,
  FIREHOSE_PINPOINT_ROLE,
  SEGMENT_HOOK_LAMBDA_ARN,
  JOURNEY_CUSTOM_EMAIL_LAMBDA_ARN,
  JOURNEY_CUSTOM_TASK_LAMBDA_ARN,
  EnvironmentTag,
  ApplicationTag,
  OwnerTag,
  PurposeTag,
} = process.env;
const pinpoint = new AWS.Pinpoint({ apiVersion: "2016-12-01" });
const pinpointemail = new AWS.PinpointEmail();
const ses = new AWS.SES();
const endpointAttrCheck = async (record) => {
  const attrNeeded = [
    "inte",
    "cntm",
    "psrc",
    "type",
    "stage",
    "desm",
    "hb_id",
    "desf",
    "infl",
    "rltr",
    "fname",
    "lname",
    "name",
    "dg",
    "agcnm",
    "agtnm",
    "phone",
    "email",
    "stage_mdt_iso",
    "grade",
    "m_id",
    "newinte"
  ];
  return Object.keys(record)
    .filter((key) => attrNeeded.includes(key))
    .reduce((obj, key) => {
      console.log(
        `${key} - ${typeof record[key]} - ${JSON.stringify(record[key])}`
      );
      if (typeof record[key] === "object") {
        obj[key] = record[key];
        // Arrays should be of strings
        if (obj[key].length) {
          // Array
          if (key === "dg") {
            // In the case of demographics, we are taking the question uuid
            // as the key and the answer id as the value.
            // There can be multiple selected questions and answers.
            // So looping through all of them and adding each.
            obj[key].forEach((demog) => {
              obj[demog.q] = demog.a;
            });
            delete obj[key];
          } else {
            obj[key] = obj[key].map((rec) => rec.toString());
          }
        } else if (key === "rltr") {
          // Object
          obj.rltr_nm = obj[key] && obj[key].name ? [obj[key].name] : [];
          obj.agcnm = obj[key] && obj[key].agcnm ? [obj[key].agcnm] : [];
          obj.agtnm = obj[key] && obj[key].agtnm ? [obj[key].agtnm] : [];
          delete obj[key];
        } else {
          obj[key] = [];
        }
      } else if (typeof record[key] === "string") {
        obj[key] = [record[key].toString()];
      }
      return obj;
    }, {});
};
export const updateEndpoint = async (record, optIn, eventType = "") => {
  console.log(`record: ${JSON.stringify(record)}`);
  const attributes = await endpointAttrCheck(record);
  attributes.sales_agent_fname = [''];
  attributes.sales_agent_lname = [''];
  attributes.sales_agent_email = [''];
  attributes.sales_agent_phone = [''];
  attributes.community_names = [''];
  try {
    if (attributes?.inte?.length) {
      const communityList = await getEntityByIdsElastic({
        ids: attributes.inte,
        hbId: record.hb_id,
        isJSONOnly: true,
        entity: "community"
      });
      console.log(`communityList ${JSON.stringify(communityList)}`);
      if (communityList.status) {
        attributes.community_names = [communityList.data?.map(community => community.name).join(', ') || ''];
      }
    }
  } catch (e) {
    console.log(`Error in community fetch: ${JSON.stringify(e.stack)}`)
  }
  if (attributes?.newinte?.length) {
    try {
      console.log(`attributes.newinte ${JSON.stringify(attributes.newinte)}`)
      for (let newinte of attributes?.newinte) {
        console.log(`inte: ${newinte}`);
        const params = {
          TableName: process.env.entitiesTableName,
          KeyConditionExpression: "#id = :id and begins_with(#entity, :entity)",
          ExpressionAttributeNames: {
            "#id": "id",
            "#entity": "entity",
          },
          ExpressionAttributeValues: {
            ":id": newinte,
            ":entity": `agent#${attributes.hb_id[0]}`
          },
        };
        console.log(`params: ${JSON.stringify(params)}`)
        const salesAgent = await getResources(params, true);
        console.log(`sales agent ${JSON.stringify(salesAgent)}`);
        if (salesAgent.status && salesAgent.data?.[0]) {
          attributes.sales_agent_fname = [salesAgent.data[0]?.fname || ''];
          attributes.sales_agent_lname = [salesAgent.data[0]?.lname || ''];
          attributes.sales_agent_email = [salesAgent.data[0]?.email || ''];
          attributes.sales_agent_phone = [salesAgent.data[0]?.phone || ''];
          break;
        }
      }
    } catch (e) {
      console.log(`error in getting sales agent: ${JSON.stringify(e.stack)}`);
    }
  }
  console.log(`attributes: ${JSON.stringify(attributes)} - ${record.appid}`);
  const recordId =
    record.entity.indexOf(`cobuyer#${record.hb_id}#`) !== -1
      ? record.data
      : record.id;
  const params = {
    ApplicationId: record.appid /* required */,
    EndpointId: recordId /* required */,
    EndpointRequest: {
      /* required */ Address: record.email,
      ChannelType: "EMAIL",
      EndpointStatus: "ACTIVE",
      User: {
        UserId: recordId,
        UserAttributes: attributes,
      },
    },
  };
  if (eventType === "INSERT") {
    if (optIn && optIn !== undefined && optIn !== null && optIn !== "") {
      params.EndpointRequest.OptOut = "ALL";
    } else {
      params.EndpointRequest.OptOut = "NONE";
    }
  }

  console.log(`params: ${JSON.stringify(params)}`);
  try {
    const updateEndpointResp = await pinpoint.updateEndpoint(params).promise();
    console.log(`updateEndpointResp: ${JSON.stringify(updateEndpointResp)}`);
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
  }
};
export const getUserEndpoints = async (record, isJSONOnly) => {
  console.log(`record: ${JSON.stringify(record)}`);
  const params = {
    ApplicationId: record.appid,
    UserId: record.id,
  };
  console.log(`params: ${JSON.stringify(params)}`);
  try {
    const getUserEndpointsResp = await pinpoint
      .getUserEndpoints(params)
      .promise();
    console.log(
      `getUserEndpointsResp: ${JSON.stringify(getUserEndpointsResp)}`
    );
    if (isJSONOnly) {
      return getUserEndpointsResp;
    }

    return success({ status: true, data: getUserEndpointsResp });
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
    if (isJSONOnly) {
      return e;
    }

    return failure({ status: false, error: e });
  }
};
// Update customer/realtor/cobuyer from DB
const updateEntity = async (entityObj) => {
  const optOutStatus = entityObj.optstval;
  const currentDate = Date.now();
  const params = {
    TableName: process.env.entitiesTableName,
    Key: {
      id: entityObj.id,
      entity: entityObj.entity,
    },
    UpdateExpression: `set #optst = :optstval, #mdt = :mdtval`,
    ExpressionAttributeNames: {
      "#optst": "optst",
      "#mdt": "mdt",
    },
    ExpressionAttributeValues: {
      ":optstval": entityObj.optstval,
      ":mdtval": entityObj.mdtval,
    },
    ReturnValuesOnConditionCheckFailure: "ALL_OLD",
  };
  if (optOutStatus === "NONE") {
    // Opt In
    params.UpdateExpression += ", #optindt = :optindtval";
    params.ExpressionAttributeNames["#optindt"] = "optindt";
    params.ExpressionAttributeValues[":optindtval"] = currentDate;
  } else if (optOutStatus === "ALL") {
    // Opt Out
    params.UpdateExpression += ", #optoutdt = :optoutdtval";
    params.ExpressionAttributeNames["#optoutdt"] = "optoutdt";
    params.ExpressionAttributeValues[":optoutdtval"] = currentDate;
  } else {
    // Pending
    params.UpdateExpression += ", #optindt = :optindtval";
    params.ExpressionAttributeNames["#optindt"] = "optindt";
    params.ExpressionAttributeValues[":optindtval"] = 0;
    params.UpdateExpression += ", #optoutdt = :optoutdtval";
    params.ExpressionAttributeNames["#optoutdt"] = "optoutdt";
    params.ExpressionAttributeValues[":optoutdtval"] = 0;
  }
  console.log(params);
  const updateEntityResp = await updateResources(params);
  console.log("updateEntityResp: ", updateEntityResp);
  return updateEntityResp;
};
// Update the optout status of customer/realtor/cobuyer on subscribe or unsubscribe
const updateEntityOptStatus = async (customerObj) => {
  const {
    appId: pinpointAppId = "",
    OptOut: optOutStatus,
    rel_id: relId = "",
  } = customerObj;
  const entityId = customerObj.entity.includes("cobuyer#")
    ? relId
    : customerObj.userId;
  const currentDate = Date.now();

  // Get endpoint
  const getUserEndpointsResp = await getUserEndpoints(
    { id: entityId, appid: pinpointAppId },
    true
  );
  const entityAttributes =
    getUserEndpointsResp.EndpointsResponse &&
      getUserEndpointsResp.EndpointsResponse.Item &&
      getUserEndpointsResp.EndpointsResponse.Item.length &&
      getUserEndpointsResp.EndpointsResponse.Item[0].User &&
      getUserEndpointsResp.EndpointsResponse.Item[0].User.UserAttributes
      ? getUserEndpointsResp.EndpointsResponse.Item[0].User.UserAttributes
      : {};
  const entityType = entityAttributes.type ? entityAttributes.type : "";
  const entityHbid = entityAttributes.hb_id ? entityAttributes.hb_id : "";

  // Update the entity
  // Update the opt out status and opt in/out date
  const entityVal = customerObj.entity
    ? customerObj.entity
    : `${entityType}#${entityHbid}`;
  const requestObj = {
    id: entityId,
    type: entityType,
    hb_id: entityHbid,
    optstval: optOutStatus,
    mdtval: currentDate,
    entity: entityVal,
  };
  const updateEntityOptStatusResp = await updateEntity(requestObj);
  console.log(
    `updateEntityOptStatusResp: ${JSON.stringify(updateEntityOptStatusResp)}`
  );
  return updateEntityOptStatusResp;
};
export const optEndpoint = async (record, opt) => {
  console.log(`record: ${JSON.stringify(record)}`);
  const attributes = await endpointAttrCheck(record);
  console.log(`attributes: ${JSON.stringify(attributes)} - ${record.appid}`);
  const params = {
    ApplicationId: record.appid /* required */,
    EndpointId: record.id /* required */,
    EndpointRequest: {
      /* required */ Address: record.email,
      ChannelType: "EMAIL",
      EndpointStatus: "ACTIVE",
      OptOut: "",
      User: {
        UserId: record.id,
        UserAttributes: attributes,
      },
    },
  };
  if (opt) {
    params.EndpointRequest.OptOut = "NONE";
  } else {
    params.EndpointRequest.OptOut = "ALL";
  }
  console.log(`params: ${JSON.stringify(params)}`);
  try {
    const optEndpointResp = await pinpoint.updateEndpoint(params).promise();
    console.log(`optEndpointResp: ${JSON.stringify(optEndpointResp)}`);
    const updateCustomerOptResp = await updateEntityOptStatus({
      appId: record.appid,
      userId: record.id,
      OptOut: params.EndpointRequest.OptOut,
      entity: record.entity,
      rel_id: record.rel_id ? record.rel_id : "",
    });
    console.log(
      `updateCustomerOptResp: ${JSON.stringify(updateCustomerOptResp)}`
    );
    return success({ status: true, data: optEndpointResp });
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
    return failure({ status: false, error: e });
  }
};
const checkIfCobuyer = async (dataId) => {
  const params = {
    TableName: process.env.entitiesTableName,
    IndexName: process.env.entitiesTableByDataAndEntity,
    KeyConditionExpression: "#data = :data",
    ExpressionAttributeNames: {
      "#data": "data",
    },
    ExpressionAttributeValues: {
      ":data": dataId,
    },
  };
  console.log(params);
  const checkIfCobuyerResp = await getResourceJSON(params);
  console.log(`checkIfCobuyerResp: ${JSON.stringify(checkIfCobuyerResp)}`);
  if (checkIfCobuyerResp && checkIfCobuyerResp.length) {
    if (checkIfCobuyerResp[0].type === "cobuyer") {
      return { status: true, data: checkIfCobuyerResp[0] };
    }
  }
  return { status: false };
};
const unsubscribe = async (event) => {
  try {
    console.log("In Unsubscribe");
    const userId =
      event && event.pathParameters && event.pathParameters.id
        ? event.pathParameters.id
        : 0;
    let appId =
      event && event.pathParameters && event.pathParameters.hbid
        ? event.pathParameters.hbid
        : 0;

    const builderDetailsParam = {
      TableName: process.env.entitiesTableName,
      KeyConditionExpression: "#id = :id and #entity = :entity",
      ExpressionAttributeNames: {
        "#id": "id",
        "#entity": "entity",
      },
      ExpressionAttributeValues: {
        ":id": appId,
        ":entity": "builder",
      },
    };
    console.log(builderDetailsParam);
    const getBuilderResp = await getResourceJSON(builderDetailsParam);
    console.log(`getBuilderResp: ${JSON.stringify(getBuilderResp)}`);

    let logoHtml = "";

    if (getBuilderResp.length) {
      appId = getBuilderResp[0].appid;
      logoHtml = `<img src="${getBuilderResp[0].logo}" height="35" />`;
    }

    // Check whether this is for a cobuyer
    const isCobuyerResp = await checkIfCobuyer(userId);
    const isCobuyer = isCobuyerResp.status;
    let cobuyerData;
    let entity;
    let relId;
    console.log(`isCobuyer: ${isCobuyer}`);
    const params = {
      ApplicationId: appId,
      EndpointId: userId,
      EndpointRequest: {
        ChannelType: "EMAIL",
        OptOut: "ALL",
      },
    };
    console.log("unsubParams: ", params);

    const optEndpointResp = await pinpoint.updateEndpoint(params).promise();
    console.log(`optEndpointResp: ${JSON.stringify(optEndpointResp)}`);
    // Update customer details with optout status & date
    if (isCobuyer) {
      cobuyerData = isCobuyerResp.data;
      entity = cobuyerData.entity;
      relId = cobuyerData.rel_id;
    } else {
      entity = "";
      relId = "";
    }
    const updateCustomerOptResp = await updateEntityOptStatus({
      appId,
      userId,
      OptOut: "ALL",
      entity,
      rel_id: relId,
    });
    console.log(
      `updateCustomerOptResp: ${JSON.stringify(updateCustomerOptResp)}`
    );
    return successHTML(unsubscribeHtmlString({ logoHtml }));
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
    return failure({ status: "Error !!" });
  }
};
const subscribe = async (event) => {
  console.log("In Unsubscribe");
  const userId =
    event && event.pathParameters && event.pathParameters.id
      ? event.pathParameters.id
      : 0;
  const appId =
    event && event.pathParameters && event.pathParameters.hbid
      ? event.pathParameters.hbid
      : 0;

  // Check whether this is for a cobuyer
  const isCobuyerResp = await checkIfCobuyer(userId);
  const isCobuyer = isCobuyerResp.status;
  let cobuyerData;
  let entity;
  let relId;
  console.log(`isCobuyer: ${isCobuyer}`);
  const params = {
    ApplicationId: appId,
    EndpointId: userId,
    EndpointRequest: {
      ChannelType: "EMAIL",
      OptOut: "NONE",
    },
  };
  console.log("subscribe: ", params);
  try {
    const optEndpointResp = await pinpoint.updateEndpoint(params).promise();
    console.log(`subscribe: ${JSON.stringify(optEndpointResp)}`);
    // Update customer details with optout status & date
    if (isCobuyer) {
      cobuyerData = isCobuyerResp.data;
      entity = cobuyerData.entity;
      relId = cobuyerData.rel_id;
    } else {
      entity = "";
      relId = "";
    }
    const updateCustomerOptResp = await updateEntityOptStatus({
      appId,
      userId,
      OptOut: "NONE",
      entity,
      rel_id: relId,
    });
    console.log(
      `updateCustomerOptResp: ${JSON.stringify(updateCustomerOptResp)}`
    );
    return successHTML(subscribeHtmlString);
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
    return failure({ status: false, error: e });
  }
};
export const deleteEndpoint = async (appid, id) => {
  const params = {
    ApplicationId: appid /* required */,
    EndpointId: id /* required */,
  };
  console.log(`params: ${JSON.stringify(params)}`);
  try {
    const deleteEndpointResp = await pinpoint.deleteEndpoint(params).promise();
    console.log(`deleteEndpointResp: ${JSON.stringify(deleteEndpointResp)}`);
    return deleteEndpointResp;
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
    return e.stack;
  }
};
export const attachEventStream = async (appId) => {
  const params = {
    ApplicationId: appId /* required */,
    WriteEventStream: {
      /* required */ DestinationStreamArn: FIREHOSE_ARN /* required */,
      RoleArn: FIREHOSE_PINPOINT_ROLE /* required */,
    },
  };
  console.log(`FIREHOSE_ARN: ${FIREHOSE_ARN}`);
  console.log(`FIREHOSE_PINPOINT_ROLE: ${FIREHOSE_PINPOINT_ROLE}`);
  console.log(`params: ${JSON.stringify(params)}`);
  try {
    const attachEventStreamResp = await pinpoint
      .putEventStream(params)
      .promise();
    console.log(
      `attachEventStreamResp: ${JSON.stringify(attachEventStreamResp)}`
    );
    return attachEventStreamResp;
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
    return e.stack;
  }
};
export const createApp = async (name) => {
  const params = {
    CreateApplicationRequest: {
      /* required */ Name: `${name}-App` /* required */,
      tags: {
        Application: ApplicationTag,
        Environment: EnvironmentTag,
        Owner: OwnerTag,
        Purpose: PurposeTag,
        Service: "pinpoint",
      },
    },
  };
  console.log(`params: ${JSON.stringify(params)}`);
  try {
    const createAppResp = await pinpoint.createApp(params).promise();
    console.log(`createAppResp: ${JSON.stringify(createAppResp)}`);
    return { status: true, data: createAppResp };
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
    return { status: false, error: e.stack };
  }
};
export const updateEmailChannel = async (appId, email, configSetName = "") => {
  const params = {
    ApplicationId: appId /* required */,
    EmailChannelRequest: {
      /* required */ FromAddress: email /* required */,
      Identity: `arn:aws:ses:${process.env.REGION}:${process.env.ACCOUNT_ID}:identity/${email}` /* required */,
      Enabled: true,
    },
  };
  if (configSetName) {
    params.EmailChannelRequest.ConfigurationSet = configSetName;
  }
  console.log(`params: ${JSON.stringify(params)}`);
  try {
    const createAppResp = await pinpoint.updateEmailChannel(params).promise();
    console.log(`createAppResp: ${JSON.stringify(createAppResp)}`);
    return createAppResp;
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
    return e.stack;
  }
};
const getSegmentDimensions = (attributes) => {
  const dimensions = [];
  let attrObj = {};
  for (const attributeKey in attributes) {
    if (attributeKey) {
      attrObj = {};
      if (attributeKey !== "hb_id") {
        attrObj[attributeKey] = attributes[attributeKey];
        attrObj.hb_id = attributes.hb_id;
        dimensions.push({
          UserAttributes: attrObj,
        });
      }
    }
  }
  return dimensions;
};
export const createSegment = async (data, isObjParam, paramObj) => {
  console.log(`In createSegment`);
  const name = data.name ? data.name.trim() : "";
  const attributes = data.attr ? data.attr : {};
  const type = data.type ? data.type.trim() : "ANY";
  const appid = data.appid ? data.appid.trim() : "";
  const crby = data.crby || "";
  const userType = data.userType || "";
  const userName = data.userName || "";
  // attributes = endpointAttrCheck(attributes);
  const dimensions = getSegmentDimensions(attributes);
  console.log(`dimensions: ${JSON.stringify(dimensions)}`);
  let params;
  if (isObjParam) {
    params = paramObj;
  } else {
    params = {
      ApplicationId: appid /* required */,
      WriteSegmentRequest: {
        /* required */
        SegmentGroups: {
          Include: "ALL",
          Groups: [
            {
              Type: type,
              Dimensions: dimensions,
              SourceType: "ANY",
              SourceSegments: [],
            },
          ],
        },
        Name: name,
        tags: {
          Application: ApplicationTag,
          Environment: EnvironmentTag,
          Owner: OwnerTag,
          Purpose: PurposeTag,
          Service: "pinpoint",
          crby,
          userType,
          userName
        },
      },
    };
  }
  console.log(`params: ${JSON.stringify(params)}`);
  try {
    const segmentCreateResponse = await pinpoint
      .createSegment(params)
      .promise();
    console.log(
      `segmentCreateResponse: ${JSON.stringify(segmentCreateResponse)}`
    );
    if (isObjParam) {
      return segmentCreateResponse;
    }

    return success({ status: true, data: segmentCreateResponse });
  } catch (e) {
    if (isObjParam) {
      return e;
    }

    return failure({ status: false, error: e });
  }
};
export const updateSegment = async (data, isObjParam, paramObj) => {
  console.log(`In updateSegment`);
  const name = data.name ? data.name.trim() : "";
  const segmentId = data.segid ? data.segid : "";
  const attributes = data.attr ? data.attr : {};
  const type = data.type ? data.type.trim() : "ANY";
  const appid = data.appid ? data.appid.trim() : "";
  const crby = data.crby || "";
  const userType = data.userType || "";
  const userName = data.userName || "";
  const arn = data.arn || "";
  // attributes = endpointAttrCheck(attributes);
  const dimensions = getSegmentDimensions(attributes);
  let params;
  console.log(`dimensions: ${JSON.stringify(dimensions)}`);
  if (isObjParam) {
    params = paramObj;
  } else {
    params = {
      ApplicationId: appid /* required */,
      SegmentId: segmentId,
      WriteSegmentRequest: {
        /* required */
        SegmentGroups: {
          Include: "ALL",
          Groups: [
            {
              Type: type,
              Dimensions: dimensions,
              SourceType: "ANY",
              SourceSegments: [],
            },
          ],
        },
        Name: name,
        tags: {
          Application: ApplicationTag,
          Environment: EnvironmentTag,
          Owner: OwnerTag,
          Purpose: PurposeTag,
          Service: "pinpoint"
        },
      },
    };
  }
  console.log(`params: ${JSON.stringify(params)}`);
  try {
    const segUpResp = await pinpoint.updateSegment(params).promise();
    console.log(`segUpResp: ${JSON.stringify(segUpResp)}`);
    if (isObjParam) {
      return segUpResp;
    }

    // updating the segment tags
    if (arn) {
      const updateTagParams = {
        ResourceArn: arn,
        TagsModel: {
          tags: {
            crby,
            userType,
            userName
          },
        },
      };
      const tagUpdateRes = await pinpoint
        .tagResource(updateTagParams)
        .promise();
      console.log(`tagUpdateRes: ${JSON.stringify(tagUpdateRes)}`);
    }

    return success({ status: true, data: segUpResp });
  } catch (e) {
    if (isObjParam) {
      return e;
    }

    return failure({ status: false, error: e });
  }
};
const getEntities = async (entity) => {
  const params = {
    TableName: process.env.entitiesTableName,
    IndexName: process.env.entitiesTableByEntityAndId,
    KeyConditionExpression: "#entity = :entity",
    ExpressionAttributeNames: {
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":entity": entity,
    },
  };
  console.log(params);
  return getResourceJSON(params);
};


const getSegmentEndpointCount = async (data) => {
  try {

    //debugger
    console.log(`data: ${JSON.stringify(data)}`);

    const { hbId, segmentData } = data;

    const keys = ['type', 'stage', 'psrc', 'm_id', 'inte', 'infl', 'cntm', 'desf', 'grade', 'desm', "stage_mdt_iso"];

    const commonQuery = [
      {
        term: { "hb_id.keyword": hbId }
      },
      {
        bool: {
          should: [
            {
              term: { "entity.keyword": `customer#${hbId}` }
            },
            {
              term: { "entity.keyword": `realtor#${hbId}` }
            },
            {
              wildcard: { "entity.keyword": { value: `cobuyer#${hbId}#*` } }
            }
          ]
        }
      }
    ];


    const buildSubQuery = (key, values) => {
      return values.map(value => {
        if (key === "type" && value === "cobuyer") {
          return { wildcard: { "entity.keyword": { "value": `${value}#${hbId}#*` } } }
        }

        if (keys.indexOf(key) === -1) {
          return { term: { 'dg.a.keyword': value } }
        };

        return key === "type"
          ? { term: { "entity.keyword": `${value}#${hbId}` } }
          : { term: { [`${key}.keyword`]: value } }
      })
    }

    const buildFilterQuery = (key, values) => {
      const subQuery = buildSubQuery(key, values);
      const commonQueryPart = key === "type" ? [commonQuery[0]] : commonQuery;
      const conditionalPart = keys.indexOf(key) === -1
        ? { bool: { must: [{ term: { 'dg.q.keyword': key } }, { bool: { should: subQuery } }] } }
        : { bool: { should: subQuery } }
      return {
        bool: {
          must: [
            ...commonQueryPart,
            conditionalPart
          ]
        }
      }
    }

    const group = segmentData?.SegmentGroups?.Groups[0] || {};
    const isAllFiter = group.Type === "ALL";
    let baseQuery = isAllFiter ? { must: [] } : { should: [] };

    const endpointCountQueryParams = {
      httpMethod: "POST",
      requestPath: `/_search`,
      payload: { query: { bool: baseQuery } }
    };

    let commIdArr = [];
    let metroIdArr = [];
    let stageChangeQuery = {}

    for (const filter of group?.Dimensions) {

      //debugger
      console.log(`entered filter loop: ${JSON.stringify(filter)}`);

      const filterGroup = filter?.UserAttributes || {};

      const key = Object.keys(filterGroup).find(key => key !== "hb_id");

      if (!key) continue;

      const values = filterGroup[key]?.Values || [];


      if (key === "m_id") {

        //debugger
        console.log(`Entered m_id`);

        for (const value of values) {

          metroIdArr.push(value);

          const queryParams = [
            {
              term: {
                "hb_id.keyword": hbId
              }
            },
            {
              term: {
                "rel_id.keyword": value
              }
            },
            {
              term: {
                "isActive.keyword": "true"
              }
            },
            {
              term: {
                "entity.keyword": `community#${hbId}`
              }
            }
          ]

          //debugger
          console.log(`queryParams: ${JSON.stringify(queryParams)}`);

          const commData = await doPaginatedQueryEllastic({
            hb_id: hbId,
            isCustomParam: true,
            customParams: queryParams,
          });

          console.log(`commData: ${JSON.stringify(commData)}`);

          commIdArr = [...commIdArr, ...commData.map(comm => comm.id)];

        };
        console.log(`commIdArr: ${JSON.stringify(commIdArr)}`);
      };


      if (key === "inte") {
        for (const value of values) {
          commIdArr.push(value);

          const queryParams = [
            {
              term: {
                "hb_id.keyword": hbId
              }
            },
            {
              term: {
                "id.keyword": value
              }
            }
          ]

          //debugger
          console.log(`queryParams comm: ${JSON.stringify(queryParams)}`);

          const commData = await doPaginatedQueryEllastic({
            hb_id: hbId,
            isCustomParam: true,
            customParams: queryParams,
          });

          console.log(`commData: ${JSON.stringify(commData)}`);

          metroIdArr = [...metroIdArr, ...commData.map(comm => comm.rel_id)]
        }

        console.log(`metroIdArr, ${JSON.stringify(metroIdArr)}`);
      }

      if (key === 'stage_mdt_iso') {

        const conditionDate = {};

        const attributeType = filterGroup[key]?.AttributeType || "";

        if (attributeType === "AFTER") {
          conditionDate.gte = values[0]
        } else if (attributeType === "BEFORE") {
          conditionDate.lte = values[0]
        } else if (attributeType === "BETWEEN") {
          conditionDate.gte = values[0]
          conditionDate.lte = values[1]
        }

        if (attributeType) {
          stageChangeQuery = {
            bool: {
              must: [
                commonQuery[0],
                {
                  range: {
                    stage_mdt_iso: conditionDate
                  }
                }
              ]
            }
          }
        };
      }

      if (key !== 'inte' && key !== 'm_id' && key !== 'stage_mdt_iso') {

        const filterQuery = buildFilterQuery(key, values);

        if (isAllFiter) {
          endpointCountQueryParams.payload.query.bool.must.push(filterQuery);
        } else {
          endpointCountQueryParams.payload.query.bool.should.push(filterQuery);
        };

      }
    }

    if (commIdArr.length) {
      const commIdQueryParams = buildFilterQuery('inte', [...new Set(commIdArr)]);

      //debugger
      console.log(`commIdQueryParams: ${JSON.stringify(commIdQueryParams)}`);

      if (Object.keys(commIdQueryParams).length) {
        if (isAllFiter) {
          endpointCountQueryParams.payload.query.bool.must.push(commIdQueryParams);
        } else {
          endpointCountQueryParams.payload.query.bool.should.push(commIdQueryParams);
        };
      }
    };

    if (metroIdArr.length) {
      const metroQueryParams = buildFilterQuery('m_id', [...new Set(metroIdArr)]);

      //debugger
      console.log(`metroQueryParams: ${JSON.stringify(metroQueryParams)}`);

      if (Object.keys(metroQueryParams).length) {
        if (isAllFiter) {
          endpointCountQueryParams.payload.query.bool.must.push(metroQueryParams);
        } else {
          endpointCountQueryParams.payload.query.bool.should.push(metroQueryParams);
        };
      }
    };

    // for stage_mdt_iso
    if (Object.keys(stageChangeQuery).length) {
      if (isAllFiter) {
        endpointCountQueryParams.payload.query.bool.must.push(stageChangeQuery);
      } else {
        endpointCountQueryParams.payload.query.bool.should.push(stageChangeQuery);
      };
    };


    const countResult = {
      totalEndpoints: 0,
      eligibleEndpoints: 0
    };

    //debugger
    console.log(`endpointCountQueryParams: ${JSON.stringify(endpointCountQueryParams)}`);

    const segmentCountResp = await elasticExecuteQuery(endpointCountQueryParams, true);
    console.log(`segmentCountResp: ${JSON.stringify(segmentCountResp)}`);

    if (
      segmentCountResp &&
      segmentCountResp.statusCode === 200 &&
      segmentCountResp.body &&
      segmentCountResp.body.hits &&
      segmentCountResp.body.hits.hits
    ) {
      const { hits } = segmentCountResp.body.hits;
      const totalResults = segmentCountResp.body.hits.total;
      console.log(`totalResults: ${totalResults}`);

      countResult.totalEndpoints = totalResults;
    };


    // for eligible endpoints
    endpointCountQueryParams.payload.query.bool.must_not = [{
      bool: { should: [{ term: { "optst.keyword": "ALL" } }, { term: { "optst.keyword": "PENDING" } }] }
    }];

    console.log(`endpointCountQueryParams: ${JSON.stringify(endpointCountQueryParams)}`);

    const eligibleSegmentCountResp = await elasticExecuteQuery(endpointCountQueryParams, true);
    console.log(`eligibleSegmentCountResp: ${JSON.stringify(eligibleSegmentCountResp)}`);

    if (
      eligibleSegmentCountResp &&
      eligibleSegmentCountResp.statusCode === 200 &&
      eligibleSegmentCountResp.body &&
      eligibleSegmentCountResp.body.hits &&
      eligibleSegmentCountResp.body.hits.hits
    ) {
      const { hits } = eligibleSegmentCountResp.body.hits;
      const totalResults = eligibleSegmentCountResp.body.hits.total;
      console.log(`totalResults: ${totalResults}`);

      countResult.eligibleEndpoints = totalResults;
    };

    return { status: true, count: countResult };

  } catch (error) {
    return { status: false, error };
  }
}

const getCampaignCount = async ({
  appid: applicationId,
  ps: pageSize,
  nt: nextToken,
  isFirstCall,
  segmentId,
  campaignList,
}) => {

  console.log('GetCampaign Count Entered..');
  // Do the call only if it is the initial call or paginated call
  if (isFirstCall || nextToken) {
    const getCountResp = await listCampaigns(
      {
        appid: applicationId,
        ps: pageSize,
        nt: nextToken,
      },
      true
    );
    console.log(`getCountResp: ${JSON.stringify(getCountResp)}`);
    if (getCountResp?.status && getCountResp?.data?.CampaignsResponse?.Item) {
      campaignList = [
        ...campaignList,
        ...getCountResp?.data?.CampaignsResponse?.Item,
      ];
    }
    return getCampaignCount({
      appid: applicationId,
      ps: pageSize,
      nt: getCountResp?.data?.CampaignsResponse?.NextToken ?? "",
      isFirstCall: false,
      segmentId,
      campaignList,
    });
  }
  console.log(`campaignList: ${JSON.stringify(campaignList)}`);
  // Reached the end of campaign list. Return the total count after filtering with segment id
  campaignList = campaignList.filter(
    (campaign) => campaign?.SegmentId === segmentId
  );
  console.log(`campaignList filtered: ${JSON.stringify(campaignList)}`);
  return campaignList.length;
};

const getJourneyCount = async ({
  appid: applicationId,
  ps: pageSize,
  nt: nextToken,
  isFirstCall,
  segmentId,
  journeyList,
}) => {

  console.log(`Entered GetJourneyCount...`);
  // Do the call only if it is the initial call or paginated call
  if (isFirstCall || nextToken) {
    const getCountResp = await listJourney(
      {
        appid: applicationId,
        ps: pageSize,
        nt: nextToken,
      },
      true
    );
    console.log(`getCountResp: ${JSON.stringify(getCountResp)}`);
    if (getCountResp?.status && getCountResp?.data?.JourneysResponse?.Item) {
      journeyList = [
        ...journeyList,
        ...getCountResp?.data?.JourneysResponse?.Item,
      ];
    }
    return getJourneyCount({
      appid: applicationId,
      ps: pageSize,
      nt: getCountResp?.data?.JourneysResponse?.NextToken ?? "",
      isFirstCall: false,
      segmentId,
      journeyList,
    });
  }
  console.log(`journeyList: ${JSON.stringify(journeyList)}`);
  // Reached the end of journey list. Return the total count after filtering with segment id
  journeyList = journeyList.filter(
    (journey) =>
      journey?.StartCondition?.SegmentStartCondition?.SegmentId === segmentId
  );
  console.log(`journeyList filtered: ${JSON.stringify(journeyList)}`);
  return journeyList.length;
};

const initCampaignJourneyCountCalculation = async (data) => {

  const {
    appId: applicationId,
    segmentId
  } = data;
  const pageSize = "100";
  let segmentCampaignCount = {
    journeyCount: 0,
    campaignCount: 0
  };

  try {
    console.log(`Entered Init data: ${JSON.stringify(data)}`);

    if (applicationId) {
      const campaignCount = await getCampaignCount({
        appid: applicationId,
        ps: pageSize,
        nt: "",
        isFirstCall: true,
        segmentId,
        campaignList: [],
      });
      console.log(`campaignCount.......: ${campaignCount}`);
      const journeyCount = await getJourneyCount({
        appid: applicationId,
        ps: pageSize,
        nt: "",
        isFirstCall: true,
        segmentId,
        journeyList: [],
      });
      console.log(`journeyCount........: ${journeyCount}`);

      segmentCampaignCount = {
        journeyCount,
        campaignCount
      }
    }
  } catch (error) {
    console.log(`Exception occured: `);
    console.log(error);
  }
  return segmentCampaignCount;
};

const getEndpointCountFromDb = async (data) => {
  try {

    const { hbId, segmentData } = data;

    let endPointCount = {
      journeyCount: 0,
      totalEndpoints: 0,
      eligibleEndpoints: 0,
      campaignCount: 0
    };

    // get total and elligible Endpoints count
    const segmentEndpointCount = await getSegmentEndpointCount({ hbId, segmentData });

    if (!segmentEndpointCount.status) throw segmentEndpointCount?.error || "Error in Segemnt Endpoint Count fetching";


    // get campaign count and journery count
    const segmentCampaignJourneyCount =
      await initCampaignJourneyCountCalculation({
        appId: segmentData?.ApplicationId || "",
        segmentId: segmentData?.Id || "",
      });


    //debugger
    console.log(`segmentCampaignJourneyCount: ${JSON.stringify(segmentCampaignJourneyCount)}`);


    const { totalEndpoints = 0, eligibleEndpoints = 0 } = segmentEndpointCount.count;

    const { journeyCount = 0, campaignCount = 0 } = segmentCampaignJourneyCount;

    endPointCount = {
      totalEndpoints,
      eligibleEndpoints,
      journeyCount,
      campaignCount
    };

    return { status: true, result: endPointCount };
  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`);
    return { status: false, error };
  }
}

const getEndpointCount = async (data) => {
  const { hbid } = data;
  const params = {
    TableName: process.env.entitiesTableName,
    IndexName: process.env.entitiesTableByEntityAndId,
    KeyConditionExpression: "#entity = :entity",
    ExpressionAttributeNames: {
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":entity": `count#${hbid}`,
    },
  };
  console.log(params);
  return getResourceJSON(params);
};
const getSegment = async (event) => {
  const { hbid: hbId = "", id: idParam = "" } = event.pathParameters;
  console.log(`idParam: ${idParam}`);
  const params = {
    ApplicationId: hbId /* required */,
    SegmentId: idParam /* required */,
  };
  try {
    const segmentDetail = await pinpoint.getSegment(params).promise();
    console.log(`segmentDetail: ${JSON.stringify(segmentDetail)}`);
    return success({ status: true, data: segmentDetail });
  } catch (e) {
    return failure({ status: false, error: e });
  }
};
export const createCampaign = async (data, isUpdate, isObjParam, paramObj) => {
  const name = data.name ? data.name.trim() : "";
  const desc = data.desc ? data.desc.trim() : "";
  const segid = data.segid ? data.segid : "";
  const title = data.title ? data.title.trim() : "";
  const body = data.body ? data.body.trim() : "";
  const html = data.html ? data.html.trim() : "";
  const tz = data.tz ? data.tz : "";
  const freq = data.freq ? data.freq : "";
  const startTime = data.st ? data.st : "";
  const endTime = data.et ? data.et : "";
  const appid = data.appid ? data.appid.trim() : "";
  const fromAddr = data.from ? data.from.trim() : "";
  const isPaused = data.isp ? data.isp : false;
  const emailTemplateName = data.emt ? data.emt.trim() : "";
  let params;
  if (isObjParam) {
    params = paramObj;
  } else {
    params = {
      ApplicationId: appid /* required */,
      WriteCampaignRequest: {
        /* required */ Description: desc,
        IsPaused: isPaused,
        Name: name,
        Schedule: {
          StartTime: startTime /* required */,
          Timezone: tz,
        },
        SegmentId: segid,
        tags: {
          Application: ApplicationTag,
          Environment: EnvironmentTag,
          Owner: OwnerTag,
          Purpose: PurposeTag,
          Service: "pinpoint",
        },
      },
    };
    console.log(`emailTemplateName: ${emailTemplateName}`);
    if (emailTemplateName) {
      // Existing Template
      params.WriteCampaignRequest.TemplateConfiguration = {
        EmailTemplate: {
          Name: emailTemplateName,
        },
      };
      params.WriteCampaignRequest.MessageConfiguration = {
        EmailMessage: {
          FromAddress: fromAddr,
        },
      };
    } else {
      // New Template
      params.WriteCampaignRequest.MessageConfiguration = {
        EmailMessage: {
          Title: title /* required */,
          Body: body,
          FromAddress: fromAddr,
          HtmlBody: html,
        },
      };
      params.WriteCampaignRequest.TemplateConfiguration = {};
    }
    console.log(
      `params.WriteCampaignRequest: ${JSON.stringify(
        params.WriteCampaignRequest
      )}`
    );
    // ########### IMMEDIATE Doesnt require frequency key
    if (freq === "IMMEDIATE") {
      params.WriteCampaignRequest.Schedule.StartTime = freq;
    } else if (freq) {
      params.WriteCampaignRequest.Schedule.Frequency = freq;
    }
    // ########### IMMEDIATE Doesnt require frequency key
    if (endTime) {
      params.WriteCampaignRequest.Schedule.EndTime = endTime;
    }
    if (isUpdate) {
      // Update Campaign
      const campid = data.campid ? data.campid.trim() : "";
      params.CampaignId = campid;
    }
  }
  // Add the Lambda hook to customize the segment on campaign send
  params.WriteCampaignRequest.Hook = {
    LambdaFunctionName: SEGMENT_HOOK_LAMBDA_ARN,
    Mode: "FILTER",
  };
  if (isUpdate) {
    // Update Campaign
    console.log(`params: ${JSON.stringify(params)}`);
    try {
      const updateCampaignResp = await pinpoint
        .updateCampaign(params)
        .promise();
      console.log(`updateCampaignResp: ${JSON.stringify(updateCampaignResp)}`);
      if (isObjParam) {
        return updateCampaignResp;
      }

      return success({ status: true, data: updateCampaignResp });
    } catch (e) {
      console.log(`createCampaignResponse: ${JSON.stringify(e)}`);
      if (isObjParam) {
        return e;
      }

      return failure({ status: false, error: e });
    }
  } else {
    // Create Campaign
    console.log(`params: ${JSON.stringify(params)}`);
    try {
      const createCampaignResponse = await pinpoint
        .createCampaign(params)
        .promise();
      console.log(
        `createCampaignResponse: ${JSON.stringify(createCampaignResponse)}`
      );
      if (isObjParam) {
        return createCampaignResponse;
      }

      return success({ status: true, data: createCampaignResponse });
    } catch (e) {
      console.log(`createCampaignResponse: ${JSON.stringify(e)}`);
      if (isObjParam) {
        return e;
      }

      return failure({ status: false, error: e });
    }
  }
};
const getListCampJourneyParams = (data) => {
  const { appid = "", ps = "", nt = "" } = data;
  const params = {
    ApplicationId: appid /* required */,
  };
  if (ps) {
    params.PageSize = ps;
  }
  if (nt) {
    params.Token = nt;
  }
  console.log(`params: ${JSON.stringify(params)}`);
  return params;
};
/* eslint consistent-return: "off" */
const getSegmentList = async ({
  appid: applicationId,
  ps: pageSize,
  nt: nextToken,
  isFirstCall,
  segmentListArr,
  getAllData = false,
}) => {
  console.log(`In getSegmentList`);
  console.log(`applicationId: ${applicationId}`);
  console.log(`pageSize: ${pageSize}`);
  console.log(`nextToken: ${nextToken}`);
  console.log(`isFirstCall: ${isFirstCall}`);
  console.log(`segmentListArr: ${JSON.stringify(segmentListArr)}`);
  console.log(`getAllData: ${getAllData}`);
  let segmentList;
  // Do the call only if it is the initial call or paginated call
  if (isFirstCall || nextToken) {
    const params = getListCampJourneyParams({
      appid: applicationId,
      ps: pageSize,
      nt: nextToken,
    });
    try {
      segmentList = await pinpoint.getSegments(params).promise();
      console.log(`segmentList: ${JSON.stringify(segmentList)}`);
    } catch (error) {
      console.log(`Exception occured`);
      console.log(error);
    }
    if (getAllData) {
      console.log(`In getAllData getSegmentList`);
      if (segmentList?.SegmentsResponse?.Item) {
        segmentListArr = [
          ...segmentListArr,
          ...segmentList?.SegmentsResponse?.Item,
        ];
      }
      return getSegmentList({
        appid: applicationId,
        ps: pageSize,
        nt: segmentList?.SegmentsResponse?.NextToken ?? "",
        isFirstCall: false,
        segmentListArr,
        getAllData,
      });
    }
  }
  console.log(`segmentListArr: ${JSON.stringify(segmentListArr)}`);
  if (getAllData) return { SegmentsResponse: { Item: segmentListArr } };
  return segmentList;
};
export const listSegments = async (
  data,
  isJSONOnly = false,
  getAllData = false
) => {
  let listOfSegments;
  const { appid = "", ps = "100", nt = "" } = data;
  try {
    listOfSegments = await getSegmentList({
      appid,
      ps,
      nt,
      isFirstCall: true,
      segmentListArr: [],
      getAllData,
    });
    console.log(`listOfSegments: ${JSON.stringify(listOfSegments)}`);
    // Only return the endpoint count for the list API
    if (!isJSONOnly) {
      let listOfSegmentsWithCount;
      // Attach the number of endpoints in each segment
      // Get all the builders for getting the home builder id that matches Pinpoint Application Id(hb_id here)
      const buildersList = await getEntities("builder");
      console.log(`buildersList: ${JSON.stringify(buildersList)}`);
      const builderId = buildersList.reduce((homeBuilderId, builder) => {
        if (builder.appid === appid) {
          homeBuilderId = builder.id;
        }
        return homeBuilderId;
      }, "");

      // Get the endpoint count resource for this home builder
      if (builderId) {

        // const endpointCountResp = await getEndpointCount({ hbid: builderId });
        // console.log(`endpointCountResp: ${JSON.stringify(endpointCountResp)}`);
        // const endpointCountObj =
        //   (endpointCountResp?.length && endpointCountResp[0]?.count) || {};
        // const endpointCountUpdateTime =
        //   (endpointCountResp?.length && endpointCountResp[0]?.mdt) || "";
        // console.log(`endpointCountObj: ${JSON.stringify(endpointCountObj)}`);
        // console.log(
        //   `endpointCountUpdateTime: ${JSON.stringify(endpointCountUpdateTime)}`
        // );
        // Add the count for each matching segment
        // if (listOfSegments?.SegmentsResponse?.Item?.length) {
        //   listOfSegmentsWithCount = listOfSegments.SegmentsResponse.Item.map(
        //     (segment) => {
        //       console.log(`segment.Id: ${segment.Id}`);
        //       segment.EndpointCount = endpointCountObj[segment.Id] ?? {
        //         eligibleEndpoints: 0,
        //         totalEndpoints: 0,
        //         campaignCount: 0,
        //         journeyCount: 0,
        //       };
        //       segment.EndpointCountUpdateTime = endpointCountUpdateTime;
        //       return segment;
        //     }
        //   );
        //   console.log(
        //     `listOfSegmentsWithCount: ${JSON.stringify(
        //       listOfSegmentsWithCount
        //     )}`
        //   );
        //   console.log(`listOfSegments: ${JSON.stringify(listOfSegments)}`);
        // }

        if (listOfSegments?.SegmentsResponse?.Item?.length) {
          listOfSegmentsWithCount = await Promise.all(listOfSegments.SegmentsResponse.Item.map(
            async (segment) => {
              const endPointResp = await getEndpointCountFromDb({
                hbId: builderId,
                segmentData: segment
              });
              console.log(`endPointResp: ${JSON.stringify(endPointResp)}`);

              if (!endPointResp.status) throw endPointResp.error;

              segment.EndpointCount = endPointResp.result;
              segment.EndpointCountUpdateTime = Date.now();

              //debugger
              console.log(`segment: ${JSON.stringify(segment)}`);

              return segment;
            }
          ));
          console.log(
            `listOfSegmentsWithCount: ${JSON.stringify(
              listOfSegmentsWithCount
            )}`
          );
          console.log(`listOfSegments: ${JSON.stringify(listOfSegments)}`);
        }
      }
    }

    if (isJSONOnly) {
      console.log(`In JSON only return`);
      return listOfSegments;
    }
    return success({ status: true, data: listOfSegments });
  } catch (e) {
    if (isJSONOnly) {
      return e;
    }
    return failure({ status: false, error: e });
  }
};
export const listCampaigns = async (data, isJSONOnly = false) => {
  const params = getListCampJourneyParams(data);
  console.log(`params: ${JSON.stringify(params)}`);
  try {
    const getCampaignsResponse = await pinpoint.getCampaigns(params).promise();
    console.log(
      `getCampaignsResponse: ${JSON.stringify(getCampaignsResponse)}`
    );
    /* if (getCampaignsResponse && getCampaignsResponse.CampaignsResponse && getCampaignsResponse.CampaignsResponse.Item && getCampaignsResponse.CampaignsResponse.Item.length) {
            getCampaignsResponse.CampaignsResponse.Item = getCampaignsResponse.CampaignsResponse.Item.filter((campaign) => campaign.Description.indexOf(`${hbid}#`) !== -1);
        } */
    if (isJSONOnly) {
      return { status: true, data: getCampaignsResponse };
    }

    return success({ status: true, data: getCampaignsResponse });
  } catch (error) {
    if (isJSONOnly) {
      return { status: false, error };
    }

    return failure({ status: false, error });
  }
};
export const getCampaign = async (event, isFromFirehose) => {
  const hbid =
    event && event.pathParameters && event.pathParameters.hbid
      ? event.pathParameters.hbid
      : "";
  const campaignId =
    event && event.pathParameters && event.pathParameters.id
      ? event.pathParameters.id
      : "";
  const params = {
    ApplicationId: hbid /* required */,
    CampaignId: campaignId /* required */,
  };
  try {
    const getCampaignResponse = await pinpoint.getCampaign(params).promise();
    console.log(`getCampaignResponse: ${JSON.stringify(getCampaignResponse)}`);
    if (isFromFirehose) {
      return getCampaignResponse;
    }

    return success({ status: true, data: getCampaignResponse });
  } catch (e) {
    return failure({ status: false, error: e });
  }
};
const getCampaignKpi = async (data) => {
  const campaignId = data.campid ? data.campid : "";
  const kpiNames = data.kpi ? data.kpi : [];
  // const StartTime = data.st ? data.st : '';
  // const EndTime = data.et ? data.et : Date.now();
  const pageSize = data.ps ? data.ps : "";
  const appid = data.appid ? data.appid.trim() : "";
  const kpiNamePromiseArr = [];
  // EndTime: endTime,
  // StartTime: startTime

  const isBoolean = (val) => typeof val === "boolean";
  if (
    !Object.prototype.hasOwnProperty.call(data, "isOld") ||
    !isBoolean(data?.isOld)
  )
    return failure({
      status: false,
      error: "isOld parameter is required",
    });

  if (data?.isOld) {
    try {
      const params = {
        TableName: process.env.entitiesTableName,
        KeyConditionExpression: "#id = :id and #entity = :entity",
        ExpressionAttributeNames: {
          "#id": "id",
          "#entity": "entity",
        },
        ExpressionAttributeValues: {
          ":id": appid,
          ":entity": `pinpoint_analytics#${campaignId}`,
        },
      };
      const pinpointMatrixResp = await getResourceJSON(params);
      console.log(`superAdminResp: ${JSON.stringify(pinpointMatrixResp)}`);
      return success({
        status: true,
        isOld: data.isOld,
        campaignId,
        data: pinpointMatrixResp,
      });
    } catch (e) {
      console.log(`e: ${JSON.stringify(e.stack)}`);
      return failure({ status: false, error: e.stack });
    }
  }

  for (const kpiName of kpiNames) {
    const params = {
      ApplicationId: appid /* required */,
      CampaignId: campaignId /* required */,
      KpiName: kpiName /* required */,
      PageSize: pageSize,
    };
    console.log(`params: ${JSON.stringify(params)}`);
    kpiNamePromiseArr.push(pinpoint.getCampaignDateRangeKpi(params).promise());
  }
  try {
    const campaignKPIResponse = await Promise.all(kpiNamePromiseArr);
    console.log(`campaignKPIResponse: ${JSON.stringify(campaignKPIResponse)}`);
    return success({
      status: true,
      isOld: data.isOld,
      campaignId,
      data: campaignKPIResponse,
    });
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
    return failure({ status: false, error: e.stack });
  }
};
const getCampaignActivities = async (data) => {
  const appid = data.appid ? data.appid.trim() : "";
  const campaignId = data.campid ? data.campid : "";
  const params = {
    ApplicationId: appid /* required */,
    CampaignId: campaignId /* required */,
  };
  console.log(`params: ${JSON.stringify(params)}`);
  try {
    const campaignActivityResponse = await pinpoint
      .getCampaignActivities(params)
      .promise();
    console.log(
      `campaignActivityResponse: ${JSON.stringify(campaignActivityResponse)}`
    );
    return success({ status: true, data: campaignActivityResponse });
  } catch (e) {
    console.log(`e: ${JSON.stringify(e)}`);
    return failure({ status: false, error: e });
  }
};
async function getAllJourneys(applicationId) {
  const journeys = [];
  let nextToken;

  do {
    const params = {
      ApplicationId: applicationId,
      PageSize: "1000",
      ...(nextToken && { Token: nextToken })
    };

    const response = await pinpoint.listJourneys(params).promise();
    journeys.push(...response.JourneysResponse.Item);
    nextToken = response.JourneysResponse.NextToken;
  } while (nextToken);

  return journeys;
}
export const deleteJourney = async (data, isJSONOnly = false) => {
  const appid = data.appid ? data.appid.trim() : "";
  const jid = data.jid ? data.jid : "";
  const params = {
    ApplicationId: appid /* required */,
    JourneyId: jid /* required */,
  };
  console.log(`deleteJourneyParams: ${JSON.stringify(params)}`);
  try {
    const deleteJourneyResp = await pinpoint.deleteJourney(params).promise();
    console.log(`deleteJourneyResp: ${JSON.stringify(deleteJourneyResp)}`);
    if (isJSONOnly) {
      return deleteJourneyResp;
    }

    return success({ status: true, data: deleteJourneyResp });
  } catch (e) {
    console.log(`e: ${JSON.stringify(e)}`);
    if (isJSONOnly) {
      return e;
    }

    return failure({ status: false, error: e });
  }
};
export const deleteSegment = async (data, isJSONOnly = false) => {
  const appid = data.appid ? data.appid.trim() : "";
  const segmentId = data.segid ? data.segid : "";
  const params = {
    ApplicationId: appid /* required */,
    SegmentId: segmentId /* required */,
  };
  console.log(`params: ${JSON.stringify(params)}`);
  try {
    const deleteSegmentResp = await pinpoint.deleteSegment(params).promise();
    console.log(`deleteSegmentResp: ${JSON.stringify(deleteSegmentResp)}`);

    console.log(`Processing deletion of journeys for segment: ${segmentId}`);
    // Get all journeys
    const journeys = await getAllJourneys(appid);
    // Filter journeys associated with the deleted segment
    const affectedJourneys = journeys.filter(journey =>
      journey.Schedule?.SegmentId === segmentId);
    console.log(`Found ${affectedJourneys.length} journeys associated with segment ${segmentId}`);
    // Delete all affected journeys
    const deletionResults = await Promise.allSettled(
      affectedJourneys.map(async (journey) => {
        try {
          const deleteJourneyResp = await deleteJourney({ appid, jid: journey.Id });
          return deleteJourneyResp;
        } catch (error) {
          console.error(`Failed to delete journey ${journey.Id}:`, error);
          return {
            journeyId: journey.Id,
            name: journey.Name,
            status: 'error',
            error: error.message
          };
        }
      }));
    // Prepare deletion report
    const journeyDeletionReport = {
      segmentId,
      totalJourneys: affectedJourneys.length,
      successfulDeletions: deletionResults.filter(r => r.value?.status === 'deleted').length,
      failedDeletions: deletionResults.filter(r => r.value?.status === 'error').length,
      details: deletionResults.map(r => r.value)
    };
    // Log the results
    console.log('Deletion report:', JSON.stringify(journeyDeletionReport, null, 2));

    if (isJSONOnly) {
      return { ...deleteSegmentResp, ...journeyDeletionReport };
    }
    return success({ status: true, data: { ...deleteSegmentResp, ...journeyDeletionReport } });

  } catch (e) {
    console.log(`e: ${JSON.stringify(e)}`);
    if (isJSONOnly) {
      return e;
    }

    return failure({ status: false, error: e });
  }
};
async function getAllSegments(applicationId) {
  const segments = [];
  let nextToken;

  do {
    const params = {
      ApplicationId: applicationId,
      PageSize: "1000",
      ...(nextToken && { Token: nextToken })
    };

    const response = await pinpoint.getSegments(params).promise();
    segments.push(...response.SegmentsResponse.Item);
    nextToken = response.SegmentsResponse.NextToken;
  } while (nextToken);

  return segments;
}
async function getAllPinpointApplications() {
  const applications = [];
  let nextToken;
  do {
    const params = {
      PageSize: "1000",
      ...(nextToken && { Token: nextToken })
    };

    const response = await pinpoint.getApps(params).promise();
    applications.push(...response.ApplicationsResponse.Item);
    nextToken = response.ApplicationsResponse.NextToken;
  } while (nextToken);

  return applications;
}
const deleteOrphanJourneys = async () => {
  try {
    // Get all Pinpoint applications
    const applications = await getAllPinpointApplications();
    console.log(`Found ${applications.length} Pinpoint applications`);

    let totalOrphanedJourneys = 0;
    const resultsPerApp = [];
    // Process each application
    for (const app of applications) {
      console.log(`Processing application: ${app.Name} (${app.Id})`);
      // Step 1: Get all segments for this application
      const segments = await getAllSegments(app.Id);
      const validSegmentIds = new Set(segments.map(segment => segment.Id));

      // Step 2: Get all journeys for this application
      const journeys = await getAllJourneys(app.Id);

      // Step 3: Find and delete orphaned journeys
      const deletePromises = [];
      const orphanedJourneys = [];

      console.log(`Valid Segment id's for ${app.Name} :: `, validSegmentIds);

      for (const journey of journeys) {

        console.log(`Current Journey : ${JSON.stringify(journey)}`);


        const segmentId = journey.StartCondition?.SegmentStartCondition?.SegmentId;

        console.log(`Journey Segment id : ${segmentId}`);

        if (segmentId && !validSegmentIds.has(segmentId)) {
          console.log(`Found orphaned journey: ${journey.Name} (${journey.Id}) linked to deleted segment: ${segmentId} in application: ${app.Id}`);
          orphanedJourneys.push({
            journeyId: journey.JourneyId,
            name: journey.Name,
            segmentId
          });
          deletePromises.push(deleteJourney({ appid: app.Id, jid: journey.Id }, true));
        }
      }
      const result = await Promise.allSettled(deletePromises);
      console.log("journey delete results :: ", result);

      totalOrphanedJourneys += deletePromises.length;
      resultsPerApp.push({
        applicationId: app.Id,
        applicationName: app.Name,
        totalJourneys: journeys.length,
        orphanedJourneysDeleted: orphanedJourneys
      });
    }
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Successfully processed all applications. Deleted ${totalOrphanedJourneys} total orphaned journeys.`,
        totalApplications: applications.length,
        totalOrphanedJourneysDeleted: totalOrphanedJourneys,
        resultsPerApplication: resultsPerApp
      })
    };
  } catch (error) {
    console.error('Error in : deleteOrphanJourneys : ', error);
    throw error;
  }
}
export const checkIdentityExists = async (email, isArrayOfEmails) => {
  const params = {
    Identities: [],
  };
  if (isArrayOfEmails) {
    // If email array is provided
    params.Identities = email;
  } else {
    // If only a single email is provided
    params.Identities.push(email);
  }
  console.log(`params: ${JSON.stringify(params)}`);
  try {
    const getIdentityResp = await ses
      .getIdentityVerificationAttributes(params)
      .promise();
    console.log(`getIdentityResp: ${JSON.stringify(getIdentityResp)}`);
    return getIdentityResp;
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
    return e.stack;
  }
};
export const doVerifyEmailIdentityOnly = async (email) => {
  const SesVerificationTemplate = "CRM_VERIFICATION_TEMPLATE";
  try {
    console.log(
      `SesVerificationTemplate: ${JSON.stringify(SesVerificationTemplate)}`
    );
    let getTemplateResp = "";
    let sendVerificationEmailResp = "";

    try {
      getTemplateResp = await ses
        .getCustomVerificationEmailTemplate({
          TemplateName: SesVerificationTemplate,
        })
        .promise();
      console.log(`getTemplateResp: ${JSON.stringify(getTemplateResp)}`);
    } catch (error) {
      console.log(
        `ses.getCustomVerificationEmailTemplate error: ${JSON.stringify(error)}`
      );
      const verifyEmailIdentityParams = {
        EmailAddress: email,
      };
      sendVerificationEmailResp = await ses
        .verifyEmailIdentity(verifyEmailIdentityParams)
        .promise();
      console.log(
        `verifyEmailIdentity: ${JSON.stringify(sendVerificationEmailResp)}`
      );
      return sendVerificationEmailResp;
    }

    if (SesVerificationTemplate && getTemplateResp) {
      const sendCustomVerificationEmailParams = {
        EmailAddress: email,
        TemplateName: SesVerificationTemplate,
      };
      sendVerificationEmailResp = await ses
        .sendCustomVerificationEmail(sendCustomVerificationEmailParams)
        .promise();
      console.log(
        `sendCustomVerificationEmail: ${JSON.stringify(
          sendVerificationEmailResp
        )}`
      );
    } else {
      const verifyEmailIdentityParams = {
        EmailAddress: email,
      };
      sendVerificationEmailResp = await ses
        .verifyEmailIdentity(verifyEmailIdentityParams)
        .promise();
      console.log(
        `verifyEmailIdentity: ${JSON.stringify(sendVerificationEmailResp)}`
      );
    }
    return sendVerificationEmailResp;
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
    return e.stack;
  }
};
export const verifyEmailIdentity = async (record, shouldReturn) => {
  /* eslint consistent-return: "off" */
  const identityExists = await checkIdentityExists(record.email);
  console.log(`identityExists: ${JSON.stringify(identityExists)}`);
  if (
    (identityExists &&
      identityExists.VerificationAttributes &&
      !identityExists.VerificationAttributes[record.email]) ||
    (identityExists.VerificationAttributes[record.email].VerificationStatus &&
      identityExists.VerificationAttributes[record.email].VerificationStatus !==
      "Success")
  ) {
    const SesVerificationTemplate = "CRM_VERIFICATION_TEMPLATE";
    try {
      console.log(
        `SesVerificationTemplate: ${JSON.stringify(SesVerificationTemplate)}`
      );
      let getTemplateResp = "";
      let sendVerificationEmailResp = "";

      try {
        getTemplateResp = await ses
          .getCustomVerificationEmailTemplate({
            TemplateName: SesVerificationTemplate,
          })
          .promise();
        console.log(`getTemplateResp: ${JSON.stringify(getTemplateResp)}`);
      } catch (error) {
        console.log(
          `ses.getCustomVerificationEmailTemplate error: ${JSON.stringify(
            error
          )}`
        );
        const verifyEmailIdentityParams = {
          EmailAddress: record.email,
        };
        sendVerificationEmailResp = await ses
          .verifyEmailIdentity(verifyEmailIdentityParams)
          .promise();
        console.log(
          `verifyEmailIdentity: ${JSON.stringify(sendVerificationEmailResp)}`
        );
        if (shouldReturn) {
          return sendVerificationEmailResp;
        }
      }

      if (SesVerificationTemplate && getTemplateResp) {
        const sendCustomVerificationEmailParams = {
          EmailAddress: record.email,
          TemplateName: SesVerificationTemplate,
        };
        sendVerificationEmailResp = await ses
          .sendCustomVerificationEmail(sendCustomVerificationEmailParams)
          .promise();
        console.log(
          `sendCustomVerificationEmail: ${JSON.stringify(
            sendVerificationEmailResp
          )}`
        );
      } else {
        const verifyEmailIdentityParams = {
          EmailAddress: record.email,
        };
        sendVerificationEmailResp = await ses
          .verifyEmailIdentity(verifyEmailIdentityParams)
          .promise();
        console.log(
          `verifyEmailIdentity: ${JSON.stringify(sendVerificationEmailResp)}`
        );
      }
      if (shouldReturn) {
        return sendVerificationEmailResp;
      }
    } catch (e) {
      console.log(`e: ${JSON.stringify(e.stack)}`);
      if (shouldReturn) {
        return e.stack;
      }
    }
  }
};
const createJourneyTaskNote = async (data) => {
  console.log(`In createJourneyTaskNote: ${JSON.stringify(data)}`);
  let response;
  try {
    const params = {
      TableName: process.env.entitiesTableName,
      Item: data,
    };
    console.log(params);
    const createResResp = await postResources(params);
    console.log(`createResResp: ${JSON.stringify(createResResp)}`);
    response = { status: true, data: createResResp };
  } catch (error) {
    console.log("Error occured in createJourneyTaskNote");
    console.log(error);
    response = { status: false, error };
  }
  return response;
};
const getTaskContent = async ({
  noteId,
  ApplicationId,
  JourneyId,
  isJSONOnly = false,
}) => {
  let response;
  try {
    const resp = await getRecordByIdAndEntity(
      noteId,
      `journey#task#${ApplicationId}#${JourneyId}`
    );
    console.log(`resp: ${JSON.stringify(resp)}`);
    const data = resp?.length ? resp[0] : null;
    response = { status: true, data };
  } catch (error) {
    console.log(`Error occured in getTaskContent`);
    console.log(error);
    response = { status: false, error };
  }
  if (isJSONOnly) return response;
  if (response?.status && response?.data === null) return notFound(response);
  if (response?.status) return success(response);
  if (!response?.status) return failure(response);
};
const processCustomJourneyActivities = async ({
  Activities,
  ApplicationId,
}) => {
  const taskActivityParams = [];
  try {
    for (const key in Activities) {
      if (Activities[key]) {
        console.log(`Activities[key]: ${JSON.stringify(Activities[key])}`);

        const emailActivity = Activities[key]?.EMAIL || null;
        console.log(`emailActivity: ${JSON.stringify(emailActivity)}`);

        const taskActivity = Activities[key]?.TASK || null;
        console.log(`taskActivity: ${JSON.stringify(taskActivity)}`);

        const customActivity = emailActivity || taskActivity;
        if (customActivity) {
          const { MessageConfig: taskData = null } = customActivity;
          console.log(`taskData: ${JSON.stringify(taskData)}`);
          let taskContentId = null;
          const activityType = taskActivity ? "TASK" : "CUSTOM";
          // Create the content db resource using note
          if (taskData && activityType === "TASK") {
            const {
              Subject: sub = null,
              AssignedTo: assi = null,
              Notes: note = null,
            } = taskData;
            console.log(`sub: ${sub}`);
            console.log(`assi: ${assi}`);
            console.log(`note: ${note}`);
            const taskParams = {
              sub,
              assi,
              note,
              atype: "task",
              endDt: 0,
              status: "",
            };

            const creationDate = Date.now();
            taskContentId = uuidv4();
            taskActivityParams.push({
              id: taskContentId,
              cdt: creationDate,
              mdt: creationDate,
              appid: ApplicationId,
              activityId: key,
              params: taskParams,
            });
            console.log(
              `taskActivityParams: ${JSON.stringify(taskActivityParams)}`
            );
          }
          const {
            MessageConfig: { FromAddress = "" } = {},
            TemplateName,
            NextActivity,
          } = customActivity;

          Activities[key].CUSTOM = {
            DeliveryUri: taskActivity
              ? JOURNEY_CUSTOM_TASK_LAMBDA_ARN
              : JOURNEY_CUSTOM_EMAIL_LAMBDA_ARN,
            EndpointTypes: ["EMAIL"],
            MessageConfig: {
              Data: taskActivity
                ? `${taskContentId}|${activityType}`
                : FromAddress,
            },
            NextActivity,
            TemplateName,
          };
          if (taskActivity) delete Activities[key]?.TASK;
          else delete Activities[key]?.EMAIL;
          console.log(
            `Activities[key] after processing: ${JSON.stringify(
              Activities[key]
            )}`
          );
        }
      }
    }
  } catch (error) {
    console.log(`Error occured in processCustomJourneyActivities`);
    console.log(error);
  }
  return taskActivityParams;
};
const saveJourneyTaskRes = async ({
  taskActivityParam,
  journeyId,
  ApplicationId,
}) => {
  console.log(`In saveJourneyTaskRes`);
  taskActivityParam.journeyId = journeyId;
  taskActivityParam.entity = `journey#task#${ApplicationId}#${journeyId}`;
  return createJourneyTaskNote(taskActivityParam);
};
export const createJourney = async (data, isImport = false) => {
  console.log(`params: ${JSON.stringify(data)}`);
  const { ApplicationId, WriteJourneyRequest: { Activities = {} } = null } =
    data;
  let taskActivityParams = null;
  try {
    // Loop through Activities object and convert the "EMAIL" activities to CUSTOM channel
    taskActivityParams = await processCustomJourneyActivities({
      Activities,
      ApplicationId,
    });
    console.log(`taskActivityParams: ${JSON.stringify(taskActivityParams)}`);
    const createJourneyResponse = await pinpoint.createJourney(data).promise();
    console.log(
      `createJourneyResponse: ${JSON.stringify(createJourneyResponse)}`
    );
    const { JourneyResponse: { Id: journeyId = null } = {} } =
      createJourneyResponse;
    // Add the journeyId to the taskActivityParams and create task content resource
    for await (const taskActivityParam of taskActivityParams) {
      const taskNoteContentResp = await saveJourneyTaskRes({
        taskActivityParam,
        journeyId,
        ApplicationId,
      });
      console.log(
        `taskNoteContentResp: ${JSON.stringify(taskNoteContentResp)}`
      );
    }
    if (isImport) {
      return createJourneyResponse;
    }
    return success({ status: true, data: createJourneyResponse });
  } catch (e) {
    console.log(`createJourneyResponse: ${JSON.stringify(e)}`);
    if (isImport) {
      return e;
    }
    return badRequest({ status: false, error: e });
  }
};
export const listJourney = async (data, isJSONOnly = false) => {
  const params = getListCampJourneyParams(data);
  try {
    const listJourneyResponse = await pinpoint.listJourneys(params).promise();
    console.log(`listJourneyResponse: ${JSON.stringify(listJourneyResponse)}`);
    if (isJSONOnly) {
      return { status: true, data: listJourneyResponse };
    }

    return success({ status: true, data: listJourneyResponse });
  } catch (error) {
    if (isJSONOnly) {
      return { status: false, error };
    }

    return failure({ status: false, error });
  }
};

export const getEmailTemplate = async (data, isJSONOnly = false) => {
  console.log(`params: ${JSON.stringify(data)}`);
  try {
    let getEmailTemplateResponse = await pinpoint
      .getEmailTemplate(data)
      .promise();
    console.log(
      `getEmailTemplateResponse: ${JSON.stringify(getEmailTemplateResponse)}`
    );

    const templateName = getEmailTemplateResponse?.EmailTemplateResponse?.TemplateName || "";

    if (templateName) {

      const queryParam = {
        httpMethod: "POST",
        requestPath: "/_search",
        payload: {
          query: {
            match: {
              'fname.keyword': templateName
            }
          }
        }
      };

      const emailTemplateData = await elasticExecuteQuery(queryParam, true);

      const templateData = emailTemplateData?.body?.hits?.hits[0]?._source || {};

      if (Object.keys(templateData).length) {

        getEmailTemplateResponse = {
          ...getEmailTemplateResponse,
          oldst: templateData?.oldst || false,
          newst: templateData?.newst || false,
          crby: templateData.crby,
          cmpby: templateData.cmpby
        }
      }

    }


    if (isJSONOnly) {
      return getEmailTemplateResponse;
    }

    return success({ status: true, getEmailTemplateResponse });
  } catch (e) {
    console.log(`getEmailTemplateResponse: ${JSON.stringify(e)}`);
    if (isJSONOnly) {
      return e;
    }

    return badRequest({ status: false, error: e });
  }
};

export const getEmailTemplateRaw = async (data) => {
  console.log(`params: ${JSON.stringify(data)}`);
  try {
    const getEmailTemplateResponse = await pinpoint
      .getEmailTemplate(data)
      .promise();
    console.log(
      `getEmailTemplateResponse: ${JSON.stringify(getEmailTemplateResponse)}`
    );
    return getEmailTemplateResponse;
  } catch (e) {
    console.log(`getEmailTemplateResponse: ${JSON.stringify(e)}`);
    return e;
  }
};

/**
 * Function to create entries in Dynamodb for templates 
 * @param hbId : Home Builder ID
 * @param type : Template type Email, SMS etc
 * @param templateData : Template name, arn, isactive, tag-type, tag-appname
 * @param isBatchMode : To batch create dynamo entry for already existing templates
 */
export const createTemplateDynamoEntry = async ({ hbId, templateData, type, isBatchMode = false, crby = "", cmpby = {}, oldst = false, newst = false }) => {

  if (isBatchMode) {
    try {
      console.log('In createTemplateDynamoEntry batchMode');
      const pinpointPayload = {
        PageSize: '1000',
        Prefix: hbId,
        TemplateType: 'EMAIL'
      };
      const listTemplateResponse = await pinpoint
        .listTemplates(pinpointPayload)
        .promise();
      console.log(
        `listTemplateResponse: ${JSON.stringify(listTemplateResponse)}`
      );
      const filteredData = listTemplateResponse.TemplatesResponse.Item.filter(
        (item) => item.TemplateName.startsWith(hbId)
      );
      const templateEntries = [];
      for (let i = 0; i < filteredData.length; i += 1) {
        try {
          const emailTemplateResp = await getEmailTemplate({ TemplateName: filteredData[i].TemplateName }, true)
          console.log(`emailTemplateResponse :: ${JSON.stringify(emailTemplateResp)}`);
          templateEntries.push({
            PutRequest: {
              Item: {
                id: uuidv4(),
                utype: filteredData[i].TemplateType.toLowerCase(),
                hbid: hbId,
                entity: `template#${hbId}#${filteredData[i].TemplateType.toLowerCase()}`,
                mdt: Date.parse(filteredData[i].LastModifiedDate),
                cdt: Date.parse(filteredData[i].CreationDate),
                fname: filteredData[i].TemplateName,
                lname: emailTemplateResp.EmailTemplateResponse.Arn,
                type: emailTemplateResp.EmailTemplateResponse.tags.type,
                data: emailTemplateResp.EmailTemplateResponse.tags.isActive,
                name: emailTemplateResp.EmailTemplateResponse.tags.app,
              }
            }
          })
        } catch (error) {
          console.log(`error in getTemplateResponse ${JSON.stringify(error)}`);
          return failure({ status: false, error })
        }
      }

      const batchParams = {
        RequestItems: {
          [process.env.entitiesTableName]: [...templateEntries]
        }
      }

      console.log(`batchWrite Params :: ${JSON.stringify(batchParams)}`);
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

      if (!isBatchSuccess) {
        return failure({ status: false, error: "Batch create failed" })
      }

      return success({ status: true, message: 'Batch create successfull' })
    } catch (error) {
      console.log(`Error in batch create`);
      return failure({ status: false, error })
    }

  }
  try {
    const params = {
      TableName: process.env.entitiesTableName,
      Item: {
        id: uuidv4(),
        utype: type,
        hbid: hbId,
        entity: `template#${hbId}#${type}`,
        mdt: Date.now(),
        cdt: Date.now(),
        fname: templateData.name,
        lname: templateData.arn,
        type: templateData.type,
        data: templateData.isactive,
        name: templateData.appname,
        crby,
        cmpby,
        oldst,
        newst
      }
    }

    console.log(`Dynamo entry params : ${JSON.stringify(params)}`);
    const dynamoWriteResponse = await postResources(params, true);
    console.log(`dynamoWriteResponse : ${JSON.stringify(dynamoWriteResponse)}`);
  } catch (error) {
    console.log(`Error in createTemplate : ${JSON.stringify(error)}`);
  }

}

/**
 * Function to update the dynamo entry of template status
 * @param {*} id Template id stored in the db
 * @param {*} hbId Home Builder ID
 * @param {*} type Type of template : email, sms ...
 * @param {*} isActive Template status
 */
const updateTemplateDynamoEntry = async (id, hbId, type = 'email', isActive, tagType, online_agent, sales_agent) => {
  console.log(`TemplateId :: ${id}`);
  const params = {
    TableName: process.env.entitiesTableName,
    Key: {
      id,
      entity: `template#${hbId}#${type}`,
    },
    UpdateExpression: `set #data = :data, #mdt = :mdtval, #type = :type, #oldst = :oldst, #newst = :newst`,
    ExpressionAttributeNames: {
      '#data': 'data',
      '#mdt': 'mdt',
      '#type': 'type',
      '#oldst': 'oldst',
      '#newst': 'newst'
    },
    ExpressionAttributeValues: {
      ":data": isActive,
      ":mdtval": Date.now(),
      ":type": tagType,
      ":oldst": online_agent,
      ":newst": sales_agent
    },
    ReturnValuesOnConditionCheckFailure: "ALL_OLD"
  }

  console.log(`Update Params : ${JSON.stringify(params)}`);
  const updateTemplateResp = await updateResources(params);
  console.log(`updateTemplateResp :`, updateTemplateResp);
  return updateTemplateResp;
}

const deleteTemplateDynamoEntry = async (data) => {
  try {
    console.log(`Delete template dynamo :: ${JSON.stringify(data)}`);
    const params = {
      TableName: process.env.entitiesTableName,
      Key: {
        ...data
      }
    }
    console.log(`Delete Params :: ${JSON.stringify(params)}`);
    const delResp = await deleteResources(params);
    console.log(`Delete Template Response :: ${JSON.stringify(delResp)}`);
    return success({ status: true, delResp })
  } catch (error) {
    console.log(`Delete error : ${JSON.stringify(error)}`);
    return failure({ status: false, error: "Dynamo template delete error", errorMsg: error });
  }
}

export const createEmailTemplate = async (data, crby = "", cmpby = {}, online_agent = false, sales_agent = false, isObjParam = false) => {

  console.log(`cmpby: ${JSON.stringify(cmpby)}`);

  let retVal;
  if (isObjParam) {
    retVal = "";
  } else {
    retVal = validateFields("email_template", data);
  }
  if (retVal === "") {
    console.log(`params: ${JSON.stringify(data)}`);
    try {
      const createEmailTemplateResponse = await pinpoint
        .createEmailTemplate(data)
        .promise();
      console.log(
        `createEmailTemplateResponse: ${JSON.stringify(
          createEmailTemplateResponse
        )}`
      );
      const dynamoParams = {
        hbId: data.EmailTemplateRequest.tags.hbid,
        templateData: {
          name: data.TemplateName,
          arn: createEmailTemplateResponse.CreateTemplateMessageBody.Arn,
          type: data.EmailTemplateRequest.tags.type,
          appname: data.EmailTemplateRequest.tags.app,
          isactive: data.EmailTemplateRequest.tags.isActive
        },
        type: `email`,
        isBatchMode: false,
        crby,
        cmpby,
        oldst: online_agent,
        newst: sales_agent
      }

      console.log(`Dynamo Params : ${JSON.stringify(dynamoParams)}`);
      await createTemplateDynamoEntry({ ...dynamoParams });

      if (isObjParam) {
        return createEmailTemplateResponse;
      }

      return success({ status: true, createEmailTemplateResponse });
    } catch (e) {
      console.log(`createEmailTemplateResponse: ${JSON.stringify(e)}`);
      if (isObjParam) {
        return e;
      }

      return badRequest({ status: false, error: e });
    }
  } else {
    return failure({ status: false, error: "Validation Failed", retVal });
  }
};
export const updateEmailTemplate = async (data, isObjParam = false, arn = '', isActive = 'true', templateId, type = 'campaign', online_agent = false, sales_agent = false) => {
  console.log(`params: ${JSON.stringify(data)}`);
  console.log(`params isActive: ${JSON.stringify(isActive)}`);
  console.log(`params type: ${JSON.stringify(type)}`);
  try {
    const updateEmailTemplateResponse = await pinpoint
      .updateEmailTemplate(data)
      .promise();
    console.log(
      `updateEmailTemplateResponse: ${JSON.stringify(
        updateEmailTemplateResponse
      )}`
    );
    const hbId = data.TemplateName.split("_")[0];
    if (isObjParam) {
      return updateEmailTemplateResponse;
    }

    // updating the email template tags
    if (arn) {
      const updateTagParams = {
        ResourceArn: arn,
        TagsModel: {
          tags: {
            isActive,
            type,
          },
        },
      };
      const tagUpdateRes = await pinpoint
        .tagResource(updateTagParams)
        .promise();
      console.log(`tagUpdateRes: ${JSON.stringify(tagUpdateRes)}`);
      const updateResp = await updateTemplateDynamoEntry(templateId, hbId, 'email', isActive, type, online_agent, sales_agent);
      if (updateResp.statusCode === 500) {
        return badRequest({ status: false, error: JSON.parse(updateResp.body).error })
      }
    }

    return success({ status: true, updateEmailTemplateResponse });
  } catch (e) {
    console.log(`updateEmailTemplateResponse: ${JSON.stringify(e)}`);
    if (isObjParam) {
      return e;
    }

    return badRequest({ status: false, error: e });
  }
};

export const deleteEmailTemplate = async (data, templateId, isJSONOnly = false) => {
  console.log(`params: ${JSON.stringify(data)}`);
  const hbid = data.TemplateName.split("_")[0];
  const dynamoParams = {
    entity: `template#${hbid}#email`,
    id: templateId
  }
  console.log(`Dynamo Params :: ${JSON.stringify(dynamoParams)}`);
  try {
    const deleteEmailTemplateResponse = await pinpoint
      .deleteEmailTemplate(data)
      .promise();
    console.log(
      `deleteEmailTemplateResponse: ${JSON.stringify(
        deleteEmailTemplateResponse
      )}`
    );
    const dynamoDelResp = await deleteTemplateDynamoEntry(dynamoParams);
    console.log(`Dynamo template delete response : ${JSON.stringify(dynamoDelResp)}`);
    if (isJSONOnly) {
      return deleteEmailTemplateResponse;
    }

    return success({ status: true, deleteEmailTemplateResponse });
  } catch (e) {
    console.log(`deleteEmailTemplateResponse: ${JSON.stringify(e)}`);
    if (isJSONOnly) {
      return e;
    }

    return badRequest({ status: false, error: e });
  }
};

// export const listTemplate = async (data, isJSONOnly = false) => {
//   console.log(`params: ${JSON.stringify(data)}`);
//   const desc = (a, b, orderBy) => {
//     if (b[orderBy] < a[orderBy]) {
//       return -1;
//     }
//     if (b[orderBy] > a[orderBy]) {
//       return 1;
//     }
//     return 0;
//   };
//   const getSorting = (order, orderBy) => (order === 'desc' ? (a, b) => desc(a, b, orderBy) : (a, b) => -desc(a, b, orderBy));
//   const stableSort = (array, cmp) => {
//     const stabilizedThis = array.map((el, index) => [el, index]);
//     stabilizedThis.sort((a, b) => {
//       const order = cmp(a[0], b[0]);
//       if (order !== 0) {
//         return order;
//       }
//       return a[1] - b[1];
//     });
//     return stabilizedThis.map(el => el[0]);
//   };
//   try {
//     const { stageOnly = false } = data;
//     const listTemplateResponse = await pinpoint
//       .listTemplates(data.payload)
//       .promise();
//     console.log(
//       `listTemplateResponse: ${JSON.stringify(listTemplateResponse)}`
//     );
// let filteredData = listTemplateResponse.TemplatesResponse.Item.filter(
//   (item) => item.TemplateName.startsWith(data.hbid)
// );
//     const templateCount = filteredData.length;

//     if (data.sort.length) {
//       filteredData = filteredData.map(item => ({
//         ...item,
//         name: item.TemplateName.substring(item.TemplateName.indexOf('_') + 1, item.TemplateName.length),
//         cdt: moment(item.CreationDate).valueOf(),
//         mdt: moment(item.LastModifiedDate).valueOf()
//       }))
//       filteredData = stableSort(filteredData, getSorting(data.sort[0].order, data.sort[0].field));
//     }
//     if (filteredData && filteredData.length) {
//       if (Object.prototype.hasOwnProperty.call(data, 'from')) {
//         filteredData = filteredData.slice(data.from, data.from + data.size);
//       }
//       const tempFilteredData = JSON.parse(JSON.stringify(filteredData));
//       for (const [i, ele] of tempFilteredData.entries()) {
//         try {
//           console.log(`ele: ${JSON.stringify(ele)}`);
//           const getEmailTemplateResponse = await pinpoint
//             .getEmailTemplate({ TemplateName: ele.TemplateName })
//             .promise();
//           console.log(
//             `getEmailTemplateResponse: ${JSON.stringify(
//               getEmailTemplateResponse
//             )}`
//           );
//           filteredData[i] = {
//             ...ele,
//             templateArn:
//               getEmailTemplateResponse &&
//                 getEmailTemplateResponse.EmailTemplateResponse &&
//                 getEmailTemplateResponse.EmailTemplateResponse.Arn
//                 ? getEmailTemplateResponse.EmailTemplateResponse.Arn
//                 : "",
//             tags:
//               getEmailTemplateResponse &&
//                 getEmailTemplateResponse.EmailTemplateResponse &&
//                 getEmailTemplateResponse.EmailTemplateResponse.tags
//                 ? getEmailTemplateResponse.EmailTemplateResponse.tags
//                 : {},
//           };
//         } catch (error) {
//           console.log(`ele execption: ${JSON.stringify(ele)}`);
//           console.log(error);
//         }
//       }
//     }

//     if (stageOnly) {
//       console.log("inside stageOnly");
//       filteredData = filteredData.filter(
//         (item) => item?.tags?.type === "stage"
//       );
//       console.log("after filter", `${JSON.stringify(filteredData)}`);
//     }

//     if (isJSONOnly) {
//       return { status: true, data: filteredData, count: templateCount };
//     }

//     return success({ status: true, data: filteredData, count: templateCount });
//   } catch (e) {
//     if (isJSONOnly) {
//       return { status: false, error: e.stack };
//     }

//     return failure({ status: false, error: e.stack });
//   }
// };

export const listTemplate = async (data) => {
  try {
    const { from = 0, size = 5, after = [], sort = [], searchKey = "", stageOnly = false, crby = null } = data;
    const listTemplateQuery = {
      httpMethod: "POST",
      requestPath: `/_search`,
      payload: {
        query: {
          bool: {
            must: [
              {
                term: { "hbid.keyword": `${data.hbid}` }
              },
              {
                match_phrase_prefix: {
                  entity: `template#${data.hbid}`
                }
              },
              {
                term: { "utype.keyword": `${data.utype ?? "email"}` }
              }
            ]
          }
        },
        size,
        from
      }
    }

    if (crby) {
      const should = [
        {
          match: {
            "crby.keyword": crby
          }
        }
      ];
      if (data.crby_utype === 'agent') {
        should.push({
          match: {
            "newst.keyword": "true"
          }
        });
      }
      if (data.crby_utype === 'online_agent') {
        should.push({
          match: {
            "oldst.keyword": "true"
          }
        });
      }
      listTemplateQuery.payload.query.bool.must.push({
        bool: { should }
      });
    }


    if (searchKey) {
      listTemplateQuery.payload.query.bool.must.push({
        match_phrase_prefix: {
          "fname.keyword": searchKey
        }
      })
    }

    if (stageOnly) {
      listTemplateQuery.payload.query.bool.must.push({
        term: { "type.keyword": "stage" }
      })
    }

    if (from + size > 1000 && after.length) {
      listTemplateQuery.payload.search_after = after;
      listTemplateQuery.payload.from = 0;
    }

    listTemplateQuery.payload.sort = [];
    if (sort.length) {
      sort.forEach(sortField => {
        listTemplateQuery.payload.sort.push({
          [`${sortField.field}${sortField.field !== "cdt" && sortField.field !== "mdt"
            ? ".keyword"
            : ""}`]: sortField.order
        })
      });
    } else {
      listTemplateQuery.payload.sort = [];
      listTemplateQuery.payload.sort.push({
        "fname.keyword": "asc"
      })
    }
    // tie breaker for sorting
    listTemplateQuery.payload.sort.push({
      "id.keyword": "asc",
    });

    console.log(`listTemplateQuery : ${JSON.stringify(listTemplateQuery)}`);
    const templatesList = await elasticExecuteQuery(listTemplateQuery, true);
    console.log(`templatesList : ${JSON.stringify(templatesList)}`);

    if (templatesList &&
      templatesList.statusCode === 200 &&
      templatesList.body &&
      templatesList.body.hits &&
      templatesList.body.hits.hits &&
      templatesList.body.hits.hits.length
    ) {
      const { hits } = templatesList.body.hits;
      const resultLength = hits.length;
      const totalResults = templatesList.body.hits.total;

      console.log(`resultLength: ${resultLength}`);
      console.log(`totalResults: ${totalResults}`);

      const templatePage = {
        after: resultLength ? [...hits[resultLength - 1].sort] : [],
        hasAfter: from + size < totalResults,
        totalResults
      }
      console.log(`templatePage : ${JSON.stringify(templatePage)}`);

      const templates = resultLength ? hits.map(template => {
        const templateObj = { ...template._source, _score: template._score };
        return templateObj;
      }) : []

      return success({ status: true, result: [...templates], ...templatePage })
    }

    return success({ status: true, result: [] })
  } catch (error) {
    console.log(`Error : ${JSON.stringify(error)}`);
    return failure({ status: false, error })
  }
}

//  SES Email //

export const sendSesEmail = async (data, isJSONOnly = false) => {
  console.log(`params: ${JSON.stringify(data)}`);
  let response = {};
  try {
    const {
      toAddr = [],
      fromAddr,
      templateName = "",
      templateArn = "",
      templateData = "",
    } = data;
    if (
      toAddr &&
      toAddr.length &&
      fromAddr &&
      templateName &&
      templateArn &&
      templateData
    ) {
      const params = {
        Destination: {
          ToAddresses: [],
        },
        Source: fromAddr,
        Template: templateName,
        TemplateArn: templateArn,
        TemplateData: JSON.stringify(templateData),
      };

      const perChunk = 45; // items per chunk

      const chunkArr = toAddr.reduce((resultArray, item, index) => {
        const chunkIndex = Math.floor(index / perChunk);

        if (!resultArray[chunkIndex]) {
          resultArray[chunkIndex] = []; // start a new chunk
        }

        resultArray[chunkIndex].push(item);

        return resultArray;
      }, []);

      let respArr = [];

      for (const item of chunkArr) {
        params.Destination.ToAddresses = item;
        const sendSesEmailResponse = await ses
          .sendTemplatedEmail(params)
          .promise();
        console.log(
          `sendSesEmailResponse: ${JSON.stringify(sendSesEmailResponse)}`
        );
        respArr = [...respArr, ...sendSesEmailResponse];
      }

      response = { status: true, data: respArr };
    }
    response = { status: false, error: "Validation failed" };
  } catch (e) {
    console.log(`e: ${JSON.stringify(e)}`);
    response = { status: false, error: e };
  }
  if (isJSONOnly) return response;
  if (!response.status) {
    return failure(response);
  }
  return success(response);
};

export const sendSesBulkEmail = async (data) => {
  const sendSesBulkEmailResp = await ses.sendBulkTemplatedEmail(data).promise();
  console.log(`sendSesBulkEmailResp: ${JSON.stringify(sendSesBulkEmailResp)}`);
  return sendSesBulkEmailResp;
};

/* export const migrateData = async (data) => {
    try {

        let listData = [];

        const recursiveListCall = async (data) => {
            const listTemplatesRes = await pinpoint.listTemplates(data).promise();
            console.log(`listTemplatesRes: ${JSON.stringify(listTemplatesRes)}`);
            if (listTemplatesRes && listTemplatesRes.TemplatesResponse && listTemplatesRes.TemplatesResponse.Item && listTemplatesRes.TemplatesResponse.Item.length > 0) {
                console.log(`recursiveListCall item: ${JSON.stringify(listTemplatesRes.TemplatesResponse.Item)}`);
                console.log(`recursiveListCall item length: ${JSON.stringify(listTemplatesRes.TemplatesResponse.Item.length)}`);
                listData = [...listData, ...listTemplatesRes.TemplatesResponse.Item];
            }
            if (listTemplatesRes && listTemplatesRes.TemplatesResponse && listTemplatesRes.TemplatesResponse.NextToken && listTemplatesRes.TemplatesResponse.NextToken.length > 0) {
                const res2 = await recursiveListCall({ ...data, NextToken: listTemplatesRes.TemplatesResponse.NextToken });
            }
            console.log(`return listTemplatesRes: ${JSON.stringify(listTemplatesRes)}`);
            return listTemplatesRes;
        };

        const res = await recursiveListCall(data);

        console.log(`listData: ${JSON.stringify(listData)}`);

        console.log(`listData length: ${JSON.stringify(listData.length)}`);

        const batchParams = {
            RequestItems: {
                [process.env.entitiesTableName]: []
            }
        }

        listData.forEach((ele, i) => {
            const hbId = ele.TemplateName.substring(ele.TemplateName.indexOf('_') + 1, ele.TemplateName.length) ? ele.TemplateName.substring(0, ele.TemplateName.indexOf('_')) : '';
            const templateName = ele.TemplateName.substring(ele.TemplateName.indexOf('_') + 1, ele.TemplateName.length) ? ele.TemplateName.substring(ele.TemplateName.indexOf('_') + 1, ele.TemplateName.length) : '';
            if (hbId && hbId.length > 0 && templateName && templateName.length > 0) {
                const listCreateItem = {
                    type: 'email_template',
                    hb_id: hbId,
                    name: ele.TemplateName,
                    name_split: templateName,
                    mdt: Date.now(),
                    cdt: Date.now(),
                    id: uuidv4(),
                    entity: `email_template#${hbId}`
                };
                batchParams.RequestItems[process.env.entitiesTableName].push({
                    PutRequest: {
                        Item: listCreateItem
                    }
                });
            }
        });

        console.log(`batchParams: ${JSON.stringify(batchParams, null, 4)}`)

        console.log(`batchParams RequestItems Length: ${JSON.stringify(batchParams.RequestItems[process.env.entitiesTableName].length)}`)

        return success({ status: true, data: { length: listData.length, batchLength: batchParams.RequestItems[process.env.entitiesTableName].length } });
    }
    catch (e) {
        console.log(`migrateData exception`);
        console.log(e);
        console.log(`migrateData exception`);
        return failure({ status: false, error: e.stack });
    }
} */

const getJourneyMetrics = async (data) => {
  const journeyId = data.jid ? data.jid : "";
  const kpiNames = data.kpi ? data.kpi : [];
  const startTime = data.st ? data.st : "";
  const endTime = data.et ? data.et : "";
  const pageSize = data.ps ? data.ps : "";
  const appid = data.appid ? data.appid.trim() : "";
  const nextToken = data.nt ? data.nt.trim() : "";

  const kpiNamePromiseArr = [];

  for (const kpiName of kpiNames) {
    const params = {
      ApplicationId: appid,
      JourneyId: journeyId,
      KpiName: kpiName,
    };
    if (endTime) {
      params.EndTime = endTime;
    }
    if (startTime) {
      params.StartTime = startTime;
    }
    if (nextToken) {
      params.NextToken = nextToken;
    }
    if (pageSize) {
      params.PageSize = pageSize;
    }
    console.log(`params: ${JSON.stringify(params)}`);
    kpiNamePromiseArr.push(pinpoint.getJourneyDateRangeKpi(params).promise());
  }
  try {
    const journeyKPIResponse = await Promise.all(kpiNamePromiseArr);
    console.log(`journeyKPIResponse: ${JSON.stringify(journeyKPIResponse)}`);
    return success({ status: true, data: journeyKPIResponse });
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
    return failure({ status: false, error: e.stack });
  }
};
const getJourneyExecMetrics = async (data) => {
  const journeyId = data.jid ? data.jid : "";
  const appid = data.appid ? data.appid.trim() : "";
  const params = {
    ApplicationId: appid,
    JourneyId: journeyId,
  };
  console.log(`params: ${JSON.stringify(params)}`);
  try {
    const journeyExecMetrics = await pinpoint
      .getJourneyExecutionMetrics(params)
      .promise();
    console.log(`journeyExecMetrics: ${JSON.stringify(journeyExecMetrics)}`);
    return success({ status: true, data: journeyExecMetrics });
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
    return failure({ status: false, error: e.stack });
  }
};
const getJourneyActMetrics = async (data) => {
  const journeyId = data.jid ? data.jid : "";
  const pageSize = data.ps ? data.ps : "";
  const appid = data.appid ? data.appid.trim() : "";
  const nextToken = data.nt ? data.nt.trim() : "";
  const journeyActivityId = data.jaid ? data.jaid : "";
  const params = {
    ApplicationId: appid,
    JourneyId: journeyId,
    JourneyActivityId: journeyActivityId,
  };
  if (nextToken) {
    params.NextToken = nextToken;
  }
  if (pageSize) {
    params.PageSize = pageSize;
  }
  console.log(`params: ${JSON.stringify(params)}`);
  try {
    const journeyActMetrics = await pinpoint
      .getJourneyExecutionActivityMetrics(params)
      .promise();
    console.log(`journeyActMetrics: ${JSON.stringify(journeyActMetrics)}`);
    return success({ status: true, data: journeyActMetrics });
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
    return failure({ status: false, error: e.stack });
  }
};
export const deleteCampaign = async (data, isJSONOnly = false) => {
  const appid = data.appid ? data.appid.trim() : "";
  const campid = data.campid ? data.campid : "";
  const params = {
    ApplicationId: appid /* required */,
    CampaignId: campid /* required */,
  };
  console.log(`params: ${JSON.stringify(params)}`);
  try {
    const deleteCampaignResp = await pinpoint.deleteCampaign(params).promise();
    console.log(`deleteCampaignResp: ${JSON.stringify(deleteCampaignResp)}`);
    if (isJSONOnly) {
      return deleteCampaignResp;
    }

    return success({ status: true, data: deleteCampaignResp });
  } catch (e) {
    console.log(`e: ${JSON.stringify(e)}`);
    if (isJSONOnly) {
      return e;
    }

    return failure({ status: false, error: e });
  }
};
export const updateJourney = async (data, isImport = false) => {
  console.log(`params: ${JSON.stringify(data)}`);
  const {
    ApplicationId,
    JourneyId: journeyId,
    WriteJourneyRequest: { Activities = {} } = null,
  } = data;
  let taskActivityParams = null;
  try {
    // Loop through Activities object and convert the "EMAIL" activities to CUSTOM channel
    taskActivityParams = await processCustomJourneyActivities({
      Activities,
      ApplicationId,
    });

    const updateJourneyResp = await pinpoint.updateJourney(data).promise();
    console.log(`updateJourneyResp: ${JSON.stringify(updateJourneyResp)}`);

    // Add the journeyId to the taskActivityParams and create task content resource
    for await (const taskActivityParam of taskActivityParams) {
      const taskNoteContentResp = await saveJourneyTaskRes({
        taskActivityParam,
        journeyId,
        ApplicationId,
      });
      console.log(
        `taskNoteContentResp: ${JSON.stringify(taskNoteContentResp)}`
      );
    }

    if (isImport) {
      return updateJourneyResp;
    }

    return success({ status: true, data: updateJourneyResp });
  } catch (e) {
    console.log(`updateJourneyResp: ${JSON.stringify(e)}`);
    if (isImport) {
      return e;
    }

    return badRequest({ status: false, error: e });
  }
};
const updateJourneyState = async (data) => {
  const appid = data.appid ? data.appid.trim() : "";
  const jid = data.jid ? data.jid : "";
  const state = data.state ? data.state : "";
  const params = {
    ApplicationId: appid /* required */,
    JourneyId: jid /* required */,
    JourneyStateRequest: {
      /* required */ State: state,
    },
  };
  console.log(`params: ${JSON.stringify(params)}`);
  try {
    const updateJourneyStateResp = await pinpoint
      .updateJourneyState(params)
      .promise();
    console.log(
      `updateJourneyStateResp: ${JSON.stringify(updateJourneyStateResp)}`
    );
    return success({ status: true, data: updateJourneyStateResp });
  } catch (e) {
    console.log(`e: ${JSON.stringify(e)}`);
    return failure({ status: false, error: e });
  }
};
export const getJourney = async (data, isFromFirehose) => {
  const appid = data.appid ? data.appid.trim() : "";
  const jid = data.jid ? data.jid : "";
  const params = {
    ApplicationId: appid /* required */,
    JourneyId: jid,
  };
  console.log(`params: ${JSON.stringify(params)}`);
  try {
    const getJourneyResp = await pinpoint.getJourney(params).promise();
    console.log(`getJourneyResp: ${JSON.stringify(getJourneyResp)}`);
    if (isFromFirehose) {
      return getJourneyResp;
    }

    return success({ status: true, data: getJourneyResp });
  } catch (e) {
    console.log(`e: ${JSON.stringify(e)}`);
    return failure({ status: false, error: e });
  }
};
export const sendEmail = async (data) => {
  console.log(`params: ${JSON.stringify(data)}`);
  try {
    const sendEmailResponse = await pinpoint.sendMessages(data).promise();
    console.log(`sendEmailResponse: ${JSON.stringify(sendEmailResponse)}`);
    return success({ status: true, data: sendEmailResponse });
  } catch (e) {
    console.log(`e: ${JSON.stringify(e)}`);
    return failure({ status: false, error: e });
  }
};
export const sendEmailNew = async (data) => {
  console.log(`params: ${JSON.stringify(data)}`);
  try {
    const pinpointEmail = new PinpointEmail();
    const response = await pinpointEmail.sendEmail(data).promise();
    console.log(`Email Response : ${JSON.stringify(response)}`);
    return success({ status: true, data: response });
  } catch (e) {
    console.log(`e: ${JSON.stringify(e)}`);
    return failure({ status: false, error: e });
  }
}
export const sendMessagesRaw = async (data) => {
  console.log(`params: ${JSON.stringify(data)}`);
  try {
    const sendMessagesRawRes = await pinpoint.sendMessages(data).promise();
    console.log(`sendMessagesRawRes: ${JSON.stringify(sendMessagesRawRes)}`);
    return sendMessagesRawRes;
  } catch (e) {
    return e;
  }
};

export const pinpointEmailSendEmail = async (data) => {
  console.log(`params: ${JSON.stringify(data)}`);
  try {
    const pinpointEmailSendEmailRes = await pinpointemail
      .sendEmail(data)
      .promise();
    console.log(
      `pinpointEmailSendEmailRes: ${JSON.stringify(pinpointEmailSendEmailRes)}`
    );
    return success({ status: true, data: pinpointEmailSendEmailRes });
  } catch (e) {
    console.log(`e: ${JSON.stringify(e)}`);
    return failure({ status: false, error: e });
  }
};

export const sendEmailRaw = async (data) => {
  console.log(`params: ${JSON.stringify(data)}`);
  try {
    const sendEmailRawRes = await pinpointemail.sendEmail(data).promise();
    console.log(`sendEmailRawRes: ${JSON.stringify(sendEmailRawRes)}`);
    return sendEmailRawRes;
  } catch (e) {
    return e;
  }
};

export const optCampaign = async (payload) => {
  console.log(`optEndpointResp: ${JSON.stringify(payload)}`);
  const optEndpointResp = await optEndpoint(
    payload.data,
    payload.opt
    // payload.bopt
  );
  return optEndpointResp;
};

export const removeAttributeFromEndpoint = (appid, attrType) => {
  try {
    const params = {
      ApplicationId: appid,
      AttributeType: "endpoint-user-attributes",
      UpdateAttributesRequest: {
        /* required */ Blacklist: [attrType],
      },
    };
    console.log(
      `removeAttributeFromEndpoint params: ${JSON.stringify(params)}`
    );
    pinpoint.removeAttributes(params, (err, data) => {
      if (err) {
        console.log(`removeAttributes Error: ${JSON.stringify(err)}`);
      } // an error occurred
      else {
        console.log(`removeAttributes Success: ${JSON.stringify(data)}`);
      } // successful response
    });
  } catch (error) {
    console.log(
      `removeAttributeFromEndpoint Exection: ${JSON.stringify(error)}`
    );
  }
};

export const updateSegmentRule = async (demoGId, appid) => {
  console.log(`demoGId: ${demoGId}`);
  console.log(`appid: ${appid}`);
  const segmentList = await listSegments({ appid }, true, true);
  const updateSegmentRuleResp = {};
  console.log(`segmentList: ${JSON.stringify(segmentList)}`);
  if (
    segmentList &&
    segmentList.SegmentsResponse &&
    segmentList.SegmentsResponse.Item &&
    segmentList.SegmentsResponse.Item.length
  ) {
    // Segment List Exists
    // Filter out the segments that has the deleted question as a rule
    const matchedSegments = segmentList.SegmentsResponse.Item.filter((item) => {
      let matchFound = false;
      if (
        item.SegmentGroups &&
        item.SegmentGroups.Groups &&
        item.SegmentGroups.Groups.length &&
        item.SegmentGroups.Groups[0].Dimensions &&
        item.SegmentGroups.Groups[0].Dimensions.length
      ) {
        item.SegmentGroups.Groups[0].Dimensions =
          item.SegmentGroups.Groups[0].Dimensions.map((dimension) => {
            if (dimension.UserAttributes[demoGId]) {
              matchFound = true;
              delete dimension.UserAttributes[demoGId];
            }
            return dimension;
          });
      }
      return matchFound;
    });
    // Update the filtered segments
    const updateSegmentResp = [];
    console.log(`matchedSegments: ${JSON.stringify(matchedSegments)}`);
    for (const segment of matchedSegments) {
      const segmentObj = {
        ApplicationId: segment.ApplicationId /* required */,
        SegmentId: segment.Id,
        WriteSegmentRequest: {
          /* required */ SegmentGroups: segment.SegmentGroups,
          Name: segment.Name,
          tags: {
            Application: ApplicationTag,
            Environment: EnvironmentTag,
            Owner: OwnerTag,
            Purpose: PurposeTag,
            Service: "pinpoint",
          },
        },
      };
      const resp = await updateSegment({}, true, segmentObj);
      console.log(`resp: ${JSON.stringify(resp)}`);
      updateSegmentResp.push(resp);
    }
    updateSegmentRuleResp.status = true;
    updateSegmentRuleResp.data = updateSegmentResp;
  } else {
    updateSegmentRuleResp.status = true;
    updateSegmentRuleResp.msg = `No segments to update.`;
  }
  return updateSegmentRuleResp;
};
export const removeQuestions = async (data) => {
  console.log(`AWS.VERSION: ${AWS.VERSION}`);
  console.log(`params: ${JSON.stringify(data)}`);
  const params = {
    ApplicationId: data.appid /* required */,
    AttributeType: "endpoint-user-attributes" /* required */,
    UpdateAttributesRequest: {
      /* required */ Blacklist: data.qstns,
    },
  };
  try {
    const removeAttributesResp = await pinpoint
      .removeAttributes(params)
      .promise();
    console.log(
      `removeAttributesResp: ${JSON.stringify(removeAttributesResp)}`
    );
    return success({ status: true, data: removeAttributesResp });
  } catch (e) {
    console.log(`e: ${JSON.stringify(e)}`);
    return failure({ status: false, error: e });
  }
};
export const sesVerifyTemplateGet = async () => {
  const SesVerificationTemplate = "CRM_VERIFICATION_TEMPLATE";
  try {
    const getTemplateResp = await ses
      .getCustomVerificationEmailTemplate({
        TemplateName: SesVerificationTemplate,
      })
      .promise();
    console.log(`getTemplateResp: ${JSON.stringify(getTemplateResp)}`);
    return success({ status: true, getTemplateResp });
  } catch (error) {
    console.log(`sesVerifyTemplateGet error: ${JSON.stringify(error)}`);
    if (
      error &&
      error.code &&
      error.code === "CustomVerificationEmailTemplateDoesNotExist"
    ) {
      return success({ status: true, getTemplateResp: {} });
    }
    return failure({ status: false, error, getTemplateResp: {} });
  }
};
export const sesVerifyTemplateCreate = async (sesVerifyTemplateParams) => {
  try {
    // TODO Find img src links and convert it to base64. Find the code below
    /* var request = require("request").defaults({ encoding: null });

    request.get(
      "http://tinypng.org/images/example-shrunk-8cadd4c7.png",
      function (error, response, body) {
        if (!error && response.statusCode == 200) {
          data =
            "data:" +
            response.headers["content-type"] +
            ";base64," +
            Buffer.from(body).toString("base64");
          console.log(data);
        }
      }
    ); */
    let createCustomVerificationEmailTemplateResp = "";
    let sesVerifyTemplateGetResp = await sesVerifyTemplateGet();

    if (sesVerifyTemplateGetResp && sesVerifyTemplateGetResp.body) {
      sesVerifyTemplateGetResp = JSON.parse(sesVerifyTemplateGetResp.body);
    }

    console.log(
      `sesVerifyTemplateGetResp: ${JSON.stringify(sesVerifyTemplateGetResp)}`
    );

    if (
      sesVerifyTemplateGetResp &&
      sesVerifyTemplateGetResp.getTemplateResp &&
      sesVerifyTemplateGetResp.getTemplateResp.TemplateName
    ) {
      createCustomVerificationEmailTemplateResp = await ses
        .updateCustomVerificationEmailTemplate(sesVerifyTemplateParams)
        .promise();
      console.log(
        `updateCustomVerificationEmailTemplate: ${JSON.stringify(
          createCustomVerificationEmailTemplateResp
        )}`
      );
    } else {
      createCustomVerificationEmailTemplateResp = await ses
        .createCustomVerificationEmailTemplate(sesVerifyTemplateParams)
        .promise();
      console.log(
        `createCustomVerificationEmailTemplateResp: ${JSON.stringify(
          createCustomVerificationEmailTemplateResp
        )}`
      );
    }

    return success({
      status: true,
      resp: createCustomVerificationEmailTemplateResp,
    });
  } catch (error) {
    console.log(`error: ${JSON.stringify(error)}`);
    if (error && error.code) {
      switch (error.code) {
        case "CustomVerificationEmailInvalidContent":
        case "CustomVerificationEmailTemplateAlreadyExists":
        case "FromEmailAddressNotVerified":
        case "LimitExceeded":
        case "CustomVerificationEmailTemplateDoesNotExist":
          return success({ status: false, error });
        default:
          break;
      }
    }
    return failure({ status: false, error });
  }
};
export const cognitoTemplateGet = async (data) => {
  console.log(`cognitoTemplateGet data: ${JSON.stringify(data)}`);
  const { isJSONOnly = false } = data || {};
  let getFunction;
  let cognitoTemplateGetResp = "";
  const cognitoTemplateGetParams = {
    TableName: process.env.entitiesTableName,
    KeyConditionExpression: "#id = :id and #entity = :entity",
    ExpressionAttributeNames: {
      "#id": "id",
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":id": "cognito",
      ":entity": "cognito_template",
    },
  };
  console.log(
    `cognitoTemplateGet cognitoTemplateGetParams: ${JSON.stringify(
      cognitoTemplateGetParams
    )}`
  );
  if (isJSONOnly) getFunction = getResourceJSON;
  else getFunction = getResources;
  cognitoTemplateGetResp = await getFunction(cognitoTemplateGetParams);
  console.log(
    `cognitoTemplateGetResp: ${JSON.stringify(cognitoTemplateGetResp)}`
  );
  return cognitoTemplateGetResp;
};
export const cognitoTemplateCreate = async (data) => {
  try {
    console.log(`cognitoTemplateCreate data: ${JSON.stringify(data)}`);
    const { subject, content } = data;
    let createUpdateResp = "";
    if (subject && content) {
      const cognitoTemplateGetResp = await cognitoTemplateGet();
      console.log(
        `cognitoTemplateCreate cognitoTemplateGetResp: ${JSON.stringify(
          cognitoTemplateGetResp
        )}`
      );
      let cognitoTemplateGetRespParsed = "";
      if (cognitoTemplateGetResp && cognitoTemplateGetResp.body) {
        cognitoTemplateGetRespParsed = JSON.parse(cognitoTemplateGetResp.body);
      }
      console.log(
        `cognitoTemplateCreate cognitoTemplateGetRespParsed: ${JSON.stringify(
          cognitoTemplateGetRespParsed
        )}`
      );
      let createUpdateParams = "";
      if (
        cognitoTemplateGetResp.statusCode === 200 &&
        cognitoTemplateGetRespParsed &&
        cognitoTemplateGetRespParsed.length &&
        cognitoTemplateGetRespParsed[0].id
      ) {
        createUpdateParams = {
          TableName: process.env.entitiesTableName,
          Item: {
            id: "cognito",
            type: "template",
            entity: "cognito_template",
            mdt: Date.now(),
            cdt: cognitoTemplateGetRespParsed[0].cdt,
            subject,
            content,
          },
        };
      }
      if (
        cognitoTemplateGetResp.statusCode === 200 &&
        cognitoTemplateGetRespParsed &&
        cognitoTemplateGetRespParsed.length === 0
      ) {
        createUpdateParams = {
          TableName: process.env.entitiesTableName,
          Item: {
            id: "cognito",
            type: "template",
            entity: "cognito_template",
            mdt: Date.now(),
            cdt: Date.now(),
            subject,
            content,
          },
        };
      }
      if (createUpdateParams) {
        console.log(
          `cognitoTemplateCreate createUpdateParams: ${JSON.stringify(
            createUpdateParams
          )}`
        );
        createUpdateResp = await postResources(createUpdateParams);
        console.log(
          `cognitoTemplateCreate createUpdateResp: ${JSON.stringify(
            createUpdateResp
          )}`
        );
        return createUpdateResp;
      }
      return failure({
        status: false,
        error: {
          message: "Error on Creating/Updating",
        },
      });
    }
    return success({
      status: false,
      error: {
        message: "Subject and Content Required",
      },
    });
  } catch (error) {
    return failure({ status: false, error });
  }
};
export const getApplication = async (data, isJSONOnly = false) => {
  const { appid: ApplicationId } = data;
  if (ApplicationId) {
    const params = {
      ApplicationId /* required */,
    };
    try {
      const getAppResp = await pinpoint.getApp(params).promise();
      console.log(`getAppResp: ${JSON.stringify(getAppResp)}`);
      if (isJSONOnly) {
        return { status: true, data: getAppResp };
      }

      return success({ status: true, data: getAppResp });
    } catch (error) {
      console.log(`error`);
      console.log(error);
      if (isJSONOnly) {
        return { status: false, error };
      }

      return failure({ status: false, error });
    }
  } else {
    if (isJSONOnly) {
      return { status: false, error: `Provide a valid application id` };
    }

    return badRequest({
      status: false,
      error: `Provide a valid application id`,
    });
  }
};

export const detailedMetrics = async (data) => {
  try {
    const { appid = "", typeId = "", type = "", size = 10, after = "", hbId = "" } = data;

    if (!appid || !typeId || !type || !hbId)
      throw new Error("AppId, type, TypeId and hbId is Required Fields. Missing one of these data");

    if (type.toLowerCase() !== "campaign" && type.toLowerCase() !== "journey")
      throw new Error("Invalid Type. Type should be campign or journey")

    const elasticParam = {
      customQuery: [],
      aggregation: {}
    };

    if (type === 'campaign') {
      elasticParam.aggregation = {
        "email_pagination": {
          "composite": {
            "size": size,
            "sources": [
              {
                "email": {
                  "terms": {
                    "field": "facets.email_channel.mail_event.mail.destination.keyword"
                  }
                }
              }
            ]
          },
          "aggs": {
            "event_types": {
              "terms": {
                "field": "event_type.keyword"
              }
            }
          }
        },
        "total_count": {
          "cardinality": {
            "field": "facets.email_channel.mail_event.mail.destination.keyword"
          }
        }
      }
    };

    if (after) {
      elasticParam.aggregation.email_pagination.composite.after = {
        "email": after
      };
    };

    elasticParam.customQuery = [
      {
        "nested": {
          "path": "application",
          "query": {
            "match": {
              "application.app_id.keyword": appid
            }
          }
        }
      },
      {
        "nested": {
          "path": "attributes",
          "query": {
            "match": {
              [`attributes.${type.toLowerCase()}_id.keyword`]: typeId
            }
          }
        }
      },
      {
        "bool": {
          "must_not": [
            {
              "match": {
                "event_type.keyword": "_campaign.send"
              }
            }
          ]
        }
      }
    ]

    console.log(`elasticParam: ${JSON.stringify(elasticParam)}`);

    const elasticResult = await doAggregateElasticQuery(elasticParam);
    console.log(`elasticResult: ${JSON.stringify(elasticResult)}`);

    if (!elasticResult.status) throw elasticResult?.error || "Elastic fetch failed";

    const resultData = elasticResult.data;
    console.log(`resultData: ${JSON.stringify(resultData)}`);

    const getCustomerDetails = async (email) => {
      const getCustomerParams = [
        {
          "bool": {
            "should": [
              {
                "match": {
                  "entity.keyword": `customer#${hbId}`
                }
              },
              {
                "match": {
                  "entity.keyword": `realtor#${hbId}`
                }
              },
              {
                "match_phrase_prefix": {
                  "entity.keyword": `cobuyer#${hbId}`
                }
              }
            ]
          }
        },
        {
          "match": {
            "email.keyword": email
          }
        }
      ];

      const getCustomerFromElastic = await listEntitiesElastic({
        isCustomParam: true,
        customParams: getCustomerParams,
      });

      console.log(`getCustomerFromElastic: ${JSON.stringify(getCustomerFromElastic)}`);
      return getCustomerFromElastic;
    };

    const getEachCustomerOutput = async () => {
      const outputData = await Promise.all(resultData.email_pagination.buckets.map(async (eachData) => {
        const { email } = eachData?.key || "";

        const details = await getCustomerDetails(email);
        console.log(`details: ${JSON.stringify(details)}`);

        const { id = "", fullname = "", fname = "", lname = "", type = "", data = "", rel_id = "" } = details?.result[0] || {};

        const eachOutputData = {
          id: type === "cobuyer" ? data : id,
          name: fullname || `${fname} ${lname}`,
          type,
          email,
          ad: "Yes",
          sd: "No",
          success: "No",
          bounced: "No",
          opened: "No",
          clicked: "No",
          rel_id: type === "cobuyer" ? rel_id : id
        };
        eachData.event_types.buckets.forEach((eachEvents) => {
          switch (eachEvents.key) {
            case "_email.delivered":
              eachOutputData.sd = "Yes"
              break;
            case "_email.send":
              eachOutputData.success = "Yes"
              break;
            case "_email.softbounce":
            case "_email.hardbounce":
              eachOutputData.bounced = "Yes"
              break;
            case "_email.open":
              eachOutputData.opened = "Yes"
              break;
            case "_email.click":
              eachOutputData.clicked = "Yes"
              break;
          };
        });
        return eachOutputData;
      }));
      return outputData;
    };


    const output = {
      after: resultData?.email_pagination?.after_key?.email || "",
      total: resultData?.total_count?.value || 0,
      result: await getEachCustomerOutput()
    };

    return success({ status: true, data: output });
  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`);
    return failure({ status: false, error: error?.message || error });
  };
};


export const getBounceReason = async (data) => {
  try {
    const { appid = "", typeId = "", type = "", email = "" } = data;
    if (!appid || !typeId || !type || !email)
      throw new Error("AppId, Type, TypeId and Email is Required Fields. Missing one of these data");

    if (type.toLowerCase() !== "campaign" && type.toLowerCase() !== "journey")
      throw new Error("Invalid Type. Type should be campign or journey")


    const customQuery = [
      {
        "nested": {
          "path": "application",
          "query": {
            "match": {
              "application.app_id.keyword": appid
            }
          }
        }
      },
      {
        "nested": {
          "path": "attributes",
          "query": {
            "match": {
              [`attributes.${type.toLowerCase()}_id.keyword`]: typeId
            }
          }
        }
      },
      {
        "match": {
          "facets.email_channel.mail_event.mail.destination.keyword": email
        }
      },
      {
        "bool": {
          "should": [
            {
              "match": {
                "event_type": "_email.softbounce"
              }
            },
            {
              "match": {
                "event_type": "_email.hardbounce"
              }
            }
          ]
        }
      }
    ]

    const fetchReason = await listEntitiesElastic({
      isCustomParam: true,
      customParams: customQuery,
      eof: true
    });
    console.log(`fetchReason: ${JSON.stringify(fetchReason)}`);

    if (!fetchReason.status) throw new Error(fetchReason?.error || "Fetching from elastic search failed");
    if (!fetchReason?.result.length) {
      return success({ status: true, data: "The Given Email doesn't have any bounce history" });
    };
    const bounceReason = fetchReason?.result[0].facets?.email_channel?.mail_event?.bounce;
    console.log(`bounceReason: ${JSON.stringify(bounceReason)}`);

    return success({ status: true, data: bounceReason });

  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`);
    return failure({ status: false, error: error?.message || error });
  };
};

// function for getting email template for sending email when a leads is added
export const getEmailNotitificationParams = (data) => {
  try {
    const { leadData, toAddress, builderName, fromAddress } = data;

    if(!builderName || !toAddress || !fromAddress) throw 'Fields Builder Name, To Address and From Address is required!';

    const emailSubject = 'New Lead Notification';

    const emailHtmlBody = notificationEmailTemplate(leadData, builderName);
    const emailTextBody = notificationEmailTemplate(leadData, builderName, false);

    const params = {
      Destination: {
        ToAddresses: [toAddress]
      },
      Message: {
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: emailHtmlBody
          },
          Text: {
            Charset: 'UTF-8',
            Data: emailTextBody
          }
        },
        Subject: {
          Charset: 'UTF-8',
          Data: emailSubject
        }
      },
      Source: fromAddress
    };

    //debugger
    console.log(`Email notification params: ${JSON.stringify(params)}`);

    return { status: true, result: params };
  } catch (error) {
    return { status: false, error };
  }
};

// const createConfigurationSet = async (data) => {
//     const { name: ConfigurationSetName, rep: ReputationMetricsEnabled = false, send: SendingEnabled = true } = data;
//     if (ConfigurationSetName) {

//         const params = {
//             ConfigurationSetName, /* required */
//             DeliveryOptions: {
//                 SendingPoolName: SES_IP_POOL_NAME
//                 // TlsPolicy: REQUIRE | OPTIONAL
//             },
//             ReputationOptions: {
//                 // LastFreshStart: new Date || 'Wed Dec 31 1969 16:00:00 GMT-0800 (PST)' || 123456789,
//                 ReputationMetricsEnabled
//             },
//             SendingOptions: {
//                 SendingEnabled
//             },
//             // SuppressionOptions: {
//             //     SuppressedReasons: [
//             //         BOUNCE | COMPLAINT,
//             //         /* more items */
//             //     ]
//             // },
//             Tags: [
//                 {
//                     Key: 'hyphen:devteam', /* required */
//                     Value: 'CRM' /* required */
//                 }
//             ]
//             // TrackingOptions: {
//             //     CustomRedirectDomain: 'STRING_VALUE' /* required */
//             // }
//         };
//         const createConfigurationSetResp = await sesv2.createConfigurationSet(params).promise();
//         console.log(`createConfigurationSetResp: ${JSON.stringify(createConfigurationSetResp)}`);
//         return success({ status: true, data: createConfigurationSetResp });
//     }
//     else {
//         return badRequest({ status: false, error: `Configuration set creation failed. Please provide a valid name.` });
//     }
// }
// const createDedicatedIPPool = async (data) => {
//     const { name: PoolName } = data;
//     if (PoolName) {
//         const params = {
//             PoolName, /* required */
//             Tags: [
//                 {
//                     Key: 'hyphen:devteam', /* required */
//                     Value: 'CRM' /* required */
//                 }
//             ]
//         };
//         const createDedicatedIpPoolResp = await sesv2.createDedicatedIpPool(params).promise();
//         console.log(`createDedicatedIpPoolResp: ${JSON.stringify(createDedicatedIpPoolResp)}`);
//         return success({ status: true, data: createDedicatedIpPoolResp });
//     }
//     else {
//         return badRequest({ status: false, error: `Configuration set creation failed. Please provide a valid name.` });
//     }
// }
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
    const type =
      event && event.pathParameters && event.pathParameters.type
        ? event.pathParameters.type
        : 0;
    const action =
      event && event.pathParameters && event.pathParameters.action
        ? event.pathParameters.action
        : 0;
    console.log(`type: ${type}`);
    console.log(`action: ${action}`);
    const path = event && event.path ? event.path : "";
    let data;
    console.log(`event: ${JSON.stringify(event)}`);
    switch (event.httpMethod) {
      case "GET":
        if (type === "segment") {
          switch (action) {
            case "get":
              response = await getSegment(event);
              break;
            default:
              response = failure();
              break;
          }
        } else if (type === "campaign") {
          if (action === "get") {
            response = await getCampaign(event);
          } else {
            response = failure();
          }
        } else if (path.indexOf("endpoint/unsubscribe") !== -1) {
          response = await unsubscribe(event);
        } else if (path.indexOf("endpoint/subscribe") !== -1) {
          response = await subscribe(event);
        }
        break;
      case "POST":
        data = JSON.parse(event.body);
        if (!data) {
          response = failure();
        } else if (type === "segment") {
          switch (action) {
            case "list":
              response = await listSegments(data);
              break;
            case "create":
              response = await createSegment(data);
              break;
            case "update":
              response = await updateSegment(data);
              break;
            case "delete":
              response = await deleteSegment(data);
              break;
            default:
              response = failure();
              break;
          }
        } else if (type === "campaign") {
          console.log("In type campaign");
          switch (action) {
            case "create":
              response = await createCampaign(data);
              break;
            case "update":
              response = await createCampaign(data, true);
              break;
            case "delete":
              response = await deleteCampaign(data);
              break;
            case "metrics":
              response = await getCampaignKpi(data);
              break;
            case "list":
              response = await listCampaigns(data);
              break;
            case "activities":
              response = await getCampaignActivities(data);
              break;
            default:
              response = failure();
              break;
          }
        } else if (type === "journey") {
          switch (action) {
            case "create":
              response = await createJourney(data);
              break;
            case "list":
              response = await listJourney(data);
              break;
            case "listj":
              response = await listJourney(data, true);
              break;
            case "update":
              response = await updateJourney(data);
              break;
            case "delete":
              response = await deleteJourney(data);
              break;
            case "metrics":
              response = await getJourneyMetrics(data);
              break;
            case "emetrics":
              response = await getJourneyExecMetrics(data);
              break;
            case "ametrics":
              response = await getJourneyActMetrics(data);
              break;
            case "chstate":
              response = await updateJourneyState(data);
              break;
            case "get":
              response = await getJourney(data);
              break;
            case "gettask":
              response = await getTaskContent(data);
              break;
            case "orphaned":
              response = await deleteOrphanJourneys();
              break;
            default:
              response = failure();
              break;
          }
        } else if (type === "template") {
          switch (action) {
            case "create":
              response = await createEmailTemplate(data.payload, data.crby, data.cmpby);
              break;
            case "get":
              response = await getEmailTemplate(data);
              break;
            case "list":
              response = await listTemplate(data);
              break;

            /* case 'migrate':
                                response = await migrateData(data);
                                break; */
            case "update":
              response = await updateEmailTemplate(data);
              break;
            case "delete":
              response = await deleteEmailTemplate(data);
              break;
            case "sesverifytemplatecreate":
              response = await sesVerifyTemplateCreate(data);
              break;
            case "sesverifytemplateget":
              response = await sesVerifyTemplateGet();
              break;
            case "cognitoverifytemplatecreate":
              response = await cognitoTemplateCreate(data);
              break;
            case "cognitoverifytemplateget":
              response = await cognitoTemplateGet(data);
              break;
            default:
              response = failure();
              break;
          }
        } else if (type === "email") {
          if (action === "send") {
            response = await sendEmail(data);
          } else if (action === "pinpoint_send") {
            response = await pinpointEmailSendEmail(data);
          } else if (action === "ses_send") {
            response = await sendSesEmail(data);
          } else if (action === "email_new") {
            response = await sendEmailNew(data);
          }
          else {
            /* else if (action === 'crcset') {
                            response = await createConfigurationSet(data);
                        } */
            /* else if (action === 'crdedip') {
                            response = await createDedicatedIPPool(data);
                        } */
            response = failure();
          }
        } else if (type === "endpoint") {
          switch (action) {
            case "get":
              response = await getUserEndpoints(data);
              break;
            case "opt":
              response = await optCampaign(data);
              break;
            case "qndel":
              response = await removeQuestions(data);
              break;
            default:
              break;
          }
        } else if (type === "metrics") {
          switch (action) {
            case "list":
              response = await detailedMetrics(data);
              break;
            case "reason":
              response = await getBounceReason(data);
              break;
            default:
              break;
          }
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
