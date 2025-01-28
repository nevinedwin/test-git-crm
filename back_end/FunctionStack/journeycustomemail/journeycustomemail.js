import AWS from "aws-sdk";
import { invokeLambda } from "../libs/lambda";

const countryJson = require("../countrystatecity/country.json");
const stateJson = require("../countrystatecity/state.json");
const cityJson = require("../countrystatecity/city.json");

const pinpoint = new AWS.Pinpoint({ apiVersion: "2016-12-01" });
const { BUILDER_LAMBDA_ARN, SEARCH_LAMBDA_ARN } = process.env;
const getBuilder = async (hbId = "") => {
  let builderDetail;
  try {
    // Get the builder details
    const getBuilderParams = {
      httpMethod: "POST",
      pathParameters: {
        action: "getb",
      },
      body: JSON.stringify({ id: hbId }),
    };
    console.log(`getBuilderParams: ${JSON.stringify(getBuilderParams)}`);

    // Invoke builder lambda
    const builderDetailResp = await invokeLambda(
      BUILDER_LAMBDA_ARN,
      getBuilderParams,
      false
    );
    console.log(`builderDetailResp: ${JSON.stringify(builderDetailResp)}`);
    let { Payload: builderDetailBody } = builderDetailResp;
    builderDetailBody = JSON.parse(builderDetailBody);
    builderDetail = builderDetailBody;
    console.log(`builderDetail: ${JSON.stringify(builderDetail)}`);
  } catch (error) {
    console.log(`Error occured in getBuilder dynamicsegments`);
    console.log(error);
    return [];
  }
  return builderDetail;
};
const getJourneyDetail = async ({ ApplicationId = "", JourneyId = "" }) => {
  let journeyDetail = null;
  if (ApplicationId && JourneyId) {
    const params = {
      ApplicationId /* required */,
      JourneyId /* required */,
    };
    try {
      journeyDetail = await pinpoint.getJourney(params).promise();
      console.log(`journeyDetail: ${JSON.stringify(journeyDetail)}`);
    } catch (e) {
      console.log("Error occured");
      console.log(e.message);
      return null;
    }
  }
  return journeyDetail;
};
const getVal = (arr, id) => arr.filter((item) => item.id === id);

const fetchFromAddressDetails = async (emailAddress) => {
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
                "email.keyword": emailAddress,
              },
            },
            {
              match: {
                "type.keyword": "agent",
              },
            },
          ],
        },
      },
    },
  };
  const aggregateParams = {
    httpMethod: "POST",
    pathParameters: {
      action: "queryj",
    },
    body: JSON.stringify({
      queryObj: queryReqObj,
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
    : [];
  console.log(`validateEmail: ${JSON.stringify(validateEmail)}`);
  const [{ _source: { fname = "", lname = "", email = "", phone = "" } } = {}] =
    validateEmail;

  return { fname, lname, email, phone };
};
const sendEmail = async ({ ApplicationId, TemplateName, Endpoints }) => {
  const emailPayload = {
    ApplicationId,
    MessageRequest: {
      MessageConfiguration: {},
      Endpoints,
      TemplateConfiguration: {
        EmailTemplate: {
          Name: TemplateName,
        },
      },
    },
  };
  console.log("emailPayload:", JSON.stringify(emailPayload));
  try {
    const sendEmailResponse = await pinpoint
      .sendMessages(emailPayload)
      .promise();
    console.log(`sendEmailResponse: ${JSON.stringify(sendEmailResponse)}`);
    return { status: true, data: sendEmailResponse };
  } catch (e) {
    console.log(`e: ${JSON.stringify(e)}`);
    return { status: false, error: e };
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
export async function main(event, context, callback) {
  console.log("Received event:", JSON.stringify(event, null, 2));
  let builderDetail = null;
  let builderCity = null;
  let builderState = null;
  let builderCountry = null;
  let fromFirstName = "";
  let fromLastName = "";
  let fromEmailAddress = "";
  let fromPhone = "";
  let journeyTemplate = "";
  let fromEmail;
  let userAttr;
  const endpointData = {};
  const {
    Endpoints = [],
    ApplicationId = "",
    JourneyId = "",
    ActivityId = "",
    Data: FromAddress = "",
  } = event;
  try {
    // Fetch the journey details
    const journeyDetail =
      (await getJourneyDetail({ ApplicationId, JourneyId })) || {};
    console.log(`journeyDetail: ${JSON.stringify(journeyDetail)}`);
    const { JourneyResponse: { Activities = {} } = {} } = journeyDetail;

    // Get the email template name of the current custom activity
    for (const key in Activities) {
      if (Activities[key]) {
        console.log(`Activities[key]: ${JSON.stringify(Activities[key])}`);
        // Check whether this activity is matching the current activity
        const customActivity =
          (key === ActivityId && Activities[key]?.CUSTOM) || false;
        console.log(`customActivity: ${JSON.stringify(customActivity)}`);
        if (customActivity) {
          console.log("In if customActivity");
          const { TemplateName = "" } = customActivity;
          journeyTemplate = TemplateName;
          break;
        }
      }
    }

    // Fetch the from address details
    const FromAddressSplit = FromAddress?.split("<") || [""];
    const fromEmailSplit =
      FromAddressSplit?.length > 1 ? FromAddressSplit[1].split(">") : "";
    fromEmail = fromEmailSplit?.length ? fromEmailSplit[0] : "";
    console.log(`fromEmail: ${fromEmail}`);

    // Loop through each endpoint and prepare the endpoint data for the email sending
    for (const key in Endpoints) {
      if (Endpoints[key]) {
        const endpoint = Endpoints[key];
        userAttr = endpoint?.User?.UserAttributes;

        // If user attributes doesn't exist, initialize as an empty object
        if (!userAttr) {
          userAttr = {};
          endpoint.UserAttributes = userAttr;
        }
        // Get the endpoint details
        const [hbId = ""] = userAttr?.hb_id;

        // Fetch the builder details, if not already done,
        // since the endpoint will belong to the same pinpoint application,
        // thus will belong to the same builder
        // This way, builder details will only be fetched once,
        // during the initial iteration.
        if (!builderDetail) {
          // Get builder details
          const builderDetails = await getBuilder(hbId);
          console.log(`builderDetails: ${JSON.stringify(builderDetails)}`);
          builderDetail = builderDetails?.data || {};
          const { email, phone, name } = builderDetail;
          // Fetch the details of the sender.
          // If the sender email is the same as the builder,
          // don't fetch and use the builder's details.
          // else fetch the sender details from elastic.
          const fromDetails =
            builderDetail?.email !== fromEmail
              ? await fetchFromAddressDetails(fromEmail)
              : { email, phone, fname: name };
          fromFirstName = fromDetails?.fname || "";
          fromLastName = fromDetails?.lname || "";
          fromEmailAddress = fromDetails?.email || "";
          fromPhone = fromDetails?.phone || "";
        }
        const {
          name: BuilderName,
          email: BuilderEmail,
          phone: BuilderPhone,
          address: BuilderAddress,
          city: BuilderCity,
          state: BuilderState,
          country: BuilderCountry,
          zip: BuilderZip,
          ppurl: BuilderPpurl,
        } = builderDetail;
        // Only get the city, state and country values if not already exists
        if (!builderCity && !builderState && !builderCountry) {
          // Get the values for city, state and country from JSON
          const city = getVal(cityJson, BuilderCity);
          const cityName = city.length ? city[0]?.name : "";
          const state = getVal(stateJson, BuilderState);
          const stateName = state.length ? state[0]?.name: "";
          const country = getVal(countryJson, BuilderCountry);
          const countryName = country.length ? country[0]?.name: "";
          builderCity = cityName;
          builderState = stateName;
          builderCountry = countryName;
        }
        const {
          fname,
          lname,
          email,
          phone,
          rltr_nm: rltrNm,
          agcnm,
          agtnm,
        } = userAttr;
        // Add the endpoint substitutions
        endpointData[key] = {
          Substitutions: {
            "User.UserAttributes.fname": fname,
            "User.UserAttributes.lname": lname,
            "User.UserAttributes.email": email,
            "User.UserAttributes.phone": phone,
            "User.UserAttributes.rltr_nm": rltrNm,
            "User.UserAttributes.agcnm": agcnm,
            "User.UserAttributes.agtnm": agtnm,
            "User.UserAttributes.BuilderName": [BuilderName],
            "User.UserAttributes.BuilderEmail": [BuilderEmail],
            "User.UserAttributes.BuilderPhone": [BuilderPhone],
            "User.UserAttributes.BuilderAddress": [BuilderAddress],
            "User.UserAttributes.BuilderCity": [builderCity],
            "User.UserAttributes.BuilderState": [builderState],
            "User.UserAttributes.BuilderCountry": [builderCountry],
            "User.UserAttributes.BuilderZip": [BuilderZip],
            "User.UserAttributes.BuilderPpurl": [BuilderPpurl],
            "User.UserAttributes.FromFirstName": [fromFirstName],
            "User.UserAttributes.FromLastName": [fromLastName],
            "User.UserAttributes.FromEmailAddress": [fromEmailAddress],
            "User.UserAttributes.FromPhone": [fromPhone],
          },
        };
      }
    }
    console.log(`event.Endpoints: ${JSON.stringify(event.Endpoints)}`);
    await sendEmail({
      ApplicationId,
      TemplateName: journeyTemplate,
      Endpoints: endpointData,
    });
  } catch (error) {
    console.log("Error occured");
    console.log(error);
    for (const key in Endpoints) {
      if (Endpoints[key]) {
        const endpoint = Endpoints[key];
        userAttr = endpoint?.User?.UserAttributes;
        if (!userAttr) {
          userAttr = {};
          endpoint.UserAttributes = userAttr;
        }
        endpointData[key] = {
          Substitutions: {
            "User.UserAttributes.fname": "",
            "User.UserAttributes.lname": "",
            "User.UserAttributes.email": "",
            "User.UserAttributes.phone": "",
            "User.UserAttributes.rltr_nm": "",
            "User.UserAttributes.agcnm": "",
            "User.UserAttributes.agtnm": "",
            "User.UserAttributes.BuilderName": "",
            "User.UserAttributes.BuilderEmail": "",
            "User.UserAttributes.BuilderPhone": "",
            "User.UserAttributes.BuilderAddress": "",
            "User.UserAttributes.BuilderCity": "",
            "User.UserAttributes.BuilderState": "",
            "User.UserAttributes.BuilderCountry": "",
            "User.UserAttributes.BuilderZip": "",
            "User.UserAttributes.BuilderPpurl": "",
            "User.UserAttributes.FromFirstName": "",
            "User.UserAttributes.FromLastName": "",
            "User.UserAttributes.FromEmailAddress": "",
            "User.UserAttributes.FromPhone": "",
          },
        };
      }
    }
  }
  callback(null, event.Endpoints);
}
