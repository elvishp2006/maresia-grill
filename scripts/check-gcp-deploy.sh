#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/gcp-common.sh"

PROJECT_ID=""
DEPLOYER_MEMBER=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT_ID="${2:-}"
      shift 2
      ;;
    --member)
      DEPLOYER_MEMBER="${2:-}"
      shift 2
      ;;
    *)
      fail "Unknown argument: $1"
      ;;
  esac
done

require_command gcloud

PROJECT_ID="$(resolve_project "$PROJECT_ID")"
PROJECT_NUMBER="$(resolve_project_number "$PROJECT_ID")"
DEPLOYER_MEMBER="${DEPLOYER_MEMBER:-$(resolve_active_member)}"
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
CLOUDBUILD_AGENT="service-${PROJECT_NUMBER}@gcp-sa-cloudbuild.iam.gserviceaccount.com"

log "Checking project: $PROJECT_ID ($PROJECT_NUMBER)"
log "Checking deployer: $DEPLOYER_MEMBER"

for api in \
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  eventarc.googleapis.com \
  pubsub.googleapis.com \
  storage.googleapis.com \
  firestore.googleapis.com \
  firebase.googleapis.com
do
  gcloud services list --enabled --project "$PROJECT_ID" --format='value(config.name)' \
    | grep -Fxq "$api" || fail "Missing API: $api. Run: npm run gcp:bootstrap -- --project $PROJECT_ID --member \"$DEPLOYER_MEMBER\""
done

service_account_has_role_binding "$RUNTIME_SA" "$DEPLOYER_MEMBER" "roles/iam.serviceAccountUser" \
  || fail "Missing roles/iam.serviceAccountUser for $DEPLOYER_MEMBER on $RUNTIME_SA. Run: npm run gcp:bootstrap -- --project $PROJECT_ID --member \"$DEPLOYER_MEMBER\""

project_has_role_binding "$PROJECT_ID" "serviceAccount:${RUNTIME_SA}" "roles/cloudbuild.builds.builder" \
  || fail "Missing roles/cloudbuild.builds.builder for serviceAccount:${RUNTIME_SA}. Run: npm run gcp:bootstrap -- --project $PROJECT_ID --member \"$DEPLOYER_MEMBER\""

project_has_role_binding "$PROJECT_ID" "serviceAccount:${CLOUDBUILD_AGENT}" "roles/cloudbuild.serviceAgent" \
  || log "Warning: roles/cloudbuild.serviceAgent not found for ${CLOUDBUILD_AGENT}. This may be intentional or organization-managed."

log "GCP deploy prerequisites look good."

