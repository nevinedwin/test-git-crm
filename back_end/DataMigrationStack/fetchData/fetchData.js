import { elasticExecuteQuery } from "../../FunctionStack/search/search";
import { getAgencyBrokersElastic } from "../../FunctionStack/agencies/agencies";
import {
  getFileFromS3,
  uploadExportStatusToS3,
} from "../initExport/initExport";

const fetchData = async ({ hbId,size,purpose,nextIndexVal }) => {
  try {
    const dataQuery = {
      httpMethod: "POST",
      requestPath: "/_search",
      payload: {
        query: {
          bool: {
            must: [
              {
                match: {
                  "entity.keyword":
                    purpose === "exportCustomer"
                      ? `customer#${hbId}`
                      : `realtor#${hbId}`,
                },
              },
            ],
          },
        },
        search_after: nextIndexVal || undefined,
        size,
        sort: [
          {
            "id.keyword": {
              order: "asc"
            }
          }
        ]
      },
    };

    console.log(`dataQuery: ${dataQuery}`);
    const resp = await elasticExecuteQuery(dataQuery, true);
    console.log(`dataQuery resp: ${JSON.stringify(resp)}`);

    if (
      resp &&
      resp.statusCode === 200 &&
      resp.body &&
      resp.body.hits &&
      resp.body.hits.hits
    ) {
      const { hits } = resp.body.hits;
      const resultLength = hits.length;
      const nextIndexValue = hits[resultLength - 1]?.sort
      const totalResults = resp.body.hits.total;
      console.log(`resultLength: ${resultLength}`);
      console.log(`totalResults: ${totalResults}`);
      const list = resultLength
        ? hits.map((rel) => {
            const respObj = {
              ...rel._source,
            };
            return respObj;
          })
        : [];
        return { status: true, list, error: "", nextIndexValue };
    }
    return {
      status: false,
      list: [],
      error: "Ellastic db fetching failed",
    };
  } catch (error) {
    console.log("error in fetchData", JSON.stringify(error.stack));
    return { status: false, list: [], error: error.message };
  }
};

const fetchAgencyData = async (agencyIdArr, hbId) => {
  try {
    const agencyQuery = {
      httpMethod: "POST",
      requestPath: "/_search",
      payload: {
        query: {
          bool: {
            must: [
              {
                terms: {
                  "id.keyword": agencyIdArr,
                },
              },
              {
                match: {
                  "entity.keyword": `agency#${hbId}`,
                },
              },
            ],
          },
        },
        size: agencyIdArr.length || 2500,
        _source: ["m_id", "id", "entity"],
      },
    };

    console.log(`agencyQuery: ${JSON.stringify(agencyQuery)}`);
    const resp = await elasticExecuteQuery(agencyQuery, true);
    console.log(`agencyQuery resp: ${JSON.stringify(resp)}`);

    if (
      resp &&
      resp.statusCode === 200 &&
      resp.body &&
      resp.body.hits &&
      resp.body.hits.hits
    ) {
      const { hits } = resp.body.hits;
      const resultLength = hits.length;
      const totalResults = resp.body.hits.total;
      console.log(`resultLength: ${resultLength}`);
      console.log(`totalResults: ${totalResults}`);
      const agencies = resultLength
        ? hits.map((rel) => {
            const respObj = {
              ...rel._source,
            };
            return respObj;
          })
        : [];

      const brokersResult = await getAgencyBrokersElastic({
        hbId,
        agencyIds: agencyIdArr,
      });
      console.log(`brokersResult: ${JSON.stringify(brokersResult)}`);
      const { status, data: brokers } = brokersResult;
      console.log(`brokers: ${JSON.stringify(brokers)}`);
      if (status) {
        // Combine the agency and broker resources
        let agencyArr = [];
        if (agencies.length) {
          agencyArr = agencies.map((agencyObj) => {
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
        return {
          status: !!agencyArr.length,
          list: agencyArr,
          error: agencyArr.length ? "" : "Agency list fetching failed",
        };
      }
      return {
        status: false,
        list: [],
        error: "broker Ellastic db fetching failed",
      };
    }
    return {
      status: false,
      list: [],
      error: "agency Ellastic db fetching failed",
    };
  } catch (error) {
    console.log("error in fetchAgencyData", JSON.stringify(error.stack));
    return { status: false, list: [], error: error.message };
  }
};

const flattenArrayToString = (data = [], list = {}) => {
  let str = "";
  const strArr = data.length
    ? data.reduce((acc, crr, index) => {
        if (crr) {
          acc[index] = list[crr] || "";
        }
        return acc;
      }, [])
    : [];
  for (const item of strArr) {
    str += `${item},`;
  }
  return str;
};

const formatCustomer = async (nameIdMappedList, list) => {
  try {
    const formatedCustomer = list.map((item) => ({
      id: item.id,
      first_name: item?.fname || "",
      last_name: item?.lname || "",
      email: item?.email || "",
      phone: item?.phone || "",
      stage: item?.stage || "",
      source: item?.psrc ? nameIdMappedList.psrc[item?.psrc] : "",
      influences: flattenArrayToString(item?.infl, nameIdMappedList.infl),
      grade: item?.grade ? nameIdMappedList.grade[item?.grade] : "",
      contact_method: item?.cntm ? nameIdMappedList.cntm[item?.cntm] : "",
      realtor: item?.rltr?.id
        ? `${item?.rltr?.fname || ""} ${item?.rltr?.lname || ""}`
        : "",
      desired_features: flattenArrayToString(item?.desf, nameIdMappedList.desf),
      community_interests: flattenArrayToString(
        item?.inte,
        nameIdMappedList.community
      ),
      move_in_timeframe: item?.desm || "",
    }));
    console.log("formatedCustomer", JSON.stringify(formatedCustomer));
    return formatedCustomer;
  } catch (error) {
    console.log("error in formatedCustomer", JSON.stringify(error.stack));
    return []
  }
};

const formatRealtor = async (nameIdMappedList, list, idMappedAgencyList) => {
  try {
    const formatedRealtor = list.map((item) => ({
      id: item.id,
      first_name: item?.fname || "",
      last_name: item?.lname || "",
      email: item?.email || "",
      phone: item?.phone || "",
      agency_team_name: item?.agtnm || "",
      agency_company_name: item?.agcnm || "",
      agency_metros: flattenArrayToString(
        idMappedAgencyList[item?.rel_id]?.metros,
        nameIdMappedList.metro
      ),
      source: item?.psrc ? nameIdMappedList.psrc[item?.psrc] : "",
      influences: flattenArrayToString(item?.infl, nameIdMappedList.infl),
      contact_method: item?.cntm ? nameIdMappedList.cntm[item?.cntm] : "",
      agency_broker_fname: idMappedAgencyList[item?.rel_id]?.broker_fname,
      agency_broker_lname: idMappedAgencyList[item?.rel_id]?.broker_lname,
      agency_broker_email: idMappedAgencyList[item?.rel_id]?.broker_email,
      agency_broker_phone: idMappedAgencyList[item?.rel_id]?.broker_phone,
      expertise: flattenArrayToString(item?.exp, nameIdMappedList.exp),
      specialties: flattenArrayToString(item?.spec, nameIdMappedList.spec),
      agency_specialties: flattenArrayToString(
        idMappedAgencyList[item?.rel_id]?.spec,
        nameIdMappedList.spec
      ),
      agency_id: item?.rel_id || "",
    }));
    console.log("formatedRealtor", JSON.stringify(formatedRealtor));
    return formatedRealtor;
  } catch (error) {
    console.log("error in formatedRealtor", JSON.stringify(error.stack));
    return []
  }
};

export async function main(event) {
  const sendResponse = {
    ...event,
    status: false,
    error: "",
  };
  try {
    console.log(event);
    const { index, step,nextIndexValue } = event.iterator;
    const { dataFileKey = "", purpose, hbId } = event;
    // Get the data file from S3
    const statusFileResp = await getFileFromS3(dataFileKey);
    console.log(`statusFileResp: ${JSON.stringify(statusFileResp)}`);
    if (!statusFileResp?.status) {
      sendResponse.status = false;
      sendResponse.error = statusFileResp.error;
      return sendResponse;
    }

    const nameIdMappedList = statusFileResp?.data?.nameIdMappedList;
    let listData =
      purpose === "exportCustomer"
        ? statusFileResp?.data?.customers
        : statusFileResp?.data?.realtors;

    const fetchDataResp = await fetchData({
      hbId,
      size: step,
      from: index,
      purpose,
      nextIndexVal: nextIndexValue
    });

    console.log("fetchDataResp", JSON.stringify(fetchDataResp));
    if (!fetchDataResp.status) {
      sendResponse.status = false;
      sendResponse.error = fetchDataResp.error;
      return sendResponse;
    }

    if (purpose === "exportCustomer") {
      const list = await formatCustomer(nameIdMappedList, fetchDataResp.list);
      listData = [...listData, ...list];
    } else {
      let agencyIdArr = fetchDataResp.list.reduce((acc, crr, indx) => {
        acc[indx] = crr?.rel_id;
        return acc;
      }, []);

      agencyIdArr = [...new Set(agencyIdArr)];

      const agencyDataResp = await fetchAgencyData(agencyIdArr, hbId);

      console.log("agencyDataResp", JSON.stringify(agencyDataResp));

      if (!agencyDataResp.status) {
        sendResponse.status = false;
        sendResponse.error = agencyDataResp.error;
        return sendResponse;
      }

      const idMappedAgencyList = agencyDataResp.list.reduce((acc, crr) => {
        acc[crr.id] = {
          id: crr.id,
          broker_fname: crr?.broker?.fname || "",
          broker_lname: crr?.broker?.lname || "",
          broker_email: crr?.broker?.email || "",
          broker_phone: crr?.broker?.phone || "",
          metros: crr?.m_id || [],
          spec: crr?.broker?.spec || [],
        };
        return acc;
      }, {});

      console.log("idMappedAgencyList", JSON.stringify(idMappedAgencyList));

      const list = await formatRealtor(
        nameIdMappedList,
        fetchDataResp.list,
        idMappedAgencyList
      );
      listData = [...listData, ...list];
    }

    const statusParam =
      purpose === "exportCustomer"
        ? {
            nameIdMappedList,
            customers: listData,
          }
        : {
            nameIdMappedList,
            realtors: listData,
          };

    const uploadDataFileResp = await uploadExportStatusToS3(
      statusParam,
      dataFileKey
    );
    if (!uploadDataFileResp.status) {
      sendResponse.status = false;
      sendResponse.error = uploadDataFileResp.error;
      return sendResponse;
    }
    sendResponse.iterator.nextIndexValue = fetchDataResp?.nextIndexValue || null
    sendResponse.status = true;
    return sendResponse;
  } catch (error) {
    console.log("error in fetchData Lambda", JSON.stringify(error.stack));
    sendResponse.status = false;
    sendResponse.error = error.message;
    return sendResponse;
  }
}
