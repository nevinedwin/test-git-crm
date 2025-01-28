/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import AWS from "aws-sdk";
import { failure, success } from "../libs/response-lib";
import { initLambdaInvoke } from "../libs/lambda";

const s3 = new AWS.S3();
const cloudfront = new AWS.CloudFront();
const cloudformation = new AWS.CloudFormation();
const { S3_BUCKET_ARN, StackName,ADMIN_API_LAMBDA_ARN } = process.env;
export const exportlistdata = async (data) => {
  try {
    console.log(`exportlistdata data: ${JSON.stringify(data)}`);
    const { hb_id: hbId = "", listType, rnstr } = data;
    let listResp = "";
    if (hbId && listType && rnstr) {
      listResp = await initLambdaInvoke({
        action: "list",
        type: "",
        httpMethod: "POST",
        body: {
          hbid: hbId,
          type: listType
        },
        arn: ADMIN_API_LAMBDA_ARN,
      });
      console.log(`listResp: ${JSON.stringify(listResp)}`);
    } else {
      return failure({ error: "Home Builder ID, listType and rnstr Required" });
    }

    const s3FileUploadLink = `export_data/${rnstr}/${listType}.csv`;

    let listResponse = [];
    if (listResp && listResp.body && listResp.body.length) {
      const listRespVar = JSON.parse(listResp.body);
      switch (listType) {
        case "community":
        case "metro":
        case "exp":
        case "spec":
        case "grade":
        case "desf":
        case "psrc":
        case "infl":
        case "cntm":
          listResponse = listRespVar.map(({ id, name }) => ({ id, name }));
          break;
        case "agency":
          listResponse = listRespVar.map(({ id, cname, tname }) => ({
            id,
            cname,
            tname,
          }));
          break;
        case "realtor":
          listResponse = listRespVar.map(({ id, fname, lname }) => ({
            id,
            fname,
            lname,
          }));
          break;
        default:
          break;
      }
      console.log(`listResponse: ${JSON.stringify(listResponse)}`);
    }
    let listCSVResponse = "";
    if (listResponse && listResponse.length) {
      const replacer = (key, value) => (value === null ? "" : value);
      const header = Object.keys(listResponse[0]);
      const csv = listResponse.map((row) =>
        header
          .map((fieldName) => JSON.stringify(row[fieldName], replacer))
          .join(",")
      );
      csv.unshift(header.join(","));
      listCSVResponse = csv.join("\r\n");
      let s3UploadResp = "";
      if (listCSVResponse) {
        const s3UploadParams = {
          Bucket: S3_BUCKET_ARN,
          Key: s3FileUploadLink,
          Body: listCSVResponse,
        };
        console.log("s3UploadParams: ", s3UploadParams);
        s3UploadResp = await s3.upload(s3UploadParams).promise();
        console.log(`s3UploadResp: ${JSON.stringify(s3UploadResp)}`);
      }
      let describeStacksResp = "";
      if (s3UploadResp && s3UploadResp.key) {
        if (StackName) {
          const describeStackParams = { StackName };
          console.log(
            `describeStackParams: ${JSON.stringify(describeStackParams)}`
          );
          describeStacksResp = await cloudformation
            .describeStacks(describeStackParams)
            .promise();
          console.log(
            `describeStacksResp: ${JSON.stringify(describeStacksResp)}`
          );
        }
      }
      let fileManagerDistId = "";
      if (
        describeStacksResp &&
        describeStacksResp.Stacks &&
        describeStacksResp.Stacks[0] &&
        describeStacksResp.Stacks[0].Outputs
      ) {
        fileManagerDistId = describeStacksResp.Stacks[0].Outputs.filter(
          (outputItem) => outputItem.OutputKey === "HyphenCRMDistributionId"
        );
        console.log(`fileManagerDistId: ${JSON.stringify(fileManagerDistId)}`);
      }
      let createInvalidationResp = "";
      if (
        fileManagerDistId &&
        fileManagerDistId[0] &&
        fileManagerDistId[0].OutputValue
      ) {
        const createInvalidationParams = {
          DistributionId: fileManagerDistId[0].OutputValue,
          InvalidationBatch: {
            CallerReference: Date.now().toString(),
            Paths: { Quantity: 1, Items: [`/${s3FileUploadLink}`] },
          },
        };
        console.log(
          `createInvalidationParams: ${JSON.stringify(
            createInvalidationParams
          )}`
        );
        createInvalidationResp = await cloudfront
          .createInvalidation(createInvalidationParams)
          .promise();
        console.log(
          `createInvalidationResp: ${JSON.stringify(createInvalidationResp)}`
        );
      }
      if (createInvalidationResp && createInvalidationResp.Invalidation) {
        return success({ key: s3FileUploadLink });
      }
      return failure({
        status: false,
        error: { s3UploadResp, describeStacksResp, createInvalidationResp },
      });
    }

    return success({ status: false, error: `No Data Found to Export` })
  } catch (error) {
    console.log(`error: ${JSON.stringify(error.stack)}`);
    return failure({ error: JSON.stringify(error.stack) });
  }
};

export async function main(event) {
  let response;
  try {
    let data;
    switch (event.httpMethod) {
      case "GET":
        response = failure();
        break;
      case "POST":
        data = JSON.parse(event.body);
        if (!data) {
          response = failure();
        } else {
          response = await exportlistdata(data);
        }
        break;
      default:
        response = failure();
    }
  } catch (err) {
    console.log(err);
    return failure({ status: false, error: err });
  }

  return response;
}
