const AWS = require("aws-sdk");
const cloudformation = new AWS.CloudFormation({ apiVersion: "2010-05-15" });
const s3 = new AWS.S3({ apiVersion: "2006-03-01" });
const cloudfront = new AWS.CloudFront({ apiVersion: "2019-03-26" });
const codepipeline = new AWS.CodePipeline({ apiVersion: "2015-07-09" });
let response;
const { PROJECT_NAME, REGION } = process.env;
const doFrontEndDeploy = async () => {
  const params = {
    StackName: PROJECT_NAME,
  };
  console.log("params: ", params);
  try {
    const describeStacksResp = await cloudformation
      .describeStacks(params)
      .promise();
    console.log(`describeStacksResp: ${JSON.stringify(describeStacksResp)}`);
    /* {
            "ResponseMetadata": {
                "RequestId": "adbc71d2-5c87-45ca-8549-3471abf6226c"
            },
            "Stacks": [
                {
                    "StackId": "arn:aws:cloudformation:us-west-2:748787612401:stack/crm-cicdv2-stack-dev-cf/8a006320-a015-11ea-a629-067657bdc03a",
                    "StackName": "crm-cicdv2-stack-dev-cf",
                    "ChangeSetId": "arn:aws:cloudformation:us-west-2:748787612401:changeSet/pipeline-changeset/f05fdb4e-1b9a-44f8-994c-c26e9b0c1e88",
                    "Description": "Hyphen CRM SAM Template",
                    "Parameters": [
                        {
                            "ParameterKey": "pinpointESData",
                            "ParameterValue": "pinpointesdata"
                        },
                        {
                            "ParameterKey": "MessagingStackNamePrefix",
                            "ParameterValue": "crm-msghy-"
                        },
                        {
                            "ParameterKey": "tableThroughput",
                            "ParameterValue": "5"
                        },
                        {
                            "ParameterKey": "firehoseESIndex",
                            "ParameterValue": "crmeskinesisindex"
                        },
                        {
                            "ParameterKey": "Stage",
                            "ParameterValue": "dev"
                        },
                        {
                            "ParameterKey": "StackNamePrefix",
                            "ParameterValue": "crm-cicdv2-"
                        }
                    ],
                    "CreationTime": "2020-05-27T12:28:16.026Z",
                    "LastUpdatedTime": "2020-05-27T12:29:15.573Z",
                    "RollbackConfiguration": {},
                    "StackStatus": "CREATE_COMPLETE",
                    "DisableRollback": false,
                    "NotificationARNs": [],
                    "Capabilities": [
                        "CAPABILITY_NAMED_IAM",
                        "CAPABILITY_AUTO_EXPAND"
                    ],
                    "Outputs": [
                        {
                            "OutputKey": "CampaignRoleArn",
                            "OutputValue": "arn:aws:iam::748787612401:role/crm-cicdv2-stack-dev-cf-CampaignRole-1DYI9EUW4G55G",
                            "ExportName": "crm-cicdv2-stack-dev-cf-CampaignRoleArn"
                        },
                        {
                            "OutputKey": "EntitiesTableArn",
                            "OutputValue": "arn:aws:dynamodb:us-west-2:748787612401:table/crm-cicdv2-entities-dev-db",
                            "ExportName": "crm-cicdv2-stack-dev-cf-EntitiesTableArn"
                        },
                        {
                            "OutputKey": "HyphenCRMDistributionOutput",
                            "OutputValue": "d22sarlbyvnomg.cloudfront.net"
                        },
                        {
                            "OutputKey": "BuildersApiFunctionArn",
                            "OutputValue": "arn:aws:lambda:us-west-2:748787612401:function:crm-cicdv2-stack-dev-cf-BuildersApiFunction-158WLJYQLEDT7",
                            "ExportName": "crm-cicdv2-stack-dev-cf-BuildersApiFunctionArn"
                        },
                        {
                            "OutputKey": "DomainArn",
                            "OutputValue": "arn:aws:es:us-west-2:748787612401:domain/crm-cicdv2-entities-dev-es"
                        },
                        {
                            "OutputKey": "CommunitiesApiFunctionArn",
                            "OutputValue": "arn:aws:lambda:us-west-2:748787612401:function:crm-cicdv2-stack-dev-cf-CommunitiesApiFunction-T7X9G03J2U25",
                            "ExportName": "crm-cicdv2-stack-dev-cf-CommunitiesApiFunctionArn"
                        },
                        {
                            "OutputKey": "CustomersApiFunctionArn",
                            "OutputValue": "arn:aws:lambda:us-west-2:748787612401:function:crm-cicdv2-stack-dev-cf-CustomersApiFunction-ZSCTBDR8WWD4",
                            "ExportName": "crm-cicdv2-stack-dev-cf-CustomersApiFunctionArn"
                        },
                        {
                            "OutputKey": "UserPoolClientId",
                            "OutputValue": "16bhrqknuris6558k3tkbrsk5e"
                        },
                        {
                            "OutputKey": "CRMOriginAccessIdentity",
                            "OutputValue": "E1O5M72E5V10HE"
                        },
                        {
                            "OutputKey": "UserPoolId",
                            "OutputValue": "us-west-2_6qBHqe2Pp"
                        },
                        {
                            "OutputKey": "HyphenLambdaManagedPolicyArn",
                            "OutputValue": "arn:aws:iam::748787612401:policy/crm-cicdv2-stack-dev-cf-HyphenLambdaManagedPolicy-OUZBTTVTJ8GG",
                            "ExportName": "crm-cicdv2-stack-dev-cf-HyphenLambdaManagedPolicyArn"
                        },
                        {
                            "OutputKey": "HyphenCRMFirehoseArn",
                            "OutputValue": "arn:aws:firehose:us-west-2:748787612401:deliverystream/crm-cicdv2-firehose-dev-kf"
                        },
                        {
                            "OutputKey": "DomainEndpoint",
                            "OutputValue": "search-crm-cicdv2-entities-dev-es-qgg3fce7jdmcdyvc7lpgihozoi.us-west-2.es.amazonaws.com"
                        },
                        {
                            "OutputKey": "HyphenCRMDistributionId",
                            "OutputValue": "EB16RL95HI5JU"
                        },
                        {
                            "OutputKey": "FrontEndBucketName",
                            "OutputValue": "crm-cicdv2-frontend-dev-s3"
                        },
                        {
                            "OutputKey": "FirehosePinpointRoleArn",
                            "OutputValue": "arn:aws:iam::748787612401:role/service-role/crm-cicdv2-stack-dev-cf-FirehosePinpointRole-O91LOYPDPAYY"
                        },
                        {
                            "OutputKey": "IdentityPoolId",
                            "OutputValue": "us-west-2:6851187e-7f09-46e6-9da8-0edc156d8c2e"
                        },
                        {
                            "OutputKey": "ServiceEndpoint",
                            "OutputValue": "https://lql3mg28xg.execute-api.us-west-2.amazonaws.com/dev"
                        }
                    ],
                    "RoleARN": "arn:aws:iam::748787612401:role/crm-cicdv2-cloudformationrole-dev-cf",
                    "Tags": [],
                    "EnableTerminationProtection": false,
                    "DriftInformation": {
                        "StackDriftStatus": "NOT_CHECKED"
                    }
                }
            ]
        } */
    const stackOutputs =
      describeStacksResp &&
      describeStacksResp.Stacks &&
      describeStacksResp.Stacks.length &&
      describeStacksResp.Stacks[0].Outputs
        ? describeStacksResp.Stacks[0].Outputs
        : [];
    const frontEndConfigObj = {
      apiGateway: {
        NAME: PROJECT_NAME,
        REGION: REGION,
        URL: "",
      },
      cognito: {
        REGION: REGION,
        USER_POOL_ID: "",
        APP_CLIENT_ID: "",
        IDENTITY_POOL_ID: "",
      },
      cloudFront: {
        fileManager: "",
      },
    };
    let HyphenCRMDistributionId, FrontEndBucketName;
    for (let stackOutput of stackOutputs) {
      switch (stackOutput.OutputKey) {
        case "UserPoolClientId":
          frontEndConfigObj.cognito.APP_CLIENT_ID = stackOutput.OutputValue;
          break;
        case "UserPoolId":
          frontEndConfigObj.cognito.USER_POOL_ID = stackOutput.OutputValue;
          break;
        case "HyphenCRMDistributionId":
          HyphenCRMDistributionId = stackOutput.OutputValue;
          break;
        case "FrontEndBucketName":
          FrontEndBucketName = stackOutput.OutputValue;
          break;
        case "IdentityPoolId":
          frontEndConfigObj.cognito.IDENTITY_POOL_ID = stackOutput.OutputValue;
          break;
        /* case 'ServiceEndpoint':
                    frontEndConfigObj.apiGateway.URL = stackOutput.OutputValue;
                    break; */
        case "APICustomDomain":
          frontEndConfigObj.apiGateway.URL = stackOutput.OutputValue;
          break;
        case "DomainName":
          frontEndConfigObj.cloudFront.fileManager = `https://${stackOutput.OutputValue}`;
          break;
        /* case 'FileManagerDistributionOutput':
                    frontEndConfigObj.cloudFront.fileManager = `https://${stackOutput.OutputValue}`;
                    break; */
        /* case "AssetsCustomDomain":
          frontEndConfigObj.cloudFront.fileManager = `https://${stackOutput.OutputValue}`;
          break; */
        default:
          break;
      }
    }
    // Upload the frontEndConfigObj as aws-config.json in the front end bucket
    const fileName = "aws-config.json";
    const uploadS3Params = {
      Bucket: FrontEndBucketName,
      Key: fileName,
      ContentType: "application/json",
      Body: JSON.stringify(frontEndConfigObj),
    };
    console.log("uploadS3Params: ", uploadS3Params);
    try {
      const s3UploadResp = await s3.upload(uploadS3Params).promise();
      console.log(`s3UploadResp: ${JSON.stringify(s3UploadResp)}`);
    } catch (e) {
      console.log(`e: ${JSON.stringify(e.stack)}`);
      return false;
    }
    // Create Invalidation for the Front End Cloudfront
    const timestamp = new Date().getTime().toString();
    const createInvalidationParams = {
      DistributionId: HyphenCRMDistributionId,
      InvalidationBatch: {
        CallerReference: timestamp,
        Paths: {
          Quantity: 1,
          Items: ["/*"],
        },
      },
    };
    console.log("createInvalidationParams: ", createInvalidationParams);
    try {
      const createInvalidationResp = await cloudfront
        .createInvalidation(createInvalidationParams)
        .promise();
      console.log(
        `createInvalidationResp: ${JSON.stringify(createInvalidationResp)}`
      );
      return true;
    } catch (e) {
      console.log(`e: ${JSON.stringify(e.stack)}`);
      return false;
    }
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
    return false;
  }
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
exports.handler = async (event, context) => {
  try {
    console.log("event: ", JSON.stringify(event));
    // Retrieve the Job ID from the Lambda action
    const jobId = event["CodePipeline.job"].id;

    // Notify AWS CodePipeline of a successful job
    const putJobSuccess = async (message) => {
      const params = {
        jobId: jobId,
      };
      try {
        const putJobSuccessResultResp = await codepipeline
          .putJobSuccessResult(params)
          .promise();
        console.log(
          `putJobSuccessResultResp: ${JSON.stringify(putJobSuccessResultResp)}`
        );
        context.succeed(message);
      } catch (e) {
        console.log(`e: ${JSON.stringify(e.stack)}`);
        context.fail(e);
      }
    };

    // Notify AWS CodePipeline of a failed job
    const putJobFailure = async (message) => {
      const params = {
        jobId: jobId,
        failureDetails: {
          message: JSON.stringify(message),
          type: "JobFailed",
          externalExecutionId: context.awsRequestId,
        },
      };
      try {
        const putJobFailureResultResp = await codepipeline
          .putJobFailureResult(params)
          .promise();
        console.log(
          `putJobFailureResultResp: ${JSON.stringify(putJobFailureResultResp)}`
        );
        context.fail(message);
      } catch (e) {
        console.log(`e: ${JSON.stringify(e.stack)}`);
        context.fail(message);
      }
    };
    response = await doFrontEndDeploy();
    if (response) {
      await putJobSuccess("Front End Deployed Successfully");
    } else {
      await putJobFailure("Front End Deployment Failed");
    }
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
  }
};
