import { combineReducers } from "redux";
import { connectRouter } from "connected-react-router";

import { LoginReducer } from "./LoginReducer";
import LoadingReducer from "./LoadingReducer";
import ErrorReducer from "./ErrorReducer";
import { ListReducer } from './ListReducer';
import { FloatBtnReducer } from './FloatBtnReducer';

const createRootReducer = history =>
    combineReducers({
        router: connectRouter(history),
        login: LoginReducer,
        loading: LoadingReducer,
        error: ErrorReducer,
        listReducer: ListReducer,
        floatBtnReducer: FloatBtnReducer
    });
export default createRootReducer;
