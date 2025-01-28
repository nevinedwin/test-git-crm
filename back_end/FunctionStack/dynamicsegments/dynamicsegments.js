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
const getCampaigns = async ({ ApplicationId = "", CampaignId = "" }) => {
  let campaignDetail = null;
  if (ApplicationId && CampaignId) {
    const params = {
      ApplicationId /* required */,
      CampaignId /* required */,
    };
    try {
      campaignDetail = await pinpoint.getCampaign(params).promise();
      console.log(`campaignDetail: ${JSON.stringify(campaignDetail)}`);
    } catch (e) {
      console.log("Error occured");
      console.log(e.message);
      return null;
    }
  }
  return campaignDetail;
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
const setEndpointAttributes = ({
  userAttr,
  BuilderName = "",
  BuilderEmail = "",
  BuilderPhone = "",
  BuilderAddress = "",
  builderCity = "",
  builderState = "",
  builderCountry = "",
  BuilderZip = "",
  BuilderPpurl = "",
  fromFirstName = "",
  fromLastName = "",
  fromEmailAddress = "",
  fromPhone = "",
}) => {
  // Set builder params in userAttr
  userAttr.BuilderName = [BuilderName];
  userAttr.BuilderEmail = [BuilderEmail];
  userAttr.BuilderPhone = [BuilderPhone];
  userAttr.BuilderAddress = [BuilderAddress];
  userAttr.BuilderCity = [builderCity];
  userAttr.BuilderState = [builderState];
  userAttr.BuilderCountry = [builderCountry];
  userAttr.BuilderZip = [BuilderZip];
  userAttr.BuilderPpurl = [BuilderPpurl];

  userAttr.FromFirstName = [fromFirstName];
  userAttr.FromLastName = [fromLastName];
  userAttr.FromEmailAddress = [fromEmailAddress];
  userAttr.FromPhone = [fromPhone];
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

  const { Endpoints = [], ApplicationId = "", CampaignId = "" } = event;
  try {
    // Fetch the campaign details
    const campaignDetails =
      (await getCampaigns({ ApplicationId, CampaignId })) || {};
    console.log(`campaignDetails: ${JSON.stringify(campaignDetails)}`);
    const {
      CampaignResponse: {
        MessageConfiguration: { EmailMessage: { FromAddress = "" } = {} } = {},
      } = {},
    } = campaignDetails;

    // Fetch the from address details
    const FromAddressSplit = FromAddress?.split("<") || [""];
    const fromEmailSplit =
      FromAddressSplit?.length > 1 ? FromAddressSplit[1].split(">") : "";
    const fromEmail = fromEmailSplit?.length ? fromEmailSplit[0] : "";
    console.log(`fromEmail: ${fromEmail}`);

    // Loop through each endpoint and add the user attributes
    for (const key in Endpoints) {
      if (Endpoints[key]) {
        const endpoint = Endpoints[key];
        let userAttr = endpoint?.User?.UserAttributes;
        // If user attributes doesn't exist, initialize as an empty object
        if (!userAttr) {
          userAttr = {};
          endpoint.UserAttributes = userAttr;
        }
        const [hbId] = userAttr?.hb_id;

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
          const [{ name: cityName }] = getVal(cityJson, BuilderCity);
          const [{ name: stateName }] = getVal(stateJson, BuilderState);
          const [{ name: countryName }] = getVal(countryJson, BuilderCountry);
          builderCity = cityName;
          builderState = stateName;
          builderCountry = countryName;
        }
        setEndpointAttributes({
          userAttr,
          BuilderName,
          BuilderEmail,
          BuilderPhone,
          BuilderAddress,
          builderCity,
          builderState,
          builderCountry,
          BuilderZip,
          BuilderPpurl,
          fromFirstName,
          fromLastName,
          fromEmailAddress,
          fromPhone,
        });

        console.log(`endpoint: ${JSON.stringify(endpoint)}`);
        console.log(`userAttr: ${JSON.stringify(userAttr)} `);
      }
    }
  } catch (error) {
    console.log("Error occured");
    console.log(error);
    for (const key in Endpoints) {
      if (Endpoints[key]) {
        const endpoint = Endpoints[key];
        let userAttr = endpoint?.User?.UserAttributes;
        if (!userAttr) {
          userAttr = {};
          endpoint.UserAttributes = userAttr;
        }
        setEndpointAttributes({ userAttr });
      }
    }
  }
  callback(null, event.Endpoints);
}
