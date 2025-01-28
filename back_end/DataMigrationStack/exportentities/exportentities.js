/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import {
  getQueryPromise,
  getRecordByIdAndEntity,
  postResources,
} from "../../FunctionStack/libs/db";
import {
  getApplication,
  getEmailTemplate,
  listCampaigns,
  listJourney,
  listSegments,
  listTemplate,
} from "../../FunctionStack/campaign/campaign";

const CUSTOMER_FILE_STATUS_PROCESSING = "PROCESSING";
const { FILE_MANAGER_BUCKET_NAME } = process.env;
const s3 = new AWS.S3({ apiVersion: "2006-03-01" });
export const uploadImportExportStatusToS3 = async (exportedData, fileKey) => {
  try {
    const leadsJSONParams = {
      Bucket: FILE_MANAGER_BUCKET_NAME,
      Key: `${fileKey}`,
      Body: JSON.stringify(exportedData, null, 4),
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
export const getFileFromS3 = async (fileKey) => {
  const s3Params = {
    Bucket: FILE_MANAGER_BUCKET_NAME,
    Key: fileKey,
  };
  try {
    const getObjectResp = await s3.getObject(s3Params).promise();
    const exportStatus =
      getObjectResp && getObjectResp.Body
        ? JSON.parse(Buffer.from(getObjectResp.Body))
        : [];
    return { status: true, data: exportStatus };
  } catch (error) {
    console.log(`error`);
    console.log(error);
    return { status: false, error };
  }
};
const getPinpointData = async (appid, hbid) => {
  try {
    // Get builder's pinpoint application detials
    let appData = await getApplication({ appid }, true);
    appData =
      appData?.status && appData?.data?.ApplicationResponse
        ? appData.data.ApplicationResponse
        : {};
    console.log(`appData: ${JSON.stringify(appData)}`);

    // Get the segments
    let segmentData = await listSegments({ appid }, true, true);
    segmentData = segmentData?.SegmentsResponse?.Item
      ? segmentData.SegmentsResponse.Item
      : [];
    console.log(`segmentData: ${JSON.stringify(segmentData)}`);

    // Get the campaigns
    let campaignData = await listCampaigns({ appid }, true);
    campaignData =
      campaignData?.status && campaignData?.data?.CampaignsResponse?.Item
        ? campaignData.data.CampaignsResponse.Item
        : [];
    console.log(`campaignData: ${JSON.stringify(campaignData)}`);

    // Get the journeys
    let journeyData = await listJourney({ appid }, true);
    journeyData =
      journeyData?.status && journeyData?.data?.JourneysResponse?.Item
        ? journeyData.data.JourneysResponse.Item
        : [];
    console.log(`journeyData: ${JSON.stringify(journeyData)}`);

    // Get the email templates
    let templateList = await listTemplate({ appid, hbid }, true);
    console.log(`templateList: ${JSON.stringify(templateList)}`);
    templateList =
      templateList?.status && templateList?.data ? templateList.data : [];
    console.log(`templateList: ${JSON.stringify(templateList)}`);
    const templateData = [];
    for (const template of templateList) {
      const { TemplateName } = template;
      // Get the email template
      const emailTemplateDetails = await getEmailTemplate(
        { TemplateName },
        true
      );
      console.log(
        `emailTemplateDetails: ${JSON.stringify(emailTemplateDetails)}`
      );
      templateData.push({
        ...template,
        ...emailTemplateDetails?.EmailTemplateResponse,
      });
    }
    console.log(`templateData: ${JSON.stringify(templateData)}`);

    return {
      appData,
      segmentData,
      campaignData,
      journeyData,
      templateData,
    };
  } catch (error) {
    console.log(`error`);
    console.log(error);
    return null;
  }
};
const getDBData = async (hbid) => {
  const queryList = [];
  const queryEntities = [
    `metro#${hbid}`,
    `community#${hbid}`,
    `infl#${hbid}`,
    `grade#${hbid}`,
    `psrc#${hbid}`,
    `cntm#${hbid}`,
    `spec#${hbid}`,
    `exp#${hbid}`,
  ];
  const queryDataFields = [`question#${hbid}`];

  // Get the builder details
  const builderParams = {
    TableName: process.env.entitiesTableName,
    KeyConditionExpression: "#id = :id and #entity = :entity",
    ExpressionAttributeNames: {
      "#id": "id",
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":id": hbid,
      ":entity": "builder",
    },
  };
  console.log(builderParams);
  queryList.push(getQueryPromise(builderParams));

  // List all the resources under this builder except customer, realtor, agency and users
  const entityQueryParams = {
    TableName: process.env.entitiesTableName,
    IndexName: process.env.entitiesTableByEntityAndId,
    KeyConditionExpression: "#entity = :entity",
    ExpressionAttributeNames: {
      "#entity": "entity",
    },
  };
  for (const entity of queryEntities) {
    entityQueryParams.ExpressionAttributeValues = {
      ":entity": entity,
    };
    queryList.push(getQueryPromise({ ...entityQueryParams }));
  }

  // For demographics, we'll use the data GSI query
  const dataFieldQueryParams = {
    TableName: process.env.entitiesTableName,
    IndexName: process.env.entitiesTableByDataAndEntity,
    KeyConditionExpression: "#data = :data",
    ExpressionAttributeNames: {
      "#data": "data",
    },
  };
  for (const dataField of queryDataFields) {
    dataFieldQueryParams.ExpressionAttributeValues = {
      ":data": dataField,
    };
    queryList.push(getQueryPromise({ ...dataFieldQueryParams }));
  }

  // Initiate the queries
  try {
    const exportedData = await Promise.all(queryList);
    console.log(`exportedData: ${JSON.stringify(exportedData)}`);
    const builderData = [];
    if (exportedData && exportedData.length) {
      for (const resp of exportedData) {
        builderData.push(...resp.Items);
      }
    }
    return builderData;
  } catch (error) {
    console.log(`error`);
    console.log(error);
    return [];
  }
};
const updateBuilderExportStatus = async (statusObj) => {
  const params = {
    TableName: process.env.entitiesTableName,
    Item: statusObj,
  };
  console.log(params);
  const customerFileResp = await postResources(params, true);
  return customerFileResp;
};
export const saveBuilderImportExportStatus = async (
  statusFileObject,
  id = null,
  isImport = false
) => {
  console.log(`statusFileObject: ${JSON.stringify(statusFileObject)}`);
  console.log(`id: ${id}`);
  console.log(`isImport: ${isImport}`);
  const { hbid } = statusFileObject;
  const type = isImport ? `builder_import_status` : `builder_export_status`;
  const entityType = isImport ? type : `${type}#${hbid}`;
  let builderDataExportStatusResp;
  if (id) {
    // Create/Update the builder data export status record for this home builder
    // First check for existing builder data export status record for this home builder
    builderDataExportStatusResp = await getRecordByIdAndEntity(id, entityType);
    console.log(
      `builderDataExportStatusResp: ${JSON.stringify(
        builderDataExportStatusResp
      )}`
    );
  }

  let statusObj = {};
  if (builderDataExportStatusResp && builderDataExportStatusResp.length) {
    // Record exists. Update the status object path in the record
    // Modify the existing record object
    statusObj = { ...builderDataExportStatusResp[0] };
    console.log(`statusObj: ${JSON.stringify(statusObj)}`);
    statusObj.mdt = Date.now();
    if (statusObj.stso) {
      statusObj.stso = { ...statusObj.stso, ...statusFileObject };
    } else {
      statusObj.stso = statusFileObject;
    }
    console.log(`statusObj: ${JSON.stringify(statusObj)}`);
  } else {
    // Record doesn't exist. So create a new record with the status object in the db
    const creationDate = Date.now();
    statusObj = {
      id: uuidv4(),
      entity: entityType,
      type,
      cdt: creationDate,
      mdt: creationDate,
      stso: statusFileObject,
      hbid,
    };
  }
  const saveBuilderImportExportStatusResp = await updateBuilderExportStatus(
    statusObj
  );
  return saveBuilderImportExportStatusResp;
};
export async function main(event) {
  let response;
  console.log(JSON.stringify(event));
  if (event?.source !== "aws.events") {
    let fileKey;
    const { hbid } = event;
    // Upload the export builder data start status
    const currentDate = new Date().toISOString();
    const statusFileKey = `builder_exports/${currentDate}_${hbid}_status.json`;
    let statusResId;
    try {
      const statusObj = {
        hbid,
        status: CUSTOMER_FILE_STATUS_PROCESSING,
        cdt: currentDate,
        mdt: currentDate,
        statusFileKey,
      };
      const uploadInitiateStatusFileResp = await uploadImportExportStatusToS3(
        statusObj,
        statusFileKey
      );
      console.log(
        `uploadInitiateStatusFileResp: ${JSON.stringify(
          uploadInitiateStatusFileResp
        )}`
      );

      // Create status object in the DB
      const saveBuilderImportExportStatusResp =
        await saveBuilderImportExportStatus(statusObj);
      console.log(
        `saveBuilderImportExportStatusResp: ${JSON.stringify(
          saveBuilderImportExportStatusResp
        )}`
      );

      statusResId = saveBuilderImportExportStatusResp?.status
        ? saveBuilderImportExportStatusResp?.item?.id
        : "";
      console.log(`statusResId: ${statusResId}`);

      // Get the DynamoDB data
      const dbData = await getDBData(hbid);
      console.log(`dbData: ${JSON.stringify(dbData)}`);
      let appid = "";
      for (const data of dbData) {
        appid = data?.entity === "builder" ? data.appid : "";
        if (appid) break;
      }
      console.log(`appid: ${appid}`);

      // Get the Pinpoint data
      const pinpointData = await getPinpointData(appid, hbid);
      console.log(`pinpointData: ${JSON.stringify(pinpointData)}`);

      // Upload the data to s3
      fileKey = `builder_exports/${new Date().toISOString()}_${hbid}_export.json`;
      const uploadToS3Resp = await uploadImportExportStatusToS3(
        { db: dbData, pinpoint: pinpointData },
        fileKey
      );
      console.log(`uploadToS3Resp: ${JSON.stringify(uploadToS3Resp)}`);
      response = { exportComplete: true, fileKey, statusFileKey, statusResId };
    } catch (error) {
      console.log(`error`);
      console.log(error);
      response = { exportComplete: false, fileKey, statusFileKey, statusResId };
    }
  }
  return response;
}
