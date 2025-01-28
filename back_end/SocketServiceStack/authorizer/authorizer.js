const { CognitoJwtVerifier } = require("aws-jwt-verify");

const USER_POOL_ID = process.env.USER_POOL_ID;
const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID;

const jwtVerifier = CognitoJwtVerifier.create({
  userPoolId: USER_POOL_ID,
  tokenUse: "access",
  clientId: USER_POOL_CLIENT_ID
});

let payload;

const generatePolicy = function (principalId, effect, resource, context) {
  const authResponse = {
    principalId: principalId,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: resource,
        },
      ],
    },
    context: context,
  };
  console.log(`authResponse: ${JSON.stringify(authResponse)}`);
  return authResponse;
};

export async function main(event) {
  console.log(`event: ${JSON.stringify(event)}`);
  const { token, hb_id, userType, type = "agent" } = event.queryStringParameters;

  if (!token || !hb_id || !userType) {
    throw new Error("Unauthorized");
  }

  try {
    console.log('Before verifier');
    payload = await jwtVerifier.verify(token);
    console.log('After verifier');
    const context = {
      sub: payload.sub,
      hb_id,
      userType,
      type,
    };

    return generatePolicy(payload.sub, "Allow", event.methodArn, context);
  } catch (e) {
    console.log('In authorizer error block', JSON.stringify(e));
    throw new Error("Unauthorized");
  }
}
