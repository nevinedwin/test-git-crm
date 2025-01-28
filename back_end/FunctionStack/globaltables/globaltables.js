/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";

const AWS = require("aws-sdk");

const dynamodb = new AWS.DynamoDB({ apiVersion: "2012-08-10" });
const https = require("https");
const url = require("url");
// Send response to the pre-signed S3 URL
const sendResponse = (event, context, responseStatus, responseData) => {
  console.log(`Sending response ${responseStatus}`);
  const responseBody = JSON.stringify({
    Status: responseStatus,
    Reason: `See the details in CloudWatch Log Stream: ${context.logStreamName}`,
    PhysicalResourceId: context.logStreamName,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: responseData,
  });

  console.log("RESPONSE BODY:\n", responseBody);

  const parsedUrl = url.parse(event.ResponseURL);
  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.path,
    method: "PUT",
    headers: {
      "content-type": "",
      "content-length": responseBody.length,
    },
  };

  console.log("SENDING RESPONSE...\n");

  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      console.log(`STATUS: ${response.statusCode}`);
      console.log(`HEADERS: ${JSON.stringify(response.headers)}`);
      resolve(response);
    });

    request.on("error", (error) => {
      console.log(`sendResponse Error:${error}`);
      reject(error);
    });

    // write data to request body
    request.write(responseBody);
    request.end();
  });
};

const setupWatchdogTimer = (event, context, callback) => {
  try {
    const timeoutHandler = () => {
      console.log("Timeout FAILURE!");
      // Emit event to 'sendResponse', then callback with an error from this
      // function
      new Promise(() => sendResponse(event, context, "FAILED")).then(() =>
        callback(new Error("Function timed out"))
      );
    };

    // Set timer so it triggers one second before this function would timeout
    setTimeout(timeoutHandler, context.getRemainingTimeInMillis() - 1000);
  } catch (e) {
    sendResponse(event, context, "FAILED");
  }
};

const createUpdateGlobalTables = async (
  params,
  isUpdate = false,
  isDelete = false
) => {
  console.log(`params: ${JSON.stringify(params)}`);
  const globalTableName = params.GlobalTableName ? params.GlobalTableName : "";
  const globalTableRegion = params.globalTableRegion
    ? params.globalTableRegion
    : "";

  let createUpdateGlobalTablesResp;
  const globalTableParams = {
    TableName: globalTableName /* required */,
    ReplicaUpdates: [],
  };
  if (isUpdate) {
    // Update Global Tables
    globalTableParams.ReplicaUpdates.push({
      Update: {
        RegionName: globalTableRegion /* required */,
      },
    });
  } else if (isDelete) {
    // Delete Global Tables
    globalTableParams.ReplicaUpdates.push({
      Delete: {
        RegionName: globalTableRegion /* required */,
      },
    });
  } else {
    // Create Global Tables
    globalTableParams.ReplicaUpdates.push({
      Create: {
        RegionName: globalTableRegion /* required */,
      },
    });
  }
  console.log(`globalTableParams: ${JSON.stringify(globalTableParams)}`);
  try {
    createUpdateGlobalTablesResp = await dynamodb
      .updateTable(globalTableParams)
      .promise();
    console.log(
      `createUpdateGlobalTablesResp: ${JSON.stringify(
        createUpdateGlobalTablesResp
      )}`
    );
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
    createUpdateGlobalTablesResp = null;
  }
  return createUpdateGlobalTablesResp;
};
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
export async function main(event, context, callback) {
  let response;
  try {
    // Install watchdog timer as the first thing
    console.log(`before setupWatchdogTimer`);
    setupWatchdogTimer(event, context, callback);
    console.log(`REQUEST RECEIVED:\n${JSON.stringify(event)}`);
    console.log(`before resourceProperties`);
    const resourceProperties = event?.ResourceProperties;
    console.log(`after resourceProperties`);

    if (event.RequestType === "Create") {
      console.log("CREATE!");
      // Put your custom create logic here
      const createGlobalTablesResp = await createUpdateGlobalTables(
        resourceProperties
      );
      if (createGlobalTablesResp) {
        response = await sendResponse(event, context, "SUCCESS", {
          Message: "Resource creation successful!",
        });
      } else {
        response = await sendResponse(event, context, "FAILED");
      }
      console.log(`response: ${response}`);
      // Tell AWS Lambda that the function execution is done
      context.done();
    } else if (event.RequestType === "Update") {
      console.log("UPDATE!");
      // Put your custom update logic here
      const updateGlobalTablesResp = await createUpdateGlobalTables(
        resourceProperties,
        true
      );
      if (updateGlobalTablesResp) {
        response = await sendResponse(event, context, "SUCCESS", {
          Message: "Resource updation successful!",
        });
      } else {
        response = await sendResponse(event, context, "FAILED");
      }
      console.log(`response: ${response}`);
      // Tell AWS Lambda that the function execution is done
      context.done();
    } else if (event.RequestType === "Delete") {
      console.log("DELETE!");
      const deleteGlobalTablesResp = await createUpdateGlobalTables(
        resourceProperties,
        false,
        true
      );
      if (deleteGlobalTablesResp) {
        response = await sendResponse(event, context, "SUCCESS", {
          Message: "Resource deletion successful!",
        });
      } else {
        response = await sendResponse(event, context, "FAILED");
      }
      console.log(`response: ${response}`);
      // Tell AWS Lambda that the function execution is done
      context.done();
    } else {
      console.log("FAILED!");
      response = await sendResponse(event, context, "FAILED");
      console.log(`response: ${response}`);
      // Tell AWS Lambda that the function execution is done
      context.done();
    }
  } catch (err) {
    console.log(`Exception DynamoDB Global Tables: ${err}`);
    response = await sendResponse(event, context, "FAILED");
    console.log(`response: ${response}`);
    // Tell AWS Lambda that the function execution is done
    context.done();
  }
}
