import "../../NPMLayer/nodejs.zip";
import {
  invokeLambda,
  ListLambdaEventSrcMappings,
  updateLambdaEvtSrcMapping,
} from "../../FunctionStack/libs/lambda";
import { failure, success } from "../../FunctionStack/libs/response-lib";

const {
  BuildersApiFunctionArn,
  GetUsersLambdaArn,
  QueueHandlerFunction,
  UsersQueueArn,
} = process.env;

const listBuilders = async () => {
  let builderList = [];
  try {
    // Get the list of builders
    const listBuildersParams = {
      httpMethod: "GET",
      pathParameters: {
        action: "listb",
      },
    };
    console.log(`listBuildersParams: ${JSON.stringify(listBuildersParams)}`);

    // Invoke builder lambda
    const builderListResp = await invokeLambda(
      BuildersApiFunctionArn,
      listBuildersParams,
      false
    );
    console.log(`builderListResp: ${JSON.stringify(builderListResp)}`);
    let { Payload: builderListBody } = builderListResp;
    builderListBody = JSON.parse(builderListBody);
    builderList = builderListBody;
    console.log(`builderList: ${JSON.stringify(builderList)}`);
  } catch (error) {
    console.log(error);
    return [];
  }
  return builderList;
};

async function executeJob() {
  try {
    const buildersList = await listBuilders();
    console.log(`buildersList: ${JSON.stringify(buildersList)}`);
    for (const builder of buildersList) {
      const getUsersParams = {
        hb_id: builder.id,
        type: "user",
      };
      const invokeResp = await invokeLambda(
        GetUsersLambdaArn,
        getUsersParams,
        true
      );
      console.log(`invokeResp: ${JSON.stringify(invokeResp)}`);
    }
    const getUsersParams = {
      hb_id: "",
      type: "sadmin",
    };
    await invokeLambda(GetUsersLambdaArn, getUsersParams, true);
    return { status: true, msg: "Job has started" };
  } catch (error) {
    console.log(`error: ${JSON.stringify(error)}`);
    return { status: false, error: error.message };
  }
}

async function disableEvtSrcMapping() {
  try {
    const resp = await ListLambdaEventSrcMappings(
      UsersQueueArn,
      QueueHandlerFunction
    );
    console.log("ListLambdaEventSrcMappingsRes", resp);
    if (resp.status) {
      const srcMapping = resp.data;
      console.log("eventSrcMappingListResp", srcMapping);
      const updateResp = await updateLambdaEvtSrcMapping({
        uuid: srcMapping?.UUID,
        isEnabled: false,
      });
      console.log("eventSrcMappingUpdateResp", updateResp);
      if (!updateResp.status) {
        return { status: false, error: updateResp.error };
      }
      return {
        status: true,
        msg: "Event Source Mapping successfully disabled",
      };
    }
    return { status: false, error: resp.error };
  } catch (error) {
    return { status: false, error: error.message };
  }
}

export async function main(event) {
  try {
    let response;
    console.log("event in getbuilders", JSON.stringify(event));
    if (event?.forDisablingEventMapping) {
      response = await disableEvtSrcMapping();
    } else {
      response = await executeJob();
    }
    if (!response.status) {
      return failure({
        type: "error",
        message: response.error,
      });
    }
    return success({
      type: "success",
      message: response.msg,
    });
  } catch (error) {
    console.log(`error: ${JSON.stringify(error)}`);
    return failure({
      type: "error",
      message: error.message,
    });
  }
}
