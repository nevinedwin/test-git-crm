/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";

import AWS from "aws-sdk";
import { getBuilderAsync } from "../../FunctionStack/builders/builders";

const { FILE_MANAGER_BUCKET_NAME } = process.env;
const s3 = new AWS.S3({ apiVersion: "2006-03-01" });

const validateRequest = async (customersList, hbId) => {
  if (customersList && customersList.length === 0) {
    return { doImport: false, error: { msg: `Empty request` } };
  }

  // Check whether the request customer array contains different hb_id or invalid hb_id
  const hbidArr = customersList.map((customer) => customer.hb_id);
  const uniqueHbidArr = [...new Set(hbidArr)];
  console.log(`uniqueHbidArr: ${uniqueHbidArr}`);
  if (uniqueHbidArr.length !== 1) {
    // hb_id provided for the customers are not unique
    return {
      doImport: false,
      error: { msg: `Please provide the same hb_id for the customers` },
    };
  }
  if (uniqueHbidArr.length === 1 && uniqueHbidArr[0] !== hbId) {
    // hb_id value is not valid for this home builder
    return {
      doImport: false,
      error: { msg: `Please provide a valid hb_id for the customers` },
    };
  }

  // Check whether the hb_id value for the customer is valid in db
  const getBuilderResp = await getBuilderAsync(hbId);
  console.log(`getBuilderResp: ${JSON.stringify(getBuilderResp)}`);
  if (getBuilderResp && getBuilderResp.id) {
    return { doImport: true, appid: getBuilderResp.appid };
  }

  return {
    doImport: false,
    error: { msg: `Please provide a valid hb_id for the customers` },
  };
};
export const getFileFromS3 = async (fileKey, isXML = false) => {
  const s3Params = {
    Bucket: FILE_MANAGER_BUCKET_NAME,
    Key: fileKey,
  };
  try {
    const getObjectResp = await s3.getObject(s3Params).promise();
    console.log(getObjectResp);
    let leads =
      getObjectResp && getObjectResp.Body
        ? Buffer.from(getObjectResp.Body)
        : "";
    if (isXML) leads = leads.toString("utf8");
    else leads = JSON.parse(leads);
    return leads;
  } catch (error) {
    console.log("error in getFileFromS3");
    console.log(error);
    return error;
  }
};
const convertToValidPhone = (phone) => {
  const cleaned = `${phone}`.replace(/\D/g, "");
  console.log(`cleaned: ${cleaned}`);
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  console.log(`match: ${match}`);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return null;
};
export async function main(event) {
  let response;
  try {
    const {
      hb_id: hbId,
      leadsFileKey,
      statusFileKey,
      appid,
      zillow_psrc = "",
      zillow_infl = "",
      zillow_cmt_to_note_sub = "",
      zillow_cmt_to_note = false,
    } = event;
    const { index, step } = event.iterator;
    // Get the leads file from s3
    const customerLeads = await getFileFromS3(leadsFileKey);
    console.log(`customerLeads: ${JSON.stringify(customerLeads)}`);
    // Slice the customerLeads array from index to index + step and format the customerList for import

    const customersList = customerLeads
      .slice(index, index + step)
      .map((lead) => ({
        fname: lead.firstname[0],
        lname: lead.lastname[0],
        email: lead.email[0],
        phone: lead.phone[0] ? convertToValidPhone(lead.phone[0]) : null,
        stage: "Lead",
        type: "customer",
        hb_id: hbId,
        commNumber: lead.communitynumber,
        submitDate: lead.submit_date_time?.length
          ? lead.submit_date_time[0]
          : 0,
        appid,
        comments: lead?.message || "",
        zillow_psrc,
        zillow_infl,
        zillow_cmt_to_note,
        zillow_cmt_to_note_sub,
      }));
    console.log(`customersList: ${JSON.stringify(customersList)}`);
    console.log(`customersList.length: ${customersList.length}`);
    // Do initial validation on customerList
    const validateRequestOb = await validateRequest(customersList, hbId);
    console.log(`validateRequestOb: ${JSON.stringify(validateRequestOb)}`);
    if (validateRequestOb && !validateRequestOb.doImport) {
      console.log(`In doImport false`);
      response = {
        hb_id: hbId,
        count: event.count,
        index: 0,
        ...validateRequestOb,
        leadsFileKey,
        statusFileKey,
        iterator: event.iterator,
      };
    }

    console.log(`In doImport true`);
    response = {
      customersList,
      hb_id: hbId,
      count: event.count,
      index,
      ...validateRequestOb,
      leadsFileKey,
      statusFileKey,
      importComplete: false,
      iterator: event.iterator,
    };
  } catch (error) {
    console.log(`Exception occured: ${error}`);
  }
  return response;
}
