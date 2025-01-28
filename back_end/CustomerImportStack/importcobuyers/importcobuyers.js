import "../../NPMLayer/nodejs.zip";
import { invokeLambda } from "../../FunctionStack/libs/lambda";
import { doesEmailExist } from "../validatecustomers/validatecustomers";
import { uploadErrors } from "../importcustomer/importcustomer";

let COBUYERS_LAMBDA_ARN = "";

const createCobuyer = async (data) => {
  let response;
  try {
    // Create cobuyer
    const createCobuyerParams = {
      httpMethod: "POST",
      pathParameters: {
        action: "create",
      },
      body: JSON.stringify(data),
    };
    console.log(`createCobuyerParams: ${JSON.stringify(createCobuyerParams)}`);

    // Invoke cobuyer lambda
    const createCobuyerResp = await invokeLambda(
      COBUYERS_LAMBDA_ARN,
      createCobuyerParams,
      false
    );
    console.log(`createCobuyerResp: ${JSON.stringify(createCobuyerResp)}`);
    const { Payload: createCobuyerBody } = createCobuyerResp;
    response = JSON.parse(createCobuyerBody);
  } catch (error) {
    console.log(`Error occured in createCobuyer`);
    console.log(error);
    return {};
  }
  return response;
};
const validateCobuyerEmail = async ({
  cobuyerEmailList,
  hbId,
  SearchApiFunctionArn,
}) => {
  let existingEmailArr = [];

  const existingEmailArrayResp = await doesEmailExist(
    cobuyerEmailList,
    hbId,
    "cobuyer",
    SearchApiFunctionArn
  );
  console.log(
    `existingEmailArrayResp: ${JSON.stringify(existingEmailArrayResp)}`
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
  }
  return existingEmailArr;
};
const importCobuyers = async ({ cobuyerList, customerItemParam }) => {
  let response;
  const errors = [];
  let errorMsgs = [];
  try {
    for await (const cobuyer of cobuyerList) {
      console.log(cobuyer);
      cobuyer.hb_id = customerItemParam?.hb_id || "";
      cobuyer.psrc = customerItemParam?.psrc || "";
      cobuyer.rel_id = customerItemParam?.id || "";
      cobuyer.appid = customerItemParam?.appid || "";
      cobuyer.inte = customerItemParam?.inte || [];
      cobuyer.optst = customerItemParam?.optst || "";
      cobuyer.m_id = customerItemParam?.m_id || []
      // Initiate cobuyer creation
      response = await createCobuyer(cobuyer);
      console.log(`response: ${JSON.stringify(response)}`);
      if (response?.statusCode === 500) {
        // Error occured creating cobuyer
        const {
          error: { msg = "", field = {} },
        } = JSON.parse(response?.body) || {};
        // Extract specific error messages
        for (const key in field) {
          if (field[key]) errorMsgs.push(field[key]);
        }
        errors.push(`${msg} for ${cobuyer?.email}. ${errorMsgs.toString()}`);
        errorMsgs = [];
      }
    }
  } catch (error) {
    console.log(`Exception occured at importCobuyers`);
    console.log(error);
  }
  return { response, errors };
};
export async function main(event) {
  console.log(event);
  const {
    status,
    statusFileKey,
    customerItemParam,
    CobuyersApiFunctionArn,
    stageChangeActivityParams,
    inteChangeActivityParams,
    noteActivityParams,
    customerMessagingParams,
    BuildersApiFunctionArn,
    SearchApiFunctionArn,
    ActivitiesApiFunctionArn,
  } = event;
  let { cobuyerList = [] } = event;
  COBUYERS_LAMBDA_ARN = CobuyersApiFunctionArn;
  console.log(`COBUYERS_LAMBDA_ARN: ${COBUYERS_LAMBDA_ARN}`);

  if (status) {
    // Create stage change activity if any
    // Create cobuyers
    if (cobuyerList?.length > 0) {
      // Check whether the cobuyerEmailList contains duplicate emails
      const cobuyerEmailList = cobuyerList.map((cobuyer) => cobuyer.email);
      console.log(`cobuyerEmailList: ${JSON.stringify(cobuyerEmailList)}`);

      const duplicateEmails = [
        ...new Set(
          cobuyerEmailList.filter(
            (cobuyer, index) => cobuyerEmailList.indexOf(cobuyer) !== index
          ) || []
        ),
      ];
      console.log(`duplicateEmails: ${JSON.stringify(duplicateEmails)}`);
      if (duplicateEmails?.length) {
        const errorMessage = [
          `Cobuyers with same email ids found in the request. ${duplicateEmails.toString()}`,
        ];
        await uploadErrors({
          statusFileKey,
          errorMessage,
        });
      }
      // Filter out cobuyers with duplicate email ids
      cobuyerList = cobuyerList.filter(
        (cobuyer) => !duplicateEmails.includes(cobuyer.email)
      );
      console.log(
        `cobuyerList after filtering out duplicate ones: ${JSON.stringify(
          cobuyerList
        )}`
      );
      const existingCobuyersList = await validateCobuyerEmail({
        cobuyerEmailList,
        hbId: customerItemParam?.hb_id || "",
        SearchApiFunctionArn,
      });
      console.log(
        `existingCobuyersList: ${JSON.stringify(existingCobuyersList)}`
      );
      if (existingCobuyersList?.length) {
        const errorMessage = [
          `Existing cobuyers found with email ids ${existingCobuyersList.toString()}`,
        ];
        await uploadErrors({
          statusFileKey,
          errorMessage,
        });
      }
      // Filter out cobuyers with existing email ids
      cobuyerList = cobuyerList.filter(
        (cobuyer) => !existingCobuyersList.includes(cobuyer.email)
      );
      console.log(
        `cobuyerList after filtering out existing ones: ${JSON.stringify(
          cobuyerList
        )}`
      );
      const importCobuyersResp = await importCobuyers({
        cobuyerList,
        customerItemParam,
      });
      console.log(`importCobuyersResp: ${JSON.stringify(importCobuyersResp)}`);
      const { errors: errorMessage = [] } = importCobuyersResp;
      // Check whether there are errors in the cobuyer creation
      if (errorMessage.length) {
        await uploadErrors({
          statusFileKey,
          errorMessage,
        });
      }
    }
    console.log(`===========Ending process===========`);
    return {
      status,
      stageChangeActivityParams,
      inteChangeActivityParams,
      noteActivityParams,
      customerMessagingParams,
      BuildersApiFunctionArn,
      SearchApiFunctionArn,
      ActivitiesApiFunctionArn,
    };
  }
  return { status };
}
