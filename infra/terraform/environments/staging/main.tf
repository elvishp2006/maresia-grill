module "project_baseline" {
  source = "../../modules/project_baseline"

  project_id     = var.project_id
  project_number = var.project_number
}

module "functions_runtime" {
  source = "../../modules/functions_runtime"

  project_id          = var.project_id
  project_number      = var.project_number
  app_deployer_member = var.app_deployer_member

  depends_on = [module.project_baseline]
}
