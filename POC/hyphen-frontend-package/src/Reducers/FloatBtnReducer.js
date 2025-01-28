import { ManageLocalStorage } from "../Services/LocalStorage";

const initialState = {
    floatBtnData:
        ManageLocalStorage.get("floatBtnData")
            ? JSON.parse(ManageLocalStorage.get("floatBtnData"))
            : ""
};

export const FloatBtnReducer = (state = initialState, action) => {
    switch (action.type) {
        case 'FLOAT_BTN_DATA':
            ManageLocalStorage.set("floatBtnData", action.floatBtnData);
            return {
                ...state,
                floatBtnData: action.floatBtnData
            };
        default:
            return state;
    }
};
