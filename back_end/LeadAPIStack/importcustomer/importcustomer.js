/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import { v4 as uuidv4 } from "uuid";
import {
  postResources,
  getParamsForQuery,
  getResourceJSON,
  getUserCreateJSON,
  isCorrectFieldType,
} from "../../FunctionStack/libs/db";
import {
  validateFields,
  validateIdFieldsForExternal,
} from "../../FunctionStack/validation/validation";
import { getEntities } from "../../FunctionStack/endpointcount/endpointcount";
import { getCommunityBasedOnProjNo } from "../../FunctionStack/communities/communities";
import { aggregate } from "../../FunctionStack/search/search";
import { createNoteActivity } from "../../FunctionStack/activities/activities";
import { createChangeActivity } from "../../FunctionStack/libs/change-activity";
import utils from "../../FunctionStack/libs/utils";
import { getDynamicRequiredFields } from "../../FunctionStack/dynamicRequiredFields/dynamicRequiredFields";

const saveLastLead = async (obj) => {
  const { hbid, leadid } = obj;
  const type = "lastlead";
  const updatedDate = Date.now();
  let id = uuidv4();
  let creationDate = Date.now();
  // Decide whether it is create or update
  // Fetch lastlead resource for the home builder
  const lastLeadResource = await getEntities(`${type}#${hbid}`);
  console.log(`lastLeadResource: ${JSON.stringify(lastLeadResource)}`);
  if (lastLeadResource && lastLeadResource.length) {
    // Already exists
    id = lastLeadResource[0].id;
    creationDate = lastLeadResource[0].cdt;
  }
  const params = {
    TableName: process.env.entitiesTableName,
    Item: {
      id,
      type,
      entity: `${type}#${hbid}`,
      data: type,
      leadid,
      cdt: creationDate,
      mdt: updatedDate,
    },
  };
  console.log(params);
  return postResources(params);
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
const doesEmailExist = async (emailArray, hbId) => {
  try {
    // Elastic query to validate the request email ids
    const queryReqObj = {
      httpMethod: "POST",
      requestPath: "/_search",
      payload: {
        query: {
          bool: {
            must: [
              {
                terms: {
                  "email.keyword": emailArray,
                },
              },
              {
                match: {
                  "type.keyword": "customer",
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
    const validateEmailResp = await aggregate(queryReqObj, true);
    console.log(`validateEmailResp: ${JSON.stringify(validateEmailResp)}`);

    if (validateEmailResp && validateEmailResp.status) {
      return { status: true, data: validateEmailResp.body.hits.hits };
    }

    // Error occured in validate API
    return validateEmailResp;
  } catch (error) {
    console.log(`Exception doesEmailExists: ${JSON.stringify(error)}`);
    return { status: false, error };
  }
};
const getCustomerDetails = async (hbid, id) => {
  const params = getParamsForQuery(
    {
      pathParameters: { id, hbid },
    },
    "customer"
  );
  return getResourceJSON(params);
};
const updateCustomerRow = async (customerItem) => {
  console.log("customerItem: ", customerItem);
  const params = {
    TableName: process.env.entitiesTableName,
    Item: {
      type: customerItem.type,
      hb_id: customerItem.hb_id,
      fname: customerItem.fname,
      lname: customerItem.lname,
      email: customerItem.email,
      stage: customerItem.stage,
      appid: customerItem.appid,
      phone: customerItem.phone,
      psrc: customerItem.psrc,
      infl: customerItem.infl,
      entity: `customer#${customerItem.hb_id}`,
      id: customerItem.id,
      // gen_src: "lead_api",
    },
  };
  console.log(`params: ${JSON.stringify(params)}`);
  // Get the Customer Details
  const customerDetails = await getCustomerDetails(
    customerItem.hb_id,
    customerItem.id
  );
  console.log("customerDetails: ", customerDetails);
  const customerId =
    customerDetails && customerDetails.length ? customerDetails[0].id : "";
  const cdt =
    customerDetails && customerDetails.length ? customerDetails[0].cdt : "";
  const jdt =
    customerDetails && customerDetails.length ? customerDetails[0].jdt : "";
  const inte =
    customerDetails && customerDetails.length ? customerDetails[0].inte : [];
  const commNumber =
    customerDetails && customerDetails.length
      ? customerDetails[0].commNumber
      : [];
  params.Item.id = customerId;
  params.Item.cdt = cdt;
  params.Item.mdt = Date.now();
  params.Item.jdt = jdt;
  params.Item.inte = [...new Set([...inte, ...customerItem.inte])];
  params.Item.commNumber = [
    ...new Set([...commNumber, ...customerItem.commNumber]),
  ];
  console.log("params: ", params);
  const updateCustomerResp = await postResources(params);
  const changedInterests = utils.findArraySymmetricDifference(
    inte,
    customerItem.inte
  );
  console.log(`changedInterests: ${JSON.stringify(changedInterests)}`);
  if (changedInterests.removed.length) {
    // Create interest activity change
    await createChangeActivity({
      inte: params.Item.inte,
      oldinte: inte,
      userid: "",
      customerUUID: customerId,
      hbId: customerItem.hb_id,
      inteChange: true,
      isLeadAPI: true,
    });
  }
  return updateCustomerResp;
};

const importCustomer = async (data) => {
  try {
    let customerCreateItem;
    let createCustomerResp;
    let customerUUID;
    const { leadid, reqdate, commNumber, email, hb_id: hbId, appid } = data;
    let {
      ext_psrc: extPsrc = "",
      ext_infl: extInfl = "",
      comments = "",
      ext_cmt_to_note_sub: extCmtToNoteSub = "",
      ext_cmt_to_note: extCmtToNote = false,
    } = data;
    try {
      extPsrc = data.ext_psrc;
      extInfl = data.ext_infl;
      comments = data.comments;
      extCmtToNoteSub = data.ext_cmt_to_note_sub;
      extCmtToNote = data.ext_cmt_to_note;
    } catch (error) {
      console.log(`setData Error: ${JSON.stringify(error.stack)}`);
    }
    console.log(`ext_psrc: ${extPsrc}`);
    console.log(`ext_infl: ${extInfl}`);
    console.log(`comments: ${comments}`);
    console.log(`ext_cmt_to_note: ${extCmtToNoteSub}`);
    console.log(`ext_cmt_to_note_sub: ${extCmtToNote}`);
    // Check whether the email addresses in the request does not exist in the application
    const existingEmailArrayResp = await doesEmailExist(
      [email.toLowerCase()],
      hbId
    );
    console.log(
      `existingEmailArrayResp: ${JSON.stringify(existingEmailArrayResp)}`
    );
    const dynamicRequiredFieldData = await getDynamicRequiredFields({pathParameters: {id: hbId, type: "customer"}}, true);
    console.log(`dynamicRequiredFieldData: ${JSON.stringify(dynamicRequiredFieldData)}`);
    const customerRequiredFields = dynamicRequiredFieldData?.data[0]?.required_fields || {};
    const retVal = validateFields(
      "customer",
      JSON.parse(JSON.stringify(data)),
      true,
      customerRequiredFields
    );
    console.log("retVal: ", retVal);
    if (retVal === "") {
      const userJSON = getUserCreateJSON(data);
      // Check for data type for the array/object fields
      const isCorrectFieldTypeResp = isCorrectFieldType(userJSON, true);
      console.log(
        `isCorrectFieldTypeResp: ${JSON.stringify(isCorrectFieldTypeResp)}`
      );
      if (!isCorrectFieldTypeResp.status) {
        return {
          error: {
            msg: `Field type mismatch found`,
            field: isCorrectFieldTypeResp.field,
          },
        };
      }

      // Do validation of UUIDs passed in the payload
      const errorsResp = await validateIdFieldsForExternal(data, true);
      if (errorsResp && errorsResp.msg && errorsResp.msg.length) {
        // Errors found
        return { error: errorsResp };
      }

      // Proceed with the create operation
      const customerItem = {
        type: userJSON.type,
        hb_id: userJSON.hb_id,
        fname: userJSON.fname,
        lname: userJSON.lname,
        email: userJSON.email,
        jdt: userJSON.jdt,
        mdt: userJSON.mod_dt,
        cdt: userJSON.cdt,
        stage: userJSON.stage,
        appid,
      };
      // Setting non-mandatory fields based on it's availability
      if (userJSON.phone) {
        customerItem.phone = userJSON.phone;
      }
      customerItem.gen_src = "lead_api";
      customerItem.leadId = leadid;
      customerItem.reqdate = reqdate;

      // Get the interests based on community number
      const interestArrResp = await getInterestsForProjNo(
        commNumber,
        userJSON.hb_id
      );
      const interestArr = interestArrResp.reduce((idArr, community) => {
        if (community.id) {
          idArr.push(community.id);
        }
        return idArr;
      }, []);
      console.info("interestArr: ", JSON.stringify(interestArr));
      customerItem.inte = interestArr;
      customerItem.commNumber = commNumber;

      try {
        if (extPsrc && extPsrc.length) {
          customerItem.psrc = extPsrc;
        }
        if (extInfl && extInfl.length) {
          customerItem.infl = extInfl;
        }
      } catch (error) {
        console.log(`infl psrc error: ${JSON.stringify(error.stack)}`);
      }

      if (
        existingEmailArrayResp.status &&
        existingEmailArrayResp.data &&
        existingEmailArrayResp.data.length
      ) {
        // Do update
        const customerIdArr = [
          ...new Set(
            existingEmailArrayResp.data.map((customer) => customer._source.id)
          ),
        ];
        console.log(`customerIdArr: ${JSON.stringify(customerIdArr)}`);
        [customerUUID] = customerIdArr;
        customerItem.id = customerUUID;
        createCustomerResp = await updateCustomerRow(customerItem);
        console.log(
          `createCustomerResp: ${JSON.stringify(createCustomerResp)}`
        );
      } else {
        // Do create
        customerUUID = uuidv4();
        customerCreateItem = {
          id: customerUUID,
          entity: `${userJSON.type}#${userJSON.hb_id}`,
          ...customerItem,
        };
        customerItem.data = customerUUID;
        console.log(`customerItem: ${JSON.stringify(customerItem)}`);
        createCustomerResp = await postResources({
          TableName: process.env.entitiesTableName,
          Item: customerCreateItem,
        });
        console.log(
          `createCustomerResp: ${JSON.stringify(createCustomerResp)}`
        );

        // Create stage change activity
        await createChangeActivity({
          stage: userJSON.stage,
          userid: "",
          customerUUID,
          hbId,
          isLeadAPI: true,
        });

        if (customerItem.inte.length) {
          // Create interest activity change
          await createChangeActivity({
            inte: customerItem.inte,
            userid: "",
            customerUUID,
            hbId,
            inteChange: true,
            isLeadAPI: true,
          });
        }
      }
      const noteActivityResp = await createNoteActivity({
        comments,
        note: extCmtToNote,
        subject: extCmtToNoteSub,
        customerUUID,
        hb_id: userJSON.hb_id,
        isLeadAPI: true,
      });
      console.log(`noteActivityResp: ${JSON.stringify(noteActivityResp)}`);

      // Save the LeadID as the last lead id in the db for this builder
      const saveLeadIdResp = await saveLastLead({ hbid: hbId, leadid });
      console.log(`saveLeadIdResp: ${JSON.stringify(saveLeadIdResp)}`);
      return {
        status: true,
        resp: createCustomerResp,
        lastProcessedLeadId: leadid,
      };
    }
    return {
      status: false,
      error: { msg: `Validation failed`, field: retVal },
    };
  } catch (error) {
    console.log(
      `Exception occured on bulk customer creation: ${JSON.stringify(error)}`
    );
    return { status: false, error };
  }
};
export async function main(event) {
  console.log(JSON.stringify(event));
  // Do import
  const customerImportResp = await importCustomer(event);
  console.log(`customerImportResp: ${JSON.stringify(customerImportResp)}`);
  return {
    lastProcessedLeadId: customerImportResp.lastProcessedLeadId,
    time: Date.now(),
  };
  // return true;
}
