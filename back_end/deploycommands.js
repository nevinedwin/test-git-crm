aws s3 mb s3://crm-backend-dev-s3 --region us-west-2 --profile hyphen

sam package --output-template packaged.yaml --s3-bucket crm-backend-dev-s3 --profile hyphen
sam deploy --template-file packaged.yaml --region us-west-2 --capabilities CAPABILITY_IAM --stack-name crm-stack-dev-cf --s3-bucket crm-backend-dev-s3 --profile hyphen

aws cloudformation describe-stacks --stack-name crm-stack-dev-cf --region us-west-2 --query "Stacks[].Outputs" --profile hyphen
aws dynamodb batch-write-item --request-items file://data.json --region us-west-2 --profile hyphen


aws s3 mb s3://crm-codedeploy-dev-s3 --region us-west-2 --profile hyphen
aws s3 sync .aws-sam s3://crm-codedeploy-dev-s3/hyphen-crm-build/.aws-sam --delete --profile hyphen
aws s3 cp buildspec-dev.yml s3://crm-codedeploy-dev-s3/hyphen-crm-build --delete --profile hyphen