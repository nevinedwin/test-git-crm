import { transactWriteItems } from "../libs/db";
import { failure, success } from "../libs/response-lib";
import { elasticExecuteQuery } from "../search/search";

/**
 * 
 * @param {Object} data 
 * @returns Detailed List of Paginated Users
 */
export async function fetchAnyUsers(data) {
  const { hbId, type = 'agent', size = 500, from = 0, after = [], uType = [] } = data;
  try {
    if (!hbId) {
      throw new Error("Home Builder ID not found");
    }
    const userListQuery = {
      httpMethod: "POST",
      requestPath: `/_search`,
      payload: {
        query: {
          bool: {
            must: [
              {
                term: { "hb_id.keyword": `${hbId}` }
              },
              { term: { "type.keyword": `${type}` } }
            ],
          },
        },
        _source: {
          includes: [
            "id", "fname", "lname", "email", "comm"
          ]
        },
        sort: [
          { "fname.keyword": "asc" },
          { "id.keyword": "asc" }
        ]
      },
    };
    if (uType.length) {
      userListQuery.payload.query.bool.must.push({
        bool: {
          should: uType.map(user => ({ term: { "utype.keyword": user } }))
        }
      })
    }

    userListQuery.payload.size = size;
    userListQuery.payload.from = from;
    // If after is provided and the from + size is greater than 10000, use the search_after parameter in the query.
    // This is done because of the index.max-result-window limit of 10000 set by Elasticsearch.
    if (from + size > 10000 && after.length) {
      userListQuery.payload.search_after = after;
      // In this case we should set from as 0
      userListQuery.payload.from = 0;
    }

    console.log(`userListQuery :: ${JSON.stringify(userListQuery)}`);
    const userList = await elasticExecuteQuery(userListQuery, true);
    let users;
    if (
      userList &&
      userList.statusCode === 200 &&
      userList.body &&
      userList.body.hits &&
      userList.body.hits.hits &&
      userList.body.hits.hits.length
    ) {
      const { hits } = userList.body.hits;
      const resultLength = hits.length;
      const totalResults = userList.body.hits.total;
      console.log(`resultLength: ${resultLength}`);
      console.log(`totalResults: ${totalResults}`);
      users = resultLength
        ? hits.map(user => ({ ...user._source, _score: user._score })) : [];
      return success({
        status: true,
        result: users,
        after: resultLength ? [...hits[resultLength - 1].sort] : [],
        hasAfter: from + size < totalResults,
        totalResults
      })
    }
    return success({ status: true, result: [] });

  } catch (error) {
    console.log(`error: ${error}`);
    return failure({ status: false, error: error.message })
  }
}
/**
 * 
 * @param {Object} data 
 * @returns Detailed Customer list. Supports pagination
 */
export async function fetchCustomersForAgents(data) {
  const {
    hbId,
    size = 5000,
    agentId = null,
    from = 0,
    after = "",
    customers: customerIdList = [],
    isTransfer = false,
    stage = [],
    sort = []
  } = data;

  try {

    if (!agentId) {
      throw new Error("Agent Id not provided");
    }

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
              },
              {
                terms: {
                  "newinte.keyword": [
                    agentId
                  ]
                }
              }
            ]
          }
        },
        _source: {
          includes: ["id", "fname", "lname", "email", "stage", "inte", "newinte", "cdt", "mdt", "phone"]
        },
        size,
        from
      }
    }

    if (stage.length) {
      fetchCustomersQuery.payload.query.bool.must.push({
        bool: {
          should: stage.map(eachStage => ({
            match: {
              "stage.keyword": eachStage
            }
          }))
        }
      })
    };

    if (sort.length) {
      fetchCustomersQuery.payload.sort = [];
      for (const sortField of sort) {
        fetchCustomersQuery.payload.sort.push({
          [`${sortField.field}${sortField.field !== "cdt" && sortField.field !== "mdt"
            ? ".keyword"
            : ""
            }`]: sortField.order
        })
      }

      fetchCustomersQuery.payload.sort.push({
        "id.keyword": "asc",
      });
    } else {
      fetchCustomersQuery.payload.sort = [
        { "fname.keyword": "asc" },
        { "id.keyword": "asc" }
      ]
    }

    if (isTransfer) {
      if (customerIdList.length) {
        fetchCustomersQuery.payload.query.bool.must.push({
          bool: {
            should: customerIdList.map(id => ({
              match: {
                "id.keyword": id
              }
            }))
          }
        })
      }
      let hasAfter = false;
      let recAfter = [];
      let customers = [];
      do {
        if (hasAfter) {
          fetchCustomersQuery.payload.search_after = recAfter;
        }
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
          hasAfter = size < totalResults;
          recAfter = resultLength && hasAfter ? [...hits[resultLength - 1].sort] : [];
        }
      } while (hasAfter);
      return customers
    }

    if (size + from > 10000 && after.length) {
      fetchCustomersQuery.payload.search_after = after;
    }

    console.log(`fetchCustomersQuery :: ${JSON.stringify(fetchCustomersQuery)}`);
    const customerList = await elasticExecuteQuery(fetchCustomersQuery, true);
    let customers;
    if (customerList &&
      customerList.statusCode === 200 &&
      customerList.body &&
      customerList.body.hits &&
      customerList.body.hits.hits &&
      customerList.body.hits.hits.length
    ) {
      const { hits } = customerList.body.hits;
      const resultLength = hits.length;
      const totalResults = customerList.body.hits.total;
      console.log(`resultLength: ${resultLength}`);
      console.log(`totalResults: ${totalResults}`);
      customers = resultLength ? hits.map(cust => ({ ...cust._source, score: cust._score })) : []
      return success({
        status: true,
        result: customers,
        after: resultLength ? [...hits[resultLength - 1].sort] : [],
        hasAfter: from + size < totalResults,
        totalResults
      })
    }
    return success({ status: true, result: [] });

  } catch (error) {
    console.log(`Error in fetchCustomers : ${error.message}`);
    return failure({ status: false, error: error.message })
  }
}
/**
 * 
 * @param {List} customerList 
 * @param {UUID} fromAgentId 
 * @param {UUID} toAgentId 
 * @param {UUID} hbId 
 * @returns DynamoDB transaction items
 */
async function createTransactItems(customerList, fromAgentId, toAgentId, hbId) {
  let transactItems = [];
  for (const customer of customerList) {
    const salesAgents = new Set(customer.newinte);
    salesAgents.delete(fromAgentId)
    salesAgents.add(toAgentId)
    transactItems = [
      ...transactItems,
      {
        Update: {
          UpdateExpression: `set #agents = :newagents`,
          ExpressionAttributeNames: {
            "#agents": "newinte"
          },
          ExpressionAttributeValues: {
            ":newagents": Array.from(salesAgents).map(agentId => agentId)
          },
          TableName: process.env.entitiesTableName,
          Key: {
            id: customer.id,
            entity: `customer#${hbId}`
          },
          ReturnValues: "ALL_NEW"
        }
      }
    ]
  }
  return transactItems
}

async function startCustomerTransfer(data) {
  const { hbId, fromAgent, toAgent, customers = [] } = data;
  try {
    if (!fromAgent || !toAgent || !hbId) {
      throw new Error("Required fields missing");
    }
    const customerDetailsParams = {
      hbId,
      size: 1000,
      agentId: fromAgent,
      customers,
      isTransfer: true
    }
    const customerDetails = await fetchCustomersForAgents(customerDetailsParams);
    if (!customerDetails || !customerDetails.length) {
      throw new Error('Error in customer details');
    }
    const transactItems = await createTransactItems(customerDetails, fromAgent, toAgent, hbId);
    const transactWriteParams = {
      TransactItems: [...transactItems]
    }
    console.log(`transactWriteParams: ${JSON.stringify(transactWriteParams)}`);
    const transactWriteResp = await transactWriteItems(transactWriteParams);
    console.log(`transactWriteResp: ${JSON.stringify(transactWriteResp)}`);
    return transactWriteResp;
  } catch (error) {
    console.log(`Error in startCustomerTransfer : ${error.message}`);
    return failure({ status: false, error: error.message })
  }
}

export async function main(event) {
  let response;
  try {
    console.log(`Event: ${JSON.stringify(event)}`);
    const action = event?.pathParameters?.action || 0;
    const hbId = event?.pathParameters?.hbid || 0;
    const data = JSON.parse(event.body);
    switch (event.httpMethod) {
      case 'POST':
        if (action === 'fetchUsers') {
          response = await fetchAnyUsers({ ...data, hbId })
        } else if (action === 'fetchCustomers') {
          response = await fetchCustomersForAgents({ ...data, hbId });
        } else if (action === 'start') {
          response = await startCustomerTransfer({ ...data, hbId })
        }
        else {
          response = failure()
        }
        break;
      default:
        response = failure()
        break;
    }
  } catch (error) {
    console.log(error);
    return failure({ status: false, error: error?.message || error });
  }
  return response
}