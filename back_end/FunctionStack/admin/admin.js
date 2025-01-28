/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import { v4 as uuidv4 } from "uuid";
import AWS from "aws-sdk";
import { failure, success } from "../libs/response-lib";
import { initLambdaInvoke } from "../libs/lambda";
import {
  getResourceJSON,
  postResources,
  getResources,
  updateOrder,
  updateResources,
} from "../libs/db";
import {
  createCommunity,
  updateCommunityRow,
  deleteCommunity,
  getCommunity,
} from "../communities/communities";
import {
  createAgency,
  updateAgencyRow,
  deleteAgency,
  getAgency,
} from "../agencies/agencies";
import {
  createMetro,
  updateMetroRow,
  deleteMetro,
  getMetro,
} from "../metros/metros";
import {
  // listRealtors,
  createRealtor,
  updateRealtorRow,
  deleteRealtor,
  getRealtor,
} from "../realtors/realtors";
import {
  // listAllUsers,
  createUser,
  updateUserRow,
  deleteUser,
  deleteSuperAdmin,
  getUser,
} from "../users/users";
import {
  // listExpertise,
  createExpertise,
  updateExpertiseRow,
  deleteExpertise,
  getExpertise,
} from "../expertise/expertise";
import {
  // listSpeciality,
  createSpeciality,
  updateSpecialityRow,
  deleteSpeciality,
  getSpeciality,
} from "../specialities/specialities";
import {
  // listContactMethod,
  createContactMethod,
  updateContactMethodRow,
  deleteContactMethod,
  getContactMethod,
} from "../contactMethod/contactMethod";
import {
  // listGrade,
  createGrade,
  updateGradeRow,
  deleteGrade,
  getGrade,
} from "../grade/grade";
import {
  // listDesiredFeatures,
  createDesiredFeature,
  updateDesiredFeatureRow,
  deleteDesiredFeature,
  getDesiredFeature,
} from "../desiredFeatures/desiredFeatures";
import {
  // listInfluence,
  createInfluence,
  updateInfluenceRow,
  deleteInfluence,
  getInfluence,
} from "../influence/influence";
import {
  // listSource,
  createSource,
  updateSourceRow,
  deleteSource,
  getSource,
} from "../source/source";
import {
  // listTemplate,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  getEmailTemplate,
  createTemplateDynamoEntry,
} from "../campaign/campaign";
import {
  createQuestion,
  // listQuestion,
  getQuestion,
  updateQuestionRow,
  deleteQuestion,
} from "../qstn/qstn";
import {
  updateMessagingParams,
  getMessagingParams,
} from "../builders/builders";
import {
  createMoveInTimeFrame,
  deleteMoveInTimeFrame,
  getMoveInTimeFrame,
  updateMoveInTimeFrameRow
} from "../moveInTimeFrame/moveInTimeFrame";
import {
  createDynamicRequiredField,
  getDynamicRequiredFields,
  updateDynamicRequiredField
} from "../dynamicRequiredFields/dynamicRequiredFields";
import { getEntities } from "../endpointcount/endpointcount";
import { deleteCustomer } from "../customers/customers";
import { publishEntityData } from "../libs/messaging";
import { deleteAlert, deleteStage } from "../stage/stage";
import { deleteLot } from "../lot/lot";
import { deletePlan } from "../plan/plan";
import { deleteGoal } from "../goalSetting/goalSetting";
import { createChangeActivity } from "../libs/change-activity";

const { S3_BUCKET_ARN, DELETE_REALTOR_FROM_CUSTOMER_STATEMACHINE_ARN } = process.env;
const s3 = new AWS.S3();
const stepfunctions = new AWS.StepFunctions({ apiVersion: "2016-11-23" });
// const { PUBLIC_CONFIG, SSL_CERT_ARN, API_SSL_CERT_ARN, LOG_BUCKET, EN_DCRYPT_KEY_ARN } = process.env;
const {
  CUSTOMER_IMPORT_STATE_MACHINE_ARN,
  STACK_PREFIX,
  COMMUNITIES_LAMBDA_ARN,
  AGENCIES_LAMBDA_ARN,
  METROS_LAMBDA_ARN,
  REALTOR_LAMBDA_ARN,
  USERS_LAMBDA_ARN,
  EXPERTISE_LAMBDA_ARN,
  SPECIALTY_LAMBDA_ARN,
  GRADE_LAMBDA_ARN,
  DESIRED_FEATURES_LAMBDA_ARN,
  SOURCE_LAMBDA_ARN,
  INFLUENCE_LAMBDA_ARN,
  CONTACT_METHOD_LAMBDA_ARN,
  CAMPAIGN_LAMBDA_ARN,
  DEMOGRAPHICS_LAMBDA_ARN,
  MOVE_IN_TIME_FRAME_LAMBDA_ARN,
  DYNAMIC_REQUIRED_FIELDS_ARN
} = process.env;
const createItem = async (data) => {
  try {
    if (data && data.payload && data.type) {
      let createResponse = failure({
        status: false,
        error: "Type Not Supported",
      });
      console.log(`Data: ${JSON.stringify(data)}`);
      switch (data.type) {
        case "community":
          createResponse = await createCommunity(data.payload);
          break;
        case "agency":
          createResponse = await createAgency(data.payload);
          break;
        case "metro":
          createResponse = await createMetro(data.payload);
          break;
        case "realtor":
          createResponse = await createRealtor(data.payload);
          break;
        case "agent":
          createResponse = await createUser(data.payload, data.type);
          break;
        case "exp":
          createResponse = await createExpertise(data.payload);
          break;
        case "spec":
          createResponse = await createSpeciality(data.payload);
          break;
        case "grade":
          createResponse = await createGrade(data.payload);
          break;
        case "desf":
          createResponse = await createDesiredFeature(data.payload);
          break;
        case "psrc":
          createResponse = await createSource(data.payload);
          break;
        case "infl":
          createResponse = await createInfluence(data.payload);
          break;
        case "cntm":
          createResponse = await createContactMethod(data.payload);
          break;
        case "email_template":
          createResponse = await createEmailTemplate(data.payload, data.crby, data.cmpby, data.online_agent, data.sales_agent);
          break;
        case "question":
          createResponse = await createQuestion(data.payload);
          break;
        case "desm":
          createResponse = await createMoveInTimeFrame(data.payload);
          break;
        case "dynamic_required_fields":
          createResponse = await createDynamicRequiredField(data.payload);
          break;
        default:
          break;
      }
      console.log(createResponse);
      return createResponse;
    }
    return failure({ status: false, error: "Invalid Payload" });
  } catch (e) {
    console.log(e);
    return failure({ status: false, error: e.message, data });
  }
};

const updateOrderAdmin = async (data) => {
  try {
    if (data && data.payload && data.type) {
      const updateOrderAdminRes = await updateOrder(data.type, data.payload);
      console.log(
        `updateOrderAdminRes: ${JSON.stringify(updateOrderAdminRes)}`
      );
      return updateOrderAdminRes;
    }
    return failure({ status: false, error: "Invalid Payload" });
  } catch (e) {
    console.log(e);
    return failure({ status: false, error: e.message, data });
  }
};
export const listItem = async (data) => {
  try {
    if (data && data.hbid && data.type) {
      let listResponse = failure({
        status: false,
        error: "Type Not Supported",
      });
      let invokeEventObj = {
        hbid: data.hbid,
      };
      const listAPIAction = "list";
      let listMethod = "GET";
      let listAPIType = "";
      let lambdaARN = "";
      switch (data.type) {
        case "community":
          lambdaARN = COMMUNITIES_LAMBDA_ARN;
          break;
        case "agency":
          lambdaARN = AGENCIES_LAMBDA_ARN;
          break;
        case "metro":
          lambdaARN = METROS_LAMBDA_ARN;
          break;
        case "realtor":
          lambdaARN = REALTOR_LAMBDA_ARN;
          break;
        case "agent":
          lambdaARN = USERS_LAMBDA_ARN;
          listAPIType = "all";
          invokeEventObj = {
            type: data.type,
            isJSONOnly: false,
            isUsersOnly: data.isu ? data.isu : false,
            hbid: data.hbid,
          };
          break;
        case "exp":
          lambdaARN = EXPERTISE_LAMBDA_ARN;
          break;
        case "spec":
          lambdaARN = SPECIALTY_LAMBDA_ARN;
          break;
        case "grade":
          lambdaARN = GRADE_LAMBDA_ARN;
          break;
        case "desf":
          lambdaARN = DESIRED_FEATURES_LAMBDA_ARN;
          break;
        case "psrc":
          lambdaARN = SOURCE_LAMBDA_ARN;
          break;
        case "infl":
          lambdaARN = INFLUENCE_LAMBDA_ARN;
          break;
        case "cntm":
          lambdaARN = CONTACT_METHOD_LAMBDA_ARN;
          break;
        case "email_template":
          console.log(
            `email_template listTemplate: ${JSON.stringify(data)}`
          );
          lambdaARN = CAMPAIGN_LAMBDA_ARN;
          listAPIType = "template";
          invokeEventObj = {
            hbid: data.hbid,
            stageOnly: data?.stageOnly || false,
            from: data.from,
            size: data.size || 25,
            sort: data.sort || [],
            after: data.after || [],
            searchKey: data.searchKey || '',
            crby: data.crby || '',
            crby_utype: data.utype || ''
          };
          listMethod = "POST";
          break;
        case "question":
          lambdaARN = DEMOGRAPHICS_LAMBDA_ARN;
          break;
        case "desm":
          lambdaARN = MOVE_IN_TIME_FRAME_LAMBDA_ARN;
          break;
        case "dynamic_required_fields":
          lambdaARN = DYNAMIC_REQUIRED_FIELDS_ARN;
          listMethod = 'POST';
          break;
        default:
          break;
      }
      console.log(`listAPIAction: ${listAPIAction}`);
      console.log(`invokeEventObj: ${JSON.stringify(invokeEventObj)}`);
      console.log(`lambdaARN: ${lambdaARN}`);
      console.log(`listMethod: ${listMethod}`);
      listResponse = await initLambdaInvoke({
        action: listAPIAction,
        type: listAPIType,
        httpMethod: listMethod,
        body: invokeEventObj,
        arn: lambdaARN,
      });
      console.log(`listResponse: ${JSON.stringify(listResponse)}`);
      return listResponse;
    }
    return failure({ status: false, error: "Invalid Payload" });
  } catch (e) {
    console.log(e);
    return failure({ status: false, error: e.message, data });
  }
};
const getItem = async (data) => {
  try {
    if (data && data.id && data.type) {
      let getResponse = failure({ status: false, error: "Type Not Supported" });
      const event = {
        pathParameters: {
          id: data.id,
          ...(data.payload && { ...data.payload })
        },
      };
      switch (data.type) {
        case "community":
          getResponse = await getCommunity(event);
          break;
        case "agency":
          getResponse = await getAgency(event);
          break;
        case "metro":
          getResponse = await getMetro(event);
          break;
        case "realtor":
          getResponse = await getRealtor(event);
          break;
        case "agent":
          getResponse = await getUser(event, data.type);
          break;
        case "exp":
          getResponse = await getExpertise(event);
          break;
        case "spec":
          getResponse = await getSpeciality(event);
          break;
        case "grade":
          getResponse = await getGrade(event);
          break;
        case "desf":
          getResponse = await getDesiredFeature(event);
          break;
        case "psrc":
          getResponse = await getSource(event);
          break;
        case "infl":
          getResponse = await getInfluence(event);
          break;
        case "cntm":
          getResponse = await getContactMethod(event);
          break;
        case "email_template":
          getResponse = await getEmailTemplate(data.payload);
          break;
        case "question":
          getResponse = await getQuestion(data.payload);
          break;
        case "desm":
          getResponse = await getMoveInTimeFrame(data.payload);
          break;
        case "dynamic_required_fields":
          getResponse = await getDynamicRequiredFields(event);
          break;
        default:
          break;
      }
      console.log(getResponse);
      return getResponse;
    }
    return failure({ status: false, error: "Invalid Payload" });
  } catch (e) {
    console.log(e);
    return failure({ status: false, error: e.message, data });
  }
};
const updateItem = async (data) => {
  try {
    if (data && data.payload && data.type) {
      let updateResponse = failure({
        status: false,
        error: "Type Not Supported",
      });
      switch (data.type) {
        case "community":
          updateResponse = await updateCommunityRow(data.payload);
          break;
        case "agency":
          updateResponse = await updateAgencyRow(data.payload);
          break;
        case "metro":
          updateResponse = await updateMetroRow(data.payload);
          break;
        case "realtor":
          updateResponse = await updateRealtorRow(data.payload);
          break;
        case "agent":
          updateResponse = await updateUserRow(data.payload, data.type);
          break;
        case "exp":
          updateResponse = await updateExpertiseRow(data.payload);
          break;
        case "spec":
          updateResponse = await updateSpecialityRow(data.payload);
          break;
        case "grade":
          updateResponse = await updateGradeRow(data.payload);
          break;
        case "desf":
          updateResponse = await updateDesiredFeatureRow(data.payload);
          break;
        case "psrc":
          updateResponse = await updateSourceRow(data.payload);
          break;
        case "infl":
          updateResponse = await updateInfluenceRow(data.payload);
          break;
        case "cntm":
          updateResponse = await updateContactMethodRow(data.payload);
          break;
        case "email_template":
          updateResponse = await updateEmailTemplate(data.payload, false, data.arn, data.isActive, data.templateId, data.tagType, data.online_agent, data.sales_agent);
          break;
        case "question":
          updateResponse = await updateQuestionRow(data.payload);
          break;
        case "desm":
          updateResponse = await updateMoveInTimeFrameRow(data.payload);
          break;
        case "dynamic_required_fields":
          updateResponse = await updateDynamicRequiredField(data.payload);
          break;
        default:
          break;
      }
      console.log(updateResponse);
      return updateResponse;
    }
    return failure({ status: false, error: "Invalid Payload" });
  } catch (e) {
    console.log(e);
    return failure({ status: false, error: e.message, data });
  }
};
const deleteItem = async (data) => {
  try {
    if (data && data.payload && data.type) {
      let deleteResponse = failure({
        status: false,
        error: "Type Not Supported",
      });
      switch (data.type) {
        case "community":
          deleteResponse = await deleteCommunity(data.payload);
          break;
        case "agency":
          deleteResponse = await deleteAgency(data.payload);
          break;
        case "metro":
          deleteResponse = await deleteMetro(data.payload);
          break;
        case "realtor":
          deleteResponse = await deleteRealtor(data.payload);
          break;
        case "agent":
          deleteResponse = await deleteUser(data.payload, data.type);
          break;
        case "exp":
          deleteResponse = await deleteExpertise(data.payload);
          break;
        case "spec":
          deleteResponse = await deleteSpeciality(data.payload);
          break;
        case "grade":
          deleteResponse = await deleteGrade(data.payload);
          break;
        case "desf":
          deleteResponse = await deleteDesiredFeature(data.payload);
          break;
        case "psrc":
          deleteResponse = await deleteSource(data.payload);
          break;
        case "infl":
          deleteResponse = await deleteInfluence(data.payload);
          break;
        case "cntm":
          deleteResponse = await deleteContactMethod(data.payload);
          break;
        case "email_template":
          deleteResponse = await deleteEmailTemplate(data.payload, data.templateId);
          break;
        case "question":
          deleteResponse = await deleteQuestion(data.payload);
          break;
        case "stage":
          deleteResponse = await deleteStage(data.payload);
          break;
        case "lot":
          deleteResponse = await deleteLot(data.payload);
          break;
        case "plan":
          deleteResponse = await deletePlan(data.payload);
          break;
        case "alert":
          deleteResponse = await deleteAlert(data.payload);
          break;
        case "goal":
          deleteResponse = await deleteGoal(data.payload);
          break;
        case "desm":
          deleteResponse = await deleteMoveInTimeFrame(data.payload);
          break;
        default:
          break;
      }
      console.log(deleteResponse);
      return deleteResponse;
    }
    return failure({ status: false, error: "Invalid Payload" });
  } catch (e) {
    console.log(e);
    return failure({ status: false, error: e.message, data });
  }
};

const detectDemographicsChanges = (oldList, newList) => {

  const oldMap = new Map(oldList.map(item => [item.q, item.a]));
  const newMap = new Map(newList.map(item => [item.q, item.a]));

  console.log('Old DG', oldMap);
  console.log('New DG', newMap);

  if (oldMap.size === 0) {
    const changeResp = [];
    let qId;
    newMap.forEach((a, q, map) => {
      changeResp.push({ q, olda: [], newa: [...map.get(q)] });
      qId = q;
    });
    return {
      changes: JSON.stringify({ removed: [], changed: changeResp }),
      qId
    }
  }

  if (newMap.size === 0) {
    return {
      changes: JSON.stringify({ removed: [...oldList], changed: [] }),
      qId: ""
    }
  }

  const changes = {};
  let qId;

  changes.removed = [];
  changes.changed = [];

  // Detect removed questions
  if (oldMap.size > newMap.size) {
    for (const [q, a] of oldMap) {
      changes.removed = !newMap.has(q) ? [...changes.removed, { q, a }] : []
    }
  } else if (oldMap.size < newMap.size) {
    for (const [q, a] of newMap) {
      changes.changed = !oldMap.has(q) ? [{ q, olda: [], newa: a }] : [...changes.changed]
    }
  } else {
    // Detect changes in answers
    for (const [q, a] of oldMap) {
      const newA = newMap.get(q);
      if (!newA) {
        changes.removed = [...changes.removed, { q, a }];
      } else {
        const isAnswerChanged = a.join("") !== newA.join("");
        changes.changed = isAnswerChanged ? [{ q, olda: [...a], newa: newA }] : [...changes.changed];
        qId = isAnswerChanged ? q : "";
      }
    }
  }
  return { changes: JSON.stringify(changes), qId };
}

const updateRowForQuestions = async (data) => {
  const { id, type, hbid, dg, userid = "" } = data;
  const isCobuyer = data.type === "cobuyer";
  const updateRowParams = {
    TableName: process.env.entitiesTableName,
    KeyConditionExpression: "",
    ExpressionAttributeNames: {},
    ExpressionAttributeValues: {},
  };
  // For cobuyer, use data GSI get params
  if (isCobuyer) {
    updateRowParams.IndexName = process.env.entitiesTableByDataAndEntity;
    updateRowParams.KeyConditionExpression = "#data = :data";
    updateRowParams.ExpressionAttributeNames = {
      "#data": "data",
    };
    updateRowParams.ExpressionAttributeValues = {
      ":data": id,
    };
  } else {
    updateRowParams.KeyConditionExpression = "#id = :id and #entity = :entity";
    updateRowParams.ExpressionAttributeNames = {
      "#id": "id",
      "#entity": "entity",
    };
    updateRowParams.ExpressionAttributeValues = {
      ":id": id,
      ":entity": `${type}#${hbid}`,
    };
  }
  console.log('UpdateRowParams : ', updateRowParams);
  const updateRowResp = await getResourceJSON(updateRowParams);
  if (updateRowResp && updateRowResp.length) {
    console.log('UpdateRowResponse before dg: ', JSON.stringify(updateRowResp[0]));
    const prevDG = [...updateRowResp[0].dg];
    updateRowResp[0].dg = dg;
    console.log('UpdateRowResponse after dg: ', JSON.stringify(updateRowResp[0]));
    const params = {
      TableName: process.env.entitiesTableName,
      Item: updateRowResp[0],
    };
    const updateCobuyerResp = await postResources(params);
    console.log(`updateCobuyerResp: ${JSON.stringify(updateCobuyerResp)}`);
    if (STACK_PREFIX.includes("aws-crm") || STACK_PREFIX.includes("crm-test")) {
      const publishCustomerDataResponse = await publishEntityData({
        entityId: id,
        entityType: type,
        isBrix: false,
        isCreate: false,
        isHomefront: true,
        messageId: uuidv4(),
        HomebuilderID: hbid,
      });
      console.log("publishCustomerDataResponse: ", publishCustomerDataResponse);
    }
    // create demographics change activity only if initiated by user
    // and prevent activity creation during other api calls
    if (userid) {
      const dgChanges = detectDemographicsChanges(prevDG, dg);
      const activityParams = {
        profileChange: `profile_dg`,
        oldinte: [`${JSON.stringify(prevDG)}`],
        inte: [`${dgChanges.changes}`],
        stage: dgChanges.qId,
        customerUUID: id,
        hbId: hbid,
        userid
      }
      await createChangeActivity(activityParams);
    }
    return updateCobuyerResp;
  }

  return failure({ status: false, error: "No such resource found." });
};
const updateStore = async (data) => {
  const {
    post: messagingPostPath = "",
    hydr: messagingHydrationPath = "",
    hostp: messagingPostHost = "",
    hosth: messagingHydrationHost = "",
    publishHostHf = "",
    publishPathHf = "",
    hydrationHostHf = "",
    hydrationPathHf = "",
    keyValHf = "",
  } = data;
  const updateMessagingParameters = await updateMessagingParams({
    publishHost: messagingPostHost,
    publishPath: messagingPostPath,
    hydrationHost: messagingHydrationHost,
    hydrationPath: messagingHydrationPath,
    publishHostHf,
    publishPathHf,
    hydrationHostHf,
    hydrationPathHf,
    keyValHf,
  });
  console.log(
    `updateMessagingParameters: ${JSON.stringify(updateMessagingParameters)}`
  );
  return updateMessagingParameters;
};

const getStoreParameters = async () => {
  // Get the Parameters
  try {
    const messagingParamsResp = await getMessagingParams();
    const {
      publishPath: messagingPostPath = "",
      publishHost: messagingPostHost = "",
      hydrationPath: messagingHydrationPath = "",
      hydrationHost: messagingHydrationHost = "",
      publishHostHf = "",
      publishPathHf = "",
      hydrationHostHf = "",
      hydrationPathHf = "",
      hydrationCRM = "",
      publishCRM = "",
      keyValHf = "",
    } = messagingParamsResp;
    return success({
      status: true,
      data: {
        messagingPostPath,
        messagingHydrationPath,
        messagingPostHost,
        messagingHydrationHost,
        publishHostHf,
        publishPathHf,
        hydrationHostHf,
        hydrationPathHf,
        hydrationCRM,
        publishCRM,
        keyValHf,
      },
    });
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
    return failure({ status: false, err: "Get parameters failed." });
  }
};
const listExternalCustomerImportExecutions = async (data) => {
  const statusFilter = data.status ? data.status : "FAILED";
  const maxResults = data.max ? data.max : 100;
  const nextToken = data.next ? data.next : "";
  const params = {
    stateMachineArn: CUSTOMER_IMPORT_STATE_MACHINE_ARN /* required */,
    maxResults,
    statusFilter,
  };
  if (nextToken) params.nextToken = nextToken;
  try {
    const listExecutionResp = await stepfunctions
      .listExecutions(params)
      .promise();
    console.log(`listExecutionResp: ${JSON.stringify(listExecutionResp)}`);
    return success(listExecutionResp);
  } catch (error) {
    console.log(`Exception: ${error}`);
    return failure(error);
  }
};
const describeStepExecutions = async (data) => {
  const executionArn = data.arn ? data.arn : "";
  if (executionArn) {
    const params = {
      executionArn /* required */,
    };
    try {
      const describeExecutionResp = await stepfunctions
        .describeExecution(params)
        .promise();
      console.log(
        `describeExecutionResp: ${JSON.stringify(describeExecutionResp)}`
      );
      return success(describeExecutionResp);
    } catch (error) {
      console.log(`Exception: ${error}`);
      return failure(error);
    }
  } else {
    return failure("Provide a valid execution arn");
  }
};
const listAllLastLeadIds = async () => {
  const params = {
    TableName: process.env.entitiesTableName,
    IndexName: process.env.entitiesTableByDataAndEntity,
    KeyConditionExpression: "#data = :data",
    ExpressionAttributeNames: {
      "#data": "data",
    },
    ExpressionAttributeValues: {
      ":data": `lastlead`,
    },
  };
  console.log(params);
  const lastLeadRes = await getResources(params);
  console.log(`lastLeadRes: ${JSON.stringify(lastLeadRes)}`);
  return lastLeadRes;
};
const getLastLead = async (data) => {
  const type = "lastlead";
  const lastLeadResource = await getEntities(`${type}#${data.hbid}`);
  console.log(`lastLeadResource: ${JSON.stringify(lastLeadResource)}`);
  return success(
    lastLeadResource && lastLeadResource.length ? lastLeadResource[0] : {}
  );
};
const listLeadApiStatusFileNames = async (data) => {
  const { rnstr, isz = false } = data;
  // rnstr comes with a trailing slash
  const postFix = isz ? `zillow/${rnstr}` : rnstr;
  const Prefix = `external_leads/${postFix}`;
  if (rnstr) {
    console.log("S3_BUCKET_ARN: ", S3_BUCKET_ARN);
    const params = {
      Bucket: S3_BUCKET_ARN,
      Delimiter: "/",
      Prefix,
    };
    console.log("params: ", params);
    try {
      const s3GetResp = await s3.listObjectsV2(params).promise();
      let contents = s3GetResp.Contents ? s3GetResp.Contents : [];
      contents = contents
        .filter((content) => content.Key.includes("_status.json"))
        .map((content) => {
          const name = content.Key.split(Prefix)[1];
          const timeStamp = name.split("_")[0];
          console.log(`name: ${name}`);
          console.log(`timeStamp: ${timeStamp}`);
          return {
            name,
            timeStamp,
            statusKey: content.Key,
            leadsKey: `${Prefix}${timeStamp}_leads.json`,
            modified: content.LastModified,
          };
        })
        .sort((a, b) => {
          if (a.timeStamp > b.timeStamp) return -1;
          if (b.timeStamp > a.timeStamp) return 1;
          return 0;
        });
      // Only send the latest 100 file metadata
      if (contents.length > 100) {
        contents = contents.slice(0, 100);
      }
      return success(contents);
    } catch (e) {
      console.log(`e: ${JSON.stringify(e.stack)}`);
      return failure(e);
    }
  } else {
    console.log(`path: ${JSON.stringify(data)}`);
    return failure({ error: "folderPath not found" });
  }
};
const getStatusFileContents = async (data) => {
  const s3Params = {
    Bucket: S3_BUCKET_ARN,
    Key: data.key,
  };
  try {
    const getObjectResp = await s3.getObject(s3Params).promise();
    const leads =
      getObjectResp && getObjectResp.Body
        ? JSON.parse(Buffer.from(getObjectResp.Body))
        : [];
    return success(leads);
  } catch (error) {
    console.log(`error: ${JSON.stringify(error)}`);
    return failure(error);
  }
};
/**
 * Function for initiating bulk write of data to db
 * @param {*} data - usually contains entity "type" and "hbid"
 */
const bulkEntityCreate = async (data) => {

  console.log(`bulkEntityCreate payload :: ${JSON.stringify(data)}`);

  const { type, hbid: hbId } = data;

  console.log(`Entity type : ${type}`);
  console.log(`Entity hbid : ${hbId}`);

  let bulkCreateResp;
  let createFn;

  switch (type) {
    case "email_template":
      createFn = createTemplateDynamoEntry;
      break;

    default:
      break;
  }
  try {
    if (type === "email_template") {
      bulkCreateResp = await createFn({ hbId, isBatchMode: true });
    }
    console.log(`Bulk create response ${JSON.stringify(bulkCreateResp)}`);
    return bulkCreateResp;
  } catch (error) {
    console.log(`Error in bulk create : ${JSON.stringify(error)}`);
    return failure({ status: false, error })
  }
}
const bulkEntityDelete = async (data, index = 0, failedIds = []) => {
  const { entities, type } = data;
  console.log(`entities: ${JSON.stringify(entities)}`);
  console.log(`index: ${index}`);
  const entitiesArrLength = entities.length;
  console.log(`entitiesArrLength: ${entitiesArrLength}`);
  let deleteFunction;
  switch (type) {
    case "customer":
      deleteFunction = deleteCustomer;
      break;
    case "realtor":
      deleteFunction = deleteRealtor;
      break;
    case "agency":
      deleteFunction = deleteAgency;
      break;
    case "metro":
      deleteFunction = deleteMetro;
      break;
    case "community":
      deleteFunction = deleteCommunity;
      break;
    case "infl":
      deleteFunction = deleteInfluence;
      break;
    case "grade":
      deleteFunction = deleteGrade;
      break;
    case "psrc":
      deleteFunction = deleteSource;
      break;
    case "spec":
      deleteFunction = deleteSpeciality;
      break;
    case "exp":
      deleteFunction = deleteExpertise;
      break;
    case "agent":
      deleteFunction = deleteUser;
      break;
    case "cntm":
      deleteFunction = deleteContactMethod;
      break;
    case "question":
      deleteFunction = deleteQuestion;
      break;
    case "desf":
      deleteFunction = deleteDesiredFeature;
      break;
    case "email_template":
      deleteFunction = deleteEmailTemplate;
      break;
    case "sadmin":
      deleteFunction = deleteSuperAdmin;
      break;
    case "stage":
      deleteFunction = deleteStage;
      break;
    case "lot":
      deleteFunction = deleteLot;
      break;
    case "plan":
      deleteFunction = deletePlan;
      break;
    case "alert":
      deleteFunction = deleteAlert;
      break;
    case "goal":
      deleteFunction = deleteGoal;
      break;
    case "desm":
      deleteFunction = deleteMoveInTimeFrame;
      break;
    default:
      break;
  }
  try {
    if (index < entitiesArrLength) {
      console.log(`in if index < entitiesArrLength`);
      // Loop through the number of items to delete
      let bulkDeleteResp;
      if (type === 'realtor') {
        bulkDeleteResp = await deleteFunction(entities[index], 'bdelete');
      } else if (type === "email_template") {
        const pinpointParam = {
          TemplateName: entities[index].TemplateName
        }
        bulkDeleteResp = await deleteFunction(pinpointParam, entities[index].templateId);
      } else {
        bulkDeleteResp = await deleteFunction(entities[index]);
      }
      console.log(`bulkDeleteResp: ${JSON.stringify(bulkDeleteResp)}`);
      if (bulkDeleteResp?.statusCode === 500) {
        failedIds.push(entities[index]?.id);
      }
      if (type === "realtor" && index === 0) {
        const rltrIdArray = [];
        entities.forEach(({ id }) => {
          console.log(`id: ${id}`);
          rltrIdArray.push(id);
        });

        console.log(`rltrIdArray: ${JSON.stringify(rltrIdArray)}`);

        console.log(`hbId: ${JSON.stringify(entities[0].hb_id)}`);
        // delete realtor from customers where the realtor is assigned
        const input = JSON.stringify({
          hbId: entities[0].hb_id,
          rltrIdArray,
          purpose: "brealtor",
        });
        console.log(`input: ${input}`);
        const stateMachineParams = {
          input,
          stateMachineArn: DELETE_REALTOR_FROM_CUSTOMER_STATEMACHINE_ARN,
        };

        console.log(
          `stateMachineParams: ${JSON.stringify(stateMachineParams)}`
        );
        const startExecutionResp = await stepfunctions
          .startExecution(stateMachineParams)
          .promise();
        console.log(
          `stateExecutionResp: ${JSON.stringify(startExecutionResp)}`
        );
      }
      index += 1;
      return bulkEntityDelete(data, index, failedIds);
    }
    console.log(`in if index < entitiesArrLength`);
    return success({ status: true, data: { failedIds } });
  } catch (error) {
    console.log(`error: ${JSON.stringify(error)}`);
    if (index < entitiesArrLength) {
      index += 1;
      return bulkEntityDelete(data, index, failedIds);
    }

    return failure({ status: false, error });
  }
};
/**
 * 
 * @param {Object} data must contain the key "hbId"
 * @returns {Object} Object keys "oldinte" and "newinte"
 * @param {Array<UUID>} oldinte stores config for leads notification
 * @param {Array<UUID>} newinte stores config for external customers notification
 */
export const getSocketConfig = async (data) => {
  const {hbId} = data;
  const dynamoGetParams = {
    TableName: process.env.entitiesTableName,
    KeyConditionExpression: "#id = :id and #entity=:entity",
    ExpressionAttributeNames: {
      "#id": "id",
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":id": hbId,
      ":entity": "socketconfig",
    }
  }
  const configResp = await getResourceJSON(dynamoGetParams);
  console.log("Socket Config Response :: ", JSON.stringify(configResp));
  if (configResp.length) {
    return success({
      oldinte: configResp[0].oldinte,
      newinte: configResp[0].newinte
    });
  }
  try {
    const dynamoWriteParams = {
      TableName: process.env.entitiesTableName,
      Item: {
        id: hbId,
        entity: "socketconfig",
        mdt: Date.now(),
        cdt: Date.now(),
        oldinte: [], // this field stores which users get notifications when lead is assigned
        newinte: []  // this field stores which users get notifications when customer created through API
      }
    }
    const dynamoWriteResponse = await postResources(dynamoWriteParams, true);
    console.log(`dynamoWriteResponse : ${JSON.stringify(dynamoWriteResponse)}`);
    return success({
      oldinte: [],
      newinte: []
    })
  } catch (err) {
    console.log("Socket config create error :: ", JSON.stringify(err));
    return failure({message: "Unable to get/create socket config"})
  }

}
const updateSocketConfig = async (data) => {
  const updateParams = {
    TableName: process.env.entitiesTableName,
    Key: {
      id: data.hbId,
      entity: `socketconfig`,
    },
    UpdateExpression:
      "set #newinte = :newinte,  #mdt = :modDate, #oldinte = :oldinte",
    ExpressionAttributeNames: {
      "#newinte": "newinte",
      "#mdt": "mdt",
      "#oldinte" : "oldinte"
    },
    ExpressionAttributeValues: {
      ":newinte": data.newinte,
      ":oldinte": data.oldinte,
      ":modDate": Date.now(),
    },
  };
  console.log(`UpdateParams: ${JSON.stringify(updateParams)}`);
  try {
    
    const updateResp = await updateResources(updateParams, true);
    console.log(`updateResp: ${JSON.stringify(updateResp)}`);
  
    if (!updateResp.status) throw updateResp?.error || "Error in updating socket config";

    return success({status: true, ...data})
  } catch (error) {
    console.log(`error in socket config update :: `, JSON.stringify(error));
    return failure({status: false, message: JSON.stringify(error)})
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
    console.log("event: ", JSON.stringify(event));
    const action =
      event && event.pathParameters && event.pathParameters.action
        ? event.pathParameters.action
        : 0;
    let data;
    switch (event.httpMethod) {
      case "GET":
        if (action === "storeget") {
          response = await getStoreParameters();
        } else if (action === "listlastleads") {
          response = await listAllLastLeadIds();
        }
        break;
      case "POST":
        data = JSON.parse(event.body);
        if (!data) {
          response = failure();
        } else if (action === "get") {
          response = await getItem(data);
        } else if (action === "list") {
          response = await listItem(data);
        } else if (action === "create") {
          response = await createItem(data);
        } else if (action === "bcreate") {
          response = await bulkEntityCreate(data)
        } else if (action === "update_order") {
          response = await updateOrderAdmin(data);
        } else if (action === "update") {
          response = await updateItem(data);
        } else if (action === "rupdate") {
          response = await updateRowForQuestions(data);
        } else if (action === "delete") {
          response = await deleteItem(data, event);
        } else if (action === "bdelete") {
          response = await bulkEntityDelete(data, 0, [], event);
        } else if (action === "storeupdate") {
          response = await updateStore(data);
        } else if (action === "stepexec") {
          response = await listExternalCustomerImportExecutions(data);
        } else if (action === "descexec") {
          response = await describeStepExecutions(data);
        } else if (action === "getlastlead") {
          response = await getLastLead(data);
        } else if (action === "listleadstatus") {
          response = await listLeadApiStatusFileNames(data);
        } else if (action === "getstatusfile") {
          response = await getStatusFileContents(data);
        } else if (action === "getsocketconfig") {
          response = await getSocketConfig(data);
        } else if (action === "updatesocketconfig"){
          response  = await updateSocketConfig(data);
        }else {
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
