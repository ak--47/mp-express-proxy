#!/bin/bash

# Export environment variables
export PLATFORM=none
export FRONTEND_URL=none
export RUNTIME=prod
export REGION=US
export CLOUD_PROVIDER=AWS

# Set up serverless framework and deploy
npx serverless deploy --aws-profile your-aws-profile
