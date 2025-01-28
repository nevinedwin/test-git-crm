import AWS from "aws-sdk";

const lookup = (secretDict, key, inputProtocol) => {
  console.log(`inputProtocol + key: ${inputProtocol + key}`);
  console.log(`secretDict: ${JSON.stringify(secretDict)}`);
  if (inputProtocol + key in secretDict) {
    console.log("Found protocol-specified {}".format(key));
    return secretDict[inputProtocol + key];
  }
  console.log(`secretDict[key]: ${secretDict[key]}`);
  return secretDict[key] || null;
};

const checkIpAddress = (secretDict, inputSourceIp, inputProtocol) => {
  const acceptedIpNetwork = lookup(
    secretDict,
    "AcceptedIpNetwork",
    inputProtocol
  );
  if (!acceptedIpNetwork) {
    // No IP provided so skip checks
    console.log("No IP range provided - Skip IP check");
    return true;
  }
  /* const net = ip_network(acceptedIpNetwork);
  if (ip_address(inputSourceIp) in net) {
    console.log("Source IP address match");
    return true;
  } else {
    console.log("Source IP address not in range");
    return false;
  } */
  return true;
};

const authenticateUser = (
  authType,
  secretDict,
  inputPassword,
  inputProtocol
) => {
  console.log(`authType: ${authType}`);
  console.log(`secretDict: ${JSON.stringify(secretDict)}`);
  console.log(`inputPassword: ${inputPassword}`);
  console.log(`inputProtocol: ${inputProtocol}`);
  // Function returns True if: authType is password and passwords match or authType is SSH. Otherwise returns False
  if (authType === "SSH") {
    // Place for additional checks in future
    console.log("Skip password check as SSH login request");
    return true;
  }
  // authType could only be SSH or PASSWORD

  // Retrieve the password from the secret if exists
  const password = lookup(secretDict, "Password", inputProtocol);
  console.log(`password in authenticateUser: ${password}`);
  if (!password) {
    console.log(
      "Unable to authenticate user - No field match in Secret for password"
    );
    return false;
  }
  console.log(`inputPassword === password: ${inputPassword === password}`);
  console.log(`inputPassword.length: ${inputPassword.length}`);
  console.log(`password.length: ${password.length}`);
  if (inputPassword === password) return true;

  console.log(
    "Unable to authenticate user - Incoming password does not match stored"
  );
  return false;
};

// Build out our response data for an authenticated response
const buildResponse = (secretDict, authType, inputProtocol) => {
  console.log(`secretDict: ${JSON.stringify(secretDict)}`);
  console.log(`authType: ${authType}`);
  console.log(`inputProtocol: ${inputProtocol}`);
  const responseData = {};
  // Check for each key value pair. These are required so set to empty string if missing
  const role = lookup(secretDict, "Role", inputProtocol);
  console.log(`role: ${role}`);
  if (role) responseData.Role = role;
  else {
    console.log("No field match for role - Set empty string in response");
    responseData.Role = "";
  }

  // These are optional so ignore if not present
  const policy = lookup(secretDict, "Policy", inputProtocol);
  if (policy) responseData.Policy = policy;

  // External Auth providers support chroot and virtual folder assignments so we'll check for that
  const homeDirectoryDetails = lookup(
    secretDict,
    "HomeDirectoryDetails",
    inputProtocol
  );
  if (homeDirectoryDetails) {
    console.log(
      `HomeDirectoryDetails found - Applying setting for virtual folders - Note: Cannot be used in conjunction with key: HomeDirectory`
    );
    responseData.HomeDirectoryDetails = homeDirectoryDetails;
    // If we have a virtual folder setup then we also need to set HomeDirectoryType to "Logical"
    console.log("Setting HomeDirectoryType to LOGICAL");
    responseData.HomeDirectoryType = "LOGICAL";
  }

  // Note that HomeDirectory and HomeDirectoryDetails / Logical mode
  // can't be used together but we're not checking for this
  const homeDirectory = lookup(secretDict, "HomeDirectory", inputProtocol);
  if (homeDirectory) {
    console.log(
      "HomeDirectory found - Note: Cannot be used in conjunction with key: HomeDirectoryDetails"
    );
    responseData.HomeDirectory = homeDirectory;
  }

  if (authType === "SSH") {
    const publicKey = lookup(secretDict, "PublicKey", inputProtocol);
    if (publicKey) responseData.PublicKeys = [publicKey];
    else {
      // SSH Auth Flow - We don't have keys so we can't help
      console.log("Unable to authenticate user - No public keys found");
      return {};
    }
  }
  console.log(`responseData: ${JSON.stringify(responseData)}`);
  return responseData;
};

const getSecret = async (id) => {
  const { SecretsManagerRegion: region } = process.env;
  console.log(`Secrets Manager Region: ${region}`);
  console.log(`Secret Name: ${id}`);

  // Create a Secrets Manager client
  const secretsmanager = new AWS.SecretsManager();
  try {
    const params = {
      SecretId: id,
    };
    const resp = await secretsmanager.getSecretValue(params).promise();
    console.log(`resp: ${JSON.stringify(resp)}`);
    // Decrypts secret using the associated KMS CMK.
    // Depending on whether the secret is a string or binary, one of these fields will be populated.
    if (resp?.SecretString) {
      console.log("Found Secret String");
      return resp.SecretString;
    }
    console.log("Found Binary Secret");
    const base64DecodedBuffer = Buffer.from(resp.SecretBinary, "base64");
    const base64DecodedString = base64DecodedBuffer.toString("ascii");
    console.log(`base64DecodedString: ${base64DecodedString}`);
    return base64DecodedString;
  } catch (error) {
    console.log("Error in getSecret");
    console.log(error);
    return null;
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
  console.log(`event: ${JSON.stringify(event)}`);
  let authenticationType = "";
  // Get the required parameters
  const requiredParamsList = ["serverId", "username", "protocol", "sourceIp"];
  for (const parameter of requiredParamsList) {
    if (!event[parameter]) {
      console.log(`Incoming ${parameter} missing - Unexpected`);
      return {};
    }
  }
  const {
    serverId: inputServerId,
    username: inputUsername,
    protocol: inputProtocol,
    sourceIp: inputSourceIp,
    password: inputPassword = "",
  } = event;

  console.log(
    `ServerId: ${inputServerId}, Username: ${inputUsername}, Protocol: ${inputProtocol}, SourceIp: ${inputSourceIp}`
  );

  // Check for password and set authentication type appropriately. No password means SSH auth
  console.log("Start User Authentication Flow");
  if (inputPassword !== "") {
    console.log("Using PASSWORD authentication");
    authenticationType = "PASSWORD";
  } else {
    if (inputProtocol === "FTP" || inputProtocol === "FTPS") {
      console.log("Empty password not allowed for FTP/S");
      return {};
    }
    console.log("Using SSH authentication");
    authenticationType = "SSH";
  }

  // Retrieve our user details from the secret. For all key-value pairs stored in SecretManager,
  // checking the protocol-specified secret first, then use generic ones.
  // e.g. If SFTPPassword and Password both exists, will be using SFTPPassword for authentication
  const secret = await getSecret(`${inputServerId}/${inputUsername}`);

  if (secret !== null) {
    const secretDict = JSON.parse(secret);
    // Run our password checks
    const userAuthenticated = authenticateUser(
      authenticationType,
      secretDict,
      inputPassword,
      inputProtocol
    );
    // Run sourceIp checks
    const iPMatch = checkIpAddress(secretDict, inputSourceIp, inputProtocol);

    if (userAuthenticated && iPMatch) {
      console.log(
        `User authenticated, calling buildResponse with: ${authenticationType}`
      );
      return buildResponse(secretDict, authenticationType, inputProtocol);
    }
    console.log("User failed authentication return empty response");
    return {};
  }
  // Otherwise something went wrong. Most likely the object name is not there
  console.log("Secrets Manager exception thrown - Returning empty response");
  // Return an empty data response meaning the user was not authenticated
  return {};
}
