/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";

const AWS = require("aws-sdk");
const https = require("https");
const url = require("url");

const { ApplicationTag, EnvironmentTag, OwnerTag, PurposeTag } = process.env;
let s3;
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

const createS3CrossRegionBucket = async (params) => {
  console.log(`params: ${JSON.stringify(params)}`);
  const bucketName = params.BucketName ? params.BucketName : "";
  const isWebsiteConfig = params.IsWebsiteConfig
    ? params.IsWebsiteConfig
    : false;
  //   const s3Promisearr = [];
  let createBucketResp;
  let putVersioningResp;
  let putBucketTaggingResp;
  let putBucketWebsiteResp;
  const s3Params = {
    Bucket: bucketName,
  };
  console.log(`s3Params: ${JSON.stringify(s3Params)}`);
  try {
    createBucketResp = await s3.createBucket(s3Params).promise();
    console.log(`createBucketResp: ${JSON.stringify(createBucketResp)}`);
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
    createBucketResp = null;
  }

  // Enable Bucket versioning
  const putVersioningParams = {
    Bucket: bucketName,
    VersioningConfiguration: {
      MFADelete: "Disabled",
      Status: "Enabled",
    },
  };
  console.log(`putVersioningParams: ${JSON.stringify(putVersioningParams)}`);
  // s3Promisearr.push(s3.putBucketVersioning(putVersioningParams).promise());
  try {
    putVersioningResp = await s3
      .putBucketVersioning(putVersioningParams)
      .promise();
    console.log(`putVersioningResp: ${JSON.stringify(putVersioningResp)}`);
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
    putVersioningResp = null;
  }

  // Set tagging for bucket
  const bucketTaggingParams = {
    Bucket: bucketName,
    Tagging: {
      TagSet: [
        {
          Key: "Application",
          Value: ApplicationTag,
        },
        {
          Key: "Environment",
          Value: EnvironmentTag,
        },
        {
          Key: "Owner",
          Value: OwnerTag,
        },
        {
          Key: "Purpose",
          Value: PurposeTag,
        },
        {
          Key: "Service",
          Value: "s3",
        },
      ],
    },
  };
  console.log(`bucketTaggingParams: ${JSON.stringify(bucketTaggingParams)}`);
  // s3Promisearr.push(s3.putBucketTagging(bucketTaggingParams).promise());
  try {
    putBucketTaggingResp = await s3
      .putBucketTagging(bucketTaggingParams)
      .promise();
    console.log(
      `putBucketTaggingResp: ${JSON.stringify(putBucketTaggingResp)}`
    );
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
    putBucketTaggingResp = null;
  }

  // If website configuration is to be enabled, then do so.
  if (isWebsiteConfig) {
    const websiteConfigParams = {
      Bucket: bucketName,
      ContentMD5: "",
      WebsiteConfiguration: {
        ErrorDocument: {
          Key: "index.html",
        },
        IndexDocument: {
          Suffix: "index.html",
        },
      },
    };
    console.log(`websiteConfigParams: ${JSON.stringify(websiteConfigParams)}`);
    // s3Promisearr.push(s3.putBucketWebsite(websiteConfigParams).promise());
    try {
      putBucketWebsiteResp = await s3
        .putBucketWebsite(websiteConfigParams)
        .promise();
      console.log(
        `putBucketWebsiteResp: ${JSON.stringify(putBucketWebsiteResp)}`
      );
    } catch (e) {
      console.log(`e: ${JSON.stringify(e.stack)}`);
      putBucketWebsiteResp = null;
    }
  }
  return {
    createBucketResp,
    putVersioningResp,
    putBucketWebsiteResp: isWebsiteConfig ? putBucketWebsiteResp : true,
    putBucketTaggingResp,
  };
  /* try {
        const [putVersioningResp, putBucketWebsiteResp, putBucketTaggingResp] = await Promise.all(s3Promisearr);
        console.log(`createBucketResp: ${JSON.stringify(createBucketResp)}`);
        console.log(`putVersioningResp: ${JSON.stringify(putVersioningResp)}`);
        console.log(`putBucketWebsiteResp: ${JSON.stringify(putBucketWebsiteResp)}`);
        console.log(`putBucketTaggingResp: ${JSON.stringify(putBucketTaggingResp)}`);
        return { createBucketResp, putVersioningResp, putBucketWebsiteResp: isWebsiteConfig ? putBucketWebsiteResp : true, putBucketTaggingResp };
    }
    catch (err) {
        const [putVersioningResp, putBucketWebsiteResp, putBucketTaggingResp] = [null, null, null, null];
        console.log(`err Catch: ${JSON.stringify(err)}`);
        console.log(`createBucketResp Catch: ${JSON.stringify(createBucketResp)}`);
        console.log(`putVersioningResp Catch: ${JSON.stringify(putVersioningResp)}`);
        console.log(`putBucketWebsiteResp Catch: ${JSON.stringify(putBucketWebsiteResp)}`);
        console.log(`putBucketTaggingResp Catch: ${JSON.stringify(putBucketTaggingResp)}`);
        return { createBucketResp, putVersioningResp, putBucketWebsiteResp: isWebsiteConfig ? putBucketWebsiteResp : true, putBucketTaggingResp };
    } */
};
const deleteS3CrossRegionBucket = async (params) => {
  console.log(`params: ${JSON.stringify(params)}`);
  const bucketName = params.BucketName ? params.BucketName : "";
  let deleteBucketResp;
  const s3Params = {
    Bucket: bucketName,
  };
  console.log(`s3Params: ${JSON.stringify(s3Params)}`);
  try {
    deleteBucketResp = await s3.deleteBucket(s3Params).promise();
    console.log(`deleteBucketResp: ${JSON.stringify(deleteBucketResp)}`);
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
    deleteBucketResp = null;
  }
  return deleteBucketResp;
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
    // Set the Region
    console.log(`before Set the Region`);
    AWS.config.update({ region: resourceProperties.RegionName });
    console.log(`after Set the Region`);
    console.log(`before s3`);
    s3 = new AWS.S3({ apiVersion: "2006-03-01" });
    console.log(`after s3`);

    if (event.RequestType === "Create") {
      console.log("CREATE!");
      // Put your custom create logic here
      const createS3Bucket = await createS3CrossRegionBucket(
        resourceProperties
      );
      if (
        createS3Bucket &&
        createS3Bucket.createBucketResp &&
        createS3Bucket.putVersioningResp &&
        createS3Bucket.putBucketWebsiteResp
      ) {
        response = await sendResponse(event, context, "SUCCESS", {
          Message: "Resource creation successful!",
          Arn: `arn:aws:s3:::${resourceProperties.BucketName}`,
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
      response = await sendResponse(event, context, "SUCCESS", {
        Message: "Resource update successful!",
      });
      console.log(`response: ${response}`);
      // Tell AWS Lambda that the function execution is done
      context.done();
    } else if (event.RequestType === "Delete") {
      console.log("DELETE!");
      const deleteS3BucketResp = await deleteS3CrossRegionBucket(
        resourceProperties
      );
      if (deleteS3BucketResp) {
        response = await sendResponse(event, context, "SUCCESS", {
          Message: "Resource deletion successful!",
          Arn: `arn:aws:s3:::${resourceProperties.BucketName}`,
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
    console.log(`Exception S3 CRR: ${err}`);
    response = await sendResponse(event, context, "FAILED");
    console.log(`response: ${response}`);
    // Tell AWS Lambda that the function execution is done
    context.done();
  }
}
