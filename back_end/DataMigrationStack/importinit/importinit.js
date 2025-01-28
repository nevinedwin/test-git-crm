/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import {
  getQueryPromise,
  batchGetResources,
  batchWriteItems,
} from "../../FunctionStack/libs/db";
import {
  createBuilder,
  updateBuilderDetails,
} from "../../FunctionStack/builders/builders";
import {
  createSegment,
  updateSegment,
  createCampaign,
  createJourney,
  updateJourney,
  createEmailTemplate,
  updateEmailTemplate,
  deleteSegment,
  deleteCampaign,
  deleteJourney,
  deleteEmailTemplate,
} from "../../FunctionStack/campaign/campaign";
import {
  uploadImportExportStatusToS3,
  getFileFromS3,
  saveBuilderImportExportStatus,
} from "../exportentities/exportentities";

const CUSTOMER_FILE_STATUS_PROCESSING = "PROCESSING";

export const getEntityListsForImport = async (
  hbid,
  isCustomerExport = false
) => {
  const queryList = [];
  let queryEntities = [
    `metro#${hbid}`,
    `community#${hbid}`,
    `infl#${hbid}`,
    `grade#${hbid}`,
    `psrc#${hbid}`,
    `cntm#${hbid}`,
    `spec#${hbid}`,
    `exp#${hbid}`,
  ];
  if (isCustomerExport) queryEntities = [...queryEntities, `desf#${hbid}`];
  const queryDataFields = [`question#${hbid}`];

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
    const entitiesList = await Promise.all(queryList);
    console.log(`entitiesList: ${JSON.stringify(entitiesList)}`);
    const listData = [];
    if (entitiesList && entitiesList.length) {
      for (const resp of entitiesList) {
        listData.push(...resp.Items);
      }
    }
    console.log(`listData: ${JSON.stringify(listData)}`);
    let reducerObject = {
      [`metro#${hbid}`]: [],
      [`community#${hbid}`]: [],
      [`infl#${hbid}`]: [],
      [`grade#${hbid}`]: [],
      [`psrc#${hbid}`]: [],
      [`cntm#${hbid}`]: [],
      [`spec#${hbid}`]: [],
      [`exp#${hbid}`]: [],
      [`question#${hbid}`]: [],
    };
    if (isCustomerExport)
      reducerObject = { ...reducerObject, [`desf#${hbid}`]: [] };
    const categorizedList = listData.reduce((list, item) => {
      if (item?.data === `question#${hbid}`) {
        list[item?.data].push(item?.id);
      } else {
        list[item?.entity].push(item?.id);
      }
      return list;
    }, reducerObject);
    let nameIdMappedList = {};
    if (isCustomerExport) {
      nameIdMappedList = listData.reduce(
        (acc, item) => {
          switch (item?.type) {
            case "metro":
              acc.metro = {
                ...acc.metro,
                [item?.id]: item?.name,
              };
              break;
            case "community":
              acc.community = {
                ...acc.community,
                [item?.id]: item?.name,
              };
              break;
            case "infl":
              acc.infl = {
                ...acc.infl,
                [item?.id]: item?.name,
              };
              break;
            case "grade":
              acc.grade = {
                ...acc.grade,
                [item?.id]: item?.name,
              };
              break;
            case "psrc":
              acc.psrc = {
                ...acc.psrc,
                [item?.id]: item?.name,
              };
              break;
            case "cntm":
              acc.cntm = {
                ...acc.cntm,
                [item?.id]: item?.name,
              };
              break;
            case "spec":
              acc.spec = {
                ...acc.spec,
                [item?.id]: item?.name,
              };
              break;
            case "exp":
              acc.exp = {
                ...acc.exp,
                [item?.id]: item?.name,
              };
              break;
            case "desf":
              acc.desf = {
                ...acc.desf,
                [item?.id]: item?.name,
              };
              break;
            default:
              break;
          }
          return acc;
        },
        {
          metro: {},
          community: {},
          infl: {},
          grade: {},
          psrc: {},
          cntm: {},
          spec: {},
          exp: {},
          desf: {},
        }
      );
    }
    return { listData, categorizedList,nameIdMappedList };
  } catch (error) {
    console.log(`error`);
    console.log(error);
    return [];
  }
};
const importBuilder = async (builder, isUpdate = false) => {
  let importBuilderResp;
  const builderParams = { ...builder };

  if (isUpdate) {
    // Update the Builder
    importBuilderResp = await updateBuilderDetails(builderParams);
    console.log(`importBuilderResp: ${JSON.stringify(importBuilderResp)}`);
  } else {
    // Setting this to get Pinpoint appid in the response
    builderParams.isImportBuilder = true;
    // Create the builder
    importBuilderResp = await createBuilder(builderParams);
    console.log(`importBuilderResp: ${JSON.stringify(importBuilderResp)}`);
  }

  // Get the appid
  let appid;
  if (isUpdate) appid = builder?.appid;
  else if (importBuilderResp?.status) appid = importBuilderResp?.appid;
  else appid = "";
  console.log(`appid: ${appid}`);
  return { appid, error: !appid ? importBuilderResp?.error : "" };
};
const importEntities = async (entities, toDeleteEntities = []) => {
  try {
    const batchParams = {
      RequestItems: {
        [process.env.entitiesTableName]: [],
      },
    };
    for (const toDeleteEntity of toDeleteEntities) {
      batchParams.RequestItems[process.env.entitiesTableName].push({
        DeleteRequest: {
          Key: { id: toDeleteEntity?.id, entity: toDeleteEntity?.entity },
        },
      });
    }
    for (const dbRes of entities) {
      batchParams.RequestItems[process.env.entitiesTableName].push({
        PutRequest: {
          Item: dbRes,
        },
      });
    }

    // Create entities as a batch
    console.log(`batchParams: ${JSON.stringify(batchParams)}`);
    const batchWriteResp = await batchWriteItems(batchParams);
    console.log(`batchWriteResp: ${JSON.stringify(batchWriteResp)}`);
    return { status: true, resp: batchWriteResp };
  } catch (error) {
    console.log(`error`);
    console.log(error);
    return { status: false, error };
  }

  /* // Separate the metro and other entities since the metro needs to be created before the communities
      const processedDbData = [...entities].reduce((processedData, dbEntry) => {
          if (dbEntry.entity === 'metro') {
              processedData.metroData.push(dbEntry);
          }
          else if (dbEntry.entity === 'community') {
              // Create a mapping of metro and communities
              if (!processedData.metroComms[dbEntry?.rel_id]) processedData.metroComms[dbEntry?.rel_id] = [];
              processedData.metroComms[dbEntry?.rel_id].push(dbEntry);
          }
          else {
              processedData.otherEntities.push(dbEntry);
          }
          return processedData;
      }, { metroData: [], otherEntities: [], metroComms: {} });
  
      // Create the metros first
      for (let metro of processedDbData.metroData) {
          // Verify whether the id already exists in the DB
          const metroId = await getResourceId(metro?.id);
          const metroParams = { ...metro };
          metroParams.id = metroId;
          metroParams.entity.replace(oldHbId, hb_id);
          const createMetroResp = await createMetro(metroParams);
          console.log(`createMetroResp: ${ JSON.stringify(createMetroResp) }`);
  
          // Create the communities associated with this metro
          const communitiesToCreate = processedDbData?.metroComms[metro?.id];
          for (let community of communitiesToCreate) {
              // Verify whether the id already exists in the DB
              const communityId = await getResourceId(community?.id);
              const communityParams = { ...community };
              communityParams.id = communityId;
              const createCommunityResp = await createCommunity(metroParams);
              console.log(`createCommunityResp: ${ JSON.stringify(createCommunityResp) }`);
          }
      } */
};
const findToDeleteItems = (data) => {
  const { idMapData } = data;
  const toDeleteItems = {
    segments: [],
    campaigns: [],
    journeys: [],
    templates: [],
  };
  for (const pinpointResource in idMapData) {
    if (pinpointResource) {
      console.log(`pinpointResource: ${pinpointResource}`);
      // Get the id object from the idMapData
      const idObj = idMapData[pinpointResource];
      console.log(`idObj: ${JSON.stringify(idObj)}`);

      // Get the pinpoint resource array to be imported, matching the pinpointResource type
      const toMatchArr = data[pinpointResource];
      console.log(`toMatchArr: ${JSON.stringify(toMatchArr)}`);

      // If the idObj doesn't contain the id mapping
      for (const sourceId in idObj) {
        if (sourceId) {
          let exists = false;
          for (let index = 0; index < toMatchArr.length; index += 1) {
            const resource = toMatchArr[index];
            const resourceIdKey =
              pinpointResource === "templates" ? "TemplateName" : "Id";
            console.log(`resource[resourceIdKey]: ${resource[resourceIdKey]}`);
            console.log(`sourceId: ${sourceId}`);
            if (resource[resourceIdKey] === sourceId) {
              exists = true;
              break;
            }
          }
          console.log(`exists: ${exists}`);
          // Add the destination id to toDeleteItems
          if (!exists)
            toDeleteItems[pinpointResource].push({
              id: idObj[sourceId],
              sourceId,
            });
        }
      }
      console.log(`toDeleteItems: ${JSON.stringify(toDeleteItems)}`);
    }
  }
  return toDeleteItems;
};
const deletePinpointResources = async (toDeleteItems, appid) => {
  try {
    for (const key in toDeleteItems) {
      if (key) {
        const idArr = toDeleteItems[key];
        for (const obj of idArr) {
          const { id } = obj;
          let resp;
          switch (key) {
            case "segments":
              resp = await deleteSegment({ appid, segid: id }, true);
              break;
            case "campaigns":
              resp = await deleteCampaign({ appid, campid: id }, true);
              break;
            case "journeys":
              resp = await deleteJourney({ appid, jid: id }, true);
              break;
            case "templates":
              resp = await deleteEmailTemplate({ TemplateName: id }, true);
              break;
            default:
              break;
          }
          console.log(`resp: ${JSON.stringify(resp)}`);
        }
      }
    }
    return { status: true };
  } catch (error) {
    return { status: false, error };
  }
};
const importPinpointResources = async (pinpointData, appid) => {
  try {
    console.log(`pinpointData: ${JSON.stringify(pinpointData)}`);
    console.log(`appid: ${appid}`);
    const { segmentData, campaignData, journeyData, templateData } =
      pinpointData;

    // Get mapping file from s3 and check whether the Id field exists in it.
    // If so take its value which will be the imported segment/campaign/journey/template id and do the update in the destination
    // Else create it
    let idMapData = {};
    try {
      // Get the id mapping file from s3
      idMapData = await getFileFromS3(
        `builder_imports/pinpoint_map_${appid}.json`
      );
      if (idMapData?.status) {
        if (idMapData?.data === null)
          idMapData = {
            segments: {},
            campaigns: {},
            journeys: {},
            templates: {},
          };
        else idMapData = idMapData?.data;
      } else
        idMapData = {
          segments: {},
          campaigns: {},
          journeys: {},
          templates: {},
        };
      console.log(`idMapData: ${JSON.stringify(idMapData)}`);
    } catch (error) {
      idMapData = { segments: {}, campaigns: {}, journeys: {}, templates: {} };
    }
    // Find the items to delete by verifying the ids against the idMapData
    const toDeleteItems = findToDeleteItems({
      segments: segmentData,
      campaigns: campaignData,
      journeys: journeyData,
      templates: templateData,
      idMapData,
    });
    console.log(`toDeleteItems: ${JSON.stringify(toDeleteItems)}`);
    // Create/update email templates
    for (const template of templateData) {
      const {
        TemplateName,
        tags,
        DefaultSubstitutions,
        HtmlPart,
        Subject,
        TemplateDescription,
      } = template;
      const paramObj = {
        EmailTemplateRequest: {
          /* required */ DefaultSubstitutions,
          HtmlPart,
          Subject,
          TemplateDescription,
          tags,
        },
        TemplateName /* required */,
      };
      // Check for templateName mapping
      if (idMapData.templates[TemplateName]) {
        // Update email template
        const importEmailTemplateResp = await updateEmailTemplate(
          paramObj,
          true
        );
        console.log(
          `importEmailTemplateResp: ${JSON.stringify(importEmailTemplateResp)}`
        );
      } else {
        // Create email template
        const importEmailTemplateResp = await createEmailTemplate(
          paramObj,
          true
        );
        console.log(
          `importEmailTemplateResp: ${JSON.stringify(importEmailTemplateResp)}`
        );
        // Add the mapping if this is a create operation
        idMapData.templates[TemplateName] = TemplateName;
      }
    }
    // Create/Update segments
    for (const segment of segmentData) {
      const { SegmentGroups, Name, tags, Id = null } = segment;
      const paramObj = {
        ApplicationId: appid /* required */,
        WriteSegmentRequest: {
          /* required */ SegmentGroups,
          Name,
          tags,
        },
      };
      // Check for id mapping
      if (idMapData.segments[Id]) {
        // Update segment
        paramObj.SegmentId = idMapData.segments[Id];
        const importSegmentResp = await updateSegment({}, true, paramObj);
        console.log(`importSegmentResp: ${JSON.stringify(importSegmentResp)}`);
      } else {
        // Create segment
        const importSegmentResp = await createSegment({}, true, paramObj);
        console.log(`importSegmentResp: ${JSON.stringify(importSegmentResp)}`);
        // Add the mapping if this is a create operation
        idMapData.segments[Id] = importSegmentResp?.SegmentResponse?.Id;
      }
    }
    // Create/update campaign
    for (const campaign of campaignData) {
      console.log(`campaign: ${JSON.stringify(campaign)}`);
      const {
        Description,
        IsPaused,
        MessageConfiguration,
        Name,
        Schedule,
        SegmentId,
        tags,
        TemplateConfiguration,
        Id = null,
      } = campaign;
      const paramObj = {
        ApplicationId: appid /* required */,
        WriteCampaignRequest: {
          /* required */ Description,
          IsPaused,
          Name,
          Schedule,
          SegmentId: idMapData.segments[SegmentId],
          tags,
          TemplateConfiguration,
          MessageConfiguration,
        },
      };
      console.log(`paramObj: ${JSON.stringify(paramObj)}`);
      // Check for id mapping
      if (idMapData.campaigns[Id]) {
        // Update campaign
        paramObj.CampaignId = idMapData.campaigns[Id];
        const importCampaignResp = await createCampaign(
          {},
          true,
          true,
          paramObj
        );
        console.log(
          `importCampaignResp: ${JSON.stringify(importCampaignResp)}`
        );
      } else {
        // Create campaign
        const importCampaignResp = await createCampaign(
          {},
          false,
          true,
          paramObj
        );
        console.log(
          `importCampaignResp: ${JSON.stringify(importCampaignResp)}`
        );
        // Add the mapping if this is a create operation
        idMapData.campaigns[Id] = importCampaignResp?.CampaignResponse?.Id;
      }
    }
    // Create/update journey
    for (const journey of journeyData) {
      const {
        Activities,
        Name,
        Id = null,
        CreationDate,
        LastModifiedDate,
        LocalTime,
        Schedule,
        StartActivity,
        StartCondition,
        State,
      } = journey;
      if (StartCondition?.SegmentStartCondition?.SegmentId)
        StartCondition.SegmentStartCondition.SegmentId =
          idMapData.segments[StartCondition.SegmentStartCondition.SegmentId];
      const paramObj = {
        ApplicationId: appid /* required */,
        WriteJourneyRequest: {
          /* required */ Name /* required */,
          Activities,
          CreationDate,
          LastModifiedDate,
          LocalTime,
          Schedule,
          StartActivity,
          StartCondition,
          State,
        },
      };
      // Check for id mapping
      if (idMapData.journeys[Id]) {
        // Update journey
        paramObj.JourneyId = idMapData.journeys[Id];
        const importJourneyResp = await updateJourney(paramObj, true);
        console.log(`importJourneyResp: ${JSON.stringify(importJourneyResp)}`);
      } else {
        // Create journey
        const importJourneyResp = await createJourney(paramObj, true);
        console.log(`importJourneyResp: ${JSON.stringify(importJourneyResp)}`);
        // Add the mapping if this is a create operation
        idMapData.journeys[Id] = importJourneyResp?.JourneyResponse?.Id;
      }
    }
    // Initiate the delete pinpoint reosurce call
    const deleteResourcesResp = await deletePinpointResources(
      toDeleteItems,
      appid
    );
    console.log(`deleteResourcesResp: ${JSON.stringify(deleteResourcesResp)}`);

    // Remove the deleted ids from the mapping
    for (const key in toDeleteItems) {
      if (key) {
        const idArr = toDeleteItems[key];
        idArr.forEach((idObj) => {
          delete idMapData[key][idObj.sourceId];
        });
      }
    }
    console.log(`idMapData: ${JSON.stringify(idMapData)}`);
    // Upload the idMap file to s3
    const uploadIdMapToS3 = await uploadImportExportStatusToS3(
      idMapData,
      `builder_imports/pinpoint_map_${appid}.json`
    );
    console.log(`uploadIdMapToS3: ${JSON.stringify(uploadIdMapToS3)}`);
    return { status: true };
  } catch (error) {
    console.log(`error`);
    console.log(error);
    return { status: false, error };
  }
};
const initImportProcess = async (importData) => {
  let hbid;
  try {
    // Extract db and pinpoint data exports
    const entities = importData?.db;
    const pinpoint = importData?.pinpoint;

    console.log(`entities: ${JSON.stringify(entities)}`);
    console.log(`pinpoint: ${JSON.stringify(pinpoint)}`);

    // Adding data to statusObj
    const statusObj = { entities, pinpoint };
    // Extract all the ids and check whether they exist in the db
    const params = {
      RequestItems: {
        /* required */
        [process.env.entitiesTableName]: {
          Keys: [],
        },
      },
    };
    for (const dbEntry of entities) {
      if (dbEntry?.id && dbEntry?.entity) {
        params.RequestItems[process.env.entitiesTableName].Keys.push({
          id: dbEntry.id,
          entity: dbEntry.entity,
        });
      }
    }
    console.log("params: ", JSON.stringify(params));
    const getEntityResponse = await batchGetResources(params, true);
    console.log("getEntityResponse: ", JSON.stringify(getEntityResponse));
    const batchGetBody =
      getEntityResponse?.statusCode === 200 && getEntityResponse?.body
        ? JSON.parse(getEntityResponse.body)
        : [];
    console.log(`batchGetBody: ${JSON.stringify(batchGetBody)}`);
    // Get the builderData and other entities seperately so that we create builder first before everything else
    const processedDbData = [...entities].reduce(
      (processedData, dbEntry) => {
        if (dbEntry.entity === "builder") {
          if (batchGetBody?.length) {
            // Find the builder resource from batchGetBody and use the appid and rnstr in the update
            const builderUpdateParams = [...batchGetBody].reduce(
              (builderProps, currentRes) => {
                if (currentRes?.entity === "builder") {
                  builderProps.rnstr = currentRes?.rnstr;
                  builderProps.appid = currentRes?.appid;
                }
                return builderProps;
              },
              { rnstr: "", appid: "" }
            );
            processedData.builderData = { ...dbEntry, ...builderUpdateParams };
          } else {
            processedData.builderData = dbEntry;
          }
        } else {
          processedData.otherEntities.push(dbEntry);
        }
        return processedData;
      },
      { builderData: {}, otherEntities: [] }
    );

    const { builderData, otherEntities } = processedDbData;
    console.log(`builderData: ${JSON.stringify(builderData)}`);
    console.log(`otherEntities: ${JSON.stringify(otherEntities)}`);
    hbid = builderData?.id;

    statusObj[hbid] = hbid;

    if (batchGetBody.length === 0) {
      // No duplicate Ids found. So go ahead with importing the data
      // CreateBuilder
      const builderCreateResp = await importBuilder(builderData);
      console.log(`builderCreateResp: ${JSON.stringify(builderCreateResp)}`);
      const { appid } = builderCreateResp;

      if (appid) {
        statusObj.appid = appid;

        // Start importing other db entities
        const importEntitiesResp = await importEntities(otherEntities);
        console.log(
          `importEntitiesResp: ${JSON.stringify(importEntitiesResp)}`
        );
        statusObj.importEntitiesResp = importEntitiesResp;
        // Start importing pinpoint resources
        const importPinpointResourcesResp = await importPinpointResources(
          pinpoint,
          appid
        );
        console.log(
          `importPinpointResourcesResp: ${JSON.stringify(
            importPinpointResourcesResp
          )}`
        );
        statusObj.importPinpointResourcesResp = importPinpointResourcesResp;
      } else {
        statusObj.error = `Failed to create Pinpoint application. Aborting import builder. ${builderCreateResp?.error}`;
        return {
          status: false,
          hbid,
          statusObj,
        };
      }
    } else {
      console.log(`In duplicates found`);
      // Duplicate ids found. Change the ids and create the resources/update the resources.

      // Start importing other db entities
      // Do the update builder seperately. Because, it has the pinpoint application and external user
      // configurations to update as well.
      const updateBuilderDetailsResp = await importBuilder(builderData, true);
      console.log(
        `updateBuilderDetailsResp: ${JSON.stringify(updateBuilderDetailsResp)}`
      );

      const appid = updateBuilderDetailsResp?.appid;
      if (appid) {
        statusObj.appid = appid;

        // Get the list of entities so that we can compare the data to be imported with this list
        // To delete the ones not present in the import data
        const entityListResp = await getEntityListsForImport(builderData?.id);
        console.log(`entityListResp: ${JSON.stringify(entityListResp)}`);
        const { categorizedList } = entityListResp;
        const toDeleteItems = [];
        for (const entityString in categorizedList) {
          if (entityString) {
            const idArr = categorizedList[entityString];
            idArr.forEach((entityId) => {
              let itemToDelete = true;
              // Check whether the id and entity pair exists in the otherEntities array
              // If not, then this entity should be deleted from the db during import
              for (const entityObj of otherEntities) {
                if (!entityString.includes("question#")) {
                  if (
                    entityId === entityObj.id &&
                    entityString === entityObj.entity
                  ) {
                    itemToDelete = false;
                    break;
                  }
                } else if (
                  entityId === entityObj.id &&
                  entityString === entityObj.data
                ) {
                  itemToDelete = false;
                  break;
                }
              }
              if (itemToDelete) {
                toDeleteItems.push({ id: entityId, entity: entityString });
              }
            });
          }
        }
        console.log(`toDeleteItems: ${JSON.stringify(toDeleteItems)}`);
        statusObj.toDeleteItems = toDeleteItems;
        // Import update other entities
        const importEntitiesResp = await importEntities(
          otherEntities,
          toDeleteItems
        );
        console.log(
          `importEntitiesResp: ${JSON.stringify(importEntitiesResp)}`
        );
        statusObj.importEntitiesResp = importEntitiesResp;

        // Start importing pinpoint resources
        const importPinpointResourcesResp = await importPinpointResources(
          pinpoint,
          appid
        );
        console.log(
          `importPinpointResourcesResp: ${JSON.stringify(
            importPinpointResourcesResp
          )}`
        );
        statusObj.importPinpointResourcesResp = importPinpointResourcesResp;
      } else {
        statusObj.error = `Failed to create Pinpoint application. Aborting import builder. ${updateBuilderDetailsResp?.error}`;
        return {
          status: false,
          hbid,
          statusObj,
        };
      }
    }
    statusObj.builderParams = builderData;
    statusObj.otherEntityParams = otherEntities;
    return { status: true, hbid, statusObj };
  } catch (error) {
    console.log(error);
    return { status: false, hbid, error };
  }
};
export async function main(event) {
  let response;
  console.log(JSON.stringify(event));
  if (event?.source !== "aws.events") {
    let statusResId;
    let statusFileKey;
    const { fileKey } = event;
    console.log(`fileKey: ${fileKey}`);
    console.log(`event.fileKey: ${event.fileKey}`);
    try {
      // Get the import file
      const importData = await getFileFromS3(fileKey);
      console.log(`importData: ${JSON.stringify(importData)}`);

      // Start the import process
      const importResp = await initImportProcess(importData?.data);
      console.log(`importResp: ${JSON.stringify(importResp)}`);

      // Upload the data to s3
      const currentDate = new Date().toISOString();
      statusFileKey = `builder_imports/${currentDate}_${importResp?.hbid}_import_status.json`;
      const uploadToS3Resp = await uploadImportExportStatusToS3(
        importResp?.statusObj,
        statusFileKey
      );
      console.log(`uploadToS3Resp: ${JSON.stringify(uploadToS3Resp)}`);

      // Create status object in the DB
      const statusObj = {
        hbid: importResp?.hbid,
        status: CUSTOMER_FILE_STATUS_PROCESSING,
        cdt: currentDate,
        mdt: currentDate,
        statusFileKey,
        fileKey,
      };
      console.log(`statusObj: ${JSON.stringify(statusObj)}`);

      const saveBuilderImportExportStatusResp =
        await saveBuilderImportExportStatus(statusObj, null, true);
      console.log(
        `saveBuilderImportExportStatusResp: ${JSON.stringify(
          saveBuilderImportExportStatusResp
        )}`
      );

      statusResId = saveBuilderImportExportStatusResp?.status
        ? saveBuilderImportExportStatusResp?.item?.id
        : "";
      console.log(`statusResId: ${statusResId}`);

      response = {
        importComplete: importResp?.status,
        statusFileKey,
        statusResId,
      };
    } catch (error) {
      console.log(`error`);
      console.log(error);
      response = { importComplete: false, statusFileKey, statusResId };
    }
  }
  return response;
}
