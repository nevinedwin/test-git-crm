import { v4 as uuidv4 } from "uuid";
import { postResources, getParamsForQuery, getResourceJSON } from "./db";

const createActivity = async (data) => {
  try {
    console.log(`data: ${JSON.stringify(data)}`);
    const {
      acti = {},
      rel_id: relId = "",
      hb_id: hbId = "",
      isSns = false,
      isHf = false,
      isLeadAPI = false,
      isZillow = false,
      isBulkAPI = false,
      isBulk = false,
    } = data;
    const { atype = "" } = acti;
    const cdt = Date.now();
    const activityUUID = uuidv4();
    acti.id = relId;
    acti.cdt = cdt;
    acti.mdt = cdt;
    acti.rel_id = relId;
    acti.type = "activity";
    acti.entity = `activity#${hbId}#${atype}#${activityUUID}`;
    acti.data = activityUUID;
    acti.hb_id = hbId;
    if (isSns) {
      if (isHf) acti.gen_src = "msg_hf";
      else acti.gen_src = "msg_brix";
    } else if (isLeadAPI) {
      acti.gen_src = "lead_api";
    } else if (isZillow) {
      acti.gen_src = "lead_zillow";
    } else if (isBulkAPI) {
      acti.gen_src = "bulk_api";
    } else if (isBulk) {
      acti.gen_src = "bulk";
    } else acti.gen_src = "app";
    const params = {
      TableName: process.env.entitiesTableName,
      Item: acti,
    };
    console.log(params);
    const createActivityResp = await postResources(params);
    return createActivityResp;
  } catch (error) {
    console.log("Exception: ");
    console.log(error);
    return error;
  }
};
export const createChangeActivity = async ({
  stage,
  oldst = "",
  oldinte = [],
  inte = [],
  userid,
  customerUUID,
  hbId,
  isSns = false,
  isHf = false,
  isLeadAPI = false,
  isZillow = false,
  isBulkAPI = false,
  isBulk = false,
  inteChange = false,
  profileChange = null
}) => {
  try {
    console.log(`stage: ${stage}`);
    console.log(`oldst: ${oldst}`);
    console.log(`oldinte: ${oldinte}`);
    console.log(`inte: ${inte}`);
    console.log(`userid: ${userid}`);
    console.log(`customerUUID: ${customerUUID}`);
    console.log(`hbId: ${hbId}`);
    console.log(`isSns: ${isSns}`);
    console.log(`isHf: ${isHf}`);
    console.log(`isLeadAPI: ${isLeadAPI}`);
    console.log(`isZillow: ${isZillow}`);
    console.log(`isBulkAPI: ${isBulkAPI}`);
    console.log(`isBulk: ${isBulk}`);
    console.log(`inteChange: ${inteChange}`);
    console.log(`profileChange: ${profileChange}`);
    const activityReqObj = {
      rel_id: customerUUID,
      hb_id: hbId,
      acti: {
        userid,
        dt: Date.now(),
      },
      isSns,
      isHf,
      isLeadAPI,
      isZillow,
      isBulkAPI,
      isBulk,
    };

    if (inteChange) {
      // Interest Change Activity
      activityReqObj.acti.oldinte = oldinte;
      activityReqObj.acti.newinte = inte;
      activityReqObj.acti.atype = "community_change";
    } else if (profileChange){
      // Profile change activity
      if (profileChange === "profile_infl" || profileChange === "profile_sa"){
        activityReqObj.acti.oldinte = oldinte;
        activityReqObj.acti.newinte = inte;
      }else if(profileChange === "profile_dg"){
        activityReqObj.acti.oldinte = oldinte;
        activityReqObj.acti.newinte = inte;
        activityReqObj.acti.newst = stage;
      }else if(profileChange === "profile_rltr"){
        activityReqObj.acti.oldinte = oldinte;
        activityReqObj.acti.newinte = inte;
        activityReqObj.acti.oldst = oldst;
        activityReqObj.acti.newst = stage;
      }else{
        activityReqObj.acti.oldst = oldst;
        activityReqObj.acti.newst = stage;
      }
      activityReqObj.acti.atype = profileChange;
    }else {
      // Stage Change Activity
      activityReqObj.acti.oldst = oldst;
      activityReqObj.acti.newst = stage;
      activityReqObj.acti.atype = "stage_change";
    }
    console.log(`activityReqObj: ${JSON.stringify(activityReqObj)}`);
    const createActResp = await createActivity(activityReqObj);
    console.log(`createActResp: ${JSON.stringify(createActResp)}`);

    // Do the customer update
    try {
      if (customerUUID && customerUUID.length > 0 && hbId && hbId.length > 0) {
        const customerDetailsParams = getParamsForQuery(
          {
            pathParameters: {
              id: customerUUID,
              hbid: hbId,
            },
          },
          "customer"
        );
        console.log("customerDetailsParams: ", customerDetailsParams);
        const customerDetailsRes = await getResourceJSON(customerDetailsParams);
        console.log("customerDetailsRes: ", customerDetailsRes);

        if (customerDetailsRes && customerDetailsRes.length > 0) {
          const isoStringDate = new Date().toISOString();
          console.log(`isoStringDate: ${JSON.stringify(isoStringDate)}`);

          const updateCustomerRowParams = {
            TableName: process.env.entitiesTableName,
            Item: {
              ...customerDetailsRes[0],
              mdt: Date.now(),
            },
          };
          if (inteChange) {
            updateCustomerRowParams.Item.inte_mdt_iso = isoStringDate;
          } else {
            updateCustomerRowParams.Item.stage_mdt_iso = isoStringDate;
          }

          console.log(
            `updateCustomerRowParams: ${JSON.stringify(
              updateCustomerRowParams
            )}`
          );

          const updateCustomerRes = await postResources(
            updateCustomerRowParams
          );
          console.log(
            `updateCustomerRes: ${JSON.stringify(updateCustomerRes)}`
          );
        }
      }
    } catch (error) {
      console.log("stage change error: ", error);
    }
  } catch (error) {
    console.log("Exception at createStageChangeActivity: ");
    console.log(error);
  }
};
