#!/bin/bash
source .env 

if [ -z "$AWS_ACCESS_KEY_ID" ]; then
  echo "AWS_ACCESS_KEY_ID is not set
  exit 1
fi

if [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
  echo "AWS_SECRET
  exit 1
fi

if [ -z "$AWS_DEFAULT_REGION" ]; then
  export AWS_DEFAULT_REGION=us-east-1
  echo "AWS_DEFAULT_REGION is not set. Defaulting to us-east-1"
fi


if [ -z "$MIXPANEL_TOKEN" ]; then
  echo "MIXPANEL_TOKEN is not set"
  exit 1
fi

# AWS credentials
export AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
export AWS_DEFAULT_REGION=$AWS_DEFAULT_REGION

# Export environment variables
export FRONTEND_URL=none
export RUNTIME=prod
export REGION=US
export PLATFORM=AWS

# Export your Mixpanel token
export MIXPANEL_TOKEN=$MIXPANEL_TOKEN

# Navigate to the script directory
cd scripts || exit

# Install the AWS SAM CLI if not already installed (uncomment if needed)
# brew tap aws/tap
# brew install aws-sam-cli

# Build the SAM application using the custom template file
sam build --template-file aws-lambda-template.yml

# Deploy the SAM application using the custom template file and parameters
sam deploy --template-file aws-lambda-template.yml \
  --stack-name mixpanel-proxy-stack \
  --capabilities CAPABILITY_IAM \
  --resolve-s3 \
  --parameter-overrides \
    MixpanelToken=${MIXPANEL_TOKEN} \
    FrontendUrl=${FRONTEND_URL} \
    Runtime=${RUNTIME} \
    Region=${REGION} \
    Platform=${PLATFORM}
