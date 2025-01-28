/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import AWS from "aws-sdk";
import moment from "moment-timezone";
import { failure, success } from "../libs/response-lib";
import { sendRequest } from "../libs/search-lib";
import { doPaginatedQueryEllastic, getResourceJSON } from "../libs/db";
import { initLambdaInvoke } from "../libs/lambda";
import { getRealtors } from "../../ReportsStack/getRealtors/getRealtors";
import { listDesiredFeatures } from "../desiredFeatures/desiredFeatures";

const sfn = new AWS.StepFunctions();
const { REPORTS_STATE_MACHINE_ARN, COMMUNITIES_LAMBDA_ARN } = process.env;
const stageKeys = {
  Lead: "lead",
  Prospect: "prospect",
  Buyer: "buyer",
  Bust_Out: "bust_out",
  Closed: "closed",
  Dead_Lead: "dead_lead",
};
const keyStages = {
  lead: "Lead",
  prospect: "Prospect",
  buyer: "Buyer",
  bust_out: "Bust_Out",
  closed: "Closed",
  dead_lead: "Dead_Lead",
};


export const getSalesAgent = async (data) => {
  try {

    const { hbId = "", commIds = [] } = data;

    const customQuery = {
      httpMethod: "POST",
      requestPath: "/_search",
      payload: {
        query: {
          bool: {
            must: [
              {
                match: {
                  "hb_id.keyword": hbId
                }
              },
              {
                exists: {
                  field: "comm"
                }
              },
              {
                terms: {
                  "comm.keyword": commIds
                }
              }
            ]
          }
        }
      }
    };

    console.log(`customQuery: ${JSON.stringify(customQuery)}`);

    const resp = await elasticExecuteQuery(customQuery, true);
    console.log(`Resp: ${JSON.stringify(resp)}`);

    if (resp.statusCode === 200) {

      const data = resp?.body?.hits?.hits.map(eachData => ({
        ...eachData._source,
        score: eachData._score
      }))

      console.log(`Data: ${JSON.stringify(data)}`);

      return { status: true, data };

    } else {
      throw new Error("Error in fetching elastic search")
    }

  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`);
    return { status: false, error: error?.message || error }
  }
};

const validateReportInit = async (data) => {
  try {
    const { type, gby, render } = data;

    const isSummary = !!(
      gby === "psrc_summary" ||
      gby === "infl_summary" ||
      gby === "traf_summary" ||
      gby === "traf_summary_by_src"
    );

    // type = customer/realtor
    if (!type) return { status: false, error: "Type parameter is required" };

    if (!["customer", "realtor", "count", "lastcontact", "customer_notes"].includes(type))
      return { status: false, error: "Invalid type parameter" };

    if (!isSummary && !render)
      return { status: false, error: "Render parameter is required" };

    if (!isSummary && !["csv", "pdf"].includes(render))
      return { status: false, error: "Invalid render parameter" };

    if (gby === "realtor_traf_by_metro" && render === "pdf") {
      const realtorCount = await getRealtors({ ...data, isCount: true });
      if (!realtorCount.status)
        return { status: false, error: realtorCount.error };

      if (realtorCount.count > 1000)
        return {
          status: false,
          error: `PDF report is not possible, as realtor count is ${realtorCount.count}`,
        };
    }

    return { status: true };
  } catch (error) {
    console.log("validateReportInit>>", error);
    return { status: false, error: error.message };
  }
};

const initGenerateReport = async (data) => {
  console.log(`data: ${JSON.stringify(data)}`);

  const isValid = await validateReportInit(data);

  if (!isValid.status) return failure({ status: false, error: isValid.error });

  const input = JSON.stringify({ data, type: data.type });
  const params = {
    input,
    stateMachineArn: REPORTS_STATE_MACHINE_ARN,
  };
  try {
    console.log(`params: ${JSON.stringify(params)}`);
    const startExecutionResp = await sfn.startExecution(params).promise();
    console.log(`startExecutionResp: ${JSON.stringify(startExecutionResp)}`);
    return success({ status: true });
  } catch (error) {
    console.log(`error`);
    console.log(error);
    return failure({ status: false, error });
  }
};

const elasticExecuteQuery = async (requestBody, isJSONOnly = false) => {
  const sendResponse = (response) => {
    if (isJSONOnly) {
      return response;
    }

    if (response.status === false) {
      return failure(response);
    }

    return success(response);
  };
  const searchResult = await sendRequest(requestBody)
    .then((result) => {
      if (result && result.statusCode && result.statusCode === 200) {
        return sendResponse({ ...result, status: true });
      }

      return sendResponse({ ...result, status: false });
    })
    .catch((result) => sendResponse({ ...result, status: false }));
  return searchResult;
};

const sourceAndInfluencePagination = async (data) => {
  try {
    const {
      hb_id: hbId = "",
      from = 0,
      size = 5,
      after = "",
      sort = [{ field: "fname", order: "asc" }],
      filterKey = "",
      keyValue = "",
      startDate = "",
      endDate = "",
      comm = [],
      stages = [],
      sources = [],
      dg = [],
      dg_type = "ALL",
      desf = [],
      grade = [],
      m_id: metroId = []
    } = data;

    if (
      hbId !== "" &&
      filterKey !== "" &&
      keyValue !== "" &&
      startDate !== "" &&
      endDate !== ""
    ) {

      const dgTypeVal = {
        ALL: "must",
        ANY: "should"
      }
      let stageList = [
        "Lead",
        "Prospect",
        "Buyer",
        "Closed",
        "Bust_Out",
        "Dead_Lead",
      ];
      if (stages && stages.length) {
        stageList = stages.map((stage) => keyStages[stage]);
      }


      let compositeSourceKey = "";

      const isSummary = !!(
        filterKey === "psrc_summary" ||
        filterKey === "infl_summary" ||
        filterKey === "traf_summary" ||
        filterKey === "traf_summary_by_src"
      );

      const customerListQuery = {
        httpMethod: "POST",
        requestPath: "/_search",
        payload: {
          query: {
            bool: {
              must: [
                { term: { "entity.keyword": `customer#${hbId}` } },
                { term: { "hb_id.keyword": hbId } }
              ],
            },
          },
        },
      };

      // In some case the start and endate is not given. So conditionally applying that filter
      if (startDate || endDate) {
        const rangeFilter = {
          range: {
            cdt: {
              ...(startDate && { gte: startDate }),
              ...(endDate && { lte: endDate })
            }
          }
        };

        console.log(`rangeFilter: ${JSON.stringify(rangeFilter)}`);

        customerListQuery.payload.query.bool.must.push({ ...rangeFilter });
      };

      console.log(`customerListQuery: ${JSON.stringify(customerListQuery)}`);


      if (stageList.length) {
        customerListQuery.payload.query.bool.must.push({
          bool: {
            should: stageList.map((stageName) => ({
              term: { "stage.keyword": stageName },
            })),
          },
        });
      }

      if (filterKey === 'desf') {
        let desfList;
        if (desf.length) {
          desfList = desf;
        } else {
          desfList = await listDesiredFeatures({ pathParameters: { hbid: hbId } }, true);
          desfList = JSON.parse(desfList.body).map(feature => feature.id);
        }
        customerListQuery.payload.query.bool.must.push({
          bool: {
            should: desfList.map((feature) => ({
              term: { "desf.keyword": feature },
            })),
          },
        });
        customerListQuery.payload.query.bool.must.push({
          bool: {
            should: {
              term: { "m_id.keyword": keyValue }
            },
          },
        });
        customerListQuery.payload.query.bool.must.push(
          {
            "bool": {
              "must_not": [
                {
                  "bool": {
                    "should": [
                      { "bool": { "must_not": { "exists": { "field": "desf" } } } }
                    ]
                  }
                }
              ]
            }
          }
        );
      }

      if (!isSummary) {

        customerListQuery.payload.size = size;
        customerListQuery.payload.from = from;

        // If after is provided and the from + size is greater than 10000, use the search_after parameter in the query.
        // This is done because of the index.max-result-window limit of 10000 set by Elasticsearch.
        if (from + size > 10000 && after !== "" && after.length) {
          customerListQuery.payload.search_after = after;
          // In this case we should set from as 0
          customerListQuery.payload.from = 0;
        }

        // Add sort field if supplied in the request
        if (sort.length) {
          customerListQuery.payload.sort = [];
          for (const sortField of sort) {
            // sortField = {"field": "email", "order": "asc/desc"}
            customerListQuery.payload.sort.push({
              [`${sortField.field}${sortField.field !== "cdt" && sortField.field !== "mdt"
                ? ".keyword"
                : ""
                }`]: sortField.order,
            });
          }
          // Adding the id field as the tie-breaker field for sorting.
          customerListQuery.payload.sort.push({
            "id.keyword": "asc",
          });
        }


        if (filterKey !== "sales_agent" && (comm.length || metroId.length)) {
          customerListQuery.payload.query.bool.must.push({
            bool: {
              should:
                [
                  ...(comm.length ? comm.map((commId) => ({
                    match_phrase: { "inte.keyword": commId },
                  })) : []),
                  ...(metroId.length ? [{
                    terms: {
                      "m_id.keyword": metroId
                    }
                  }] : [])
                ]
            },
          });

        } else {
          if (comm.length) {
            const salesAgentData = await getSalesAgent({ hbId, commIds: comm })
            if (!salesAgentData.status) throw salesAgentData.error;

            customerListQuery.payload.query.bool.must.push({
              terms: {
                "newinte.keyword": salesAgentData.data.map(agent => (agent.id))
              }
            })
          }
        }

        // if dg(demographics) is given
        const dgAddQuery = {
          bool: {
            [dgTypeVal[dg_type]]: []
          }
        }
        if (dg.length) {
          for (const eachDg of dg) {
            dgAddQuery.bool[dgTypeVal[dg_type]].push({
              bool: {
                must: [
                  {
                    bool: {
                      should: [
                        ...eachDg.a.map(eachAnswer => ({
                          term: {
                            "dg.a.keyword": eachAnswer
                          }
                        })),
                      ]
                    }
                  },
                  {
                    term: {
                      "dg.q.keyword": eachDg.q
                    }
                  }
                ]
              }
            })
          }
          customerListQuery.payload.query.bool.must.push(dgAddQuery);
        }

        if (filterKey === "psrc") {
          // for psrc keyValue will be source id. user have to make separate call for different source
          customerListQuery.payload.query.bool.must.push({
            term: { "psrc.keyword": keyValue },
          });
        }

        if (filterKey === "infl") {
          // for infl keyValue will be influence id. user have to make separate call for different influence
          customerListQuery.payload.query.bool.must.push({
            match_phrase: { "infl.keyword": keyValue },
          });
        }

        if (filterKey === "grade") {
          customerListQuery.payload.query.bool.must.push({
            bool: {
              should: grade.map(eachGrade => ({
                match: {
                  "grade.keyword": eachGrade
                }
              }))
            }
          })
        };
      }

      // If summary report, use aggs for getting the grouped count
      if (isSummary) {
        const aggregations = {
          customer_buckets: {
            composite: {
              size,
              sources: [],
            },
          },
        };

        // for psrc_summary and infl_summary keyValue will be community id. user have to make separate call for different communitites
        if (filterKey === "psrc_summary" || filterKey === "infl_summary") {
          customerListQuery.payload.query.bool.must.push({
            match_phrase: { "inte.keyword": keyValue },
          });
        }

        if (
          filterKey === "traf_summary" ||
          filterKey === "traf_summary_by_src"
        ) {
          if (sources.length) {
            customerListQuery.payload.query.bool.must.push({
              bool: {
                should: sources.map((srcId) => ({
                  match_phrase: { "psrc.keyword": srcId },
                })),
              },
            });
          }
          // get communities by metro id, keyValue will be having metro id
          const communityList = await initLambdaInvoke({
            action: "list",
            httpMethod: "GET",
            body: { hbid: hbId },
            arn: COMMUNITIES_LAMBDA_ARN,
            getBody: true,
          });
          console.log(`communityList: ${JSON.stringify(communityList)}`);

          const filteredCommunityList = communityList.filter(
            (communityListItem) => communityListItem.rel_id === keyValue
          );
          console.log(
            `filteredCommunityList: ${JSON.stringify(filteredCommunityList)}`
          );

          let filteredCommunityListIDs = filteredCommunityList.map(
            (filteredCommunityListItem) => filteredCommunityListItem.id
          );
          console.log(
            `filteredCommunityListIDs: ${JSON.stringify(
              filteredCommunityListIDs
            )}`
          );

          if (comm.length) {
            filteredCommunityListIDs = filteredCommunityListIDs.filter((x) =>
              comm.includes(x)
            );
            console.log(
              `filteredCommunityListIDs if comm : ${JSON.stringify(
                filteredCommunityListIDs
              )}`
            );
          }

          if (filteredCommunityListIDs.length) {
            customerListQuery.payload.query.bool.must.push({
              bool: {
                should: filteredCommunityListIDs.map((commId) => ({
                  match_phrase: { "inte.keyword": commId },
                })),
              },
            });

            // community aggregate only needed for traf_summary
            aggregations.customer_buckets.composite.sources.push({
              community: {
                terms: {
                  script: {
                    source: `
                          def inteArr = [];
                          def inteCompare = [${`'${filteredCommunityListIDs.join(
                      "','"
                    )}'`}];
                          for (def inte : doc['inte.keyword']) {  
                            for (def inteComp : inteCompare) {
                              if (inte == inteComp) {
                                inteArr.add(inte)
                              }
                            }
                          }
                          return inteArr
                      `,
                    lang: "painless",
                  },
                },
              },
            });

            if (filterKey === "traf_summary_by_src") {
              aggregations.customer_buckets.composite.sources.push({
                src_id: {
                  terms: {
                    field: "psrc.keyword",
                  },
                },
              });
            }
          } else {
            return success({
              status: true,
              data: [],
              after: null,
              hasAfter: false,
            });
          }
        }

        // query size 0 when using aggregation
        customerListQuery.payload.size = 0;

        // pagination for aggregation
        if (after !== "") {
          aggregations.customer_buckets.composite.after = after;
        }

        if (filterKey === "psrc_summary") {
          compositeSourceKey = "source";
          aggregations.customer_buckets.composite.sources.push({
            source: {
              terms: {
                field: "psrc.keyword",
              },
            },
          });
        }
        if (filterKey === "infl_summary") {
          compositeSourceKey = "influence";
          aggregations.customer_buckets.composite.sources.push({
            influence: {
              terms: {
                field: "infl.keyword",
              },
            },
          });
        }
        if (
          filterKey === "traf_summary" ||
          filterKey === "traf_summary_by_src"
        ) {
          compositeSourceKey = "community";
          aggregations.customer_buckets.aggregations = {
            stage: {
              terms: {
                field: "stage.keyword",
              },
            },
          };
        }

        customerListQuery.payload.aggs = aggregations;
      }

      console.log(`customerListQuery: ${JSON.stringify(customerListQuery)}`);
      const customerList = await elasticExecuteQuery(customerListQuery, true);
      console.log(`customerList: ${JSON.stringify(customerList)}`);
      if (
        customerList &&
        customerList.statusCode &&
        customerList.statusCode === 200
      ) {
        if (isSummary) {
          if (
            customerList.body &&
            customerList.body.aggregations &&
            customerList.body.aggregations.customer_buckets &&
            customerList.body.aggregations.customer_buckets.buckets
          ) {
            let aggregations =
              customerList.body.aggregations.customer_buckets.buckets;
            let hasAfter =
              customerList?.body?.aggregations?.customer_buckets?.after_key ??
              null;
            let hasAfterBool = true;
            if (hasAfter === null) {
              hasAfterBool = false;
            }
            if (aggregations && aggregations.length) {
              // // checking if last data matches hasAfter
              // const LastKey = aggregations[aggregations.length - 1]["key"][compositeSourceKey];
              // if (hasAfter !== null && LastKey === hasAfter[compositeSourceKey]) {
              //   hasAfterBool = false;
              // }
              if (
                filterKey === "psrc_summary" ||
                filterKey === "infl_summary"
              ) {
                aggregations = aggregations.map((aggregationsItem) => ({
                  id: aggregationsItem.key[compositeSourceKey],
                  count: aggregationsItem.doc_count,
                }));
                if (aggregations.length < size) {
                  hasAfterBool = false;
                  hasAfter = null;
                }
              } else if (filterKey === "traf_summary") {
                aggregations = aggregations.map((aggregationsItem) => {
                  const tempData = {
                    id: aggregationsItem.key[compositeSourceKey],
                  };
                  if (
                    aggregationsItem &&
                    aggregationsItem.stage &&
                    aggregationsItem.stage.buckets &&
                    aggregationsItem.stage.buckets.length
                  ) {
                    aggregationsItem.stage.buckets.forEach((stageItems) => {
                      const stageNameRet = stageKeys[stageItems.key];
                      tempData[stageNameRet] = stageItems.doc_count;
                    });
                  }
                  return tempData;
                });
                if (aggregations.length < size) {
                  hasAfterBool = false;
                  hasAfter = null;
                }
              } else if (filterKey === "traf_summary_by_src") {
                const tempArr = [];
                let count = 0;
                const flattenArr = (arr = []) => {
                  const temp = {};
                  if (!arr.length) return "";
                  arr.forEach((stageItems) => {
                    const stageNameRet = stageKeys[stageItems.key];
                    temp[stageNameRet] = stageItems.doc_count;
                  });
                  return temp;
                };
                for (const aggr of aggregations) {
                  let srcObj = {
                    id: aggr.key.src_id,
                  };
                  const res = flattenArr(aggr.stage.buckets);
                  if (res) {
                    srcObj = {
                      ...srcObj,
                      ...res,
                    };
                  }
                  const ifExists = tempArr.find(
                    (item) => item.community_id === aggr.key.community
                  );
                  if (ifExists) {
                    ifExists.sources.push(srcObj);
                  } else {
                    tempArr.push({
                      community_id: aggr.key.community,
                      sources: [srcObj],
                    });
                  }
                  count += 1;
                }
                aggregations = tempArr;

                if (count < size) {
                  hasAfterBool = false;
                  hasAfter = null;
                }
              }
            }
            // let groupedCustomers = [];
            // if (filterKey === 'psrc_summary') {
            //   groupedCustomers = getGroupedSummary(1, aggregations);
            //   console.log(`groupedCustomers: ${JSON.stringify(groupedCustomers)}`);
            // }
            // else if (filterKey === 'infl_summary') {
            //   groupedCustomers = getGroupedSummary(2, aggregations);
            //   console.log(`groupedCustomers: ${JSON.stringify(groupedCustomers)}`);
            // }
            // else if (filterKey === 'traf_summary') {

            //   const communityList = await listCommunities({ pathParameters: { hbid: hb_id } }, true);
            //   console.log(`communityList: ${JSON.stringify(communityList)}`);

            //   const communityMetroList = communityList.reduce((communityMetros, community) => {
            //     communityMetros[community.id] = community.rel_id;
            //     return communityMetros;
            //   }, {});
            //   console.log(`communityMetroList: ${JSON.stringify(communityMetroList)}`);

            //   groupedCustomers = getGroupedSummary(3, aggregations, communityMetroList);
            //   console.log(`groupedCustomers: ${JSON.stringify(groupedCustomers)}`);
            // }
            return success({
              status: true,
              data: aggregations,
              after: hasAfter,
              hasAfter: hasAfterBool,
            });
          }

          return failure({ status: false, customerList, customerListQuery });
        }

        if (
          customerList.body &&
          customerList.body.hits &&
          customerList.body.hits.hits
        ) {
          const { hits } = customerList.body.hits;
          const resultLength = hits.length;
          const totalResults = customerList.body.hits.total;
          console.log(`resultLength: ${resultLength}`);
          console.log(`totalResults: ${totalResults}`);
          console.log(`hits: ${JSON.stringify(hits)}`);
          const customers = resultLength
            ? hits.map((customer) => {
              const customerObj = {
                ...customer._source,
                _score: customer._score,
              };
              return customerObj;
            })
            : [];
          console.log(`customers: ${JSON.stringify(customers)}`);
          const afterHas =
            resultLength && sort.length ? [...hits[resultLength - 1].sort] : [];
          const hasAfter = from + size < totalResults;
          return success({
            status: true,
            customers,
            after: afterHas,
            hasAfter,
            total: totalResults
          });
        }

        return failure({ status: false, customerList });
      }
      return failure({ status: false, customerList });
    }
    return failure({ status: false, error: "Mandatory Data Missing" });
  } catch (error) {
    console.log(`error.stack : ${JSON.stringify(error.stack)}`);
    return failure({ status: false, error: error.stack });
  }
};

const getStatus = async (data) => {
  try {
    const { hbid, email } = data;
    const listReportStatusParams = {
      TableName: process.env.entitiesTableName,
      IndexName: process.env.entitiesTableByDataAndEntity,
      KeyConditionExpression: "#data = :data and #entity = :entity",
      ExpressionAttributeNames: {
        "#data": "data",
        "#entity": "entity",
      },
      ExpressionAttributeValues: {
        ":entity": `report_generate_status#${hbid}`,
        ":data": email,
      },
    };
    let listReportStatusRes = [];
    console.log(
      `listReportStatusParams: ${JSON.stringify(listReportStatusParams)}`
    );
    listReportStatusRes = await getResourceJSON(listReportStatusParams);
    console.log(`listReportStatusRes: ${JSON.stringify(listReportStatusRes)}`);

    listReportStatusRes =
      listReportStatusRes.length &&
      listReportStatusRes
        .filter((reportItem) => reportItem.data === email)
        .sort((a, b) => {
          if (a.mdt > b.mdt) return -1;
          if (b.mdt > a.mdt) return 1;
          return 0;
        });

    console.log(`listReportStatusRes: ${JSON.stringify(listReportStatusRes)}`);

    return success({ status: true, data: listReportStatusRes });
  } catch (error) {
    console.log(`error: ${JSON.stringify(error.stack)}`);
    return failure({ status: false, error: error.stack });
  }
};

const realtorReport = async (data) => {
  try {
    const {
      hb_id: hbId = "",
      from = 0,
      size = 5,
      after = "",
      sort = [{ field: "fname", order: "asc" }],
      startDate = "",
      endDate = "",
      m_id: metroId = "",
    } = data;

    if (!hbId || !startDate || !endDate || !metroId)
      return failure({ status: false, error: "Mandatory Data Missing" });

    // fetching the agencies under the metro
    const agencyListQuery = {
      httpMethod: "POST",
      requestPath: "/_search",
      payload: {
        query: {
          bool: {
            must: [
              {
                match: {
                  "m_id.keyword": metroId,
                },
              },
              {
                match: {
                  "entity.keyword": `agency#${hbId}`,
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
        size: 5000,
      },
    };

    console.log(`agencyListQuery: ${JSON.stringify(agencyListQuery)}`);
    const metroAgencyResp = await elasticExecuteQuery(agencyListQuery);
    console.log(`metroAgencyResp: ${JSON.stringify(metroAgencyResp)}`);
    const metroAgencyBody = metroAgencyResp.body
      ? JSON.parse(metroAgencyResp.body)
      : {};
    console.log(`metroAgencyBody: ${JSON.stringify(metroAgencyBody)}`);
    const agencyArr =
      metroAgencyBody?.body?.hits?.hits?.map((agency) => agency?._source) ?? [];
    console.log(`agencyArr: ${JSON.stringify(agencyArr)}`);
    const agencyIds = agencyArr?.map((agency) => agency?.id ?? "");
    console.log(`agencyIds: ${JSON.stringify(agencyIds)}`);

    // realtor query
    const realtorListQuery = {
      httpMethod: "POST",
      requestPath: "/_search",
      payload: {
        query: {
          bool: {
            must: [
              {
                match: {
                  "entity.keyword": `realtor#${hbId}`,
                },
              },
              {
                match: {
                  "hb_id.keyword": hbId,
                },
              },
              {
                terms: {
                  "rel_id.keyword": [...new Set(agencyIds)],
                },
              },
              { range: { cdt: { gte: startDate, lte: endDate } } },
            ],
          },
        },
        size,
        from,
        _source: {
          includes: [
            "id",
            "entity",
            "agcnm",
            "cdt",
            "email",
            "mdt",
            "fname",
            "lname",
            "phone",
            "fav",
          ],
        },
      },
    };

    // Add sort field if supplied in the request
    if (sort.length) {
      realtorListQuery.payload.sort = [];
      for (const sortField of sort) {
        // sortField = {"field": "email", "order": "asc/desc"}
        realtorListQuery.payload.sort.push({
          [`${sortField.field === "agency" ? "agcnm" : sortField.field}${sortField.field !== "cdt" && sortField.field !== "mdt"
            ? ".keyword"
            : ""
            }`]: sortField.order,
        });
      }
      // Adding the id field as the tie-breaker field for sorting.
      realtorListQuery.payload.sort.push({
        "id.keyword": "asc",
      });
    }

    // If after is provided and the from + size is greater than 10000, use the search_after parameter in the query.
    // This is done because of the index.max-result-window limit of 10000 set by Elasticsearch.
    if (from + size > 10000 && after.length) {
      realtorListQuery.payload.search_after = after;
      // In this case we should set from as 0
      realtorListQuery.payload.from = 0;
    }
    console.log(`realtorListQuery: ${JSON.stringify(realtorListQuery)}`);
    const realtorList = await elasticExecuteQuery(realtorListQuery, true);
    console.log(`realtorList: ${JSON.stringify(realtorList)}`);

    if (
      realtorList &&
      realtorList.statusCode === 200 &&
      realtorList.body &&
      realtorList.body.hits &&
      realtorList.body.hits.hits
    ) {
      const { hits } = realtorList.body.hits;
      const resultLength = hits.length;
      const totalResults = realtorList.body.hits.total;
      console.log(`resultLength: ${resultLength}`);
      console.log(`totalResults: ${totalResults}`);
      console.log(`Before success call`);
      const realtors = resultLength
        ? hits.map((realtor) => {
          const realtorObj = { ...realtor._source, _score: realtor._score };
          return realtorObj;
        })
        : [];
      const afterNext =
        resultLength && sort.length ? [...hits[resultLength - 1].sort] : [];
      const hasAfter = from + size < totalResults;
      return success({
        m_id: metroId,
        realtors,
        after: afterNext,
        hasAfter,
        totalResults,
      });
    }
    return failure(realtorList);
  } catch (error) {
    console.log(`error: ${error}`);
    return failure({ status: false, error: error.message });
  }
};

/**
 * Function to fetch details of customers of given ids from elastic
 * @param {Array} customerIdList 
 */
const fetchCustomers = async (customerIdList, hbId, size = 500) => {
  const fetchCustomersQuery = {
    httpMethod: "POST",
    requestPath: `/_search`,
    payload: {
      query: {
        bool: {
          must: [
            {
              match: {
                "entity.keyword": `customer#${hbId}`
              }
            },
            {
              match: {
                "hb_id.keyword": hbId
              }
            }
          ]
        }
      },
      _source: {
        includes: ["id", "fname", "lname", "email", "stage"]
      },
      sort: [
        { "fname.keyword": "asc" },
        { "id.keyword": "asc" }
      ]
    }
  }
  fetchCustomersQuery.payload.query.bool.must.push({
    bool: {
      should: customerIdList.map(id => ({
        match: {
          "id.keyword": id
        }
      }))
    }
  });
  let hasAfter = false;
  let after = [];
  let customers = [];
  let count = 1;
  let recFrom = 0;
  try {
    do {
      fetchCustomersQuery.payload.from = recFrom;
      fetchCustomersQuery.payload.size = size;
      if (recFrom + size > 10000 && after.length) {
        fetchCustomersQuery.payload.search_after = after;
        fetchCustomersQuery.payload.from = 0;
      }
      console.log(`Customer fetch query ${count} ==> ${JSON.stringify(fetchCustomersQuery)}`);
      const customerList = await elasticExecuteQuery(fetchCustomersQuery, true);
      if (
        customerList &&
        customerList.statusCode === 200 &&
        customerList.body &&
        customerList.body.hits &&
        customerList.body.hits.hits
      ) {
        const { hits } = customerList.body.hits;
        const resultLength = hits.length;
        const totalResults = customerList.body.hits.total;
        console.log(`resultLength: ${resultLength}`);
        console.log(`totalResults: ${totalResults}`);
        customers = resultLength
          ? [...customers, ...hits.map((customer) => {
            const customerObj = {
              ...customer._source,
              _score: customer._score,
            };
            return customerObj;
          })]
          : [];
        after = resultLength && hasAfter ? [...hits[resultLength - 1].sort] : [];
        hasAfter = recFrom + size < totalResults;
        if (hasAfter) {
          recFrom = size * count;
          count += 1;
        }
      }
    } while (hasAfter);
    return customers;
  } catch (error) {
    console.log(`Error in fetchCustomer : ${JSON.stringify(error)}`);
    throw new Error(error)
  }
}


/**
 * Function to add missing customer data to a target list of objects that has a "customer" property to store list of customers
 * @param customerMap - Map of customers with required details
 * @param target - A List object having a property of "customers" to store customer list 
 */
const addCustomerDetails = async (customerMap, target) => {
  const modifiedTarget = target.map(t => ({
    ...t,
    customers: t.customers ? t.customers.map(cust => ({
      ...cust,
      ...customerMap[cust.id]
    })) : []
  }))
  return modifiedTarget
}

const getAgentAppointmentCounts = async (agentMap, apptBucket, customerMap, isEmptyShown) => {
  const countObj = {};

  const toCleanCase = (str) => str.toLowerCase().split(' ').join('_');

  apptBucket.forEach(bucketItem => {
    const currAgent = bucketItem.key.agent;
    const currCust = bucketItem.key.customer;
    if (customerMap[currCust]) {
      if (!countObj[currAgent]) {
        countObj[currAgent] = {
          sales_agent: agentMap[currAgent],
          customers: {
            [currCust]: {
              appts: {
                scheduled: 0,
                confirmed: 0,
                complete: 0,
                no_show: 0,
                [toCleanCase(bucketItem.key.status)]: bucketItem.doc_count
              }
            }
          },
          appts: {
            scheduled: 0,
            confirmed: 0,
            complete: 0,
            no_show: 0,
            [toCleanCase(bucketItem.key.status)]: bucketItem.doc_count,
            count: bucketItem.doc_count
          }
        }
      } else {
        if (!countObj[currAgent].customers[currCust]) {
          countObj[currAgent].customers[currCust] = {
            appts: {
              scheduled: 0,
              confirmed: 0,
              complete: 0,
              no_show: 0,
              [toCleanCase(bucketItem.key.status)]: bucketItem.doc_count
            }
          }
        } else {
          countObj[currAgent].customers[currCust].appts[toCleanCase(bucketItem.key.status)] = bucketItem.doc_count;
        }
        countObj[currAgent].appts[toCleanCase(bucketItem.key.status)] += bucketItem.doc_count;
        countObj[currAgent].appts.count = Object.keys(countObj[currAgent].appts).reduce((sum, status) => {
          if (status !== "count") {
            return sum + countObj[currAgent].appts[status]
          }
          return sum
        }, 0);
      }
    }
  });

  // converting customers map to list

  for (const agent in countObj) {
    if (agent in countObj) {
      const customerList = Object.entries(countObj[agent].customers).map(([customerId, customerStatus]) => ({
        id: customerId,
        ...customerStatus
      }));
      countObj[agent].customers = [...customerList]
    }
  }

  if (isEmptyShown) {
    for (const agent in agentMap) {
      if (!Object.hasOwnProperty.call(countObj, agent)) {
        countObj[agent] = {
          sales_agent: agentMap[agent],
          customers: []
        };
      }
    }
  }
  const countList = Object.keys(countObj).map(agentId => ({ ...countObj[agentId] }));
  return countList;
}

const getAgentTaskCounts = async (agentNameMap, tasks, customerMap = {}, isEmptyShown) => {
  const taskObj = {};
  const today = moment();

  tasks.forEach(task => {
    const currCust = task.rel_id;
    const currAgent = task.assi;
    if (customerMap[currCust]) {
      // Convert empty statuses to overdue or pending based on dt field
      if (!task.status) {
        task.status = moment(task.dt) < today ? 'overdue' : 'pending'
      } else {
        task.status = task.status.toLowerCase();
      }
      // initialize and count the tasks based on status
      if (!taskObj[currAgent]) {
        taskObj[currAgent] = {
          'overdue': 0,
          'pending': 0,
          'complete': 0,
          'count': 1,
          customers: {
            [currCust]: {
              'overdue': 0,
              'pending': 0,
              'complete': 0,
              [task.status]: 1
            }
          },
          [task.status]: 1
        }
      } else {
        if (!taskObj[currAgent].customers[currCust]) {
          taskObj[currAgent].customers[currCust] = {
            'overdue': 0,
            'pending': 0,
            'complete': 0,
            [task.status]: 1
          }
        } else {
          taskObj[currAgent].customers[currCust][task.status] += 1
        }
        taskObj[currAgent][task.status] += 1;
        taskObj[currAgent].count += 1;
      }
    }
  });

  // converting customers map to list

  for (const agent in taskObj) {
    if (agent in taskObj) {
      const customerList = Object.entries(taskObj[agent].customers).map(([customerId, customerStatus]) => ({
        id: customerId,
        ...customerStatus
      }));
      taskObj[agent].customers = [...customerList];
    }
  }

  if (isEmptyShown) {
    for (const agentId in agentNameMap) {
      if (!taskObj[agentId]) {
        taskObj[agentId] = {
          overdue: 0, pending: 0, complete: 0, count: 0,
          customers: []
        }
      }
    }
  }
  const countList = Object.keys(taskObj).map(agentId => ({ 'sales_agent': agentNameMap[agentId], ...taskObj[agentId] }));
  return countList;
}

export const getCountsReport = async (data) => {
  try {
    const {
      hb_id: hbId = "",
      startDate = "",
      endDate = "",
      comm = [],
      from = 0,
      after = "",
      size = 5,
      showType = "dash",
      render = '',
      aType = '',
      users = ['admin', 'online_agent', 'agent']
    } = data;

    const allowedTypes = new Set(['appointment', 'task']);
    let result = [];

    if (!hbId || !startDate || !endDate || !aType)
      return failure({ status: false, error: "Mandatory Data Missing" });

    if (render && (showType === "dash")) {
      return failure({ status: false, error: "Invalid request parameters" })
    }

    if (!(allowedTypes.has(aType))) {
      throw new Error('Provide a valid activity type');
    }

    const agentListQuery = {
      httpMethod: "POST",
      requestPath: `/_search`,
      payload: {
        _source: {
          includes: [
            "id", "fname", "lname"
          ]
        },
        sort: [
          { "fname.keyword": "asc" },
          { "id.keyword": "asc" }
        ]
      },
    };

    // flag to enable/disable agents without appointments.
    // false : when the api is called for dashboard.
    // true when the api is called for report.
    const isEmptyShown = (showType === "report" ||
      (render && render.length && ["pdf", "csv"].includes(render)));

    if (!render) {
      agentListQuery.payload.size = size;
      agentListQuery.payload.from = from;
      // If after is provided and the from + size is greater than 10000, use the search_after parameter in the query.
      // This is done because of the index.max-result-window limit of 10000 set by Elasticsearch.
      if (from + size > 10000 && after.length) {
        agentListQuery.payload.search_after = after;
        // In this case we should set from as 0
        agentListQuery.payload.from = 0;
      }
    }
    let filterCondition = {};
    // if community exists in api and users contains agent need to filter with community only for agents
    if (comm?.length && users.includes('agent')) {
      filterCondition = {
        bool: {
          must: [
            {
              bool: {
                should: [
                  {
                    bool: {
                      must: [
                        {
                          term: {
                            "type.keyword": "agent"
                          }
                        },
                        {
                          terms: {
                            "utype.keyword": users.filter(user => user !== 'agent')
                          }
                        }
                      ]
                    }
                  },
                  {
                    bool: {
                      must: [
                        {
                          term: {
                            "utype.keyword": "agent"
                          }
                        },
                        {
                          exists: {
                            field: "comm"
                          }
                        },
                        {
                          terms: {
                            "comm.keyword": comm
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            },
            {
              term: {
                "hb_id.keyword": hbId
              }
            }
          ]
        }
      }
    } else {
      filterCondition = {
        bool: {
          must: [
            {
              term: {
                "hb_id.keyword": hbId
              }
            },
            {
              terms: {
                "utype.keyword": users
              }
            },
            {
              term: {
                "type.keyword": "agent"
              }
            }
          ]
        }
      }
    }
    agentListQuery.payload.query = filterCondition;
    let agents = [];
    let agentPage = {};

    if (render && ['pdf', 'csv'].includes(render)) {
      let count = 1;
      let hasAfter = false;
      let recFrom = 0;
      do {
        agentListQuery.payload.from = recFrom;
        agentListQuery.payload.size = size;
        console.log(`agentListQuery count ${count}: ${JSON.stringify(agentListQuery)}`);
        const agentList = await elasticExecuteQuery(agentListQuery, true);
        console.log(`agentList count ${count}: ${JSON.stringify(agentList)}`);

        if (
          agentList &&
          agentList.statusCode === 200 &&
          agentList.body &&
          agentList.body.hits &&
          agentList.body.hits.hits &&
          agentList.body.hits.hits.length
        ) {
          const { hits } = agentList.body.hits;
          const resultLength = hits.length;
          const totalResults = agentList.body.hits.total;
          console.log(`resultLength: ${resultLength}`);
          console.log(`totalResults: ${totalResults}`);
          const respAgents = resultLength
            ? hits.map(agent => ({ ...agent._source, _score: agent._score })) : [];
          agents = [...agents, ...respAgents];
          hasAfter = recFrom + size < totalResults;
          if (hasAfter) {
            recFrom = size * count;
            count += 1;
          }
        } else {
          return success({ status: true, result: [] });
        }
      } while (hasAfter);

    } else {

      console.log(`agentListQuery: ${JSON.stringify(agentListQuery)}`);
      const agentList = await elasticExecuteQuery(agentListQuery, true);
      console.log(`agentList: ${JSON.stringify(agentList)}`);

      if (
        agentList &&
        agentList.statusCode === 200 &&
        agentList.body &&
        agentList.body.hits &&
        agentList.body.hits.hits &&
        agentList.body.hits.hits.length
      ) {

        const { hits } = agentList.body.hits;
        const resultLength = hits.length;
        const totalResults = agentList.body.hits.total;
        console.log(`resultLength: ${resultLength}`);
        console.log(`totalResults: ${totalResults}`);
        agents = resultLength ? hits.map(agent => {
          const agentObj = { ...agent._source, _score: agent._score };
          return agentObj;
        }) : []
        agentPage = {
          after: resultLength ? [...hits[resultLength - 1].sort] : [],
          hasAfter: from + size < totalResults,
          totalResults
        }

      } else {
        return success({ status: true, result: [] });
      }
    }

    console.log(`agents: `, agents);

    // Map agent id to full name
    const agentIdNameMap = agents.reduce((idNameMap, ag) => {
      idNameMap[ag.id] = `${ag.fname} ${ag.lname}`;
      return idNameMap;
    }, {});

    console.log(`agentIdName: `, agentIdNameMap);

    const activityQuery = {
      httpMethod: "POST",
      requestPath: `/_search`,
      payload: {
        query: {
          bool: {
            must: [
              {
                term: { "atype.keyword": `${aType}` }
              },
              {
                match_phrase_prefix: {
                  entity: `activity#${hbId}`
                }
              },
              {
                range: {
                  dt: {
                    gte: startDate,
                    lte: endDate
                  }
                }
              }
            ]
          }
        }
      },
    }

    if (aType === "appointment") {

      // filter activity using sales agent id's to fetch the 
      // activities for those agents in the date range.
      activityQuery.payload.query.bool.must.push({
        bool: {
          should: Object.keys(agentIdNameMap).map(agentId =>
            ({ term: { "wit.keyword": agentId } })
          )
        }
      })

      activityQuery.payload.aggs = {
        agents: {
          composite: {
            sources: [
              {
                agent: {
                  terms: {
                    field: "wit.keyword"
                  }
                }
              },
              {
                customer: {
                  terms: {
                    field: "rel_id.keyword"
                  }
                }
              },
              {
                status: {
                  terms: {
                    field: "status.keyword"
                  }
                }
              }
            ]
          }
        }
      }

      activityQuery.payload._source = {
        includes: ["wit", "status", "rel_id"]
      }

      console.log(`apptSummQuery: ${JSON.stringify(activityQuery)}`);

      let apptBucket = [];
      let afterKey;

      do {
        if (afterKey) {
          activityQuery.payload.aggs.agents.composite.after = { ...afterKey };
        }
        const apptSumm = await elasticExecuteQuery(activityQuery, true);

        if (
          apptSumm &&
          apptSumm.statusCode === 200 &&
          apptSumm.body &&
          apptSumm.body.hits &&
          apptSumm.body.hits.hits
        ) {

          const { hits } = apptSumm.body.hits;
          const resultLength = hits.length;
          const totalResults = apptSumm.body.hits.total;
          console.log(`resultLength: ${resultLength}`);
          console.log(`totalResults: ${totalResults}`);
          // store the aggregation results.
          apptBucket = [...apptBucket, ...apptSumm.body.aggregations.agents.buckets ?? []];
          afterKey = apptSumm.body.aggregations.agents.after_key;
        } else {
          return failure({ status: false, result: [], error: "Unable to find appointments" })
        }
      } while (afterKey);

      console.log(`apptBucket :: `, JSON.stringify(apptBucket));
      const customerIdList = [...new Set(apptBucket.map(bucket => bucket.key.customer))];
      console.log(`Customer ID List :: ${JSON.stringify(customerIdList)}`);

      if (!customerIdList.length) {
        result = Object.keys(agentIdNameMap).map(agentId => ({
          sales_agent: agentIdNameMap[agentId],
          customers: []
        }));
      } else {
        const customers = await fetchCustomers(customerIdList, hbId);
        console.log(`Customers :: ${JSON.stringify(customers)}`);
        const customerMap = customers.reduce((idMap, cust) => {
          idMap[cust.id] = { ...cust };
          return idMap;
        }, {});
        const appointmentCount = await getAgentAppointmentCounts(agentIdNameMap, apptBucket, customerMap, isEmptyShown)
        console.log(`Customers :: ${JSON.stringify(customers)}`);
        console.log(`Appointment count :: ${JSON.stringify(appointmentCount)}`);



        result = await addCustomerDetails(customerMap, appointmentCount);
      }

      console.log(`appointments count result :: `, result);
    }

    if (aType === "task") {

      // filter activity using sales agent id's to fetch the 
      // activities for those agents in the date range.
      activityQuery.payload.query.bool.must.push({
        bool: {
          should: Object.keys(agentIdNameMap).map(agentId =>
            ({ term: { "assi.keyword": agentId } })
          )
        }
      })

      activityQuery.payload._source = {
        includes: ["assi", "status", "rel_id", "dt"]
      }

      let count = 1;
      let hasAfter = false;
      let recFrom = 0;
      let tasks = [];
      let after = [];
      let activityQuerySize = 1000;
      activityQuery.payload.sort = [
        { "rel_id.keyword": "asc" }
      ];

      do {

        //debugger
        console.log(`recFrom: ${JSON.stringify(recFrom)}`);

        activityQuery.payload.size = activityQuerySize;

        if (recFrom + activityQuerySize > 10000 && after.length) {
          activityQuery.payload.search_after = after;
          activityQuery.payload.from = 0;
        } else {
          activityQuery.payload.from = recFrom;
        }

        console.log(`tasksQuery count ${count}: ${JSON.stringify(activityQuery)}`);
        const taskList = await elasticExecuteQuery(activityQuery, true);
        console.log(`tasksList count ${count}: ${JSON.stringify(taskList)}`);

        if (
          taskList &&
          taskList.statusCode === 200 &&
          taskList.body &&
          taskList.body.hits &&
          taskList.body.hits.hits
        ) {
          const { hits } = taskList.body.hits;
          const resultLength = hits.length;
          const totalResults = taskList.body.hits.total;

          console.log(`resultLength: ${resultLength}`);
          console.log(`totalResults: ${totalResults}`);

          const respTasks = resultLength
            ? hits.map(task => ({ ...task._source, _score: task._score })) : [];

          tasks = [...tasks, ...respTasks];
          after = resultLength && hasAfter ? [...hits[resultLength - 1].sort] : [];
          hasAfter = totalResults > recFrom + activityQuerySize;

          //debugger
          console.log(`hasAfter: ${JSON.stringify(hasAfter)}`);

          if (hasAfter) {
            recFrom = activityQuerySize * count;
            count += 1;
          }
        } else {
          throw new Error('Unable to fetch from elastic db')
        }
      } while (hasAfter);

      console.log(`Tasks List : `, tasks);

      const customerIdList = [...new Set(tasks.map(task => task.rel_id))];
      console.log(`customerIdList :: ${JSON.stringify(customerIdList)}`);

      if (!customerIdList.length) {
        result = Object.keys(agentIdNameMap).map(agentId => ({
          sales_agent: agentIdNameMap[agentId],
          customers: [],
          'overdue': 0,
          'pending': 0,
          'complete': 0
        }));
      } else {

        //debugger
        console.log(`customerIdList length: ${JSON.stringify(customerIdList.length)}`);
        let start = 0;
        let end = 2000;
        const arraySize = 2000;
        let customers = [];
        let hasAfter = true;

        do {
          //debugger
          console.log(`start: ${JSON.stringify(start)}`);
          console.log(`end: ${JSON.stringify(end)}`);
          const customersArray = await fetchCustomers(customerIdList.slice(start, end), hbId);
          customers = [...customers, ...customersArray];
          hasAfter = customerIdList.length > end;
          if (hasAfter) {
            start += arraySize;
            end += arraySize;
          };
        } while (hasAfter);
        console.log(`Customers :: ${JSON.stringify(customers)}`);
        const customerMap = customers.reduce((idMap, cust) => {
          idMap[cust.id] = { ...cust };
          return idMap;
        }, {});
        const tasksCount = await getAgentTaskCounts(agentIdNameMap, tasks, customerMap, isEmptyShown)
        // const [tasksData, customersData] = combinedResults;
        // const customers = customersData.value;
        // const tasksCount = tasksData.value;
        console.log(`Tasks count :: ${JSON.stringify(tasksCount)}`);
        console.log(`customerMap: ${JSON.stringify(customerMap)}`);
        result = await addCustomerDetails(customerMap, tasksCount);
        console.log(`result: ${JSON.stringify(result?.result?.customers || {})}`);
      }
      console.log(`tasks count result :: `, result);
    }

    if (!render) {
      return success({ status: true, result, ...agentPage });
    }

    return success({ status: true, result });

  } catch (error) {
    console.log(`error: ${error}`);
    return failure({ status: false, error: error.message });
  }
}

export const getLastContactReport = async (data) => {
  console.log(`getLastContactReport :: params :: ${JSON.stringify(data)}`);
  const {
    hb_id: hbId,
    showType = "dash",
    from = 0,
    after = "",
    size = 5,
    startDate = "",
    endDate = "",
    comm = [],
    stages = []
  } = data;
  let result = {};
  let afterNext;
  let hasAfter = false;
  try {
    if (!hbId || !startDate || !endDate)
      return failure({ status: false, error: "Missing 1 or more necessary fields [hbId,startDate,endDate]" });
    if (!["dash", "report"].includes(showType)) {
      return failure({ status: false, error: "Invalid showType" })
    }

    // For showType = "dash", get paginated customers
    // For showType = "report", get all customers, get community names

    const custQuery = {
      httpMethod: "POST",
      requestPath: `/_search`,
      payload: {
        query: {
          bool: {
            must: [
              {
                term: { "hb_id.keyword": `${hbId}` }
              },
              {
                term: { "entity.keyword": `customer#${hbId}` }
              },
              {
                range: {
                  dt: {
                    gte: startDate,
                    lte: endDate
                  }
                }
              }
            ]
          },
        },
        _source: {
          includes: [
            "id", "fname", "lname",
            "rnstr", "stage", "email",
            "inte", "cdt", "dt", "phone", "jdt",
            "grade"
          ]
        },
        sort: [
          { "fname.keyword": "asc" },
          { "id.keyword": "asc" }
        ],
        size,
        from
      }
    }
    if (stages && stages.length) {
      const stageList = stages.map((stage) => keyStages[stage]);
      custQuery.payload.query.bool.must.push({
        terms: { "stage.keyword": stageList }
      })
    }
    if (comm && comm.length) {
      custQuery.payload.query.bool.must.push({
        terms: { "inte.keyword": comm }
      })
    }

    console.log(`custQuery :: ${JSON.stringify(custQuery)}`);

    if (showType === "dash") {

      if (from + size > 10000 && after.length) {
        custQuery.payload.search_after = after;
        custQuery.payload.from = 0;
      }
      const custList = await elasticExecuteQuery(custQuery, true);
      console.log(`custList :: ${JSON.stringify(custList)}`);
      if (
        custList &&
        custList.statusCode === 200 &&
        custList.body &&
        custList.body.hits &&
        custList.body.hits.hits &&
        custList.body.hits.hits.length
      ) {
        const { hits } = custList.body.hits;
        const resultLength = hits.length;
        const totalResults = custList.body.hits.total;
        console.log(`resultLength: ${resultLength}`);
        console.log(`totalResults: ${totalResults}`);
        result = resultLength ? hits.map(cust => ({ ...cust._source, _score: cust._score })) : [];
        afterNext = resultLength ? [...hits[resultLength - 1].sort] : [];
        hasAfter = from + size < totalResults;
      } else {
        console.log("Empty result");
        result = [];
      }
    }

    if (showType === "report") {
      const commQuery = [
        {
          term: { "hb_id.keyword": `${hbId}` }
        },
        {
          term: { "entity.keyword": `community#${hbId}` }
        },
        {
          term: { "type.keyword": `community` }
        }
      ]
      if (comm && comm.length) {
        commQuery.push({ terms: { "id.keyword": comm } });
      }
      const commProjFields = ["id", "name", "type"];

      const gradeQuery = [
        {
          term: { "hb_id.keyword": hbId }
        },
        {
          term: { "type.keyword": 'grade' }
        },
        {
          term: { "entity.keyword": `grade#${hbId}` }
        }
      ];

      const gradePromise = doPaginatedQueryEllastic({
        isCustomParam: true,
        customParams: gradeQuery,
        projectFields: ["id", "name", "type"]
      });

      const commPromise = doPaginatedQueryEllastic({
        isCustomParam: true,
        customParams: commQuery,
        projectFields: commProjFields
      });

      const custPromise = doPaginatedQueryEllastic({
        isCustomParam: true,
        customParams: custQuery.payload.query.bool.must,
        projectFields: custQuery.payload._source.includes
      });

      const [customerResult, communityResult, gradeResult] = await Promise.allSettled([
        custPromise,
        commPromise,
        gradePromise
      ]);

      console.log(`Customer result: ${JSON.stringify(customerResult)}`);
      console.log(`Community result: ${JSON.stringify(communityResult)}`);
      console.log(`Grade result: ${JSON.stringify(gradeResult)}`);

      const errors = [];

      result.customerList = customerResult.status === "fulfilled" ? customerResult.value : [];
      result.communityList = communityResult.status === "fulfilled" ? communityResult.value : [];
      result.gradeList = gradeResult.status === "fulfilled" ? gradeResult.value : [];


      // Collect errors
      if (customerResult.status === "rejected") {
        errors.push(customerResult.reason);
      }
      if (communityResult.status === "rejected") {
        errors.push(communityResult.reason);
      }
      if (gradeResult.status === "rejected") {
        errors.push(gradeResult.reason);
      }
      if (errors.length) {
        throw new Error(`${errors.join(', ')}`);
      }
    }
    console.log(`getLastContactReport :: showType :: ${showType} :: result :: ${JSON.stringify(result)}`);
    return success({ status: true, result, after: afterNext, hasAfter });
  } catch (error) {
    console.log(`Error in getLastContactReport :: `, error);
    return failure({ status: false, error });
  }
}

async function getNotesPaginated(data) {
  console.log(`getNotesPaginated :: params :: ${JSON.stringify(data)}`);
  const {
    hb_id: hbId,
    from = 0,
    after = [],
    size = 5,
    startDate = "",
    endDate = "",
    id,
    isCustList = false,
    isReport = false,
  } = data;
  try {

    if (!hbId) throw new Error("hbId missing");
    if (!startDate || !endDate) throw new Error("Invalid date range specified");

    const notesQuery = {
      httpMethod: "POST",
      requestPath: `/_search`,
      payload: {
        query: {
          bool: {
            filter: [
              {
                term: { "hb_id.keyword": hbId }
              },
              {
                "prefix": { "entity.keyword": `activity#${hbId}#note` }
              },
              {
                range: {
                  cdt: {
                    gte: startDate,
                    lte: endDate
                  }
                }
              }
            ]
          }
        },
        sort: [
          {
            "mdt": {
              "order": "desc"
            }
          }
        ],
        size,
        from,
        _source: isCustList ? { includes: ["rel_id"] } : true
      }
    }

    if (!isCustList && !isReport) {
      if (!id) throw new Error("customer id missing")
      notesQuery.payload.query.bool.filter.push({ term: { "rel_id.keyword": id } });
      notesQuery.payload.size = size;
      notesQuery.payload.from = from;
      if (from + size > 10000 && after.length) {
        notesQuery.payload.search_after = after;
        delete notesQuery.payload.from;
      }
    }

    if (isReport) {
      delete notesQuery.payload._source;
      console.log(`notesQuery :: isReport:true :: ${JSON.stringify(notesQuery)}`);
      const notesList = await doPaginatedQueryEllastic({
        isCustomParam: true,
        customParams: notesQuery.payload.query.bool.filter,
      });
      return notesList;
    }

    // check to retrieve only the rel_id of the notes to filter customers
    if (isCustList) {
      notesQuery.payload._source = { includes: ["rel_id"] };
      console.log(`notesQuery return rel_id only :: ${JSON.stringify(notesQuery)}`);
      const idList = await doPaginatedQueryEllastic({
        isCustomParam: true,
        customParams: notesQuery.payload.query.bool.filter,
        projectFields: notesQuery.payload._source.includes
      });
      console.log(`notesQuery rel_id result :: ${JSON.stringify(idList)}`);
      return idList;
    }

    console.log(`notesQuery all fields result :: ${JSON.stringify(notesQuery)}`);
    const notesResult = await elasticExecuteQuery(notesQuery, true);
    console.log(`notesResult : ${JSON.stringify(notesResult)}`);
    let notes;
    if (
      notesResult &&
      notesResult.statusCode === 200 &&
      notesResult.body &&
      notesResult.body.hits &&
      notesResult.body.hits.hits
    ) {
      const { hits } = notesResult.body.hits;
      const resultLength = hits.length;
      const totalResults = notesResult.body.hits.total;
      console.log(`notesResult :: resultLength: ${resultLength}`);
      console.log(`notesResult :: totalResults: ${totalResults}`);
      notes = resultLength ?
        hits.map(note => ({ ...note._source, _score: note._score }))
        : []
      const afterNext = resultLength ? [...hits[resultLength - 1].sort] : [];
      const hasAfter = (from + size) < totalResults;
      return success({ notes, hasAfter, afterNext })
    }
    throw new Error("Error fetching notes");
  } catch (error) {
    console.log('Error in getNotesPaginated :: ', error);
    return failure({ error })
  }
}

export async function getNotesReport(data) {
  console.log(`getNotesReport :: params :: ${JSON.stringify(data)}`);
  const {
    hb_id: hbId,
    showType = "dash",
    from = 0,
    size = 5000,
    startDate = "",
    endDate = "",
    comm = [],
    stages = []
  } = data;

  const custQuery = {
    payload: {
      query: {
        bool: {
          filter: [
            {
              term: { "hb_id.keyword": `${hbId}` }
            },
            {
              term: { "entity.keyword": `customer#${hbId}` }
            }
          ]
        },
      },
      _source:
      {
        includes: [
          "id", "fname", "lname",
          "rnstr", "stage", "email",
          "inte", "cdt", "mdt", "phone", "jdt"
        ]
      }
      ,
      sort: [
        { "fname.keyword": "asc" },
        { "id.keyword": "asc" }
      ],
      size,
      from
    }
  }

  if (stages && stages.length) {
    custQuery.payload.query.bool.filter.push({
      terms: { "stage.keyword": stages.map(stage => keyStages[stage]) }
    })
  }

  if (comm && comm.length) {
    custQuery.payload.query.bool.filter.push({
      terms: { "inte.keyword": comm }
    })
  }

  console.log(`custQuery :: ${JSON.stringify(custQuery)}`);

  const notesParams = {
    hb_id: hbId,
    size: 500,
    startDate,
    endDate,
    isCustList: true
  }
  try {
    if (showType === "dash") {

      const custIdList = await getNotesPaginated(notesParams)

      custQuery.payload.query.bool.filter.push({
        terms: { "id.keyword": custIdList.map(cust => cust.rel_id) }
      })

      const custResult = await doPaginatedQueryEllastic({
        isCustomParam: true,
        customParams: custQuery.payload.query.bool.filter,
        projectFields: custQuery.payload._source.includes
      });

      return success({ status: true, result: custResult });
    }
  } catch (error) {
    console.log("Error in getNotesReport : dash api :: ", error);
    return failure({ error })
  }

  try {
    if (showType === "report") {
      notesParams.size = 5000;
      notesParams.isCustList = false;
      notesParams.isReport = true;
      const [notesList, customerList] = await Promise.allSettled([
        getNotesPaginated(notesParams),
        doPaginatedQueryEllastic({
          isCustomParam: true,
          customParams: custQuery.payload.query.bool.filter,
          projectFields: custQuery.payload._source
        })]);

      console.log("NotesList :: ", notesList);
      console.log("CustomerList :: ", customerList);

      const errors = [];
      if (notesList.status === "rejected") errors.push(notesList.reason);
      if (customerList.status === "rejected") errors.push(customerList.reason);

      if (errors.length) {
        return failure({ error: errors, status: false });
      }
      return success({
        notes: notesList.value,
        customers: customerList.value, status: true
      });
    }
  } catch (error) {
    console.log("Error in getNotesReport : report api :: ", error);
    return failure({ error })
  }
  return failure({ error: "Invalid showType" })
}

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
    console.log(`event: ${JSON.stringify(event)}`);
    const action =
      event && event.pathParameters && event.pathParameters.action
        ? event.pathParameters.action
        : 0;
    let data;
    switch (event.httpMethod) {
      /* case 'GET':
          
          break; */
      case "POST":
        data = JSON.parse(event.body);
        if (!data) {
          response = failure();
        } else if (action === "generate_new") {
          response = await sourceAndInfluencePagination(data);
        } else if (action === "realtor_report") {
          response = await realtorReport(data);
        } else if (action === "counts") {
          response = await getCountsReport(data);
        } else if (action === "init") {
          response = await initGenerateReport(data);
        } else if (action === "get_status") {
          response = await getStatus(data);
        } else if (action === "lastcontact") {
          response = await getLastContactReport(data);
        } else if (action === "customer_notes") {
          response = await getNotesReport(data);
        } else if (action === "notes_page") {
          response = await getNotesPaginated(data);
        }
        else {
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
