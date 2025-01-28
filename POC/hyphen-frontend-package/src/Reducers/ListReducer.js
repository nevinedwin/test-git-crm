import { ManageLocalStorage } from "../Services/LocalStorage";

const initialState = {
    listData: ManageLocalStorage.get("listData")
        ? JSON.parse(ManageLocalStorage.get("listData"))
        : {}
};


export const ListReducer = (state = initialState, action) => {
    switch (action.type) {
        case 'LIST_DATA':
            return {
                ...state,
                listData: action.listDatas
            };
        default:
            return state;
    }
};
