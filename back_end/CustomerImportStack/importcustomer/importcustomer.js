/* eslint-disable camelcase */
/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import { v4 as uuidv4 } from "uuid";
import { getFileFromS3 } from "../formatcustomers/formatcustomers";
import { uploadStatusFileAndUpdateDB } from "../convertcsv/convertcsv";
import {
  validateFields,
  validateIdFieldsForExternal,
} from "../../FunctionStack/validation/validation";
import {
  getUserCreateJSON,
  isCorrectFieldType,
  getParamsForQuery,
  getResourceJSON,
  postResources,
} from "../../FunctionStack/libs/db";
import utils from "../../FunctionStack/libs/utils";
import { getDynamicRequiredFields } from "../../FunctionStack/dynamicRequiredFields/dynamicRequiredFields";

const { STACK_PREFIX } = process.env;
const getCustomerDetails = async (hbid, id) => {
  const params = getParamsForQuery(
    {
      pathParameters: { id, hbid },
    },
    "customer"
  );
  return getResourceJSON(params);
};
const getCustomerUpdateParams = async (customerItem) => {
  console.log("customerItem: ", customerItem);
  const {
    id = "",
    type = "",
    hb_id: hbId = "",
    fname = "",
    lname = "",
    email = "",
    stage = "",
    appid = "",
    phone = "",
    psrc = "",
    infl = [],
    inte = [],
    grade = "",
    desf = [],
    cntm = "",
    dg = [],
    gen_src = "",
    m_id,
    desm = "",
    addr = "",
    newinte = []
  } = customerItem;
  const item = {
    type,
    hb_id: hbId,
    email,
    appid,
    entity: `customer#${hbId}`,
    gen_src,
    m_id,
  };
  // Get the Customer Details
  const customerDetails = await getCustomerDetails(hbId, id);
  console.log("customerDetails: ", customerDetails);
  const customerObj = customerDetails?.length && customerDetails[0];
  const customerId = customerObj?.id || "";
  const cdt = customerObj?.cdt || "";
  const jdt = customerObj?.jdt || "";
  const currentStage = customerObj?.stage || "";
  const interests = customerObj?.inte || [];
  const influences = customerObj?.infl || [];
  const desiredFeatures = customerObj?.desf || [];
  const demographics = customerObj?.dg || [];
  console.log(`🚀 | getCustomerUpdateParams | demographics`, demographics);

  item.id = customerId;
  item.cdt = cdt;
  item.mdt = Date.now();
  item.jdt = jdt;

  if (fname) item.fname = fname;
  if (lname) item.lname = lname;
  if (phone) item.phone = phone;
  if (stage) item.stage = stage;
  item.fullname = `${item.fname} ${item.lname || ""}`;

  if (psrc) item.psrc = psrc;
  if (grade) item.grade = grade;
  if (cntm) item.cntm = cntm;
  if (desm) item.desm = desm;
  if (addr) item.addr = addr;
  if (newinte.length) item.newinte = newinte;

  item.inte = [...new Set([...interests, ...inte])];
  item.infl = [...new Set([...influences, ...infl])];
  item.desf = [...new Set([...desiredFeatures, ...desf])];

  const dgToAdd = dg.filter(
    (currentDg) =>
      demographics.findIndex((demographic) => demographic.q === currentDg.q) ===
      -1
  );
  console.log(`🚀 | getCustomerUpdateParams | dgToAdd`, dgToAdd);
  console.log(`🚀 | getCustomerUpdateParams | dg`, dg);
  console.log(`dgToAdd: ${JSON.stringify(dgToAdd)}`);
  item.dg = [...demographics, ...dgToAdd];
  console.log("item: ", item);
  console.log("inte: ", inte);
  console.log("oldst: ", currentStage);
  return { item, oldinte: interests, oldst: currentStage };
};
const handleActivitiesAndMessaging = ({
  stage,
  userid,
  customerUUID,
  hbId,
  isExternalAPI,
  inte,
  note,
  noteSub,
  notesArr,
  isSns,
  isStageOkay,
  paramItem,
  isUpdate,
  oldinte,
  oldst,
}) => {
  console.log(`stage: ${stage}`);
  console.log(`userid: ${userid}`);
  console.log(`customerUUID: ${customerUUID}`);
  console.log(`hbId: ${hbId}`);
  console.log(`isExternalAPI: ${isExternalAPI}`);
  console.log(`inte: ${JSON.stringify(inte)}`);
  console.log(`note: ${note}`);
  console.log(`noteSub: ${noteSub}`);
  console.log(`notesArr: ${JSON.stringify(notesArr)}`);
  console.log(`isSns: ${isSns}`);
  console.log(`isStageOkay: ${isStageOkay}`);
  console.log(`paramItem: ${JSON.stringify(paramItem)}`);
  console.log(`isUpdate: ${isUpdate}`);
  console.log(`oldinte: ${JSON.stringify(oldinte)}`);
  console.log(`oldst: ${oldst}`);
  const response = {};

  if (!isUpdate) {
    console.log(`In !isUpdate: Create customer `);
    // Push the activity create params into an array so that we can run them one by one after creating customers in batch
    // Create stage change activity
    const stageChangeActivityObj = {
      stage,
      userid,
      customerUUID,
      hbId,
      inte,
    };

    if (isExternalAPI) {
      stageChangeActivityObj.isBulkAPI = true;
    } else {
      stageChangeActivityObj.isBulk = true;
    }
    console.log(
      `stageChangeActivityObj:${JSON.stringify(stageChangeActivityObj)}`
    );
    response.stageChangeActivityObj = stageChangeActivityObj;

    if (inte.length) {
      console.log(`In inte.length: Create customer`);
      // Create interest activity change
      const inteChangeActivityObj = {
        inte,
        userid,
        customerUUID,
        hbId,
        inteChange: true,
      };
      if (isExternalAPI) {
        inteChangeActivityObj.isBulkAPI = true;
      } else {
        inteChangeActivityObj.isBulk = true;
      }
      console.log(
        `inteChangeActivityObj:${JSON.stringify(inteChangeActivityObj)}`
      );
      response.inteChangeActivityObj = inteChangeActivityObj;
    }
  } else {
    console.log(`In !isUpdate else: Update customer `);
    if (oldst !== stage) {
      console.log(`In oldst !== stage: Update customer `);
      const stageChangeActivityObj = {
        stage,
        oldst,
        userid,
        customerUUID,
        hbId,
        inte,
      };

      if (isExternalAPI) {
        stageChangeActivityObj.isBulkAPI = true;
      } else {
        stageChangeActivityObj.isBulk = true;
      }
      console.log(
        `stageChangeActivityObj: ${JSON.stringify(stageChangeActivityObj)}`
      );
      response.stageChangeActivityObj = stageChangeActivityObj;
    }
    const changedInterests = utils.findArraySymmetricDifference(oldinte, inte);
    console.log(`changedInterests: ${JSON.stringify(changedInterests)}`);
    // Check whether any of the items in the interests array in the request
    // is not present in the existing inte array of the cusomer
    // changedInterests.removed is an array consisting of all the interests
    // that are not present in the customer's inte array
    if (changedInterests.removed.length) {
      console.log(`In changedInterests.removed.length: Update customer `);
      // New interests found in the request
      // Create interest activity change
      const inteChangeActivityObj = {
        inte: [
          ...(oldinte && oldinte?.length ? oldinte : []),
          ...(inte && inte?.length ? inte : []),
        ],
        oldinte,
        userid,
        customerUUID,
        hbId,
        inteChange: true,
        stage,
        addedInte: changedInterests.removed,
      };
      if (isExternalAPI) {
        inteChangeActivityObj.isBulkAPI = true;
      } else {
        inteChangeActivityObj.isBulk = true;
      }
      console.log(
        `inteChangeActivityObj: ${JSON.stringify(inteChangeActivityObj)}`
      );
      response.inteChangeActivityObj = inteChangeActivityObj;
    }
  }
  const getNoteReqObj = ({ noteText = "", noteSubject = "" }) => {
    let activityReqObj;
    try {
      console.log(`In try note: activity creation `);
      if (noteText) {
        console.log(`In note: activity creation `);
        if (noteSubject) {
          console.log(`In noteSubject: activity creation `);
          activityReqObj = {
            rel_id: customerUUID,
            hb_id: hbId,
            acti: {
              sub: noteSubject || "",
              note: noteText,
              dt: Date.now(),
              atype: "note",
            },
            isBulkAPI: false,
            isBulk: false,
          };
          if (isExternalAPI) {
            activityReqObj.isBulkAPI = true;
          } else {
            activityReqObj.isBulk = true;
          }
          console.log(`activityReqObj: ${JSON.stringify(activityReqObj)}`);
        }
      }
    } catch (error) {
      console.log(`note create error: ${JSON.stringify(error.stack)}`);
    }
    return activityReqObj;
  };
  if (isExternalAPI) {
    // Check for note to be created in external API
    response.activityReqObjArr = [
      getNoteReqObj({ noteText: note, noteSubject: noteSub }),
    ];
  } else {
    // For customer bulk import using file upload
    // Use the notesArr to create multiple notes for the customer
    response.activityReqObjArr = [];
    for (const noteObj of notesArr) {
      response.activityReqObjArr.push(
        getNoteReqObj({ noteText: noteObj.note, noteSubject: noteObj.subject })
      );
    }
  }
  // Push the messaging params into an array so that we can run them one by one after creating customers in batch
  if (
    !isSns &&
    isStageOkay &&
    (STACK_PREFIX.includes("aws-crm") || STACK_PREFIX.includes("crm-test"))
  ) {
    console.log(`paramItem: ${JSON.stringify(paramItem)}`);
    response.messagingObj = { ...paramItem };
  }
  console.log(`response at the end: ${JSON.stringify(response)}`);
  return response;
};
export const uploadErrors = async ({ statusFileKey, errorMessage }) => {
  console.log("Uploading errors");
  // Get the error file
  const statusFileContent = await getFileFromS3(statusFileKey);
  console.log(`statusFileContent: ${JSON.stringify(statusFileContent)}`);
  const { error = [] } = statusFileContent;
  console.log(`Existing errors: ${JSON.stringify(error)}`);
  console.log(`Existing errors count: ${error.length}`);
  const errorJSONContent = [...error, ...errorMessage];
  console.log(`Updated errors: ${JSON.stringify(errorJSONContent)}`);
  console.log(`Updated errors count: ${errorJSONContent.length}`);
  await uploadStatusFileAndUpdateDB({
    ...statusFileContent,
    statusFileKey,
    s3UpdateOnly: true,
    error: errorJSONContent,
  });
  console.log("Uploading errors completed");
};
export async function main(event) {
  let response;
  console.log(JSON.stringify(event));
  const {
    validatedFileKey,
    list: data,
    BuildersApiFunctionArn,
    SearchApiFunctionArn,
    ActivitiesApiFunctionArn,
    CobuyersApiFunctionArn,
    statusFileKey,
    commMappedMetro,
  } = event;
  try {
    let customerItemParam;
    const customerMessagingParams = [];
    const stageChangeActivityParams = [];
    const inteChangeActivityParams = [];
    const noteActivityParams = [];
    const {
      appid,
      isExternalAPI,
      builderOptin,
      existingEmailArr,
      emailCustomerIdObj,
    } = await getFileFromS3(validatedFileKey);

    console.log(`customers: ${JSON.stringify(data)}`);
    console.log(`existingEmailArr: ${JSON.stringify(existingEmailArr)}`);
    console.log(`emailCustomerIdObj: ${JSON.stringify(emailCustomerIdObj)}`);
    console.log(`appid: ${appid}`);
    console.log(`isExternalAPI: ${isExternalAPI}`);
    console.log(`builderOptin: ${builderOptin}`);
    console.log(`statusFileKey: ${statusFileKey}`);
    const {
      note = "",
      noteSub = "",
      email = "",
      notes_list: notesArr = [],
      cobuyer_list: cobuyerList = [],
    } = data;

    const dynamicRequiredFieldData = await getDynamicRequiredFields({pathParameters: {id: data.hb_id, type: "customer"}}, true);
    console.log(`dynamicRequiredFieldData: ${JSON.stringify(dynamicRequiredFieldData)}`);
    const customerRequiredFields = dynamicRequiredFieldData?.data[0]?.required_fields || {};
    const retVal = validateFields("customer", JSON.parse(JSON.stringify(data)), true, customerRequiredFields);
    console.log("retVal: ", retVal);
    if (!retVal) {
      const userJSON = getUserCreateJSON(data);
      // Check for data type for the array/object fields
      const isCorrectFieldTypeResp = isCorrectFieldType(userJSON, true);
      console.log(
        `isCorrectFieldTypeResp: ${JSON.stringify(isCorrectFieldTypeResp)}`
      );
      if (!isCorrectFieldTypeResp.status) {
        const errorMessage = [
          `Field type mismatch found${
            isExternalAPI
              ? ``
              : `. Please check the response file for further details.`
          }`,
        ];
        await uploadErrors({
          statusFileKey,
          errorMessage,
        });
        response = {
          status: false,
          error: errorMessage,
          field: isCorrectFieldTypeResp.field,
        };
      }

      // Do validation of UUIDs passed in the payload
      const errorsResp = await validateIdFieldsForExternal(data);
      console.log("errorsResp");
      console.log(errorsResp);
      if (errorsResp && errorsResp.msg && errorsResp.msg.length) {
        // Errors found
        await uploadErrors({
          statusFileKey,
          errorMessage: [`${errorsResp.msg[0]} for ${userJSON.email || ""}`],
        });
        return { status: false, error: errorsResp.msg };
      }
      console.log("Starting import");
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
        appid,
        optindt: userJSON.optindt,
        optoutdt: userJSON.optoutdt,
        optst: "",
        addr: userJSON.addr,
        newinte: userJSON.newinte
      };
      if (customerItem.optst) {
        if (builderOptin) customerItem.optst = "PENDING";
        else customerItem.optst = "NONE";
      } else customerItem.optst = userJSON.optst;
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
      if (isExternalAPI) {
        customerItem.gen_src = "bulk_api";
      } else {
        customerItem.gen_src = "bulk";
      }

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
      customerItem.dg = [];
      if (data.dgraph_list && data.dgraph_list.length > 0) {
        data.dgraph_list.forEach((dgraphItem) => {
          customerItem.dg.push({
            q: dgraphItem.qstn_id,
            a: dgraphItem.option_id,
          });
        });
      }
      // adding metros

      let m_id = [];
      for (const comm of userJSON.inte) {
        m_id.push(commMappedMetro[comm]);
      }
      m_id = [...new Set(m_id)];
      console.log("m_id", JSON.stringify(m_id));
      customerItem.m_id = m_id;

      if (existingEmailArr.includes(email)) {
        console.log("Customer exists. Do update.");
        // Customer exists. Do update.
        customerItem.id = emailCustomerIdObj[email]?.id || "";
        customerItem.entity = emailCustomerIdObj[email]?.entity || "";
        customerItem.data = emailCustomerIdObj[email]?.data || customerItem.id;
        console.log(`customerItem.id: ${customerItem.id}`);
        const {
          item: paramItem = null,
          oldinte = [],
          oldst = "",
        } = await getCustomerUpdateParams(customerItem);
        console.log(
          `oldinte in batchProcessExternalCreateCustomer: ${JSON.stringify(
            oldinte
          )}`
        );
        console.log(`oldst batchProcessExternalCreateCustomer: ${oldst}`);
        console.log(`customerItem: ${JSON.stringify(customerItem)}`);
        customerItemParam = paramItem;
        // Handle change activities, note creation, and messaging
        const {
          stageChangeActivityObj = null,
          inteChangeActivityObj = null,
          activityReqObjArr = null,
          messagingObj = null,
        } = handleActivitiesAndMessaging({
          stage: userJSON.stage,
          userid: crby,
          customerUUID: customerItem.id,
          hbId: userJSON.hb_id,
          isExternalAPI,
          inte: userJSON.inte,
          note,
          noteSub,
          notesArr,
          isSns: data.isSns,
          isStageOkay,
          paramItem,
          isUpdate: true,
          oldst,
          oldinte,
        });
        console.log(
          `stageChangeActivityObj: ${JSON.stringify(stageChangeActivityObj)}`
        );
        console.log(
          `inteChangeActivityObj: ${JSON.stringify(inteChangeActivityObj)}`
        );
        console.log(`activityReqObjArr: ${JSON.stringify(activityReqObjArr)}`);
        console.log(`messagingObj: ${JSON.stringify(messagingObj)}`);
        if (stageChangeActivityObj)
          stageChangeActivityParams.push(stageChangeActivityObj);
        if (inteChangeActivityObj)
          inteChangeActivityParams.push(inteChangeActivityObj);
        if (activityReqObjArr && activityReqObjArr?.length) {
          if (isExternalAPI) noteActivityParams.push(activityReqObjArr[0]);
          else {
            for (const activityReqObj of activityReqObjArr) {
              noteActivityParams.push(activityReqObj);
            }
          }
        }
        if (messagingObj) customerMessagingParams.push(messagingObj);
      } else {
        console.log("Do create customer");
        // Do create customer
        const customerUUID = uuidv4();
        const paramItem = {
          id: customerUUID,
          entity: `${userJSON.type}#${userJSON.hb_id}`,
          ...customerItem,
        };
        customerItemParam = paramItem;
        customerItem.data = customerUUID;
        // Handle change activities, note creation, and messaging
        const {
          stageChangeActivityObj = null,
          inteChangeActivityObj = null,
          activityReqObjArr = null,
          messagingObj = null,
        } = handleActivitiesAndMessaging({
          stage: userJSON.stage,
          userid: crby,
          customerUUID,
          hbId: userJSON.hb_id,
          isExternalAPI,
          inte: userJSON.inte,
          note,
          noteSub,
          notesArr,
          isSns: data.isSns,
          isStageOkay,
          paramItem,
        });
        console.log(
          `stageChangeActivityObj: ${JSON.stringify(stageChangeActivityObj)}`
        );
        console.log(
          `inteChangeActivityObj: ${JSON.stringify(inteChangeActivityObj)}`
        );
        console.log(`activityReqObjArr: ${JSON.stringify(activityReqObjArr)}`);
        console.log(`messagingObj: ${JSON.stringify(messagingObj)}`);
        if (stageChangeActivityObj)
          stageChangeActivityParams.push(stageChangeActivityObj);
        if (inteChangeActivityObj)
          inteChangeActivityParams.push(inteChangeActivityObj);
        if (activityReqObjArr && activityReqObjArr?.length) {
          if (isExternalAPI) noteActivityParams.push(activityReqObjArr[0]);
          else {
            for (const activityReqObj of activityReqObjArr) {
              noteActivityParams.push(activityReqObj);
            }
          }
        }
        if (messagingObj) customerMessagingParams.push(messagingObj);
      }
      // Save the customer to DB
      const params = {
        TableName: process.env.entitiesTableName,
        Item: customerItemParam,
      };
      console.log(params);

      let customerExistFlag = "New customer";
      if (existingEmailArr.includes(email))
        customerExistFlag = "Customer Exists";
      console.log(
        `...!......!CustomerExists Flag..........: ${customerExistFlag}`
      );

      const customerSaveResp = await postResources(params);
      console.log(`customerSaveResp: ${JSON.stringify(customerSaveResp)}`);

      response = {
        status: true,
        stageChangeActivityParams,
        inteChangeActivityParams,
        noteActivityParams,
        customerMessagingParams,
        BuildersApiFunctionArn,
        SearchApiFunctionArn,
        ActivitiesApiFunctionArn,
        CobuyersApiFunctionArn,
        customerItemParam,
        cobuyerList,
        statusFileKey,
      };
    } else {
      const errorMessage = [
        `Validation failed${
          isExternalAPI
            ? ``
            : `. Please check the response file for further details.`
        }`,
      ];
      await uploadErrors({
        statusFileKey,
        errorMessage: [`Validation failed. ${JSON.stringify(retVal)}.`],
      });
      response = {
        status: false,
        error: errorMessage,
        field: retVal,
      };
    }
  } catch (error) {
    console.log(`error`);
    console.log(error);
    response = { status: false };
  }
  return response;
}
