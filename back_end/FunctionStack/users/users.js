/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import {
  getUserCreateJSON,
  isCorrectFieldType,
  postResources,
  getResourceJSON,
  getResources,
  updateResources,
  deleteResources,
  deleteResourcesRaw,
  batchGetResources,
  initListAPI,
  getStackOutputs,
  doPaginatedQueryEllastic,
} from "../libs/db";
import { invokeLambda } from "../libs/lambda";
import { success, failure, badRequest } from "../libs/response-lib";
import { verifyEmailIdentity, checkIdentityExists } from "../campaign/campaign";
import { validateEmail } from "../validation/validation";
import { elasticExecuteQuery } from "../search/search";

const {
  USER_CLIENT_ID,
  UserPoolId,
  REGION,
  ACCOUNT_ID,
  USER_POOL_ID,
  entitiesTableName,
  entitiesTableByEntityAndId,
  entitiesTableByDataAndEntity,
  StackName,
} = process.env;

const ses = new AWS.SES();
const identitiyProvider = new AWS.CognitoIdentityServiceProvider({
  apiVersion: "2016-12-01",
});

const createConnectionIdRow = async (data) => {
  const params = {
    TableName: entitiesTableName,
    Item: {
      id: data.id,
      entity:
        data.entity === "super_admin"
          ? "connectionId#super_admin"
          : `connectionId#${data.hb_id}#${data.utype}`,
      data: `connectionId`,
      connectionIds: "[]",
      version: 1,
    },
  };
  return postResources(params);
};

async function createManageView(data) {
  try {
    const { hbId, userId } = data;
    const params = {
      TableName: entitiesTableName,
      Item: {
        id: userId,
        entity: `manageView#${userId}#${hbId}`
      }
    }
    const createResp = await postResources(params);
    console.log(`createManageview Resp : ${JSON.stringify(createResp)}`);
    return createResp;
  } catch (error) {
    console.log("createManageview error ", error);
    return { status: false, error }
  }
}

async function getManageView(data) {
  const { hbId, userId } = data;
  try {

    const params = {
      TableName: process.env.entitiesTableName,
      KeyConditionExpression: "#id = :id and #entity = :entity",
      ExpressionAttributeNames: {
        "#id": "id",
        "#entity": "entity"
      },
      ExpressionAttributeValues: {
        ":id": userId,
        ":entity": `manageView#${userId}#${hbId}`
      }
    }
    const manageViewResp = await getResourceJSON(params);
    console.log(`manageViewResp :: ${JSON.stringify(manageViewResp)}`);
    if (!manageViewResp.length) {
      const createManageViewResp = await createManageView(data);
      console.log(`createManageViewResp :: ${JSON.stringify(createManageViewResp)}`);
      return { status: true, customer: [], realtor: [] }
    }
    return { status: true, customer: manageViewResp[0].comm ?? [], realtor: manageViewResp[0].newinte ?? [] }
  } catch (error) {
    console.log("getManageView error :: ", error);
    return { status: false, error }
  }
}

export const createUser = async (data, type) => {
  console.log(`data: ${JSON.stringify(data)}`);
  console.log(`type: ${type}`);
  const isSuperAdmin = type === "sadmin";
  console.log(`isSuperAdmin: ${isSuperAdmin}`);
  const userJSON = getUserCreateJSON(data, !isSuperAdmin, isSuperAdmin);
  console.log(userJSON);
  if (!isCorrectFieldType(userJSON)) {
    return failure({ status: false, error: "Field Type Error" });
  }

  // Proceed with create operation
  const params = {
    TableName: entitiesTableName,
    Item: {
      type: userJSON.type,
      hb_id: userJSON.hb_id,
      fname: userJSON.fname,
      lname: userJSON.lname,
      email: userJSON.email,
      utype: userJSON.utype,
      mdt: userJSON.mod_dt,
      cdt: userJSON.cdt,
      data: isSuperAdmin ? "super_admin" : `${userJSON.type}#${userJSON.hb_id}`,
      entity: isSuperAdmin
        ? "super_admin"
        : `${userJSON.type}#${userJSON.hb_id}#${userJSON.utype}`,
      comm: userJSON.utype === "agent" ? userJSON.comm : [],
      allowCampaign:
        userJSON.utype === "agent" ? data?.allowCampaign : undefined,
      ...(userJSON.utype !== "agent" && { rinfl: userJSON?.rinfl || false })
    },
  };
  // Setting non-mandatory fields based on it's availability
  if (userJSON.img && !isSuperAdmin) {
    params.Item.img = userJSON.img;
  }
  if (userJSON.phone || !isSuperAdmin) {
    params.Item.phone = userJSON.phone;
  }
  if (userJSON.sign || !isSuperAdmin) {
    params.Item.sign = userJSON.sign;
  }
  params.Item.stat = "active";

  // If this is a super admin create, add the privs array which includes all the hb_id that the user has privilege in
  if (isSuperAdmin) {
    params.Item.privs = data.privs;
    params.Item.root = data.root;
  }
  // In the case of agents and super_admins, the id will be the cognito sub id present in data.user_id
  if (type === "agent" || isSuperAdmin) {
    const userId = data.user_id ? data.user_id : "";
    params.Item.id = userId;
  } else {
    const crby = data.crby ? data.crby : "";
    params.Item.crby = crby;
    params.Item.id = uuidv4();
  }
  const createUserResp = await postResources(params);
  const verifyemailIdentityResp = await verifyEmailIdentity(params.Item, true);
  console.log(`createUserResp: ${JSON.stringify(createUserResp)}`);
  console.log(
    `verifyemailIdentityResp: ${JSON.stringify(verifyemailIdentityResp)}`
  );
  const connectionIdRowResp = await createConnectionIdRow(params.Item);
  console.log(`connectionIdRowResp: ${JSON.stringify(connectionIdRowResp)}`);

  const manageViewResp = await createManageView({ hbId: userJSON.hb_id, userId: params.Item.id })
  console.log("manageViewResp :: ", manageViewResp);
  return createUserResp;
};

export const deleteUserFromDB = async (data) => {
  const id = data.id ? data.id : 0;
  const hbid = data.hb_id ? data.hb_id : "";
  const utype = data.utype ? data.utype : "";
  const params = {
    TableName: entitiesTableName,
    Key: {
      id,
      entity: `agent#${hbid}#${utype}`,
    },
  };
  console.log(params);
  return deleteResources(params);
};
export const updateUserRow = async (data) => {
  const oldUType = data.outype ? data.outype : "";
  if (oldUType) {
    // User Type Changed
    // Delete the old User
    console.log("Old User Type");
    const deleteUserResp = await deleteUserFromDB({
      id: data.id,
      hb_id: data.hb_id,
      utype: oldUType,
    });
    console.log("deleteUserResp: ", JSON.stringify(deleteUserResp));
  }
  const params = {
    TableName: entitiesTableName,
    Item: {
      type: "agent",
      utype: data.utype,
      hb_id: data.hb_id,
      fname: data.fname,
      lname: data.lname,
      email: data.email,
      phone: data.phone,
      mdt: Date.now(),
      cdt: data.cdt,
      id: data.id,
      data: `${data.type}#${data.hb_id}`,
      entity: `${data.type}#${data.hb_id}#${data.utype}`,
      comm: data.comm && data.utype === 'agent' ? data.comm : [],
      sign: data.sign ? data.sign : "",
      rpp: data.rpp ? data.rpp : "",
      allowCampaign:
        data.utype === "agent" ? data?.allowCampaign : undefined,
      rinfl: data.rinfl
    },
  };
  return postResources(params);
};
const getSESVerificationList = async (usersList) => {
  // Get the email list
  const emailList = usersList.reduce((list, user) => {
    list.push(user.email);
    return list;
  }, []);

  let finalIdentityData = {};
  const chunkSize = 50;
  const emailChunks = [];

  for (let i = 0; i < emailList.length; i += chunkSize) {
    emailChunks.push([...emailList.slice(i, i + chunkSize)])
  }

  console.log(`emailChunks :`, emailChunks);

  for (const echunk of emailChunks) {

    // Check the ses identity verification details
    const identityExists = await checkIdentityExists(echunk, true);
    console.log(`identityExists: ${JSON.stringify(identityExists)}`);

    const identityData =
      identityExists && identityExists.VerificationAttributes
        ? identityExists.VerificationAttributes
        : {};

    finalIdentityData = { ...finalIdentityData, ...identityData };
  }

  return finalIdentityData;
};
const getCognitoUserList = async () => {
  const list = {
    Users: [],
  };
  try {
    let params;
    let hasNext = true;
    let PaginationToken;
    while (hasNext) {
      params = PaginationToken
        ? { UserPoolId: USER_POOL_ID, PaginationToken }
        : { UserPoolId: USER_POOL_ID };
      const listUserPoolsResponse = await identitiyProvider
        .listUsers(params)
        .promise();
      console.log(
        `listUserPoolsResponse: ${JSON.stringify(listUserPoolsResponse)}`
      );
      if (listUserPoolsResponse.Users && listUserPoolsResponse.Users.length)
        list.Users.push(...listUserPoolsResponse.Users);
      PaginationToken = listUserPoolsResponse?.PaginationToken || null;
      hasNext = !!PaginationToken;
    }
    console.log("List: ", JSON.stringify(list));
  } catch (error) {
    console.log(`getUserPoolList error : ${JSON.stringify(error.stack)}`);
    return list;
  }
  return list;
};
export const listAllUsers = async (data) => {
  const {
    event,
    type,
    isJSONOnly = false,
    isUsersOnly = false,
    isSpecific = false,
    isSuperAdmin = false,
  } = data;
  console.log(`In listAllUsers event: ${JSON.stringify(event)}`);
  console.log(`type: ${type}`);
  console.log(`isJSONOnly: ${isJSONOnly}`);
  console.log(`isUsersOnly: ${isUsersOnly}`);
  const hbidParam =
    event && event.pathParameters && event.pathParameters.hbid
      ? event.pathParameters.hbid
      : 0;
  let params;
  if (isSpecific) {
    // List a specific type of users
    params = {
      TableName: entitiesTableName,
      IndexName: entitiesTableByEntityAndId,
      KeyConditionExpression: "#entity = :entity",
      ExpressionAttributeNames: {
        "#entity": "entity",
      },
      ExpressionAttributeValues: {
        ":entity": `${isSuperAdmin ? `super_admin` : `agent#${hbidParam}#${type}`
          }`,
      },
    };
  } else {
    // List all users
    params = {
      TableName: entitiesTableName,
      IndexName: entitiesTableByDataAndEntity,
      KeyConditionExpression: "#data = :data",
      ExpressionAttributeNames: {
        "#data": "data",
      },
      ExpressionAttributeValues: {
        ":data": `agent#${hbidParam}`,
      },
    };

  }
  console.log(params);
  let usersList = await getResourceJSON(params);
  console.log(`usersList: ${JSON.stringify(usersList)}`);

  usersList = usersList.filter(user => user.email);

  if (isUsersOnly) {
    // This sends only the user info
    return success(usersList);
  }
  if (isJSONOnly) {
    // This is to use this function to get all the users
    return usersList;
  }

  // Get the user pool list
  // const listUserPoolsResponse = await identitiyProvider
  //   .listUsers({ UserPoolId: USER_POOL_ID })
  //   .promise();
  // console.log(
  //   `listUserPoolsResponse: ${JSON.stringify(listUserPoolsResponse)}`
  // );

  const listUserPoolsResponse = await getCognitoUserList();

  // Filter out users based on hb_id
  const filteredData = listUserPoolsResponse.Users.filter(
    (item) =>
      item.Attributes.find((o) => o.Name === "custom:hb_id").Value === hbidParam
  );
  console.log(`filteredData: ${JSON.stringify(filteredData)}`);

  // Prepare email and verified status object for adding it to the user list
  const emailCognitoStatus = filteredData.reduce((obj, user) => {
    // Prepare email and verified status object from attributes array
    const userAttr = user.Attributes.reduce((attrObj, attribute) => {
      if (attribute.Name === "email" || attribute.Name === "email_verified") {
        attrObj[attribute.Name] = attribute.Value;
      }
      return attrObj;
    }, {});
    // Adding Enabled, UserStatus & email_verified to the obj
    obj[userAttr.email.toLowerCase()] = {
      email_verified: userAttr.email_verified,
      Enabled: user.Enabled,
      UserStatus: user.UserStatus,
    };
    return obj;
  }, {});
  console.log(`emailCognitoStatus: ${JSON.stringify(emailCognitoStatus)}`);

  // Check SES Verification Status
  const identityData = await getSESVerificationList(usersList);
  console.log(`identityData: ${JSON.stringify(identityData)}`);

  // Add an entry to each user object
  const userListWithSESVerification = usersList.map((user) => {
    console.log(`user: ${JSON.stringify(user)}`);
    console.log(`user.email: ${user.email}`);
    if (!identityData[user.email]) {
      // User does not exist in SES
      user.ses = "";
    } else {
      // If user exists in SES, it will have failed, success or pending status
      user.ses =
        identityData[user.email].VerificationStatus &&
          identityData[user.email].VerificationStatus
          ? identityData[user.email].VerificationStatus
          : "";
    }
    // Add Cognito Verification Status
    if (!emailCognitoStatus[user.email]) {
      user.cognito = "";
    } else {
      user.cognito = emailCognitoStatus[user.email];
    }
    return user;
  });
  console.log(
    `userListWithSESVerification: ${JSON.stringify(
      userListWithSESVerification
    )}`
  );
  console.log(`usersList: ${JSON.stringify(usersList)}`);
  return success(userListWithSESVerification);
};

const getAllCognitoUsers = async () => {
  let paginationToken;
  // Get the user pool list
  let listUserPoolsResponse = [];
  do {
    const cognitoResp = await identitiyProvider
      .listUsers({ UserPoolId: USER_POOL_ID, PaginationToken: paginationToken })
      .promise();
    console.log(
      `cognitoResp: ${JSON.stringify(cognitoResp)}`
    );
    listUserPoolsResponse = [...listUserPoolsResponse, ...cognitoResp.Users];
    paginationToken = cognitoResp.PaginationToken || undefined;
  } while (paginationToken);
  return listUserPoolsResponse;
}
export const listAllUsersElastic = async (data) => {
  const { isUsersOnly = false, hb_id: hbId = "", searchKey = "" } = data;
  let usersListResp;
  try {
    // Get the paginated user list
    usersListResp = await initListAPI({
      ...data,
      entity: "agent",
      isDataCall: true,
      isJSONOnly: true,
      searchKey,
      ...(searchKey && {filterKey: "Name"})
    });
    console.log(`usersListResp: ${JSON.stringify(usersListResp)}`);
    let usersList = usersListResp?.result || [];
    usersList = usersList.filter(user => user.email);
    console.log(`usersList: ${JSON.stringify(usersList)}`);
    if (isUsersOnly) {
      // This sends only the user info
      return success(usersList);
    }

    // Get the user pool list
    const listUserPoolsResponse = await getAllCognitoUsers();

    console.log(
      `listUserPoolsResponse: ${JSON.stringify(listUserPoolsResponse)}`
    );
    // Filter out users based on hb_id
    const filteredData = listUserPoolsResponse.filter(
      (item) =>
        item.Attributes.find((o) => o.Name === "custom:hb_id").Value === hbId
    );
    console.log(`filteredData: ${JSON.stringify(filteredData)}`);

    // Prepare email and verified status object for adding it to the user list
    const emailCognitoStatus = filteredData.reduce((obj, user) => {
      // Prepare email and verified status object from attributes array
      const userAttr = user.Attributes.reduce((attrObj, attribute) => {
        if (attribute.Name === "email" || attribute.Name === "email_verified") {
          attrObj[attribute.Name] = attribute.Value;
        }
        return attrObj;
      }, {});
      // Adding Enabled, UserStatus & email_verified to the obj
      obj[userAttr.email.toLowerCase()] = {
        email_verified: userAttr.email_verified,
        Enabled: user.Enabled,
        UserStatus: user.UserStatus,
      };
      return obj;
    }, {});
    console.log(`emailCognitoStatus: ${JSON.stringify(emailCognitoStatus)}`);

    // Check SES Verification Status
    const identityData = await getSESVerificationList(usersList);
    console.log(`identityData: ${JSON.stringify(identityData)}`);

    // Add an entry to each user object
    const userListWithSESVerification = usersList.map((user) => {
      console.log(`user: ${JSON.stringify(user)}`);
      console.log(`user.email: ${user.email}`);
      if (!identityData[user.email]) {
        // User does not exist in SES
        user.ses = "";
      } else {
        // If user exists in SES, it will have failed, success or pending status
        user.ses =
          identityData[user.email].VerificationStatus &&
            identityData[user.email].VerificationStatus
            ? identityData[user.email].VerificationStatus
            : "";
      }
      // Add Cognito Verification Status
      if (!emailCognitoStatus[user.email]) {
        user.cognito = "";
      } else {
        user.cognito = emailCognitoStatus[user.email];
      }
      return user;
    });
    console.log(
      `userListWithSESVerification: ${JSON.stringify(
        userListWithSESVerification
      )}`
    );
    // Set the merged data in the result key in usersListResp
    if (usersListResp?.result)
      usersListResp.result = userListWithSESVerification;
    console.log(`usersList: ${JSON.stringify(usersList)}`);
  } catch (error) {
    console.log(`Exception in listAllUsersElastic`);
    console.log(error);
    return failure({ status: false, error: "Users list failed." });
  }
  return success(usersListResp);
};
export const listCommunityAgents = async (data) => {
  const { comm, sort = [], hbId, idList, showAll = false } = data;
  try {
    const custQuery = {
      bool: {
        should: [
          {
            bool: {
              must: [
                {
                  term: {
                    "hb_id.keyword": hbId
                  }
                },
                {
                  terms: {
                    "utype.keyword": ["admin", "online_agent"]       // filter for admins/online_agent 
                  }
                }
              ]
            }
          }
        ]
      }
    }
    if (showAll) {
      custQuery.bool.should[0].bool.must.push({
        term: {
          "rinfl": true    // key to determine whether the admin/online_agent should be shown
        }
      });
    }
    // filter for fetching agents
    let agentFilter = [
      {
        term: {
          "utype.keyword": "agent"
        }
      },
      {
        term: {
          "hb_id.keyword": hbId
        }
      }
    ];

    let projectFields = ["id", "fname", "lname", "email", "utype"];

    if (comm) {
      const commQueries = [
        {
          exists: {
            field: "comm"
          }
        },
        {
          terms: {
            "comm.keyword": [...comm]
          }
        }
      ];

      agentFilter = [...agentFilter, ...commQueries];
      projectFields = [...projectFields, "stat", "comm"];
    }

    if (idList) {
      agentFilter.push({
        terms: {
          "id.keyword": [...idList]
        }
      })
    }

    // combining filters

    custQuery.bool.should.push({
      bool: {
        must: [...agentFilter]
      }
    })

    console.log(`adminsAgentsQuery :: ${JSON.stringify(custQuery)}`);

    const adminsAgentsResp = await doPaginatedQueryEllastic({ isCustomParam: true, sort, customParams: [custQuery], projectFields });

    console.log(`adminsAgentsResp: ${JSON.stringify(adminsAgentsResp)}`);

    const agentEmailSet = new Set(adminsAgentsResp.map(user => user.email));

    // Get the user pool list
    const listUserPoolsResponse = await getAllCognitoUsers();

    console.log(
      `listUserPoolsResponse: ${JSON.stringify(listUserPoolsResponse)}`
    );

    const filteredUserPool = listUserPoolsResponse.filter(
      (item) =>
        item.Attributes.find((o) => o.Name === "custom:hb_id").Value === hbId &&
        agentEmailSet.has(item.Attributes.find((o) => o.Name === "email").Value) &&
        item.Enabled
    );
    agentEmailSet.clear();
    console.log(`filteredUserPool : ${JSON.stringify(filteredUserPool)}`);

    // Adding Active Sales Agents email
    filteredUserPool.forEach(user => {
      agentEmailSet.add(user.Attributes.find((o) => o.Name === "email").Value);
    });

    const activeAgents = adminsAgentsResp.filter(user => agentEmailSet.has(user.email));

    console.log(`Active agents : ${JSON.stringify(activeAgents)}`);
    return success(activeAgents);
  } catch (error) {
    console.log(`error ${JSON.stringify(error)}`);
    return failure({ status: false, error })
  }
}

export const listUsers = (event, type) => {
  const hbidParam =
    event && event.pathParameters && event.pathParameters.hbid
      ? event.pathParameters.hbid
      : 0;
  const params = {
    TableName: entitiesTableName,
    IndexName: entitiesTableByEntityAndId,
    KeyConditionExpression: "#entity = :entity",
    ExpressionAttributeNames: {
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":entity": `agent#${hbidParam}#${type}`,
    },
  };
  console.log(params);
  return getResources(params);
};
const listVerifiedAgents = async (event) => {
  // Getting all the users
  const usersListResp = await listAllUsers({
    event,
    type: "all",
    isJSONOnly: true,
  });
  console.log(`usersListResp: ${JSON.stringify(usersListResp)}`);

  // Filter out admins for now. Update: Commented this because of client requirement.
  // const usersList = usersListResp.filter(user => user.utype !== 'admin');
  const identityData = await getSESVerificationList(usersListResp);

  // Filter out all the non-verified users
  const verifiedUserList = usersListResp.filter(
    (user) =>
      identityData[user.email] &&
      identityData[user.email].VerificationStatus &&
      identityData[user.email].VerificationStatus === "Success"
  );
  return success(verifiedUserList);
};
const getPrivList = async (builderIds) => {
  if (builderIds.length) {
    const params = {
      RequestItems: {
        /* required */
        [process.env.entitiesTableName]: {
          Keys: [],
        },
      },
    };
    for (const builderId of builderIds) {
      if (builderId) {
        params.RequestItems[process.env.entitiesTableName].Keys.push({
          id: builderId,
          entity: `builder`,
        });
      }
    }
    console.log("params: ", JSON.stringify(params));
    const builderBatchGetResp = await batchGetResources(params, true);
    console.log("builderBatchGetResp: ", JSON.stringify(builderBatchGetResp));
    const builderBatchGetRespBody =
      builderBatchGetResp &&
        builderBatchGetResp.statusCode === 200 &&
        builderBatchGetResp.body
        ? JSON.parse(builderBatchGetResp.body)
        : [];
    console.log(
      "builderBatchGetRespBody: ",
      JSON.stringify(builderBatchGetRespBody)
    );
    const builderDetailsArr = builderBatchGetRespBody.reduce(
      (builderBatchArr, builderDetail) => {
        builderBatchArr.push({
          id: builderDetail.id,
          name: builderDetail.name,
        });
        return builderBatchArr;
      },
      []
    );
    console.log("builderDetailsArr: ", JSON.stringify(builderDetailsArr));
    return builderDetailsArr;
  }

  return [];
};
export const getUser = async (event) => {
  const idParam =
    event && event.pathParameters && event.pathParameters.id
      ? event.pathParameters.id
      : 0;
  const hbidParam =
    event && event.pathParameters && event.pathParameters.hbid
      ? event.pathParameters.hbid
      : 0;
  const isSuperAdmin = hbidParam === "super_admin";
  const params = {
    TableName: process.env.entitiesTableName,
    KeyConditionExpression: "",
    ExpressionAttributeNames: {
      "#id": "id",
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":id": idParam,
    },
  };
  const getManageViewResp = await getManageView({ userId: idParam, hbId: hbidParam });
  console.log(`getManageViewResp :: ${JSON.stringify(getManageViewResp)}`);
  if (isSuperAdmin) {
    params.KeyConditionExpression = "#id = :id and #entity = :entity";
    params.ExpressionAttributeValues[":entity"] = "super_admin";
    const superAdminResp = await getResourceJSON(params);
    console.log(`superAdminResp: ${JSON.stringify(superAdminResp)}`);
    if (superAdminResp.length) {
      const superAdminDetails = superAdminResp?.length ? superAdminResp[0] : {};
      const privsArr = superAdminDetails?.privs ? superAdminDetails.privs : [];
      // Get the names of builders associated with the builder ids present in the privs array
      const privList = await getPrivList(privsArr);
      return success([{ ...superAdminDetails, privList, ...getManageViewResp }]);
    }

    return badRequest({
      status: false,
      error: "User not found. Please provide a valid id.",
    });
  }

  params.KeyConditionExpression = "#id = :id and begins_with(#entity, :entity)";
  params.ExpressionAttributeValues[":entity"] = `agent#${hbidParam}`;
  const userResp = await getResources(params, true);
  console.log(`UserResp :: ${JSON.stringify(userResp)}`);

  const validUser = userResp.data.filter(user => user.email);

  return success([{ ...validUser[0], ...getManageViewResp }])
};
export const updateUser = async (data) => {
  try {
    const id = data.id ? data.id : 0;
    const propName = data.attrn ? data.attrn : "";
    const propVal = data.attrv ? data.attrv : "";
    const hbid = data.hb_id ? data.hb_id : "";
    const utype = data.utype ? data.utype : "";
    const modDt = Date.now();

    if (propName === "active") {
      if (!id || !propVal || !utype) {
        return failure({
          status: false,
          err: "Id,propVal and utype are required",
        });
      }
      if (utype !== "super_admin" && !hbid) {
        return failure({
          status: false,
          err: "hbid is required",
        });
      }
      if (propVal && propVal === "enabled") {
        const enableParams = {
          UserPoolId: USER_POOL_ID,
          Username: id,
        };
        console.log(`enableParams: ${JSON.stringify(enableParams)}`);
        const userEnabledResponse = await identitiyProvider
          .adminEnableUser(enableParams)
          .promise();
        console.log(
          `userEnabledResponse: ${JSON.stringify(userEnabledResponse)}`
        );
      } else if (propVal && propVal === "disabled") {
        const disableParams = {
          UserPoolId: USER_POOL_ID,
          Username: id,
        };
        console.log(`disableParams: ${JSON.stringify(disableParams)}`);
        const userDisabledResponse = await identitiyProvider
          .adminDisableUser(disableParams)
          .promise();
        console.log(
          `userDisabledResponse: ${JSON.stringify(userDisabledResponse)}`
        );
      } else {
        return failure({
          status: false,
          err: "Invalid PropVal",
        });
      }
    }

    const params = {
      TableName: entitiesTableName,
      Key: {
        id,
        entity:
          utype === "super_admin" ? "super_admin" : `agent#${hbid}#${utype}`,
      },
      UpdateExpression: `set ${propName} = :pval, mdt = :modDate`,
      ExpressionAttributeValues: {
        ":pval": propVal,
        ":modDate": modDt,
      },
    };
    console.log(params);
    return updateResources(params);
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
    return failure({
      status: false,
      err: e.message,
    });
  }
};

const initDeleteUserFromDB = async (data) => {
  // Delete user from DB
  const { id = "", hb_id: hbid = "", utype = "", entity } = data;
  const isSuperAdmin = entity === "super_admin";
  const params = {
    TableName: entitiesTableName,
    Key: {
      id,
      entity: entity || `agent#${hbid}#${utype}`,
    },
  };
  console.log(params);
  try {
    const deleteFromDBRes = await deleteResourcesRaw(params);
    console.log(`deleteFromDBRes: ${JSON.stringify(deleteFromDBRes)}`);
    return success({
      status: true,
      err: `${isSuperAdmin ? `Super admin` : `User`} deleted successfully.`,
    });
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
    return failure({
      status: false,
      err: `${isSuperAdmin ? `Super admin` : `User`} delete failed.`,
    });
  }
};
export const deleteUser = async (data) => {
  const { entity = "", Username } = data;
  const isSuperAdmin = entity === "super_admin";
  let deleteFromCognitoRes;

  // Delete user from cognito user pool
  const deleteUserParam = {
    UserPoolId: USER_POOL_ID,
    Username,
  };
  console.log(`deleteUserParam: ${JSON.stringify(deleteUserParam)}`);
  try {
    deleteFromCognitoRes = await identitiyProvider
      .adminDeleteUser(deleteUserParam)
      .promise();
    console.log(
      `deleteFromCognitoRes: ${JSON.stringify(deleteFromCognitoRes)}`
    );
    // Do DB Delete
    return initDeleteUserFromDB(data);
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
    // If UserNotFoundException has occured then do the DB Delete
    if (e.statusCode === 400 && e.code === "UserNotFoundException") {
      // Do DB Delete
      return initDeleteUserFromDB(data);
    }

    return failure({
      status: false,
      err: `${isSuperAdmin ? `Super admin` : `User`} delete failed.`,
    });
  }
};

const getUserPoolList = async (payload) => {
  if (payload.hb_id) {
    try {
      const listUserPoolsResponse = await identitiyProvider
        .listUsers({ UserPoolId: USER_POOL_ID })
        .promise();
      const filteredData = listUserPoolsResponse.Users.filter(
        (item) =>
          item.Attributes.find((o) => o.Name === "custom:hb_id").Value ===
          payload.hb_id
      );
      console.log(`listUserPoolsResponse: ${JSON.stringify(filteredData)}`);
      return success({ status: true, filteredData });
    } catch (error) {
      console.log(`getUserPoolList error: ${JSON.stringify(error)}`);
      return failure({ status: false, error });
    }
  } else {
    return failure();
  }
};

// Resend confirmation code
const resendConfirmationCode = async (payload) => {
  // ses - true if resend ses verification. false if resend cognito
  const { email, isses } = payload;
  const SesVerificationTemplate = "CRM_VERIFICATION_TEMPLATE";
  if (isses) {
    try {
      console.log(
        `SesVerificationTemplate: ${JSON.stringify(SesVerificationTemplate)}`
      );
      let getTemplateResp = "";
      let sendVerificationEmailResp = "";

      try {
        getTemplateResp = await ses
          .getCustomVerificationEmailTemplate({
            TemplateName: SesVerificationTemplate,
          })
          .promise();
        console.log(`getTemplateResp: ${JSON.stringify(getTemplateResp)}`);
      } catch (error) {
        console.log(
          `ses.getCustomVerificationEmailTemplate error: ${JSON.stringify(
            error
          )}`
        );
        const verifyEmailIdentityParams = {
          EmailAddress: email,
        };
        sendVerificationEmailResp = await ses
          .verifyEmailIdentity(verifyEmailIdentityParams)
          .promise();
        console.log(
          `verifyEmailIdentity: ${JSON.stringify(sendVerificationEmailResp)}`
        );
        return success({ status: true, resp: sendVerificationEmailResp });
      }

      if (SesVerificationTemplate && getTemplateResp) {
        const sendCustomVerificationEmailParams = {
          EmailAddress: email,
          TemplateName: SesVerificationTemplate,
        };
        // ConfigurationSetName: ConfigSet
        sendVerificationEmailResp = await ses
          .sendCustomVerificationEmail(sendCustomVerificationEmailParams)
          .promise();
        console.log(
          `sendCustomVerificationEmail: ${JSON.stringify(
            sendVerificationEmailResp
          )}`
        );
      } else {
        const verifyEmailIdentityParams = {
          EmailAddress: email,
        };
        sendVerificationEmailResp = await ses
          .verifyEmailIdentity(verifyEmailIdentityParams)
          .promise();
        console.log(
          `verifyEmailIdentity: ${JSON.stringify(sendVerificationEmailResp)}`
        );
      }
      return success({ status: true, resp: sendVerificationEmailResp });
    } catch (error) {
      console.log(`resendSESConfirmationCode error: ${JSON.stringify(error)}`);
      return failure({ status: false, error });
    }
  } else {
    // Cognito Verification Resend
    const params = {
      ClientId: USER_CLIENT_ID /* required */,
      Username: email /* required */,
    };
    try {
      const resendConfirmationCodeResp = await identitiyProvider
        .resendConfirmationCode(params)
        .promise();
      console.log(
        `resendConfirmationCodeResp: ${JSON.stringify(
          resendConfirmationCodeResp
        )}`
      );
      return success({ status: true, resp: resendConfirmationCodeResp });
    } catch (error) {
      console.log(`resendConfirmationCodeResp error: ${JSON.stringify(error)}`);
      if (error && error.message) {
        return success({ status: false, error });
      }
      return failure({ status: false, error });
    }
  }
};

const getUserPoolConfig = async (event) => {
  console.log(`event: ${JSON.stringify(event)}`);
  try {
    const describeUserPoolParams = {
      UserPoolId,
    };
    console.log(
      `describeUserPoolParams: ${JSON.stringify(describeUserPoolParams)}`
    );
    const describeUserPoolResp = await identitiyProvider
      .describeUserPool(describeUserPoolParams)
      .promise();
    console.log(
      `describeUserPoolResp: ${JSON.stringify(describeUserPoolResp)}`
    );
    return success({ status: true, resp: describeUserPoolResp });
  } catch (error) {
    console.log(`error: ${JSON.stringify(error)}`);
    return failure({ status: false, error });
  }
};

const toggleUserPoolFromEmail = async (data) => {
  console.log(`data: ${JSON.stringify(data)}`);
  try {
    let checkIdentityExistsResp = "";
    if (data && data.email) {
      if (!validateEmail(data.email)) {
        return success({ status: false, error: { message: "Invalid Email" } });
      }
      checkIdentityExistsResp = await checkIdentityExists(data.email, false);
      console.log(
        `checkIdentityExistsResp: ${JSON.stringify(checkIdentityExistsResp)}`
      );
    }
    if (
      checkIdentityExistsResp &&
      checkIdentityExistsResp.VerificationAttributes &&
      checkIdentityExistsResp.VerificationAttributes[data.email] &&
      checkIdentityExistsResp.VerificationAttributes[data.email]
        .VerificationStatus &&
      checkIdentityExistsResp.VerificationAttributes[data.email]
        .VerificationStatus === "Success"
    ) {
      let getUserPoolConfigResp = await getUserPoolConfig({});
      console.log(
        `getUserPoolConfigResp: ${JSON.stringify(getUserPoolConfigResp)}`
      );
      if (getUserPoolConfigResp && getUserPoolConfigResp.body) {
        getUserPoolConfigResp = JSON.parse(getUserPoolConfigResp.body);
        if (
          getUserPoolConfigResp &&
          getUserPoolConfigResp.resp &&
          getUserPoolConfigResp.resp.UserPool
        ) {
          getUserPoolConfigResp = getUserPoolConfigResp.resp.UserPool;
        }
      }
      if (getUserPoolConfigResp && getUserPoolConfigResp.Id) {
        const updateUserPoolParams = { UserPoolId };

        if (getUserPoolConfigResp.AccountRecoverySetting) {
          updateUserPoolParams.AccountRecoverySetting =
            getUserPoolConfigResp.AccountRecoverySetting;
        }
        if (getUserPoolConfigResp.AdminCreateUserConfig) {
          const { ...AdminCreateUserConfigRest } =
            getUserPoolConfigResp.AdminCreateUserConfig;
          updateUserPoolParams.AdminCreateUserConfig =
            AdminCreateUserConfigRest;
        }
        if (getUserPoolConfigResp.AutoVerifiedAttributes) {
          updateUserPoolParams.AutoVerifiedAttributes =
            getUserPoolConfigResp.AutoVerifiedAttributes;
        }
        if (getUserPoolConfigResp.DeviceConfiguration) {
          updateUserPoolParams.DeviceConfiguration =
            getUserPoolConfigResp.DeviceConfiguration;
        }
        if (getUserPoolConfigResp.EmailConfiguration) {
          updateUserPoolParams.EmailConfiguration =
            getUserPoolConfigResp.EmailConfiguration;
        }
        if (getUserPoolConfigResp.EmailVerificationMessage) {
          updateUserPoolParams.EmailVerificationMessage =
            getUserPoolConfigResp.EmailVerificationMessage;
        }
        if (getUserPoolConfigResp.EmailVerificationSubject) {
          updateUserPoolParams.EmailVerificationSubject =
            getUserPoolConfigResp.EmailVerificationSubject;
        }
        if (getUserPoolConfigResp.LambdaConfig) {
          updateUserPoolParams.LambdaConfig =
            getUserPoolConfigResp.LambdaConfig;
        }
        if (getUserPoolConfigResp.MfaConfiguration) {
          updateUserPoolParams.MfaConfiguration =
            getUserPoolConfigResp.MfaConfiguration;
        }
        if (getUserPoolConfigResp.Policies) {
          updateUserPoolParams.Policies = getUserPoolConfigResp.Policies;
        }
        if (getUserPoolConfigResp.SmsAuthenticationMessage) {
          updateUserPoolParams.SmsAuthenticationMessage =
            getUserPoolConfigResp.SmsAuthenticationMessage;
        }
        if (getUserPoolConfigResp.SmsConfiguration) {
          updateUserPoolParams.SmsConfiguration =
            getUserPoolConfigResp.SmsConfiguration;
        }
        if (getUserPoolConfigResp.SmsVerificationMessage) {
          updateUserPoolParams.SmsVerificationMessage =
            getUserPoolConfigResp.SmsVerificationMessage;
        }
        if (getUserPoolConfigResp.UserPoolAddOns) {
          updateUserPoolParams.UserPoolAddOns =
            getUserPoolConfigResp.UserPoolAddOns;
        }
        if (getUserPoolConfigResp.UserPoolTags) {
          updateUserPoolParams.UserPoolTags =
            getUserPoolConfigResp.UserPoolTags;
        }
        if (getUserPoolConfigResp.VerificationMessageTemplate) {
          updateUserPoolParams.VerificationMessageTemplate =
            getUserPoolConfigResp.VerificationMessageTemplate;
        }

        updateUserPoolParams.EmailConfiguration = {
          EmailSendingAccount: "DEVELOPER",
          From: data.email,
          SourceArn: `arn:aws:ses:${REGION}:${ACCOUNT_ID}:identity/${data.email}`,
        };

        let updateUserPoolResp = "";
        console.log(
          `updateUserPoolParams: ${JSON.stringify(updateUserPoolParams)}`
        );
        updateUserPoolResp = await identitiyProvider
          .updateUserPool(updateUserPoolParams)
          .promise();
        console.log(
          `updateUserPoolResp: ${JSON.stringify(updateUserPoolResp)}`
        );
        return success({ status: true, resp: updateUserPoolResp });
      }
      return success({
        status: false,
        error: { message: "Error in getting user pool data" },
      });
    }
    return success({ status: false, error: { message: "Email not verified" } });
  } catch (error) {
    console.log(`error: ${JSON.stringify(error)}`);
    if (error && error.message) {
      return success({ status: false, error });
    }
    return failure({ status: false, error });
  }
};

const sendVerificationMail = async (data) => {
  console.log(`data: ${JSON.stringify(data)}`);
  const SesVerificationTemplate = "CRM_VERIFICATION_TEMPLATE";
  try {
    if (data && data.email && validateEmail(data.email)) {
      let sendVerificationEmailResp = "";
      const sendCustomVerificationEmailParams = {
        EmailAddress: data.email,
        TemplateName: SesVerificationTemplate,
      };
      sendVerificationEmailResp = await ses
        .sendCustomVerificationEmail(sendCustomVerificationEmailParams)
        .promise();
      console.log(
        `sendCustomVerificationEmail: ${JSON.stringify(
          sendVerificationEmailResp
        )}`
      );
      return success({ status: true, resp: sendVerificationEmailResp });
    }
    return success({ status: false, error: { message: "Enter Valid Email" } });
  } catch (error) {
    console.log(`sendVerificationMail error: ${JSON.stringify(error)}`);
    return failure({ status: false, error });
  }
};
const updateCognitoUserAttribute = async (data) => {
  const { attrn, attrv, email } = data;
  const params = {
    UserAttributes: [
      /* required */
      {
        Name: attrn /* required */,
        Value: attrv,
      },
    ],
    UserPoolId: USER_POOL_ID /* required */,
    Username: email /* required */,
  };
  try {
    const updateCognitoUserAttributeResp = await identitiyProvider
      .adminUpdateUserAttributes(params)
      .promise();
    console.log(
      `updateCognitoUserAttributeResp: ${JSON.stringify(
        updateCognitoUserAttributeResp
      )}`
    );
    return { status: true, data: updateCognitoUserAttributeResp };
  } catch (error) {
    return { status: false, error };
  }
};
const getAdminUserCognito = async (email) => {
  const params = {
    UserPoolId: USER_POOL_ID /* required */,
    Username: email /* required */,
  };
  try {
    const adminGetUserResp = await identitiyProvider
      .adminGetUser(params)
      .promise();
    console.log(`adminGetUserResp: ${JSON.stringify(adminGetUserResp)}`);
    return adminGetUserResp;
  } catch (error) {
    return failure({ status: false, error });
  }
};
const createSuperAdmin = async (data) => {
  try {
    const createSuperAdminResp = await createUser(data, "sadmin");
    console.log(
      `createSuperAdminResp: ${JSON.stringify(createSuperAdminResp)}`
    );
    return createSuperAdminResp;
  } catch (error) {
    return failure({ status: false, error });
  }
};
// API for updating manually created super admin to have a db entry and cognito hb_id edit
const updateExistingCognitoSuperAdmin = async (data) => {
  try {
    const { attrn, attrv, email, privs, fname, lname, root } = data;
    // Do the cognito hb_id attribute update
    const updateCognitoUserAttributeResp = await updateCognitoUserAttribute({
      attrn,
      attrv,
      email,
    });
    console.log(
      `updateCognitoUserAttributeResp: ${JSON.stringify(
        updateCognitoUserAttributeResp
      )}`
    );
    // Proceed only if user exists
    if (updateCognitoUserAttributeResp.status) {
      // Get the super admin cognito id
      const getAdminUserResp = await getAdminUserCognito(email);
      const userId = getAdminUserResp?.UserAttributes.reduce(
        (sub, attribute) => {
          if (attribute?.Name === "sub") {
            sub = attribute?.Value;
            console.log(`sub: ${sub}`);
          }
          return sub;
        },
        ""
      );
      console.log(`sub: ${userId}`);
      // Add a new db entry for this super admin
      const userItem = {
        hb_id: "",
        fname,
        lname,
        email,
        comm: [],
        privs,
        cg: false,
        user_id: userId,
        root,
      };
      await createSuperAdmin(userItem);
      return success({ status: true });
    }

    return failure({ status: false, error: "User doesn't exist" });
  } catch (error) {
    return failure({ status: false, error });
  }
};
const updateSuperAdmin = async (requestObj) => {
  try {
    // For admin@sales-crm.com, the root access will not be set to false.
    if (requestObj.email === "admin@sales-crm.com") {
      requestObj.root = true;
    }
    const {
      user_id: userId,
      email,
      privs,
      fname,
      lname,
      root,
      comm,
      id,
      entity,
      data,
      type,
      hb_id: hbId,
      utype,
      cdt,
      stat,
      rpp = "",
    } = requestObj;
    const params = {
      TableName: entitiesTableName,
      Item: {
        user_id: userId,
        email,
        privs,
        fname,
        lname,
        root,
        comm,
        id,
        entity,
        data,
        mdt: Date.now(),
        type,
        hb_id: hbId,
        utype,
        cdt,
        stat,
        rpp,
      },
    };
    return postResources(params);
  } catch (error) {
    return failure({ status: false, error });
  }
};
const getSuperAdminDetails = (data) =>
  getUser({ pathParameters: { id: data.id, hbid: "super_admin" } });
export const deleteSuperAdmin = async (data) => {
  const { id, email: Username } = data;
  // For admin@sales-crm.com, don't delete.
  if (Username === "admin@sales-crm.com") {
    return failure({
      status: false,
      error: `Deleting ${Username} is not allowed.`,
    });
  }

  return deleteUser({ id, entity: "super_admin", Username });
};
const listSuperAdmins = async () =>
  listAllUsers({
    event: { pathParameters: { hbid: "super_admin" } },
    type: "all",
    isJSONOnly: false,
    isUsersOnly: false,
    isSpecific: true,
    isSuperAdmin: true,
  });

const startSocketJob = async (data) => {
  try {
    const isBoolean = (val) => typeof val === "boolean";
    if (
      !Object.prototype.hasOwnProperty.call(data, "forDisablingEventMapping") ||
      !isBoolean(data?.forDisablingEventMapping)
    )
      return failure({
        status: false,
        error: "Invalid body parameters",
      });
    const SocketIdUpdateFunctionArn = await getStackOutputs({
      StackName,
      outputName: "SocketIdUpdateFunctionArn",
      all: false,
    });
    if (!SocketIdUpdateFunctionArn)
      return failure({
        status: false,
        error: "unable to get SocketIdUpdateFunctionArn",
      });

    const invokeResp = await invokeLambda(
      SocketIdUpdateFunctionArn,
      {
        forDisablingEventMapping: data?.forDisablingEventMapping,
      },
      true
    );
    console.log(`invokeResp: ${JSON.stringify(invokeResp)}`);
    return success({ status: true, invokeResp });
  } catch (error) {
    return failure({ status: false, error: error.message });
  }
};

const startPinpointAnalytics = async () => {
  try {
    const PinpointAnalyticsLambdaArn = await getStackOutputs({
      StackName,
      outputName: "PinpointAnalyticsLambdaArn",
      all: false,
    });
    if (!PinpointAnalyticsLambdaArn)
      return failure({
        status: false,
        error: "unable to get SocketIdUpdateFunctionArn",
      });
    const invokeResp = await invokeLambda(PinpointAnalyticsLambdaArn, {});
    console.log(`invokeResp: ${JSON.stringify(invokeResp)}`);
    return success({ status: true, invokeResp });
  } catch (error) {
    return failure({ status: false, error: error.message });
  }
};

const triggerCampaignDuplication = async (data) => {
  try {
    console.log(`data: ${JSON.stringify(data)}`);
    const arn =
      "arn:aws:lambda:us-west-2:748787612401:function:crm-test-firehoseLambda-HyphenCRMFirehoseTransform-dev";
    const invokeResp = await invokeLambda(arn, data);
    console.log(`invokeResp: ${JSON.stringify(invokeResp)}`);
    return success({ status: true, invokeResp });
  } catch (error) {
    console.log(`error: ${error}`);
    return failure({ status: false, error: error.message });
  }
};

const listPaginatedCommAgent = async (data) => {
  try {

    console.log(`Event: ${JSON.stringify(data)}`);
    const { comm = [], hb_id: hbId = "", from = 0, size = 5, after = [], type = "agent", sort = [] } = data;

    const customQuery = {
      httpMethod: "POST",
      requestPath: "/_search",
      payload: {
        query: {
          bool: {
            must: [
              {
                match: {
                  "hb_id": hbId
                }
              },
              {
                match: {
                  "entity.keyword": `agent#${hbId}#${type}`
                }
              },
              {
                match: {
                  "utype.keyword": type
                }
              }
            ]
          }
        },
        size,
        from
      }
    };

    if (comm.length) {

      const filterComm = [
        {
          exists: {
            field: "comm"
          }
        },
        {
          terms: {
            "comm.keyword": [...comm]
          }
        }
      ]
      customQuery.payload.query.bool.must.push(...filterComm)
    };

    if (sort.length) {
      customQuery.payload.sort = [];
      for (const sortField of sort) {
        // sortField = {"field": "email", "order": "asc/desc"}
        customQuery.payload.sort.push({
          [`${sortField.field}${sortField.field !== "cdt" && sortField.field !== "mdt"
            ? ".keyword"
            : ""
            }`]: sortField.order,
        });
      }
      // Adding the id field as the tie-breaker field for sorting.
      customQuery.payload.sort.push({
        "id.keyword": "asc",
      });
    };

    if (from + size > 10000 && after.length) {
      customQuery.payload.search_after = after;
      // In this case we should set from as 0
      customQuery.payload.from = 0;
    }

    console.log(`customQuery: ${JSON.stringify(customQuery)}`);
    const elasticResp = await elasticExecuteQuery(customQuery, true);
    console.log(`elasticResp: ${JSON.stringify(elasticResp)}`);

    if (elasticResp.statusCode === 200) {
      const hits = elasticResp?.body?.hits?.hits || [];
      const resultLength = hits.length;
      const totalResults = elasticResp.body.hits.total
      console.log(`resultLength: ${resultLength}`);
      console.log(`totalResults: ${totalResults}`);

      const agents = hits.map(eachAgent => (
        {
          ...eachAgent._source,
          _score: eachAgent._score
        }
      )) || [];

      const afterNext = resultLength && sort.length ? [...hits[resultLength - 1].sort] : [];
      const hasAfter = from + size < totalResults;

      return success({ agents, after: afterNext, hasAfter, totalResults })
    }
    throw new Error(`Error in Elastic Search fetching: ${elasticResp}`)

  } catch (error) {
    console.log(`Error" ${JSON.stringify(error)}`);
    return failure({ status: false, error: error?.message || error })
  }
}

const updateLastActive = async (data) => {

  const { hbId, userId, type, userType } = data;

  const lastActive = Date.now();

  const updateParams = {
    TableName: entitiesTableName,
    Key: {
      id: userId,
      entity: `${type}#${hbId}#${userType}`,
    },
    UpdateExpression:
      "set  #enddt = :actTime",
    ExpressionAttributeNames: {
      "#enddt": "enddt"
    },
    ExpressionAttributeValues: {
      ":actTime": lastActive,
    },
  };

  console.log(`UpdateParams: ${JSON.stringify(updateParams)}`);

  try {

    const updateResp = await updateResources(updateParams, true);
    console.log(`updateResp: ${JSON.stringify(updateResp)}`);

    if (!updateResp.status) throw updateResp?.error || "Error updating last login for user.";

    return success({ message: "Updated last login" });
  } catch (error) {
    console.log("Error updating last active ", error);
    return failure({ message: "Error in updating last active." })
  }

}

async function updateManageView(data) {
  const { hbId, userId, type, value } = data;
  const updateParams = {
    TableName: entitiesTableName,
    Key: {
      id: userId,
      entity: `manageView#${userId}#${hbId}`,
    },
    UpdateExpression:
      "set #field = :fieldValue",
    ExpressionAttributeNames: {
      "#field": `${type === "customer" ? "comm" : "newinte"}`
    },
    ExpressionAttributeValues: {
      ":fieldValue": value
    }
  }
  console.log(`UpdateParams: ${JSON.stringify(updateParams)}`);
  try {
    const updateResp = await updateResources(updateParams, true);
    console.log(`updateResp: ${JSON.stringify(updateResp)}`);
    return success({ message: "Updated manage view" });
  } catch (error) {
    console.log(error);
    return failure({ status: false, error: error?.message || error })
  }
}

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
    const type =
      event && event.pathParameters && event.pathParameters.type
        ? event.pathParameters.type
        : 0;
    const action =
      event && event.pathParameters && event.pathParameters.action
        ? event.pathParameters.action
        : 0;
    let data;
    console.log(`event: ${JSON.stringify(event)}`);
    switch (event.httpMethod) {
      case "GET":
        if (type === "agent" || type === "admin" || type === "oagent") {
          if (action === "list") {
            // response = await listUsers(event, type);
            response = await listAllUsers({
              event,
              type,
              isJSONOnly: false,
              isUsersOnly: false,
              isSpecific: true,
            });
          } else if (action === "get") {
            response = await getUser(event);
          } else {
            response = failure();
          }
        } else if (type === "all") {
          if (action === "list") {
            console.log(`event: ${JSON.stringify(event)}`);
            response = await listAllUsers({
              event,
              type,
              isJSONOnly: event?.pathParameters?.isJSONOnly ?? false,
              isUsersOnly: event?.pathParameters?.isUsersOnly ?? true,
            });
          } else if (action === "vlist") {
            response = await listVerifiedAgents(event);
          } else {
            response = failure();
          }
        } else if (type === "pool" && action === "details") {
          response = await getUserPoolConfig(event);
        } else {
          response = failure();
        }
        break;
      case "POST":
        data = JSON.parse(event.body);
        if (!data) {
          response = failure();
        } else if (type === "agent" && action === "create") {
          response = await createUser(data, type);
        } else if (type === "agent" && action === "list") {
          response = await listAllUsersElastic(data);
        } else if (type === "agent" && action === "community") {
          response = await listCommunityAgents(data);
        } else if (type === "sadmin" && action === "create") {
          response = await createSuperAdmin(data);
        } else if (type === "sadmin" && action === "update") {
          response = await updateSuperAdmin(data);
        } else if (type === "sadmin" && action === "details") {
          response = await getSuperAdminDetails(data);
        } else if (type === "sadmin" && action === "delete") {
          response = await deleteSuperAdmin(data);
        } else if (type === "sadmin" && action === "list") {
          response = await listSuperAdmins();
        } else if (type === "sadmin" && action === "cupdate") {
          response = await updateExistingCognitoSuperAdmin(data);
        } else if (type === "pool" && action === "update") {
          response = await toggleUserPoolFromEmail(data);
        } else if (action === "update") {
          response = await updateUser(data);
        } else if (action === "delete") {
          response = await deleteUser(data);
        } else if (type === "pool" && action === "list") {
          response = await getUserPoolList(data);
        } else if (type === "pool" && action === "resend") {
          response = await resendConfirmationCode(data);
        } else if (type === "pool" && action === "verifyemailses") {
          response = await sendVerificationMail(data);
        } else if (type === "socketJob" && action === "users") {
          response = await startSocketJob(data);
        } else if (type === "analytics" && action === "start") {
          response = await startPinpointAnalytics(data);
        } else if (type === "campaign" && action === "duplicate") {
          response = await triggerCampaignDuplication(data);
        } else if (type === "agent" && action === "listPagCommAgent") {
          response = await listPaginatedCommAgent(data);
        } else if (type === "agent" && action === "lastActive") {
          response = await updateLastActive(data);
        } else if (type === "agent" && action === "manageView") {
          response = await updateManageView(data);
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
