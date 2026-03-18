variable "project_id" {
  description = "ID do projeto staging."
  type        = string
}

variable "project_number" {
  description = "Número do projeto staging."
  type        = string
}

variable "region" {
  description = "Região das Functions."
  type        = string
  default     = "us-central1"
}

variable "app_deployer_member" {
  description = "Membro IAM do deploy do app em staging."
  type        = string
}
