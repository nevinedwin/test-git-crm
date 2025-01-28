/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import AWS from "aws-sdk";
import https from "https";
import crypto from "crypto";
import { failure, success } from "../libs/response-lib";

const kms = new AWS.KMS({ apiVersion: "2014-11-01" });
const cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider({
  apiVersion: "2016-04-18",
});

const {
  CLIENT_ID,
  RESPONSE_TYPE,
  SCOPE,
  AUTH_DOMAIN,
  CODE_CHALLENGE_METHOD,
  EXTERNAL_USER_POOL_ID,
} = process.env;
const REDIRECT_URI = encodeURIComponent(process.env.REDIRECT_URI);

const { DYNAMODB_KMS_KEY_ID } = process.env;

const getClientSecret = async () => {
  const params = {
    ClientId: CLIENT_ID /* required */,
    UserPoolId: EXTERNAL_USER_POOL_ID /* required */,
  };
  // cognitoidentityserviceprovider.describeUserPoolClient(
  console.log(`params: ${JSON.stringify(params)}`);
  try {
    const describeUserPoolClientResp = await cognitoidentityserviceprovider
      .describeUserPoolClient(params)
      .promise();
    console.log(
      `describeUserPoolClientResp: ${JSON.stringify(
        describeUserPoolClientResp
      )}`
    );
    const clientSecret =
      describeUserPoolClientResp.UserPoolClient &&
      describeUserPoolClientResp.UserPoolClient.ClientSecret
        ? describeUserPoolClientResp.UserPoolClient.ClientSecret
        : "";
    return clientSecret;
  } catch (e) {
    console.log(`e: ${JSON.stringify(e)}`);
    return null;
  }
};
const generateCodeVerifierHash = (codeVerifier) =>
  crypto.createHmac("SHA256", codeVerifier).digest("base64");

const generateCodeVerifier = () => {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._`-";

  for (let i = 0; i < 64; i += 1)
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  const base64URL = Buffer.from(text).toString("base64");
  return base64URL;
};
const httpsRequest = (url, options, isAccessTokenReq = false) =>
  new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      // console.log('statusCode:', res.statusCode);
      // console.log('headers:', res.headers);
      const chunks = [];

      res.on("data", (chunk) => {
        chunks.push(chunk);
      });

      res.on("end", () => {
        if (isAccessTokenReq) {
          const body = Buffer.concat(chunks);
          console.log(body.toString());
          resolve(body);
        } else {
          resolve(res);
        }
      });

      res.on("error", (e) => {
        console.error(e);
        reject(e);
      });
    });

    if (options.method === "POST") {
      req.write(options.body);
    }
    req.end();
  });
const generateToken = async (data) => {
  const USERNAME = data.username ? data.username : "";
  const PASSWORD_PARAM = data.key ? Buffer.from(data.key, "base64") : "";
  console.log(`PASSWORD_PARAM : ${PASSWORD_PARAM}`);
  let PASSWORD;
  // Decrypt password
  const decParams = {
    CiphertextBlob: PASSWORD_PARAM /* required */,
    KeyId: DYNAMODB_KMS_KEY_ID,
  };
  try {
    const decryptStringResp = await kms.decrypt(decParams).promise();
    console.log(`decryptStringResp: ${JSON.stringify(decryptStringResp)}`);
    PASSWORD = decryptStringResp.Plaintext;
    console.log(`PASSWORD: ${PASSWORD}`);
  } catch (e) {
    return failure({ status: false, error: e });
  }
  // Challenge
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeVerifierHash(codeVerifier);

  console.log(`codeVerifier: ${codeVerifier}`);

  // Get CSRF token from /oauth2/authorize endpoint
  const csrfRequestURL = `https://${AUTH_DOMAIN}/oauth2/authorize?response_type=${RESPONSE_TYPE}&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=${SCOPE}&code_challenge_method=${CODE_CHALLENGE_METHOD}&code_challenge=${codeChallenge}`;
  // Post CSRF Token and username/password to /login endpoint
  const codeRequestURL = `https://${AUTH_DOMAIN}/login?response_type=${RESPONSE_TYPE}&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}`;
  try {
    const csrfTokenResp = await httpsRequest(csrfRequestURL, {
      method: "GET",
    });
    // console.log(`csrfTokenResp: ${JSON.stringify(csrfTokenResp)}`);
    const XSRFTOKEN =
      csrfTokenResp &&
      csrfTokenResp.headers &&
      csrfTokenResp.headers["set-cookie"].filter(
        (header) => header.substring(0, 10) === "XSRF-TOKEN"
      )[0];
    const form = {
      _csrf: XSRFTOKEN ? `${XSRFTOKEN.split(";")[0].split("=")[1]}` : "",
      username: `${USERNAME}`,
      password: `${PASSWORD}`,
    };
    console.log(`form : ${JSON.stringify(form)}`);
    const formData = new URLSearchParams(form).toString();
    console.log(`formData : ${formData}`);
    const contentLength = formData.length;
    try {
      const authorizationCodeResp = await httpsRequest(codeRequestURL, {
        method: "POST",
        headers: {
          "Content-Length": contentLength,
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: `${XSRFTOKEN}`,
        },
        body: formData,
      });
      console.log("authorizationCodeResp.headers");
      console.log(authorizationCodeResp?.headers);
      console.log(
        `authorizationCodeResp.headers: ${JSON.stringify(
          authorizationCodeResp?.headers
        )}`
      );
      const authorizationCodeGrant =
        authorizationCodeResp.headers.location.split("=")[1];
      console.log(authorizationCodeGrant);

      /* const tokenForm = {
                'grant_type': 'authorization_code',
                'code': authorizationCodeGrant,
                'client_id': CLIENT_ID,
                'redirect_uri': REDIRECT_URI,
                'code_verifier': code_verifier,
                'scope': 'openid'
            };
            const tokenFormData = querystring.stringify(tokenForm); */
      const CLIENT_SECRET = await getClientSecret();
      console.log(`CLIENT_SECRET: ${CLIENT_SECRET}`);
      const tokenRequestURL = `https://${AUTH_DOMAIN}/oauth2/token?grant_type=authorization_code&code=${authorizationCodeGrant}&redirect_uri=http://localhost&client_id=${CLIENT_ID}&scope=openid`;
      console.log(`tokenRequestURL: ${tokenRequestURL}`);
      const authCode = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString(
        "base64"
      );
      console.log(`authCode: ${authCode}`);
      const accessTokenResp = await httpsRequest(
        tokenRequestURL,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${authCode}`,
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: `XSRF-TOKEN=${
              XSRFTOKEN ? `${XSRFTOKEN.split(";")[0].split("=")[1]}` : ""
            }`,
          },
          body: "",
          maxRedirects: 20,
        },
        true
      );
      console.log(`accessTokenResp: ${JSON.stringify(accessTokenResp)}`);
      return success({ code: JSON.parse(accessTokenResp.toString()) });
    } catch (e) {
      return failure({ error: e });
    }
  } catch (e) {
    return failure({ error: e });
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
export async function main(event) {
  let response;
  try {
    console.log(`event: ${JSON.stringify(event)}`);
    // const action = event && event.pathParameters && event.pathParameters.action ? event.pathParameters.action : 0;
    const isExternalTokenGet =
      event && event.path ? event.path.includes("get") : false;
    let data;
    switch (event.httpMethod) {
      case "POST":
        data = JSON.parse(event.body);
        if (!data) {
          response = failure();
        } else if (isExternalTokenGet) {
          response = await generateToken(data);
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
