import { put, call, fork, takeEvery } from "redux-saga/effects";
import { ManageLocalStorage } from "../Services/LocalStorage";
import { Auth } from "aws-amplify";
import { LOGIN_REQUEST, LOGIN_SUCCESS, LOGIN_FAILED } from "../Utilities/Constants";
// import { loadCustomerDetails } from '../Services/CustomerService';

function* loginWatch() {
  yield takeEvery(LOGIN_REQUEST, loginWorker);
}

function* loginWorker(action) {
  try {
    let { Username, Password } = action;
    let res = yield call(loginApi, { Username, Password });
    if (res && res.username) {
      // let userDetails = yield call(getLoggedInUserDetails, res.attributes);
      // if (userDetails && userDetails.email) {
        // yield ManageLocalStorage.set("userDetails", userDetails);
        yield ManageLocalStorage.set("userAWSAttributes", res.attributes);
        yield put({
          type: LOGIN_SUCCESS,
          payload: {
            userDetails: {}
          }
        });
      // } else {
      //   yield put({
      //     type: LOGIN_FAILED,
      //     error: 'Login Failed'
      //   });
      // }
    } else {
      yield put({
        type: LOGIN_FAILED,
        error: 'Login Failed'
      });
    }
  } catch (exception) {
    if (exception['message']) {
      yield put({
        type: LOGIN_FAILED,
        error: exception['message']
      });
    } else {
      yield put({
        type: LOGIN_FAILED,
        error: 'Something went wrong'
      });
    }
  }
}

function loginApi(params) {
  return Auth.signIn(params.Username, params.Password)
    .then(response => {
      return response;
    });
}

// function getLoggedInUserDetails(data) {
//   return loadCustomerDetails(data['sub'], data['custom:org_id'], 'agent').then(userDetails => {
//     if (userDetails.length && userDetails[0].id) {
//       return userDetails[0];
//     } else {
//       return userDetails;
//     }
//   });
// }

export const LoginSaga = [fork(loginWatch)];
