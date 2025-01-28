const { promisify } = require("util");
const rimraf = promisify(require("rimraf"));

const folderPaths = [
  ".aws-sam",
  ".vscode",
  "../FirehoseLambdaStack",
  "../FunctionStack",
  "../MessagingStack",
  "../ExternalAPIStack",
  "../CognitoTriggerStack",
  "../LeadAPIStack",
  "../CustomerImportStack",
  "../RealtorImportStack",
  "../NotesImportStack",
  "../CobuyerImportStack",
  "../UpdateEndpointStack",
  "../SocketServiceStack",
  "../SocketIdUpdateStack",
  "../PinpointAnalyticsStack",
  "../LeadTransferStack",
  "../DataMigrationStack",
  "../ReportsStack",
  "../CleanupStack",
  "../SegmentCountStack",
  "../AnalyticsStack",
  "../StageDateStack",
  "../EmailActivityUpdateStack",
  "../DeleteProfileDataStack",
  "../BuilderDeleteStack",
  "../DeleteAgenciesBulkStack",
  "../infrastructure/FirehoseLambdaStack-template.yaml",
  "../infrastructure/FunctionStack-template.yaml",
  "../infrastructure/MessagingStack-template.yaml",
  "../infrastructure/ExternalAPIStack-template.yaml",
  "../infrastructure/CognitoTriggerStack-template.yaml",
  "../infrastructure/LeadAPIStack-template.yaml",
  "../infrastructure/CustomerImportStack-template.yaml",
  "../infrastructure/NotesImportStack-template.yaml",
  "../infrastructure/CobuyerImportStack-template.yaml",
  "../infrastructure/RealtorImportStack-template.yaml",
  "../infrastructure/UpdateEndpointStack-template.yaml",
  "../infrastructure/SocketServiceStack-template.yaml",
  "../infrastructure/SocketIdUpdateStack-template.yaml",
  "../infrastructure/LeadTransferStack-template.yaml",
  "../infrastructure/DataMigrationStack-template.yaml",
  "../infrastructure/ReportsStack-template.yaml",
  "../infrastructure/CleanupStack-template.yaml",
  "../infrastructure/SegmentCountStack-template.yaml",
  "../infrastructure/AnalyticsStack-template.yaml",
  "../infrastructure/StageDateStack-template.yaml",
  "../infrastructure/EmailActivityUpdateStack-template.yaml",
  "../infrastructure/DeleteProfileDataStack-template.yaml",
  "../infrastructure/BuilderDeleteStack-template.yaml",
  "../infrastructure/DeleteAgenciesBulkStack-template.yaml",
  "*/.aws-sam */.vscode",
];

async function pckg() {
  await Promise.all(
    folderPaths.map(async (folderPathsItem) => {
      await rimraf(folderPathsItem);
      console.log(folderPathsItem);
    })
  );
  console.log(" ");
  console.log("Cleared Build Files");
  console.log(" ");
  console.log(" ");
}

pckg().catch(console.error);
