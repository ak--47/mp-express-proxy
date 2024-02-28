gcloud config set run/region us-central1
docker build -t express-proxy .
docker tag express-proxy gcr.io/mixpanel-gtm-training/express-proxy
docker push gcr.io/mixpanel-gtm-training/express-proxy
gcloud run deploy express-proxy \
  --image gcr.io/mixpanel-gtm-training/express-proxy \
  --platform managed \
  --project mixpanel-gtm-training \
  --set-env-vars MIXPANEL_TOKEN=YOUR_MIXPANEL_TOKEN,FRONTEND_URL=http://localhost:3000
