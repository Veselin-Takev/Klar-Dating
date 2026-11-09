#!/usr/bin/env bash
# Read-only GCP capture. Publish one complete external directory, never partial Git evidence.
set +x
set -euo pipefail
umask 077

fail() { printf 'IAM collector preflight failed: %s\n' "$1" >&2; exit 1; }
if [[ ${1:-} == --help && $# == 1 ]]; then
  printf '%s\n' 'Required: GCP_PROJECT_ID GCP_REGION STORAGE_BUCKET_NAME CLOUD_RUN_SERVICE' \
    '          GCP_COLLECTOR_SERVICE_ACCOUNT GCP_EXPECTED_BUILD_SHA GCP_EVIDENCE_DIRECTORY' \
    'Configure a read-only gcloud identity first. See docs/security/GCP_LIVE_IAM_REQUIREMENTS.md.'
  exit 0
fi
[[ $# == 0 ]] || fail unexpected_arguments
for name in GCP_PROJECT_ID GCP_REGION STORAGE_BUCKET_NAME CLOUD_RUN_SERVICE \
  GCP_COLLECTOR_SERVICE_ACCOUNT GCP_EXPECTED_BUILD_SHA GCP_EVIDENCE_DIRECTORY; do
  [[ -n ${!name:-} ]] || fail "missing_$name"
done
[[ $GCP_PROJECT_ID =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]] || fail invalid_project
[[ $GCP_REGION =~ ^[a-z]+-[a-z]+[0-9]$ ]] || fail invalid_region
[[ $STORAGE_BUCKET_NAME =~ ^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$ ]] || fail invalid_bucket
[[ $CLOUD_RUN_SERVICE =~ ^[a-z][a-z0-9-]{0,62}$ ]] || fail invalid_service
[[ $GCP_COLLECTOR_SERVICE_ACCOUNT =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]@[a-z][a-z0-9-]{4,28}[a-z0-9]\.iam\.gserviceaccount\.com$ ]] || fail invalid_collector_identity
[[ $GCP_EXPECTED_BUILD_SHA =~ ^[0-9a-f]{40}$ ]] || fail invalid_expected_sha

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
app="$root/phase2_work"
for command in node gcloud git stat mktemp mv timeout; do command -v "$command" >/dev/null || fail "missing_$command"; done
[[ $(node --version) == v22.23.3 ]] || fail node_22_23_3_required
[[ -f "$app/node_modules/tsx/package.json" ]] || fail locked_dependencies_required
[[ $(git -C "$root" rev-parse HEAD) == "$GCP_EXPECTED_BUILD_SHA" ]] || fail checkout_sha_mismatch
[[ -z $(git -C "$root" status --porcelain) ]] || fail clean_checkout_required

# Reject conflicting aliases instead of silently capturing a different resource.
[[ -z ${KLAR_PROJECT_ID:-} || $KLAR_PROJECT_ID == "$GCP_PROJECT_ID" ]] || fail project_alias_conflict
[[ -z ${KLAR_REGION:-} || $KLAR_REGION == "$GCP_REGION" ]] || fail region_alias_conflict
[[ -z ${KLAR_SERVICE:-} || $KLAR_SERVICE == "$CLOUD_RUN_SERVICE" ]] || fail service_alias_conflict
[[ -z ${KLAR_STORAGE_BUCKET:-} || $KLAR_STORAGE_BUCKET == "$STORAGE_BUCKET_NAME" ]] || fail bucket_alias_conflict
export KLAR_PROJECT_ID="$GCP_PROJECT_ID" KLAR_REGION="$GCP_REGION"
export KLAR_SERVICE="$CLOUD_RUN_SERVICE" KLAR_STORAGE_BUCKET="$STORAGE_BUCKET_NAME"

[[ $GCP_EVIDENCE_DIRECTORY == /* && -d $GCP_EVIDENCE_DIRECTORY ]] || fail existing_absolute_evidence_directory_required
vault=$(cd -- "$GCP_EVIDENCE_DIRECTORY" && pwd -P)
case "$vault/" in "$root/"*) fail evidence_must_be_outside_repository ;; esac
[[ $(stat -c %u -- "$vault") == "$(id -u)" ]] || fail evidence_directory_owner_mismatch
permissions=$(stat -c %a -- "$vault")
[[ $permissions == 700 ]] || fail private_evidence_directory_required

staging=''
cleanup() { if [[ -n $staging && -d $staging ]]; then rm -rf -- "$staging"; fi; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP
staging=$(mktemp -d "$vault/.iam-pending.XXXXXXXX")
export CLOUDSDK_CORE_DISABLE_PROMPTS=1 CLOUDSDK_CORE_LOG_HTTP=false CLOUDSDK_CORE_VERBOSITY=error
export CLOUDSDK_CORE_PROJECT="$GCP_PROJECT_ID"

# ADC alone does not select gcloud's account. Pin direct credentials or the
# explicitly configured impersonation target; never print an access token.
impersonation=$(timeout 60s gcloud config get-value auth/impersonate_service_account --quiet 2>"$staging/auth.log") || fail gcloud_identity_configuration_failed
if [[ -n $impersonation && $impersonation != '(unset)' ]]; then
  [[ $impersonation == "$GCP_COLLECTOR_SERVICE_ACCOUNT" ]] || fail impersonation_target_mismatch
  export CLOUDSDK_AUTH_IMPERSONATE_SERVICE_ACCOUNT="$GCP_COLLECTOR_SERVICE_ACCOUNT"
else
  export CLOUDSDK_CORE_ACCOUNT="$GCP_COLLECTOR_SERVICE_ACCOUNT"
fi
timeout 60s gcloud auth print-access-token --quiet > /dev/null 2>"$staging/auth.log" || fail credential_binding_unavailable
timeout 60s gcloud version --format=json >"$staging/toolchain.json" 2>"$staging/toolchain.log" || fail gcloud_version_unavailable
export KLAR_IAM_PRIVATE_OUTPUT="$staging/iam-private.json"
export KLAR_IAM_SUMMARY_OUTPUT="$staging/live-iam-evidence.json"
if ! (cd -- "$app" && node --import=tsx scripts/export-live-iam-evidence.ts) >"$staging/collector.log" 2>&1; then
  fail capture_failed_no_bundle_published
fi
[[ $(git -C "$root" rev-parse HEAD) == "$GCP_EXPECTED_BUILD_SHA" && -z $(git -C "$root" status --porcelain) ]] || fail checkout_changed_during_capture
node "$app/scripts/finalize-iam-bundle.mjs" "$staging" >"$staging/finalize.log" 2>&1 || fail evidence_integrity_failed

bundle="iam-${GCP_EXPECTED_BUILD_SHA:0:12}-${staging##*.}"
# Same filesystem, single atomic rename. GNU mv -n refuses an existing bundle.
mv -T -n -- "$staging" "$vault/$bundle" || fail atomic_publication_failed
[[ ! -e $staging ]] || fail evidence_bundle_collision
staging=''
printf '{"event":"iam_evidence_bundle_published","bundle":"%s","review":"PENDING","productionApproved":false}\n' "$bundle"
