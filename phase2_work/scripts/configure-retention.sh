#!/usr/bin/env bash
set -euo pipefail

: "${KLAR_PROJECT_ID:?KLAR_PROJECT_ID is required}"
: "${KLAR_CONFIRM_RETENTION:?Set KLAR_CONFIRM_RETENTION to the exact project id}"

if [[ "${KLAR_CONFIRM_RETENTION}" != "${KLAR_PROJECT_ID}" ]]; then
  echo "Retention confirmation does not match the target project" >&2
  exit 2
fi

for collection_group in messages ki_zwischenspeicher age_attempts deletion_log; do
  gcloud firestore fields ttls update expiresAt     --collection-group="${collection_group}"     --enable-ttl     --project="${KLAR_PROJECT_ID}"     --quiet
done

echo "TTL policies requested. Verify ACTIVE state with: gcloud firestore fields ttls list --project ${KLAR_PROJECT_ID}"
