/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import { getFileFromS3 } from "../formatcustomers/formatcustomers";
import { uploadStatusFileAndUpdateDB } from "../convertcsv/convertcsv";

const CUSTOMER_FILE_STATUS_COMPLETED = "COMPLETED";
const CUSTOMER_FILE_STATUS_COMPLETED_WITH_ERRORS = "COMPLETED_WITH_ERRORS";
const CUSTOMER_FILE_STATUS_FAILED = "FAILED";
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
  if (index >= count) {
    // Get the error file
    const statusFileContent = await getFileFromS3(statusFileKey);
    const { error = [] } = statusFileContent;
    const areThereErrors = !!error.length;
    const allErrors = !!(error.length === count);
    console.log(`error.length: ${error.length}`);
    console.log(`areThereErrors: ${areThereErrors}`);
    console.log(`allErrors: ${allErrors}`);
    let status;
    let statusMessage;

    // Check whether there are errors
    if (areThereErrors) {
      // There are errors. So check whether all the customer records have errors.
      if (allErrors) {
        // All records have errors. So set the status as failed.
        status = CUSTOMER_FILE_STATUS_FAILED;
        statusMessage = "Import failed";
      } else {
        // Only some of the records have errors.
        // So setting the status to completed with errors.
        status = CUSTOMER_FILE_STATUS_COMPLETED_WITH_ERRORS;
        statusMessage = "Import completed with errors";
      }
    } else {
      // No errors. So set the status to completed.
      status = CUSTOMER_FILE_STATUS_COMPLETED;
      statusMessage = "Import completed";
    }

    /* const status = areThereErrors
      ? CUSTOMER_FILE_STATUS_COMPLETED_WITH_ERRORS
      : CUSTOMER_FILE_STATUS_COMPLETED; */

    /* const statusMessage = areThereErrors
      ? "Import completed with errors"
      : "Import completed"; */
    await uploadStatusFileAndUpdateDB({
      ...statusFileContent,
      startTimestamp,
      status,
      resp: { status: true, data: statusMessage },
      statusFileKey,
      fileKey,
      formattedFileKey,
      hbId,
    });
  }
  return { ...event };
}
