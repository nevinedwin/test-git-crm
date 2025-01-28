import AWS from "aws-sdk";

const kms = new AWS.KMS({ apiVersion: "2014-11-01" });
const { DYNAMODB_KMS_KEY_ID } = process.env;
const querystring = require("querystring");
// const crypto = require('crypto');
// const algorithm = 'aes-256-ctr';
// const ENCRYPTION_KEY = Buffer.from('87B6S78bgh85676bybughyugyu78T687TGBHGU787gu=', 'base64');
// const IV_LENGTH = 16;

const cognitoISP = new AWS.CognitoIdentityServiceProvider();

const { IsEnableCustomDomain, DomainName } = process.env;

const decryptData = async (text) => {
  console.log(`text before decode: ${text}`);
  text = text ? decodeURIComponent(text) : "";
  console.log(`decoded text: ${text}`);
  text = text ? Buffer.from(text, "base64") : "";
  // Decrypt
  const decParams = {
    CiphertextBlob: text /* required */,
    KeyId: DYNAMODB_KMS_KEY_ID,
  };
  console.log(`decParams: ${JSON.stringify(decParams)}`);
  try {
    const decryptStringResp = await kms.decrypt(decParams).promise();
    console.log(`decryptStringResp: ${JSON.stringify(decryptStringResp)}`);
    const data = decryptStringResp.Plaintext;
    console.log(`data: ${data}`);
    return { status: true, data };
  } catch (error) {
    return { status: false, error };
  }
  /* let textParts = text.split(':');
    let iv = Buffer.from(textParts.shift(), 'hex');
    let encryptedText = Buffer.from(textParts.join(':'), 'hex');
    let decipher = crypto.createDecipheriv(algorithm, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString(); */
};
export async function main(event, context, callback) {
  const url = `https://${DomainName}`;

  try {
    console.log(
      `IsEnableCustomDomain: ${JSON.stringify(IsEnableCustomDomain)}`
    );
    console.log(`event: ${JSON.stringify(event)}`);
    const { queryData } = event.queryStringParameters;
    console.log(`queryData: ${JSON.stringify(queryData)}`);
    const decryptedDataObj = await decryptData(queryData);
    console.log(`decryptedDataObj: ${JSON.stringify(decryptedDataObj)}`);
    const decryptedData = decryptedDataObj.status ? decryptedDataObj.data : "";
    console.log(`decryptedData: ${decryptedData}`);
    console.log(`typeof decryptedData: ${typeof decryptedData}`);
    const queryJson = querystring.parse(decryptedData.toString());
    console.log(`queryJson: ${JSON.stringify(queryJson)}`);
    const { clientId, email, username } = queryJson;
    const { code } = event.queryStringParameters;
    const params = {
      ClientId: clientId,
      ConfirmationCode: code,
      Username: username,
    };

    // let describeStacksResp = '';
    // if (StackName) {
    //     const describeStackParams = { StackName };
    //     console.log(`describeStackParams: ${JSON.stringify(describeStackParams)}`);
    //     describeStacksResp = await cloudformation.describeStacks(describeStackParams).promise();
    //     console.log(`describeStacksResp: ${JSON.stringify(describeStacksResp)}`);
    // }

    // let distributionDomainOutput = '';
    // let domainNameOutput = '';
    // if (describeStacksResp && describeStacksResp.Stacks && describeStacksResp.Stacks[0] && describeStacksResp.Stacks[0].Outputs) {
    //     distributionDomainOutput = describeStacksResp.Stacks[0].Outputs.filter(outputItem => outputItem.OutputKey === 'HyphenCRMDistributionDomain');
    //     domainNameOutput = describeStacksResp.Stacks[0].Outputs.filter(outputItem => outputItem.OutputKey === 'DomainName');
    //     console.log(`distributionDomainOutput: ${JSON.stringify(distributionDomainOutput)}`);
    //     console.log(`domainNameOutput: ${JSON.stringify(domainNameOutput)}`);
    // }

    // if (distributionDomainOutput && distributionDomainOutput[0] && distributionDomainOutput[0].OutputValue) {
    //     url = distributionDomainOutput[0].OutputValue;
    // }

    // if (IsEnableCustomDomain === "true" && domainNameOutput && domainNameOutput[0] && domainNameOutput[0].OutputValue && domainNameOutput[0].OutputValue.length) {
    //     url = domainNameOutput[0].OutputValue;
    // }

    // console.log(`url: ${JSON.stringify(url)}`);

    const confirmSignUpResp = await cognitoISP.confirmSignUp(params).promise();
    console.log(`confirmSignUpResp: ${JSON.stringify(confirmSignUpResp)}`);
    return callback(null, {
      statusCode: 302,
      headers: {
        Location: `${url}/login?verified=true&email=${email}`,
      },
    });
  } catch (e) {
    // woops, error, redirect but without verified=true
    return callback(null, {
      statusCode: 302,
      headers: {
        Location: `${url}/login?verified=false`,
      },
    });
  }
}
