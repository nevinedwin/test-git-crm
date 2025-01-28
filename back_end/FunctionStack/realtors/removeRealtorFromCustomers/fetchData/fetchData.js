import { elasticExecuteQuery } from "../../../search/search";
import {
  getFileFromS3,
  uploadDRFCStatusToS3,
} from "../intiRemoveRealtor/initRemoveRealtor";

export const fetchData = async ({ hbId, size, rltrId, nextIndexVal }) => {
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
                  "entity.keyword": `customer#${hbId}`,
                },
              },
              {
                match: {
                  "hb_id.keyword": `${hbId}`,
                },
              },
              {
                bool: {
                  should: [
                    {
                      match: {
                        "rltr.id.keyword": `${rltrId}`,
                      },
                    },
                    {
                      match: {
                        "rltr.data.keyword": `${rltrId}`,
                      },
                    },
                  ],
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
              order: "asc",
            },
          },
        ],
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
      const nextIndexValue = hits[resultLength - 1]?.sort;
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

export async function main(event) {
  const sendResponse = {
    ...event,
    status: false,
    error: "",
  };
  try {
    console.log({ event });
    const { index, step, nextIndexValue } = event.iterator;
    const { dataFileKey = "", purpose, hbId, rltrId } = event;
    // Get the data file from S3
    const statusFileResp = await getFileFromS3(dataFileKey);
    console.log(`statusFileResp: ${JSON.stringify(statusFileResp)}`);
    if (!statusFileResp?.status) {
      sendResponse.status = false;
      sendResponse.error = statusFileResp.error;
      return sendResponse;
    }

    let rltrIdFinalArray = statusFileResp?.data;

    // fetch Data from elastic search
    const fetchDataResp = await fetchData({
      hbId,
      size: step,
      rltrId,
      nextIndexVal: nextIndexValue,
    });

    console.log("fetchDataResp", JSON.stringify(fetchDataResp));
    if (!fetchDataResp.status) {
      sendResponse.status = false;
      sendResponse.error = fetchDataResp.error;
      return sendResponse;
    }

    let rltrIdArray = fetchDataResp.list.map((eachItem) => {
      return eachItem.id;
    });
    console.log(`rltrIdArray: ${JSON.stringify(rltrIdArray)}`);
    
    // adding new ids with previous one
    rltrIdFinalArray = [...rltrIdFinalArray, ...rltrIdArray];
    console.log(`rltrIdFinalArray: ${JSON.stringify(rltrIdFinalArray)}`);
    
    // uploading data into s3
    const uploadDataStatus = await uploadDRFCStatusToS3(
      rltrIdFinalArray,
      dataFileKey
    );
    if (!uploadDataStatus.status) {
      sendResponse.status = false;
      sendResponse.error = uploadDataStatus.error;
      return sendResponse;
    }

    console.log(`uploadDataStatus: ${JSON.stringify(uploadDataStatus)}`);

    sendResponse.iterator.nextIndexValue = fetchDataResp.nextIndexValue || null;
    sendResponse.status = true;
    return sendResponse;
  } catch (error) {
    console.log("error in fetchData Lambda", JSON.stringify(error.stack));
    sendResponse.status = false;
    sendResponse.error = error.message;
    return sendResponse;
  }
}
