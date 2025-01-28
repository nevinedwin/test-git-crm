import React from "react";
import { Route, Redirect } from "react-router-dom";

import { ManageLocalStorage } from '../Services/LocalStorage';

export const CustomRouter = ({ xComponent: Component, ...xProps }) => {
  return (
    <Route
      {...xProps}
      render={props => {
        let userDetails = ManageLocalStorage.get("userDetails");
        let userAWSAttributes = JSON.parse(ManageLocalStorage.get("userAWSAttributes"));
        let pathName = props.match.path;
        if (userDetails && userAWSAttributes && pathName === "/login") {
          return <Redirect to="/customer/customerlist" />;
        }
        if (!userDetails && !userAWSAttributes && pathName !== "/login" && pathName !== "/signup") {
          return <Redirect to="/login" />;
        }
        return <Component subModules={xProps.data} routeKey={xProps.routeKey} canWrite={xProps.canWrite} {...props} />;
      }}
    />
  );
};
