import "../../NPMLayer/nodejs.zip";
import AWS from "aws-sdk";
import { invokeLambda,initLambdaInvoke } from "../../FunctionStack/libs/lambda";
import { uploadToS3 } from "../convertcsv/convertcsv";
import { getFileFromS3 } from "../formatcustomers/formatcustomers";
import { getStackOutputs } from "../../FunctionStack/libs/db";

let BUILDER_LAMBDA_ARN = "";
let SEARCH_LAMBDA_ARN = "";
let ACTIVITIES_LAMBDA_ARN = "";
let COBUYERS_LAMBDA_ARN = "";
let COMMUNITIES_LAMBDA_ARN = "";

const { MACHINE_ARN, StackName } = process.env;
const sfn = new AWS.StepFunctions();

const setLambdaARNs = async () => {
  try {
    const stackOutputs = await getStackOutputs({
      StackName,
      outputName: "",
      all: true,
    });
    for (const stackOutput of stackOutputs) {
      switch (stackOutput.OutputKey) {
        case "BuildersApiFunctionArn":
          BUILDER_LAMBDA_ARN = stackOutput.OutputValue;
          break;
        case "SearchApiFunctionArn":
          SEARCH_LAMBDA_ARN = stackOutput.OutputValue;
          break;
        case "ActivitiesApiFunctionArn":
          ACTIVITIES_LAMBDA_ARN = stackOutput.OutputValue;
          break;
        case "CobuyersApiFunctionArn":
          COBUYERS_LAMBDA_ARN = stackOutput.OutputValue;
          break;
        case "CommunitiesApiFunctionArn":
          COMMUNITIES_LAMBDA_ARN = stackOutput.OutputValue;
          break;
        default:
          break;
      }
    }
    console.log(`BUILDER_LAMBDA_ARN: ${BUILDER_LAMBDA_ARN}`);
    console.log(`SEARCH_LAMBDA_ARN: ${SEARCH_LAMBDA_ARN}`);
    console.log(`ACTIVITIES_LAMBDA_ARN: ${ACTIVITIES_LAMBDA_ARN}`);
    console.log(`COBUYERS_LAMBDA_ARN: ${COBUYERS_LAMBDA_ARN}`);
    console.log(`COMMUNITIES_LAMBDA_ARN: ${COMMUNITIES_LAMBDA_ARN}`);
  } catch (error) {
    console.log("error in setLambdaARNs");
    console.log(error);
  }
};
export const initAnalyticsCalculationForBuilder = async (builderDetail) => {
  let nextEvent = {
    ...builderDetail,
  };
  nextEvent = JSON.stringify(nextEvent);
  const params = {
    input: nextEvent,
    stateMachineArn: MACHINE_ARN,
  };
  console.log(`params: ${JSON.stringify(params)}`);
  const startExecutionResp = await sfn.startExecution(params).promise();
  console.log(`startExecutionResp: ${JSON.stringify(startExecutionResp)}`);
};
const getBuilderDetail = async ({ hbId = "" }) => {
  let builderDetail = [];
  try {
    // Get the list of builders
    const getBuilderParams = {
      httpMethod: "POST",
      pathParameters: {
        action: "getbuilderdetail",
      },
      body: JSON.stringify({
        hbId,
      }),
    };
    console.log(`getBuilderParams: ${JSON.stringify(getBuilderParams)}`);

    console.log(`BUILDER_LAMBDA_ARN: ${JSON.stringify(BUILDER_LAMBDA_ARN)}`);
    // Invoke builder lambda
    const builderDetailResp = await invokeLambda(
      BUILDER_LAMBDA_ARN,
      getBuilderParams,
      false
    );
    console.log(`builderDetailResp: ${JSON.stringify(builderDetailResp)}`);
    let { Payload: builderDetailBody } = builderDetailResp;
    builderDetailBody = JSON.parse(builderDetailBody);
    builderDetail = builderDetailBody?.status ? builderDetailBody?.data : {};
    console.log(`builderDetail: ${JSON.stringify(builderDetail)}`);
  } catch (error) {
    console.log(`Error occured in getBuilderDetail`);
    console.log(error);
    return {};
  }
  return builderDetail;
};
export const doesEmailExist = async (
  emailArray,
  hbId,
  type = "customer",
  SearchApiFunctionArn = ""
) => {
  // Elastic query to validate the request email ids
  const queryReqObj = {
    httpMethod: "POST",
    requestPath: "/_search",
    payload: {
      query: {
        bool: {
          must: [
            {
              match: {
                "hb_id.keyword": hbId,
              },
            },
          ],
        },
      },
      size: 1000,
    },
  };
  if (type === "customer") {
    queryReqObj.payload.query.bool.must.push({
      match: {
        "entity.keyword": `${type}#${hbId}`,
      },
    });
  } else if (type === "cobuyer") {
    queryReqObj.payload.query.bool.must.push({
      match: {
        "type.keyword": type,
      },
    });
  }
  const aggregateParams = {
    httpMethod: "POST",
    pathParameters: {
      action: "aggregatej",
    },
    body: JSON.stringify({
      requestBody: queryReqObj,
      isJSONOnly: true,
      list: emailArray,
    }),
  };
  console.log(`aggregateParams: ${JSON.stringify(aggregateParams)}`);

  // Setting search lambda arn if it is supplied as arguements and if it is invalid
  if (!SEARCH_LAMBDA_ARN && SearchApiFunctionArn)
    SEARCH_LAMBDA_ARN = SearchApiFunctionArn;
  // Invoke search lambda
  const validateEmailResp = await invokeLambda(
    SEARCH_LAMBDA_ARN,
    aggregateParams,
    false
  );
  console.log(`validateEmailResp: ${JSON.stringify(validateEmailResp)}`);
  let { Payload: validateEmailBody } = validateEmailResp;
  validateEmailBody = JSON.parse(validateEmailBody);
  const validateEmail = validateEmailBody?.status
    ? validateEmailBody?.data
    : {};
  console.log(`validateEmail: ${JSON.stringify(validateEmail)}`);

  if (validateEmailBody && validateEmailBody.status) {
    return { status: true, data: validateEmail };
  }

  // Error occured in validate API
  return validateEmailResp;
};
export async function main(event) {
  let sendResponse;
  let isValidCustomers = false;
  let existingEmailArr = [];
  let emailCustomerIdObj = {};
  try {
    console.log(JSON.stringify(event));
    await setLambdaARNs();
    const {
      error: formatCustomersError = null,
      hbId = "",
      formattedFileKey = "",
      fileKey = "",
      isExternalBulkCustomer = true,
    } = event;
    const validatedFileKey = `${fileKey}_validated.json`;
    sendResponse = ({ error = null, count = 0 }) => ({
      ...event,
      isValidCustomers,
      error,
      validatedFileKey,
      count,
      BuildersApiFunctionArn: BUILDER_LAMBDA_ARN,
      SearchApiFunctionArn: SEARCH_LAMBDA_ARN,
      ActivitiesApiFunctionArn: ACTIVITIES_LAMBDA_ARN,
      CobuyersApiFunctionArn: COBUYERS_LAMBDA_ARN,
    });
    // End the import if formatCustomersError is present
    if (formatCustomersError) {
      isValidCustomers = false;
      return sendResponse({ error: formatCustomersError });
    }
    // Get the formatted customers from s3
    let { customers = [] } = await getFileFromS3(formattedFileKey);
    // console.log(`customers: ${JSON.stringify(customers)}`);

    // Check whether the request customer array contains different hb_id or invalid hb_id
    const hbidArr = customers.map((customer) => customer.hb_id);
    const uniqueHbidArr = [...new Set(hbidArr)];
    console.log(`uniqueHbidArr: ${uniqueHbidArr}`);
    if (uniqueHbidArr.length !== 1) {
      isValidCustomers = false;
      // hb_id provided for the customers are not unique
      return sendResponse({
        error: [`Please provide the same hb_id for the customers`],
      });
    }
    if (uniqueHbidArr.length === 1 && uniqueHbidArr[0] !== hbId) {
      isValidCustomers = false;
      // hb_id value is not valid for this home builder
      return sendResponse({
        error: [`Please provide a valid hb_id for the customers`],
      });
    }

    // Check whether the hb_id value for the customer is valid in db
    const getBuilderResp = await getBuilderDetail({ hbId });
    console.log(`getBuilderResp: ${JSON.stringify(getBuilderResp)}`);
    const allowUpdates = getBuilderResp?.ext_allow_updates || false;
    if (getBuilderResp && getBuilderResp.id) {
      // Check whether the request customer array contains duplicate emails
      const emailArray = customers.map((customer) =>
        customer.email.toLowerCase()
      );
      // console.log(`emailArray: ${emailArray}`);

      // Returns each email whose index is not equal to the first occurrence index of the email in the array
      const duplicateEmails = emailArray.filter(
        (item, index) => emailArray.indexOf(item) !== index
      );

      if (duplicateEmails.length) {
        isValidCustomers = false;
        return sendResponse({
          error: [
            `Request contains duplicate email id in the email field (${[
              ...new Set(duplicateEmails),
            ]})`,
          ],
          field: `email`,
        });
      }

      // Check whether the email addresses in the request does not exist in the application
      const existingEmailArrayResp = await doesEmailExist(
        emailArray,
        customers[0].hb_id
      );

      if (
        existingEmailArrayResp.status &&
        existingEmailArrayResp.data &&
        existingEmailArrayResp.data.length
      ) {
        console.log(`In existingEmailArrayResp.status &&
        existingEmailArrayResp.data &&
        existingEmailArrayResp.data.length`);

        // Map the existingEmailArr to have only email ids instead of object with id, entity, data, and email
        existingEmailArr = JSON.parse(
          JSON.stringify(existingEmailArrayResp.data)
        ).map((emailObj) => emailObj.email);
        // Remove duplicates
        existingEmailArr = [...new Set(existingEmailArr)];
        /* console.log(
          `Customer(s) with email id ${JSON.stringify(
            existingEmailArr
          )} already exists in the application`
        ); */
        // Check whether overwrite customers is enabled in builder settings
        console.log(`allowUpdates: ${allowUpdates}`);
        if (!allowUpdates) {
          console.log(`In !allowUpdates`);
          console.log(`existingEmailArr.length: ${existingEmailArr.length}`);
          // Remove the existing customers from the request
          customers = customers.filter(
            (customer) => !existingEmailArr.includes(customer.email)
          );
          /* console.log(
            `customers after existing emails removed: ${JSON.stringify(
              customers
            )}`
          ); */
        } else {
          emailCustomerIdObj = existingEmailArrayResp.data.reduce(
            (obj, customer) => {
              if (!obj[customer.email])
                obj[customer.email] = {
                  id: customer.id,
                  entity: customer.entity,
                  data: customer.data,
                };
              return obj;
            },
            {}
          );
          /* console.log(
            `emailCustomerIdObj: ${JSON.stringify(emailCustomerIdObj)}`
          ); */
        }
      }
      console.log(
        `customers.length after filtering duplicates: ${customers.length}`
      );
      // adding metroIds to customers and coBuyers
      const communities = await initLambdaInvoke({
        action: "list",
        httpMethod: "GET",
        body:{ hbid: hbId },
        arn:COMMUNITIES_LAMBDA_ARN,
        getBody: true,
      });

      const commMappedMetro = {}

      for (const item of communities) {
        commMappedMetro[item.id] = item.rel_id
      }

      console.log(
        `commMappedMetro: ${commMappedMetro}`
      );

      // Upload the necessary items to s3
      await uploadToS3(validatedFileKey, {
        customers,
        appid: getBuilderResp.appid,
        isExternalAPI: !isExternalBulkCustomer,
        builderOptin: getBuilderResp.optin,
        existingEmailArr,
        emailCustomerIdObj,
        commMappedMetro
      });
      console.log(`After uploadToS3`);
      if (customers?.length === 0) {
        console.log(`existingEmailArr.length: ${existingEmailArr.length}`);
        isValidCustomers = false;
        return sendResponse({
          error: [`No valid customers to import.`],
        });
      }
      isValidCustomers = true;
      return sendResponse({ count: customers.length });
    }
    isValidCustomers = false;
    return sendResponse({
      error: [`Builder not found.`],
    });
  } catch (error) {
    console.log(`error`);
    console.log(error);
    isValidCustomers = false;
    return sendResponse({ error });
  }
}
