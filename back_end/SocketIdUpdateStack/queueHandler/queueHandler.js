import "../../NPMLayer/nodejs.zip";
import { failure, success } from "../../FunctionStack/libs/response-lib";
import { batchWriteItems } from "../../FunctionStack/libs/db";
import { deleteMessage } from "../../FunctionStack/libs/sqs";

const { UsersQueueUrl} = process.env;

export async function main(event) {
  console.log(`event: ${JSON.stringify(event)}`);
  const sqsPayload = JSON.parse(event.Records[0].body);
  try {
    const users = sqsPayload.data
    console.log(`users: ${JSON.stringify(users)}`);
    const { receiptHandle } = event.Records[0];
    console.log(`receiptHandle: ${JSON.stringify(receiptHandle)}`);
    console.log(`tableName: ${JSON.stringify(process.env.entitiesTableName)}`);
    const batchParams = {
      RequestItems: {
        [process.env.entitiesTableName]: [],
      },
    };
    for (const user of users) {
      batchParams.RequestItems[process.env.entitiesTableName].push({
        PutRequest: {
          Item: user,
        },
      });
    }
    console.log(`batchParams: ${JSON.stringify(batchParams)}`);
    const batchWriteResp = await batchWriteItems(batchParams);
    console.log(`batchWriteResp: ${JSON.stringify(batchWriteResp)}`);
    if(batchWriteResp.statusCode === 200){
      console.log("$$$RESPONSE$$$",`${sqsPayload?.log  }is completed`)
      const deleteMessageResp = await deleteMessage(UsersQueueUrl,receiptHandle)
      console.log(`deleteMessageResp: ${JSON.stringify(deleteMessageResp)}`);
    }
    return success({
      type: "success",
      message : "successfully written to DB"
    });
  } catch (error) {
    console.log("$$$RESPONSE$$$",`${sqsPayload?.log  }is failed`)
    console.log(`error: ${JSON.stringify(error)}`);
    return failure({
      type: "error",
      message: error,
    });
  }
}
