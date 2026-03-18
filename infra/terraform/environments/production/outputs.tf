output "runtime_service_account_email" {
  description = "Runtime service account gerenciado em produção."
  value       = module.functions_runtime.runtime_service_account_email
}
