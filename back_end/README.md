# Hyphen CRM

#### Usage

To configure your AWS profile, you need to have the AWS CLI (https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html) installed.

Configure AWS profile using the following command.

```bash
$ aws configure
```

To deploy this project, you need to have SAM CLI (https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html) installed.

Install the dependencies.

```bash
$ npm install
```

Use the following command to initiate the deployment process. Note: The package will be using the default AWS profile on the machine. If you wish to change the profile name, go into package.json and change the --profile parameter for "predeploy", "deploy" and "postdeploy" scripts.

```bash
$ npm run deploy
```
