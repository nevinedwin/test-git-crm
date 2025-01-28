import "../../NPMLayer/nodejs.zip";
import AWS from "aws-sdk";
import {
  uploadStatusFileAndUpdateDB,
  uploadToS3,
} from "../convertcsv/convertcsv";

const s3 = new AWS.S3({ apiVersion: "2006-03-01" });
const { FILE_MANAGER_BUCKET_NAME } = process.env;
const NOTES_FILE_STATUS_FAILED = "FAILED";

const formatBulkNotesCreateReq = (convertedNotesArr) => {
  let status = true;
  const error = [];
  const notesArr = convertedNotesArr.map((customerNote) => {
    // convert the email id to lowercase
    if (customerNote?.email)
      customerNote.email = customerNote.email?.toLowerCase();

    // convert the notes from the request to CRM resource
    customerNote.notes_list = [];
    for (const noteKey in customerNote) {
      if (noteKey.startsWith("note_") && typeof noteKey === "string") {
        // console.log(`customerNote: ${JSON.stringify(customerNote)}`);
        const noteid = noteKey.split("note_").pop();
        const subject = customerNote[`sub_${noteid}`] || "";
        const note = customerNote[noteKey];
        // console.log(`answersArr: ${JSON.stringify(answersArr)}`);
        // Check whether answers for the question is included in the request JSON
        if (subject) {
          // Add the question and answers to dgraph_list array
          customerNote.notes_list.push({ note, subject });
          // Remove the used question and answer
          delete customerNote[noteKey];
          delete customerNote[`sub_${noteid}`];
        } else {
          // Answers for the question is not available in the request JSON
          status = false;
          error.push(
            `sub_${noteid} field is missing for note_${noteid} ${
              customerNote.email ? customerNote.email : ""
            }`
          );
        }
      }
    }
    return customerNote;
  });
  return { status, notesArr, error };
};
export const getFileFromS3 = async (fileKey) => {
  const s3Params = {
    Bucket: FILE_MANAGER_BUCKET_NAME,
    Key: fileKey,
  };
  try {
    const getObjectResp = await s3.getObject(s3Params).promise();
    // console.log(getObjectResp);
    let notes =
      getObjectResp && getObjectResp.Body
        ? Buffer.from(getObjectResp.Body)
        : "";
    notes = JSON.parse(notes);
    return notes;
  } catch (error) {
    console.log("error in getFileFromS3");
    console.log(error);
    return error;
  }
};
export async function main(event) {
  let sendResponse;

  try {
    console.log(JSON.stringify(event));
    const {
      fileKey = "",
      hbId = "",
      notesFileKey = "",
      formattedFileKey = "",
      statusFileKey = "",
    } = event;
    sendResponse = ({ error = null }) => ({
      ...event,
      error,
    });
    const createStartTimestamp = new Date().toISOString();

    // Get the converted notes JSON from s3
    const convertedNotesArr = await getFileFromS3(notesFileKey);
    /* console.log(
      `convertedNotesArr: ${JSON.stringify(convertedNotesArr)}`
    ); */
    // Format the converted JSON to match the note
    const {
      status = false,
      error = null,
      notesArr,
    } = formatBulkNotesCreateReq(convertedNotesArr);
    console.log(`error: ${error}`);
    if (!status) {
      await uploadStatusFileAndUpdateDB({
        startTimestamp: createStartTimestamp,
        status: NOTES_FILE_STATUS_FAILED,
        resp: [],
        error,
        statusFileKey,
        fileKey,
        formattedFileKey,
        hbId,
      });
      return sendResponse({ error });
    }
    // console.log(`notesArr: ${JSON.stringify(notesArr)}`);

    // Upload the formatted note arr to S3
    const formatEndTimestamp = new Date().toISOString();
    const formattedJSONContent = {
      start: createStartTimestamp,
      end: formatEndTimestamp,
      notes: notesArr,
    };
    await uploadToS3(formattedFileKey, formattedJSONContent);
    return sendResponse({});
  } catch (error) {
    console.log(`error`);
    console.log(error);
    return sendResponse({ error });
  }
}
