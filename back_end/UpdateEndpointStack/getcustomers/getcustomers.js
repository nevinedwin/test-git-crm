import "../../NPMLayer/nodejs.zip";
import AWS from "aws-sdk";
import { invokeLambda } from "../../FunctionStack/libs/lambda";

let CUSTOMER_LAMBDA_ARN = "";
const UPDATE_ENDPOINT_STATUS_PROCESSING = "PROCESSING";
export const UPDATE_ENDPOINT_STATUS_COMPLETED = "COMPLETED";
export const UPDATE_ENDPOINT_FILE_STATUS_FAILED = "FAILED";
const { FILE_MANAGER_BUCKET_NAME } = process.env;
const s3 = new AWS.S3({ apiVersion: "2006-03-01" });

export const uploadToS3 = async (
  rnstr,
  customers,
  isStatus = false,
  statusFileKey = "",
  timestamp
) => {
  // Upload status file to s3
  // console.log('fileUploadParams: ', fileUploadParams);
  try {
    let filename;
    if (isStatus) filename = "status";
    else filename = "customers";
    const fileKey = `${timestamp}_${filename}.json`;
    const customersJSONParams = {
      Bucket: FILE_MANAGER_BUCKET_NAME,
      Key: statusFileKey || `endpointUpdate/${rnstr}/${fileKey}`,
      Body: JSON.stringify(customers, null, 4),
    };
    console.log(`customersJSONParams: ${JSON.stringify(customersJSONParams)}`);
    const fileUploadResp = await s3.upload(customersJSONParams).promise();
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
    const leads =
      getObjectResp && getObjectResp.Body
        ? JSON.parse(Buffer.from(getObjectResp.Body))
        : [];
    return leads;
  } catch (error) {
    console.log(`error: ${JSON.stringify(error)}`);
    return error;
  }
};
const getCustomerList = async ({
  hbId = "",
  ExclusiveStartKey = null,
  Limit = 500,
}) => {
  let customerList = [];
  try {
    if (hbId) {
      // Get the list of customers
      const listCustomersParams = {
        httpMethod: "POST",
        pathParameters: {
          action: "listc",
        },
        body: JSON.stringify({
          hbId,
          ExclusiveStartKey,
          Limit,
        }),
      };
      console.log(
        `listCustomersParams: ${JSON.stringify(listCustomersParams)}`
      );

      // Invoke customer lambda
      const customerListResp = await invokeLambda(
        CUSTOMER_LAMBDA_ARN,
        listCustomersParams,
        false
      );
      let { Payload: customerListBody } = customerListResp;
      customerListBody = JSON.parse(customerListBody);
      customerList = customerListBody;
    }
  } catch (error) {
    console.log(
      `Exception occured in getCustomerList getCustomers UpdateEndpointStack`
    );
    console.log(error);
  }
  return customerList;
};
export async function main(event) {
  console.log(JSON.stringify(event));
  const {
    hb_id: hbId,
    rnstr,
    ExclusiveStartKey,
    statusFileKey = "",
    CustomersApiFunctionArn,
  } = event;
  const { index, step: Limit = 500 } = event.getcustomeriterator;
  CUSTOMER_LAMBDA_ARN = CustomersApiFunctionArn;
  if (hbId) {
    // Get the list of customers
    const customerListResp = await getCustomerList({
      hbId,
      ExclusiveStartKey,
      Limit,
    });
    // console.log(`customerListResp: ${JSON.stringify(customerListResp)}`);
    // Extract the customer list from the response
    const {
      hasAfter,
      ExclusiveStartKey: nextKey,
      customers: customerList,
    } = customerListResp;
    console.log(`hasAfter: ${hasAfter}`);
    console.log(`nextKey: ${JSON.stringify(nextKey)}`);
    console.log(`customerList.length: ${customerList.length}`);

    // Upload the API response to s3 for future reference
    const currentDate = new Date().toISOString();
    let uploadInitStatusResp = { Key: "" };
    // Upload a status file with PROCESSING status to indicate that the UpdateEndpoint has started
    if (index === 0) {
      uploadInitStatusResp = await uploadToS3(
        rnstr,
        {
          cdt: currentDate,
          status: UPDATE_ENDPOINT_STATUS_PROCESSING,
        },
        true,
        statusFileKey || "",
        currentDate
      );
      console.log(
        `uploadInitStatusResp: ${JSON.stringify(uploadInitStatusResp)}`
      );
    }
    return {
      ...event,
      isCustomersFound: !!customerList.length,
      customerList,
      statusFileKey: statusFileKey || uploadInitStatusResp?.Key,
      count: customerList.length,
      hasAfter,
      ExclusiveStartKey: nextKey,
      doGetCustomerExecution: !!(hasAfter && nextKey),
    };
  }

  // Builder id required for proceeding
  return {
    isCustomersFound: false,
  };
}
