output "runtime_service_account_email" {
  description = "Runtime service account gerenciado em staging."
  value       = module.functions_runtime.runtime_service_account_email
}
