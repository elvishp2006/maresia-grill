output "runtime_service_account_email" {
  description = "Runtime service account padrão do projeto."
  value       = "${var.project_number}-compute@developer.gserviceaccount.com"
}

output "cloudbuild_service_agent_email" {
  description = "Cloud Build service agent do projeto."
  value       = "service-${var.project_number}@gcp-sa-cloudbuild.iam.gserviceaccount.com"
}
