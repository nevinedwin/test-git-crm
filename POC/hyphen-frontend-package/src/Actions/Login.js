import { LOGIN_SUCCESS, LOGIN_REQUEST } from "../Utilities/Constants";

export const loginRequest = payload => {
    return {
        type: LOGIN_REQUEST,
        ...payload
    };
};

export const loginSuccess = payload =>{
    return {
        type: LOGIN_SUCCESS,
        ...payload
    }
}
