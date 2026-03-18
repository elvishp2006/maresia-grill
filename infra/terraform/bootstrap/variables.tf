variable "project_id" {
  description = "Projeto GCP que hospedará o bucket remoto de state."
  type        = string
}

variable "region" {
  description = "Região do bucket de state."
  type        = string
  default     = "us-central1"
}

variable "state_bucket_name" {
  description = "Nome do bucket GCS para o Terraform state."
  type        = string
  default     = "maresia-grill-terraform-state"
}
