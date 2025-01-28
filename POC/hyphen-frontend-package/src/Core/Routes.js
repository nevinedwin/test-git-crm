import React, { Suspense } from "react";
import { Provider } from "react-redux";
import { ConnectedRouter } from "connected-react-router";
import { Switch, Redirect } from "react-router-dom";
import { CustomRouter } from "./CustomRouter";

// Routes
import LoginContainer from "../Modules/Login/LoginContainer";
import SignUpContainer from "../Modules/SignUp/SignUpContainer";
import CustomerListContainer from "../Modules/Customer/CustomerList/CustomerListContainer";
import CustomerDetailContainer from "../Modules/Customer/CustomerDetail/CustomerDetailContainer";
import CustomerAddContainer from "../Modules/Customer/CustomerAdd/CustomerAddContainer";
import SearchContainer from '../Modules/Search/SearchContainer';
import MainWrapper from "../Modules/MainWrapper/MainWrapper";

const Routes = ({ store, history }) => {
  return (
    <Provider store={store}>
      <MainWrapper>
        <ConnectedRouter history={history}>
          <Suspense fallback={<div style={{ display: "none" }}> Loading ...</div>}>
            <Switch>
              <CustomRouter path="/customer/customerlist" xComponent={CustomerListContainer} />
              <CustomRouter path="/customer/new" xComponent={CustomerAddContainer} />
              <CustomRouter path="/customer/:id" xComponent={CustomerDetailContainer} />
              <CustomRouter path="/search" xComponent={SearchContainer} />
              <CustomRouter path="/login" xComponent={LoginContainer} />
              <CustomRouter path="/signup" xComponent={SignUpContainer} />
              <Redirect from="*" to="/login" push />
            </Switch>
          </Suspense>
        </ConnectedRouter>
      </MainWrapper>
    </Provider>
  );
};

export default Routes;
