import { amplifyAPICall } from './AmplifyAPI';

let moment = require('moment');

export const loadCustomers = (org_id) => {
  return amplifyAPICall('get', `/api/auth/users/list/${org_id}/0`, {}, true);
};

export const signUp = (signUpData) => {
  let body = signUpData;
  return amplifyAPICall('post', `/api/public/users/createreg`, { body }, false);
};

export const loadCustomerDetails = (id, org_id, type) => {
  let body = {
    type
  };
  return amplifyAPICall('post', `/api/auth/users/get/${org_id}/${id}`, { body }, true);
};

export const loadHomeBuilderList = () => {
  return amplifyAPICall('get', `/api/public/builders/list`, {}, false);
};

export const loadPropertyList = (org_id) => {
  return amplifyAPICall('get', `/api/auth/props/list/${org_id}/0`, {}, true);
};

export const searchCustomers = (body) => {
  return amplifyAPICall('post', `/api/auth/users/search`, { body }, true);
};

export const searchApplication = (body) => {
  return amplifyAPICall('post', `/api/auth/users/gsearch`, { body }, true);
};

export const newCustomer = (body) => {
  return amplifyAPICall('post', `/api/auth/users/create`, { body }, true);
};

export const updateCustomer = (body) => {
  return amplifyAPICall('post', `/api/auth/users/update`, { body }, true);
};

export const deleteCustomer = (body) => {
  return amplifyAPICall('post', `/api/auth/users/delete`, { body }, true);
};

export const createListDataCustomer = (data) => {
  let name = data['fname'] + ' ' + data['lname'];
  let email = data.email;
  let phone = data.phone;
  let stage = data.stage;
  let last_modifiedTempDate = moment(parseInt(data.mdt));
  let date_addedTempDate = moment(parseInt(data.jdt));
  let last_modified = last_modifiedTempDate.format('MMMM Do YYYY, h:mm a');
  let date_added = date_addedTempDate.format('MMMM Do YYYY, h:mm a');
  let id = data.id;
  return { name, email, phone, stage, last_modified, date_added, id };
}