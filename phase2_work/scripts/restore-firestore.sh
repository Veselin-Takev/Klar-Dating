#!/usr/bin/env bash
set -euo pipefail

: "${KLAR_PROJECT_ID:?KLAR_PROJECT_ID is required}"
: "${KLAR_BACKUP_URI:?KLAR_BACKUP_URI is required}"
: "${KLAR_CONFIRM_RESTORE:?Set KLAR_CONFIRM_RESTORE to the exact project id}"
: "${FIRESTORE_DATABASE_ID:?FIRESTORE_DATABASE_ID is required (use (default) explicitly when intended)}"

if [[ "${KLAR_CONFIRM_RESTORE}" != "${KLAR_PROJECT_ID}" ]]; then
  echo "Restore confirmation does not match the target project" >&2
  exit 2
fi
if [[ ! "${KLAR_BACKUP_URI}" =~ ^gs://[a-z0-9._/-]+$ ]]; then
  echo "KLAR_BACKUP_URI must be a concrete gs:// export path" >&2
  exit 2
fi
if [[ "${KLAR_PROJECT_ID}" == *prod* && "${KLAR_CHANGE_TICKET:-}" == "" ]]; then
  echo "Production restores require KLAR_CHANGE_TICKET" >&2
  exit 2
fi

gcloud firestore import "${KLAR_BACKUP_URI}" --project "${KLAR_PROJECT_ID}" --database "${FIRESTORE_DATABASE_ID}" --async
echo "Restore submitted. Validate document counts, application readiness, and audit logs before reopening traffic."
