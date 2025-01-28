import { updateResources } from "../../FunctionStack/libs/db";
import { failure, success } from "../../FunctionStack/libs/response-lib";

const { entitiesTableName } = process.env;

const updateUserConnection = async (authorizer, routeKey, connectionId = "") => {

  try {

    console.log(`authorizer: ${JSON.stringify(authorizer)}`);
    console.log(`Connection ID: ${JSON.stringify(connectionId)}`);

    const { hb_id: hbId, sub, userType, type } = authorizer;

    const mod = Date.now();

    // "connectionIds" key for connection Id 
    const updateParams = {
      TableName: entitiesTableName,
      Key: {
        id: sub,
        entity: `${type}#${hbId}#${userType}`,
      },
      UpdateExpression:
        "set #connectionIds = :connectionIds,  #mdt = :modDate, #enddt = :modDate",
      ExpressionAttributeNames: {
        "#connectionIds": "connectionIds",
        "#mdt": "mdt",
        "#enddt": "enddt"
      },
      ExpressionAttributeValues: {
        ":connectionIds": routeKey === "connect" ? connectionId : "",
        ":modDate": mod,
      },
    };

    console.log(`UpdateParams: ${JSON.stringify(updateParams)}`);

    const updateResp = await updateResources(updateParams, true);
    console.log(`updateResp: ${JSON.stringify(updateResp)}`);

    if (!updateResp.status) throw updateResp?.error || "Error in Adding/Removing Connection Id to user.";

    return success({
      type: routeKey,
      data: routeKey === "connect" ? "Connection Established" : "Connection Stopped"
    });

  } catch (error) {

    console.log(`Error: ${JSON.stringify(error)}`);
    console.log(error);
    return failure({
      type: "error",
      data: `Error in Connecting/Disconnecting Web Socket, :${JSON.stringify(error)}`
    });
  };
};


export async function main(event) {
  console.log(`event: ${JSON.stringify(event)}`);
  let response = {
    type: "success",
    data: "successfully connected and added connectionId to DB",
  };
  try {
    if (event.requestContext) {
      const { connectionId, routeKey, authorizer } = event.requestContext;
      console.log(`connectionId: ${connectionId}`);
      console.log(`routeKey: ${routeKey}`);
      console.log(`authorizer: ${JSON.stringify(authorizer)}`);
      switch (routeKey) {
        case "$connect":
          response = await updateUserConnection(authorizer, "connect", connectionId);
          break;
        case "$disconnect":
          response = await updateUserConnection(authorizer, "disconnect");
          break;
        case "$default":
          response = success({
            type: "$default",
            data: "No actions matched your request",
          });
          break;
        default:
          response = failure({
            type: "error",
            data: "Invalid routeKey provided"
          })
          break;
      }
    }
  } catch (error) {
    console.log(`error at main`);
    console.log(error);
    response = failure({
      type: "error",
      data: error.message,
    });
  }
  return response;
}
