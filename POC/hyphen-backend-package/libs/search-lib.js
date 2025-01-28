import AWS from "aws-sdk";
import path from "path";
const { ES_REGION, ES_ENDPOINT } = process.env;
const endpoint = new AWS.Endpoint(ES_ENDPOINT);
const httpClient = new AWS.NodeHttpClient();
const credentials = new AWS.EnvironmentCredentials('AWS');
const esDomain = {
    index: 'entitiessearchindex',
    doctype: '_doc'
};
/**
 * Sends a request to Elasticsearch
 *
 * @param {string} httpMethod - The HTTP method, e.g. 'GET', 'PUT', 'DELETE', etc
 * @param {string} requestPath - The HTTP path (relative to the Elasticsearch domain), e.g. '.kibana'
 * @param {Object} [payload] - An optional JavaScript object that will be serialized to the HTTP request body
 * @returns {Promise} Promise - object with the result of the HTTP response
 */
export function sendRequest({ httpMethod, requestPath, payload }) {
    const request = new AWS.HttpRequest(endpoint);    
    request.method = httpMethod;
    request.path = path.join('/', esDomain.index, esDomain.doctype)
    request.path = path.join(request.path, requestPath);
    request.region = ES_REGION;
    request.body = JSON.stringify(payload);
    request.headers['presigned-expires'] = false;
    request.headers['Content-Type'] = 'application/json';
    request.headers['Host'] = endpoint.host;

    const signer = new AWS.Signers.V4(request, 'es');
    signer.addAuthorization(credentials, new Date());

    return new Promise((resolve, reject) => {
        httpClient.handleRequest(request, null,
            response => {
                const { statusCode, statusMessage, headers } = response;
                let body = '';
                response.on('data', chunk => {
                    body += chunk;
                });
                response.on('end', () => {
                    const data = {
                        statusCode,
                        statusMessage,
                        headers
                    };
                    if (body) {
                        data.body = JSON.parse(body);
                    }
                    resolve(data);
                });
            },
            err => {
                reject(err);
            });
    });
}