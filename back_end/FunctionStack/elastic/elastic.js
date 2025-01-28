/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import AWS from "aws-sdk";
import { pushStream } from "dynamodb-stream-elasticsearch";
import {
  updateEndpoint,
  verifyEmailIdentity,
  sendEmail,
  getEmailTemplateRaw,
} from "../campaign/campaign";
import { getBuilderAsync } from "../builders/builders";
import { getSubscribeMail } from "./subscribeMail";
import { getResourceJSON } from "../libs/db";

const SOCKET_SEND_ENTITY_TYPES = [
  "community",
  "psrc",
  "cntm",
  "desf",
  "grade",
  "exp",
  "spec",
  "metro",
  "infl",
  "builder",
  "question_agency",
  "question_cobuyer",
  "question_customer",
  "question_realtor",
];
const ACTIONS = { INSERT: "CREATE", MODIFY: "UPDATE", REMOVE: "DELETE" };
const sqs = new AWS.SQS();
const {
  ES_ENDPOINT,
  SERVICE_ENDPOINT,
  STACKNAME_PREFIX,
  DLQ_QUEUE_URL,
  SOCKET_POST_ENDPOINT,
  entitiesTableName,
  entitiesTableByDataAndEntity,
} = process.env;

const socketClient = new AWS.ApiGatewayManagementApi({
  endpoint: SOCKET_POST_ENDPOINT,
});

const esDomain = {
  index: "entitiessearchindex",
  doctype: "_doc",
};
const sendMessageToSQS = async (event, error) => {
  console.log(`event: ${JSON.stringify(event)}`);
  console.log(`error: ${JSON.stringify(error)}`);

  try {
    const params = {
      DelaySeconds: 0,
      MessageAttributes: {
        event: {
          DataType: "String",
          StringValue: JSON.stringify(event),
        },
        error: {
          DataType: "String",
          StringValue: JSON.stringify(error),
        },
      },
      MessageBody: "DynamoDB Streams Lambda Exception" /* required */,
      QueueUrl: DLQ_QUEUE_URL /* required */,
    };
    console.log(`params: ${JSON.stringify(params)}`);
    const sendMessageToSQSResp = await sqs.sendMessage(params).promise();
    console.log(
      `sendMessageToSQSResp: ${JSON.stringify(sendMessageToSQSResp)}`
    );
  } catch (exception) {
    console.log(`exception: ${JSON.stringify(exception)}`);
  }
};
const parseRecordObj = (event, isDelete) => {
  console.log(`In parseRecordObj`);
  let dynamoRecord;
  let dynamoRecordOldImage;
  if (isDelete) {
    dynamoRecord =
      event.Records &&
      event.Records.length &&
      event.Records[0].dynamodb &&
      event.Records[0].dynamodb.Keys
        ? event.Records[0].dynamodb.Keys
        : {};
  } else {
    dynamoRecord =
      event.Records &&
      event.Records.length &&
      event.Records[0].dynamodb &&
      event.Records[0].dynamodb.NewImage
        ? event.Records[0].dynamodb.NewImage
        : {};
    dynamoRecordOldImage =
      event.Records &&
      event.Records.length &&
      event.Records[0].dynamodb &&
      event.Records[0].dynamodb.OldImage
        ? event.Records[0].dynamodb.OldImage
        : {};
  }
  const recordsConverted = AWS.DynamoDB.Converter.unmarshall(dynamoRecord);
  const recordsConvertedOld =
    AWS.DynamoDB.Converter.unmarshall(dynamoRecordOldImage);
  return { recordsConverted, recordsConvertedOld };
};
const getAllConnectionIDs = async () => {
  console.log(`In getAllConnectionIDs`);
  let response;
  try {
    const getParams = {
      TableName: entitiesTableName,
      IndexName: entitiesTableByDataAndEntity,
      KeyConditionExpression: "#data = :data",
      ExpressionAttributeNames: {
        "#data": "data",
      },
      ExpressionAttributeValues: {
        ":data": "connectionId",
      },
    };
    console.log(`getParams: ${JSON.stringify(getParams)}`);
    // Get all connection id records
    const connectionIdRecords = await getResourceJSON(getParams);
    console.log(`connectionIdRecords: ${JSON.stringify(connectionIdRecords)}`);

    // Parse the connection id records to get all the active connections ids
    const connectionIdsArr =
      connectionIdRecords?.reduce((idArr, connectionIdRecord) => {
        let { connectionIds } = connectionIdRecord;
        connectionIds = connectionIds ? JSON.parse(connectionIds) : [];
        idArr = [...idArr, ...connectionIds];
        return idArr;
      }, []) || [];
    console.log(`connectionIdsArr: ${JSON.stringify(connectionIdsArr)}`);
    return { status: true, connectionIds: connectionIdsArr };
  } catch (error) {
    console.log(`Excetion at getAllConnectionIDs`);
    console.log(error);
    response = { status: false, error };
  }
  return response;
};
const doNotificationSend = async ({
  recordsConverted,
  eventType,
  connectionId,
}) => {
  let response;
  try {
    const message = {
      id: recordsConverted.id,
      type: recordsConverted.type,
      action: ACTIONS[eventType],
      hb_id: recordsConverted?.hb_id || "",
    };
    const socketParams = {
      ConnectionId: connectionId,
      Data: Buffer.from(JSON.stringify(message)),
    };
    console.log(`socketParams ${socketParams}`);
    console.log(`SOCKET_POST_ENDPOINT ${SOCKET_POST_ENDPOINT}`);
    const socketSendResp = await socketClient
      .postToConnection(socketParams)
      .promise();
    console.log(`socketSendResp: ${JSON.stringify(socketSendResp)}`);
    response = { status: true };
  } catch (error) {
    console.log(`error occured at doNotificationSend`);
    console.log(error);
    response = { status: false, error };
  }
  return response;
};
const sendNotificationToConnections = async ({
  eventType,
  recordsConverted,
}) => {
  console.log(`In sendNotificationToConnections`);
  let response;
  try {
    const {
      status,
      connectionIds,
      error = false,
    } = await getAllConnectionIDs();
    console.log(`status: ${status}`);
    console.log(`connectionIds: ${JSON.stringify(connectionIds)}`);
    console.log(
      `error from getAllConnectionIDs function: ${JSON.stringify(error)}`
    );
    console.log(`SOCKET_POST_ENDPOINT: ${SOCKET_POST_ENDPOINT}`);

    for await (const connectionId of connectionIds) {
      await doNotificationSend({
        recordsConverted,
        eventType,
        connectionId,
      });
    }
    response = true;
  } catch (error) {
    console.log(`Error occured at sendNotificationToConnections`);
    console.log(error);
    response = false;
  }
  return response;
};
export function main(event) {
  console.log("Received event:", JSON.stringify(event, null, 2));
  // setMapping();
  let recordsConverted;
  let recordsConvertedOld;
  const eventType =
    event && event.Records && event.Records.length && event.Records[0].eventName
      ? event.Records[0].eventName
      : "";
  const processEndpoints = async () => {
    // isInsert - add this parameter for enabling the verification email sending
    const doUpdateEndpoint = async (isInsert) => {
      let OptIn = "";

      console.log(`SERVICE_ENDPOINT:    ${JSON.stringify(SERVICE_ENDPOINT)}`);

      if (eventType === "INSERT") {
        try {
          const getBuilderAsyncResponse = await getBuilderAsync(
            recordsConverted.hb_id
          );
          console.log(
            "getBuilderAsyncResponse:",
            JSON.stringify(getBuilderAsyncResponse)
          );
          if (
            getBuilderAsyncResponse.optin &&
            getBuilderAsyncResponse.optin !== null
          ) {
            OptIn = getBuilderAsyncResponse.optin;
            if (getBuilderAsyncResponse.optin) {
              const recordId =
                recordsConverted.entity.indexOf(
                  `cobuyer#${recordsConverted.hb_id}#`
                ) !== -1
                  ? recordsConverted.data
                  : recordsConverted.id;
              let subscribeEmailBody = getSubscribeMail(
                SERVICE_ENDPOINT,
                getBuilderAsyncResponse.appid,
                recordId
              );
              if (
                getBuilderAsyncResponse.tplt &&
                getBuilderAsyncResponse.tplt.length
              ) {
                const getEmailTemplateRawResponse = await getEmailTemplateRaw({
                  TemplateName: getBuilderAsyncResponse.tplt,
                });
                console.log(
                  `getEmailTemplateRawResponse: ${JSON.stringify(
                    getEmailTemplateRawResponse
                  )}`
                );
                if (
                  getEmailTemplateRawResponse &&
                  getEmailTemplateRawResponse.EmailTemplateResponse &&
                  getEmailTemplateRawResponse.EmailTemplateResponse.HtmlPart &&
                  getEmailTemplateRawResponse.EmailTemplateResponse.HtmlPart
                    .length
                ) {
                  if (
                    getEmailTemplateRawResponse.EmailTemplateResponse.HtmlPart.indexOf(
                      "{{subscribeLink}}"
                    ) !== -1
                  ) {
                    subscribeEmailBody =
                      getEmailTemplateRawResponse.EmailTemplateResponse.HtmlPart.split(
                        "{{subscribeLink}}"
                      ).join(
                        `${SERVICE_ENDPOINT}/api/public/campaigns/endpoint/subscribe/${getBuilderAsyncResponse.appid}/${recordId}`
                      );
                  }
                }
              }
              try {
                /* eslint no-template-curly-in-string: "off" */
                if (subscribeEmailBody.indexOf("${configURL}") !== -1) {
                  subscribeEmailBody = subscribeEmailBody
                    .split("${configURL}")
                    .join(`${SERVICE_ENDPOINT}`);
                }
                if (subscribeEmailBody.indexOf("{{ApplicationId}}") !== -1) {
                  subscribeEmailBody = subscribeEmailBody
                    .split("{{ApplicationId}}")
                    .join(`${getBuilderAsyncResponse.appid}`);
                }
                if (subscribeEmailBody.indexOf("{{Id}}") !== -1) {
                  subscribeEmailBody = subscribeEmailBody
                    .split("{{Id}}")
                    .join(`${recordId}`);
                }
              } catch (error) {
                console.log(
                  "Error in setting unsubscribe:",
                  JSON.stringify(error)
                );
              }
              const emailPayload = {
                ApplicationId: getBuilderAsyncResponse.appid,
                MessageRequest: {
                  MessageConfiguration: {
                    EmailMessage: {
                      Body: subscribeEmailBody,
                      FromAddress: `${getBuilderAsyncResponse.name} <${getBuilderAsyncResponse.email}>`,
                      ReplyToAddresses: [getBuilderAsyncResponse.email],
                      SimpleEmail: {
                        HtmlPart: {
                          Charset: "UTF-8",
                          Data: subscribeEmailBody,
                        },
                        Subject: {
                          Charset: "UTF-8",
                          Data: "Subscribe to Updates",
                        },
                        TextPart: {
                          Charset: "UTF-8",
                          Data: subscribeEmailBody,
                        },
                      },
                    },
                  },
                  Addresses: {
                    [`${recordsConverted.fname} ${recordsConverted.lname} <${recordsConverted.email}>`]:
                      {
                        ChannelType: "EMAIL",
                      },
                  },
                },
              };
              console.log("emailPayload:", JSON.stringify(emailPayload));
              sendEmail(emailPayload);
            }
          } else {
            OptIn = false;
          }
        } catch (error) {
          console.log("getBuilderAsync Error:", JSON.stringify(error));
        }
      }
      updateEndpoint(recordsConverted, OptIn,eventType);
      // verification email sending for new endpoints and updated emails are disabled
      // since hyphen moved out of sandbox
      if (STACKNAME_PREFIX.indexOf("dbr4") !== -1) {
        if (isInsert) {
          verifyEmailIdentity(recordsConverted);
        } else {
          // Modify Event
          // In the case of email change only, send email identity verification
          const newEmail = recordsConverted.email ? recordsConverted.email : "";
          const oldEmail = recordsConvertedOld.email
            ? recordsConvertedOld.email
            : "";
          if (oldEmail !== newEmail) {
            // Email Update. So send verification to the new email
            verifyEmailIdentity(recordsConverted);
          }
        }
      }
    };
    const { recordsConverted: converted, recordsConvertedOld: convertedOld } =
      parseRecordObj(event, false);
    recordsConverted = converted;
    recordsConvertedOld = convertedOld;
    console.log(`recordsConverted: ${JSON.stringify(recordsConverted)}`);
    console.log(`recordsConvertedOld: ${JSON.stringify(recordsConvertedOld)}`);
    switch (eventType) {
      case "INSERT":
        if (
          recordsConverted.entity === `customer#${recordsConverted.hb_id}` ||
          recordsConverted.entity === `realtor#${recordsConverted.hb_id}` ||
          recordsConverted.entity.indexOf(
            `cobuyer#${recordsConverted.hb_id}#`
          ) !== -1
        ) {
          doUpdateEndpoint(true);
        }
        break;
      case "MODIFY":
        if (
          recordsConverted.entity === `customer#${recordsConverted.hb_id}` ||
          recordsConverted.entity === `realtor#${recordsConverted.hb_id}` ||
          recordsConverted.entity.indexOf(
            `cobuyer#${recordsConverted.hb_id}#`
          ) !== -1
        ) {
          doUpdateEndpoint(false);
        }
        break;
      /* case 'REMOVE':
                parseRecordObj(true)
                deleteEndpoint(recordsConverted);
                break; */
      default:
        break;
    }
  };
  if (event.source !== "aws.events") {
    // This checking is to not process the Scheduled Warmup Event
    console.log(`Event push data: ${JSON.stringify({
      event,
      endpoint: ES_ENDPOINT,
      index: esDomain.index,
      type: esDomain.doctype,
    })}`);
    
    pushStream({
      event,
      endpoint: ES_ENDPOINT,
      index: esDomain.index,
      type: esDomain.doctype,
    })
      .then(async () => {
        console.info(`Successfully processed ${event.Records.length} records.`);
        processEndpoints();

        // Check and send message to active socket connections
        // Only if the entity type is defined as supported
        const {
          type: recordType,
          hb_id: recordHbId,
          entity: recordEntity,
        } = eventType === "REMOVE" ? recordsConvertedOld : recordsConverted;

        console.log(`recordType: ${recordType}`);
        console.log(`recordHbId: ${recordHbId}`);
        console.log(`recordEntity: ${recordEntity}`);
        console.log(`recordType === "metro": ${recordType === "metro"}`);
        console.log(
          `recordEntity === ${recordType}#${recordHbId}: ${
            recordEntity === `${recordType}#${recordHbId}`
          }`
        );

        // Checking whether this resource is the main metro resource.
        // There are resources with type "metro" associated with agencies.
        // These resources need not be sent to the frontend as part of socket connection.
        // If not metro type, setting this to true for enabling the sending of the resource action via socket.
        const ifMetroIsItMainResource =
          recordType === "metro"
            ? recordEntity === `${recordType}#${recordHbId}`
            : true;

        if (
          SOCKET_SEND_ENTITY_TYPES.includes(recordType) &&
          ifMetroIsItMainResource
        ) {
          await sendNotificationToConnections({
            eventType,
            recordsConverted:
              eventType === "REMOVE" ? recordsConvertedOld : recordsConverted,
          });
        }
      })
      .catch(async (e) => {
        console.info(`Error ${e}`);
        processEndpoints();
        // Push the event object to DLQ
        await sendMessageToSQS(event, `Error ${e}`);
      });
  }
}
