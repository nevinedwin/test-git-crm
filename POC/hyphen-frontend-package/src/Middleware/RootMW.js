import { all } from "redux-saga/effects";
import { LoginSaga } from "./LoginMW";

export default function* Root() {
    yield all([
        ...LoginSaga
    ]);
}
