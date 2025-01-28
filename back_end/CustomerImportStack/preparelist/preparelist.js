import "../../NPMLayer/nodejs.zip";
import { getFileFromS3 } from "../formatcustomers/formatcustomers";

export async function main(event) {
  console.log(event);
  const { index, step, count } = event.importiterator;
  const { validatedFileKey = "" } = event;
  // Get validated customer details from s3
  const { customers = [],commMappedMetro={} } = await getFileFromS3(validatedFileKey);
  const customerList = customers.slice(index, index + step);
  console.log(
    `customerList ${index} - ${index + step}: ${JSON.stringify(customerList)}`
  );
  return {
    ...event,
    customerList,
    commMappedMetro,
    doImportCustomerExecution: index + step < count,
  };
}
