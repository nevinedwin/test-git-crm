/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import AWS from "aws-sdk";
import * as xml2js from "xml2js";
import { getFileFromS3 } from "../processleads/processleads";

const CUSTOMER_FILE_STATUS_PROCESSING = "PROCESSING";
const CUSTOMER_FILE_STATUS_COMPLETED = "COMPLETED";
const CUSTOMER_FILE_STATUS_FAILED = "FAILED";
const { FILE_MANAGER_BUCKET_NAME } = process.env;
const s3 = new AWS.S3({ apiVersion: "2006-03-01" });
const parser = new xml2js.Parser({ trim: true, normalize: true });
const getLeads = async ({ hbId = "", fileLocation }) => {
  let getLeadsResp;
  console.log(hbId);
  try {
    // Get the xml file from S3 which was uploaded by Zillow
    const leadsXMLFile = await getFileFromS3(fileLocation?.key, true);
    console.log(`leadsXMLFile: ${JSON.stringify(leadsXMLFile)}`);
    // Convert xml to json
    try {
      const leadsJSON = await parser.parseStringPromise(leadsXMLFile);
      console.log(`leadsJSON: ${JSON.stringify(leadsJSON)}`);
      getLeadsResp = { leads: leadsJSON };
    } catch (convertError) {
      console.log("convertError");
      console.log(convertError);
      getLeadsResp = { error: "Invalid XML file uploaded." };
    }
  } catch (error) {
    console.log("error");
    console.log(error);
    getLeadsResp = {
      error: "Unexpected error occured when processing the XML file.",
    };
  }
  return getLeadsResp;
};
export const uploadLeadsToS3 = async ({
  rnstr,
  leads,
  isStatus = false,
  statusFileKey = "",
  timestamp,
  isFormatted = false,
}) => {
  // Upload status file to s3
  // console.log('fileUploadParams: ', fileUploadParams);
  try {
    let filename;
    if (isStatus) filename = "status";
    else if (isFormatted) filename = "leads_formatted";
    else filename = "leads";
    const fileKey = `${timestamp}_${filename}.json`;
    const leadsJSONParams = {
      Bucket: FILE_MANAGER_BUCKET_NAME,
      Key: statusFileKey || `external_leads/zillow/${rnstr}/${fileKey}`,
      Body: JSON.stringify(leads, null, 4),
    };
    console.log(`leadsJSONParams: ${JSON.stringify(leadsJSONParams)}`);
    const fileUploadResp = await s3.upload(leadsJSONParams).promise();
    console.log(`fileUploadResp: ${JSON.stringify(fileUploadResp)}`);
    return fileUploadResp;
  } catch (error) {
    console.log(`error: ${JSON.stringify(error)}`);
    return error;
  }
};
export async function main(event) {
  console.log(JSON.stringify(event));
  const { hb_id: hbId, fileLocation, builderEmail, rnstr } = event;
  console.log(builderEmail);
  if (hbId && fileLocation?.key) {
    // Get the leads
    const leadsResp = await getLeads({ hbId, fileLocation });
    const { leads, error = null } = leadsResp;
    const leadArr = leads?.hsleads?.lead || [];
    console.log(`leadArr: ${JSON.stringify(leadArr)}`);

    // Upload the API response to s3 for future reference
    const currentDate = new Date().toISOString();
    const uploadToS3Resp = await uploadLeadsToS3({
      rnstr,
      leads: leadArr,
      isStatus: false,
      statusFileKey: "",
      timestamp: currentDate,
    });
    console.log(`uploadToS3Resp: ${JSON.stringify(uploadToS3Resp)}`);

    // Check for duplicates and merge the latest FirstName, LastName, Email, Phone and CommunityNumber fields.
    const mergedResult = [...leadArr].reduce((merged, item) => {
      // Check whether the email address is already there in merged object
      if (merged[item.email]) {
        merged[item.email].firstname = item?.firstname;
        merged[item.email].lastname = item?.lastname;
        merged[item.email].Phone = item?.Phone;
        merged[item.email].communitynumber = merged[item.email].communitynumber
          .length
          ? [...merged[item.email].communitynumber, item.communitynumber]
          : [item.communitynumber];
        // Remove the duplicates
        merged[item.email].communitynumber = [
          ...new Set(merged[item.email].communitynumber),
        ];
        merged[item.email].lead_source = item?.lead_source;
      } else {
        merged[item.email] = item;
        merged[item.email].communitynumber = [
          ...new Set(merged[item.email].communitynumber),
        ];
      }
      return merged;
    }, {});
    console.log(`mergedResult: ${JSON.stringify(mergedResult)}`);
    const result = [];
    for (const key in mergedResult) {
      if (key) result.push(mergedResult[key]);
    }
    console.log(`result: ${JSON.stringify(result)}`);

    // Upload the result to s3 as a best practice since the payload size cannot be greater than 256KB
    const currentDateForFormatted = new Date().toISOString();
    const uploadToS3RespFormatted = await uploadLeadsToS3({
      rnstr,
      leads: result,
      isStatus: false,
      statusFileKey: "",
      timestamp: currentDateForFormatted,
      isFormatted: true,
    });
    console.log(
      `uploadToS3RespFormatted: ${JSON.stringify(uploadToS3RespFormatted)}`
    );

    let importStatus = "";
    if (result.length) importStatus = CUSTOMER_FILE_STATUS_PROCESSING;
    else if (error) importStatus = CUSTOMER_FILE_STATUS_FAILED;
    else importStatus = CUSTOMER_FILE_STATUS_COMPLETED;
    // Upload the lead import start status with the getLeads response
    const uploadInitiateStatusFileResp = await uploadLeadsToS3({
      rnstr,
      leads: {
        cdt: currentDate,
        mdt: currentDate,
        status: importStatus,
      },
      isStatus: true,
      statusFileKey: "",
      timestamp: currentDate,
    });
    console.log(
      `uploadInitiateStatusFileResp: ${JSON.stringify(
        uploadInitiateStatusFileResp
      )}`
    );
    return {
      isLeadsFound: !!result.length,
      isErrorFound: !!error,
      error,
      leadsFileKey: uploadToS3RespFormatted.Key,
      statusFileKey: uploadInitiateStatusFileResp.key,
      count: result.length,
      ...event,
    };
  }

  // Exiting execution since Builder id and xml file key required and are not present in the request
  return {
    isLeadsFound: false,
  };
}
