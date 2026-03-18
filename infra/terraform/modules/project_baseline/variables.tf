variable "project_id" {
  description = "ID do projeto GCP."
  type        = string
}

variable "project_number" {
  description = "Número do projeto GCP."
  type        = string
}

variable "app_deployer_member" {
  description = "Membro IAM usado pelos deploys do app."
  type        = string
}
