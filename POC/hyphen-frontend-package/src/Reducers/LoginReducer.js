import {
    LOGIN_REQUEST,
    LOGIN_SUCCESS,
    LOGOUT
} from "../Utilities/Constants";
import { ManageLocalStorage } from "../Services/LocalStorage";

const initialState = {
    userDetails: ManageLocalStorage.get("userDetails")
        ? JSON.parse(ManageLocalStorage.get("userDetails"))
        : {},
    userAWSAttributes: ManageLocalStorage.get("userAWSAttributes")
        ? JSON.parse(ManageLocalStorage.get("userAWSAttributes"))
        : {},
    isLoggedIn:
        ManageLocalStorage.get("userDetails") && ManageLocalStorage.get("userAWSAttributes")
            ? true
            : false
};

export const LoginReducer = (state = initialState, action) => {
    switch (action.type) {
        case LOGIN_REQUEST:
            return state;
        case LOGIN_SUCCESS:
            return {
                ...state,
                isLoggedIn: true,
                userDetails: action.payload.userDetails
            };
        case LOGOUT:
            return {
                ...state,
                isLoggedIn: false,
                userDetails: {}
            };
        default:
            return state;
    }
};
