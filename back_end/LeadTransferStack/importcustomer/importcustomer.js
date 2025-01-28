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
import { getCommunityBasedOnProjNo } from "../../FunctionStack/communities/communities";
import { aggregate } from "../../FunctionStack/search/search";
import { createNoteActivity } from "../../FunctionStack/activities/activities";
import { createChangeActivity } from "../../FunctionStack/libs/change-activity";
import utils from "../../FunctionStack/libs/utils";
import { getDynamicRequiredFields } from "../../FunctionStack/dynamicRequiredFields/dynamicRequiredFields";

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
    console.log(`queryReqObj: ${JSON.stringify(queryReqObj)}`);
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
      // gen_src: "lead_zillow",
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
  const communitynumber =
    (customerDetails?.length && customerDetails[0]?.communitynumber) || [];
  params.Item.id = customerId;
  params.Item.cdt = cdt;
  params.Item.mdt = Date.now();
  params.Item.jdt = jdt;
  params.Item.inte = [...new Set([...inte, ...customerItem.inte])];
  params.Item.communitynumber = [
    ...new Set([...communitynumber, ...customerItem.communitynumber]),
  ];
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
      isZillow: true,
    });
  }
  return updateCustomerResp;
};
const importCustomer = async (data) => {
  try {
    let customerCreateItem;
    let saveCustomerResp;
    let customerUUID;
    const { commNumber, email, hb_id: hbId, appid, submitDate } = data;
    let {
      zillow_psrc: zillowPsrc = "",
      zillow_infl: zillowInfl = "",
      comments = "",
      zillow_cmt_to_note_sub: zillowCmtToNoteSub = "",
      zillow_cmt_to_note: zillowCmtToNote = false,
    } = data;
    try {
      zillowPsrc = data.zillow_psrc;
      zillowInfl = data.zillow_infl;
      comments = data.comments;
      zillowCmtToNoteSub = data.zillow_cmt_to_note_sub;
      zillowCmtToNote = data.zillow_cmt_to_note;
    } catch (error) {
      console.log(`setData Error: ${JSON.stringify(error.stack)}`);
    }
    console.log(`zillow_psrc: ${zillowPsrc}`);
    console.log(`zillow_infl: ${zillowInfl}`);
    console.log(`comments: ${comments}`);
    console.log(`zillow_cmt_to_note: ${zillowCmtToNote}`);
    console.log(`zillow_cmt_to_note_sub: ${zillowCmtToNoteSub}`);
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
      customerItem.gen_src = "lead_zillow";
      customerItem.submitDate = submitDate;

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
      // Saving the communitynumber from the xml
      customerItem.communitynumber = commNumber;

      try {
        if (zillowPsrc && zillowPsrc.length) {
          customerItem.psrc = zillowPsrc;
        }
        if (zillowInfl && zillowInfl.length) {
          customerItem.infl = zillowInfl;
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
        saveCustomerResp = await updateCustomerRow(customerItem);
        console.log(`saveCustomerResp: ${JSON.stringify(saveCustomerResp)}`);
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
        saveCustomerResp = await postResources({
          TableName: process.env.entitiesTableName,
          Item: customerCreateItem,
        });
        console.log(`saveCustomerResp: ${JSON.stringify(saveCustomerResp)}`);

        // Create stage change activity
        await createChangeActivity({
          stage: userJSON.stage,
          userid: "",
          customerUUID,
          hbId,
          isZillow: true,
        });

        if (customerItem.inte.length) {
          // Create interest activity change
          await createChangeActivity({
            inte: customerItem.inte,
            userid: "",
            customerUUID,
            hbId,
            inteChange: true,
            isZillow: true,
          });
        }
      }
      const noteActivityResp = await createNoteActivity({
        comments,
        note: zillowCmtToNote,
        subject: zillowCmtToNoteSub,
        customerUUID,
        hb_id: userJSON.hb_id,
        isZillow: true,
      });
      console.log(`noteActivityResp: ${JSON.stringify(noteActivityResp)}`);
      return {
        status: true,
        data: saveCustomerResp,
      };
    }
    return {
      status: false,
      error: { msg: `Validation failed`, field: retVal },
    };
  } catch (error) {
    console.log("Exception occured on bulk customer creation");
    console.log(error);
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
}
