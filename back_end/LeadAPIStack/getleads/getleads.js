/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";

import https from "https";
import AWS from "aws-sdk";
import moment from "moment-timezone";
import { getEntities } from "../../FunctionStack/endpointcount/endpointcount";

const CUSTOMER_FILE_STATUS_PROCESSING = "PROCESSING";
const CUSTOMER_FILE_STATUS_COMPLETED = "COMPLETED";
const { FILE_MANAGER_BUCKET_NAME } = process.env;
const s3 = new AWS.S3({ apiVersion: "2006-03-01" });
const getLeads = async (builderId, token, startDate, endDate, leadIdMin) => {
  let dataString = "";
  // https://api.newhomesource.com/api/v2/Leads/GetLeads?builderId=33843&token=58b0c688&startDate=2021-01-27T09:13&endDate=2021-01-27T09:18&leadIdMin=500
  const hostname = `api.newhomesource.com`;
  const path = `/api/v2/Leads/GetLeads?builderId=${builderId}&token=${token}${
    leadIdMin
      ? `&leadIdMin=${leadIdMin + 1}`
      : `&startDate=${startDate}&endDate=${endDate}`
  }`;
  console.log(`leadIdMin: ${leadIdMin}`);
  console.log(`path: ${path}`);
  const method = `GET`;
  const options = { hostname, path, method };
  const getLeadsResp = await new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      console.log(`statusCode: ${res.statusCode}`);
      res.on("data", (chunk) => {
        // process.stdout.write(d)
        dataString += chunk;
      });
      res.on("end", () => {
        resolve({
          statusCode: 200,
          body: JSON.stringify(JSON.parse(dataString), null, 4),
        });
      });
    });

    req.on("error", (error) => {
      console.error(error);
      reject(
        new Error({
          statusCode: 500,
          body: JSON.stringify(error),
        })
      );
    });
    req.end();
  });
  return getLeadsResp;
};
export const uploadLeadsToS3 = async (
  rnstr,
  leads,
  timestamp,
  isStatus = false,
  statusFileKey = "",
  isFormatted = false
) => {
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
      Key: statusFileKey || `external_leads/${rnstr}/${fileKey}`,
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
/* const generateLeads = (emailPrefix, hb_id) => {
    const leads = {
        "Time": "sample string 1",
        "Error": {
            "ClassName": "System.Exception",
            "Message": null,
            "Data": null,
            "InnerException": null,
            "HelpURL": "sample string 1",
            "StackTraceString": null,
            "RemoteStackTraceString": null,
            "RemoteStackIndex": 0,
            "ExceptionMethod": null,
            "HResult": 3,
            "Source": "sample string 2",
            "WatsonBuckets": null
        },
        "ErrorMessage": "sample string 2",
        "Status": "sample string 3",
        "Server": "sample string 4",
        "Count": 1,
        "Result": []
    };
    for (let index = 1; index <= 10; index++) {
        const leadObj = {
            "LeadID": index,
            "RequestID": 2,
            "RequestDate": new Date().toISOString(),
            "Source": "sample string 3",
            "LeadType": "sample string 4",
            "ChatUrl": "sample string 5",
            "LeadRecipient": "sample string 6",
            "Contact": {
                "Title": "sample string 1",
                "FirstName": "sample string 2",
                "LastName": "sample string 3",
                "Email": `${emailPrefix}_${hb_id}_${index}@sales-crm.com`,
                "Phone": "(558) 899-9653",
                "StreetAddress": "sample string 6",
                "City": "sample string 7",
                "State": "sample string 8",
                "PostalCode": "sample string 9",
                "Country": "sample string 10",
                "PreferredContactMethod": "sample string 11"
            },
            "Qualifications": {
                "PrefPriceLow": "sample string 1",
                "PrefPriceHigh": "sample string 2",
                "Financing": "sample string 3",
                "ReasonsForBuying": "sample string 4",
                "MoveInDate": "sample string 5",
                "Comments": "sample string 6"
            },
            "PropertyInterest": {
                "StateName": "sample string 1",
                "MarketName": "sample string 2",
                "BuilderNumber": "sample string 3",
                "BuilderName": "sample string 4",
                "CommunityNumber": "1588",
                "CommunityName": "sample string 6",
                "PlanNumber": "sample string 7",
                "PlanName": "sample string 8",
                "SpecNumber": "sample string 9",
                "SpecAddress": "sample string 10",
                "Price": 1.0
            },
            "SiteTracking": {
                "UtmaSId": "sample string 2",
                "UtmaUId": "sample string 3",
                "UtmCcn": "sample string 4",
                "UtmCct": "sample string 5",
                "UtmCmd": "sample string 6",
                "UtmCsr": "sample string 7",
                "UtmCtr": "sample string 8",
                "UtmGclId": "sample string 9",
                "EnterUrl": "sample string 10",
                "ConvPgUrl": "sample string 11",
                "FbConvId": "sample string 12",
                "HttpRefer": "sample string 13"
            }
        };
        leads.Result.push(leadObj);
    }
    console.log(`leads.Result.length: ${leads.Result.length}`);
    return leads;
} */
const getLastLeadId = async (hbid) => {
  const type = "lastlead";
  const lastLeadResource = await getEntities(`${type}#${hbid}`);
  console.log(`lastLeadResource: ${JSON.stringify(lastLeadResource)}`);
  if (lastLeadResource && lastLeadResource.length) {
    return lastLeadResource[0].leadid;
  }
  return false;
};
const calculateTime = (tz, isBefore = false) => {
  console.log(`tz: ${tz}`);
  let date;
  if (isBefore) {
    date = new Date(new Date() - 10 * 60000);
  } else {
    date = new Date();
  }
  return moment(date.getTime()).tz(tz).format().slice(0, 16);
};
export async function main(event) {
  console.log(JSON.stringify(event));
  const {
    ext_builderId: extBuilderId,
    ext_token: extToken,
    hb_id: hbId,
    rnstr,
  } = event;
  // Setting the tz to Central Time because BDX uses only that
  const tz = "America/Chicago";
  if (extBuilderId && extToken) {
    /* const now = new Date();
        const statusEndDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString();
        const endDate = statusEndDate.slice(0, 16);
        // start date is now set to 10 minutes before the current time
        const before = new Date(new Date() - 10 * 60000);
        const statusStartDate = new Date(before.getTime() - before.getTimezoneOffset() * 60000).toISOString()
        const startDate = statusStartDate.slice(0, 16); */
    const endDate = calculateTime(tz);
    console.log(endDate);
    // start date is now set to 10 minutes before the current time
    const startDate = calculateTime(tz, true);
    console.log(startDate);
    // Get the lastleadId
    const lastLeadId = await getLastLeadId(hbId);
    console.log(`lastLeadId: ${lastLeadId}`);
    // Get the leads
    const leadsResp = await getLeads(
      extBuilderId,
      extToken,
      startDate,
      endDate,
      lastLeadId
    );
    const leadsRespBody =
      leadsResp && leadsResp.statusCode === 200 && leadsResp.body
        ? JSON.parse(leadsResp.body)
        : [];
    console.log(`leadsRespBody: ${JSON.stringify(leadsRespBody)}`);
    const leadArr = leadsRespBody.Result
      ? leadsRespBody.Result.sort((a, b) => {
          if (a.LeadID > b.LeadID) return 1;
          if (b.LeadID > a.LeadID) return -1;
          return 0;
        })
      : [];
    /* const leadArr = [
      {
        LeadID: 17636323,
        RequestID: 8904613,
        RequestDate: "2019-11-16T14:06:04.267",
        Source: "BDX",
        LeadType: "Rec. Community",
        LeadRecipient: "web-qmi@sales-crm.com,",
        Contact: {
          Title: null,
          FirstName: "Nina",
          LastName: "keen",
          Email: "nina.keen606@sales-crm.com",
          Phone: "4944627434 ",
          StreetAddress: null,
          City: null,
          State: null,
          PostalCode: "75185",
        },
        Qualifications: {
          PrefPriceLow: null,
          PrefPriceHigh: null,
          Financing: null,
          ReasonsForBuying: null,
          MoveInDate: null,
          Comments:
            "Lead Type: Brochure - This prospect was matched to your community based on their request for homes similar to: a  community from the low $200's to high $300's, with 3-6 bedrooms, 2.0-4.5 baths.",
        },
        PropertyInterest: {
          StateName: "TX",
          MarketName: "Dallas",
          BuilderNumber: "123",
          BuilderName: "Impression Homes",
          CommunityNumber: "1067",
          CommunityName: "Heartland",
          PlanNumber: null,
          PlanName: null,
          SpecNumber: null,
          SpecAddress: null,
          Price: null,
        },
      },
      {
        LeadID: 17636685,
        RequestID: 8905003,
        RequestDate: "2019-11-16T14:36:04.56",
        Source: "BDX",
        LeadType: "Rec. Community",
        LeadRecipient: "web-qmi@sales-crm.com,",
        Contact: {
          Title: null,
          FirstName: "Jill",
          LastName: "Angela Henderson",
          Email: "jillndarryl6@sales-crm.com",
          Phone: "8179927711 ",
          StreetAddress: null,
          City: null,
          State: null,
          PostalCode: "76012",
        },
        Qualifications: {
          PrefPriceLow: null,
          PrefPriceHigh: null,
          Financing: null,
          ReasonsForBuying: null,
          MoveInDate: null,
          Comments:
            "Lead Type: Brochure - This prospect was matched to your community based on their request for homes similar to: a  community from the low $200's to low $300's, with 3-6 bedrooms, 2.0-3.5 baths.",
        },
        PropertyInterest: {
          StateName: "TX",
          MarketName: "Fort Worth",
          BuilderNumber: "123",
          BuilderName: "Impression Homes",
          CommunityNumber: "1031",
          CommunityName: "Bluebird Meadows",
          PlanNumber: null,
          PlanName: null,
          SpecNumber: null,
          SpecAddress: null,
          Price: null,
        },
      },
      {
        LeadID: 17637367,
        RequestID: 8905449,
        RequestDate: "2019-11-16T17:41:04.973",
        Source: "NewHomeSource Professional",
        LeadType: "Home",
        LeadRecipient: "web-qmi@sales-crm.com,",
        Contact: {
          Title: null,
          FirstName: "Jeff",
          LastName: "Patella",
          Email: "jeff.patella6@sales-crm.com",
          Phone: null,
          StreetAddress: null,
          City: null,
          State: null,
          PostalCode: null,
        },
        Qualifications: {
          PrefPriceLow: null,
          PrefPriceHigh: null,
          Financing: null,
          ReasonsForBuying: null,
          MoveInDate: null,
          Comments:
            "This is a real estate agent from ntreis representing a home shopper. Lead Type: Saved Listing Shared with Client",
        },
        PropertyInterest: {
          StateName: "TX",
          MarketName: "Dallas",
          BuilderNumber: "123",
          BuilderName: "Impression Homes",
          CommunityNumber: "1067",
          CommunityName: "Heartland",
          PlanNumber: "8916",
          PlanName: "Austin",
          SpecNumber: "3974 Bellingham Lane",
          SpecAddress: "3974 Bellingham Lane",
          Price: 235035,
        },
      },
      {
        LeadID: 17637368,
        RequestID: 8905450,
        RequestDate: "2019-11-16T17:41:04.973",
        Source: "NewHomeSource Professional",
        LeadType: "Home",
        LeadRecipient: "web-qmi@sales-crm.com,",
        Contact: {
          Title: null,
          FirstName: "Jeff",
          LastName: "Patella",
          Email: "jeff.patella6@sales-crm.com",
          Phone: null,
          StreetAddress: null,
          City: null,
          State: null,
          PostalCode: null,
        },
        Qualifications: {
          PrefPriceLow: null,
          PrefPriceHigh: null,
          Financing: null,
          ReasonsForBuying: null,
          MoveInDate: null,
          Comments:
            "This is a real estate agent from ntreis representing a home shopper. Lead Type: Client version of listing report downloaded by agent -",
        },
        PropertyInterest: {
          StateName: "TX",
          MarketName: "Dallas",
          BuilderNumber: "123",
          BuilderName: "Impression Homes",
          CommunityNumber: "1068",
          CommunityName: "Heartland",
          PlanNumber: "8916",
          PlanName: "Austin",
          SpecNumber: "3974 Bellingham Lane",
          SpecAddress: "3974 Bellingham Lane",
          Price: 235035,
        },
      },
    ].sort((a, b) => {
      if (a.LeadID > b.LeadID) return 1;
      if (b.LeadID > a.LeadID) return -1;
      return 0;
    }); */
    console.log(`leadArr: ${JSON.stringify(leadArr)}`);
    /* let sortedLeadArr = leadArr.map(lead => {
            lead.Contact.Email = `${lead.Contact.Email.split('@')[0]}@sales-crm.com`;
            return lead;
        }); */

    // Upload the API response to s3 for future reference
    const currentDate = new Date().toISOString();
    const uploadToS3Resp = await uploadLeadsToS3(
      rnstr,
      leadArr,
      false,
      "",
      currentDate
    );
    console.log(`uploadToS3Resp: ${JSON.stringify(uploadToS3Resp)}`);

    // Check for duplicates and merge the latest FirstName, LastName, Email, Phone and CommunityNumber fields.
    const mergedResult = [...leadArr].reduce((merged, item) => {
      // Check whether the email address is already there in merged object
      if (merged[item.Contact.Email]) {
        merged[item.Contact.Email].LeadID = item.LeadID;
        merged[item.Contact.Email].RequestID = item.RequestID;
        merged[item.Contact.Email].Contact.FirstName = item.Contact.FirstName;
        merged[item.Contact.Email].Contact.LastName = item.Contact.LastName;
        merged[item.Contact.Email].Contact.Phone = item.Contact.Phone;
        merged[item.Contact.Email].Qualifications.Comments =
          item.Qualifications.Comments;
        merged[item.Contact.Email].PropertyInterest.CommunityNumber = merged[
          item.Contact.Email
        ].PropertyInterest.CommunityNumber.length
          ? [
              ...merged[item.Contact.Email].PropertyInterest.CommunityNumber,
              item.PropertyInterest.CommunityNumber,
            ]
          : [item.PropertyInterest.CommunityNumber];
        // Remove the duplicates
        merged[item.Contact.Email].PropertyInterest.CommunityNumber = [
          ...new Set(
            merged[item.Contact.Email].PropertyInterest.CommunityNumber
          ),
        ];
      } else {
        merged[item.Contact.Email] = item;
        merged[item.Contact.Email].PropertyInterest.CommunityNumber = [
          merged[item.Contact.Email].PropertyInterest.CommunityNumber,
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
    // const resp = generateLeads("mclaren765ltv15", hb_id);
    // const result = resp.Result ? resp.Result.sort((a, b) => (a.LeadID > b.LeadID) ? 1 : ((b.LeadID > a.LeadID) ? -1 : 0)) : [];

    // Upload the result to s3 as a best practice since the payload size cannot be greater than 256KB
    const currentDateForFormatted = new Date().toISOString();
    const uploadToS3RespFormatted = await uploadLeadsToS3(
      rnstr,
      result,
      false,
      "",
      currentDateForFormatted,
      true
    );
    console.log(
      `uploadToS3RespFormatted: ${JSON.stringify(uploadToS3RespFormatted)}`
    );

    // Upload the lead import start status with the getLeads response
    const uploadInitiateStatusFileResp = await uploadLeadsToS3(
      rnstr,
      {
        lastLeadId,
        startDate,
        endDate,
        isLastLeadCall: !!lastLeadId,
        cdt: currentDate,
        mdt: currentDate,
        status: result.length
          ? CUSTOMER_FILE_STATUS_PROCESSING
          : CUSTOMER_FILE_STATUS_COMPLETED,
      },
      true,
      "",
      currentDate
    );
    console.log(
      `uploadInitiateStatusFileResp: ${JSON.stringify(
        uploadInitiateStatusFileResp
      )}`
    );
    return {
      isLeadsFound: !!result.length,
      leadsFileKey: uploadToS3RespFormatted.Key,
      statusFileKey: uploadInitiateStatusFileResp.key,
      count: result.length,
      ...event,
    };
  }

  // Builder id and token required for API call not found
  return {
    isLeadsFound: false,
  };
}
