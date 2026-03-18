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
DEPLOYER_EMAIL="$(extract_member_email "$DEPLOYER_MEMBER")"
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
CLOUDBUILD_AGENT="service-${PROJECT_NUMBER}@gcp-sa-cloudbuild.iam.gserviceaccount.com"

log "Bootstrapping project: $PROJECT_ID ($PROJECT_NUMBER)"
log "Deployer member: $DEPLOYER_MEMBER"

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
  ensure_api_enabled "$PROJECT_ID" "$api"
done

grant_service_account_role_if_missing "$RUNTIME_SA" "$DEPLOYER_MEMBER" "roles/iam.serviceAccountUser"
grant_project_role_if_missing "$PROJECT_ID" "serviceAccount:${RUNTIME_SA}" "roles/cloudbuild.builds.builder"
grant_project_role_if_missing "$PROJECT_ID" "serviceAccount:${CLOUDBUILD_AGENT}" "roles/cloudbuild.serviceAgent"

log "Bootstrap complete."
log "Runtime service account: $RUNTIME_SA"
log "Active deployer email: $DEPLOYER_EMAIL"

