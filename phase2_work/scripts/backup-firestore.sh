#!/usr/bin/env bash
set -euo pipefail

: "${KLAR_PROJECT_ID:?KLAR_PROJECT_ID is required}"
: "${KLAR_BACKUP_BUCKET:?KLAR_BACKUP_BUCKET must be a gs:// bucket}"
: "${FIRESTORE_DATABASE_ID:?FIRESTORE_DATABASE_ID is required (use (default) explicitly when intended)}"

if [[ ! "${KLAR_BACKUP_BUCKET}" =~ ^gs://[a-z0-9._-]+$ ]]; then
  echo "KLAR_BACKUP_BUCKET must be a bucket root such as gs://klar-backups" >&2
  exit 2
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
destination="${KLAR_BACKUP_BUCKET}/firestore/${KLAR_PROJECT_ID}/${timestamp}"
gcloud firestore export "${destination}" --project "${KLAR_PROJECT_ID}" --database "${FIRESTORE_DATABASE_ID}" --async
printf '%s\n' "${destination}"
