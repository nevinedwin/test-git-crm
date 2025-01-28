import {
  transactWriteItems,
 // updateResources,
} from "../../FunctionStack/libs/db";
import { getFileFromS3 } from "../initRemoveField/initRemoveField";

export const main = async (event) => {
  let sendResponse = {
    ...event,
    status: false,
    taskName: "RemoveField",
  };

  try {
    console.log(`Event: ${JSON.stringify(event)}`);
    const {
      dataFileKey = "",
      iterator: { index = 0, step = 0, newExecutionStartsAt, count },
      field = "",
      setVal = ""
    } = event;

    const dataFileResp = await getFileFromS3(dataFileKey);
    console.log(`dataFileResp: ${JSON.stringify(dataFileResp)}`);
    if (!dataFileResp.status) throw dataFileResp.error;

    console.log(
      `index: ${JSON.stringify(index)}, index+step: ${JSON.stringify(
        index + step
      )}`
    );
    const finalVal =
      dataFileResp?.data.length <= index + step
        ? dataFileResp?.data.length
        : index + step;

    const transactWriteParams = {
      TransactItems: [],
    };
    for (let i = index; i < finalVal; i += 1) {
      const updateFieldData = dataFileResp.data[i];
      console.log(`updateFieldData: ${JSON.stringify(updateFieldData)}`);

      transactWriteParams.TransactItems.push({
        Update: {
          TableName: process.env.entitiesTableName,
          Key: {
            id: updateFieldData.id,
            entity: updateFieldData.entity,
          },
          UpdateExpression: `set #field = :val`,
          ExpressionAttributeNames: {
            "#field": field,
          },
          ExpressionAttributeValues: {
            ":val": setVal,
          },
        },
      });
    }

    console.log(`transactWriteParams: ${JSON.stringify(transactWriteParams)}`);
    const transactWriteResp = await transactWriteItems(transactWriteParams);
    console.log(`transactWriteResp: ${JSON.stringify(transactWriteResp)}`);
    
    sendResponse = {
      ...sendResponse,
      status: true,
      doNewExecution:
        index + step <= count && index + step >= newExecutionStartsAt,
      iterator: {
        ...sendResponse.iterator,
        index: index + step
      }
    };
  } catch (error) {
    console.log(error);
    console.log(`Error: ${JSON.stringify(error)}`);
    sendResponse = {
      ...sendResponse,
      error: error.message,
    };
  }
  return sendResponse;
};
