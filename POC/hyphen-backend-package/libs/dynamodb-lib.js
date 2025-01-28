import AWS from "aws-sdk";

export function call(action, params) {
  const IS_OFFLINE = process.env.IS_OFFLINE;
  let dynamoDb;
  if (IS_OFFLINE === 'true') {
    dynamoDb = new AWS.DynamoDB.DocumentClient({
      region: 'localhost',
      endpoint: 'http://localhost:8008'
    });
  } else {
    dynamoDb = new AWS.DynamoDB.DocumentClient();
  };  
  return dynamoDb[action](params).promise();
}
