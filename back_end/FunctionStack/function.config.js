// const path = require("path");

const AwsSamPlugin = require("aws-sam-webpack-plugin");

const awsSamPlugin = new AwsSamPlugin();

const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: awsSamPlugin.entry(),
  output: {
    filename: "[name]/app.js",
    libraryTarget: "commonjs2",
    path: `${__dirname}/.aws-sam/build/`,
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  target: "node",
  externals:
    process.env.NODE_ENV === "development"
      ? []
      : [
          {
            uuid: "commonjs2 uuid",
          },
          {
            "aws-sdk": "commonjs2 aws-sdk",
          },
          {
            "dynamodb-stream-elasticsearch":
              "commonjs2 dynamodb-stream-elasticsearch",
          },
        ],
  mode: process.env.NODE_ENV || "production",
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
        },
      },
    ],
  },
  plugins: [
    awsSamPlugin,
    new CopyWebpackPlugin([
      { from: "../NPMLayer/dependencies", to: "dependencies" },
    ]),
  ],
};
