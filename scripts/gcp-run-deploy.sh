#!/usr/bin/env bash
set -Eeuo pipefail
trap 'echo "❌ Error on line $LINENO"; exit 1' ERR

# ───────────────────────────────────────────────
# 1️⃣  Top-level config (override in CI or env)
# ───────────────────────────────────────────────
SERVICE="${SERVICE_NAME:-express-proxy}"
PROJECT="${GCP_PROJECT:-mixpanel-gtm-training}"

# This is *only* for gcloud run deploy
CLOUD_RUN_REGION="${CLOUD_RUN_REGION:-us-central1}"
# This is *only* for Artifact Registry
ARTIFACT_LOCATION="${ARTIFACT_LOCATION:-us-central1}"

REPO="${ARTIFACT_REPO:-express-proxy-repo}"
TAG="${IMAGE_TAG:-latest}"

# e.g. us-central1-docker.pkg.dev/PROJECT/REPO/SERVICE:TAG
IMAGE="${ARTIFACT_LOCATION}-docker.pkg.dev/${PROJECT}/${REPO}/${SERVICE}:${TAG}"

ENV_FILE=".env"

# ───────────────────────────────────────────────
# 2️⃣  Load your runtime env vars (e.g. MIXPANEL_TOKEN, FRONTEND_URL, and even REGION)
# ───────────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ Missing ${ENV_FILE}"
  exit 1
fi
# shellcheck disable=SC1091
source "$ENV_FILE"

# ───────────────────────────────────────────────
# 3️⃣  Authenticate & ensure AR repo exists
# ───────────────────────────────────────────────
# Make sure gcloud has a token
if ! gcloud auth print-access-token &>/dev/null; then
  echo "🔑 Logging in to gcloud…"
  gcloud auth login --quiet
fi

# Enable APIs
gcloud services enable artifactregistry.googleapis.com \
  --project "$PROJECT" &>/dev/null || true

# Create Docker repo if missing
if ! gcloud artifacts repositories list \
     --location="$ARTIFACT_LOCATION" \
     --project="$PROJECT" \
  | grep -qw "$REPO"; then
  echo "📦 Creating Artifact Registry repo: $REPO in $ARTIFACT_LOCATION"
  gcloud artifacts repositories create "$REPO" \
    --repository-format=docker \
    --location="$ARTIFACT_LOCATION" \
    --description="Docker images for $SERVICE" \
    --project="$PROJECT"
fi

# ───────────────────────────────────────────────
# 4️⃣  Build & push the image via Cloud Build
# ───────────────────────────────────────────────
echo "🐳 Building ${IMAGE} via Cloud Build…"
gcloud builds submit \
  --project "$PROJECT" \
  --region "$ARTIFACT_LOCATION" \
  --tag "$IMAGE" \
  .

# ───────────────────────────────────────────────
# 5️⃣  Deploy to Cloud Run
# ───────────────────────────────────────────────
echo "🚀 Deploying ${SERVICE} to Cloud Run in ${CLOUD_RUN_REGION}…"
gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --project "$PROJECT" \
  --region "$CLOUD_RUN_REGION" \
  --platform managed \
  --allow-unauthenticated \
  --concurrency 80 \
  --memory 512Mi \
  --update-env-vars \
    MIXPANEL_TOKEN="${MIXPANEL_TOKEN:-}",\
FRONTEND_URL="${FRONTEND_URL:-}",\
RUNTIME=prod,\
REGION="${REGION:-}"

echo "✅ ${SERVICE} deployed → ${IMAGE}"
