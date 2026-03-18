#!/usr/bin/env bash

set -euo pipefail

log() {
  printf '[gcp] %s\n' "$*"
}

fail() {
  printf '[gcp] ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Command not found: $1"
}

resolve_project() {
  local explicit_project="${1:-}"
  if [[ -n "$explicit_project" ]]; then
    printf '%s\n' "$explicit_project"
    return
  fi

  local active_project
  active_project="$(gcloud config get-value project 2>/dev/null || true)"
  [[ -n "$active_project" && "$active_project" != "(unset)" ]] || fail "No GCP project configured. Pass --project <id>."
  printf '%s\n' "$active_project"
}

resolve_project_number() {
  local project_id="$1"
  gcloud projects describe "$project_id" --format='value(projectNumber)'
}

resolve_active_member() {
  local active_account
  active_account="$(gcloud config get-value account 2>/dev/null || true)"
  [[ -n "$active_account" && "$active_account" != "(unset)" ]] || fail "No active gcloud account. Run gcloud auth login or authenticate in CI."

  if [[ "$active_account" == *".gserviceaccount.com" ]]; then
    printf 'serviceAccount:%s\n' "$active_account"
    return
  fi

  printf 'user:%s\n' "$active_account"
}

extract_member_email() {
  local member="$1"
  printf '%s\n' "${member#*:}"
}

ensure_api_enabled() {
  local project_id="$1"
  local api="$2"

  if gcloud services list --enabled --project "$project_id" --format='value(config.name)' \
    | grep -Fxq "$api"; then
    log "API already enabled: $api"
    return
  fi

  log "Enabling API: $api"
  gcloud services enable "$api" --project "$project_id"
}

project_has_role_binding() {
  local project_id="$1"
  local member="$2"
  local role="$3"

  gcloud projects get-iam-policy "$project_id" \
    --flatten='bindings[].members' \
    --filter="bindings.role=$role AND bindings.members=$member" \
    --format='value(bindings.role)' \
    | grep -Fxq "$role"
}

service_account_has_role_binding() {
  local service_account_email="$1"
  local member="$2"
  local role="$3"

  gcloud iam service-accounts get-iam-policy "$service_account_email" \
    --flatten='bindings[].members' \
    --filter="bindings.role=$role AND bindings.members=$member" \
    --format='value(bindings.role)' \
    | grep -Fxq "$role"
}

grant_project_role_if_missing() {
  local project_id="$1"
  local member="$2"
  local role="$3"

  if project_has_role_binding "$project_id" "$member" "$role"; then
    log "Project role already present: $role -> $member"
    return
  fi

  log "Granting project role: $role -> $member"
  gcloud projects add-iam-policy-binding "$project_id" \
    --member="$member" \
    --role="$role" \
    --quiet
}

grant_service_account_role_if_missing() {
  local service_account_email="$1"
  local member="$2"
  local role="$3"

  if service_account_has_role_binding "$service_account_email" "$member" "$role"; then
    log "Service account role already present: $role -> $member on $service_account_email"
    return
  fi

  log "Granting service account role: $role -> $member on $service_account_email"
  gcloud iam service-accounts add-iam-policy-binding "$service_account_email" \
    --member="$member" \
    --role="$role" \
    --quiet
}

