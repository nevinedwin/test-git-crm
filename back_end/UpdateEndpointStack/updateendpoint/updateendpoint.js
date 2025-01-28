import "../../NPMLayer/nodejs.zip";
import { updateEndpoint } from "../../FunctionStack/campaign/campaign";

const updateCustomerEndpoint = async ({ customer, optin }) => {
  let endpointUpdateResp;
  try {
    endpointUpdateResp = await updateEndpoint(customer, optin);
    console.log(`endpointUpdateResp: ${JSON.stringify(endpointUpdateResp)}`);
  } catch (error) {
    console.log(
      `Exception occured at updateCustomerEndpoint UpdateEndpointStack`
    );
    console.log(error);
    endpointUpdateResp = error;
  }
  return endpointUpdateResp;
};
export async function main(event) {
  console.log(JSON.stringify(event));
  const { customer = null, optin = false } = event;
  let response;
  try {
    // Update the customer endpoint.
    if (customer && optin !== undefined) {
      const updateCustomerEndpointResp = await updateCustomerEndpoint({
        customer,
        optin,
      });
      console.log(
        `updateCustomerEndpointResp: ${JSON.stringify(
          updateCustomerEndpointResp
        )}`
      );
    }
    response = true;
  } catch (error) {
    console.log(`Exception at main updateendpoint UpdateEndpointStack`);
    console.log(error);
    response = false;
  }
  return response;
}
