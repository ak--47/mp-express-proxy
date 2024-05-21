#!/bin/bash

# Check if Azure Functions Core Tools are installed
if ! command -v func &> /dev/null
then
    echo "Azure Functions Core Tools are not installed. Installing..."
    npm install -g azure-functions-core-tools@3 --unsafe-perm true
else
    echo "Azure Functions Core Tools are already installed."
fi

# Export environment variables
export MIXPANEL_TOKEN=none
export FRONTEND_URL=none
export RUNTIME=prod
export REGION=US
export CLOUD_PROVIDER=AZURE

# Deploy the function
func azure functionapp publish your-azure-function-app-name --publish-local-settings -y \
  --set MIXPANEL_TOKEN=none \
  --set FRONTEND_URL=none \
  --set RUNTIME=prod \
  --set REGION=US \
  --set CLOUD_PROVIDER=AZURE
