/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import { v4 as uuidv4 } from "uuid";
import {
  getCobuyerCreateJSON,
  isCorrectFieldType,
  postResources,
  getResources,
  updateResources,
  deleteResources,
  getHydrationParamsForQuery,
  getResourceJSON,
} from "../libs/db";
import { deleteEntityEndpoint } from "../campaign/common";
import { publishEntityData } from "../libs/messaging";
import { failure } from "../libs/response-lib";
import { validateFields } from "../validation/validation";
import { getBuilderAsync } from "../builders/builders";
import { getDynamicRequiredFields } from "../dynamicRequiredFields/dynamicRequiredFields";
import { createChangeActivity } from "../libs/change-activity";

const { STACK_PREFIX } = process.env;
const createCobuyer = async (data) => {
  const { hb_id: hbId, userid="" } = data;
  const dynamicRequiredFieldData = await getDynamicRequiredFields({pathParameters: {id: hbId, type: "cobuyer"}}, true);
  console.log(`dynamicRequiredFieldData: ${JSON.stringify(dynamicRequiredFieldData)}`);
  const cobuyerRequiredFields = dynamicRequiredFieldData?.data[0]?.required_fields || {};
  const retVal = validateFields("co_buyer", data, false, cobuyerRequiredFields);
  if (retVal === "") {
    const getBuilderResp = await getBuilderAsync(hbId);
    if (getBuilderResp && getBuilderResp.id) {
      const cobuyerJSON = getCobuyerCreateJSON(data);
      // Check for data type for the array/object fields
      if (!isCorrectFieldType(cobuyerJSON)) {
        return failure({ status: false, error: "Field Type Error" });
      }

      // Proceed with the create operation
      const cobuyerUUID = data.isSns ? data.id : uuidv4();
      const params = {
        TableName: process.env.entitiesTableName,
        Item: {
          type: cobuyerJSON.type,
          hb_id: cobuyerJSON.hb_id,
          fname: cobuyerJSON.fname,
          lname: cobuyerJSON.lname,
          fullname: `${cobuyerJSON.fname} ${cobuyerJSON.lname || ""}`,
          phone: cobuyerJSON.phone,
          email: cobuyerJSON.email,
          mdt: cobuyerJSON.mod_dt,
          cdt: cobuyerJSON.cdt,
          infl: cobuyerJSON.infl,
          cntm: cobuyerJSON.cntm,
          rel_id: cobuyerJSON.rel_id,
          appid: cobuyerJSON.appid,
          inte: cobuyerJSON.inte,
          m_id: cobuyerJSON.m_id,
          entity: `cobuyer#${cobuyerJSON.hb_id}#${cobuyerUUID}`,
          id: cobuyerJSON.rel_id,
          data: cobuyerUUID,
          optindt: cobuyerJSON.optindt,
          optoutdt: cobuyerJSON.optoutdt,
          gen_src: "",
          optst: "",
        },
      };
      if (data?.isSns) {
        if (data?.isHf) params.Item.gen_src = "msg_hf";
        else params.Item.gen_src = "msg_brix";
      } else params.Item.gen_src = "app";
      if (!cobuyerJSON.optst) {
        if (getBuilderResp.optin) params.Item.optst = "PENDING";
        else params.Item.optst = "NONE";
      } else params.Item.optst = cobuyerJSON.optst;
      // Setting non-mandatory fields based on it's availability
      if (cobuyerJSON.img) {
        params.Item.img = cobuyerJSON.img;
      }
      const crby = data.crby ? data.crby : "";
      if (crby) {
        params.Item.crby = crby;
      }
      if (cobuyerJSON.hfhbid) {
        params.Item.hfhbid = cobuyerJSON.hfhbid;
      }
      if (cobuyerJSON.hfid) {
        params.Item.hfid = cobuyerJSON.hfid;
      }
      params.Item.dg = [];
      if (data.dgraph_list && data.dgraph_list.length > 0) {
        data.dgraph_list.forEach((dgraphItem) => {
          params.Item.dg.push({
            q: dgraphItem.qstn_id,
            a: dgraphItem.option_id,
          });
        });
      }
      const cobuyerCreateResp = await postResources(params);
      if (
        !data.isSns &&
        (STACK_PREFIX.includes("aws-crm") || STACK_PREFIX.includes("crm-test"))
      ) {
        const publishEntityDataHfResp = await publishEntityData({
          entityId: cobuyerUUID,
          entityType: "cobuyer",
          isBrix: false,
          isCreate: true,
          isHomefront: true,
          messageId: uuidv4(),
          HomebuilderID: hbId,
        });
        console.log("publishEntityDataHfResp: ", publishEntityDataHfResp);
      }
      const activityParams = {
        profileChange: "profile_cobuyer_create",
        customerUUID: cobuyerJSON.rel_id,
        oldst: "",
        stage: `${cobuyerJSON.fname} ${cobuyerJSON.lname || ""}`,
        userid,
        hbId
      }
      await createChangeActivity(activityParams);
      return cobuyerCreateResp;
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
export const listCobuyers = (event, isJSONOnly = false) => {
  const { id: relId = "", hbid = "" } = event.pathParameters;
  const typeParam = "cobuyer";
  const params = {
    TableName: process.env.entitiesTableName,
    KeyConditionExpression: "#id =:id and begins_with(#entity, :entity)",
    ExpressionAttributeNames: {
      "#entity": "entity",
      "#id": "id",
    },
    ExpressionAttributeValues: {
      ":entity": `${typeParam}#${hbid}`,
      ":id": relId,
    },
  };
  console.log(params);
  if (isJSONOnly || event?.pathParameters?.isJSONOnly) {
    return getResourceJSON(params);
  }

  return getResources(params);
};
const getCobuyer = (data) => {
  const {
    hb_id: hbid = "",
    rel_id: relId = "",
    id = "",
    isJSONOnly = false,
  } = data;
  const params = {
    TableName: process.env.entitiesTableName,
    KeyConditionExpression: "#id = :id and #entity = :entity",
    ExpressionAttributeNames: {
      "#id": "id",
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":id": relId,
      ":entity": `cobuyer#${hbid}#${id}`,
    },
  };
  console.log(params);
  if (isJSONOnly) return getResourceJSON(params);
  return getResources(params);
};
const updateCobuyer = async (data) => {
  const {
    id = "",
    hb_id: hbid = "",
    rel_id: relId = "",
    attrn: propName = "",
    attrv: propVal = "",
  } = data;
  const modDt = Date.now();

  const params = {
    TableName: process.env.entitiesTableName,
    Key: {
      id: relId,
      entity: `cobuyer#${hbid}#${id}`,
    },
    UpdateExpression: `set ${propName} = :pval, mdt = :modDate`,
    ExpressionAttributeValues: {
      ":pval": propVal,
      ":modDate": modDt,
    },
  };

  const cobuyerDetails = await getCobuyer({
    hb_id: hbid,
    rel_id: relId,
    id,
    isJSONOnly: true,
  });
  console.log("cobuyerDetails: ", cobuyerDetails);
  const coBuyerFname =
    cobuyerDetails && cobuyerDetails.length ? cobuyerDetails[0].fname : "";
  const coBuyerLname =
    cobuyerDetails && cobuyerDetails.length ? cobuyerDetails[0].lname : "";

  if (propName === "fname") {
    params.UpdateExpression = `set ${propName} = :pval, mdt = :modDate, fullname = :fullname`;
    params.ExpressionAttributeValues[
      ":fullname"
    ] = `${propVal} ${coBuyerLname}`;
  }
  if (propName === "lname" && coBuyerFname) {
    params.UpdateExpression = `set ${propName} = :pval, mdt = :modDate, fullname = :fullname`;
    params.ExpressionAttributeValues[":fullname"] = `${coBuyerFname} ${
      propVal || ""
    }`;
  }

  console.log(params);

  const updateCobuyerResp = await updateResources(params);
  console.log(`updateCobuyerResp: ${JSON.stringify(updateCobuyerResp)}`);
  if (STACK_PREFIX.includes("aws-crm") || STACK_PREFIX.includes("crm-test")) {
    const publishCustomerDataResponse = await publishEntityData({
      entityId: id,
      entityType: "cobuyer",
      isBrix: false,
      isCreate: false,
      isHomefront: true,
      messageId: uuidv4(),
      HomebuilderID: hbid,
    });
    console.log("publishCustomerDataResponse: ", publishCustomerDataResponse);
  }
  return updateCobuyerResp;
};
export const updateCobuyerRow = async (data) => {
  const { isHf = false } = data;
  console.log(`data: ${JSON.stringify(data)}`);
  const params = {
    TableName: process.env.entitiesTableName,
    Item: {
      type: data.type,
      hb_id: data.hb_id,
      fname: data.fname,
      lname: data.lname,
      fullname: `${data.fname} ${data.lname || ""}`,
      phone: data.phone,
      email: data.email,
      mdt: data.mod_dt,
      cdt: data.cdt,
      infl: data.infl,
      cntm: data.cntm,
      rel_id: data.rel_id,
      appid: data.appid,
      inte: data.inte,
      m_id: data?.m_id || [],
      entity: `cobuyer#${data.hb_id}#${data.id}`,
      id: data.rel_id,
      data: data.id,
      optst: data.optst,
      optindt: data.optindt,
      optoutdt: data.optoutdt,
      gen_src: "",
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
  if (data?.isSns) {
    params.Item.isSns = data.isSns;
  }
  // Get the cobuyer Details
  const cobuyerGetParams = getHydrationParamsForQuery(
    data.rel_id,
    `cobuyer#${data.hb_id}#${data.id}`,
    false,
    true
  );
  const cobuyerDetail = await getResourceJSON(cobuyerGetParams);
  const currentDate = Date.now();
  if (cobuyerDetail && cobuyerDetail.length) {
    const cobuyerDetailObj = cobuyerDetail[0];
    console.log(`cobuyerDetailObj: ${JSON.stringify(cobuyerDetailObj)}`);
    const cdt = cobuyerDetailObj?.cdt ?? "";
    // Merge the existing customer data with the request obj
    params.Item = { ...cobuyerDetailObj, ...params.Item };
    params.Item.cdt = cdt;
    params.Item.mdt = currentDate;
  }
  if (isHf) {
    params.Item.cdt = currentDate;
    params.Item.mdt = currentDate;
  }
  const dynamicRequiredFieldData = await getDynamicRequiredFields({pathParameters: {id: data.hb_id, type: "cobuyer"}}, true);
  console.log(`dynamicRequiredFieldData: ${JSON.stringify(dynamicRequiredFieldData)}`);
  const cobuyerRequiredFields = dynamicRequiredFieldData?.data[0]?.required_fields || {};
  const retVal = validateFields("co_buyer", params.Item, false, cobuyerRequiredFields);
  if (retVal === "") {
    // Check for data type for the array/object fields
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
const deleteCobuyer = async (data) => {
  const { id = "", hb_id: hbid = "", rel_id = "", isSns = false, userid = "" } = data;
  const getDeleteEndpoint = await deleteEntityEndpoint(id, "cobuyer", true);
  console.log(`getDeleteEndpoint: ${JSON.stringify(getDeleteEndpoint)}`);

  // Get the cobuyer details JSON for sending message to Homefront
  // Also get the cusotmer details associated with the cobuyer
  let hfhbid;
  let hfid;
  let OpportunityID;
  let OpportunityIDHyphen;
  if (!isSns) {
    const entityGetParams = getHydrationParamsForQuery(
      id,
      `cobuyer#${hbid}`,
      true,
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
    // Get the customer details
    const customerGetParams = getHydrationParamsForQuery(
      rel_id,
      `customer#${hbid}`,
      false,
      true
    );
    const customerDetail = await getResourceJSON(customerGetParams);
    console.log(`customerDetail: ${JSON.stringify(customerDetail)}`);
    if (customerDetail && customerDetail.length) {
      OpportunityID = customerDetail[0]?.hfid ?? "";
      OpportunityIDHyphen = customerDetail[0]?.id ?? "";
      console.log(`OpportunityID: ${OpportunityID}`);
      console.log(`OpportunityIDHyphen: ${OpportunityIDHyphen}`);
    }
  }

  const params = {
    TableName: process.env.entitiesTableName,
    Key: {
      id: rel_id,
      entity: `cobuyer#${hbid}#${id}`,
    },
  };
  console.log(params);
  const getCoBuyerParams = {
    hb_id: hbid,
    rel_id,
    id,
    isJSONOnly: true
  };
  const coBuyer = await getCobuyer(getCoBuyerParams);
  console.log(`CoBuyer before delete :: ${JSON.stringify(coBuyer[0])}`);
  const deleteCobuyerResp = await deleteResources(params);
  console.log(`deleteCobuyerResp: ${JSON.stringify(deleteCobuyerResp)}`);
  // creating change activity for cobuyer delete
  const activityParams = {
    profileChange: "profile_cobuyer_delete",
    customerUUID: rel_id,
    oldst: "",
    stage: `${coBuyer[0].fullname}`,
    userid,
    hbId: hbid
  }
  await createChangeActivity(activityParams);
  // Do a homefront publish if this call is not originated from messaging (isSns)
  if (
    !isSns &&
    (STACK_PREFIX.includes("aws-crm") || STACK_PREFIX.includes("crm-test"))
  ) {
    // Homefront message
    const publishEntityDataHfResp = await publishEntityData({
      entityId: id,
      entityType: "cobuyer",
      isBrix: false,
      isCreate: false,
      isHomefront: true,
      isDelete: true,
      messageId: uuidv4(),
      HomebuilderID_HF: hfhbid,
      Id: hfid,
      OpportunityID,
      OpportunityID_Hyphen: OpportunityIDHyphen,
      HomebuilderID: hbid,
    });
    console.log("publishEntityDataHfResp: ", publishEntityDataHfResp);
  }
  return deleteCobuyerResp;
};

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
          response = await listCobuyers(event);
        } else {
          response = failure();
        }
        break;
      case "POST":
        data = JSON.parse(event.body);
        if (!data) {
          response = failure();
        } else if (action === "create") {
          response = await createCobuyer(data);
        } else if (action === "update") {
          response = await updateCobuyer(data);
        } else if (action === "updateRow") {
          response = await updateCobuyerRow(data);
        } else if (action === "delete") {
          response = await deleteCobuyer(data, event);
        } else if (action === "get") {
          response = await getCobuyer(data);
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
