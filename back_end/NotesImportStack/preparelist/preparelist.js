import "../../NPMLayer/nodejs.zip";
import { getFileFromS3 } from "../formatnotes/formatnotes";

export async function main(event) {
  console.log(event);
  const { index, step, count } = event.importiterator;
  const { validatedFileKey = "" } = event;
  // Get validated notes details from s3
  const { notes = [] } = await getFileFromS3(validatedFileKey);
  const noteList = notes.slice(index, index + step);
  console.log(
    `noteList ${index} - ${index + step}: ${JSON.stringify(noteList)}`
  );
  return {
    ...event,
    noteList,
    doImportNoteExecution: index + step < count,
  };
}
