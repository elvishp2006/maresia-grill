output "runtime_service_account_email" {
  description = "Runtime service account padrão do projeto."
  value       = "${var.project_number}-compute@developer.gserviceaccount.com"
}
