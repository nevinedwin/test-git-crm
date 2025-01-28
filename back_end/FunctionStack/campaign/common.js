import { deleteEndpoint } from "./campaign";
import { getResources } from "../libs/db";

export async function deleteEntityEndpoint(id, entity, isCobuyer = false) {
  let dbParams;
  if (isCobuyer) {
    dbParams = {
      TableName: process.env.entitiesTableName,
      IndexName: process.env.entitiesTableByDataAndEntity,
      KeyConditionExpression: "#data = :data",
      ExpressionAttributeNames: {
        "#data": "data",
      },
      ExpressionAttributeValues: {
        ":data": id,
      },
    };
  } else {
    dbParams = {
      TableName: process.env.entitiesTableName,
      KeyConditionExpression: "#id = :id and #entity = :entity",
      ExpressionAttributeNames: {
        "#id": "id",
        "#entity": "entity",
      },
      ExpressionAttributeValues: {
        ":id": id,
        ":entity": entity,
      },
    };
  }

  console.log(dbParams);
  let entityRes = await getResources(dbParams);
  entityRes = JSON.parse(entityRes.body);
  console.log(`entityRes: ${JSON.stringify(entityRes)}`);
  const appid =
    entityRes && entityRes.length && entityRes[0].appid
      ? entityRes[0].appid
      : "";
  console.log(`appid: ${appid}`);
  const deleteEndpointResp = await deleteEndpoint(appid, id);
  console.log(`deleteEndpointResp: ${JSON.stringify(deleteEndpointResp)}`);
  return deleteEndpointResp;
}
