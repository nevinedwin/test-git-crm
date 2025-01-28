import "../../NPMLayer/nodejs.zip";
import { invokeLambda } from "../../FunctionStack/libs/lambda";
import { sendMessage } from "../../FunctionStack/libs/sqs";
import { failure, success } from "../../FunctionStack/libs/response-lib";

const { AdminApiFunctionArn, UsersQueueUrl, UsersApiFunctionArn } = process.env;

const listUsers = async (hbid) => {
  let usersList = [];
  try {
    const listUsersParams = {
      httpMethod: "POST",
      pathParameters: {
        action: "list",
      },
      body: JSON.stringify({
        type: "agent",
        hbid,
      }),
    };
    console.log(`listUsersParams: ${JSON.stringify(listUsersParams)}`);
    const usersListResp = await invokeLambda(
      AdminApiFunctionArn,
      listUsersParams,
      false
    );
    console.log(`usersListResp: ${JSON.stringify(usersListResp)}`);
    let { Payload: usersListBody } = usersListResp;
    usersListBody = JSON.parse(usersListBody);
    usersListBody = JSON.parse(usersListBody.body);
    if (usersListBody && usersListBody.length) {
      usersList = usersListBody;
    }
    console.log(`usersList: ${JSON.stringify(usersList)}`);
  } catch (error) {
    console.log(error);
    return [];
  }
  return usersList;
};

const listSAdmins = async () => {
  let sAdminList = [];
  try {
    const listSAdminParams = {
      httpMethod: "POST",
      pathParameters: {
        type: "sadmin",
        action: "list",
      },
      body: JSON.stringify({
        type: "sadmin",
      }),
    };
    console.log(`listSAdminParams: ${JSON.stringify(listSAdminParams)}`);
    const sAdminListResp = await invokeLambda(
      UsersApiFunctionArn,
      listSAdminParams,
      false
    );
    console.log(`sAdminListResp: ${JSON.stringify(sAdminListResp)}`);
    let { Payload: sAdminListBody } = sAdminListResp;
    sAdminListBody = JSON.parse(sAdminListBody);
    sAdminListBody = JSON.parse(sAdminListBody.body);
    if (sAdminListBody && sAdminListBody.length) {
      sAdminList = sAdminListBody;
    }
    console.log(`usersList: ${JSON.stringify(sAdminList)}`);
  } catch (error) {
    console.log(error);
    return [];
  }
  return sAdminList;
};

export async function main(event) {
  try {
    console.log("event in getUsers", JSON.stringify(event));
    let usersList = [];
    if (event.type === "user") {
      const users = await listUsers(event.hb_id);
      console.log(`usersList: ${JSON.stringify(usersList)}`);
      usersList = users.reduce((prev, current, currentindex) => {
        prev[currentindex] = {
          id: current.id,
          entity: `connectionId#${current.hb_id}#${current.utype}`,
          data: `connectionId`,
          connectionIds: "[]",
          version: 1,
        };
        return prev;
      }, []);
    } else {
      const sAdmins = await listSAdmins();
      console.log(`sAdmins: ${JSON.stringify(sAdmins)}`);
      usersList = sAdmins.reduce((prev, current, currentindex) => {
        prev[currentindex] = {
          id: current.id,
          entity: "connectionId#super_admin",
          data: "connectionId",
          connectionIds: "[]",
          version: 1,
        };
        return prev;
      }, []);
    }

    const totalCount = usersList.length;
    const batchNum = 25;
    const pages = Math.ceil(totalCount / batchNum);

    const paginate = (array, pageSize, pageNumber) =>
      array.slice(pageNumber * pageSize, pageNumber * pageSize + pageSize);

    for (let i = 0; i < pages; i += 1) {
      const batchedUsers = paginate(usersList, batchNum, i);
      const sqsPayload = {
        data: batchedUsers,
        log: `Batch ${i + 1} out of total ${pages} batches for ${
          event.type === "user"
            ? `users under builder with id ${event.hb_id}`
            : "super admin users"
        }`,
      };
      console.log(`sqsPayload: ${JSON.stringify(sqsPayload)}`);
      const sendMessageResp = await sendMessage(UsersQueueUrl, sqsPayload);
      console.log(`sendMessageResp: ${JSON.stringify(sendMessageResp)}`);
    }

    return success({
      type: "success",
      message: "Users has been added to SQS queue",
    });
  } catch (error) {
    console.log("error in getUsers", JSON.stringify(error));
    return failure({
      type: "error",
      message: error.message,
    });
  }
}
