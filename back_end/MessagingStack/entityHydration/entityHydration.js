/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import {
  getHydrationParamsForQuery,
  getResourceJSON,
  getQueryPromise,
  getRecordByIdAndEntity,
} from "../../FunctionStack/libs/db";
import {
  success,
  failure,
  badRequest,
} from "../../FunctionStack/libs/response-lib";

const allowedEntities = [
  "customer",
  "realtor",
  "activity",
  "agency",
  "broker",
  "cobuyer",
];
const getQueryParams = (idArr, type) => {
  console.log(`idArr: ${JSON.stringify(idArr)}`);
  console.log(`type: ${type}`);
  const queryList = [];
  // Don't proceed if idArr is empty
  if (idArr && idArr?.length) {
    for (const id of idArr) {
      const queryParams = getHydrationParamsForQuery(
        type.includes("question") ? id.q : id,
        type
      );
      console.log(queryParams);
      queryList.push(getQueryPromise(queryParams));
    }
    console.log(`queryList: ${JSON.stringify(queryList)}`);
  }
  return queryList;
};
const getDBData = async (idObj) => {
  /* { cntm: entityDetailObj?.cntm ?? [], psrc: entityDetailObj?.psrc ?? [], inte: entityDetailObj?.inte ?? [], dg: entityDetailObj?.dg ?? [], hbid: entityDetailObj?.hb_id ?? "" } */
  const { type, hbid, cntm, psrc, inte, dg } = idObj;
  // Get the contact method details
  const cntmQueries = getQueryParams(cntm, `cntm#${hbid}`);
  console.log(`cntmQueries: ${JSON.stringify(cntmQueries)}`);
  // Get the source details
  const psrcQueries = getQueryParams(psrc, `psrc#${hbid}`);
  console.log(`psrcQueries: ${JSON.stringify(psrcQueries)}`);
  // Get the community details
  const inteQueries = getQueryParams(inte, `community#${hbid}`);
  console.log(`inteQueries: ${JSON.stringify(inteQueries)}`);
  // Get the demographics details
  const dgQueries = getQueryParams(dg, `question#${hbid}#${type}`);
  console.log(`dgQueries: ${JSON.stringify(dgQueries)}`);

  const queryList = [
    ...cntmQueries,
    ...psrcQueries,
    ...inteQueries,
    ...dgQueries,
  ];
  console.log(`queryList: ${JSON.stringify(queryList)}`);

  // Initiate the queries
  try {
    const entityDataResp = await Promise.all(queryList);
    console.log(`entityDataResp: ${JSON.stringify(entityDataResp)}`);
    const entityData = [];
    if (entityDataResp && entityDataResp.length) {
      for (const resp of entityDataResp) {
        entityData.push(...resp.Items);
      }
    }
    console.log(`entityData: ${JSON.stringify(entityData)}`);
    const formattedResponse = entityData.reduce(
      (filteredData, item) => {
        if (item.entity.includes("cntm")) {
          filteredData.cntm = item;
        } else if (item.entity.includes("psrc")) {
          filteredData.psrc = item;
        } else if (item.entity.includes("community")) {
          filteredData.inte.push(item);
        } else if (item.entity.includes("question")) {
          filteredData.dg.push(item);
        }
        return filteredData;
      },
      { psrc: {}, cntm: {}, inte: [], dg: [] }
    );
    console.log(`formattedResponse: ${JSON.stringify(formattedResponse)}`);
    return formattedResponse;
  } catch (error) {
    console.log(`error`);
    console.log(error);
    return [];
  }
};
const getEntityField = async (id, type, fieldName) => {
  if (!id) return "";
  let fieldVal = "";
  const queryParams = getHydrationParamsForQuery(
    id,
    type,
    false,
    false,
    type === "agent"
  );
  console.log(queryParams);
  try {
    const entityDetails = await getResourceJSON(queryParams);
    if (entityDetails && entityDetails.length) {
      if (type === "cobuyer") {
        fieldVal = [];
        for (const entityDetail of entityDetails) {
          fieldVal.push(entityDetail[fieldName]);
        }
      } else {
        fieldVal = entityDetails[0][fieldName]
          ? entityDetails[0][fieldName]
          : "";
      }
    }
    return fieldVal;
  } catch (error) {
    return fieldVal;
  }
};
const getDemographics = (demographicsArr, customerDemographics) => {
  const demographics = demographicsArr.map((item) => {
    const values = [];
    // Get demographics answers (qstn_options) and demographics text (qstn_text) from question resource
    const { qstn_options: qstnOptions, qstn_text: qstnText } = item;
    // Loop through customer's demographics
    for (const demographic of customerDemographics) {
      // Extract the customer's demographics answer id array
      const answers = demographic?.a ?? [];
      // Check whether the customer's demographic id matches the currently mapped item's id
      if (demographic.q === item.id) {
        // Loop through the customer's demographic answers
        for (const answer of answers) {
          // Loop through the question resource's available question answers
          for (const qstnValue of qstnOptions) {
            // Find the matching name of the customer's demographic answer
            if (qstnValue.id === answer) {
              // Push the name of the demographic value to the values array
              values.push(qstnValue.name);
              break;
            }
          }
        }
      }
    }
    return { demographic: qstnText, values };
  });
  return demographics;
};
const getCommonFields = async (entityDetailObj, type) => {
  const entityObj = {};
  entityObj.FirstName = entityDetailObj?.fname ?? "";
  entityObj.LastName = entityDetailObj?.lname ?? "";
  entityObj.Email = entityDetailObj?.email ?? "";
  entityObj.Phone = entityDetailObj?.phone ?? "";

  // Get the string values of the below entities and send it with the response
  // This approach is for the initial pass of the Homefront messaging.
  // Will need to be converted to id mapping just as in the case of community and project number for BRIX
  const {
    cntm = "",
    psrc = "",
    inte = [],
    dg = [],
    hb_id: hbid = "",
  } = entityDetailObj;
  const paramObj = { dg, hbid, type };
  if (cntm) paramObj.cntm = [cntm];
  if (psrc) paramObj.psrc = [psrc];
  if (inte) paramObj.inte = inte;
  console.log(`paramObj: ${JSON.stringify(paramObj)}`);
  const getDBDataResp = await getDBData(paramObj);
  const contactMethod = getDBDataResp?.cntm?.name ?? "";
  const source = getDBDataResp?.psrc?.name ?? "";
  const communities =
    getDBDataResp?.inte?.map((item) => {
      const obj = {
        name: item.name,
        projectNumber: "",
      };
      if (item?.pjct_no) {
        if (typeof item.pjct_no === "object") obj.projectNumber = "";
        else obj.projectNumber = item?.pjct_no;
      }
      return obj;
    }) ?? [];
  const demographics = getDemographics(getDBDataResp?.dg, dg) ?? [];
  if (contactMethod) entityObj.ContactMethod = contactMethod;
  if (source) entityObj.Source = source;
  if (communities) entityObj.CommunityInterests = communities;
  if (demographics) entityObj.Demographics = demographics;
  console.log(`Common Field Values: ${JSON.stringify(entityObj)}`);
  return entityObj;
};
const getEntity = async (id, type, correlationId) => {
  let response = {};
  // Check whether the type of entity requested is allowed to be hydrated
  if (allowedEntities.includes(type)) {
    const isDataCall = !!(
      type.includes("activity") || type.includes("cobuyer")
    );
    const params = getHydrationParamsForQuery(id, type, isDataCall);
    const entityDetails = await getResourceJSON(params);
    console.log(`entityDetails: ${JSON.stringify(entityDetails)}`);
    if (entityDetails && entityDetails.length) {
      const entityDetailObj = entityDetails[0];
      console.log(`entityDetailObj: ${JSON.stringify(entityDetailObj)}`);
      let entityObj = {};
      if (type === "customer") {
        entityObj.Id = entityDetailObj?.id ?? "";
        entityObj.Stage = entityDetailObj?.stage ?? "";
        const commonFields = await getCommonFields(entityDetailObj, type);
        entityObj = { ...entityObj, ...commonFields };
        if (entityDetailObj?.rltr?.id) {
          entityObj.Realtor = {
            entityId: entityDetailObj.rltr.data,
            entityType: "realtor",
          };
        }
        // Get the cobuyers
        const cobuyersList = await getEntityField(
          entityObj.Id,
          "cobuyer",
          "data"
        );
        console.log(`cobuyersList: ${JSON.stringify(cobuyersList)}`);
        if (cobuyersList.length) {
          entityObj.Cobuyers = [];
          for (const cobuyerId of cobuyersList) {
            entityObj.Cobuyers.push({
              entityId: cobuyerId,
              entityType: "cobuyer",
            });
          }
        }

        // // Get the Project Numbers of Customer's Interests
        // const interests = entityDetails[0].inte ? entityDetails[0].inte : [];
        // const hb_id = entityDetails[0].hb_id ? entityDetails[0].hb_id : '';
        // if (interests && interests.length) {
        //     const params = {
        //         RequestItems: { /* required */
        //             [process.env.entitiesTableName]: {
        //                 Keys: [],
        //                 AttributesToGet: [
        //                     'pjct_no'
        //                 ]
        //             }
        //         }
        //     };
        //     for (let interestId of interests) {
        //         params.RequestItems[process.env.entitiesTableName].Keys.push({
        //             id: interestId,
        //             entity: `community#${hb_id}`
        //         });
        //     }
        //     console.log('params: ', JSON.stringify(params));
        //     const projectNumbersResp = await batchGetResources(params, true);
        //     const projectNumbersBody = projectNumbersResp && projectNumbersResp.statusCode === 200 && projectNumbersResp.body ? JSON.parse(projectNumbersResp.body) : [];
        //     const projectNumbers = projectNumbersBody.map(projectNumber => projectNumber.pjct_no);
        //     console.log('projectNumbers: ', projectNumbers);
        // }
        // // Customer Details Found
        // // ProjectNumber: customerDetails[0].brixprojno,
        // // Convert the CRM Stage to BRIX Stage
        // let brixStage;
        // switch (customerDetails[0].stage) {
        //     case 'Lead': brixStage = 'T';
        //         break;
        //     case 'Prospect': brixStage = 'P';
        //         break;
        //     case 'Buyer': brixStage = 'B';
        //         break;
        //     case 'Bust_Out': brixStage = 'O';
        //         break;
        //     case 'Closed': brixStage = 'C';
        //         break;
        //     case 'Dead_Lead': brixStage = 'D';
        //         break;
        // }
      } else if (type === "realtor") {
        entityObj.Id = entityDetailObj?.id ?? "";
        entityObj.FirstName = entityDetailObj?.fname ?? "";
        entityObj.LastName = entityDetailObj?.lname ?? "";
        entityObj.Email = entityDetailObj?.email ?? "";
        entityObj.Phone = entityDetailObj?.phone ?? "";
        // Get the string values of the below entities and send it with the response
        // This approach is for the initial pass of the Homefront messaging.
        // Will need to be converted to id mapping just as in the case of community and project number for BRIX
        const {
          cntm = "",
          psrc = "",
          hb_id: hbid = "",
          rel_id = "",
        } = entityDetailObj;
        const getDBDataResp = await getDBData({
          cntm: [cntm],
          psrc: [psrc],
          hbid,
          type,
        });
        entityObj.ContactMethod = getDBDataResp?.cntm?.name ?? "";
        entityObj.Source = getDBDataResp?.psrc?.name ?? "";
        entityObj.Agency = { entityId: rel_id, entityType: "agency" };
        entityObj.Broker = { entityId: rel_id, entityType: "broker" };
      } else if (type === "activity") {
        const activityType = entityDetailObj?.atype ?? "";
        const duration = entityDetailObj?.dur ?? 0;
        // "data" field contains the activity uuid
        entityObj.Id = entityDetailObj?.data ?? "";

        // "id" field contains the parent uuid. Customer/Realtor/Cobuyer
        entityObj.RelationshipId = entityDetailObj?.id ?? "";

        entityObj.Subject = entityDetailObj?.sub ?? "";
        entityObj.Body = entityDetailObj?.note ?? "";
        entityObj.ActivityType = activityType;

        // Get the customer details for the homefront opportunity id
        const customerDetailParams = getHydrationParamsForQuery(
          entityObj.RelationshipId,
          "customer",
          false
        );
        const customerDetails = await getResourceJSON(customerDetailParams);
        console.log(`customerDetails: ${JSON.stringify(customerDetails)}`);
        if (customerDetails?.length) {
          entityObj.RelationshipId_HF = customerDetails[0]?.hfid || null;
        } else {
          entityObj.RelationshipId_HF = null;
        }

        if (activityType === "appointment") {
          // Assigned to field "wit" is a uuid which points to a user
          // In the hydration response we need to pass in the email address
          const assignedTo = entityDetailObj?.wit ?? "";
          const assignedToEmail = await getEntityField(
            assignedTo,
            "agent",
            "email"
          );
          entityObj.UserAssigned = assignedToEmail;

          const communityId = entityDetailObj?.loc ?? "";
          const communityName = await getEntityField(
            communityId,
            "community",
            "name"
          );
          entityObj.Location = communityName;
        } else if (activityType === "task") {
          // Assigned to field "assi" is a uuid which points to a user
          // In the hydration response we need to pass in the email address
          const assignedTo = entityDetailObj?.assi ?? "";
          const assignedToEmail = await getEntityField(
            assignedTo,
            "agent",
            "email"
          );
          entityObj.UserAssigned = assignedToEmail;
        }
        if (duration) {
          entityObj.Duration = duration;
        }
        entityObj.Start =
          (entityDetailObj?.dt && new Date(entityDetailObj.dt).toISOString()) ??
          0;
      } else if (type === "agency") {
        entityObj.Id = entityDetailObj?.id ?? "";
        entityObj.CompanyName = entityDetailObj?.cname ?? "";
        entityObj.TeamName = entityDetailObj?.tname ?? "";
        /* const testObj = {
                    "id": "26a238a8-2c55-47a5-98f9-47282d61eab0",
                    "entity": "agency#aedc334e-fa9a-443e-9af7-8ed6104a888f",
                    "gen_src": "app",
                    "hb_id": "aedc334e-fa9a-443e-9af7-8ed6104a888f",
                    "dg": [
                        {
                            "q": "3ceb4ca6-bd00-4f57-8f54-957a68496684",
                            "a": [
                                "jyPekwJhEF"
                            ]
                        }
                    ],
                    "m_id": [
                        "fb7c47af-2d96-473f-afdf-ac4b5ed86122",
                        "fa011a2e-213d-4a97-8326-a1468c6c5ca0"
                    ],
                    "stat": "active",
                    "cdt": 1619069523966,
                    "tname": "Agency 1",
                    "data": "agency#aedc334e-fa9a-443e-9af7-8ed6104a888f",
                    "cname": "Company 1",
                    "mdt": 1619069523966,
                    "type": "agency"
                }; */
      } else if (type === "broker") {
        const entity = entityDetailObj?.entity ?? "";
        const entitySplit = entity ? entity.split("#") : [];
        const brokerUUID =
          entitySplit.length && entitySplit.length === 3 ? entitySplit[2] : "";
        entityObj.Id = brokerUUID;
        entityObj.FirstName = entityDetailObj?.fname ?? "";
        entityObj.LastName = entityDetailObj?.lname ?? "";
        entityObj.Email = entityDetailObj?.email ?? "";
        entityObj.AgencyId = entityDetailObj?.id ?? "";
        /* const testObj = {
                    "id": "26a238a8-2c55-47a5-98f9-47282d61eab0",
                    "entity": "broker#aedc334e-fa9a-443e-9af7-8ed6104a888f#a17720de-2050-4416-b3b0-7ce258b148b1",
                    "hb_id": "aedc334e-fa9a-443e-9af7-8ed6104a888f",
                    "lname": "`",
                    "email": "broker1@sales-crm.com",
                    "stat": "active",
                    "rel_id": "26a238a8-2c55-47a5-98f9-47282d61eab0",
                    "cdt": 1619069523967,
                    "fname": "Broker",
                    "data": "agency#aedc334e-fa9a-443e-9af7-8ed6104a888f",
                    "spec": [
                        "bc24eb73-56fd-4286-a0de-6f0457fe6ae2"
                    ],
                    "phone": "(214) 342-5324",
                    "mdt": 1619069523967,
                    "type": "broker"
                }; */
      } else if (type === "cobuyer") {
        // "data" field contains the cobuyer uuid
        entityObj.Id = entityDetailObj?.data ?? "";

        // "id" field contains the customer uuid
        entityObj.CustomerId = entityDetailObj?.id ?? "";

        const commonFields = await getCommonFields(entityDetailObj, type);
        entityObj = { ...entityObj, ...commonFields };
        /* const testObj = {
                    "id": "9c90d04a-d25b-4792-9518-1a4a0c2bec02",
                    "entity": "cobuyer#9c78aca0-c301-42ce-90c1-2ccb7a8ab758#9b765fae-077e-4f71-bc00-022ce1b40efc",
                    "optindt": 1619589106729,
                    "hb_id": "9c78aca0-c301-42ce-90c1-2ccb7a8ab758",
                    "dg": [
                        {
                            "q": "7e33b43a-9192-48e5-bbe1-a5e3c14b7638",
                            "a": [
                                "3ZPYq6WMAu"
                            ]
                        },
                        {
                            "q": "940754dd-7de4-4774-b6dd-5f59fbbbcdab",
                            "a": [
                                "VzWJTme0ms"
                            ]
                        },
                        {
                            "q": "671c7b2c-949c-40c9-afaf-8a6c877008b8",
                            "a": [
                                "cblQIWDxPY"
                            ]
                        }
                    ],
                    "inte": [
                        "32b4efd6-2a63-4c31-b268-11193dc211ae",
                        "fb961981-ee0b-421b-b4d6-920a45fdfaea"
                    ],
                    "optoutdt": 0,
                    "lname": "2",
                    "email": "cobuyer2@sales-crm.com",
                    "rel_id": "9c90d04a-d25b-4792-9518-1a4a0c2bec02",
                    "cdt": 1619589106729,
                    "infl": [
                        "07233a52-ac42-4fb8-a6d3-619d8ca56e57",
                        "89998ad6-1f2c-415a-b8d9-738084ac8e02"
                    ],
                    "fname": "Cobuyer",
                    "data": "9b765fae-077e-4f71-bc00-022ce1b40efc",
                    "optst": "NONE",
                    "cntm": "8bd85be7-bf17-4d10-bd78-03a9d0ea25d6",
                    "appid": "2e026e57792b4525bbdb9c6adc1b3ca5",
                    "phone": "(124) 124-1243",
                    "mdt": 1619589106729,
                    "type": "cobuyer"
                }; */
      }
      const {
        hb_id: hbId,
        hfid,
        hfhbid: hfhbidCustomer = "",
        crby = "",
      } = entityDetails[0];
      // Get the hfhbid from the builder detail
      const builderDetails = await getRecordByIdAndEntity(hbId, `builder`);
      console.log(`builderDetails: ${JSON.stringify(builderDetails)}`);
      const hfhbid =
        builderDetails && builderDetails.length && builderDetails[0]?.hfhbid
          ? builderDetails[0]?.hfhbid
          : hfhbidCustomer || null;
      console.log(`hfhbid: ${hfhbid}`);

      // Get sales agent email if crby exists
      let salesAgent = null;
      if (crby) {
        salesAgent = await getEntityField(crby, "agent", "email");
        console.log(`salesAgent: ${salesAgent}`);
      }
      // HomebuilderID_HF – Home builder id in Homefront
      // HomebuilderID – Home builder id in CRM (already provided)
      response = {
        header: {
          params: {
            entityId: id,
          },
          otherinfo: {
            correlationId,
          },
        },
        result: [
          {
            HomebuilderID: hbId,
            HomebuilderID_HF: hfhbid,
            Id_HF: hfid,
            SalesAgent: salesAgent,
            ...entityObj,
          },
        ],
      };
      console.log(`hydration response: ${JSON.stringify(response)}`);
      return success(response);
    }

    // Entity doesn't exist
    response = {
      errorText: "Entity does not exist.",
      correlationId,
    };
    return badRequest(response);
  }

  response = {
    errorText: "Invalid entity type requested.",
    correlationId,
  };
  return badRequest(response);
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

export async function main(event, context) {
  let response;
  try {
    console.log(`event: ${JSON.stringify(event)}`);
    if (event.source !== "aws.events") {
      const body = JSON.parse(event?.body ?? "{}");
      const { entityId = "", entityType: type = "" } = body;
      const correlationId = context.awsRequestId;
      console.log(`entityId: ${entityId}`);
      console.log(`type: ${type}`);
      console.log(`correlationId: ${correlationId}`);
      response = await getEntity(entityId, type, correlationId);
    }
  } catch (err) {
    console.log(err);
    return failure({ status: false, error: err });
  }
  return response;
}
