/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";

export async function main(event, context, callback) {
  if (event && event.request) {
    if (
      event.request.userAttributes &&
      event.request.userAttributes["custom:hb_id"]
    ) {
      console.log(event.request.userAttributes["custom:hb_id"]);
      event.response = {
        claimsOverrideDetails: {
          claimsToAddOrOverride: {
            hb_id: event.request.userAttributes["custom:hb_id"],
          },
        },
      };
      console.log(JSON.stringify(event));
    }
  }
  // Return to Amazon Cognito
  callback(null, event);
}
