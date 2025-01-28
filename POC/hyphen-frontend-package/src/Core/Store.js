import { createStore, applyMiddleware, compose } from "redux";
import { routerMiddleware } from "connected-react-router";
import createSagaMiddleware from "redux-saga";
import { createBrowserHistory } from "history";
// import { composeWithDevTools } from "redux-devtools-extension/developmentOnly";

import createRootReducer from "../Reducers/RootReducer";

export const history = createBrowserHistory();

/**
    A middleware you can apply to your Redux store to capture dispatched actions created by the action creators. It will redirect those actions to the provided  history instance.
**/
const RouterMiddleware = routerMiddleware(history);
const SagaMiddleware = createSagaMiddleware();

const getMiddleware = () => {
  // // DEVELPOPMENT
  // return composeWithDevTools(applyMiddleware(SagaMiddleware, RouterMiddleware));
  // PRODUCTION
  return compose(applyMiddleware(SagaMiddleware, RouterMiddleware));
};

export function configureStore(initialState) {
  const store = createStore(
    createRootReducer(history),
    initialState,
    getMiddleware()
  );
  store.runSaga = SagaMiddleware.run;
  return store;
}
