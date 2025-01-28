/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import {
  getRecordByEntity
} from "../libs/db";
import { failure, success } from "../libs/response-lib";

const getBulkRealtorStatus = async (data) => {
  console.log(`data: ${JSON.stringify(data)}`);
  const { hb_id: hbId = "" } = data;
  if (!hbId) {
    return failure({ status: false, error: "Home builder Id is missing" });
  }

  const bulkRealtorCreateStatusResp = await getRecordByEntity(
    `realtor_create_status#${hbId}`
  );
  // console.log(`bulkRealtorCreateStatusResp: ${JSON.stringify(bulkRealtorCreateStatusResp)}`);
  return success(bulkRealtorCreateStatusResp);
};

export async function main(event) {
  let response;
  try {
    console.log(`event: ${JSON.stringify(event)}`);
    const action =
      event && event.pathParameters && event.pathParameters.action
        ? event.pathParameters.action
        : "";
    const isExternalAPI =
      event && event.path ? event.path.includes("external") : false;
    const isExternalBulkRealtor =
      event && event.path ? event.path.includes("bulkrealtors") : false;
    const isExternalRealtorCreate =
      event && event.path ? event.path.includes("create") : false;
    console.log(`isExternalBulkRealtor: ${isExternalBulkRealtor}`);
    console.log(`isExternalRealtorCreate: ${isExternalRealtorCreate}`);
    console.log(`isExternalAPI: ${isExternalAPI}`);
    if (event.source !== "aws.events") {
      let data;
      switch (event.httpMethod) {
        case "POST":
          data = JSON.parse(event.body);
          if (!data) {
            response = failure();
          } else if (action === "getstatus") {
            response = await getBulkRealtorStatus(data);
          } else {
            response = failure();
          }
          break;
        default:
          response = failure();
      }
    }
    console.log(`response: ${JSON.stringify(response)}`);
  } catch (err) {
    console.log(`Exception in bulkrealtor lambda: ${err}`);
    return err;
  }
  return response;
}
