locals {
  runtime_service_account_email = "${var.project_number}-compute@developer.gserviceaccount.com"
}

resource "google_project_iam_member" "runtime_firestore_access" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${local.runtime_service_account_email}"
}

resource "google_service_account_iam_member" "app_deployer_runtime_sa_user" {
  service_account_id = "projects/${var.project_id}/serviceAccounts/${local.runtime_service_account_email}"
  role               = "roles/iam.serviceAccountUser"
  member             = var.app_deployer_member
}
