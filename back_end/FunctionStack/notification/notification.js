import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import { doPaginatedQueryEllastic, batchWriteItems, updateResources, listEntitiesElastic } from "../libs/db";
import { failure, success } from "../libs/response-lib";
import { getSocketConfig } from "../admin/admin";
import { elasticExecuteQuery } from "../search/search";


const { WEBSOCKET_POST_URL, WEBSOCKET_URL, entitiesTableName } = process.env;

/**
 * Method that returns a promise to send notification to given connection
 * @param {URL} webSocketURL 
 * @param {string} notificationType specify the notification type such as `CHAT`, `LEAD`, `CREATE` or `OTHERS`
 * @param {string} connectionId websocket connectionId
 * @param {string} auth Bearer token
 * @param {string} [payload=""] A string value to add more data
 */
async function sendNotification({ webSocketURL, notificationType, payload = "", connectionId}) {

  console.log("sendNotification params :: ");
  console.log(webSocketURL, notificationType, payload = "", connectionId);
  try {
    const apigwManagementApi = new AWS.ApiGatewayManagementApi({
      endpoint: webSocketURL
    });
    const postBody = {
      ConnectionId: connectionId,
      Data: Buffer.from(JSON.stringify({ type: notificationType, payload }))
    }
    console.log(`postBody: ${JSON.stringify(postBody)}`);
    const sendResp = await apigwManagementApi.postToConnection(postBody).promise();
    console.log("SendResp :: ", JSON.stringify(sendResp));
  } catch (error) {
    console.log("Error in sendNotification :: ");
    console.log(error);
  }

}
/**
 * Method to fetch Users for sending notification, based on socket config
 * @param {Array<String>} userTypes list of user types - valid types `"admin"`, `"agent"`, `"online_agent"`
 * @param {UUID} hbId unique identifier for builders
 * @param {Array<UUID>} communityList list of community ids
 * @param {UUID} [singleUser=null] to get connectionId of a particular  `"agent"` in the case of `LEADS` assign
 */
async function getUsersForNotification(userTypes=[], hbId, communityList, singleUser = null) {
  try {
    console.log("getUsersForNotification params :: ");
    console.log(userTypes, hbId, communityList);
    if(!hbId) return {status: false, message: "hbId not provided"}
    if (userTypes.length) {
      let allowedUsers = [];
      const elasticParams = {
        hb_id: hbId,
        projectFields: ["id", "connectionIds"],
        sort: [{ field: "id", order: "asc" }],
        isCustomParam: true,
        customParams: []
      }
      if (userTypes.includes("agent") && !(singleUser)) {
        elasticParams.customParams = [
          {
            term: { "utype.keyword": "agent" }
          },
          {
            terms: {
              "comm.keyword": communityList
            }
          }
        ]
        const allowedAgents = await doPaginatedQueryEllastic(elasticParams);
        allowedUsers = [...allowedAgents];
      }
      // Now filter out agent if it was used earlier and generate query for the remaining userTypes if exists
      const filteredUserTypes = userTypes.filter(user => user !== "agent");
      if (filteredUserTypes.length) {
        elasticParams.customParams = [
          {
            bool: {
              should:filteredUserTypes.map(user => ({term: {"utype.keyword": user}}))
            }
          }
        ];
        const users = await doPaginatedQueryEllastic(elasticParams);
        allowedUsers = [...allowedUsers, ...users];
      }

      if (singleUser) {
        const singleUserQuery = {
          hb_id: hbId,
          projectFields: ["id", "connectionIds"],
          sort: [{ field: "id", order: "asc" }],
          isCustomParam: true,
          customParams: [
            {
              term: {"id.keyword" : singleUser}
            },
            {
              term: { "utype.keyword": "agent" }
            }
          ]
        }
        console.log("singleUserQuery ::: ", singleUserQuery);
        const userDetail = await listEntitiesElastic(singleUserQuery);
        if (userDetail.status) {
          allowedUsers = [...allowedUsers, ...userDetail.result]
        }
      }

      return { status: true, result: allowedUsers }
    } 
    return {status: false}
  } catch (error) {
    console.log("Error in getUsersForNotification :: ");
    console.log(error);
    return { status: false }
  }
}
/**
 * Method to create db param in batches for notification batch write
 * @param {Array<UUID>} userList 
 * @param {UUID} hbId 
 * @param {Object} customerData - `id`, `fullname` and other details of customer
 */
async function getBatchNotification(userList, hbId, customerData) {
  const notificationBatch = [];
  userList.forEach(user => {
    notificationBatch.push({
      PutRequest: {
        Item: {
          id: uuidv4(),
          entity: `notification#${hbId}#user#${user.id}`,
          hbid: hbId,
          mdt: Date.now(),
          cdt: Date.now(),
          data: 'false',
          ...customerData
        }
      }
    })
  });
  return notificationBatch;
}

/**
 * Method to create notifications based on the context passed.
 * @param {object} data - contains `hbId`, `customerData`, `userId`
 * @param {string} context - set the context to generate notification
 */
async function createNotifications(data, context) {
  try {
    const { hbId, customerData, auth } = data;
    let singleAgent = null;
    // Get socket config of the builder
    let socketConfig = await getSocketConfig({ hbId });
    socketConfig = JSON.parse(socketConfig.body)
    console.log("socket config ", socketConfig);

    // Use config for leads notification.
    const allowedUserTypes = context === "external" ? socketConfig.newinte : socketConfig.oldinte;
    console.log("allowedUserTypes : ", allowedUserTypes);
    let commList = []
    if (allowedUserTypes.includes('agent')) {
      commList = customerData.comm;
      singleAgent = data.userId ?? null;
    }

    // Get notification allowedUsers
    const allowedUsers = await getUsersForNotification(allowedUserTypes, hbId, commList, singleAgent);
    console.log("Allowed Users :: ", JSON.stringify(allowedUsers));
    if (!allowedUsers.status) {
      return failure({ status: false, message: "Error in fetching users for notification" })
    }
    // Save notifications to db for permitted users
    const batchNotifItems = await getBatchNotification(allowedUsers.result, hbId, customerData);
    const batchParams = {
      RequestItems: {
        [process.env.entitiesTableName]: [...batchNotifItems]
      }
    };
    console.log(`batch Params :: ${JSON.stringify(batchParams)}`);
    const batchWriteResp = await batchWriteItems(batchParams);
    console.log(`batchWriteResp: ${JSON.stringify(batchWriteResp)}`);

    const batchWriteBody = batchWriteResp.body
      ? JSON.parse(batchWriteResp.body)
      : {};
    console.log(`batchWriteBody: ${JSON.stringify(batchWriteBody)}`);
    const unProcessedItems =
      batchWriteBody &&
        batchWriteBody.resp &&
        batchWriteBody.resp.UnprocessedItems
        ? batchWriteBody.resp.UnprocessedItems
        : {};
    console.log(`unProcessedItems: ${JSON.stringify(unProcessedItems)}`);
    const isBatchSuccess = !!(
      Object.entries(unProcessedItems).length === 0 &&
      unProcessedItems.constructor === Object
    );
    console.log(`isBatchSuccess: ${JSON.stringify(isBatchSuccess)}`);
    if (!isBatchSuccess) {
      console.log("Batch write notification failed");
      return failure({ status: false, error: "Unable to batch write notifications" })
    }

    // Send notifications for permitted users
    const notificationPromise = [];
    if (allowedUsers && allowedUsers.result) {
      allowedUsers.result.forEach(user => {
        const connectionIds = user.connectionIds ?? null;
        if (connectionIds) {
          const notifParams = {
            webSocketURL: WEBSOCKET_POST_URL,
            notificationType: context === "external" ? "CREATE" : "ASSIGN",
            connectionId: connectionIds,
            auth
          }
          notificationPromise.push(sendNotification(notifParams));
        }
      });
    }
    const combinedResults = await Promise.allSettled(notificationPromise);
    console.log("CreateNotifications :: CombinedResults :: ", JSON.stringify(combinedResults));

    return success({ status: true, message: 'Successfully send notification' });
  } catch (error) {
    console.log("Error in createNotifications :: ", error);
    return failure({ status: false, error })
  }
}
/**
 * Method to fetch the notifications for a user of home builder.
 * @param {object} - with keys `hbId`, `userId`, `from`, `size`, `after`
 * @returns paginated notification response
 */
async function getUserNotification({ hbId, userId, from = 0, size = 5, after = [] }) {
  if (!hbId || !userId) return failure({error: "Invalid request parameters"});
  let dt = new Date();
  dt = dt.setDate(dt.getDate() - 2);
  const notificationListQuery = {
    httpMethod: "POST",
    requestPath: `/_search`,
    payload: {
      query: {
        bool: {
          must: [
            {
              term: { "hbid.keyword": `${hbId}` }
            },
            {
              match_phrase: { "entity.keyword": `notification#${hbId}#user#${userId}` }
            },
            {
              range: {
                cdt: {
                  gte: dt,
                  lte: Date.now()
                }
              }
            }
          ],
        },
      },
      sort: [
        {"cdt": "desc"}
      ],
      size,
      from
    }
  }
  if (from + size > 10000 && after.length) {
    notificationListQuery.payload.search_after = after;
    notificationListQuery.payload.from = 0;
  }
  console.log(`notificationListQuery: ${JSON.stringify(notificationListQuery)}`);
  const notifList = await elasticExecuteQuery(notificationListQuery, true);
  console.log(`notifList: ${JSON.stringify(notifList)}`);

  let notifications = [];
  let notifPage = {};

  if (
    notifList &&
    notifList.statusCode === 200 &&
    notifList.body &&
    notifList.body.hits &&
    notifList.body.hits.hits &&
    notifList.body.hits.hits.length
  ) {

    const { hits } = notifList.body.hits;
    const resultLength = hits.length;
    const totalResults = notifList.body.hits.total;
    console.log(`resultLength: ${resultLength}`);
    console.log(`totalResults: ${totalResults}`);
    notifications = resultLength ? hits.map(notif => {
      const notifObj = { ...notif._source, _score: notif._score };
      return notifObj;
    }) : []
    notifPage = {
      after: resultLength ? [...hits[resultLength - 1].sort] : [],
      hasAfter: from + size < totalResults,
      totalResults
    }
    return success({ status: true, result: notifications, ...notifPage });
  }
  return success({ status: true, result: [] });
}

/**
 * Method to update status of given list of notifications.
 * @param {object} - with keys `idList`, `hbId` and `userId` 
 */
async function updateNotifications({ idList = [], hbId, userId }) {

  if (!idList || !idList.length || !hbId || !userId) return failure();

  const updatePromises = [];
  const mod = Date.now();

  idList.forEach((id, i) => {
    const param = {
      TableName: entitiesTableName,
      Key: {
        id,
        entity: `notification#${hbId}#user#${userId}`,
      },
      UpdateExpression:
        "set #data = :data,  #mdt = :modDate",
      ExpressionAttributeNames: {
        "#data": "data",
        "#mdt": "mdt",
      },
      ExpressionAttributeValues: {
        ":data": "true",
        ":modDate": mod,
      }
    }
    console.log(`${i+1} ::: UpdateParam for id : ${id} ===> ${JSON.stringify(param)}`);
    updatePromises.push(
      updateResources(param)
    );
  });
  try {
    const combinedResults = await Promise.allSettled(updatePromises);
    console.log("combined results :: ", combinedResults);
    return success();
  } catch (error) {
    console.log("An error occured while updating notifications ::: ", error);
    return failure({error});
  }
}

/**
 * Method to clear unread notifications older than 3 days
 * @param {object} - object with keys `hbId` and `userId`
 */
async function clearOldNotifications({hbId, userId}){
  let dt = new Date();
  dt = dt.setDate(dt.getDate() - 3);
  
  const elasticParams = {
    hb_id: hbId,
    projectFields: ["id"],
    sort: [{ field: "id", order: "asc" }],
    isCustomParam: true,
    customParams: [
      {
        range: {
          mdt: {
            gte: 0,
            lte: dt
          }
        }
      },
      {
        term: {
          "data.keyword": "false"
        }
      }
    ]
  }
  const unReadNotifList = await doPaginatedQueryEllastic(elasticParams);
  const notifIdList = unReadNotifList.map(notif => notif.id)
  return updateNotifications(notifIdList, hbId, userId);
}

export async function main(event) {
  let response;
  try {
    console.log(`Notification event :: ${JSON.stringify(event)}`);
    const action =
      event && event.pathParameters && event.pathParameters.action
        ? event.pathParameters.action
        : 0;
    let data;
    switch (event.httpMethod) {
      case "GET":
        if (action === "socketurl") {
          response = success({ status: true, socketUrl: WEBSOCKET_URL })
        } else {
          response = failure();
        }
        break;
      case "POST":
        data = JSON.parse(event.body);
        if (action === "createCustomer") {
          response = await createNotifications(data, 'external');
        } else if (action === "assignleads") {
          response = await createNotifications(data, 'leads');
        } else if (action === "usernotification") {
          response = await getUserNotification(data);
        } else if(action === "update"){
          response = await updateNotifications(data);
        } else if (action === "clear") {
          response = await clearOldNotifications(data);
        }else {
          response = failure();
        }
        break;
      default:
        response = failure();
        break;
    }
  } catch (error) {
    console.log("Error occured in notification :: ", JSON.stringify(error));
    return failure({
      status: false,
      error
    })
  }
  return response;
}