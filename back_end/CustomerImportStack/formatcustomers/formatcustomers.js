import "../../NPMLayer/nodejs.zip";
import AWS from "aws-sdk";
import moment from "moment-timezone";
import {
  uploadStatusFileAndUpdateDB,
  uploadToS3,
} from "../convertcsv/convertcsv";
import { listEntitiesElastic } from "../../FunctionStack/libs/db";

const s3 = new AWS.S3({ apiVersion: "2006-03-01" });
const { FILE_MANAGER_BUCKET_NAME } = process.env;
const CUSTOMER_FILE_STATUS_FAILED = "FAILED";

async function validateAgents(agentEmail, hbId, commList, row) {
  try {
    const elasticParams = {
      hb_id: hbId,
      projectFields: ["id", "comm", "utype"],
      sort: [{ field: "id", order: "asc" }],
      isCustomParam: true,
      customParams: [
        {
          bool: {
            should: [
              {term: { "utype.keyword": "agent" }},
              {term: { "utype.keyword": "admin" }},
              {term: { "utype.keyword": "online_agent" }}
            ]
          }
        },
        {
          term: { "email.keyword": agentEmail }
        }
      ]
    }
    console.log("Format Customers Agent Query :: ", JSON.stringify(elasticParams));
    const agentDetail = await listEntitiesElastic(elasticParams);
    console.log("Format customers > agentDetail :: ", JSON.stringify(agentDetail));
    if (agentDetail.status) {
      const res = agentDetail.result;
      console.log("Format Customers > res :: ", res);
      if (!res.length) {
        return { isError: true, message: `Agent with email "${agentEmail}" in row ${row} not found.` }
      }
      if (["admin", "online_agent"].includes(res[0].utype)) {
        return { isError: false, agentId: res[0].id}
      }
      const agentCommSet = new Set(res[0].comm);
      const commCheck = (comm) => agentCommSet.has(comm);
      const hasCommunity = commList.length ? commList.some(commCheck) : false;
      console.log("Format Customers > hasCommunity :: ", hasCommunity);
      if (hasCommunity) {
        return { isError: false, agentId: res[0].id }
      }
      return { isError: true, message: `Agent with email "${agentEmail}" do not have access to provided communities. [${[...commList]}]` }
    }
    return { isError: true, message: "Error in elastic query" };
  } catch (error) {
    console.log("Error in validateAgents :: ");
    console.log(error);
    return { isError: true, message: `Exception in method validateAgents : ${JSON.stringify(error)}` }
  }
}

const formatBulkCustomerCreateReq = async (convertedCustomerArr) => {

  const dateToEpoch = (dateString) => {
    console.log(`dateToEpoch :: dateString -> ${dateString}`);
    if (!dateString) {
      return Date.now();
    }
    const allowedFormats = ['MM/DD/YYYY', 'MM-DD-YYYY', 'YYYY-MM-DD', 'YYYY/MM/DD'];
    const isValidDate = moment(dateString, allowedFormats, true).isValid();
    console.log(`isValidDate :: ${isValidDate}`);
    if (isValidDate) {
      return moment(dateString).valueOf();
    }
    return Date.now();
  }
  let status = true;
  let error = [];
  const custPromiseArr = await Promise.allSettled(
    convertedCustomerArr.map(async (customer, index) => {
      console.log(`Before formatting :: ${JSON.stringify(customer)}`);
      // convert the email id to lowercase
      if (customer?.email) customer.email = customer.email?.toLowerCase();

      // convert the comma separated customer.inte to array of inte ids
      if (customer.inte && typeof customer.inte === "string") {
        const inteIds = customer.inte.split(",");
        customer.inte = inteIds;
      }
      // convert the comma separated customer.infl to array of infl ids
      if (customer.infl && typeof customer.infl === "string") {
        const inflIds = customer.infl.split(",");
        customer.infl = inflIds;
      }
      // convert the comma separated customer.desf to array of desf ids
      if (customer.desf && typeof customer.desf === "string") {
        const desfIds = customer.desf.split(",");
        customer.desf = desfIds;
      }
      // convert the comma separated customer.agent to array of agent emails
      if (customer.agent && typeof customer.agent === "string") {
        customer.newinte = [];
        const agentEmails = customer.agent.split(",");
        if (agentEmails.length) {
          const validatePromiseRes = await Promise.allSettled(
            agentEmails.map(email => validateAgents(email.trim(), customer.hb_id, customer.inte, index + 2))
          );
          customer.newinte = validatePromiseRes.filter(promise => promise.status === "fulfilled" && !(promise.value.isError))
            .map(promise => promise.value.agentId)
          error = [...error,
          ...validatePromiseRes.filter(promise => promise.status === "fulfilled" && (promise.value.isError)).map(promise => promise.value.message),
          ...validatePromiseRes.filter(promise => promise.status === "rejected").map(promise => promise.reason)
          ]
        }
        delete customer.agent;
      }
      // convert the date to epoch
      customer.jdt = dateToEpoch(customer.reg_date);
      delete customer.reg_date;

      // add address
      customer.addr = customer.address ?? ""
      delete customer.address;

      // convert the comma separated customer.dgraph_list to array of question id objects
      customer.dgraph_list = [];
      customer.notes_list = [];
      customer.cobuyer_list = [];
      for (const customerKey in customer) {
        if (customerKey.startsWith("qstn_") && typeof customerKey === "string") {
          // console.log(`customer: ${JSON.stringify(customer)}`);
          const qstnid = customerKey.split("qstn_").pop();
          const answersArr = customer[`optn_${qstnid}`]
            ? customer[`optn_${qstnid}`].split(",")
            : [];
          // console.log(`answersArr: ${JSON.stringify(answersArr)}`);
          // Check whether answers for the question is included in the request JSON
          if (answersArr && answersArr.length) {
            // Add the question and answers to dgraph_list array
            customer.dgraph_list.push({
              qstn_id: customer[customerKey],
              option_id: customer[`optn_${qstnid}`].split(","),
            });
            // Remove the used question and answer
            delete customer[customerKey];
            delete customer[`optn_${qstnid}`];
          } else {
            // Answers for the question is not available in the request JSON
            status = false;
            error.push(
              `optn_${qstnid} field is missing for qstn_${qstnid} ${customer.email ? customer.email : ""
              }`
            );
          }
        } else if (
          customerKey.startsWith("note_") &&
          typeof customerKey === "string"
        ) {
          // console.log(`customer: ${JSON.stringify(customer)}`);
          const noteid = customerKey.split("note_").pop();
          const subject = customer[`sub_${noteid}`] || "";
          const note = customer[customerKey];
          console.log(`noteid: ${noteid}`);
          console.log(`subject: ${subject}`);
          console.log(`note: ${note}`);

          // Check whether subject for the note or vice-versa is included in the request JSON
          if (note && !subject) {
            // Subject for the note is not available in the request JSON
            console.log(
              `Subject for the note is not available in the request JSON`
            );
            status = false;
            error.push(
              `sub_${noteid} field is missing for note_${noteid} ${customer.email ? customer.email : ""
              }`
            );
          } else if (!note && subject) {
            // Note for the subject is not available in the request JSON
            console.log(
              `Note for the subject is not available in the request JSON`
            );
            status = false;
            error.push(
              `note_${noteid} field is missing for sub_${noteid} ${customer.email ? customer.email : ""
              }`
            );
          } else if (note && subject) {
            // Add the note and subject to notes_list array
            console.log(`Add the note and subject to notes_list array`);
            customer.notes_list.push({ note, subject });
            // Remove the used question and answer
            delete customer[customerKey];
            delete customer[`sub_${noteid}`];
          } else {
            // Note and subject empty. skip this note.
            console.log(`Note and subject empty. skip this note.`);
            delete customer[customerKey];
            delete customer[`sub_${noteid}`];
          }
        } else if (
          customerKey.startsWith("cobuyer_fname_") &&
          typeof customerKey === "string"
        ) {
          // cobuyer
          const cobuyerId = customerKey.split("cobuyer_fname_").pop();
          const cobuyerFname = customer[customerKey];
          const cobuyerLname = customer[`cobuyer_lname_${cobuyerId}`] || "";
          const cobuyerEmail = customer[`cobuyer_email_${cobuyerId}`] || "";
          const cobuyerPhone = customer[`cobuyer_phone_${cobuyerId}`] || "";
          const cobuyerCntm = customer[`cobuyer_cntm_${cobuyerId}`] || "";
          const cobuyerInflString = customer[`cobuyer_infl_${cobuyerId}`] || "";
          const cobuyersQuestionKeys = Object.keys(customer).filter((key) =>
            key.startsWith(`cobuyer_qstn_`)
          );
          let cobuyerInfls = [];
          if (cobuyerInflString && typeof cobuyerInflString === "string") {
            cobuyerInfls = cobuyerInflString.split(",") || [];
          }
          console.log(`cobuyerFname: ${cobuyerFname}`);
          console.log(`cobuyerLname: ${cobuyerLname}`);
          console.log(`cobuyerEmail: ${cobuyerEmail}`);
          console.log(`cobuyerPhone: ${cobuyerPhone}`);
          console.log(`cobuyerCntm: ${cobuyerCntm}`);
          console.log(`cobuyerInflString: ${cobuyerInflString}`);
          console.log(`cobuyerInfls: ${JSON.stringify(cobuyerInfls)}`);
          console.log(
            `cobuyersQuestionKeys: ${JSON.stringify(cobuyersQuestionKeys)}`
          );
          // check any value in cobuyerFname, cobuyerLname, cobuyerEmail, cobuyerPhone, cobuyerCntm, cobuyerInfls (array)
          if (cobuyerFname || cobuyerLname || cobuyerEmail || cobuyerPhone || cobuyerCntm || cobuyerInfls.length) {
            if (!cobuyerFname) {
              console.log(`Cobuyer fname is not provided`);
              status = false;
              error.push(
                `cobuyer_fname_${cobuyerId} field is missing for ${customer?.email}`
              );
            }
            if (!cobuyerLname) {
              console.log(`Cobuyer lname is not provided`);
              status = false;
              error.push(
                `cobuyer_lname_${cobuyerId} field is missing for ${customer?.email}`
              );
            }
            if (!cobuyerEmail) {
              console.log(`Cobuyer email is not provided`);
              status = false;
              error.push(
                `cobuyer_email_${cobuyerId} field is missing for ${customer?.email}`
              );
            }
            if (!cobuyerPhone) {
              console.log(`Cobuyer phone is not provided`);
              status = false;
              error.push(
                `cobuyer_phone_${cobuyerId} field is missing for ${customer?.email}`
              );
            }
            if (!cobuyerCntm) {
              console.log(`Cobuyer cntm is not provided`);
              status = false;
              error.push(
                `cobuyer_cntm_${cobuyerId} field is missing for ${customer?.email}`
              );
            }
          }
          if (
            cobuyerFname &&
            cobuyerLname &&
            cobuyerEmail &&
            cobuyerPhone &&
            cobuyerCntm
          ) {
            const cobuyerItem = {
              fname: cobuyerFname,
              lname: cobuyerLname,
              email: cobuyerEmail,
              phone: cobuyerPhone,
              cntm: cobuyerCntm,
              infl: cobuyerInfls,
              dgraph_list: [],
            };
            // Format and demographics for the cobuyer
            for (const cobuyerKey of cobuyersQuestionKeys) {
              const qstnid = cobuyerKey.split("cobuyer_qstn_").pop();
              const answersArr = customer[`cobuyer_optn_${qstnid}`]
                ? customer[`cobuyer_optn_${qstnid}`].split(",")
                : [];
              // console.log(`answersArr: ${JSON.stringify(answersArr)}`);
              // Check whether answers for the question is included in the request JSON
              if (answersArr && answersArr.length) {
                // Add the question and answers to dgraph_list array
                cobuyerItem.dgraph_list.push({
                  qstn_id: customer[cobuyerKey],
                  option_id: customer[`cobuyer_optn_${qstnid}`].split(","),
                });
                // Remove the used question and answer
                delete customer[cobuyerKey];
                delete customer[`cobuyer_optn_${qstnid}`];
              } else {
                // Answers for the question is not available in the request JSON
                status = false;
                error.push(
                  `cobuyer_optn_${qstnid} field is missing for cobuyer_qstn_${qstnid} ${cobuyerItem.email ? cobuyerItem.email : ""
                  }`
                );
              }
            }

            customer.cobuyer_list.push(cobuyerItem);
            // Remove the items from the customer object
            delete customer[`cobuyer_fname_${cobuyerId}`];
            delete customer[`cobuyer_lname_${cobuyerId}`];
            delete customer[`cobuyer_email_${cobuyerId}`];
            delete customer[`cobuyer_phone_${cobuyerId}`];
            delete customer[`cobuyer_cntm_${cobuyerId}`];
            delete customer[`cobuyer_infl_${cobuyerId}`];
          }
        }
      }
      console.log(`After formatting :: ${JSON.stringify(customer)}`);
      return customer;
    })
  );
  const customersArr = custPromiseArr.filter(promise => promise.status === "fulfilled").map(promise => promise.value);
  const rejectArr = custPromiseArr.filter(promise => promise.status === "rejected").map(promise => promise.reason);
  error = [...error, ...rejectArr]
  status = error.length ? false : status;
  return { status, customersArr, error };
};
export const getFileFromS3 = async (fileKey) => {
  const s3Params = {
    Bucket: FILE_MANAGER_BUCKET_NAME,
    Key: fileKey,
  };
  try {
    const getObjectResp = await s3.getObject(s3Params).promise();
    // console.log(getObjectResp);
    let customers =
      getObjectResp && getObjectResp.Body
        ? Buffer.from(getObjectResp.Body)
        : "";
    customers = JSON.parse(customers);
    return customers;
  } catch (error) {
    console.log("error in getFileFromS3");
    console.log(error);
    return error;
  }
};
export async function main(event) {
  let sendResponse;

  try {
    console.log(JSON.stringify(event));
    const {
      fileKey = "",
      hbId = "",
      customersFileKey = "",
      formattedFileKey = "",
      statusFileKey = "",
    } = event;
    sendResponse = ({ error = null }) => ({
      ...event,
      error,
    });
    const createStartTimestamp = new Date().toISOString();

    // Get the converted customers JSON from s3
    const convertedCustomerArr = await getFileFromS3(customersFileKey);
    /* console.log(
      `convertedCustomerArr: ${JSON.stringify(convertedCustomerArr)}`
    ); */
    // Format the converted JSON to match the customer
    const {
      status = false,
      error = null,
      customersArr,
    } = await formatBulkCustomerCreateReq(convertedCustomerArr);
    console.log(`error: ${error}`);
    if (!status) {
      await uploadStatusFileAndUpdateDB({
        startTimestamp: createStartTimestamp,
        status: CUSTOMER_FILE_STATUS_FAILED,
        resp: [],
        error,
        statusFileKey,
        fileKey,
        formattedFileKey,
        hbId,
      });
      return sendResponse({ error });
    }
    // console.log(`customersArr: ${JSON.stringify(customersArr)}`);

    // Upload the formatted customer arr to S3
    const formatEndTimestamp = new Date().toISOString();
    const formattedJSONContent = {
      start: createStartTimestamp,
      end: formatEndTimestamp,
      customers: customersArr,
    };
    await uploadToS3(formattedFileKey, formattedJSONContent);
    return sendResponse({});
  } catch (error) {
    console.log(`error`);
    console.log(error);
    return sendResponse({ error });
  }
}
