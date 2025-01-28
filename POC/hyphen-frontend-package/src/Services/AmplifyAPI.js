import { API, Auth } from "aws-amplify";

import { ConfigAWS } from '../ConfigAWS';

export const amplifyAPICall = async (method, path, request = {}, cognitoHeader = false) => {
    if (cognitoHeader) {
        let session = await Auth.currentSession();
        request.headers = {
            Authorization: session.idToken.jwtToken
        };
    }
    switch (method) {
        case 'get':
            return API.get(ConfigAWS.apiGateway.NAME, path, request).then(response => {
                return response;
            });
        case 'post':
            return API.post(ConfigAWS.apiGateway.NAME, path, request).then(response => {
                return response;
            });
        case 'put':
            return API.put(ConfigAWS.apiGateway.NAME, path, request).then(response => {
                return response;
            });
        case 'delete':
            return API.del(ConfigAWS.apiGateway.NAME, path, request).then(response => {
                return response;
            });
        default:
            break;
    }
};