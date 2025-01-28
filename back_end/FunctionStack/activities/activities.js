/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import { v4 as uuidv4 } from "uuid";
import moment from "moment-timezone";
import { publishEntityData } from "../libs/messaging";
import {
  postResources,
  getResources,
  updateResources,
  deleteResources,
  getHydrationParamsForQuery,
  getResourceJSON,
  getQueryPromise,
  scanResources,
} from "../libs/db";
import { success, failure } from "../libs/response-lib";
import { validateFields } from "../validation/validation";
import { sendRequest } from "../libs/search-lib";
import { elasticExecuteQuery } from "../search/search";
import { deleteSchedule } from "../lastcontact/lastContact";
import { getBuilderAsync } from "../builders/builders";


const aws = require("aws-sdk");
const nodemailer = require("nodemailer");

const s3 = new aws.S3();

const ses = new aws.SES({
  region: "us-west-2",
});
const ical = require("ical-generator");

const { STACK_PREFIX, S3_BUCKET_ARN, LAST_CONTACT_ARN, 
        LAST_CONTACT_ID, entitiesTableName } = process.env;

async function scheduleLastContact({ hbId, relId, scheduleTime, activityUUID }) {
  try {

    const cwEvents = new aws.CloudWatchEvents();
    const scheduleExpression = `cron(${scheduleTime.minute()} ${scheduleTime.hour()} ${scheduleTime.date()} ${scheduleTime.month() + 1} ? ${scheduleTime.year()})`;
    console.log(`scheduleExpression :: ${scheduleExpression}`);
    const lambdaArgs = {
      id: relId,
      hbId,
      ruleName: `LastContact-${activityUUID}`,
      targetId: `${LAST_CONTACT_ID}`
    }
    console.log(`lambdaArgs :: ${JSON.stringify(lambdaArgs)}`);
    console.log(`LAST_CONTACT_ARN :: ${LAST_CONTACT_ARN}`);
    
    const putRuleResp = await cwEvents.putRule({
      Name: lambdaArgs.ruleName,
      ScheduleExpression: scheduleExpression,
      State: 'ENABLED'
    }).promise();
    console.log(`putRuleResp :: ${JSON.stringify(putRuleResp)}`);

    const putTargetsResp = await cwEvents.putTargets({
      Rule: lambdaArgs.ruleName,
      Targets: [
        {
          Id: lambdaArgs.targetId,
          Arn: LAST_CONTACT_ARN,
          Input: JSON.stringify(lambdaArgs)
        }
      ]
    }).promise();
    console.log(`putTargetsResp :: ${JSON.stringify(putTargetsResp)}`);

    return success({ status: true })
  } catch (error) {
    return failure({ status: false, error })
  }
}

async function saveLastContactType(id, hbId, cType, cTime) {
  try {
    const mod = Date.now();
    const dbParams = {
      TableName: entitiesTableName,
      Key: {
        id,
        entity: `customer#${hbId}`
      },
      UpdateExpression: `set #contactType = :cType, #mdt = :modDate, #contactTime = :cTime`,
      ExpressionAttributeNames:{
        "#contactType": "rnstr",
        "#mdt": "mdt",
        "#contactTime": "dt"
      },
      ExpressionAttributeValues: {
        ":cType": cType,
        ":modDate": mod,
        ":cTime": cTime
      }
    }
    console.log(`UpdateLastContactParams :: ${JSON.stringify(dbParams)}`);
    const updateResp = await updateResources(dbParams, true);
    console.log(`updateLastContactResp :: ${JSON.stringify(updateResp)}`);
    if (!updateResp.status) throw updateResp?.error || "Error in updating last contact method"
    return success({status: true});
  } catch (error) {
    console.log("Error in saveLastContactType :: ", error);
    return failure({status: false, error});
  }
}

async function manageLastContact(data, scheduleParams, status = null ) {
  const {
    atype,
    relId,
    hbId,
    dt
  } = data;

  const isValidApptStatus = !!(status === "SCHEDULED" || status === "CONFIRMED");

  if ((atype === "appointment" && isValidApptStatus) || atype === "call") {
    console.log(`activity :: ${atype} :: scheduleParams :: ${JSON.stringify(scheduleParams)}`);
    const scheduleResp = await scheduleLastContact(scheduleParams);
    console.log(`scheduleResp :: ${JSON.stringify(scheduleResp)}`);
    const saveLastContactResp = await saveLastContactType(relId, hbId, atype, Date.now());
    console.log(`activity :: ${atype} :: saveLastContactResp :: `, saveLastContactResp);
  }
  if (atype === "appointment" && status === 'COMPLETE') {
    const saveLastContactResp = await saveLastContactType(relId, hbId, atype, Date.now());
    console.log(`activity :: ${atype} :: status :: ${status} :: saveLastContactResp :: `, saveLastContactResp);
  }
  if (atype === "mail") {
    // Update the dt field in customer to track last contact, rnstr field for contactType
    const saveLastContactResp = await saveLastContactType(relId, hbId, atype, dt);
    console.log(`activity :: ${atype} :: saveLastContactResp :: `, saveLastContactResp);
  }
}

export const createActivity = async (data) => {
  const {
    acti = {},
    rel_id: relId = "",
    hb_id: hbId = "",
    appointmentEmailData = {},
    isSns = false,
    isHf = false,
    hfhbid = "",
    hfid = "",
    isLeadAPI = false,
    isZillow = false,
    isBulkAPI = false,
    isBulk = false,
    isAnalytics = false,
  } = data;
  const { atype = "", status = "", attachments = [] } = acti;
  const cdt = Date.now();
  const modDt = cdt;
  const activityUUID = isSns && isHf && hfid ? hfid : uuidv4();
  let createActivityResp;
  const retVal = atype ? validateFields(atype, data) : "";
  const scheduleParams = {
    hbId, relId, scheduleTime: "", activityUUID
  }
  if (retVal === "") {
    console.log(`data: ${JSON.stringify(data)}`);
    acti.id = relId;
    acti.cdt = cdt;
    acti.mdt = modDt;
    acti.rel_id = relId;
    acti.type = "activity";
    acti.entity = `activity#${hbId}#${atype}#${activityUUID}`;
    acti.data = activityUUID;
    acti.hb_id = hbId;
    if (hfhbid) {
      acti.hfhbid = hfhbid;
    }
    if (hfid) {
      acti.hfid = hfid;
    }
    if (isSns) {
      if (isHf) acti.gen_src = "msg_hf";
      else acti.gen_src = "msg_brix";
    } else if (isLeadAPI) {
      acti.gen_src = "lead_api";
    } else if (isZillow) {
      acti.gen_src = "lead_zillow";
    } else if (isBulkAPI) {
      acti.gen_src = "bulk_api";
    } else if (isBulk) {
      acti.gen_src = "bulk";
    } else if (isAnalytics) {
      acti.gen_src = "campaign_analytics";
    } else acti.gen_src = "app";
    if (atype === "campaign" && acti.isj === true) {
      acti.jsch.StartTime = new Date(acti.jsch.StartTime).toISOString();
      acti.jsch.EndTime = new Date(acti.jsch.EndTime).toISOString();
      console.log("acti startTime journey: ", acti.jsch.StartTime);
      console.log("acti startTime journey: ", typeof acti.jsch.StartTime);
      console.log("acti endTime journey: ", acti.jsch.EndTime);
      console.log("acti endTime journey: ", typeof acti.jsch.EndTime);
    }
    if (atype === "appointment" || atype === "task") {
      acti.status = status;
    }
    if (atype === "task") {
      acti.cmpby = {};
    }
    if (atype === "appointment") {
      acti.seq = 0;
    }
    // reusing the fields to avoid ES remapping
    if (atype === "mail" || atype === "appointment") {
      acti.oldinte = data.cc ?? []
      acti.newinte = data.bcc ?? []
    }
    if (atype === "mail" && attachments.length) {
      const attch = [];
      try {
        for (const pdf of attachments) {
          if (pdf?.fileName && pdf?.blobString) {
            const key = `attachments/mail_pdf/${cdt}_${pdf?.fileName || "sample.pdf"
              }`;
            const file = Buffer.from(
              pdf?.blobString
                .toString()
                .replace(/^data:image\/\w+;base64,/, ""),
              "base64"
            );
            console.log("key", key);
            console.log("file", file);
            const params = {
              Bucket: S3_BUCKET_ARN,
              Key: key,
              Body: file,
            };
            console.log("params: ", params);
            const s3UploadResp = await s3.upload(params).promise();
            console.log("s3UploadResp: ", s3UploadResp);
            attch.push({
              fileName: pdf?.fileName,
              path: key,
            });
          } else {
            return failure({
              status: false,
              error: "fileName or blobString is not provided",
            });
          }
        }
      } catch (error) {
        console.log(`mail attachment error : ${JSON.stringify(error.stack)}`);
        return failure({ status: false, error: error.stack });
      }
      acti.attch = JSON.stringify(attch);
    }
    if (acti?.attachments) delete acti.attachments;

    const params = {
      TableName: process.env.entitiesTableName,
      Item: acti,
    };
    console.log(params);
    if (atype === "call") {
      const eventEndTime = moment(acti.dt).add(acti.dur, "minutes");
      scheduleParams.scheduleTime = eventEndTime;
    }
    if (atype === "appointment") {
      const {
        userName,
        userEmail,
        fromName,
        fromEmail,
        customerName,
        customerEmail,
        communityName,
      } = appointmentEmailData;
      if (userName && userEmail && customerName && customerEmail) {
        try {
          const transporter = nodemailer.createTransport({ SES: { ses, aws } });

          const constIcalMethod = "request";

          const cal = ical({
            scale: "gregorian",
            method: constIcalMethod,
            // ttl: (60 * 60 * 24),
            prodId: {
              company: "Hyphen Solutions",
              product: "CRM",
              language: "EN",
            },
          });

          const eventStartTime = moment(acti.dt);

          const eventEndTime = moment(acti.dt).add(acti.dur, "minutes");

          console.log(
            `eventStartTime : ${JSON.stringify(eventStartTime.toString())}`
          );

          console.log(
            `eventEndTime : ${JSON.stringify(eventEndTime.toString())}`
          );

          console.log(
            `moment dt : ${JSON.stringify(moment(acti.dt).toString())}`
          );

          console.log(`moment : ${JSON.stringify(moment().toString())}`);

          const event = cal.createEvent({
            uid: activityUUID,
            sequence: 0,
            name: "Builder Meeting",
            status: "confirmed",
            busystatus: "busy",
            start: eventStartTime,
            end: eventEndTime,
            timestamp: moment(),
            summary: acti.sub,
            description: acti.sub,
            location: communityName,
            organizer: {
              name: userName,
              email: userEmail,
              mailto: userEmail,
            },
          });

          event.createAttendee({
            email: userEmail,
            name: userName,
            mailto: userEmail,
          });
          event.createAttendee({
            email: customerEmail,
            name: customerName,
            mailto: customerEmail,
          });
          if (data.cc?.length) {
            data.cc.forEach(cc => {
              event.createAttendee({
                email: cc,
                name: customerName,
                mailto: cc
              });
            })
          }
          if (data.bcc?.length) {
            data.bcc.forEach(bcc => {
              event.createAttendee({
                email: bcc,
                name: customerName,
                mailto: bcc
              });
            })
          }

          event.createCategory({ name: "Builder Meeting" });

          const icalString = cal.toString();

          console.log(`icalString : ${JSON.stringify(icalString)}`);
          const sendParams = {
            from: {
              name: fromName,
              address: fromEmail,
            },
            to: customerEmail,
            // cc: userEmail,
            cc: data.cc?.length ? [...data.cc, userEmail].join(',') : userEmail,
            bcc: data.bcc?.length ? data.bcc.join(',') : '',
            replyTo: userEmail,
            subject: acti.sub,
            html: acti.note,
            icalEvent: {
              filename: "invitation.ics",
              method: constIcalMethod,
              content: icalString,
            },
          };
          console.log(`sendParams: ${JSON.stringify(sendParams)}`);
          const transporterRes = await transporter.sendMail(sendParams);
          console.log(`transporterRes : ${JSON.stringify(transporterRes)}`);
          if (transporterRes && transporterRes.messageId) {
            createActivityResp = await postResources(params);
          } else {
            return failure({ status: false, error: transporterRes });
          }
          scheduleParams.scheduleTime = eventEndTime;
        } catch (error) {
          console.log(`transporter error : ${JSON.stringify(error.stack)}`);
          return failure({ status: false, error: error.stack });
        }
      } else {
        console.log("Required fields for invite email sending missing");
        createActivityResp = await postResources(params);
      }
    } else {
      console.log("atype === 'appointment' else: ");
      createActivityResp = await postResources(params);
    }
  } else {
    return failure({ status: false, error: "Validation Failed", retVal });
  }
  
  const mgmtLcParams = {
    atype,
    relId,
    hbId,
    dt: atype === "mail" ? acti.dt : Date.now()
  };
  await manageLastContact(mgmtLcParams, scheduleParams, acti.status);

  // Send Homefront message
  if (
    !data.isSns &&
    (STACK_PREFIX.includes("aws-crm") || STACK_PREFIX.includes("crm-test")) &&
    atype !== "stage_change" &&
    atype !== "community_change"
  ) {
    const publishEntityDataHfResp = await publishEntityData({
      entityId: activityUUID,
      entityType: "activity",
      isBrix: false,
      isCreate: true,
      isHomefront: true,
      messageId: uuidv4(),
      HomebuilderID: hbId,
    });
    console.log("publishEntityDataHfResp: ", publishEntityDataHfResp);
  }
  console.log(`createActivityResp: ${JSON.stringify(createActivityResp)}`);
  return createActivityResp;
};
const getActivity = (event) => {
  const actId =
    event && event.pathParameters && event.pathParameters.id
      ? event.pathParameters.id
      : 0;
  const params = {
    TableName: process.env.entitiesTableName,
    IndexName: process.env.entitiesTableByDataAndEntity,
    KeyConditionExpression: "#data = :data",
    ExpressionAttributeNames: {
      "#data": "data",
    },
    ExpressionAttributeValues: {
      ":data": actId,
    },
  };
  console.log(params);
  return getResources(params);
};
const filterActivity = (data) => {
  const { hbid = "", atype = "", rel_id: relId = "" } = data;

  if (atype) {
    const params = {
      TableName: process.env.entitiesTableName,
      KeyConditionExpression: "#id = :id and begins_with(#entity, :entity)",
      ExpressionAttributeNames: {
        "#id": "id",
        "#entity": "entity",
      },
      ExpressionAttributeValues: {
        ":id": relId,
        ":entity": `activity#${hbid}#${atype}`,
      },
    };
    console.log(params);
    return getResources(params);
  }

  return failure({ status: false, error: "Type cannot be empty" });
};
export const listActivities = (event, isJSONOnly = false) => {
  console.log(`event: ${JSON.stringify(event)}`);
  console.log(`isJSONOnly: ${isJSONOnly}`);
  const { rel_id: relId = "", hbid = "" } = event.pathParameters;
  const params = {
    TableName: process.env.entitiesTableName,
    KeyConditionExpression: "#id = :id and begins_with(#entity, :entity)",
    ExpressionAttributeNames: {
      "#id": "id",
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":id": relId,
      ":entity": `activity#${hbid}`,
    },
  };
  console.log(params);
  if (isJSONOnly) {
    return getResourceJSON(params);
  }

  return getResources(params);
};
export const updateActivityRow = async (data) => {
  const {
    isSns = false,
    isHf = false,
    acti = {},
    hfhbid = "",
    hfid = "",
    rel_id: relId = "",
    hb_id: hbId = "",
    id = "",
  } = data;
  const { atype = "" } = acti;
  console.log(`data: ${JSON.stringify(data)}`);
  const retVal = atype ? validateFields(atype, data) : "";
  if (retVal === "") {
    const activityUUID = id || hfid;
    const params = {
      TableName: process.env.entitiesTableName,
      Item: {
        id: relId,
        relId,
        rel_id: relId,
        type: "activity",
        entity: `activity#${hbId}#${atype}#${activityUUID}`,
        data: activityUUID,
        hfhbid,
        hfid,
        gen_src: "",
        hbId,
        ...acti,
      },
    };
    if (isSns) {
      if (isHf) params.Item.gen_src = "msg_hf";
      else params.Item.gen_src = "msg_brix";
    } else params.Item.gen_src = "app";
    // Get the activity Details
    const activityGetParams = getHydrationParamsForQuery(
      data.rel_id,
      `activity#${data.hb_id}#${data.id}`,
      false,
      true
    );
    const activityDetail = await getResourceJSON(activityGetParams);
    const currentDate = Date.now();
    if (activityDetail && activityDetail.length) {
      const activityDetailObj = activityDetail[0];
      console.log(`activityDetailObj: ${JSON.stringify(activityDetailObj)}`);
      const cdt = activityDetailObj?.cdt ?? "";
      // Merge the existing customer data with the request obj
      params.Item = { ...activityDetailObj, ...params.Item };
      params.Item.cdt = cdt;
      params.Item.mdt = currentDate;
    }
    if (isHf) {
      params.Item.cdt = currentDate;
      params.Item.mdt = currentDate;
    }
    console.log(`params: ${JSON.stringify(params)}`);
    return postResources(params);
  }

  return failure({
    status: false,
    error: { msg: "Validation failed", field: retVal },
  });
};
const updateActivity = async (data) => {
  console.log(`Update Activity Data: ${JSON.stringify(data)}`);
  const {
    id = "",
    rel_id: relId = "",
    sub = "",
    atype = "",
    hb_id: hbid = "",
    dt = 0,
    endDt = 0,
    note = "",
    status = "",
    assi = "",
    cmpby = {},
    subh = "",
    noteh = "",
    crby = ""
  } = data;
  const seq = data.seq >= 0 ? data.seq + 1 : 0;
  const sendMail =
    data.sendMail && data.sendMail.length ? data.sendMail : "true";
  const modDt = Date.now();
  let updateExpression = "";
  let expressionAttrName = {};
  let expressionAttrValues = {};
  let updateActivityResp;
  const scheduleParams = {
    hbId: hbid, relId, scheduleTime: "", activityUUID: id
  }
  if (atype === "appointment") {
    const wit = data.wit ? data.wit : "";
    const loc = data.loc ? data.loc : "";
    const dur = data.dur ? data.dur : "";
    const oldinte = data.cc || [];
    const newinte = data.bcc || [];
    updateExpression = `set #sub = :sub, #dur = :dur, #dt = :dt, #wit = :wit, #loc = :loc, #note = :note, #status = :status, #seq = :seq, mdt = :modDate, #oldinte = :oldinte, #newinte = :newinte`;
    expressionAttrName = {
      "#sub": "sub",
      "#dur": "dur",
      "#dt": "dt",
      "#wit": "wit",
      "#loc": "loc",
      "#note": "note",
      "#status": "status",
      "#seq": "seq",
      "#oldinte": "oldinte",
      "#newinte": "newinte"
    };
    expressionAttrValues = {
      ":sub": sub,
      ":dur": dur,
      ":dt": dt,
      ":wit": wit,
      ":loc": loc,
      ":note": note,
      ":status": status,
      ":seq": seq,
      ":modDate": modDt,
      ":oldinte": oldinte,
      ":newinte": newinte,
    };
  } else if (atype === "note" || atype === "mail") {
    updateExpression = `set #sub = :sub, #note = :note, #dt = :dt, mdt = :modDate, newst = :subh, oldst = :noteh, crby = :crby`;
    expressionAttrName = {
      "#sub": "sub",
      "#note": "note",
      "#dt": "dt",
    };
    expressionAttrValues = {
      ":sub": sub,
      ":note": note,
      ":dt": dt,
      ":modDate": modDt,
      ":subh": subh,
      ":noteh": noteh,
      ":crby": crby
    };
  } else if (atype === "call") {
    const dur = data.dur ? data.dur : "";
    updateExpression = `set #sub = :sub, #dt = :dt, #dur = :dur, #note = :note, mdt = :modDate`;
    expressionAttrName = {
      "#sub": "sub",
      "#dt": "dt",
      "#dur": "dur",
      "#note": "note",
    };
    expressionAttrValues = {
      ":sub": sub,
      ":dt": dt,
      ":dur": dur,
      ":note": note,
      ":modDate": modDt,
    };
    
  } else if (atype === "task") {
    updateExpression = `set #sub = :sub, #dt = :dt, #endDt = :endDt, #assi = :assi, #note = :note, #status = :status, mdt = :modDate, #cmpby = :cmpby`;
    expressionAttrName = {
      "#sub": "sub",
      "#dt": "dt",
      "#endDt": "endDt",
      "#assi": "assi",
      "#note": "note",
      "#status": "status",
      "#cmpby": "cmpby",
    };
    expressionAttrValues = {
      ":sub": sub,
      ":dt": dt,
      ":endDt": endDt,
      ":assi": assi,
      ":note": note,
      ":modDate": modDt,
      ":status": status,
      ":cmpby": cmpby,
    };
  }
  if (["appointment", "call"].includes(atype)) {
    scheduleParams.scheduleTime = moment(dt).add(data.dur, "minutes");
  }
  if (atype === "mail") {
    scheduleParams.scheduleTime = dt;
  }
  const params = {
    TableName: process.env.entitiesTableName,
    Key: {
      id: relId,
      entity: `activity#${hbid}#${atype}#${id}`,
    },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: expressionAttrName,
    ExpressionAttributeValues: expressionAttrValues,
  };
  console.log(params);
  if (atype === "appointment" && sendMail === "true") {
    try {
      const {
        userName,
        userEmail,
        fromName,
        fromEmail,
        customerName,
        customerEmail,
        communityName,
      } = data.appointmentEmailData;

      const transporter = nodemailer.createTransport({ SES: { ses, aws } });

      const constIcalMethod = "request";

      const cal = ical({
        scale: "gregorian",
        method: constIcalMethod,
        // ttl: (60 * 60 * 24),
        prodId: {
          company: "Hyphen Solutions",
          product: "CRM",
          language: "EN",
        },
      });

      const eventStartTime = moment(data.dt);

      const eventEndTime = moment(data.dt).add(data.dur, "minutes");

      console.log(
        `eventStartTime : ${JSON.stringify(eventStartTime.toString())}`
      );

      console.log(`eventEndTime : ${JSON.stringify(eventEndTime.toString())}`);

      console.log(`moment dt : ${JSON.stringify(moment(data.dt).toString())}`);

      console.log(`moment : ${JSON.stringify(moment().toString())}`);

      const event = cal.createEvent({
        uid: id,
        sequence: seq,
        name: "Builder Meeting",
        status: "confirmed",
        busystatus: "busy",
        start: eventStartTime,
        end: eventEndTime,
        timestamp: moment(),
        summary: data.sub,
        description: data.sub,
        location: communityName,
        organizer: {
          name: userName,
          email: userEmail,
          mailto: userEmail,
        },
      });

      event.createAttendee({
        email: userEmail,
        name: userName,
        mailto: userEmail,
      });
      event.createAttendee({
        email: customerEmail,
        name: customerName,
        mailto: customerEmail,
      });
      if (data.cc?.length) {
        data.cc.forEach(cc => {
          event.createAttendee({
            email: cc,
            name: customerName,
            mailto: cc
          });
        })
      }
      if (data.bcc?.length) {
        data.bcc.forEach(bcc => {
          event.createAttendee({
            email: bcc,
            name: customerName,
            mailto: bcc
          });
        })
      }
      event.createCategory({ name: "Builder Meeting" });

      const icalString = cal.toString();

      console.log(`icalString : ${JSON.stringify(icalString)}`);

      console.log(`id : ${JSON.stringify(id)}`);

      const transporterRes = await transporter.sendMail({
        from: {
          name: fromName,
          address: fromEmail,
        },
        to: customerEmail,
        cc: data.cc?.length ? [...data.cc, userEmail].join(',') : userEmail,
        bcc: data.bcc?.length ? data.bcc.join(',') : '',
        replyTo: userEmail,
        subject: data.sub,
        html: data.note,
        icalEvent: {
          filename: "invitation.ics",
          method: constIcalMethod,
          content: icalString,
        },
      });
      console.log(`transporterRes : ${JSON.stringify(transporterRes)}`);
      if (transporterRes && transporterRes.messageId) {
        updateActivityResp = await updateResources(params);
      } else {
        return failure({ status: false, error: transporterRes });
      }
    } catch (error) {
      console.log(`transporter error : ${JSON.stringify(error.stack)}`);
      return failure({ status: false, error: error.stack });
    }
  } else {
    console.log("atype === 'appointment' else: ");
    updateActivityResp = await updateResources(params);
  }

  if (atype !== 'note' && atype !== 'task') {
    try {
      // Delete existing rules in event bridge
      const deleteParams = {
        ruleName: `LastContact-${id}`,
        targetId: `${LAST_CONTACT_ID}`
      }
      const deleteResp = await deleteSchedule(deleteParams);
      console.log(`deleteResp :: `, deleteResp);
    } catch (error) {
      console.log(`deleletlc params catch error :: `, error);
    }
    
    const mgmtLcParams = {
      atype,
      relId,
      hbId: hbid,
      dt: scheduleParams.scheduleTime
    }
  
    // Now Re-create the rules if required.
    await manageLastContact(mgmtLcParams, scheduleParams, status);
  }

  if (STACK_PREFIX.includes("aws-crm") || STACK_PREFIX.includes("crm-test")) {
    const publishCustomerDataResponse = await publishEntityData({
      entityId: id,
      entityType: "activity",
      isBrix: false,
      isCreate: false,
      isHomefront: true,
      messageId: uuidv4(),
      HomebuilderID: hbid,
    });
    console.log("publishCustomerDataResponse: ", publishCustomerDataResponse);
  }
  console.log(`updateActivityResp: ${JSON.stringify(updateActivityResp)}`);
  return updateActivityResp;
};
const deleteActivity = async (data) => {
  const {
    id = "",
    hb_id: hbid = "",
    atype = "",
    rel_id: relId = "",
    isSns = false,
  } = data;
  // Get the activity details JSON for sending message to Homefront
  // Also get the cusotmer details associated with the activity
  let hfhbid;
  let hfid;
  let OpportunityID;
  let OpportunityIDHyphen;
  if (!isSns) {
    const entityGetParams = getHydrationParamsForQuery(
      id,
      `activity#${hbid}`,
      true,
      true
    );
    const entityDetail = await getResourceJSON(entityGetParams);
    console.log(`entityDetail: ${JSON.stringify(entityDetail)}`);
    if (entityDetail && entityDetail.length) {
      hfhbid = entityDetail[0]?.hfhbid ?? "";
      hfid = entityDetail[0]?.hfid ?? "";
      console.log(`hfhbid: ${hfhbid}`);
      console.log(`hfid: ${hfid}`);
    }
    // Get the customer details
    const customerGetParams = getHydrationParamsForQuery(
      relId,
      `customer#${hbid}`,
      false,
      true
    );
    const customerDetail = await getResourceJSON(customerGetParams);
    console.log(`customerDetail: ${JSON.stringify(customerDetail)}`);
    if (customerDetail && customerDetail.length) {
      OpportunityID = customerDetail[0]?.hfid ?? "";
      OpportunityIDHyphen = customerDetail[0]?.id ?? "";
      console.log(`OpportunityID: ${OpportunityID}`);
      console.log(`OpportunityIDHyphen: ${OpportunityIDHyphen}`);
    }
  }
  const params = {
    TableName: process.env.entitiesTableName,
    Key: {
      id: relId,
      entity: `activity#${hbid}#${atype}#${id}`,
    },
  };
  console.log(params);
  const deleteActivityResp = await deleteResources(params);
  console.log(`deleteActivityResp: ${JSON.stringify(deleteActivityResp)}`);
  // Do a homefront publish if this call is not originated from messaging (isSns)
  if (
    !isSns &&
    (STACK_PREFIX.includes("aws-crm") || STACK_PREFIX.includes("crm-test"))
  ) {
    // Homefront message
    const publishEntityDataHfResp = await publishEntityData({
      entityId: id,
      entityType: "activity",
      isBrix: false,
      isCreate: false,
      isHomefront: true,
      isDelete: true,
      messageId: uuidv4(),
      HomebuilderID_HF: hfhbid,
      Id: hfid,
      OpportunityID,
      OpportunityID_Hyphen: OpportunityIDHyphen,
      HomebuilderID: hbid,
    });
    console.log("publishEntityDataHfResp: ", publishEntityDataHfResp);
  }
  return deleteActivityResp;
};
const getParentDetails = async ({ parentIdList, hbId }) => {
  let entityRes = [];
  let uniqueParentDetails;
  try {
    // Get the parent details of the task
    const entityGetParams = {
      TableName: process.env.entitiesTableName,
      KeyConditionExpression: "#id = :id and #entity = :entity",
      ExpressionAttributeNames: {
        "#id": "id",
        "#entity": "entity",
        "#type": "type",
        "#data": "data",
      },
      ExpressionAttributeValues: {
        ":id": "",
        ":entity": "",
      },
      ProjectionExpression:
        "id, fname, lname, stage, #type, #data, entity, email",
    };
    for (const entityId of parentIdList) {
      const queryList = [];
      entityGetParams.ExpressionAttributeValues[":id"] = entityId;
      entityGetParams.ExpressionAttributeValues[":entity"] = `customer#${hbId}`;
      console.log(
        `entityGetParams customer: ${JSON.stringify(entityGetParams)}`
      );
      queryList.push(getQueryPromise({ ...entityGetParams }));
      entityGetParams.ExpressionAttributeValues[":entity"] = `realtor#${hbId}`;
      console.log(
        `entityGetParams realtor: ${JSON.stringify(entityGetParams)}`
      );
      queryList.push(getQueryPromise({ ...entityGetParams }));
      const cobuyerGetParams = getHydrationParamsForQuery(
        entityId,
        "cobuyer",
        true
      );
      cobuyerGetParams.ExpressionAttributeNames["#type"] = "type";
      cobuyerGetParams.ExpressionAttributeNames["#data"] = "data";
      cobuyerGetParams.ProjectionExpression =
        "id, fname, lname, stage, #type, #data, entity, email";
      console.log(
        `entityGetParams cobuyer: ${JSON.stringify(cobuyerGetParams)}`
      );
      queryList.push(getQueryPromise({ ...cobuyerGetParams }));
      // Initiate the queries
      try {
        const entityResp = await Promise.all(queryList);
        console.log(`entityResp: ${JSON.stringify(entityResp)}`);
        if (entityResp?.length) {
          for (const resp of entityResp) {
            entityRes.push(...resp?.Items);
          }
        }
      } catch (error) {
        console.log(`error in Promise.all entity`);
        console.log(error);
        entityRes = [];
      }
    }
    console.log(`entityRes: ${JSON.stringify(entityRes)}`);
    // Remove duplicate entries from entityRes
    uniqueParentDetails = entityRes.filter((detail) => {
      const idExists = parentIdList.includes(detail.id);
      const dataExists = detail.type === "cobuyer" && parentIdList.includes(detail.data);
      const idMatch = idExists || dataExists;
      return !!detail.type && idMatch;
    });
    // uniqueParentDetails = entityRes.filter((detail, index, uniqueDetails) => {
    //   const uniqueIndex = uniqueDetails.findIndex(
    //     (uniqueDetail) =>
    //       uniqueDetail.id === detail.id && uniqueDetail.type === detail.type
    //   );
    //   const idExists = parentIdList.includes(detail.id);
    //   const dataExists =
    //     detail.type === "cobuyer" && parentIdList.includes(detail.data);
    //   const indexMatch = uniqueIndex === index;
    //   const idMatch = idExists || dataExists;
    //   return indexMatch && idMatch;
    // });
    console.log(`uniqueParentDetails: ${JSON.stringify(uniqueParentDetails)}`);
  } catch (error) {
    console.log(`Exception occured at getParentDetails`);
    console.log(error);
  }
  return uniqueParentDetails;
};
const loadTodoListAPICall = async (data) => {
  try {
    const {
      size = 40,
      sort = "dt:asc",
      from = 0,
      addRange = true,
      userId = "",
      duration = 90,
      startData,
      type = ["appointment", "task"],
      hb_id: hbId = "",
      statusCheck = true,
    } = data;

    if (userId && userId.length && hbId && hbId.length) {
      const typeConditionList = type.map((typeItem) => ({
        match: { atype: typeItem },
      }));

      const mustConditions = [
        {
          bool: {
            should: [{ match: { wit: userId } }, { match: { assi: userId } }],
          },
        },
        {
          bool: {
            should: typeConditionList,
          },
        },
        { match: { type: "activity" } },
        {
          match_phrase_prefix: {
            entity: `activity#${hbId}`,
          },
        },
      ];
      if (statusCheck) {
        mustConditions.push({
          bool: {
            must_not: [{ match: { status: "COMPLETE" } }],
          },
        });
      }
      if (addRange) {
        const endDateTime =
          startData && startData.length ? new Date(startData) : new Date();
        const endDateTimeUnix = endDateTime.getTime();
        endDateTime.setDate(endDateTime.getDate() - duration);
        const startDateTimeUnix = endDateTime.getTime();

        mustConditions.push({
          range: {
            dt: {
              gte: startDateTimeUnix,
              lte: endDateTimeUnix,
            },
          },
        });
      }

      const taskListQuery = {
        httpMethod: "POST",
        requestPath: `/_search?from=${from}&size=${size}&sort=${sort}`,
        payload: {
          query: {
            bool: {
              must: mustConditions,
            },
          },
        },
      };
      // eslint-disable-next-line
      console.log(`taskListQuery: ${JSON.stringify(taskListQuery)}`);
      const taskListResp = await elasticExecuteQuery(taskListQuery);
      console.log(`taskListResp: ${JSON.stringify(taskListResp)}`);
      const taskListBody = JSON.parse(
        taskListResp.body ? taskListResp.body : {}
      );
      console.log(`taskListBody: ${JSON.stringify(taskListBody)}`);
      const taskTotalResult = taskListBody?.body?.hits?.total || 0;
      console.log(`taskTotalResult: ${taskTotalResult}`);
      let taskListResult =
        taskListBody?.statusCode === 200
          ? taskListBody?.body?.hits?.hits?.map((task) => task?._source)
          : [];
      console.log(`taskListResult: ${JSON.stringify(taskListResult)}`);
      if (taskListResult?.length) {
        const parentIdList = [
          ...new Set(taskListResult.map((task) => task?.id)),
        ];
        console.log(`parentIdList: ${JSON.stringify(parentIdList)}`);

        // Get task parent details
        const uniqueParentDetails = await getParentDetails({
          parentIdList,
          hbId,
        });
        // Merge the task list with parent details
        taskListResult = taskListResult.map((task) => {
          console.log(`task: ${JSON.stringify(task)}`);
          const parentDetail = uniqueParentDetails.filter(
            (entityDetail) =>
              task.id === entityDetail.id || task.id === entityDetail.data
          );
          console.log(`parentDetail: ${JSON.stringify(parentDetail)}`);
          // If there are more than one items in the parentDetail array, it should be the customer and their cobuyers.
          // In this case customer resource should be selected since the cobuyer id in the task will be in the data field of the cobuyer resource.
          if (parentDetail.length > 1) {
            for (const detail of parentDetail) {
              if (detail.id === task.id && detail.type === "customer") {
                task.parentDetail = detail;
                break;
              }
            }
          } else[task.parentDetail] = parentDetail;
          console.log(`task after merge: ${JSON.stringify(task)}`);
          return task;
        });
        console.log(
          `taskListResult after merging: ${JSON.stringify(taskListResult)}`
        );
      }

      return success({
        status: true,
        data: { result: taskListResult, total: taskTotalResult },
      });
    }
    // return failure({ status: false, error: 'User Id Not Found' });
    return failure({ status: false, error: "User Id Not Found" });
  } catch (error) {
    // return failure({ status: false, error });
    return failure({ status: false, error });
  }
};
const getStageCount = async (data) => {
  console.log(`data: ${JSON.stringify(data)}`);
  let stageCountObj = {};
  const {
    hb_id: hbid = "",
    from: gte = 0,
    to: lte = 0,
    stage = ["Lead", "Prospect", "Buyer", "Bust_Out", "Closed", "Dead_Lead"],
    userId = "",
  } = data;
  const statusConditionList = stage.map((stageItem) => ({
    match: { newst: stageItem },
  }));
  let stageChangeActivityList;
  try {
    const stageChangeActivityListQuery = {
      httpMethod: "POST",
      requestPath: "/_search",
      payload: {
        query: {
          bool: {
            must: [
              {
                bool: {
                  should: [...statusConditionList],
                },
              },
              {
                match: {
                  "atype.keyword": "stage_change",
                },
              },
              {
                match: {
                  "hb_id.keyword": hbid,
                },
              },
            ],
          },
        },
        size: 0,
        aggs: {
          newstage: {
            terms: {
              field: "newst.keyword",
            },
          },
        },
      },
    };
    if (userId) {
      // adding agent filter
      stageChangeActivityListQuery.payload.query.bool.must.push({
        match: {
          "userid.keyword": userId,
        },
      });
    }
    if (gte && lte) {
      // Adding a date range
      stageChangeActivityListQuery.payload.query.bool.must.push({
        range: {
          dt: {
            gte,
            lte,
          },
        },
      });
      console.log(
        `stageChangeActivityListQuery: ${JSON.stringify(
          stageChangeActivityListQuery
        )}`
      );
    }
    stageChangeActivityList = await elasticExecuteQuery(
      stageChangeActivityListQuery
    );
    console.log(
      `stageChangeActivityList: ${JSON.stringify(stageChangeActivityList)}`
    );
    const stageCountsBody = JSON.parse(
      stageChangeActivityList.body ? stageChangeActivityList.body : {}
    );
    console.log(`stageCountsBody: ${JSON.stringify(stageCountsBody)}`);
    const stageCounts =
      stageCountsBody?.body?.aggregations?.newstage?.buckets ?? [];
    stageCountObj = stageCounts.reduce((obj, currentStageCount) => {
      if (currentStageCount?.key === "Buyer")
        obj.contracts = currentStageCount?.doc_count;
      else if (currentStageCount?.key === "Closed")
        obj.closings = currentStageCount?.doc_count;
      else obj[currentStageCount?.key] = currentStageCount?.doc_count;
      return obj;
    }, {});
    console.log(`stageCountObj: ${JSON.stringify(stageCountObj)}`);
  } catch (error) {
    console.log("Exception occured: ");
    console.log(error);
    return failure({ status: false, error });
  }
  return success({ status: true, data: { ...stageCountObj } });
};
const getTaskCount = async (data) => {
  console.log(`data: ${JSON.stringify(data)}`);
  const {
    hb_id: hbid = "",
    userId: assignedTo = "",
    from: gte = 0,
    to: lte = 0,
  } = data;
  let taskListCountObj = {};
  try {
    const taskListQuery = {
      httpMethod: "POST",
      requestPath: "/_search",
      payload: {
        query: {
          bool: {
            must: [
              {
                match: {
                  "atype.keyword": "task",
                },
              },
              {
                match: {
                  "hb_id.keyword": hbid,
                },
              },
            ],
          },
        },
        size: 0,
        aggs: {
          task_status: {
            terms: {
              field: "status.keyword",
            },
          },
        },
      },
    };
    if (assignedTo) {
      // adding agent filter
      taskListQuery.payload.query.bool.must.push({
        match: {
          "assi.keyword": assignedTo,
        },
      });
    }
    if (gte && lte) {
      // Adding a date range
      taskListQuery.payload.query.bool.must.push({
        range: {
          dt: {
            gte,
            lte,
          },
        },
      });
    }
    console.log(`taskListQuery: ${JSON.stringify(taskListQuery)}`);
    const taskListResp = await elasticExecuteQuery(taskListQuery);
    console.log(`taskListResp: ${JSON.stringify(taskListResp)}`);
    const taskListBody = JSON.parse(taskListResp.body ? taskListResp.body : {});
    console.log(`taskListBody: ${JSON.stringify(taskListBody)}`);
    const taskListResult =
      taskListBody?.body?.aggregations?.task_status?.buckets ?? [];
    taskListCountObj = taskListResult.reduce((obj, currenttaskCount) => {
      obj[currenttaskCount?.key || "PENDING"] =
        currenttaskCount?.doc_count || 0;
      return obj;
    }, {});
    console.log(`taskListCountObj: ${JSON.stringify(taskListCountObj)}`);
    console.log(`taskListResult: ${JSON.stringify(taskListResult)}`);
  } catch (error) {
    console.log("Exception occured: ");
    console.log(error);
    return failure(error);
  }
  return success({ status: true, data: taskListCountObj });
};

const getCustomerCount = async (data) => {
  let customersCount = 0;
  const { hbId, startTime, endTime, comm } = data;
  if (!startTime || !endTime || !comm.length) return customersCount;
  const params = {
    httpMethod: "POST",
    requestPath: `/_count`,
    payload: {
      query: {
        bool: {
          must: [
            {
              match: {
                "entity.keyword": `customer#${hbId}`,
              },
            },
            { match: { "hb_id.keyword": hbId } },
            {
              terms: {
                "inte.keyword": comm,
              },
            },
            {
              range: {
                cdt: {
                  gte: startTime,
                  lte: endTime,
                },
              },
            },
          ],
        },
      },
    },
  };
  try {
    const customerCount = await elasticExecuteQuery(params, true);
    customersCount = customerCount?.body?.count || 0;
  } catch (error) {
    console.log("error in getCustomerCount", error);
  }
  return customersCount;
};

const getRealtorCount = async (data) => {
  let realtorCount = 0;
  const { hbId, startTime, endTime, comm, metroIds } = data;
  if (!startTime || !endTime || !comm.length) return realtorCount;
  // let agencyIdArr = [];
  const agencyObj = { status: false, query: {} };
  if (metroIds?.length) {
    const metroIdArr = [...new Set(metroIds)].map((metroId) => ({
      match: {
        "m_id.keyword": metroId,
      },
    }));
    const agencyListQuery = {
      httpMethod: "POST",
      requestPath: "/_search",
      payload: {
        query: {
          bool: {
            must: [
              {
                bool: {
                  should: metroIdArr,
                },
              },
              {
                match: {
                  "entity.keyword": `agency#${hbId}`,
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
        size: 5000,
      },
    };
    console.log(`agencyListQuery: ${JSON.stringify(agencyListQuery)}`);
    const metroAgencyResp = await elasticExecuteQuery(agencyListQuery);
    console.log(`metroAgencyResp: ${JSON.stringify(metroAgencyResp)}`);
    const metroAgencyBody = metroAgencyResp.body
      ? JSON.parse(metroAgencyResp.body)
      : {};
    console.log(`metroAgencyBody: ${JSON.stringify(metroAgencyBody)}`);
    const agencyArr =
      metroAgencyBody?.body?.hits?.hits?.map((agency) => agency?._source) ?? [];
    console.log(`agencyArr: ${JSON.stringify(agencyArr)}`);
    const agencyIds = agencyArr?.map((agency) => agency?.id ?? "");
    console.log(`agencyIds: ${JSON.stringify(agencyIds)}`);
    if (agencyIds?.length) {
      // Agency realtor query
      // agencyIdArr = [...new Set(agencyIds)].map((agencyId) => ({
      //   match: {
      //     "rel_id.keyword": agencyId,
      //   },
      // }));
      agencyObj.status = true;
      agencyObj.query = {
        terms: {
          "rel_id.keyword": [...new Set(agencyIds)],
        },
      };
    }
  }
  const realtorListQuery = {
    httpMethod: "POST",
    requestPath: "/_count",
    payload: {
      query: {
        bool: {
          must: [
            {
              match: {
                "entity.keyword": `realtor#${hbId}`,
              },
            },
            {
              match: {
                "hb_id.keyword": hbId,
              },
            },
            {
              range: {
                cdt: {
                  gte: startTime,
                  lte: endTime,
                },
              },
            },
          ],
        },
      },
    },
  };
  // Add agency id filtering for the list query if exists
  // if (agencyIdArr?.length) {
  //   realtorListQuery.payload.query.bool.must.push({
  //     bool: {
  //       should: agencyIdArr,
  //     },
  //   });
  // } else if (metroIds?.length && agencyIdArr?.length === 0) {
  //   return realtorCount;
  // }
  if (agencyObj.status) {
    realtorListQuery.payload.query.bool.must.push(agencyObj.query);
  } else if (metroIds?.length && !agencyObj.status) {
    return realtorCount;
  }

  try {
    const realtorsCount = await elasticExecuteQuery(realtorListQuery, true);
    realtorCount = realtorsCount?.body?.count || 0;
  } catch (error) {
    console.log("error in getRealtorCount", error);
  }
  return realtorCount;
};

const last7 = async (data) => {
  try {
    const {
      type = ["customer", "realtor"],
      atype = ["appointment", "task"],
      hb_id: hbId,
      addRange = true,
      startTime = null,
      endTime = null,
      userId = "",
      comm = [],
      m_id: metroIds = [],
      utype,
    } = data;
    let customerCount = 0;
    let realtorCount = 0;
    const aggrs =
      utype !== "admin" && utype !== "online_agent"
        ? ["atype"]
        : ["type", "atype"];

    if (hbId && hbId.length) {
      let typeConditionList = [];
      if (utype !== "admin" && utype !== "online_agent") {
        customerCount = await getCustomerCount({
          hbId,
          startTime,
          endTime,
          comm,
        });
        realtorCount = await getRealtorCount({
          hbId,
          startTime,
          endTime,
          comm,
          metroIds,
        });
      } else {
        typeConditionList = type.map((typeItem) => {
          const obj = {
            bool: {
              must: [
                { match: { type: typeItem } },
                { match: { "entity.keyword": `${typeItem}#${hbId}` } },
              ],
            },
          };
          // if (userId)
          //   obj.bool.must.push({
          //     match: {
          //       "crby.keyword": userId,
          //     },
          //   });
          return obj;
        });
      }

      const atypeConditionList = atype.map((atypeItem) => ({
        bool: {
          must: [
            { match: { atype: atypeItem } },
            {
              match_phrase_prefix: {
                entity: `activity#${hbId}`,
              },
            },
          ],
        },
      }));
      const useridConditionList = [];
      if (userId) {
        useridConditionList.push({ match: { wit: userId } });
        useridConditionList.push({ match: { assi: userId } });
      }
      const mustConditions = [
        {
          bool: {
            should: [
              ...typeConditionList,
              ...atypeConditionList,
              ...useridConditionList,
            ],
          },
        },
      ];

      if (addRange && startTime && endTime) {
        mustConditions.push({
          range: {
            cdt: {
              gte: startTime,
              lte: endTime,
            },
          },
        });
      }

      const params = {
        httpMethod: "POST",
        requestPath: `/_search`,
        payload: {
          query: {
            bool: {
              must: mustConditions,
            },
          },
          aggs: {},
        },
      };
      aggrs.forEach((aggrsItem) => {
        params.payload.aggs[`${aggrsItem}_counts`] = {
          terms: { field: `${aggrsItem}.keyword` },
        };
      });
      // eslint-disable-next-line
      console.log(`params: ${JSON.stringify(params)}`);
      const searchResult = await sendRequest(params).then((result) => {
        if (result && result.body && result.body.aggregations) {
          if (utype !== "admin" && utype !== "online_agent") {
            result.body.aggregations.type_counts = {
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
              buckets: [
                {
                  key: "realtor",
                  doc_count: realtorCount,
                },
                {
                  key: "customer",
                  doc_count: customerCount,
                },
              ],
            };
          }
          return success({ status: true, data: result.body.aggregations });
        }
        return failure({ status: false, error: result });
      });
      console.log(`searchResult: ${JSON.stringify(searchResult)}`);
      return searchResult;
    }
    // return failure({ status: false, error: 'User Id Not Found' });
    return failure({ status: false, error: "Home Builder Id Not Found" });
  } catch (error) {
    // return failure({ status: false, error });
    return failure({ status: false, error: error.stack });
  }
};

const stageCount = async (data) => {
  console.log(`In stageCount`);
  try {
    const {
      stage = ["Lead", "Prospect", "Buyer", "Bust_Out", "Closed", "Dead_Lead"],
      hb_id: hbId,
      addRange = false,
      startTime = null,
      endTime = null,
      aggrs = ["stage"],
      // eslint-disable-next-line no-unused-vars
      userId = "",
      utype,
      comm = [],
    } = data;

    if (hbId && hbId.length) {
      const statusConditionList = stage.map((stageItem) => ({
        match: { stage: stageItem },
      }));

      const mustConditions = [
        { bool: { should: [...statusConditionList] } },
        {
          match: {
            "entity.keyword": `customer#${hbId}`,
          },
        },
        { match: { "hb_id.keyword": hbId } },
      ];
      // if (userId) {
      //   // adding agent filter
      //   mustConditions.push({
      //     match: {
      //       "crby.keyword": userId,
      //     },
      //   });
      // }
      // Add community filter
      if (utype !== "admin" && utype !== "online_agent") {
        mustConditions.push({
          terms: {
            "inte.keyword": comm,
          },
        });
      }
      if (addRange && startTime && endTime) {
        mustConditions.push({
          range: {
            cdt: {
              gte: startTime,
              lte: endTime,
            },
          },
        });
      }

      const params = {
        httpMethod: "POST",
        requestPath: `/_search`,
        payload: {
          query: {
            bool: {
              must: mustConditions,
            },
          },
          aggs: {},
          size: 0,
        },
      };
      aggrs.forEach((aggrsItem) => {
        params.payload.aggs[`${aggrsItem}_counts`] = {
          terms: { field: `${aggrsItem}.keyword` },
        };
      });
      // eslint-disable-next-line
      console.log(`params: ${JSON.stringify(params)}`);
      const searchResultResp = await elasticExecuteQuery(params);
      console.log(`searchResultResp: ${JSON.stringify(searchResultResp)}`);
      const searchResultBody = JSON.parse(
        searchResultResp.body ? searchResultResp.body : {}
      );
      console.log(`searchResultBody: ${JSON.stringify(searchResultBody)}`);
      const searchResult = searchResultBody?.body?.aggregations;
      console.log(`searchResult: ${JSON.stringify(searchResult)}`);
      if (searchResult) {
        console.log(`In searchResult then if`);
        console.log(`searchResult: ${JSON.stringify(searchResult)}`);
        console.log(`Before send success`);
        return success({ status: true, data: searchResult });
      }
      console.log(`Before send failure`);
      return failure({ status: false, error: `Failed to fetch stage count` });
    }
    // return failure({ status: false, error: 'User Id Not Found' });
    return failure({ status: false, error: "Home Builder Id Not Found" });
  } catch (error) {
    // return failure({ status: false, error });
    return failure({ status: false, error: error.stack });
  }
};

const daywise = async (data) => {
  try {
    const {
      atype = ["appointment"],
      hb_id: hbId,
      addRange = true,
      startTime = null,
      endTime = null,
      userId = null,
    } = data;

    if (userId && userId.length && hbId && hbId.length) {
      const atypeConditionList = atype.map((atypeItem) => ({
        bool: {
          should: [{ match: { atype: atypeItem } }],
        },
      }));
      const useridConditionList = [];
      if (userId) {
        useridConditionList.push({
          bool: {
            should: [{ match: { wit: userId } }, { match: { assi: userId } }],
          },
        });
      }
      const mustConditions = [
        ...useridConditionList,
        ...atypeConditionList,
        {
          match_phrase_prefix: {
            entity: `activity#${hbId}`,
          },
        },
      ];

      if (addRange && startTime && endTime) {
        mustConditions.push({
          range: {
            dt: {
              gte: startTime,
              lte: endTime,
            },
          },
        });
      }

      const appointmentListQuery = {
        httpMethod: "POST",
        requestPath: `/_search`,
        payload: {
          query: {
            bool: {
              must: mustConditions,
            },
          },
        },
      };
      // eslint-disable-next-line
      console.log(
        `appointmentListQuery: ${JSON.stringify(appointmentListQuery)}`
      );
      const appointmentListResp = await elasticExecuteQuery(
        appointmentListQuery
      );
      console.log(
        `appointmentListResp: ${JSON.stringify(appointmentListResp)}`
      );
      const appointmentListBody = JSON.parse(
        appointmentListResp.body ? appointmentListResp.body : {}
      );
      console.log(
        `appointmentListBody: ${JSON.stringify(appointmentListBody)}`
      );
      const appointmentTotalResult =
        appointmentListBody?.body?.hits?.total || 0;
      console.log(`appointmentTotalResult: ${appointmentTotalResult}`);
      let appointmentListResult = appointmentListBody?.body?.hits?.hits?.map(
        (appointment) => appointment?._source
      );
      console.log(
        `appointmentListResult: ${JSON.stringify(appointmentListResult)}`
      );
      const parentIdList = [
        ...new Set(appointmentListResult.map((appointment) => appointment?.id)),
      ];
      console.log(`parentIdList: ${JSON.stringify(parentIdList)}`);

      // Get appointment parent details
      const uniqueParentDetails = await getParentDetails({
        parentIdList,
        hbId,
      });

      // Merge the appointment list with parent details
      appointmentListResult = appointmentListResult.map((appointment) => {
        console.log(`appointment: ${JSON.stringify(appointment)}`);
        const parentDetail = uniqueParentDetails.filter(
          (entityDetail) =>
            appointment.id === entityDetail.id ||
            appointment.id === entityDetail.data
        );
        console.log(`parentDetail: ${JSON.stringify(parentDetail)}`);
        // If there are more than one items in the parentDetail array, it should be the customer and their cobuyers.
        // In this case customer resource should be selected since the cobuyer id in the appointment will be in the data field of the cobuyer resource.
        if (parentDetail.length > 1) {
          for (const detail of parentDetail) {
            if (detail.id === appointment.id && (detail.type === "customer" || detail.type === "realtor")) {
              appointment.parentDetail = detail;
              break;
            }
            if (detail.data === appointment.id && detail.type === "cobuyer") {
              appointment.parentDetail = detail;
              break;
            }
          }
        } else[appointment.parentDetail] = parentDetail;
        console.log(`appointment after merge: ${JSON.stringify(appointment)}`);
        return appointment;
      });
      console.log(
        `appointmentListResult after merging: ${JSON.stringify(
          appointmentListResult
        )}`
      );
      return success({
        status: true,
        data: { result: appointmentListResult, total: appointmentTotalResult },
      });
    }
    // return failure({ status: false, error: 'User Id Not Found' });
    return failure({ status: false, error: "Home Builder/User Id Not Found" });
  } catch (error) {
    // return failure({ status: false, error });
    return failure({ status: false, error: error.stack });
  }
};

export const createNoteActivity = async (data) => {
  let response;
  const {
    comments,
    note,
    subject,
    customerUUID,
    hb_id: hbId,
    isLeadAPI,
    isZillow,
  } = data;
  console.log(`comments: ${JSON.stringify(comments)}`);
  console.log(`note: ${note}`);
  console.log(`subject: ${subject}`);
  console.log(`customerUUID: ${customerUUID}`);
  console.log(`hbId: ${hbId}`);
  console.log(`isLeadAPI: ${isLeadAPI}`);
  console.log(`isZillow: ${isZillow}`);
  try {
    if (comments && comments.length) {
      if (note) {
        const activityReqObj = {
          rel_id: customerUUID,
          hb_id: hbId,
          acti: {
            sub: subject || "",
            dt: Date.now(),
            atype: "note",
          },
        };
        if (isZillow) {
          activityReqObj.acti.note = Array.isArray(comments)
            ? comments[0]
            : comments;
          activityReqObj.isZillow = true;
        } else if (isLeadAPI) {
          activityReqObj.acti.note = comments;
          activityReqObj.isLeadAPI = true;
        }
        console.log(`activityReqObj: ${JSON.stringify(activityReqObj)}`);
        response = await createActivity(activityReqObj);
        console.log(`response: ${JSON.stringify(response)}`);
      }
    }
  } catch (error) {
    console.log(`note create error: ${JSON.stringify(error.stack)}`);
    response = { status: false, error };
  }
  return { status: true, response };
};
const listActivitiesDB = async ({
  hbId = "",
  ExclusiveStartKey = null,
  Limit = 100,
}) => {
  let activityResponse;
  try {
    const params = {
      TableName: process.env.entitiesTableName,
      FilterExpression:
        "begins_with(#entity, :entity) and #gen_src = :gen_src and attribute_exists(#csch.#st)",
      ExpressionAttributeNames: {
        "#entity": "entity",
        "#gen_src": "gen_src",
        "#csch": "campsch",
        "#st": "StartTime",
      },
      ExpressionAttributeValues: {
        ":entity": `activity#${hbId}#campaign#`,
        ":gen_src": "campaign_analytics",
      },
      ExclusiveStartKey,
      Limit,
    };
    const response = await scanResources(params, true, true);
    console.log("response: ", JSON.stringify(response));
    let hasAfter = false;
    let nextKey = null;
    // If LastEvaluatedKey is empty or not defined then set hasAfter to false
    if (!response.LastEvaluatedKey) {
      hasAfter = false;
    } else {
      hasAfter = true;
      nextKey = response.LastEvaluatedKey;
    }
    activityResponse = {
      hasAfter,
      ExclusiveStartKey: nextKey,
      activities: response.Items,
    };
    console.log(`activityResponse: ${JSON.stringify(activityResponse)}`);
  } catch (error) {
    console.log("Exception occured at listCustomerPagination customer.js");
    console.log(error);
  }
  return activityResponse;
};

const doesCustomerExist = async (customerId, hbId) => {
  const checkCustQuery = {
    httpMethod: "POST",
        requestPath: "/_search",
        payload: {
          query: {
            bool: {
              filter: [
                {
                  match: {
                    "type.keyword": "customer",
                  },
                },
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
                {
                  match: {
                    "id.keyword": customerId,
                  },
                },
              ],
            }
          }
        }
  }
  console.log(`checkCustQuery :: ${JSON.stringify(checkCustQuery)}`);
  const custResp = await elasticExecuteQuery(checkCustQuery, true);
  return !!custResp?.body?.hits?.hits
}

const externalNotesCreate = async (data)=>{
  const {hb_id: hbId, rel_id: customerId, sub, note, email } = data;
  const errors = [];

  // Check whether the hb_id and custoemrId is valid
  const [getBuilderPromise, isValidCustomerPromise] = await Promise.allSettled([
    getBuilderAsync(hbId), doesCustomerExist(customerId, hbId)]);

  console.log(`getBuilderPromise: ${JSON.stringify(getBuilderPromise)}`);
  console.log(`isValidCustomerPromise: ${JSON.stringify(isValidCustomerPromise)}`);

  const getBuilderResp = getBuilderPromise.status === "fulfilled" ? getBuilderPromise.value : null;
  const isValidCustomer = isValidCustomerPromise.status === "fulfilled" ? isValidCustomerPromise.value : null;

  const isValidIds = (getBuilderResp && getBuilderResp.id) && isValidCustomer;
  
  if (isValidIds) {

    try {
      const userQuery = {
        httpMethod: "POST",
        requestPath: "/_search",
        payload: {
          query: {
            bool: {
              filter: [
                    {
                        terms: {
                            "utype.keyword": ["admin", "agent", "online_agent"]
                        }
                    },
                    {
                        term: {
                            "email.keyword": email
                        }
                    }
                ]
            }
          },
          _source: {
            includes: [
                "id", "email", "fname", "lname", "utype", "entity"
            ]
          },
        }
      }
      console.log(`externalNotesCreate :: userQuery :: ${JSON.stringify(userQuery)}`);
      const userResp = await elasticExecuteQuery(userQuery, true);
      console.log(`externalNotesCreate :: user :: ${JSON.stringify(userResp)}`);
      if (userResp?.body?.hits?.hits.length) {
        const user = userResp?.body?.hits?.hits[0]._source;
        const activityParam = {
          hb_id: hbId,
          rel_id: customerId,
          acti: {
            atype: "note",
            sub,
            note,
            dt: Date.now(),
            cmpby: {
              fname: user.fname,
              lname: user.lname,
              utype: user.utype,
              entity: user.entity
            }
          }
        }
        console.log(`activityParam :: ${JSON.stringify(activityParam)}`);
        const actiResp = await createActivity(activityParam);
        console.log(`actiResp :: ${JSON.stringify(actiResp)}`);
        return success([{status: true, statusCode: 201, msg: "Successfully created note", id: JSON.parse(actiResp?.body).item?.id??""}])
      }
      return failure([{status: false, statusCode: 400, error: {msg: `User with email ${email} not found`}}])
    } catch (error) {
      console.log('error in externalNotesCreate :: ', error);
      return failure([{status: false, statusCode: 400, error: {msg: "An error occured in external note create"}}])
    }
  }

  if (getBuilderPromise.status === "rejected") {
    errors.push(getBuilderPromise.reason);
  }
  
  if (isValidCustomerPromise.status === "rejected") {
    errors.push(isValidCustomerPromise.reason);
  }
  return failure([{status: false, statusCode: 400, error: {msg: `${errors.join(', ')}`}}]);
}


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
export async function main(event) {
  let response;
  let data;
  try {
    const action =
      event && event.pathParameters && event.pathParameters.action
        ? event.pathParameters.action
        : 0;
    const isExternalAPI = event && event.path ? event.path.includes("external") : false;
    console.log("Event :: ", event);
    console.log("action :: ", action);
    console.log(`isExternalAPI: ${isExternalAPI}`);
    switch (event.httpMethod) {
      case "GET":
        if (action === "list") {
          response = await listActivities(event);
        } else if (action === "listj") {
          response = await listActivities(event, true);
        } else if (action === "get") {
          response = await getActivity(event);
        } else {
          response = failure();
        }
        break;
      case "POST":
        data = JSON.parse(event.body);
        if (!data) {
          response = failure();
        } else if (action === "create") {
          response = await createActivity(data);
        } else if (action === "update") {
          response = await updateActivity(data);
        } else if (action === "updateRow") {
          response = await updateActivityRow(data);
        } else if (action === "delete") {
          response = await deleteActivity(data);
        } else if (action === "filter") {
          response = await filterActivity(data);
        } else if (action === "todolist") {
          response = await loadTodoListAPICall(data);
        } else if (action === "getstcount") {
          response = await getStageCount(data);
        } else if (action === "gettaskcount") {
          response = await getTaskCount(data);
        } else if (action === "last7") {
          response = await last7(data);
        } else if (action === "daywise") {
          response = await daywise(data);
        } else if (action === "stageCount") {
          response = await stageCount(data);
        } else if (action === "listact") {
          response = await listActivitiesDB(data);
        } else if (isExternalAPI && action === "notes") {
          response = await externalNotesCreate(data);
        } else {
          response = failure();
        }
        break;
      default:
        response = failure();
    }
  } catch (err) {
    console.log(err);
    return failure({ status: false, error: err });
  }
  return response;
}
