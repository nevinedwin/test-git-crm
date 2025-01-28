/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import {
  getResourceJSON,
  getResources,
  getResourcesRaw,
  postResources,
  updateResources,
  getRecordByEntity,
  doPaginatedQueryDB,
  deleteResources,
  batchWriteItems,
} from "../libs/db";
import { success, failure, badRequest } from "../libs/response-lib";
import {
  createApp,
  updateEmailChannel,
  attachEventStream,
  verifyEmailIdentity,
  checkIdentityExists,
  doVerifyEmailIdentityOnly,
} from "../campaign/campaign";

import { getDocumentPath } from "../filemanager/filemanager";
import { getEntities } from "../endpointcount/endpointcount";
import { createDynamicRequiredField } from "../dynamicRequiredFields/dynamicRequiredFields";
import { elasticExecuteQuery } from "../search/search";
import { createMoveInTimeFrame } from "../moveInTimeFrame/moveInTimeFrame";

const cloudformation = new AWS.CloudFormation({ apiVersion: "2010-05-15" });
const sfn = new AWS.StepFunctions();
const ses = new AWS.SES();
const cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider({
  apiVersion: "2016-04-18",
});
const kms = new AWS.KMS({ apiVersion: "2014-11-01" });
const transfer = new AWS.Transfer({ apiVersion: "2018-11-05" });
const secretsmanager = new AWS.SecretsManager({ apiVersion: "2017-10-17" });
const s3 = new AWS.S3({ apiVersion: "2006-03-01" });
const sqs = new AWS.SQS({
  region: "us-west-2",
});
const {
  DYNAMODB_KMS_KEY_ID,
  EXTERNAL_ENDPOINT,
  EXT_USER_POOL_ID,
  DATA_MIGRAION_MACHINE_ARN,
  DATA_IMPORT_MACHINE_ARN,
  STAGE_DATE_MACHINE_ARN,
  PROJECT_NAME,
  S3_BUCKET_ARN,
  SERVER_ID,
  FTP_USER_ROLE_ARN,
  TRANSFER_WORKFLOW_EXECUTION_ROLE,
  TRANSFER_WORKFLOW_LAMBDA_ARN,
  TRANSFER_WORKFLOW_EXCEPTION_LAMBDA_ARN,
  SFTP_CUSTOM_DOMAIN,
  CUSTOM_DOMAIN_ENABLED,
  REGION,
  FILE_MANAGER_BUCKET_NAME,
  ELASTIC_DLQ_URL,
  EMAIL_ACTIVITY_UPDATE_MACHINE_ARN,
  ENDPOINT_UPDATE_MACHINE_ARN,
  ApplicationTag,
  EnvironmentTag,
  OwnerTag,
  PurposeTag,
  COMMUNITY_LAMBDA_ARN,
  AGENCIES_LAMBDA_ARN,
  COBUYER_LAMBDA_ARN,
  BUILDER_DELETE_STATEMACHINE_ARN,
  USERS_LAMBDA_ARN
} = process.env;
export const listBuilders = async (isJSONOnly = false) => {
  console.log(`in listBuilders`);
  const params = {
    TableName: process.env.entitiesTableName,
    IndexName: process.env.entitiesTableByEntityAndId,
    KeyConditionExpression: "#entity = :entity",
    ExpressionAttributeNames: {
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":entity": "builder",
    },
  };
  console.log(params);
  let buildersList;
  if (isJSONOnly) {
    buildersList = await getResourceJSON(params);
  } else {
    buildersList = await getResources(params);
  }
  console.log(`buildersList: ${JSON.stringify(buildersList)}`);
  return buildersList;
};
const getDkimStatus = async (builderEmail) => {
  try {
    const getIdentityDkimAttributesParams = {
      Identities: [builderEmail],
    };
    console.log(
      `getIdentityDkimAttributesParams: ${JSON.stringify(
        getIdentityDkimAttributesParams,
        null,
        4
      )}`
    );
    const getIdentityDkimAttributesResp = await ses
      .getIdentityDkimAttributes(getIdentityDkimAttributesParams)
      .promise();
    console.log(
      `getIdentityDkimAttributesResp: ${JSON.stringify(
        getIdentityDkimAttributesResp,
        null,
        4
      )}`
    );
    return getIdentityDkimAttributesResp;
  } catch (e) {
    console.log(
      ` getIdentityDkimAttributes     try catch: ${JSON.stringify(
        e.stack,
        null,
        4
      )}`
    );
    return {
      error: e.stack,
    };
  }
};
const verifyDomainDkimFn = async (domainName) => {
  try {
    const verifyDomainDkimParams = {
      Domain: domainName,
    };
    console.log(
      `verifyDomainDkimParams: ${JSON.stringify(
        verifyDomainDkimParams,
        null,
        4
      )}`
    );
    const verifyDomainDkimResp = await ses
      .verifyDomainDkim(verifyDomainDkimParams)
      .promise();
    console.log(
      `verifyDomainDkimResp: ${JSON.stringify(verifyDomainDkimResp, null, 4)}`
    );
    return verifyDomainDkimResp;
  } catch (e) {
    console.log(
      `verifyDomainDkim     try catch : ${JSON.stringify(e.stack, null, 4)}`
    );
    return {
      error: e.stack,
    };
  }
};

const enableDkim = async (builderEmail) => {
  try {
    const setIdentityDkimEnabledParams = {
      DkimEnabled: true,
      Identity: builderEmail,
    };
    console.log(
      `setIdentityDkimEnabledParams: ${JSON.stringify(
        setIdentityDkimEnabledParams,
        null,
        4
      )}`
    );
    const setIdentityDkimEnabledResp = await ses
      .setIdentityDkimEnabled(setIdentityDkimEnabledParams)
      .promise();
    console.log(
      `setIdentityDkimEnabledResp: ${JSON.stringify(
        setIdentityDkimEnabledResp,
        null,
        4
      )}`
    );
    return setIdentityDkimEnabledResp;
  } catch (e) {
    console.log(
      `setIdentityDkimEnabled     try catch: ${JSON.stringify(
        e.stack,
        null,
        4
      )}`
    );
    return {
      error: e.stack,
    };
  }
};
const getBuilderDB = async (data) => {
  try {
    console.log(`data: ${JSON.stringify(data)}`);
    const { id = "" } = data;
    console.log(`id: ${id}`);
    const params = {
      TableName: process.env.entitiesTableName,
      KeyConditionExpression: "#id = :id and #entity = :entity",
      ExpressionAttributeNames: {
        "#id": "id",
        "#entity": "entity",
      },
      ExpressionAttributeValues: {
        ":id": id,
        ":entity": "builder",
      },
    };
    console.log(params);
    const getBuilderResp = await getResourcesRaw(params);
    console.log(`getBuilderResp: ${JSON.stringify(getBuilderResp)}`);
    return { status: true, data: getBuilderResp };
  } catch (error) {
    console.log(`Exception at getBuilderDB`);
    console.log(error);
    return { status: false, error };
  }
};
const getBuilder = async (event) => {
  console.log("In getBuilder");
  console.log(`event: ${JSON.stringify(event)}`);
  const idParam =
    event && event.pathParameters && event.pathParameters.id
      ? event.pathParameters.id
      : 0;
  console.log(`idParam: ${idParam}`);
  const params = {
    TableName: process.env.entitiesTableName,
    KeyConditionExpression: "#id = :id and #entity = :entity",
    ExpressionAttributeNames: {
      "#id": "id",
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":id": idParam,
      ":entity": "builder",
    },
  };
  console.log(params);
  const getBuilderResp = await getResourceJSON(params);
  console.log(`getBuilderResp: ${JSON.stringify(getBuilderResp)}`);

  if (getBuilderResp && getBuilderResp.length) {
    const builderEmail = getBuilderResp[0].email;
    // Check whether the builder email id is verified in ses
    const identityExists = await checkIdentityExists(builderEmail);
    console.log(`identityExists: ${JSON.stringify(identityExists)}`);
    if (
      identityExists &&
      identityExists.VerificationAttributes &&
      !identityExists.VerificationAttributes[builderEmail]
    ) {
      // Identity Doesn't Exist
      getBuilderResp[0].exists = false;
      getBuilderResp[0].verified = false;
    } else if (
      identityExists.VerificationAttributes[builderEmail].VerificationStatus &&
      identityExists.VerificationAttributes[builderEmail].VerificationStatus ===
      "Success"
    ) {
      // Identity Exists
      // Verified
      getBuilderResp[0].exists = true;
      getBuilderResp[0].verified = true;
    } else {
      // Identity Exists
      // Not Verified
      getBuilderResp[0].exists = true;
      getBuilderResp[0].verified = false;
    }
    try {
      let dkimDetails = {};
      dkimDetails = await getDkimStatus(builderEmail);
      if (dkimDetails && dkimDetails.DkimAttributes) {
        if (dkimDetails.DkimAttributes[builderEmail]) {
          if (dkimDetails.DkimAttributes[builderEmail].DkimEnabled) {
            getBuilderResp[0].DkimAttributes =
              dkimDetails.DkimAttributes[builderEmail];
          } else {
            const verifyDomainDkimFnRes = await verifyDomainDkimFn(
              builderEmail.substring(builderEmail.lastIndexOf("@") + 1)
            );
            if (
              verifyDomainDkimFnRes &&
              verifyDomainDkimFnRes.DkimTokens &&
              verifyDomainDkimFnRes.DkimTokens.length
            ) {
              const enableDkimResp = await enableDkim(builderEmail);
              if (enableDkimResp && enableDkimResp.ResponseMetadata) {
                dkimDetails = await getDkimStatus(builderEmail);
                if (dkimDetails && dkimDetails.DkimAttributes) {
                  if (dkimDetails.DkimAttributes[builderEmail]) {
                    if (dkimDetails.DkimAttributes[builderEmail].DkimEnabled) {
                      getBuilderResp[0].DkimAttributes =
                        dkimDetails.DkimAttributes[builderEmail];
                    }
                  }
                }
              }
            }
          }
        } else {
          const verifyDomainDkimFnRes1 = await verifyDomainDkimFn(
            builderEmail.substring(builderEmail.lastIndexOf("@") + 1)
          );
          if (
            verifyDomainDkimFnRes1 &&
            verifyDomainDkimFnRes1.DkimTokens &&
            verifyDomainDkimFnRes1.DkimTokens.length
          ) {
            const enableDkimResp1 = await enableDkim(builderEmail);
            if (enableDkimResp1 && enableDkimResp1.ResponseMetadata) {
              dkimDetails = await getDkimStatus(builderEmail);
              if (dkimDetails && dkimDetails.DkimAttributes) {
                if (dkimDetails.DkimAttributes[builderEmail]) {
                  if (dkimDetails.DkimAttributes[builderEmail].DkimEnabled) {
                    getBuilderResp[0].DkimAttributes =
                      dkimDetails.DkimAttributes[builderEmail];
                  }
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.log(
        `builder dkim   try catch: ${JSON.stringify(error.stack, null, 4)}`
      );
    }

    try {
      const lastLeadParams = {
        TableName: process.env.entitiesTableName,
        IndexName: process.env.entitiesTableByEntityAndId,
        KeyConditionExpression: "#entity = :entity",
        ExpressionAttributeNames: {
          "#entity": "entity",
        },
        ExpressionAttributeValues: {
          ":entity": `lastlead#${idParam}`,
        },
      };
      console.log(`lastLeadParams: ${JSON.stringify(lastLeadParams)}`);
      const getLeadIdDetailsRes = await getResourceJSON(lastLeadParams);
      console.log(
        `getLeadIdDetailsRes: ${JSON.stringify(getLeadIdDetailsRes)}`
      );
      getBuilderResp[0].leadIDDetails = getLeadIdDetailsRes;
    } catch (error) {
      console.log(`get lead id details error: ${JSON.stringify(error.stack)}`);
    }
    console.log(`SFTP_CUSTOM_DOMAIN: ${SFTP_CUSTOM_DOMAIN}`);
    console.log(`CUSTOM_DOMAIN_ENABLED: ${CUSTOM_DOMAIN_ENABLED}`);
    console.log(`SERVER_ID: ${SERVER_ID}`);
    console.log(`REGION: ${REGION}`);
    getBuilderResp[0].ftpUrl =
      CUSTOM_DOMAIN_ENABLED === "true"
        ? SFTP_CUSTOM_DOMAIN
        : `${SERVER_ID}.server.transfer.${REGION}.amazonaws.com`;
    return success(getBuilderResp);
  }

  return failure({ status: false, error: "Builder doesn't exist." });
};
export const getBuilderAsync = async (hbId) => {
  console.log("In getBuilderAsync");
  console.log(`hbId: ${JSON.stringify(hbId)}`);
  const idParam = hbId || 0;
  console.log(`idParam: ${idParam}`);
  const params = {
    TableName: process.env.entitiesTableName,
    KeyConditionExpression: "#id = :id and #entity = :entity",
    ExpressionAttributeNames: {
      "#id": "id",
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":id": idParam,
      ":entity": "builder",
    },
  };
  console.log(params);
  return getResourcesRaw(params);
};
const getBuilderDetailDB = async (data) => {
  let response;
  const { hbId = "" } = data;
  try {
    const builderDetail = await getBuilderAsync(hbId);
    response = { status: true, data: builderDetail };
  } catch (error) {
    console.log("error getBuilderDetailDB ");
    console.log(error);
    response = { status: false, error };
  }
  return response;
};
const getExternalUser = async (data, isAPI = false) => {
  console.log(`in getExternalUser`);
  const { hb_id: hbId = "" } = data;
  const params = {
    TableName: process.env.entitiesTableName,
    IndexName: process.env.entitiesTableByEntityAndId,
    KeyConditionExpression: "#entity = :entity",
    ExpressionAttributeNames: {
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":entity": `userext#${hbId}`,
    },
  };
  console.log(params);
  if (isAPI) {
    // Called via API
    const externalUserResp = await getResourceJSON(params);
    console.log(`externalUserResp: ${JSON.stringify(externalUserResp)}`);
    if (externalUserResp && externalUserResp.length) {
      // External User Exists
      externalUserResp[0].endpoint = EXTERNAL_ENDPOINT;

      // Get the document path
      const getDocumentPathResp = await getDocumentPath();
      console.log(
        `getDocumentPathResp: ${JSON.stringify(getDocumentPathResp)}`
      );
      if (getDocumentPathResp && getDocumentPathResp.length === 0) {
        // Document Path resource doesn't exist
        externalUserResp[0].docpath = "";
      } else {
        // Document Path resource exists
        externalUserResp[0].docpath = getDocumentPathResp[0].path
          ? getDocumentPathResp[0].path
          : "";
      }
      return success(externalUserResp);
    }

    // External User Doesn't Exist
    return success({ status: true, data: [] });
  }

  // Called from Lambda
  return getResourceJSON(params);
};
const generateRandomString = (length = 10) => {
  let result = "";
  const alphabets = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const specialCharacter = "!-_.*()";
  const characters = `${alphabets}${numbers}${specialCharacter}`;
  const charactersLength = characters.length;
  result += alphabets.charAt(Math.floor(Math.random() * charactersLength));
  for (let i = 0; i < length; i += 1) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};
const getRandomUpperCase = () =>
  String.fromCharCode(Math.floor(Math.random() * 26) + 65);
const getRandomLowerCase = () =>
  String.fromCharCode(Math.floor(Math.random() * 26) + 97);
const getRandomNumber = () =>
  String.fromCharCode(Math.floor(Math.random() * 10) + 48);
const getRandomSymbol = () => {
  const symbol = `^$*.[]{}()?"!@#%&/\\,><':;|_~\``;
  return symbol[Math.floor(Math.random() * symbol.length)];
};
// Generate Password Function
const generatePassword = (length) => {
  let generatedPassword = "";
  let funcName;
  const randomFunc = {
    upper: getRandomUpperCase,
    lower: getRandomLowerCase,
    number: getRandomNumber,
    symbol: getRandomSymbol,
  };
  const genPass = (type) => {
    [funcName] = Object.keys(type);
    generatedPassword += randomFunc[funcName]();
  };
  // Include all conditions
  const upper = true;
  const lower = true;
  const number = true;
  const symbol = true;

  const typesCount = upper + lower + number + symbol;
  const typesArr = [{ upper }, { lower }, { number }, { symbol }].filter(
    (item) => Object.values(item)[0]
  );
  if (typesCount === 0) {
    return "";
  }
  for (let i = 0; i < length; i += typesCount) {
    typesArr.forEach((type) => genPass(type));
  }
  const finalPassword = generatedPassword.slice(0, length);
  return finalPassword;
};


const adminDeleteUser = async (data) => {
  try {

    const { email, id, entity } = data;

    const deleteUserParams = {
      UserPoolId: EXT_USER_POOL_ID,
      Username: email
    };
    const adminDeleteUserResp = await cognitoidentityserviceprovider.adminDeleteUser(deleteUserParams).promise();

    //debugger
    console.log(`adminDeleteUserResp: ${JSON.stringify(adminDeleteUserResp)}`);

    const params = {
      TableName: process.env.entitiesTableName,
      Key: {
        id,
        entity,
      }
    };
    console.log("deleteDbParams", params);

    const deleteUserFromDb = await deleteResources(params);

    console.log(`deleteUserFromDb: ${JSON.stringify(deleteUserFromDb)}`);

    return { status: true, data: adminDeleteUserResp };

  } catch (error) {
    return { status: false, error: error?.message || error };
  }
}

/**
 *
 * @param {Object} data
 * @param {Boolean} isInternal true - called from create/update builder, false - API call
 */
const adminCreateUser = async (data, isInternal = false, forScript = false) => {
  const { hb_id: hbId = "", email = "" } = data;
  // Create Cognito User
  const createUserParams = {
    UserPoolId: EXT_USER_POOL_ID /* required */,
    Username: email /* required */,
    UserAttributes: [
      {
        Name: "custom:hb_id" /* required */,
        Value: hbId,
      },
    ],
    MessageAction: "SUPPRESS",
  };
  try {
    console.log('inside adminCreateUserResp');
    const adminCreateUserResp = await cognitoidentityserviceprovider
      .adminCreateUser(createUserParams)
      .promise();
    console.log(`adminCreateUserResp: ${JSON.stringify(adminCreateUserResp)}`);
  } catch (error) {
    console.log(`Enters Catch:${error}`);
    if (forScript) {
      return ({ status: false, error })
    }
    return failure({ status: false, error });
  }

  // Set the password
  const randomString = generatePassword(8);
  // console.log(`randomString: ${randomString}`);
  let encRandomString;

  // Encrypt the string
  const encParams = {
    KeyId: DYNAMODB_KMS_KEY_ID /* required */,
    Plaintext:
      randomString /* Strings will be Base-64 encoded on your behalf */ /* required */,
  };
  try {
    console.log('inside encryptStringResp');
    const encryptStringResp = await kms.encrypt(encParams).promise();
    console.log(`encryptStringResp: ${JSON.stringify(encryptStringResp)}`);
    encRandomString = encryptStringResp.CiphertextBlob.toString("base64");
    console.log(`encRandomString: ${encRandomString}`);
  } catch (error) {
    return failure({ status: false, error });
  }
  const setPassParams = {
    Password: randomString /* required */,
    UserPoolId: EXT_USER_POOL_ID /* required */,
    Username: email /* required */,
    Permanent: true,
  };
  try {
    console.log('inside adminSetUserPasswordResp');
    const adminSetUserPasswordResp = await cognitoidentityserviceprovider
      .adminSetUserPassword(setPassParams)
      .promise();
    console.log(
      `adminSetUserPasswordResp: ${JSON.stringify(adminSetUserPasswordResp)}`
    );

    if (!forScript) {

      // Add entry to DB
      const id = uuidv4();
      const type = `userext`;
      const cdt = Date.now();
      const params = {
        TableName: process.env.entitiesTableName,
        Item: {
          id,
          type,
          email,
          cdt,
          mdt: cdt,
          entity: `${type}#${hbId}`,
          p: encRandomString,
        },
      };

      console.log(params);
      const addUserToDBResp = await postResources(params);
      console.log(`addUserToDBResp: ${JSON.stringify(addUserToDBResp)}`);

    } else {

      // else for creating users on external userpool by using a script

      const getBuilderExtIdParams = {
        httpMethod: "POST",
        requestPath: "/_search",
        payload: {
          query: {
            bool: {
              must: [
                {
                  match: {
                    "entity.keyword": `userext#${hbId}`
                  }
                },
                {
                  match: {
                    "email.keyword": `${email}`
                  }
                }
              ]
            }
          }
        }
      };

      console.log(`getBuilderExtIdParams: ${JSON.stringify(getBuilderExtIdParams)}`);

      const elasticResult = await elasticExecuteQuery(getBuilderExtIdParams, true);

      console.log(`elasticResult: ${JSON.stringify(elasticResult)}`);

      const resultData = elasticResult?.body?.hits?.hits || [];

      const builderData = resultData.length ? resultData.map(eachData => ({
        ...eachData._source
      })) : [];


      console.log(`builderData: ${JSON.stringify(builderData)}`);

      const cdt = Date.now();

      if (!builderData.length) {

        const params = {
          TableName: process.env.entitiesTableName,
          Item: {
            id: uuidv4(),
            type: "userext",
            email,
            cdt,
            mdt: cdt,
            entity: `userext#${hbId}`,
            p: encRandomString,
          },
        };

        console.log(params);
        const addUserToDBResp = await postResources(params);
        console.log(`addUserToDBResp: ${JSON.stringify(addUserToDBResp)}`);

      } else {

        const updateParams = {
          TableName: process.env.entitiesTableName,
          Key: {
            id: builderData[0]?.id,
            entity: `userext#${hbId}`
          },
          UpdateExpression: `set #P = :P, #mdt = :mdt`,
          ExpressionAttributeNames: {
            "#P": "p",
            "#mdt": "mdt"
          },
          ExpressionAttributeValues: {
            ":P": encRandomString,
            ":mdt": cdt
          },
          ReturnValuesOnConditionCheckFailure: "ALL_OLD"
        }

        console.log(`updateParams: ${JSON.stringify(updateParams)}`);

        const updateResp = await updateResources(updateParams, true);

        console.log(`updateResp: ${JSON.stringify(updateResp)}`);
      }
    }

    // Send response
    if (isInternal) {
      return { status: true, data: "User created successfully" };
    }

    return success({ status: true, data: "User created successfully" });
  } catch (error) {
    if (isInternal) {
      return { status: false, error };
    }

    return failure({ status: false, error });
  }
};
const restoreSecret = async (data, isAPI = false) => {
  let response;
  const { email } = data;
  try {
    const params = {
      SecretId: `${SERVER_ID}/${email}` /* required */,
    };
    const resp = await secretsmanager.restoreSecret(params).promise();
    console.log(`restoreSecret resp: ${JSON.stringify(resp)}`);
    if (isAPI)
      response = success({ status: true, msg: "User activated successfully." });
    else response = { status: true, resp };
  } catch (error) {
    console.log("Error occured restoreSecret");
    console.log(error);
    if (isAPI)
      response = failure({ status: false, error: "User activation failed." });
    else response = { status: false, error };
  }
  return response;
};
const deleteSecret = async (data) => {
  let response;
  const { email } = data;
  try {
    const params = {
      SecretId: `${SERVER_ID}/${email}` /* required */,
      ForceDeleteWithoutRecovery: false,
      RecoveryWindowInDays: 30,
    };
    const resp = await secretsmanager.deleteSecret(params).promise();
    console.log(`resp: ${JSON.stringify(resp)}`);
    response = success({ status: true, msg: "User deactivated successfully." });
  } catch (error) {
    console.log("Error occured deleteSecret");
    response = failure({ status: false, error: "User deactivation failed." });
  }
  return response;
};
const saveTransferUser = async (data) => {
  console.log(`data: ${JSON.stringify(data)}`);
  const { email, secretName, password, isUpdate = false, secretId = "" } = data;
  let response;
  let saveFunction;
  try {
    const secretJSON = {
      Password: password,
      Role: FTP_USER_ROLE_ARN,
      HomeDirectoryDetails: JSON.stringify([
        {
          Entry: "/" /* required */,
          Target: `/${S3_BUCKET_ARN}/transfer/${email}` /* required */,
        },
      ]),
    };
    const saveUserParams = {
      SecretString: JSON.stringify(secretJSON),
      SecretId: "",
      Name: "",
      Tags: "",
    };
    console.log(`saveUserParams: ${JSON.stringify(saveUserParams)}`);
    if (isUpdate) {
      delete saveUserParams.Name;
      delete saveUserParams.Tags;
      saveUserParams.SecretId = secretId;
      saveFunction = "updateSecret";
    } else {
      // Create secret
      delete saveUserParams.SecretId;
      saveUserParams.Name = secretName;
      saveUserParams.Tags = [
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
          Value: "secretsmanager",
        },
      ];
      saveFunction = "createSecret";
    }
    const saveUserResp = await secretsmanager[saveFunction](
      saveUserParams
    ).promise();
    console.log(`saveUserResp: ${JSON.stringify(saveUserResp)}`);
    response = { status: true, resp: saveUserResp };
  } catch (error) {
    console.log("Exception occured in saveTransferUser");
    console.log(error);
    response = { status: false, error };
  }
  return response;
};
const initSaveTransferUser = async (data) => saveTransferUser(data);
const generateRandomPassword = async (data) => {
  const {
    PasswordLength = 12,
    ExcludePunctuation = false,
    ExcludeCharacters = "",
  } = data;
  try {
    const params = {
      IncludeSpace: false,
      PasswordLength,
      RequireEachIncludedType: true,
      ExcludePunctuation,
      ExcludeCharacters,
    };
    const randomStringResp = await secretsmanager
      .getRandomPassword(params)
      .promise();
    return randomStringResp;
  } catch (error) {
    console.log("error: ");
    console.log(error);
    return "";
  }
};
const verifyAndCreateFTPServerUser = async (data) => {
  console.log(`data: ${JSON.stringify(data)}`);
  let response;
  const sendResponse = ({ status, isUpdate = false, password }) => {
    if (status) {
      response = success({
        status: true,
        data: {
          msg: `User ${isUpdate ? "updated" : "created"} successfully.`,
          key: password,
        },
      });
    } else {
      response = failure({
        status: false,
        error: `User ${isUpdate ? "updation" : "creation"} failed.`,
      });
    }
  };
  const { email = "" } = data;
  // Prepare secret name
  const secretName = `${SERVER_ID}/${email}`;
  console.log(`secretName: ${secretName}`);
  // Generate password using secrets manager
  const passwordResp = await generateRandomPassword({
    PasswordLength: 12,
    ExcludePunctuation: false,
    ExcludeCharacters: "\"$%&'()*+,-./:;<=>[\\]^{|}~",
  });
  const { RandomPassword: password } = passwordResp;
  // Check whether a user exists for the builder
  if (email) {
    try {
      // Check whether the user exists
      const describeSecretParams = {
        SecretId: secretName /* required */,
      };
      const describeSecretResp = await secretsmanager
        .describeSecret(describeSecretParams)
        .promise();
      console.log(`describeSecretResp: ${JSON.stringify(describeSecretResp)}`);
      // Check whether the returned result is scheduled for deletion.
      // If so its secret can't be retreived. So a new secret should be created.
      const { Name, DeletedDate } = describeSecretResp;
      console.log(`Name: ${Name}`);
      console.log(`DeletedDate: ${DeletedDate}`);
      if (Name === secretName && DeletedDate) {
        // Scheduled for deletion.
        console.log(`Scheduled for deletion`);
        // So, restore the secret
        const restoreSecretResp = await restoreSecret({
          email,
        });
        console.log(`restoreSecretResp: ${JSON.stringify(restoreSecretResp)}`);
        // Now, update the secret
        const saveUserResp = await initSaveTransferUser({
          email,
          secretName,
          password,
          isUpdate: true,
          secretId: Name,
        });
        sendResponse({
          status: saveUserResp?.status,
          isUpdate: true,
          password,
        });
      } else {
        // User already exists. Update the user.
        const saveUserResp = await initSaveTransferUser({
          email,
          secretName,
          password,
          isUpdate: true,
          secretId: Name,
        });
        sendResponse({
          status: saveUserResp?.status,
          isUpdate: true,
          password,
        });
      }
    } catch (error) {
      console.log(
        `Exception occured in verifyAndCreateFTPServerUser describeUser`
      );
      console.log(error);
      // User doesn't exist. Create a new user by adding it as a secret in the secrets manager.
      const saveUserResp = await initSaveTransferUser({
        email,
        secretName,
        password,
      });
      sendResponse({ status: saveUserResp?.status, isUpdate: false, password });
    }
  } else {
    response = failure({
      status: false,
      error: "Please provide a valid email id for the username.",
    });
  }
  return response;
};
export const updateBuilderDetails = async (data) => {
  console.log(`update builder : ${JSON.stringify(data)}`);
  const {
    id = null,
    name = null,
    appid = null,
    email = null,
    phone = null,
    cdt = null,
    address = null,
    logo = null,
    city = null,
    state = null,
    zip = null,
    country = null,
    ppurl = null,
    ext_builderId: extBuilderId = null,
    ext_token: extToken = null,
    ext_psrc: extPsrc = "",
    ext_cmt_to_note: extCmtToNote = "",
    ext_cmt_to_note_sub: extCmtToNoteSub = "",
    ext_infl: extInfl = [],
    ext_allow_updates: extAllowUpdates = false,
    zillow_psrc: zillowPsrc = "",
    zillow_cmt_to_note: zillowCmtToNote = "",
    zillow_cmt_to_note_sub: zillowCmtToNoteSub = "",
    zillow_infl: zillowInfl = [],
    tz = null,
    external_email = '',
    outlook_integration = false,
    newst = "false", // to enable/disable assigning sales agent to customer
    notifyLead = false,
    notifyEmailId = ''
  } = data;
  console.log(`zillowPsrc: ${zillowPsrc}`);
  console.log(`zillowCmtToNote: ${zillowCmtToNote}`);
  console.log(`zillowCmtToNoteSub: ${zillowCmtToNoteSub}`);
  console.log(`zillowInfl: ${JSON.stringify(zillowInfl)}`);
  let { rnstr = "" } = data;
  if (!rnstr) rnstr = generateRandomString();
  console.log(`rnstr: ${rnstr}`);
  const mdt = Date.now();
  const optin = Object.prototype.hasOwnProperty.call(data, "optin")
    ? data.optin
    : null;
  const rinfl = Object.prototype.hasOwnProperty.call(data, "rinfl")
    ? data.rinfl
    : false;

  // Hide Leads Customers for Sales Agents
  const hlead = Object.prototype.hasOwnProperty.call(data, "hlead")
    ? data.hlead
    : false;

  // Hide Delete Button
  const hdel =
    Object.prototype.hasOwnProperty.call(data, "hdel") &&
      typeof data.hdel === "boolean"
      ? data.hdel
      : false;

  const tplt = data.tplt && data.tplt.length ? data.tplt : null;
  // BRIX Client Id
  const clientid = data.clientid ? data.clientid : null;
  // BRIX Application Id
  const appguid = data.appguid ? data.appguid : null;
  // Homefront HomebuilderID
  const hfhbid = data?.hfhbid ?? "";
  const type = "builder";

  const updateEmailChannelResp = await updateEmailChannel(appid, email);
  console.log(
    `updateEmailChannelResp: ${JSON.stringify(updateEmailChannelResp)}`
  );

  // let bucketParams = { Bucket: id };
  // try {
  //     const headBucketResp = await S3.headBucket(bucketParams).promise();
  //     console.log(`headBucketResp: ${JSON.stringify(headBucketResp)}`);
  // }
  // catch (err) {
  //     if (err.statusCode >= 400 && err.statusCode < 500) {
  //         const createBucketResp = await S3.createBucket(bucketParams).promise();
  //         console.log(`createBucketResp: ${JSON.stringify(createBucketResp)}`);
  //     }
  // }

  const params = {
    TableName: process.env.entitiesTableName,
    Item: {
      id,
      type,
      name,
      appid,
      email,
      phone,
      address,
      cdt,
      mdt,
      logo,
      city,
      state,
      zip,
      country,
      optin,
      rinfl,
      hlead,
      hdel,
      ppurl,
      tplt,
      entity: type,
      rnstr,
      ext_builderId: extBuilderId,
      ext_token: extToken,
      tz,
      ext_psrc: extPsrc,
      ext_cmt_to_note: extCmtToNote,
      ext_cmt_to_note_sub: extCmtToNoteSub,
      ext_infl: extInfl,
      ext_allow_updates: extAllowUpdates,
      zillow_psrc: zillowPsrc,
      zillow_cmt_to_note: zillowCmtToNote,
      zillow_cmt_to_note_sub: zillowCmtToNoteSub,
      zillow_infl: zillowInfl,
      hfhbid,
      outlook_integration,
      external_email,
      newst,
      notifyEmailId,
      notifyLead
    },
  };
  console.log(params);
  // Create/Update /CRM/CustomerData/PublicConfig in the Parameter Store if client id is provided
  if (clientid) {
    params.Item.clientid = clientid;
    // Create/Update /CRM/CustomerData/PublicConfig in the Parameter Store if application guid is provided
    if (appguid) {
      params.Item.appguid = appguid;
    }
    // const putParameterResp = await initUpdateMappings(clientid, id, appguid);
    // console.log(`putParameterResp: ${JSON.stringify(putParameterResp)}`);
  }
  const updateBuilderResp = await postResources(params);
  console.log(`updateBuilderResp: ${JSON.stringify(updateBuilderResp)}`);

  // Check whether the external api user exists
  const getExternalUserResp = await getExternalUser({ hb_id: id });
  console.log(`getExternalUserResp: ${JSON.stringify(getExternalUserResp)}`);


  // Check whether the result is empty
  if (getExternalUserResp && getExternalUserResp.length === 0) {
    // Create external api user since there isn't any
    const adminCreateUserResp = await adminCreateUser(
      { email, hb_id: id },
      true
    );
    console.log(`adminCreateUserResp: ${JSON.stringify(adminCreateUserResp)}`);
  } else {
    const extUserOldDetails = getExternalUserResp[0];
    if (email !== extUserOldDetails.email) {
      // delete user first
      const deleteUser = await adminDeleteUser(extUserOldDetails);

      if (!deleteUser.status) throw deleteUser.error;

      // create new ext user
      const adminCreateUserResp = await adminCreateUser({ email, hb_id: id }, true, true);
      console.log(`adminCreateUserResp: ${JSON.stringify(adminCreateUserResp)}`);

      // Send verification email for the builder
      const verifyEmailIdentityResp = await verifyEmailIdentity(
        { email },
        true
      );
      console.log(
        `verifyEmailIdentityResp: ${JSON.stringify(verifyEmailIdentityResp)}`
      );


      try {
        const verifyDomainDkimFnRes = await verifyDomainDkimFn(
          email.substring(email.lastIndexOf("@") + 1)
        );
        if (
          verifyDomainDkimFnRes &&
          verifyDomainDkimFnRes.DkimTokens &&
          verifyDomainDkimFnRes.DkimTokens.length
        ) {
          await enableDkim(email);
        }
      } catch (error) {
        console.log(
          `verifyDomainDkimFnRes   try catch: ${JSON.stringify(
            error.stack,
            null,
            4
          )}`
        );
      }
    }
  };
  return updateBuilderResp;
};
const getStackOutputsMessaging = async () => {
  const messagingParams = {};
  // Get the outputs of the root stack
  const cloudformationParams = {
    StackName: PROJECT_NAME,
  };
  console.log("cloudformationParams: ", cloudformationParams);
  try {
    const describeStacksResp = await cloudformation
      .describeStacks(cloudformationParams)
      .promise();
    console.log(`describeStacksResp: ${JSON.stringify(describeStacksResp)}`);
    const stackOutputs =
      describeStacksResp &&
        describeStacksResp.Stacks &&
        describeStacksResp.Stacks.length &&
        describeStacksResp.Stacks[0].Outputs
        ? describeStacksResp.Stacks[0].Outputs
        : [];
    console.log(`stackOutputs: ${JSON.stringify(stackOutputs)}`);
    for (const stackOutput of stackOutputs) {
      switch (stackOutput.OutputKey) {
        case "HydrationEndpointHF":
          messagingParams.hydrationCRM = stackOutput.OutputValue;
          break;
        case "MessagingEndpointHF":
          messagingParams.publishCRM = stackOutput.OutputValue;
          break;
        default:
          break;
      }
    }
    console.log(`messagingParams: ${JSON.stringify(messagingParams)}`);
    return messagingParams;
  } catch (error) {
    console.log(`error: `);
    console.log(error);
    return null;
  }
};
export const getMessagingParams = async (noGetReadOnlyParams = false) => {
  const getMessagingParamsReq = {
    TableName: process.env.entitiesTableName,
    IndexName: process.env.entitiesTableByEntityAndId,
    KeyConditionExpression: "#entity = :entity",
    ExpressionAttributeNames: {
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":entity": "msgparams",
    },
  };
  console.log(getMessagingParamsReq);
  const messageParams = await getResourceJSON(getMessagingParamsReq);

  let messagingParams =
    messageParams && messageParams.length ? messageParams[0] : {};
  if (!noGetReadOnlyParams) {
    // Merge the publishCRM & hydrationCRM endpoints from cloudformation outputs
    const readOnlyParams = await getStackOutputsMessaging();
    console.log(`readOnlyParams: ${JSON.stringify(readOnlyParams)}`);
    if (readOnlyParams)
      messagingParams = { ...messagingParams, ...readOnlyParams };
  }
  return messagingParams;
};
const getMessagingParamsInit = async (data) => {
  let response;
  const { noGetReadOnlyParams = true } = data;
  try {
    const messagingParams = await getMessagingParams(noGetReadOnlyParams);
    response = { status: true, data: messagingParams };
  } catch (error) {
    console.log("error getMessagingParamsInit ");
    console.log(error);
    response = { status: false, error };
  }
  return response;
};
export const updateMessagingParams = async (msgParamsReq) => {
  console.log(`msgParamsReq: ${JSON.stringify(msgParamsReq)}`);
  let isUpdate = false;
  let messagingParamsUpdateResp;
  let params;

  try {
    // Get the public config from  Previously was in the Param Store.
    const messagingParamsResp = await getMessagingParams(true);
    console.log(`messagingParamsResp: ${JSON.stringify(messagingParamsResp)}`);
    isUpdate = !(
      Object.keys(messagingParamsResp).length === 0 &&
      messagingParamsResp.constructor === Object
    );
    console.log(`isUpdate: ${isUpdate}`);
    if (isUpdate) {
      console.log(`In update`);
      const messagingParams = messagingParamsResp;
      const modDt = Date.now();
      // Call from admin lambda to update the messaging parameters
      // Here we only update the host and path parameters for post and hydration
      // { publishHost: messagingPostHost, publishPath: messagingPostPath, hydrationHost: messagingHydrationHost, hydrationPath: messagingHydrationPath }
      params = {
        TableName: process.env.entitiesTableName,
        Key: {
          id: messagingParams.id,
          entity: "msgparams",
        },
        UpdateExpression: `set #publishHost = :publishHostVal, #publishPath = :publishPathVal, #hydrationHost = :hydrationHostVal, #hydrationPath = :hydrationPathVal, #publishHostHf = :publishHostValHf, #publishPathHf = :publishPathValHf, #hydrationHostHf = :hydrationHostValHf, #hydrationPathHf = :hydrationPathValHf, #keyValHf = :keyValHf, mdt = :modDate`,
        ExpressionAttributeNames: {
          "#publishHost": "publishHost",
          "#publishPath": "publishPath",
          "#hydrationHost": "hydrationHost",
          "#hydrationPath": "hydrationPath",
          "#publishHostHf": "publishHostHf",
          "#publishPathHf": "publishPathHf",
          "#hydrationHostHf": "hydrationHostHf",
          "#hydrationPathHf": "hydrationPathHf",
          "#keyValHf": "keyValHf",
        },
        ExpressionAttributeValues: {
          ":publishHostVal": msgParamsReq.publishHost,
          ":publishPathVal": msgParamsReq.publishPath,
          ":hydrationHostVal": msgParamsReq.hydrationHost,
          ":hydrationPathVal": msgParamsReq.hydrationPath,
          ":publishHostValHf": msgParamsReq.publishHostHf,
          ":publishPathValHf": msgParamsReq.publishPathHf,
          ":hydrationHostValHf": msgParamsReq.hydrationHostHf,
          ":hydrationPathValHf": msgParamsReq.hydrationPathHf,
          ":keyValHf": msgParamsReq.keyValHf,
          ":modDate": modDt,
        },
        ReturnValuesOnConditionCheckFailure: "ALL_OLD",
      };
      console.log(params);
      messagingParamsUpdateResp = await updateResources(params);
    } else {
      console.log(`In create`);
      const id = uuidv4();
      const cdt = Date.now();
      const mdt = Date.now();
      const type = "msgparams";
      params = {
        TableName: process.env.entitiesTableName,
        Item: {
          id,
          type,
          cdt,
          mdt,
          entity: type,
          ...msgParamsReq,
        },
      };
      console.log(params);
      messagingParamsUpdateResp = await postResources(params);
    }
    console.log(
      `messagingParamsUpdateResp: ${JSON.stringify(messagingParamsUpdateResp)}`
    );
    return messagingParamsUpdateResp;
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
    return null;
  }
};
export const createBuilder = async (data) => {
  console.log(`create builder : ${JSON.stringify(data)}`);
  const {
    isImportBuilder = false,
    name = null,
    email = null,
    phone = null,
    address = null,
    logo = null,
    city = null,
    state = null,
    zip = null,
    country = null,
    ppurl = null,
    ext_builderId: extBuilderId = null,
    ext_token: extToken = null,
    ext_psrc: extPsrc = "",
    ext_cmt_to_note: extCmtToNote = "",
    ext_cmt_to_note_sub: extCmtToNoteSub = "",
    ext_infl: extInfl = [],
    ext_allow_updates: extAllowUpdates = true,
    zillow_psrc: zillowPsrc = "",
    zillow_cmt_to_note: zillowCmtToNote = "",
    zillow_cmt_to_note_sub: zillowCmtToNoteSub = "",
    zillow_infl: zillowInfl = [],
    tz = null,
    newst = "false"  // to enable/disable assigning sales agent to customer
  } = data;
  console.log(`zillowPsrc: ${zillowPsrc}`);
  console.log(`zillowCmtToNote: ${zillowCmtToNote}`);
  console.log(`zillowCmtToNoteSub: ${zillowCmtToNoteSub}`);
  console.log(`zillowInfl: ${JSON.stringify(zillowInfl)}`);
  const rnstr = generateRandomString();
  const id = isImportBuilder ? data?.id : uuidv4();
  const cdt = Date.now();
  const mdt = Date.now();
  const optin = Object.prototype.hasOwnProperty.call(data, "optin")
    ? data.optin
    : null;
  const rinfl = Object.prototype.hasOwnProperty.call(data, "rinfl")
    ? data.rinfl
    : false;
  // Hide Leads Customers for Sales Agents
  const hlead = Object.prototype.hasOwnProperty.call(data, "hlead")
    ? data.hlead
    : false;

  // Hide Delete Button
  const hdel =
    Object.prototype.hasOwnProperty.call(data, "hdel") &&
      typeof data.hdel === "boolean"
      ? data.hdel
      : false;

  const tplt = data.tplt && data.tplt.length ? data.tplt : "";
  // BRIX Client Id
  const clientid = data.clientid ? data.clientid : null;
  // BRIX Application Id
  const appguid = data.appguid ? data.appguid : null;
  // Homefront HomebuilderID
  const hfhbid = data?.hfhbid ?? "";
  const type = "builder";
  console.log(`rnstr for file manager bucket name: ${rnstr}`);

  // create Pinpoint App
  const createAppResp = await createApp(name);
  console.log(`createAppResp: ${JSON.stringify(createAppResp)}`);
  if (createAppResp?.status) {
    const appid = createAppResp?.data?.ApplicationResponse?.Id || "";

    // Use builder's email id as the from address for the app
    const updateEmailChannelResp = await updateEmailChannel(appid, email);
    console.log(
      `updateEmailChannelResp: ${JSON.stringify(updateEmailChannelResp)}`
    );

    // Use the Kinesis Firehose Stream created from template
    // and set the event stream for the app
    const attachEventStreamResp = await attachEventStream(appid);
    console.log(
      `attachEventStreamResp: ${JSON.stringify(attachEventStreamResp)}`
    );

    // let bucketParams = { Bucket: id };
    // try {
    //     const headBucketResp = await S3.headBucket(bucketParams).promise();
    //     console.log(`headBucketResp: ${JSON.stringify(headBucketResp)}`);
    // }
    // catch (err) {
    //     if (err.statusCode >= 400 && err.statusCode < 500) {
    //         const createBucketResp = await S3.createBucket(bucketParams).promise();
    //         console.log(`createBucketResp: ${JSON.stringify(createBucketResp)}`);
    //     }
    // }

    // const folderCreateRes = await createFolder({ name: rnstr });
    // console.log(`folderCreateRes: ${JSON.stringify(folderCreateRes)}`);

    const params = {
      TableName: process.env.entitiesTableName,
      Item: {
        id,
        type,
        name,
        appid,
        email,
        phone,
        address,
        cdt,
        mdt,
        logo,
        city,
        state,
        zip,
        country,
        optin,
        rinfl,
        hlead,
        hdel,
        ppurl,
        tplt,
        entity: type,
        rnstr,
        ext_builderId: extBuilderId,
        ext_token: extToken,
        tz,
        ext_psrc: extPsrc,
        ext_cmt_to_note: extCmtToNote,
        ext_cmt_to_note_sub: extCmtToNoteSub,
        ext_infl: extInfl,
        ext_allow_updates: extAllowUpdates,
        zillow_psrc: zillowPsrc,
        zillow_cmt_to_note: zillowCmtToNote,
        zillow_cmt_to_note_sub: zillowCmtToNoteSub,
        zillow_infl: zillowInfl,
        hfhbid,
        newst
      },
    };
    // Create/Update /CRM/CustomerData/PublicConfig in the Parameter Store if client id is provided
    if (clientid) {
      params.Item.clientid = clientid;
      // Create/Update /CRM/CustomerData/PublicConfig in the Parameter Store if application guid is provided
      if (appguid) {
        params.Item.appguid = appguid;
      }
    }
    console.log(params);
    const createBuilderResp = await postResources(params);
    console.log(`createBuilderResp: ${JSON.stringify(createBuilderResp)}`);


    try {
      // create dynamicRequired Fields for customer, realtor, agency and cobuyer;
      const dynamicRequiredFieldCreationResp = await createDynamicRequiredField({ hb_id: id }, true);
      console.log(`dynamicRequiredFieldCreationResp: ${JSON.stringify(dynamicRequiredFieldCreationResp)}`);
      if (!dynamicRequiredFieldCreationResp?.status) throw dynamicRequiredFieldCreationResp?.error;

      // create move-in-time-frame for new builder
      const moveInTimeFrames = ["As soon as possible", "2-3 Months", "Over 3 Months"];
      for (const desm of moveInTimeFrames) {
        const createMoveInTimeFrameResp = await createMoveInTimeFrame({ name: desm, hb_id: id });
        //debugger
        console.log(`createMoveInTimeFrameResp: ${JSON.stringify(createMoveInTimeFrameResp)}`);
      };

      // Create external api user
      const adminCreateUserResp = await adminCreateUser(
        { email, hb_id: id },
        true
      );
      console.log(
        `adminCreateUserResp: ${JSON.stringify(adminCreateUserResp)}`
      );

      // Send verification email for the builder
      const verifyEmailIdentityResp = await verifyEmailIdentity(
        { email },
        true
      );
      console.log(
        `verifyEmailIdentityResp: ${JSON.stringify(verifyEmailIdentityResp)}`
      );
      try {
        const verifyDomainDkimFnRes = await verifyDomainDkimFn(
          email.substring(email.lastIndexOf("@") + 1)
        );
        if (
          verifyDomainDkimFnRes &&
          verifyDomainDkimFnRes.DkimTokens &&
          verifyDomainDkimFnRes.DkimTokens.length
        ) {
          await enableDkim(email);
        }
      } catch (error) {
        console.log(
          `verifyDomainDkimFnRes   try catch: ${JSON.stringify(
            error.stack,
            null,
            4
          )}`
        );
      }
      // Whether to send appid with reponse.
      // This is initially implemented to send appid as response to create builder call from builder data migration
      if (isImportBuilder) {
        return { status: true, appid };
      }

      return createBuilderResp;
    } catch (error) {
      if (isImportBuilder) {
        return { status: false, error };
      }
      return failure({ status: false, error: "Builder creation failed." });
    }
  } else {
    // Create Pinpoint Application failed. Abort the create builder operation and return the error.
    if (isImportBuilder) {
      return { status: false, error: createAppResp?.error };
    }
    return failure({ status: false, error: "Builder creation failed." });
  }
};
const sendVerificationEmailforBuilder = async (data) => {
  // Send verification email for the builder
  try {
    const doVerifyEmailIdentityOnlyResp = await doVerifyEmailIdentityOnly(
      data.email
    );
    console.log(
      `doVerifyEmailIdentityOnlyResp: ${JSON.stringify(
        doVerifyEmailIdentityOnlyResp
      )}`
    );
    return success(doVerifyEmailIdentityOnlyResp);
  } catch (error) {
    return failure({ status: false, error });
  }
};
const updateAppStream = async (data) => {
  try {
    const attachEventStreamResp = await attachEventStream(data.appid);
    console.log(
      `attachEventStreamResp: ${JSON.stringify(attachEventStreamResp)}`
    );
    return success(attachEventStreamResp);
  } catch (error) {
    return failure({ status: false, error });
  }
};
/* const saveBuilderExternalAPIConfig = async (data) => {
    const { builderId, token, hb_id } = data;
    console.log(`builderId: ${builderId}`);
    console.log(`token: ${token}`);
    console.log(`hb_id: ${hb_id}`);
    const type = "extconfig";
    const updatedDate = Date.now();
    let id = uuidv4(), creationDate = Date.now(), rnstr = '';
    // Decide whether it is create or update
    // Fetch external config resource for the home builder
    const extConfigRes = await getEntities(`${type}#${hb_id}`);
    console.log(`extConfigRes: ${JSON.stringify(extConfigRes)}`);
    if (extConfigRes && extConfigRes.length) {
        // Already exists
        id = extConfigRes[0].id;
        creationDate = extConfigRes[0].cdt;
    }
    else {
        const getBuilderResp = await getBuilderAsync(hb_id);
        console.log(`getBuilderResp: ${JSON.stringify(getBuilderResp)}`);
        if (getBuilderResp && getBuilderResp.rnstr) {
            rnstr = getBuilderResp.rnstr;
        }
    }
    const params = {
        TableName: process.env.entitiesTableName,
        Item: {
            id, type, entity: `${type}#${hb_id}`, data: type, cdt: creationDate, mdt: updatedDate, builderId, token, hb_id, rnstr
        }
    };
    console.log(params);
    return postResources(params);
} */
const updateBuilderEmailChannel = async (data) => {
  const { appid, email, configSet = "" } = data;
  if (appid) {
    const updateEmailChannelResp = await updateEmailChannel(
      appid,
      email,
      configSet
    );
    console.log(
      `updateEmailChannelResp: ${JSON.stringify(updateEmailChannelResp)}`
    );
    return success(updateEmailChannelResp);
  }

  return badRequest({ status: false, error: `Please provide a valid appid` });
};
const exportBuilderData = async (data) => {
  const { hb_id: hbid } = data;
  const input = JSON.stringify({
    hbid,
    purpose: "exportBuilder",
  });
  const params = {
    input,
    stateMachineArn: DATA_MIGRAION_MACHINE_ARN,
  };
  try {
    console.log(`params: ${JSON.stringify(params)}`);
    const startExecutionResp = await sfn.startExecution(params).promise();
    console.log(`startExecutionResp: ${JSON.stringify(startExecutionResp)}`);
    return success({ status: true });
  } catch (error) {
    console.log(`error`);
    console.log(error);
    return failure({ status: false, error });
  }
};
const initBuilderDataImport = async (data) => {
  const { fileKey } = data;
  const input = JSON.stringify({
    fileKey,
  });
  const params = {
    input,
    stateMachineArn: DATA_IMPORT_MACHINE_ARN,
  };
  try {
    console.log(`params: ${JSON.stringify(params)}`);
    const startExecutionResp = await sfn.startExecution(params).promise();
    console.log(`startExecutionResp: ${JSON.stringify(startExecutionResp)}`);
    return success({ status: true });
  } catch (error) {
    console.log(`error`);
    console.log(error);
    return failure({ status: false, error });
  }
};
const initStageDateStepFunction = async (data) => {
  const input = JSON.stringify(data);
  const params = {
    input,
    stateMachineArn: STAGE_DATE_MACHINE_ARN,
  };
  try {
    console.log(`params: ${JSON.stringify(params)}`);
    const startExecutionResp = await sfn.startExecution(params).promise();
    console.log(`startExecutionResp: ${JSON.stringify(startExecutionResp)}`);
    return success({ status: true });
  } catch (error) {
    console.log(`error`);
    console.log(error);
    return failure({ status: false, error });
  }
};
const getEmailActivityStatusContent = async (data) => {
  console.log(`data: ${JSON.stringify(data)}`);
  const s3Params = {
    Bucket: FILE_MANAGER_BUCKET_NAME,
    Key: data.key,
  };
  console.log(`s3Params: ${JSON.stringify(s3Params)}`);
  try {
    const getObjectResp = await s3.getObject(s3Params).promise();
    const status =
      getObjectResp && getObjectResp.Body
        ? JSON.parse(Buffer.from(getObjectResp.Body))
        : [];
    return success(status);
  } catch (error) {
    console.log(`error: ${JSON.stringify(error)}`);
    return failure(error);
  }
};
const initEmailActivityUpdate = async (data) => {
  console.log(`data: ${JSON.stringify(data)}`);
  const { rnstr } = data;
  const currentTimeISO = new Date().toISOString();
  const statusFileKey = `email_activity_update/${rnstr}/${currentTimeISO}_status.json`;
  const input = JSON.stringify({ ...data, statusFileKey });
  const params = {
    input,
    stateMachineArn: EMAIL_ACTIVITY_UPDATE_MACHINE_ARN,
  };
  try {
    console.log(`params: ${JSON.stringify(params)}`);
    const startExecutionResp = await sfn.startExecution(params).promise();
    console.log(`startExecutionResp: ${JSON.stringify(startExecutionResp)}`);
    return success({ status: true, statusFileKey });
  } catch (error) {
    console.log(`error`);
    console.log(error);
    return failure({ status: false, error });
  }
};
const initEndpointUpdate = async (data) => {
  console.log(`data: ${JSON.stringify(data)}`);
  const { hb_id: hbId = "", rnstr = "", optin = false } = data;
  const endpointUpdateParams = {
    hb_id: hbId,
    optin,
    rnstr,
  };
  console.log(`endpointUpdateParams: ${JSON.stringify(endpointUpdateParams)}`);
  const input = JSON.stringify(endpointUpdateParams);
  const params = {
    input,
    stateMachineArn: ENDPOINT_UPDATE_MACHINE_ARN,
  };
  try {
    console.log(`params: ${JSON.stringify(params)}`);
    const startExecutionResp = await sfn.startExecution(params).promise();
    console.log(`startExecutionResp: ${JSON.stringify(startExecutionResp)}`);
    return success({ status: true });
  } catch (error) {
    console.log(`error`);
    console.log(error);
    return failure({ status: false, error });
  }
};
const getExportStatus = async (data) => {
  console.log(`data: ${JSON.stringify(data)}`);
  const { hb_id: hbid = "" } = data;
  try {
    if (!hbid) {
      return badRequest({ status: false, error: "Home builder Id is missing" });
    }

    const exportStatusResp = await getRecordByEntity(
      `builder_export_status#${hbid}`
    );
    console.log(`exportStatusResp: ${JSON.stringify(exportStatusResp)}`);
    return success(exportStatusResp);
  } catch (error) {
    return failure({ status: false, error });
  }
};
const getImportStatus = async (data) => {
  console.log(`data: ${JSON.stringify(data)}`);
  const { hb_id: hbid = "" } = data;
  try {
    let importStatusResp = await getRecordByEntity(`builder_import_status`);
    console.log(`importStatusResp: ${JSON.stringify(importStatusResp)}`);
    // Filter based on hbid if provided
    if (hbid) {
      importStatusResp = importStatusResp.filter(
        (status) => status?.status?.hbid === hbid
      );
    }
    return success(importStatusResp);
  } catch (error) {
    return failure({ status: false, error });
  }
};

const resetLeadId = async (event) => {
  try {
    const hbid =
      event && event.pathParameters && event.pathParameters.id
        ? event.pathParameters.id
        : "";
    if (hbid) {
      const type = "lastlead";
      const updatedDate = Date.now();
      let id = uuidv4();
      let creationDate = Date.now();
      // Decide whether it is create or update
      // Fetch lastlead resource for the home builder
      const lastLeadResource = await getEntities(`${type}#${hbid}`);
      console.log(`lastLeadResource: ${JSON.stringify(lastLeadResource)}`);
      if (lastLeadResource && lastLeadResource.length) {
        // Already exists
        id = lastLeadResource[0].id;
        creationDate = lastLeadResource[0].cdt;
      }
      const params = {
        TableName: process.env.entitiesTableName,
        Item: {
          id,
          type,
          entity: `${type}#${hbid}`,
          data: type,
          leadid: "",
          cdt: creationDate,
          mdt: updatedDate,
        },
      };
      console.log(params);
      return postResources(params);
    }
    return failure({ status: false, error: "Builder ID Required." });
  } catch (error) {
    console.log(`error: ${JSON.stringify(error.stack)}`);
    return failure({ status: false, error: error.stack });
  }
};

const retryDomainVerification = async (data) => {
  console.log("retryDomainVerification");
  console.log(`data: ${JSON.stringify(data)}`);
  try {
    const builderEmail = data && data.email ? data.email : "";
    console.log(`builderEmail: ${JSON.stringify(builderEmail)}`);
    if (builderEmail) {
      let resp = "Success";
      const verifyDomainDkimFnRes = await verifyDomainDkimFn(
        builderEmail.substring(builderEmail.lastIndexOf("@") + 1)
      );
      console.log(
        `verifyDomainDkimFnRes: ${JSON.stringify(verifyDomainDkimFnRes)}`
      );
      resp = verifyDomainDkimFnRes;
      if (
        verifyDomainDkimFnRes &&
        verifyDomainDkimFnRes.DkimTokens &&
        verifyDomainDkimFnRes.DkimTokens.length
      ) {
        const enableDkimResp = await enableDkim(builderEmail);
        console.log(`enableDkimResp: ${JSON.stringify(enableDkimResp)}`);
        resp = enableDkimResp;
        if (enableDkimResp && enableDkimResp.ResponseMetadata) {
          const dkimDetails = await getDkimStatus(builderEmail);
          console.log(`dkimDetails: ${JSON.stringify(dkimDetails)}`);
          resp = dkimDetails;
          if (dkimDetails && dkimDetails.DkimAttributes) {
            if (dkimDetails.DkimAttributes[builderEmail]) {
              if (dkimDetails.DkimAttributes[builderEmail].DkimEnabled) {
                console.log(`dkimDetails: ${JSON.stringify(dkimDetails)}`);
                resp = dkimDetails.DkimAttributes[builderEmail];
              }
            }
          }
        }
      }
      return success(resp);
    }
    return badRequest({ status: false, error: "Email ID Required !!" });
  } catch (error) {
    console.log(
      `builder dkim   try catch: ${JSON.stringify(error.stack, null, 4)}`
    );
    return failure({ status: false, error: error.stack });
  }
};
const updateTransferServer = async (data) => {
  const { params, WorkflowId } = data;
  const { ServerId } = params;
  console.log(`params: ${JSON.stringify(params)}`);
  const updateServerParams = {
    ServerId /* required */,
    WorkflowDetails: {
      OnUpload: [
        {
          ExecutionRole: TRANSFER_WORKFLOW_EXECUTION_ROLE /* required */,
          WorkflowId /* required */,
        },
      ],
    },
  };
  console.log(`updateServerParams: ${JSON.stringify(updateServerParams)}`);
  try {
    const updateServerResp = await transfer
      .updateServer(updateServerParams)
      .promise();
    console.log(`updateServerResp: ${JSON.stringify(updateServerResp)}`);
    return { status: true, data: updateServerResp };
  } catch (error) {
    console.log(`Error occured at updateTransferServer`);
    console.log(error);
    return { status: false, error };
  }
};
const describeTransferServer = async () => {
  const describeServerParams = {
    ServerId: SERVER_ID /* required */,
  };
  try {
    const describeServerResp = await transfer
      .describeServer(describeServerParams)
      .promise();
    console.log(`describeServerResp: ${JSON.stringify(describeServerResp)}`);
    return { status: true, data: describeServerResp };
  } catch (error) {
    console.log(`Error occured at describeTransferServer`);
    console.log(error);
    return { status: false, error };
  }
};
const createTransferWorkflow = async () => {
  const createWorkflowParams = {
    Steps: [
      /* required */
      {
        CustomStepDetails: {
          Name: "TransferInitLambda",
          Target: TRANSFER_WORKFLOW_LAMBDA_ARN,
          TimeoutSeconds: 60,
        },
        Type: "CUSTOM",
      },
    ],
    Description: "Trigger lambda to initiate lead import",
    OnExceptionSteps: [
      {
        CustomStepDetails: {
          Name: "TransferInitExceptionLambda",
          Target: TRANSFER_WORKFLOW_EXCEPTION_LAMBDA_ARN,
          TimeoutSeconds: 60,
        },
        Type: "CUSTOM",
      },
    ],
    Tags: [
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
        Value: "transferfamily",
      },
    ],
  };
  console.log(`createWorkflowParams: ${JSON.stringify(createWorkflowParams)}`);
  try {
    const createWorkflowResp = await transfer
      .createWorkflow(createWorkflowParams)
      .promise();
    console.log(`createWorkflowResp: ${JSON.stringify(createWorkflowResp)}`);
    return { status: true, data: createWorkflowResp };
  } catch (error) {
    console.log(`Error occured at createTransferWorkflow`);
    console.log(error);
    return { status: false, error };
  }
};
const setupServerWorkflow = async () => {
  try {
    // Get the Transfer Server Details
    const describeServerResp = await describeTransferServer();
    // Check whether a post processing workflow has been created for this server
    if (describeServerResp?.status) {
      if (
        !describeServerResp?.data?.Server?.WorkflowDetails?.OnUpload?.length
      ) {
        // Create a workflow for Transfer server
        const createWorkflowResp = await createTransferWorkflow();
        if (createWorkflowResp?.status) {
          // Update the server with workflow details
          const updateServerResp = await updateTransferServer({
            params: describeServerResp?.data?.Server,
            WorkflowId: createWorkflowResp?.data?.WorkflowId,
          });
          if (updateServerResp?.status) {
            return success({
              status: true,
              data: "Workflow attached successfully.",
            });
          }
          return failure({ status: false, error: updateServerResp?.error });
        }
        return failure({ status: false, error: createWorkflowResp?.error });
      }
      return success({ status: true, data: "Workflow already configured." });
    }
    return failure({ status: false, error: describeServerResp?.error });
  } catch (error) {
    console.log(`Error occured at setupServerWorkflow`);
    console.log(error);
    return failure({ status: false, error });
  }
};
const listBuildersPaginated = async () => {
  const params = {
    TableName: process.env.entitiesTableName,
    IndexName: process.env.entitiesTableByEntityAndId,
    KeyConditionExpression: "#entity = :entity",
    ExpressionAttributeNames: {
      "#entity": `entity`,
    },
    ExpressionAttributeValues: {
      ":entity": `builder`,
    },
  };
  return doPaginatedQueryDB({ hbId: "", params });
};

const receiveElasticDLQMessages = async (data) => {
  console.log(`ELASTIC_DLQ_URL: ${ELASTIC_DLQ_URL}`);
  try {
    const params = {
      QueueUrl: ELASTIC_DLQ_URL /* required */,
      AttributeNames: ["All"],
      // MaxNumberOfMessages: "10",
      // MessageAttributeNames: [
      //   "STRING_VALUE",
      //   /* more items */
      // ],
      // ReceiveRequestAttemptId: "STRING_VALUE",
      // VisibilityTimeout: "NUMBER_VALUE",
      // WaitTimeSeconds: "30",
      ...data,
    };
    const receivedMessages = await sqs.receiveMessage(params).promise();
    console.log(`receivedMessages: ${JSON.stringify(receivedMessages)}`);
    return success(receivedMessages);
  } catch (error) {
    console.log(`Exception occured at receiveElasticDLQMessages`);
    console.log(error);
    return failure(error);
  }
};

const initMetroUpdateSfn = async (data) => {
  try {
    let buildersList = [];
    buildersList = data?.builders?.length
      ? data?.builders
      : await listBuildersPaginated();
    //  const buildersList = ["5b7ae432-853a-44f3-bd31-9b563b14e258"];
    console.log("buildersList", JSON.stringify(buildersList));
    for (const builder of buildersList) {
      const input = JSON.stringify({
        hb_id: data?.builders.length ? builder : builder.id,
        purpose: "metroUpdation",
        type: data.type,
        filter: data?.filter || {},
        communityLambdaArn: COMMUNITY_LAMBDA_ARN,
        agencyLambdaArn: AGENCIES_LAMBDA_ARN,
        coBuyerLambdaArn: COBUYER_LAMBDA_ARN,
      });
      const params = {
        input,
        stateMachineArn: ENDPOINT_UPDATE_MACHINE_ARN,
      };
      console.log(`params: ${JSON.stringify(params)}`);
      const startExecutionResp = await sfn.startExecution(params).promise();
      console.log(`startExecutionResp: ${JSON.stringify(startExecutionResp)}`);
    }
    return success({ status: true });
  } catch (error) {
    console.log(`error`);
    console.log(error);
    return failure({ status: false, error });
  }
};


const initEndpointUpdateSfn = async (data) => {
  const { hb_id = '' } = data;
  const params = {
    TableName: process.env.entitiesTableName,
    KeyConditionExpression: "#id = :id and #entity = :entity",
    ExpressionAttributeNames: {
      "#id": "id",
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":id": hb_id,
      ":entity": "builder",
    },
  };
  console.log(params);
  const getBuilderResp = await getResourceJSON(params);
  console.log(`getBuilderResp: ${JSON.stringify(getBuilderResp)}`);
  if (getBuilderResp?.length) {
    try {
      const input = JSON.stringify({
        purpose: "pinpointUpdate",
        ...getBuilderResp[0],
        hb_id
      });
      const params = {
        input,
        stateMachineArn: ENDPOINT_UPDATE_MACHINE_ARN,
      };
      console.log(`params: ${JSON.stringify(params)}`);
      const startExecutionResp = await sfn.startExecution(params).promise();
      console.log(`startExecutionResp: ${JSON.stringify(startExecutionResp)}`);
      return success({ status: true });
    } catch (error) {
      console.log(`error`);
      console.log(error);
      return failure({ status: false, error });
    }
  }
};

// delete builder
export const deleteBuilder = async (data) => {
  try {
    const { hb_id: hbIdArray = [] } = data;

    if (!hbIdArray.length) throw "Builder Id Array Contains Empty Values."

    const cdt = new Date().toISOString();

    // execute stateMachine
    const input = JSON.stringify({
      hbIdArray,
      isStart: true,
      cdt
    });

    const stateMachineParams = {
      input,
      stateMachineArn: BUILDER_DELETE_STATEMACHINE_ARN
    };
    console.log(`stateMachineParams: ${JSON.stringify(stateMachineParams)}`);
    const startExecutionResp = await sfn.startExecution(stateMachineParams).promise();
    console.log(`startExecutionResp: ${JSON.stringify(startExecutionResp)}`);

    return success({
      status: true, data: {
        deletedDate: cdt,
        hb_id: hbIdArray
      }, message: "Builder Delete Successfull"
    });
  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`);
    return failure({ status: false, error: error?.message || error });
  };
};



// script for creating builder user in external user pool
const createExtBuilderUsersResp = async (data) => {

  try {

    console.log(`Event: ${JSON.stringify(data)}`);

    const builderList = await listBuilders(true);

    console.log(`builderList: ${JSON.stringify(builderList)}`);

    let responseData = [];

    // Create external api user
    for (let eachData of builderList) {
      console.log(`EachData: ${JSON.stringify(eachData)}`);

      const adminCreateUserResp = await adminCreateUser({ email: eachData.email, hb_id: eachData.id }, true, true);

      console.log(
        `adminCreateUserResp: ${JSON.stringify(adminCreateUserResp)}`
      );

      responseData.push(adminCreateUserResp);
    }


    return success({
      status: true,
      data: responseData,
      message: "Migration Success"
    });

  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`);
    return failure({ status: false, error: error?.message || error });
  }
};

async function removeEntitiesBatch(data) {
  const { hbId, entities = [] } = data;
  try {
    if (!hbId) {
      throw new Error(`Please provide hbId`)
    }
    if (!entities.length) {
      throw new Error(`Entities cannot be empty`)
    }
    const delReqArr = entities.reduce((reqArray, item) => {
      if (!item.id || !item.entity) {
        throw new Error('Invalid entity found in the request')
      }
      const delArr = [...reqArray, {
        DeleteRequest: {
          Key: {
            ...item
          }
        }
      }]
      return delArr
    }, []);

    const batchWriteParams = {
      RequestItems: {
        [process.env.entitiesTableName]: delReqArr
      }
    }

    console.log(`batchWriteParams: ${JSON.stringify(batchWriteParams)}`);
    const batchWriteResp = await batchWriteItems(batchWriteParams);
    console.log(`batchWriteResp: ${JSON.stringify(batchWriteResp)}`);

    const batchWriteBody = batchWriteResp.body ? JSON.parse(batchWriteResp.body) : {};
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

    if (!isBatchSuccess)
      throw new Error(`There are unprocessed batch items, some data of builder doesnt deleted`);

    return success({ statusCode: 204 })
  } catch (error) {
    console.log('Error in batch delete ');
    console.log(error);
    return failure({ statusCode: 404, error })
  }
}

const emailNotification = async (data) => {
  try {
    //debugger
    console.log(`data: ${JSON.stringify(data)}`);

    const { hb_id: hbId, notifyEmailId = '', notifyLead = false } = data;

    if (!hbId) throw "hb_Id is Required";

    if (notifyLead && !notifyEmailId) throw "Email Id Is required for enabling Email Notification";

    const emailNotificationUpdateParams = {
      TableName: process.env.entitiesTableName,
      Key: {
        id: hbId,
        entity: "builder"
      },
      UpdateExpression: "SET #notifyLead = :notifyLead, #notifyEmailId = :notifyEmailId, #mdt = :mdt",
      ExpressionAttributeNames: {
        "#notifyLead": "notifyLead",
        "#notifyEmailId": "notifyEmailId",
        "#mdt": "mdt"
      },
      ExpressionAttributeValues: {
        ":notifyLead": notifyLead,
        ":notifyEmailId": notifyEmailId,
        ":mdt": Date.now()
      }
    };

    //debugger
    console.log(`emailNotificationUpdateParams: ${JSON.stringify(emailNotificationUpdateParams)}`);

    const emailNotificationUpdateResp = await updateResources(emailNotificationUpdateParams, true);

    //debugger
    console.log(`emailNotificationUpdateResp: ${JSON.stringify(emailNotificationUpdateResp)}`);

    if (!emailNotificationUpdateResp.status) throw emailNotificationUpdateResp?.error || "Email Notification update failed";

    return success({ status: true, message: "Email Notification data Updated Successfull" });
  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`);
    return failure({ status: false, error: error?.message || error });
  };
};

export async function main(event) {
  let response;
  try {
    console.log(`Event: ${JSON.stringify(event)}`);
    const action =
      event && event.pathParameters && event.pathParameters.action
        ? event.pathParameters.action
        : 0;
    let data;
    switch (event.httpMethod) {
      case "GET":
        if (action === "list") {
          response = await listBuilders();
        } else if (action === "listb") {
          // This is for getting the list of builders JSON
          // from other lambdas. Paginated.
          response = await listBuildersPaginated();
        } else if (action === "get") {
          response = await getBuilder(event);
        } else if (action === "reset_lead_id") {
          response = await resetLeadId(event);
        } else {
          response = failure();
        }
        break;
      case "POST":
        data = JSON.parse(event.body);
        if (!data) {
          response = failure();
        } else if (action === "create") {
          response = await createBuilder(data);
        } else if (action === "update") {
          response = await updateBuilderDetails(data);
        } else if (action === "verify_domain") {
          response = await retryDomainVerification(data);
        } else if (action === "updateAppStream") {
          response = await updateAppStream(data);
        } else if (action === "verify") {
          response = await sendVerificationEmailforBuilder(data);
        } else if (action === "getExtUser") {
          response = await getExternalUser(data, true);
        } else if (action === "updateEmailChannel") {
          response = await updateBuilderEmailChannel(data);
        } else if (action === "exportBuilderData") {
          response = await exportBuilderData(data);
        } else if (action === "initimport") {
          response = await initBuilderDataImport(data);
        } else if (action === "initstagedate") {
          response = await initStageDateStepFunction(data);
        } else if (action === "initMetroUpdateSfn") {
          response = await initMetroUpdateSfn(data);
        } else if (action === "initactup") {
          response = await initEmailActivityUpdate(data);
        } else if (action === "initepup") {
          response = await initEndpointUpdate(data);
        } else if (action === "actupstatus") {
          response = await getEmailActivityStatusContent(data);
        } else if (action === "getsqsmsg") {
          response = await receiveElasticDLQMessages(data);
        } else if (action === "getb") {
          response = await getBuilderDB(data);
        } else if (action === "getestatus") {
          response = await getExportStatus(data);
        } else if (action === "getistatus") {
          response = await getImportStatus(data);
        } else if (action === "setworkflow") {
          response = await setupServerWorkflow();
        } else if (action === "setfiletransfer") {
          response = await verifyAndCreateFTPServerUser(data);
        } else if (action === "deactftuser") {
          response = await deleteSecret(data);
        } else if (action === "actftuser") {
          response = await restoreSecret(data, true);
        } else if (action === "getbuilderdetail") {
          response = await getBuilderDetailDB(data);
        } else if (action === "getmsgparams") {
          response = await getMessagingParamsInit(data);
        } else if (action === "delete") {
          response = await deleteBuilder(data)
        } else if (action === "create-ext-builders") {
          response = await createExtBuilderUsersResp(data)
        } else if (action === "create-initEndpointUpdateSfn-builders") {
          response = await initEndpointUpdateSfn(data)
        } else if (action === "removeEntity") {
          response = await removeEntitiesBatch(data)
        } else if (action === "emailNotification") {
          response = await emailNotification(data)
        } else {
          response = failure();
        }
        break;
      default:
        response = failure();
    }
  } catch (err) {
    console.log(err);
    return failure({ status: false, error: err });
  }

  return response;
}
