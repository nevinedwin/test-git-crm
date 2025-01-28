import "../../NPMLayer/nodejs.zip";
import axios from "axios";
import https from "https";
import aws4 from "aws4";
import AWS from "aws-sdk";
import { getMessagingParams } from "../builders/builders";



const credentials = new AWS.EnvironmentCredentials("AWS");
export const publishEntityData = async ({
  entityId,
  entityType,
  isCreate,
  isBrix,
  isHomefront = false,
  messageId: id,
  messagingParams = false,
  isDelete = false,
  HomebuilderID_HF = "",
  Id = "",
  OpportunityID = "",
  OpportunityIDHyphen = "",
  HomebuilderID = "",
}) => {
  console.log("entityId: ", entityId);
  let dataString = "";
  let data;
  if (isBrix) {
    data = { customerId: entityId };
  } else if (isDelete) {
    data = { entityId, entityType, HomebuilderID_HF, Id, HomebuilderID };
  } else {
    data = { entityId, entityType, HomebuilderID };
  }
  if (isDelete && isHomefront) {
    data.OpportunityID = OpportunityID;
    data.OpportunityID_Hyphen = OpportunityIDHyphen;
  }
  let body = {
    specversion: "1.0",
    source: "https://www.hyphensolutions.com/crm",
    id,
    time: new Date().toISOString(),
    datacontenttype: "application/json",
    type: `${isBrix ? `com-crm-customerData` : `com-homefront-entitydata`}`,
    subject: "",
    data,
  };
  if (isCreate) {
    body.subject = "create";
  } else if (isDelete) {
    body.subject = "delete";
  } else {
    body.subject = "update";
  }
  body = JSON.stringify(body);
  const messagingParamsResp =
    messagingParams || (await getMessagingParams(true));
  // Brix endpoints
  const messagingPostPath = messagingParamsResp.publishPath
    ? messagingParamsResp.publishPath
    : "";
  const messagingPostHost = messagingParamsResp.publishHost
    ? messagingParamsResp.publishHost
    : "";

  // Homefront endpoints
  const {
    publishHostHf = "",
    publishPathHf = "",
    keyValHf = "",
  } = messagingParamsResp;

  // Brix

  if (isBrix && messagingPostPath && messagingPostHost) {
    console.log("Bxix_messagingPostPath: ", messagingPostPath);
    console.log("Brix_messagingPostHost: ", messagingPostHost);

    const path = messagingPostPath;
    const hostname = messagingPostHost;

    const options = {
      hostname,
      path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
      region: "us-west-2",
      service: "execute-api",
    };

    const opts = aws4.sign(options, {
      secretAccessKey: credentials.secretAccessKey,
      accessKeyId: credentials.accessKeyId,
      sessionToken: credentials.sessionToken,
    });

    console.log("body: ", body);
    console.log("options", options);
    let postRequestResp;

    try {
      postRequestResp = await new Promise((resolve, reject) => {
        const req = https.request(opts, (res) => {
          console.log(`statusCode: ${res.statusCode}`);
          res.on("data", (chunk) => {
            // process.stdout.write(d)
            dataString += chunk;
          });
          res.on("end", () => {
            resolve({
              body: JSON.stringify(JSON.parse(dataString), null, 4),
            });
          });
        });

        req.on("error", (error) => {
          console.error(error);
          reject(
            new Error({
              body: JSON.stringify(error),
            })
          );
        });

        req.write(body);
        req.end();
      });
      console.log("postRequestResp: ", postRequestResp);
    } catch (error) {
      console.log(`postRequestResp error: ${error}`);
      postRequestResp = error;
    }
    return postRequestResp;
  }

  // Homefront
  if (isHomefront && publishHostHf && publishPathHf && keyValHf) {
    console.log("publishHostHf: ", publishHostHf);
    console.log("publishPathHf: ", publishPathHf);
    console.log("keyValHf: ", keyValHf);
    const options = {
      method: "post",
      url: `${publishHostHf.trim()}${publishPathHf.trim()}`,
      data: body,
      headers: {
        "Content-Type": "application/json",
        ApiKey: keyValHf,
        "Content-Length": body.length,
      },
    };

    console.log("body: ", body);
    console.log("options", options);
    let postRequestResp;
    try {
      const resp = await axios(options);
      postRequestResp = resp.data
      console.log("postRequestResp: ", postRequestResp);
    } catch (error) {
      console.log(`postRequestResp error: ${error}`);
      postRequestResp = error;
    }

    return postRequestResp;
  }

  // if (
  //   (isBrix && messagingPostPath && messagingPostHost) ||
  //   (isHomefront && publishHostHf && publishPathHf && keyValHf)
  // ) {
  //   const path = isBrix ? messagingPostPath : publishPathHf;
  //   // For Homefront
  //   const isHttp = publishHostHf?.split("http://");
  //   let hostname;
  //   if (isBrix) {
  //     hostname = messagingPostHost;
  //   } else if (isHttp && isHttp.length === 2) {
  //     [, hostname] = isHttp;
  //   } else {
  //     hostname = publishHostHf;
  //   }
  //   let protocol;
  //   if (isBrix) {
  //     protocol = https;
  //   } else if (isHttp && isHttp.length === 2) {
  //     protocol = http;
  //   } else {
  //     protocol = https;
  //   }
  //   const options = {
  //     hostname,
  //     path,
  //     method: "POST",
  //     headers: {
  //       "Content-Type": "application/json",
  //     },
  //     body,
  //     region: "us-west-2",
  //     service: "execute-api",
  //   };
  //   if (isHomefront) {
  //     options.headers.ApiKey = keyValHf;
  //     options.headers["Content-Length"] = body.length;
  //   }
  //   const opts = aws4.sign(options, {
  //     secretAccessKey: credentials.secretAccessKey,
  //     accessKeyId: credentials.accessKeyId,
  //     sessionToken: credentials.sessionToken,
  //   });
  //   console.log("body: ", body);
  //   console.log("options", options);
  //   let postRequestResp;
  //   try {
  //     postRequestResp = await new Promise((resolve, reject) => {
  //       const req = protocol.request(isBrix ? opts : options, (res) => {
  //         console.log(`statusCode: ${res.statusCode}`);
  //         res.on("data", (chunk) => {
  //           // process.stdout.write(d)
  //           dataString += chunk;
  //         });
  //         res.on("end", () => {
  //           resolve({
  //             body: JSON.stringify(JSON.parse(dataString), null, 4),
  //           });
  //         });
  //       });

  //       req.on("error", (error) => {
  //         console.error(error);
  //         reject(
  //           new Error({
  //             body: JSON.stringify(error),
  //           })
  //         );
  //       });

  //       req.write(body);
  //       req.end();
  //     });
  //     console.log("postRequestResp: ", postRequestResp);
  //   } catch (error) {
  //     console.log(`postRequestResp error: ${error}`);
  //     postRequestResp = error;
  //   }
  //   return postRequestResp;
  // }
  return {
    status: false,
    error: `Messaging failed. Invalid/missing messaging parameters.`,
  };
};
