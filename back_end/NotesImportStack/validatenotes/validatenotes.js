import "../../NPMLayer/nodejs.zip";
import AWS from "aws-sdk";
import { invokeLambda } from "../../FunctionStack/libs/lambda";
import { uploadToS3 } from "../convertcsv/convertcsv";
import { getFileFromS3 } from "../formatnotes/formatnotes";
import { getStackOutputs } from "../../FunctionStack/libs/db";

let BUILDER_LAMBDA_ARN = "";
let SEARCH_LAMBDA_ARN = "";
let ACTIVITIES_LAMBDA_ARN = "";

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
        default:
          break;
      }
    }
    console.log(`BUILDER_LAMBDA_ARN: ${BUILDER_LAMBDA_ARN}`);
    console.log(`SEARCH_LAMBDA_ARN: ${SEARCH_LAMBDA_ARN}`);
    console.log(`ACTIVITIES_LAMBDA_ARN: ${ACTIVITIES_LAMBDA_ARN}`);
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
const doesEmailExist = async (emailArray, hbId) => {
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
                "entity.keyword": `customer#${hbId}`,
              },
            },
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

  // Invoke builder lambda
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
  let isValidNotes = false;
  let existingEmailArr = [];
  const emailCustomerIdObj = {};
  try {
    console.log(JSON.stringify(event));
    await setLambdaARNs();
    const {
      error: formatNotesError = null,
      hbId = "",
      formattedFileKey = "",
      fileKey = "",
    } = event;
    const validatedFileKey = `${fileKey}_validated.json`;
    sendResponse = ({ error = null, count = 0 }) => ({
      ...event,
      isValidNotes,
      error,
      validatedFileKey,
      count,
      BuildersApiFunctionArn: BUILDER_LAMBDA_ARN,
      SearchApiFunctionArn: SEARCH_LAMBDA_ARN,
      ActivitiesApiFunctionArn: ACTIVITIES_LAMBDA_ARN,
    });
    // End the import if formatNotesError is present
    if (formatNotesError) {
      isValidNotes = false;
      return sendResponse({ error: formatNotesError });
    }
    // Get the formatted notes from s3
    const { notes = [] } = await getFileFromS3(formattedFileKey);
    // console.log(`notes: ${JSON.stringify(notes)}`);

    // Check whether the hb_id value for the customer is valid in db
    const getBuilderResp = await getBuilderDetail({ hbId });
    console.log(`getBuilderResp: ${JSON.stringify(getBuilderResp)}`);
    // const allowUpdates = getBuilderResp?.ext_allow_updates || false;
    if (getBuilderResp && getBuilderResp.id) {
      // Check whether the request customer array contains duplicate emails
      const emailArray = notes.map((customer) => customer.email.toLowerCase());
      // console.log(`emailArray: ${emailArray}`);

      // Returns each email whose index is not equal to the first occurrence index of the email in the array
      const duplicateEmails = emailArray.filter(
        (item, index) => emailArray.indexOf(item) !== index
      );

      if (duplicateEmails.length) {
        isValidNotes = false;
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
      const existingEmailArrayResp = await doesEmailExist(emailArray, hbId);
      console.log(
        `existingEmailArrayResp: ${JSON.stringify(existingEmailArrayResp)}`
      );
      let customerData;
      let notesImportArr = [];
      if (
        existingEmailArrayResp.status &&
        existingEmailArrayResp.data &&
        existingEmailArrayResp.data.length
      ) {
        console.log(`In existingEmailArrayResp.status &&
        existingEmailArrayResp.data &&
        existingEmailArrayResp.data.length`);
        customerData = JSON.parse(JSON.stringify(existingEmailArrayResp.data));
        // Map the existingEmailArr to have only email ids instead of object with id, entity, data, and email
        existingEmailArr = customerData.map((emailObj) => emailObj.email);
        // Remove duplicates
        existingEmailArr = [...new Set(existingEmailArr)];
        /* console.log(
          `Customer(s) with email id ${JSON.stringify(
            existingEmailArr
          )} already exists in the application`
        ); */
        // Check whether the provided email ids exist in the system as customers
        // If not stop the process
        const nonExistantCustomers = emailArray.filter(
          (customerEmail) => !existingEmailArr.includes(customerEmail)
        );
        if (nonExistantCustomers && nonExistantCustomers?.length) {
          console.log(
            `nonExistantCustomers.length: ${nonExistantCustomers.length}`
          );
          console.log(
            `Customer(s) with email id ${JSON.stringify(
              nonExistantCustomers
            )} doesn't exist in the application.`
          );
          isValidNotes = false;
          return sendResponse({
            error: [`Customer(s) in the request doesn't exist.`],
          });
        }
        // Add the customer id for the note matching the email id in the request
        notesImportArr = notes.reduce((notesArr, noteObj) => {
          const customerNotesList = noteObj?.notes_list || [];
          const notesRequestArr = customerNotesList.reduce(
            (notesReqArr, noteReqObj) => {
              const noteText = noteReqObj?.note || "";
              const noteSubject = noteReqObj?.subject || "";
              let customerUUID = "";
              for (const customer of customerData) {
                if (noteObj?.email === customer?.email) {
                  customerUUID = customer?.id || "";
                  break;
                }
              }
              let activityReqObj;
              try {
                if (customerUUID && noteText && noteSubject) {
                  activityReqObj = {
                    rel_id: customerUUID,
                    hb_id: hbId,
                    acti: {
                      sub: noteSubject || "",
                      note: noteText,
                      dt: Date.now(),
                      atype: "note",
                    },
                    isBulkAPI: false,
                    isBulk: false,
                  };
                  activityReqObj.isBulk = true;
                  console.log(
                    `activityReqObj: ${JSON.stringify(activityReqObj)}`
                  );
                }
              } catch (error) {
                console.log(
                  `note import object creation error: ${JSON.stringify(
                    error.stack
                  )}`
                );
              }
              notesReqArr.push(activityReqObj);
              return notesReqArr;
            },
            []
          );
          return [...notesArr, ...notesRequestArr];
        }, []);
        console.log(`notesImportArr: ${JSON.stringify(notesImportArr)}`);
      } else {
        // No matching emails found
        isValidNotes = false;
        return sendResponse({
          error: [`Customer(s) in the request doesn't exist.`],
        });
      }

      // Upload the necessary items to s3
      await uploadToS3(validatedFileKey, {
        notes: notesImportArr,
        appid: getBuilderResp.appid,
        builderOptin: getBuilderResp.optin,
        existingEmailArr,
        emailCustomerIdObj,
      });
      console.log(`After uploadToS3`);
      isValidNotes = true;
      return sendResponse({ count: notes.length });
    }
    isValidNotes = false;
    return sendResponse({
      error: [`Builder not found.`],
    });
  } catch (error) {
    console.log(`error`);
    console.log(error);
    isValidNotes = false;
    return sendResponse({ error });
  }
}
