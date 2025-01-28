import "../../NPMLayer/nodejs.zip";
import AWS from "aws-sdk";
import path from "path";

const { ES_REGION, ES_ENDPOINT, FIREHOSE_ES_INDEX, PINPOINT_ES_DATA } =
  process.env;
const endpoint = new AWS.Endpoint(ES_ENDPOINT);
const httpClient = new AWS.NodeHttpClient();
const credentials = new AWS.EnvironmentCredentials("AWS");
const esDomain = {
  index: "entitiessearchindex",
  doctype: "_doc",
};
const firehoseDomain = {
  index: FIREHOSE_ES_INDEX,
  doctype: PINPOINT_ES_DATA,
};
/**
 * Sends a request to Elasticsearch
 *
 * @param {string} httpMethod - The HTTP method, e.g. 'GET', 'PUT', 'DELETE', etc
 * @param {string} requestPath - The HTTP path (relative to the Elasticsearch domain), e.g. '.kibana'
 * @param {Object} [payload] - An optional JavaScript object that will be serialized to the HTTP request body
 * @param {Boolean} eof - True if the search is for firehose index. False for elastic domain.
 * @returns {Promise} Promise - object with the result of the HTTP response
 */
export function sendRequest({
  httpMethod,
  requestPath,
  payload,
  eof,
  isGlobal,
}) {
  const request = new AWS.HttpRequest(endpoint);
  request.method = httpMethod;
  if (eof) {
    request.path = path.join("/", firehoseDomain.index, firehoseDomain.doctype);
  } else if (!isGlobal) {
    request.path = path.join("/", esDomain.index, esDomain.doctype);
  } else {
    request.path = "";
  }
  request.path = path.join(request.path, requestPath);
  request.region = ES_REGION;
  request.body = JSON.stringify(payload);
  request.headers["presigned-expires"] = false;
  request.headers["Content-Type"] = "application/json";
  request.headers.Host = endpoint.host;

  console.log(`Credentials: ${JSON.stringify(credentials)}`);

  console.log(`Request before: ${JSON.stringify(request)}`);
  
  const signer = new AWS.Signers.V4(request, "es");
  signer.addAuthorization(credentials, new Date());
  
  console.log(`Request after auth: ${JSON.stringify(request)}`);

  return new Promise((resolve, reject) => {
    httpClient.handleRequest(
      request,
      null,
      (response) => {
        const { statusCode, statusMessage, headers } = response;
        let body = "";
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          const data = {
            statusCode,
            statusMessage,
            headers,
          };
          console.log('body==>',body)
          if (body ) {
            data.body = httpMethod !== "GET" ? JSON.parse(body) : body;
          }
          resolve(data);
        });
      },
      (err) => {
        reject(err);
      }
    );
  });
}
