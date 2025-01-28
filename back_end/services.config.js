const path = require("path");

const AwsSamPlugin = require("./sam-serverless");

const awsSamPlugin = new AwsSamPlugin({
  projects: {
    FunctionStack: "./FunctionStack/template.yaml",
    FirehoseLambdaStack: "./FirehoseLambdaStack/template.yaml",
    MessagingStack: "./MessagingStack/template.yaml",
    ExternalAPIStack: "./ExternalAPIStack/template.yaml",
    CognitoTriggerStack: "./CognitoTriggerStack/template.yaml",
    LeadAPIStack: "./LeadAPIStack/template.yaml",
    CustomerImportStack: "./CustomerImportStack/template.yaml",
    NotesImportStack: "./NotesImportStack/template.yaml",
    CobuyerImportStack: "./CobuyerImportStack/template.yaml",
    UpdateEndpointStack: "./UpdateEndpointStack/template.yaml",
    SocketServiceStack: "./SocketServiceStack/template.yaml",
    SocketIdUpdateStack: "./SocketIdUpdateStack/template.yaml",
    PinpointAnalyticsStack: "./PinpointAnalyticsStack/template.yaml",
    LeadTransferStack: "./LeadTransferStack/template.yaml",
    DataMigrationStack: "./DataMigrationStack/template.yaml",
    ReportsStack: "./ReportsStack/template.yaml",
    CleanupStack: "./CleanupStack/template.yaml",
    SegmentCountStack: "./SegmentCountStack/template.yaml",
    AnalyticsStack: "./AnalyticsStack/template.yaml",
    StageDateStack: "./StageDateStack/template.yaml",
    EmailActivityUpdateStack: "./EmailActivityUpdateStack/template.yaml",
    DeleteProfileDataStack: "./DeleteProfileDataStack/template.yaml",
    BuilderDeleteStack: "./BuilderDeleteStack/template.yaml",
    RealtorImportStack: "./RealtorImportStack/template.yaml",
    DeleteAgenciesBulkStack: "./DeleteAgenciesBulkStack/template.yaml",
  },
});

module.exports = {
  entry: awsSamPlugin.entry(),
  output: {
    filename: (chunkData) => awsSamPlugin.filename(chunkData),
    libraryTarget: "commonjs2",
    path: path.resolve("."),
  },
  // devtool: "source-map",
  resolve: {
    extensions: [".ts", ".js"],
  },
  target: "node",
  externals:
    process.env.NODE_ENV === "development"
      ? []
      : [
        "aws-sdk",
        "jimp/es",
        "busboy",
        "dynamodb-stream-elasticsearch",
        "aws4",
        "ical-generator",
        "nodemailer",
        "uuid",
        "chrome-aws-lambda",
        "@jsreport/jsreport-chrome-pdf",
        "@jsreport/jsreport-core",
        "@jsreport/jsreport-handlebars",
        "@sparticuz/chromium",
        "csvtojson",
        "moment-timezone",
        "aws-jwt-verify",
        "json2csv",
        "axios",
        "dynamic-html-pdf",
        "mailparser"
      ],
  // { 'sharp': '../../opt/node_modules/sharp' }
  mode: process.env.NODE_ENV || "production",
  // use babel-loader instead of ts-loader
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
        },
      },
      {
        test: /\.tsx?$/,
        loader: "babel-loader",
      },
      {
        test: /\.(zip)$/,
        loader: "file-loader",
        options: {
          name: "../FunctionStack/NPMLayer/nodejs.zip",
        },
      },
    ],
  },
  plugins: [awsSamPlugin],
};
