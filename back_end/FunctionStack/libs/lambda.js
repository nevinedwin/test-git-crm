import AWS from "aws-sdk";

const lambda = new AWS.Lambda();
export const invokeLambda = async (functionArn, payload, isAsync = false) => {
  let invokeResp = null;
  try {
    const lambdaInvokeParams = {
      FunctionName: functionArn,
      Payload: JSON.stringify(payload, null, 2),
    };
    if (isAsync) {
      lambdaInvokeParams.InvocationType = "Event";
    }
    console.log(`lambdaInvokeParams: ${JSON.stringify(lambdaInvokeParams)}`);
    invokeResp = await lambda.invoke(lambdaInvokeParams).promise();
    console.log(`invokeResp: ${JSON.stringify(invokeResp)}`);
  } catch (error) {
    console.log(`Exception occured in invokeLambda`);
    console.log(error);
  }
  return invokeResp;
};
export const initLambdaInvoke = async ({
  action = "",
  httpMethod = "",
  body = null,
  arn = "",
  type = "",
  getBody = false,
}) => {
  if (action && httpMethod && body && arn) {
    // Prepare the data for lambda event
    const eventObj = {
      httpMethod,
      pathParameters: {
        action,
      },
    };
    // Use body inside eventObj.pathParameters if httpMethod is GET. Otherwise as Body
    if (httpMethod === "GET")
      eventObj.pathParameters = { ...eventObj.pathParameters, ...body };
    else eventObj.body = JSON.stringify(body, null, 2);
    // Add type if supplied as a parameter
    if (type) eventObj.pathParameters.type = type;
    console.log(`arn: ${arn}`);
    console.log(`eventObj: ${JSON.stringify(eventObj)}`);
    const invokeEventResp = await invokeLambda(arn, eventObj, false);
    console.log(`invokeEventResp: ${JSON.stringify(invokeEventResp)}`);
    let { Payload: response } = invokeEventResp;
    response = JSON.parse(response);
    console.log(`Payload: ${JSON.stringify(response)}`);
    // Send the response body
    if (getBody) {
      let { body: respBody = null } = response;
      respBody = respBody && JSON.parse(respBody);
      console.log(`Payload body: ${JSON.stringify(respBody)}`);
      return respBody;
    }
    return response;
  }
  return { status: false, error: "Please provide valid parameters" };
};

export const ListLambdaEventSrcMappings = async (
  EventSourceArn,
  FunctionName
) => {
  try {
    const eventParams = {
      EventSourceArn,
      FunctionName,
    };
    if (!EventSourceArn || !FunctionName)
      return { status: false, error: "Please provide valid parameters" };
    const resp = await lambda.listEventSourceMappings(eventParams).promise();
    console.log("ListLambdaEventSrcMappings resp", resp);
    if (resp && resp.EventSourceMappings.length) {
      return { status: true, data: resp.EventSourceMappings[0] };
    }
    return { status: false, error: "Please provide valid parameters" };
  } catch (error) {
    return { status: false, error: error.message };
  }
};

export const updateLambdaEvtSrcMapping = async ({ uuid, isEnabled }) => {
  try {
    const updateParams = {
      UUID: uuid,
      Enabled: isEnabled,
    };
    const resp = await lambda.updateEventSourceMapping(updateParams).promise();
    console.log("UpdateLambdaEventSrcMappings resp", resp);
    return { status: true, data: resp };
  } catch (error) {
    return { status: false, error: error.message };
  }
};
