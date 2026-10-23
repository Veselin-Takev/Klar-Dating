#!/usr/bin/env bash
# Read-only TTL evidence capture for an explicitly approved STAGING project.
set -euo pipefail
umask 077
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
: "${KLAR_PROJECT_ID:?An explicit KLAR_PROJECT_ID is required}"
: "${KLAR_DATABASE_ID:?An explicit KLAR_DATABASE_ID is required}"
: "${KLAR_APPROVED_STAGING_PROJECT_ID:?Approved staging project ID is required}"
: "${KLAR_PRODUCTION_PROJECT_ID:?Distinct production project ID is required}"
: "${KLAR_CONFIRM_RETENTION:?Confirm project/database scope}"
[[ "${KLAR_ENVIRONMENT:-}" == staging ]] || { echo 'Only staging TTL evidence is permitted' >&2; exit 3; }
[[ "${KLAR_APPLY_RETENTION:-false}" != true ]] || { echo 'This verifier never applies TTL changes' >&2; exit 3; }
[[ "$KLAR_PROJECT_ID" =~ ^[a-z][a-z0-9-]{4,62}$ ]] || { echo 'Invalid project ID' >&2; exit 2; }
[[ "$KLAR_DATABASE_ID" =~ ^[a-zA-Z0-9_()-]+$ ]] || { echo 'Invalid database ID' >&2; exit 2; }
[[ "$KLAR_PROJECT_ID" == "$KLAR_APPROVED_STAGING_PROJECT_ID" ]] || { echo 'Project not approved for staging' >&2; exit 3; }
[[ "$KLAR_PROJECT_ID" != "$KLAR_PRODUCTION_PROJECT_ID" ]] || { echo 'Cannot query production identity as staging' >&2; exit 3; }
[[ "$KLAR_CONFIRM_RETENTION" == "$KLAR_PROJECT_ID/$KLAR_DATABASE_ID" ]] || { echo 'Project/database confirmation mismatch' >&2; exit 3; }

# Optional export must be a new file outside the repository.
export_path="${KLAR_TTL_EVIDENCE_PATH:-}"
if [[ -n "$export_path" ]]; then
  [[ "$export_path" == /* ]] || { echo 'Evidence export path must be absolute' >&2; exit 3; }
  [[ ! -e "$export_path" && ! -L "$export_path" ]] || { echo 'Evidence export must not overwrite a file or symlink' >&2; exit 3; }
  export_parent="$(cd -- "$(dirname -- "$export_path")" && pwd -P)" || exit 3
  [[ "$export_parent" != "$repo_root" && "$export_parent" != "$repo_root/"* ]] || { echo 'Evidence must not be saved in repository' >&2; exit 3; }
fi
command -v gcloud >/dev/null || { echo 'gcloud CLI unavailable' >&2; exit 3; }
command -v node >/dev/null || { echo 'Node runtime unavailable' >&2; exit 3; }
command -v sha256sum >/dev/null || { echo 'sha256sum unavailable' >&2; exit 3; }
cloud_environment="$(gcloud projects describe "$KLAR_PROJECT_ID" --format='value(labels.environment)')" || {
  echo 'Could not verify GCP environment label' >&2
  exit 3
}
[[ "$cloud_environment" == staging ]] || { echo 'GCP project is not labelled staging' >&2; exit 3; }
work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
evidence="$work/ttls.json"
# This is the ONLY Firestore CLI operation; no create/update/delete permitted.
gcloud firestore fields ttls list --project="$KLAR_PROJECT_ID" --database="$KLAR_DATABASE_ID" --format=json > "$evidence"
node "$repo_root/scripts/check-retention-active-evidence.mjs" \
  --evidence "$evidence" --project "$KLAR_PROJECT_ID" --database "$KLAR_DATABASE_ID"
digest="$(sha256sum "$evidence")"
digest="${digest%% *}"
if [[ -n "$export_path" ]]; then
  # COPYFILE_EXCL atomically refuses an existing destination, including links.
  node -e 'const fs=require("node:fs");fs.copyFileSync(process.argv[1],process.argv[2],fs.constants.COPYFILE_EXCL)' "$evidence" "$export_path"
  echo "Read-only evidence saved to $export_path (mode 0600)"
fi
printf 'READ-ONLY STAGING TTL evidence PASS (not independent approval): project=%s database=%s captured_utc=%s sha256=%s\n' \
  "$KLAR_PROJECT_ID" "$KLAR_DATABASE_ID" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$digest"
