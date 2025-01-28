const { promisify } = require("util");
const ncp = promisify(require("ncp"));

const folderPaths = [
  "FirehoseLambdaStack",
  "FunctionStack",
  "MessagingStack",
  "ExternalAPIStack",
  "CognitoTriggerStack",
  "LeadAPIStack",
  "CustomerImportStack",
  "NotesImportStack",
  "CobuyerImportStack",
  "RealtorImportStack",
  "LeadTransferStack",
  "DataMigrationStack",
  "ReportsStack",
  "CleanupStack",
  "SegmentCountStack",
  "AnalyticsStack",
  "StageDateStack",
  "EmailActivityUpdateStack",
  "UpdateEndpointStack",
  "SocketServiceStack",
  "SocketIdUpdateStack",
  "PinpointAnalyticsStack",
  "DeleteProfileDataStack",
  "BuilderDeleteStack",
  "DeleteAgenciesBulkStack"
];

async function pckg() {
  await Promise.all(
    folderPaths.map(async (folderPathsItem) => {
      await ncp(
        `./${folderPathsItem}/package.json`,
        `../${folderPathsItem}/package.json`
      );
      console.log(
        `./${folderPathsItem}/package.json`,
        `../${folderPathsItem}/package.json`
      );
    })
  );
  console.log(" ");
  console.log("Package JSON Files Moved");
  console.log(" ");
  console.log(" ");
}

pckg().catch(console.error);
