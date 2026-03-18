output "state_bucket_name" {
  description = "Bucket remoto do Terraform state."
  value       = google_storage_bucket.terraform_state.name
}
