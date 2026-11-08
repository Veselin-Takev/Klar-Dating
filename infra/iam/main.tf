terraform {
  required_version = ">= 1.9, < 2.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 6.0, < 8.0"
    }
  }
}
variable "project_id" {
  type = string
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "An approved dedicated application project ID is required."
  }
}
variable "storage_bucket" { type = string }
variable "runtime_secret_ids" {
  type    = set(string)
  default = []
}
resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = "klar-runtime"
  display_name = "Klar application runtime"
}
resource "google_project_iam_member" "firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}
resource "google_project_iam_custom_role" "runtime_auth" {
  project     = var.project_id
  role_id     = "klarRuntimeAuth"
  title       = "Klar runtime Auth operations"
  permissions = ["firebaseauth.users.get", "firebaseauth.users.create", "firebaseauth.users.update", "firebaseauth.users.delete", "firebaseauth.users.sendEmail"]
}
resource "google_project_iam_member" "auth" {
  project = var.project_id
  role    = google_project_iam_custom_role.runtime_auth.name
  member  = "serviceAccount:${google_service_account.runtime.email}"
}
resource "google_storage_bucket_iam_member" "objects" {
  bucket = var.storage_bucket
  role   = "roles/storage.objectUser"
  member = "serviceAccount:${google_service_account.runtime.email}"
}
resource "google_secret_manager_secret_iam_member" "runtime" {
  for_each  = var.runtime_secret_ids
  project   = var.project_id
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}
output "runtime_service_account" { value = google_service_account.runtime.email }
