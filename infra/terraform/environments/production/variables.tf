variable "project_id" {
  description = "ID do projeto de produção."
  type        = string
}

variable "project_number" {
  description = "Número do projeto de produção."
  type        = string
}

variable "region" {
  description = "Região das Functions."
  type        = string
  default     = "us-central1"
}

variable "app_deployer_member" {
  description = "Membro IAM do deploy do app em produção."
  type        = string
}
