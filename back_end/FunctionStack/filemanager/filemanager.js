/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import AWS from "aws-sdk";
import Jimp from "jimp/es";
import Busboy from "busboy";
import { v4 as uuidv4 } from "uuid";
import { getResourceJSON, postResources, getRecordByEntity } from "../libs/db";
import { invokeLambda } from "../libs/lambda";
import { failure, success, badRequest } from "../libs/response-lib";

const sfn = new AWS.StepFunctions();
const s3 = new AWS.S3();
const {
  S3_BUCKET_ARN,
  S3_BUCKET_REG_DOMAIN,
  BULK_CUSTOMER_CREATE_LAMBDA_ARN,
  BULK_AGENCY_CREATE_LAMBDA_ARN,
  CUSTOMER_IMPORT_MACHINE_ARN,
  NOTES_IMPORT_MACHINE_ARN,
  COBUYERS_IMPORT_MACHINE_ARN,
  REALTORS_IMPORT_MACHINE_ARN
} = process.env;
const getContentType = (event) => {
  const contentType = event.headers["content-type"];
  if (!contentType) {
    return event.headers["Content-Type"];
  }
  return contentType;
};

const parser = (event) =>
  new Promise((resolve, reject) => {
    const busboy = new Busboy({
      headers: {
        "content-type": getContentType(event),
      },
    });

    const result = {};
    busboy
      .on("file", (fieldname, file, filename, encoding, mimetype) => {
        console.log(
          "File [%s]: filename=%j; encoding=%j; mimetype=%j",
          fieldname,
          filename,
          encoding,
          mimetype
        );
        file
          .on("data", (data) => {
            console.log("File [%s] got %d bytes", fieldname, data.length);
            console.log("data: ", data);
            result[fieldname] = { data, filename, size: data.length };
          })
          .on("end", () => {
            console.log("File [%s] Finished", fieldname);
          });
      })
      .on("field", (fieldname, val) => {
        console.log("Field [%s]: value: %j", fieldname, val);
        result[fieldname] = val;
      })
      .on("finish", () => {
        console.log("Done parsing form!");
        event.body = result;
        resolve(event);
      })
      .on("error", (error) => reject(new Error(`Parse error: ${error}`)));
    busboy.write(event.body, event.isBase64Encoded ? "base64" : "binary");
    busboy.end();
  });
const uploadFile = async (event) => {
  // const fileParsed = multipart.parse(event, true);
  const body = Buffer.from(event.body.toString(), "base64");
  event.body = body;
  console.log("body: ", body);
  const fileParsed = await parser(event);
  console.log("fileParsed: ", fileParsed);
  const pathString =
    fileParsed && fileParsed.body && fileParsed.body.path
      ? fileParsed.body.path
      : "";
  console.log("pathString: ", pathString);
  const fileObject =
    fileParsed && fileParsed.body && fileParsed.body.file
      ? fileParsed.body.file
      : {};
  console.log("fileObject: ", fileObject);
  const fileName = fileObject.filename ? fileObject.filename : "";
  console.log("fileName: ", fileName);
  const fileSize = fileObject.size ? fileObject.size : 0;
  console.log("fileSize: ", fileSize);

  const fileObjectThumb =
    fileParsed && fileParsed.body && fileParsed.body.file_thumb
      ? fileParsed.body.file_thumb
      : {};
  console.log("fileObjectThumb: ", fileObjectThumb);

  // 4MB File Size Limit
  const FILE_SIZE_LIMIT = 4194304;
  // const fileType = file.type ? file.type : '';
  const fileContent = fileObject.data ? fileObject.data : {};

  const fileContentThumb = fileObjectThumb.data ? fileObjectThumb.data : {};

  if (fileSize <= FILE_SIZE_LIMIT) {
    try {
      const params = {
        Bucket: S3_BUCKET_ARN,
        Key: `${pathString}/${fileName}`,
        Body: fileContent,
      };
      console.log("params: ", params);

      let resizedParams = {};

      if (fileParsed.body && fileParsed.body.file_thumb) {
        resizedParams = {
          Bucket: S3_BUCKET_ARN,
          Key: `${pathString}/thumb_${fileName}`,
          Body: fileContentThumb,
        };
      } else {
        const JimReadRes = await Jimp.read(params.Body);
        console.log(`Jimp success`);
        JimReadRes.resize(500, Jimp.AUTO);
        console.log(`Jimp Resize success`);
        const imageBuffer = await JimReadRes.getBufferAsync(Jimp.AUTO);
        console.log(`Jimp Buffer success`);
        resizedParams = {
          Bucket: S3_BUCKET_ARN,
          Key: `${pathString}/thumb_${fileName}`,
          Body: imageBuffer,
        };
      }

      console.log("resizedParams: ", resizedParams);
      const [s3UploadResp, resizedS3UploadResp] = await Promise.all([
        s3.upload(params).promise(),
        s3.upload(resizedParams).promise(),
      ]);
      console.log(`s3UploadResp: ${JSON.stringify(s3UploadResp)}`);
      console.log(
        `resizedS3UploadResp: ${JSON.stringify(resizedS3UploadResp)}`
      );
      return success({
        s3UploadResp,
        resizedS3UploadResp,
      });
    } catch (e) {
      console.log(`e: ${JSON.stringify(e.stack)}`);
      return failure(e);
    }
  } else {
    return badRequest({ error: "File size should not be greater than 4MB." });
  }
};
export const getDocumentPath = async () => {
  console.log(`in getDocumentPath`);
  const params = {
    TableName: process.env.entitiesTableName,
    IndexName: process.env.entitiesTableByEntityAndId,
    KeyConditionExpression: "#entity = :entity",
    ExpressionAttributeNames: {
      "#entity": "entity",
    },
    ExpressionAttributeValues: {
      ":entity": `extdoc`,
    },
  };
  console.log(params);
  return getResourceJSON(params);
};
const uploadFileWithoutThumb = async (event) => {
  // const fileParsed = multipart.parse(event, true);
  const body = Buffer.from(event.body.toString(), "base64");
  event.body = body;
  console.log("body: ", body);
  const fileParsed = await parser(event);
  console.log("fileParsed: ", fileParsed);
  const pathString =
    fileParsed && fileParsed.body && fileParsed.body.path
      ? fileParsed.body.path
      : "";
  console.log("pathString: ", pathString);
  const fileObject =
    fileParsed && fileParsed.body && fileParsed.body.file
      ? fileParsed.body.file
      : {};
  console.log("fileObject: ", fileObject);
  const fileType =
    fileParsed && fileParsed.body && fileParsed.body.type
      ? fileParsed.body.type
      : "";
  console.log("fileType: ", fileType);
  const hbId =
    fileParsed && fileParsed.body && fileParsed.body.hb_id
      ? fileParsed.body.hb_id
      : "";
  console.log("hbId: ", hbId);
  const fileName = fileObject.filename ? fileObject.filename : "";
  console.log("fileName: ", fileName);
  const fileSize = fileObject.size ? fileObject.size : 0;
  console.log("fileSize: ", fileSize);

  // 4MB File Size Limit
  const FILE_SIZE_LIMIT = 4194304;
  // const fileType = file.type ? file.type : '';
  const fileContent = fileObject.data ? fileObject.data : "";

  if (!fileContent && fileSize === 0) {
    return badRequest({ error: "File is empty" });
  }

  // appending timestamp at the end of the file key for bulk customer create files
  const fileKey = `${pathString}/${
    fileType === "customer_file" ? `${new Date().toISOString()}_` : ``
  }${fileName}`;
  if (fileSize <= FILE_SIZE_LIMIT) {
    try {
      const params = {
        Bucket: S3_BUCKET_ARN,
        Key: fileKey,
        Body: fileContent,
      };
      console.log("params: ", params);
      const s3UploadResp = await s3.upload(params).promise();
      console.log(`s3UploadResp: ${JSON.stringify(s3UploadResp)}`);

      // Save the document file path in DB if type is 'api_document'
      if (fileType === "api_document") {
        // Check whether the document path resource exists
        const getDocumentPathResp = await getDocumentPath();
        console.log(
          `getDocumentPathResp: ${JSON.stringify(getDocumentPathResp)}`
        );

        // Check whether the result is empty
        let documentPathParams;
        let id;
        const type = `extdoc`;
        let cdt;
        if (getDocumentPathResp && getDocumentPathResp.length === 0) {
          // Create document path resource since there isn't any
          id = uuidv4();
          cdt = Date.now();
          documentPathParams = {
            TableName: process.env.entitiesTableName,
            Item: {
              id,
              type,
              cdt,
              mdt: cdt,
              entity: type,
              path: fileKey,
            },
          };
        } else {
          id =
            getDocumentPathResp[0] && getDocumentPathResp[0].id
              ? getDocumentPathResp[0].id
              : "";
          cdt =
            getDocumentPathResp[0] && getDocumentPathResp[0].cdt
              ? getDocumentPathResp[0].cdt
              : 0;
          const mdt = Date.now();
          documentPathParams = {
            TableName: process.env.entitiesTableName,
            Item: {
              id,
              type,
              cdt,
              mdt,
              entity: type,
              path: fileKey,
            },
          };
        }
        console.log(documentPathParams);
        const addAPIDocPathResp = await postResources(documentPathParams);
        console.log(`addAPIDocPathResp: ${JSON.stringify(addAPIDocPathResp)}`);
      } else if (fileType === "customer_file") {
        // Invoke bulkcustomer lambda to initiate the process of customer creation
        const bulkCustomersFileParams = {
          Bucket: S3_BUCKET_ARN,
          hb_id: hbId,
          fileKey,
        };
        console.log(
          `bulkCustomersFileParams: ${JSON.stringify(bulkCustomersFileParams)}`
        );
        const bulkCustomerLambdaEvent = {
          httpMethod: "POST",
          pathParameters: {
            action: "initCreate",
          },
          body: bulkCustomersFileParams,
        };
        console.log(
          `bulkCustomerLambdaEvent: ${JSON.stringify(bulkCustomerLambdaEvent)}`
        );
        await invokeLambda(
          BULK_CUSTOMER_CREATE_LAMBDA_ARN,
          bulkCustomerLambdaEvent,
          true
        );
      }
      // if (fileType === 'api_document') {
      //     console.log(" ")
      //     console.log(" ")
      //     try {
      //         cloudfront.createInvalidation({
      //             DistributionId: FILE_MANAGER_DIST_ID,
      //             InvalidationBatch: { CallerReference: Date.now().toString(), Paths: { Quantity: 1, Items: ['/*'] } }
      //         }, function (err, data) {
      //             if (err) { console.log(err, err.stack); } else { console.log(data); }
      //         });
      //     } catch (error) {
      //         console.log(error)
      //     }
      //     console.log(" ")
      //     console.log(" ")
      // }
      return success({
        s3UploadResp,
      });
    } catch (e) {
      console.log(`e: ${JSON.stringify(e.stack)}`);
      return failure(e);
    }
  } else {
    return badRequest({ error: "File size should not be greater than 4MB." });
  }
};
const getAPIDocument = async () => {
  const apiDocumentResp = await getRecordByEntity(`extdoc`);
  console.log(`apiDocumentResp: ${JSON.stringify(apiDocumentResp)}`);
  return success(apiDocumentResp);
};
const listObjects = async (data) => {
  /* const hbid = data.hbid ? data.hbid : '';
    const fileName = data.filenm ? data.filenm : '';
    */
  const { folderPath } = data;
  if (folderPath) {
    const pathSplitted = folderPath.split("/");
    if (pathSplitted.length > 1) {
      console.log("S3_BUCKET_ARN: ", S3_BUCKET_ARN);
      const params = {
        Bucket: S3_BUCKET_ARN,
        Delimiter: "/",
        Prefix: folderPath,
      };
      console.log("params: ", params);
      try {
        const s3GetResp = await s3.listObjectsV2(params).promise();
        s3GetResp.RegionalDomainName = S3_BUCKET_REG_DOMAIN;
        console.log("s3GetResp: ", s3GetResp);
        return success(s3GetResp);
      } catch (e) {
        console.log(`e: ${JSON.stringify(e.stack)}`);
        return failure(e);
      }
    } else {
      console.log(`path: ${JSON.stringify(data)}`);
      return failure({ error: "InCorrect Path" });
    }
  } else {
    console.log(`path: ${JSON.stringify(data)}`);
    return failure({ error: "folderPath not found" });
  }
};
export const createFolder = async (data) => {
  const folderName = data.name ? data.name : "";
  if (folderName.trim()) {
    const params = {
      Bucket: S3_BUCKET_ARN,
      Key: `${folderName}/`,
      Body: "HyphenCRM",
    };
    console.log("params: ", params);
    try {
      const s3UploadFolderResp = await s3.upload(params).promise();
      console.log("s3UploadFolderResp: ", s3UploadFolderResp);
      return success(s3UploadFolderResp);
    } catch (e) {
      console.log(`e: ${JSON.stringify(e.stack)}`);
      return failure(e);
    }
  } else {
    return failure({ error: "Empty Field" });
  }
};
const resursiveDelete = async (folderName) => {
  const getFilesLisParam = {
    Bucket: S3_BUCKET_ARN,
    Delimiter: "/",
    Prefix: folderName,
  };
  console.log("getFilesLisParam: ", getFilesLisParam);

  const getFilesListResp = await s3.listObjectsV2(getFilesLisParam).promise();
  console.log("getFilesListResp: ", getFilesListResp);

  if (
    getFilesListResp &&
    getFilesListResp.CommonPrefixes &&
    getFilesListResp.CommonPrefixes.length > 0
  ) {
    getFilesListResp.CommonPrefixes.forEach(async (fileItem1) => {
      if (folderName !== fileItem1.Prefix) {
        const resursiveResp = await resursiveDelete(fileItem1.Prefix);
        console.log(`resursiveResp ${JSON.stringify(resursiveResp)}`);
      }
    });
  }

  const objectsList = [
    {
      Key: `${folderName}`,
    },
  ];

  if (
    getFilesListResp &&
    getFilesListResp.Contents &&
    getFilesListResp.Contents.length > 0
  ) {
    getFilesListResp.Contents.forEach((fileItem1) => {
      objectsList.push({
        Key: fileItem1.Key,
      });
    });
  }

  const deleteFilesParam = {
    Bucket: S3_BUCKET_ARN,
    Delete: {
      Objects: [],
      Quiet: false,
    },
  };

  console.log(`objectsList ${JSON.stringify(objectsList)}`);

  deleteFilesParam.Delete.Objects = objectsList;

  console.log(`deleteFilesParam ${JSON.stringify(deleteFilesParam)}`);

  return s3.deleteObjects(deleteFilesParam).promise();
};
const deleteObject = async (data) => {
  try {
    console.log(`deleteObject data ${JSON.stringify(data)}`);
    const folderName = data.name ? data.name : "";

    if (folderName.trim()) {
      const pathSplittedSlash = folderName.split("/");

      if (pathSplittedSlash.length > 1) {
        const pathSplittedDot = folderName.split(".");
        const extension = pathSplittedDot.pop();

        if (extension && extension !== folderName) {
          const filename = pathSplittedSlash.pop();

          const deleteFileParams = {
            Bucket: S3_BUCKET_ARN,
            Delete: {
              Objects: [
                { Key: `${folderName}` },
                { Key: `${pathSplittedSlash.join("/")}/thumb_${filename}` },
              ],
              Quiet: false,
            },
          };

          console.log(`deleteFileParams ${JSON.stringify(deleteFileParams)}`);

          const deleteFileRes = await s3
            .deleteObjects(deleteFileParams)
            .promise();
          console.log(`deleteFileRes ${JSON.stringify(deleteFileRes)}`);

          return success(deleteFileRes);
        }

        const recursiveDeleteResp = await resursiveDelete(folderName);
        console.log(
          `recursiveDeleteResp ${JSON.stringify(recursiveDeleteResp)}`
        );

        return success(recursiveDeleteResp);
      }
      return failure({ error: "InCorrect Path" });
    }
    return failure({ error: "Empty Field" });
  } catch (e) {
    console.log(`e: ${JSON.stringify(e.stack)}`);
    return failure(e);
  }
};
const initBulkCustomerCreate = async (data) => {
  console.log(`data: ${JSON.stringify(data)}`);
  const { fileKey = "", hb_id: hbId = "" } = data;
  const bulkCustomersFileParams = {
    hb_id: hbId,
    fileKey,
    skipToCustomerImport: false,
  };
  console.log(
    `bulkCustomersFileParams: ${JSON.stringify(bulkCustomersFileParams)}`
  );
  const input = JSON.stringify(bulkCustomersFileParams);
  const params = {
    input,
    stateMachineArn: CUSTOMER_IMPORT_MACHINE_ARN,
  };
  try {
    console.log(`params: ${JSON.stringify(params)}`);
    const startExecutionResp = await sfn.startExecution(params).promise();
    console.log(`startExecutionResp: ${JSON.stringify(startExecutionResp)}`);
    return success({ status: true });
  } catch (error) {
    console.log(`error`);
    console.log(error);
    return failure({ status: false, error });
  }
};
const initNotesImport = async (data) => {
  console.log(`data: ${JSON.stringify(data)}`);
  const { fileKey = "", hb_id: hbId = "" } = data;
  const notesImportParams = {
    hb_id: hbId,
    fileKey,
    skipToNoteImport: false,
  };
  console.log(`notesImportParams: ${JSON.stringify(notesImportParams)}`);
  const input = JSON.stringify(notesImportParams);
  const params = {
    input,
    stateMachineArn: NOTES_IMPORT_MACHINE_ARN,
  };
  try {
    console.log(`params: ${JSON.stringify(params)}`);
    const startExecutionResp = await sfn.startExecution(params).promise();
    console.log(`startExecutionResp: ${JSON.stringify(startExecutionResp)}`);
    return success({ status: true });
  } catch (error) {
    console.log(`error`);
    console.log(error);
    return failure({ status: false, error });
  }
};
const initCobuyersImport = async (data) => {
  console.log(`data: ${JSON.stringify(data)}`);
  const { fileKey = "", hb_id: hbId = "" } = data;
  const cobuyersImportParams = {
    hb_id: hbId,
    fileKey,
    skipToCobuyerImport: false,
  };
  console.log(`cobuyersImportParams: ${JSON.stringify(cobuyersImportParams)}`);
  const input = JSON.stringify(cobuyersImportParams);
  const params = {
    input,
    stateMachineArn: COBUYERS_IMPORT_MACHINE_ARN,
  };
  try {
    console.log(`params: ${JSON.stringify(params)}`);
    const startExecutionResp = await sfn.startExecution(params).promise();
    console.log(`startExecutionResp: ${JSON.stringify(startExecutionResp)}`);
    return success({ status: true });
  } catch (error) {
    console.log(`error`);
    console.log(error);
    return failure({ status: false, error });
  }
};

const initBulkRealtorCreate = async (data) => {
  console.log(`data: ${JSON.stringify(data)}`);
  const { fileKey = "", hb_id: hbId = "" } = data;
  // Invoke bulkcustomer lambda to initiate the process of realtor creation
  const bulkRealtorImportParams = {
    hb_id: hbId,
    fileKey,
  };
  console.log(
    `bulkRealtorImportParams: ${JSON.stringify(bulkRealtorImportParams)}`
  );
  const input = JSON.stringify(bulkRealtorImportParams);
  const params = {
    input,
    stateMachineArn: REALTORS_IMPORT_MACHINE_ARN
  };
  try {
    console.log(`params: ${JSON.stringify(params)}`);
    const startExecutionResp = await sfn.startExecution(params).promise();
    console.log(`startExecutionResp: ${JSON.stringify(startExecutionResp)}`);
    return success({ status: true });
  } catch (error) {
    console.log(`error`);
    console.log(error);
    return failure({ status: false, error });
  }
};

const initBulkAgencyCreate = async (data) => {
  console.log(`data: ${JSON.stringify(data)}`);
  const { fileKey = "", hb_id: hbId = "" } = data;
  // Invoke bulkcustomer lambda to initiate the process of agency creation
  const bulkAgencyFileParams = {
    hb_id: hbId,
    fileKey,
  };
  console.log(`bulkAgencyFileParams: ${JSON.stringify(bulkAgencyFileParams)}`);
  const bulkAgencyLambdaEvent = {
    httpMethod: "POST",
    pathParameters: {
      action: "initCreate",
    },
    body: JSON.stringify(bulkAgencyFileParams),
  };
  console.log(
    `bulkAgencyLambdaEvent: ${JSON.stringify(bulkAgencyLambdaEvent)}`
  );
  await invokeLambda(
    BULK_AGENCY_CREATE_LAMBDA_ARN,
    bulkAgencyLambdaEvent,
    true
  );
  return success({ status: true });
};

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */
export async function main(event) {
  let response;
  try {
    console.log(`event: ${JSON.stringify(event)}`);
    const action =
      event && event.pathParameters && event.pathParameters.action
        ? event.pathParameters.action
        : 0;
    const isUpload = !!(action === "upload" || action === "uploadwt");
    let data;
    switch (event.httpMethod) {
      case "POST":
        if (!isUpload) {
          data = JSON.parse(event.body);
        } else {
          data = event.body;
        }
        if (!data) {
          response = failure();
        } else if (action === "list") {
          response = await listObjects(data);
        } else if (action === "create") {
          response = await createFolder(data);
        } else if (action === "delete") {
          response = await deleteObject(data);
        } else if (isUpload && action === "upload") {
          response = await uploadFile(event);
        } else if (isUpload && action === "uploadwt") {
          response = await uploadFileWithoutThumb(event);
        } else if (action === "getapidoc") {
          response = await getAPIDocument();
        } else if (action === "initCreate") {
          response = await initBulkCustomerCreate(data);
        } else if (action === "initNote") {
          response = await initNotesImport(data);
        } else if (action === "initCobuyer") {
          response = await initCobuyersImport(data);
        } else if (action === "initRealtorCreate") {
          response = await initBulkRealtorCreate(data);
        } else if (action === "initAgencyCreate") {
          response = await initBulkAgencyCreate(data);
        } else {
          response = failure();
        }
        break;
      default:
        response = failure();
    }
  } catch (err) {
    console.log(`Exception in filemanager lambda: ${err}`);
    return failure({ status: false, error: err });
  }

  return response;
}
