import { SIGNUP_SUCCESS, SIGNUP_REQUEST } from "../Utilities/Constants";

export const signUpRequest = payload => {
    return {
        type: SIGNUP_REQUEST,
        ...payload
    };
};

export const signUpSuccess = payload =>{
    return {
        type: SIGNUP_SUCCESS,
        ...payload
    }
}
