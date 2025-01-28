/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import { uploadStatusFileAndUpdateDB } from "../convertcsv/convertcsv";

const CUSTOMER_FILE_STATUS_FAILED = "FAILED";
export async function main(event) {
  console.log(`event: ${JSON.stringify(event)}`);
  const {
    statusFileKey,
    error,
    fileKey,
    formattedFileKey,
    hbId,
    startTimestamp,
    field,
  } = event;
  // Validation error occured
  // Upload status file to s3
  await uploadStatusFileAndUpdateDB({
    startTimestamp,
    status: CUSTOMER_FILE_STATUS_FAILED,
    error,
    statusFileKey,
    fileKey,
    formattedFileKey,
    hbId,
    field,
  });
  return { ...event };
}
