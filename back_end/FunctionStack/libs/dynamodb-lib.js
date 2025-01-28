import "../../NPMLayer/nodejs.zip";
import AWS from "aws-sdk";

const options = {};
const dynamoDb = new AWS.DynamoDB.DocumentClient(options);
export const call = (action, params) => dynamoDb[action](params).promise();
export const queryPromise = (params) => dynamoDb.query(params).promise();
export const putPromise = (params) => dynamoDb.put(params).promise();
