#!/bin/bash

gcloud config set functions/region us-central1

# Deploy the function
gcloud functions deploy mixpanel_proxy \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --entry-point mixpanel_proxy \
  --source . \
  --set-env-vars MIXPANEL_TOKEN=none,FRONTEND_URL=none,RUNTIME=prod,REGION=US,PLATFORM='cloud_functions'

