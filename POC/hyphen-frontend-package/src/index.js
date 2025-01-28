import 'react-app-polyfill/ie11';
import 'react-app-polyfill/stable';

import 'bootstrap/dist/css/bootstrap.min.css';
/*eslint-disable */
import $ from 'jquery';
import Popper from 'popper.js';
/*eslint-enable */
import 'bootstrap/dist/js/bootstrap.bundle.min';

import React from 'react';
import ReactDOM from 'react-dom';
import Amplify from "aws-amplify";
import { BrowserRouter as Router, Route } from "react-router-dom";
import { library } from "@fortawesome/fontawesome-svg-core";
import {
  faMale, faAddressCard, faFile, faTimesCircle,
  faHome, faUserSlash, faQuestionCircle, faSearch,
  faBell, faFileAlt, faDonate, faExclamationTriangle,
  faEnvelope, faUser, faCogs, faList, faSignOutAlt, faAngleDoubleUp,
  faCheck, faPlus
} from '@fortawesome/free-solid-svg-icons';

import Routes from './Core/Routes';
import Root from './Middleware/RootMW';
import * as serviceWorker from './serviceWorker';
import { configureStore, history } from './Core/Store';
import { ConfigAWS } from './ConfigAWS';

import './style.scss';

import { MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles';

require("es6-promise").polyfill();

const THEME = createMuiTheme({
  typography: {
    fontFamily: ["Nunito", "sans-serif"].join(",")
  },
  palette: {
    primary: {
      main: '#219FF4',
      contrastText: '#fff',
    }
  }
});

Amplify.configure({
  Auth: {
    mandatorySignIn: true,
    region: ConfigAWS.cognito.REGION,
    userPoolId: ConfigAWS.cognito.USER_POOL_ID,
    identityPoolId: ConfigAWS.cognito.IDENTITY_POOL_ID,
    userPoolWebClientId: ConfigAWS.cognito.APP_CLIENT_ID
  },
  API: {
    endpoints: [
      {
        name: ConfigAWS.apiGateway.NAME,
        endpoint: ConfigAWS.apiGateway.URL,
        region: ConfigAWS.apiGateway.REGION
      }
    ]
  },
  Analytics: {
    // OPTIONAL - disable Analytics if true
    disabled: true,
  }
});

const store = configureStore();
store.runSaga(Root);

const rootElement = document.getElementById("root");

library.add(faMale, faAddressCard, faFile, faTimesCircle,
  faHome, faUserSlash, faQuestionCircle, faSearch,
  faBell, faFileAlt, faDonate, faExclamationTriangle,
  faEnvelope, faUser, faCogs, faList, faSignOutAlt, faAngleDoubleUp,
  faCheck, faPlus);

const AppInit = () => {
  return (
    <MuiThemeProvider theme={THEME}>
      <Router>
        <Route>
          <Routes store={store} history={history} />
        </Route>
      </Router>
    </MuiThemeProvider>
  );
};

const render = () => {
  if (rootElement.hasChildNodes()) {
    ReactDOM.hydrate(<AppInit />, rootElement);
  } else {
    ReactDOM.render(<AppInit />, rootElement);
  }
};

render();

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
