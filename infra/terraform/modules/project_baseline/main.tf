terraform {
  required_providers {
    google = {
      source = "hashicorp/google"
    }
    google-beta = {
      source = "hashicorp/google-beta"
    }
  }
}

locals {
  required_apis = toset([
    "artifactregistry.googleapis.com",
    "cloudbilling.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudfunctions.googleapis.com",
    "eventarc.googleapis.com",
    "firebase.googleapis.com",
    "firebaseextensions.googleapis.com",
    "firestore.googleapis.com",
    "pubsub.googleapis.com",
    "run.googleapis.com",
    "storage.googleapis.com",
  ])

  runtime_service_account_email = "${var.project_number}-compute@developer.gserviceaccount.com"
  cloudbuild_service_agent      = "service-${var.project_number}@gcp-sa-cloudbuild.iam.gserviceaccount.com"
}

resource "google_project_service" "required" {
  for_each = local.required_apis

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_project_iam_member" "runtime_cloudbuild_builder" {
  project = var.project_id
  role    = "roles/cloudbuild.builds.builder"
  member  = "serviceAccount:${local.runtime_service_account_email}"

  depends_on = [google_project_service.required]
}

resource "google_project_iam_member" "cloudbuild_service_agent" {
  project = var.project_id
  role    = "roles/cloudbuild.serviceAgent"
  member  = "serviceAccount:${local.cloudbuild_service_agent}"

  depends_on = [google_project_service.required]
}

resource "google_project_iam_member" "app_deployer_service_usage_consumer" {
  project = var.project_id
  role    = "roles/serviceusage.serviceUsageConsumer"
  member  = var.app_deployer_member

  depends_on = [google_project_service.required]
}

resource "google_project_iam_member" "app_deployer_cloudfunctions_admin" {
  project = var.project_id
  role    = "roles/cloudfunctions.admin"
  member  = var.app_deployer_member

  depends_on = [google_project_service.required]
}

resource "google_project_iam_member" "app_deployer_firestore_rules_admin" {
  project = var.project_id
  role    = "roles/firebaserules.admin"
  member  = var.app_deployer_member

  depends_on = [google_project_service.required]
}

resource "google_project_service_identity" "cloudfunctions_service_agent" {
  provider = google-beta
  project  = var.project_id
  service  = "cloudfunctions.googleapis.com"

  depends_on = [google_project_service.required]
}
