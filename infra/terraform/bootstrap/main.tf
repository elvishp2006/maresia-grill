resource "google_storage_bucket" "terraform_state" {
  name                        = var.state_bucket_name
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = false

  versioning {
    enabled = true
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }

    condition {
      num_newer_versions = 30
      with_state         = "ARCHIVED"
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}
