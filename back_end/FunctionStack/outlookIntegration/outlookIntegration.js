import "../../NPMLayer/nodejs.zip";
import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import { success, failure, badRequest } from "../libs/response-lib";
import { elasticExecuteQuery } from "../../FunctionStack/search/search";

const docClient = new AWS.DynamoDB.DocumentClient();

const checkExtEmailExist = async ({ hb_id = "", ext_email = "" }) => {
  try {
    const extEmailCheckQuery = {
      httpMethod: "POST",
      requestPath: "/_search",
      payload: {
        query: {
          bool: {
            must: [
              {
                match: {
                  "entity.keyword": "builder",
                },
              },
              {
                match: {
                  "external_email.keyword": `${ext_email}`,
                },
              },
            ],
          },
        },
      },
    };
    console.log(`extEmailCheckQuery: ${JSON.stringify(extEmailCheckQuery)}`);

    let extEmailCheckResp = await elasticExecuteQuery(extEmailCheckQuery);
    console.log(`extEmailCheckResp: ${JSON.stringify(extEmailCheckResp)}`);

    extEmailCheckResp = extEmailCheckResp.body
      ? JSON.parse(extEmailCheckResp.body)
      : {};
    extEmailCheckResp =
      extEmailCheckResp?.body?.hits?.hits.map((builder) => builder?._source) ??
      [];
    console.log(`extEmailCheckResp 2: ${JSON.stringify(extEmailCheckResp)}`);

    let isRightBuilder = !extEmailCheckResp.length ? true : false;
    if (extEmailCheckResp.length) {
      extEmailCheckResp = extEmailCheckResp.filter(
        (eachBuilder) => eachBuilder.outlook_integration
      );
      console.log(`extEmailCheckResp 3: ${JSON.stringify(extEmailCheckResp)}`);
      if (extEmailCheckResp.length > 1)
        throw "Email Already Assigned To Another Builder";
      if (extEmailCheckResp.length) {
        isRightBuilder = extEmailCheckResp[0].id === hb_id ? true : false;
      } else {
        isRightBuilder = true;
      }
    }

    if (!isRightBuilder) throw "Email Already Assigned To Another Builder";
    console.log(`isRightBuilder: ${JSON.stringify(isRightBuilder)}`);

    return { status: true, data: extEmailCheckResp };
  } catch (error) {
    console.log(`error: ${JSON.stringify(error)}`);
    return { status: false, error: { message: error } };
  }
};

const setExternalEmailRequest = async (data) => {
  try {
    console.log(`data: ${JSON.stringify(data)}`);
    const { hb_id = "" } = data;
    const { ext_email = "" } = data;
    console.log(
      "Event recieved to set external email integration for the builder with HBID :",
      hb_id
    );

    // checking if the external email is exist in any other builder
    const extEmailExistParams = {
      ext_email,
      hb_id,
    };
    const isEmailExistResp = await checkExtEmailExist(extEmailExistParams);

    if (isEmailExistResp && !isEmailExistResp.status)
      throw isEmailExistResp.error;

    const params = {
      TableName: process.env.entitiesTableName,
      Key: {
        id: hb_id,
        entity: "builder",
      },
      UpdateExpression:
        "SET outlook_integration = :val, external_email = :external_email",
      ExpressionAttributeValues: {
        ":val": true,
        ":external_email": ext_email,
      },
      ReturnValues: "ALL_NEW",
    };

    console.log("Updating outlook integration flag for the builder");
    const result = await docClient.update(params).promise();
    console.log(`Update builder preference response:`, result);
    return success({ status: true, data: "Request Initiation Complete" });
  } catch (err) {
    console.log(
      "error updating builder external email integration preference "
    );
    console.log(err);
    return failure({ status: false, error: err.message });
  }
};

const updateExternalEmail = async (data) => {
  console.log(`data: ${JSON.stringify(data)}`);
  const { hb_id = "" } = data;
  const { ext_email = "" } = data;
  console.log(
    "Event recieved to update external email for the builder with HBID :",
    hb_id
  );

  const params = {
    TableName: process.env.entitiesTableName,
    Key: {
      id: hb_id,
      entity: "builder",
    },
    UpdateExpression: "SET external_email = :external_email",
    ExpressionAttributeValues: {
      ":external_email": ext_email,
    },
    ReturnValues: "ALL_NEW",
  };

  console.log("Updating outlook integration email for the builder");
  try {
    const result = await docClient.update(params).promise();
    console.log(`Update builder preference response:`, result);
    return success({ status: true, data: "External email update Complete" });
  } catch (err) {
    console.log(
      "error updating builder external email integration preference "
    );
    console.log(err);
    return failure({ status: false, error: err.message });
  }
};

const deleteExternalEmailntegration = async (data) => {
  console.log(`data: ${JSON.stringify(data)}`);
  const { hb_id = "" } = data;
  console.log(
    "Event recieved to delete external email integration for the builder with HBID :",
    hb_id
  );

  const params = {
    TableName: process.env.entitiesTableName,
    Key: {
      id: hb_id,
      entity: "builder",
    },
    UpdateExpression: "SET outlook_integration = :val",
    ExpressionAttributeValues: {
      ":val": false,
    },
    ReturnValues: "ALL_NEW",
  };

  console.log("Deleting outlook integration for the builder");
  try {
    const result = await docClient.update(params).promise();
    console.log(`Delrte builder preference response:`, result);
    return success({ status: true, data: "External email delete Complete" });
  } catch (err) {
    console.log(
      "error deleting builder external email integration preference "
    );
    console.log(err);
    return failure({ status: false, error: err.message });
  }
};

const getExternalEmailMessages = async (data) => {
  // Function to fetch latest external email messages based on HB ID

  console.log(`data: ${JSON.stringify(data)}`);
  const { hb_id = "" } = data;
  const { ext_email = "" } = data;
  console.log(
    "Event recieved to fetch latest external email messages for builder with HB ID :",
    hb_id
  );
  try {
    console.log(
      "Fetch latest external email messages for builder with HB ID",
      hb_id
    );
    //Query Elastic Search to retrieve the emails

    const esQuery = {
      httpMethod: "POST",
      requestPath: "/_search",
      payload: {
        query: {
          bool: {
            must: [
              {
                match: {
                  "id.keyword": hb_id,
                },
              },
              {
                prefix: {
                  "entity.keyword": "message#",
                },
              },
            ],
          },
        },
        sort: [
          {
            cdt: {
              order: "desc",
            },
          },
        ],
      },
    };

    console.log(`esQuery: ${JSON.stringify(esQuery)}`);
    const resp = await elasticExecuteQuery(esQuery, true);
    console.log(`Elastic Search Query Response: ${JSON.stringify(resp)}`);

    if (
      resp &&
      resp.statusCode === 200 &&
      resp.body &&
      resp.body.hits &&
      resp.body.hits.hits
    ) {
      const { hits } = resp.body.hits;
      const resultLength = hits.length;
      const totalResults = resp.body.hits.total;
      console.log(`resultLength: ${resultLength}`);
      console.log(`totalResults: ${totalResults}`);
      const list = resultLength
        ? hits.map((rel) => {
            const respObj = {
              ...rel._source,
            };
            return respObj;
          })
        : [];
      console.log("ES Response", list);
      return success({ status: true, data: list });
    }
    return failure({
      status: false,
      list: [],
      error: "No External emails found for the builder",
    });
  } catch (err) {
    console.log("error fetching external email messages of the builder");
    console.log(err);
    return failure({ status: false, error: err.message });
  }
};

export async function main(event) {
  let response;
  try {
    console.log(`event: ${JSON.stringify(event)} `);
    const action =
      event && event.pathParameters && event.pathParameters.action
        ? event.pathParameters.action
        : 0;
    let data;
    switch (event.httpMethod) {
      case "POST":
        data = JSON.parse(event.body);
        if (!data) {
          response = failure();
        } else if (action === "init") {
          console.log("Invoking External Email Request Initialization Lambda");
          response = await setExternalEmailRequest(data);
          console.log("Response from Function :", response);
        } else if (action === "update") {
          console.log("Invoking External Email Update Lambda");
          response = await updateExternalEmail(data);
          console.log("Response from Function :", response);
        } else if (action === "delete") {
          console.log("Invoking External Email delete Lambda");
          response = await deleteExternalEmailntegration(data);
          console.log("Response from Function :", response);
        } else if (action === "get") {
          console.log("Invoking External Email Get Lambda");
          response = await getExternalEmailMessages(data);
          console.log("Response from Function :", response);
        } else {
          response = failure();
        }
        break;

      default:
        response = failure();
    }
  } catch (error) {
    console.log(
      `Exception in Outlook Integration lambda: ${JSON.stringify(error)} `
    );
    return failure({ status: false, error: error.message });
  }
  return response;
}
