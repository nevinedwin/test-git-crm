import "../../NPMLayer/nodejs.zip";

import { success, failure, badRequest } from "../libs/response-lib";

const countryJson = require("./country.json");
const stateJson = require("./state.json");
const cityJson = require("./city.json");

export const getCountryList = async () => success(countryJson);

export const getStateList = async (event) => {
  const countryId =
    event && event.pathParameters && event.pathParameters.id
      ? event.pathParameters.id
      : "";
  if (countryId && countryId.length) {
    const states = stateJson.filter((value) => value.country_id === countryId);
    return success(states.sort((a, b) => -b.name.localeCompare(a.name)));
  }
  return badRequest({ error: "ID Missing" });
};

export const getCityList = async (event) => {
  const stateId =
    event && event.pathParameters && event.pathParameters.id
      ? event.pathParameters.id
      : "";
  if (stateId && stateId.length) {
    const cities = cityJson.filter((value) => value.state_id === stateId);
    return success(cities.sort((a, b) => -b.name.localeCompare(a.name)));
  }
  return badRequest({ error: "ID Missing" });
};

export async function main(event) {
  let response;
  try {
    const action =
      event && event.pathParameters && event.pathParameters.action
        ? event.pathParameters.action
        : 0;
    switch (event.httpMethod) {
      case "GET":
        switch (action) {
          case "countrylist":
            response = await getCountryList();
            break;
          case "statelist":
            response = await getStateList(event);
            break;
          case "citylist":
            response = await getCityList(event);
            break;
          default:
            response = failure();
            break;
        }
        break;
      default:
        response = failure();
    }
  } catch (err) {
    console.log(err);
    return failure({ status: false, error: err });
  }

  return response;
}
