import "../../NPMLayer/nodejs.zip";
import AWS from "aws-sdk";
import { success, failure, badRequest } from "../libs/response-lib";
import { elasticExecuteQuery } from "../../FunctionStack/search/search";
import { createActivity } from "../../FunctionStack/activities/activities";

const dynamodb = new AWS.DynamoDB({ apiVersion: "2012-08-10" });
const s3 = new AWS.S3();

const MailParser = require("mailparser").MailParser;
const mailparser = new MailParser();
const simpleParser = require("mailparser").simpleParser;

const { S3_BUCKET_NAME } = process.env;

export const getRawEmailFromS3 = async (bucket, key) => {
  // Function to fetch email content of an email recieved at SES from S3
  try {
    console.log("Fetch email content from s3 with key", key);
    // Download the email content from S3
    const emailObject = await s3
      .getObject({
        Bucket: bucket,
        Key: key,
      })
      .promise();

    console.log(`EmailObject from S3: ${JSON.stringify(emailObject)}`);

    return { status: true, data: emailObject };
  } catch (err) {
    console.log("error fetching raw email content from S3");
    console.log(err);
    return { status: false, error: err.message };
  }
};

export const getExactEmail = (eachMail) => {
  const exactEmail =
    eachMail.split("<").length > 1
      ? eachMail.split("<")[1].split(">")[0]
      : eachMail;
  return exactEmail;
};

export const getExactEmailFromList = (emails) => {
  let emailList = emails.split(",");
  let result = emailList.map((eachMail) => getExactEmail(eachMail));
  return String(result);
};

export const getAttachments = (attachmentsArr) => {
  let attachmentArray;
  console.log(`AttachmentArray: ${JSON.stringify(attachmentsArr)}`);
  if (attachmentsArr.length !== 0) {
    attachmentArray = attachmentsArr.map((eachImg) => {
      console.log(`eachImg: ${JSON.stringify(eachImg)}`);
      console.log(`type of eachImg: ${typeof eachImg}`);
      const {
        content: { data, type },
        contentType,
        fileName,
      } = eachImg;

      console.log({
        data: JSON.stringify(data),
        contentType: JSON.stringify(contentType),
        fileName: JSON.stringify(fileName),
        type: JSON.stringify(type),
      });
      return {
        data,
        type,
        contentType,
        fileName,
      };
    });
  } else {
    attachmentArray = [];
  }
  console.log(`result attachmentArray: ${JSON.stringify(attachmentArray)}`);
  return attachmentArray;
};

export const parseRawEmail = async (rawEmail, messageId) => {
  // Function to parse raw email content
  try {
    console.log("Parse Raw email content of email with messageID", messageId);
    const parsedEmail = await simpleParser(rawEmail);
    console.log(`Parsed Email Content: ${JSON.stringify(parsedEmail)}`);

    return { status: true, data: parsedEmail };
  } catch (err) {
    console.log("error parsing the Email");
    console.log(err);
    return { status: false, error: err.message };
  }
};

export const validateExternalEmailPreference = async (ext_email_list) => {
  // Function to validate whether the user have set the external email preference to True and get their HB ID
  try {
    console.log("Validating External Email Preference and get HB ID");
    //Query Elastic Search to retrieve the HB ID for the external email

    const esQuery = {
      httpMethod: "POST",
      requestPath: "/_search",
      payload: {
        query: {
          bool: {
            must: [
              { match: { "entity.keyword": "builder" } },
              { match: { outlook_integration: true } },
              { terms: { "external_email.keyword": ext_email_list } },
            ],
          },
        },
        _source: {
          includes: ["id", "external_email"],
        },
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
      return { status: true, data: list, error: "" };
    }
    return {
      status: false,
      list: [],
      error: "No Builder with the given constraints found",
    };
  } catch (err) {
    console.log("error validating ext email preference");
    console.log(err);
    return { status: false, error: err.message };
  }
};

export const getRecipientDetails = async (hb_id, emailList) => {
  // Function to fetch details of Customers/Realtors/Cobuyers in the mail chain
  try {
    console.log(
      "Fetching details of Customers/Realtors/Cobuyers in the mail chain"
    );
    //Query Elastic Search to retrieve the details

    // const esQuery = {
    //   httpMethod: "POST",
    //   requestPath: "/_search",
    //   payload: {
    //     query: {
    //       bool: {
    //         must: [
    //           {
    //             match: {
    //               "hb_id.keyword": hb_id
    //             }
    //           },
    //           {
    //             terms: {
    //               "email.keyword": emailList
    //             }
    //           },
    //           {
    //             terms: {
    //               "entity.keyword": [
    //                 "customer#" + hb_id,
    //                 "realtor#" + hb_id,
    //                 "cobuyer#" + hb_id
    //               ]
    //             }
    //           },
    //           {
    //             terms: {
    //               "type.keyword": [
    //                 "customer",
    //                 "realtor",
    //                 "cobuyer"
    //               ]
    //             }
    //           }
    //         ]
    //       }
    //     }
    //   },
    // };

    const esQuery = {
      httpMethod: "POST",
      requestPath: "/_search",
      payload: {
        query: {
          bool: {
            must: [
              {
                match: {
                  "hb_id.keyword": hb_id,
                },
              },
              {
                terms: {
                  "email.keyword": emailList,
                },
              },
              {
                terms: {
                  "type.keyword": ["customer", "realtor", "cobuyer"],
                },
              },
            ],
            should: [
              {
                wildcard: {
                  "entity.keyword": "cobuyer#" + hb_id + "#*",
                },
              },
              {
                terms: {
                  "entity.keyword": ["customer#" + hb_id, "realtor#" + hb_id],
                },
              },
            ],
            must_not: [
              {
                prefix: {
                  "entity.keyword": "customer#" + hb_id + "#",
                },
              },
              {
                prefix: {
                  "entity.keyword": "realtor#" + hb_id + "#",
                },
              },
            ],
          },
        },
      },
    };

    console.log(`esQuery: :${JSON.stringify(esQuery)}`);
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
      return { status: true, data: list, error: "" };
    }
    return {
      status: false,
      list: [],
      error:
        "No details of Customers/Realtors/Cobuyers in the mail chain found",
    };
  } catch (err) {
    onsole.log(
      "error fetching details of Customers/Realtors/Cobuyers in the mail chain"
    );
    console.log(err);
    return { status: false, error: err.message };
  }
};

export const activityInitiation = async (
  recipients_search_response,
  message_params
) => {
  // Function to invoke activity generation for all recipients
  try {
    const extractedData = recipients_search_response.data.map((item) => {
      return {
        fname: item.fname,
        lname: item.lname,
        email: item.email,
        id: item.id,
        type: item.type,
        hb_id: item.hb_id,
        rel_id: item.type === "cobuyer" ? item.data : item.id,
      };
    });

    console.log(
      `Extracted data for activity creation:${JSON.stringify(extractedData)}`
    );
    console.log("Iterating over each recipient");
    for (const obj of extractedData) {
      const { fname, lname, email, id, type, hb_id, rel_id } = obj;
      const request = {
        rel_id: rel_id,
        hb_id: hb_id,
        acti: {
          fname: fname,
          lname: lname,
          email: email,
          id: id,
          type: type,
          atype: "ext_email",
          dt: Date.now(),
          messageId: message_params.messageId,
          from: message_params.from,
          to: message_params.to,
          cc: message_params.cc,
          date: message_params.date,
          subject: message_params.subject,
          body: message_params.body,
        },
      };
      console.log(
        `Invoking activity creation for recipient with data : ${JSON.stringify(
          request
        )}`
      );
      const activityResponse = await createActivity(request);
      console.log(
        `Activity Creation Response : ${JSON.stringify(activityResponse)}`
      );
      if (!activityResponse.status) {
        console.log(
          `Error creating activity : ${JSON.stringify(activityResponse.error)}`
        );
        continue;
        //return failure({ status: false, error: activityResponse.error });
      }
    }
    return { status: true, data: "Activity Creation Complete" };
  } catch (err) {
    console.log("error creating activity for recipients");
    console.log(err);
    return { status: false, error: err.message };
  }
};

export async function main(event) {
  console.log(
    `Input Mail Event recieved from SES Domain: ${JSON.stringify(event)}`
  );

  const record = event.Records[0];
  const message = record.ses.mail;
  const messageId = message.messageId;
  const { recipients } = record.ses.receipt;

  console.log("Initialize Raw Email Fetch from S3");
  const email = await getRawEmailFromS3(S3_BUCKET_NAME, "emails/" + messageId);

  let ext_email_list = [...new Set([...message.destination, ...recipients])].map(eachEmail=> eachEmail.toLowerCase());


  console.log(`ext_email_list :${JSON.stringify(ext_email_list)}`);

  console.log("Validating External Email ID and its preference");
  const validate_response = await validateExternalEmailPreference(
    ext_email_list
  );
  console.log(`validateResponse: ${JSON.stringify(validate_response)}`);
  if (!validate_response.data || validate_response.data.length === 0) {
    console.log("External email preference not set for the user");
    return failure({
      status: false,
      error: "External Email preference not set for the user",
    });
  }
  const hb_id = validate_response.data[0].id;
  var ext_email = validate_response.data[0].external_email;

  const parse_response = await parseRawEmail(
    email.data.Body.toString(),
    messageId
  );
  if (!parse_response.status) {
    return failure({ status: false, error: parse_response.error });
  }

  const parsedEmail = parse_response.data;
  const emailContentText = parsedEmail.text;
  console.log(`parsedEmail: ${JSON.stringify(parsedEmail)}`);
  // const emailContentHtml = parsedEmail.textAsHtml

  let parsedEmailText = await parseRawEmail(emailContentText, messageId);
  console.log(`Parsed Email Text Content: ${JSON.stringify(parsedEmailText)}`);

  // check if the email is forwarded
  const isForwarded = emailContentText.includes(
    "---------- Forwarded message ---------"
  );

  // getting external email;
  var ext_email = getExactEmail(recipients[0]);

  const attachements = getAttachments(parsedEmail.attachments);

  if (isForwarded) {
    console.log(`Email with message ID ${messageId} has been forwarded`);

    try {
      //reparsing until getting required data
      while (!parsedEmailText.data.from) {
        // call the parser function with the input and store the output
        parsedEmailText = await parseRawEmail(
          parsedEmailText.data.text,
          messageId
        );
        console.log(
          `Re-Parsed Email Text Content: ${JSON.stringify(parsedEmailText)}`
        );
      }
    } catch (err) {
      console.error(`Error reparsing email text: ${err}`);
      return failure({
        status: false,
        error: `Error reparsing email text: ${err}`,
      });
    }

    const from = parsedEmailText.data.from.value
      .map((value) => getExactEmail(value.address))
      .join(",");
    console.log("Original From:", from);

    const to = parsedEmailText.data.to.value
      .map((value) => getExactEmail(value.address))
      .join(",");
    console.log("Original To:", to);

    const forwarded_to = parsedEmail.to.value
      .map((value) => getExactEmail(value.address))
      .join(",");
    console.log(`forwarded_to: ${forwarded_to}`);

    const cc = parsedEmailText.data.cc
      ? parsedEmailText.data.cc.value
          .map((value) => getExactEmail(value.address))
          .join(",")
      : "";
    console.log("Original Cc:", cc);

    const forwarded_cc = parsedEmail.cc
      ? parsedEmail.cc.value
          .map((value) => getExactEmail(value.address))
          .join(",")
      : "";
    console.log(`forwarded_cc: ${forwarded_cc}`);

    const date = parsedEmailText.data.date;
    console.log("Date/Time: ", date);

    const subject = parsedEmailText.data.subject;
    console.log("Original Subject:", subject);

    const content = parsedEmailText.data.text;
    console.log("Original Body:", content);

    // Extract the recipient who forwarded the email
    const forwardedRecipient = message.destination.join(", ");
    var entity = `message#${messageId}#${Date.parse(date)}`;

    //dynamoDB Parameters
    var params = {
      Item: {
        id: { S: hb_id },
        entity: { S: entity },
        message_id: { S: messageId },
        from: { S: from },
        to: { S: to },
        cc: { S: cc },
        date: { S: String(date) },
        subject: { S: subject },
        body: { S: content },
        attachements: {
          S: JSON.stringify(attachements),
        },
        isForwarded: { BOOL: true },
        forwardedRecipient: { S: forwardedRecipient },
        ext_email: { S: ext_email },
        cdt: { N: String(Date.parse(date)) },
        mdt: { N: Date.now().toString() },
      },
      TableName: process.env.entitiesTableName,
    };
    var AllEmails = [
      ...new Set([
        from,
        ...to.split(","),
        ...cc.split(","),
        ...forwarded_cc.split(","),
        ...forwarded_to.split(","),
      ]),
    ].filter((email) => email.trim());
    console.log(`All Emails: ${AllEmails}`);
    // AllEmails = AllEmails.map((eachMail) =>
    //   eachMail.split("<").length > 1
    //     ? eachMail.split("<")[1].split(">")[0]
    //     : eachMail
    // );

    // console.log(`Modified email list: ${JSON.stringify(AllEmails)}`);
  } else {
    console.log(`Email with message ID ${messageId} has not been forwarded`);

    const date_timestamp = String(Date.parse(message.timestamp));

    var entity = `message#${messageId}#${date_timestamp}`;

    // const to = message.destination.join(', ');
    const to = message.headers.find((header) => header.name === "To").value;

    const cc = message.commonHeaders.cc
      ? message.commonHeaders.cc.join(", ")
      : "";
    const bcc = message.commonHeaders.bcc
      ? message.commonHeaders.bcc.join(", ")
      : "";

    //non-Forwarded Email
    var params = {
      Item: {
        id: { S: hb_id },
        entity: { S: entity },
        message_id: { S: messageId },
        from: { S: getExactEmail(message.source) },
        to: { S: getExactEmailFromList(to) },
        cc: { S: getExactEmailFromList(cc) },
        bcc: { S: getExactEmailFromList(bcc) },
        date: {
          S: String(
            message.headers.find((header) => header.name === "Date").value
          ),
        },
        subject: { S: message.commonHeaders.subject },
        body: { S: emailContentText },
        attachements: {
          S: JSON.stringify(attachements),
        },
        isForwarded: { BOOL: false },
        ext_email: { S: getExactEmail(ext_email) },
        cdt: { N: date_timestamp },
        mdt: { N: Date.now().toString() },
      },
      TableName: process.env.entitiesTableName,
    };

    var AllEmails = [
      ...new Set([
        message.source,
        ...to.split(","),
        ...cc.split(","),
        ...bcc.split(","),
      ]),
    ].filter((email) => email.trim());
    console.log(`All Emails: ${AllEmails}`);
    // AllEmails = AllEmails.map((eachMail) =>
    //   eachMail.split("<").length > 1
    //     ? eachMail.split("<")[1].split(">")[0]
    //     : eachMail
    // );
    // console.log(`Modified email list: ${JSON.stringify(AllEmails)}`);
  }
  //Add email details to DynamoDB
  try {
    console.log(
      `Ingesting email record to DynamoDB : The parameters are :${JSON.stringify(
        params
      )}`
    );
    const db_ingest_response = await dynamodb.putItem(params).promise();
    console.log(
      `Email ${messageId} saved to DynamoDB:${JSON.stringify(
        db_ingest_response
      )}`
    );
  } catch (err) {
    console.error(`Error saving email to DynamoDB: ${err}`);
    return failure({
      status: false,
      error: `Error saving email details to DynamoDB: ${err}`,
    });
  }

  AllEmails = AllEmails.map((eachMail) =>
    eachMail.split("<").length > 1
      ? eachMail.split("<")[1].split(">")[0]
      : eachMail
  );
  console.log("List of All email recipients:", AllEmails);

  console.log(
    "Initiating Search for Customers/Realtors/Cobuyers in the mail chain"
  );
  const recipients_search_response = await getRecipientDetails(
    hb_id,
    AllEmails.map((email) => email.replace(/\s/g, ""))
  );
  console.log(
    `Recipient Search Response:${JSON.stringify(recipients_search_response)}`
  );

  if (recipients_search_response.data.length === 0) {
    console.log(
      "No Customers/Realtors/Cobuyers found in DB from the available email list"
    );
    return failure({
      status: false,
      error:
        "No Customers/Realtors/Cobuyers found in DB from the available email list",
    });
  }

  //create activity for all recipients

  const message_params = {
    messageId: params.Item.message_id.S,
    from: params.Item.from.S,
    to: params.Item.to.S,
    cc: params.Item.cc.S,
    date: params.Item.date.S,
    subject: params.Item.subject.S,
    body: params.Item.body.S,
  };
  console.log(`Message Params: : ${JSON.stringify(message_params)}`);

  console.log("Initiating activity generation for each recipient");
  const activityInitiationResponse = await activityInitiation(
    recipients_search_response,
    message_params
  );
  console.log(
    `Activity initiation Response : ${JSON.stringify(
      activityInitiationResponse
    )}`
  );
  if (!activityInitiationResponse.status) {
    return failure({ status: false, error: activityInitiationResponse.error });
  }

  return success({
    status: true,
    data: "Email processing & Activity Generation Complete",
  });
}
