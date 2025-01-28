/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import { uploadStatusFileAndUpdateDB } from "../convertcsv/convertcsv";

const CUSTOMER_FILE_STATUS_COMPLETED = "COMPLETED";
export async function main(event) {
  console.log(`event: ${JSON.stringify(event)}`);
  const {
    statusFileKey,
    fileKey,
    formattedFileKey,
    hb_id: hbId,
    startTimestamp,
  } = event;
  const { index, count } = event.importiterator;
  // Update the status of the bulk customer create with COMPLETED status
  if (index >= count)
    await uploadStatusFileAndUpdateDB({
      startTimestamp,
      status: CUSTOMER_FILE_STATUS_COMPLETED,
      resp: { status: true, data: "Import completed" },
      statusFileKey,
      fileKey,
      formattedFileKey,
      hbId,
    });
  return { ...event };
}
