/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import { v4 as uuidv4 } from "uuid";
import { publishEntityData } from "../../FunctionStack/libs/messaging";
import { invokeLambda } from "../../FunctionStack/libs/lambda";

let BUILDER_LAMBDA_ARN = "";

const getMessagingParams = async ({ noGetReadOnlyParams = true }) => {
  let msgParams = [];
  try {
    // Get the list of builders
    const getMsgParams = {
      httpMethod: "POST",
      pathParameters: {
        action: "getmsgparams",
      },
      body: JSON.stringify({
        noGetReadOnlyParams,
      }),
    };
    console.log(`getMsgParams: ${JSON.stringify(getMsgParams)}`);

    // Invoke builder lambda
    const msgParamsResp = await invokeLambda(
      BUILDER_LAMBDA_ARN,
      getMsgParams,
      false
    );
    console.log(`msgParamsResp: ${JSON.stringify(msgParamsResp)}`);
    let { Payload: msgParamsBody } = msgParamsResp;
    msgParamsBody = JSON.parse(msgParamsBody);
    msgParams = msgParamsBody?.status ? msgParamsBody?.data : {};
    console.log(`msgParams: ${JSON.stringify(msgParams)}`);
  } catch (error) {
    console.log(`Error occured in getMessagingParams`);
    console.log(error);
    return {};
  }
  return msgParams;
};
export async function main(event) {
  console.log(event);
  const { BuildersApiFunctionArn } = event;
  BUILDER_LAMBDA_ARN = BuildersApiFunctionArn;
  console.log(`BUILDER_LAMBDA_ARN: ${BUILDER_LAMBDA_ARN}`);
  const { status, customerMessagingParams } = event;
  if (status) {
    if (customerMessagingParams.length) {
      const messagingPublicConfig = await getMessagingParams(true);
      for (const customerMessagingParam of customerMessagingParams) {
        // Brix message
        const publishCustomerDataResponse = await publishEntityData({
          entityId: customerMessagingParam.id,
          isBrix: true,
          isCreate: false,
          messageId: uuidv4(),
          messagingParams: messagingPublicConfig,
        });
        console.log(
          "publishCustomerDataResponse: ",
          publishCustomerDataResponse
        );

        // Homefront message
        const publishEntityDataHfResp = await publishEntityData({
          entityId: customerMessagingParam.id,
          entityType: "customer",
          isBrix: false,
          isCreate: false,
          isHomefront: true,
          messageId: uuidv4(),
          messagingParams: messagingPublicConfig,
          HomebuilderID: customerMessagingParam?.hb_id,
        });
        console.log("publishEntityDataHfResp: ", publishEntityDataHfResp);
      }
    }
    return { status };
  }
  return { status };
}
