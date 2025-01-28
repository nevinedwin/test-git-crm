import _ from "lodash";

export const loadingSelector = actions => state => {
  return _(actions).some(action => _.get(state, `loading.${action}`));
};

export const notificationSelector = actions => state => {
  return _(actions)
      .some(action => _.get(state, `error.${action}`));
};