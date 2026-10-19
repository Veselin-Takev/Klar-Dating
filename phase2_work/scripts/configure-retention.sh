#!/usr/bin/env bash
set -euo pipefail
: "${KLAR_PROJECT_ID:?KLAR_PROJECT_ID required}"
: "${KLAR_DATABASE_ID:?KLAR_DATABASE_ID required}"
[[ "${KLAR_PROJECT_ID}" =~ ^[a-z][a-z0-9-]{4,62}$ ]] || { echo 'Invalid project id' >&2; exit 2; }
[[ "${KLAR_DATABASE_ID}" =~ ^[a-zA-Z0-9_()-]+$ ]] || { echo 'Invalid database id' >&2; exit 2; }
groups=(
  messages archived_messages ki_zwischenspeicher age_attempts
  funnel_events ai_budget kyc_events account_deletions deletion_log
  partner_referral_click_rate_limits partner_referral_webhook_rate_limits
  partner_referral_admin_rate_limits partner_referral_user_rate_limits
)
for group in "${groups[@]}"; do
  printf 'PLAN: gcloud firestore fields ttls update expiresAt --collection-group=%s --database=%s --project=%s --enable-ttl\n' "${group}" "${KLAR_DATABASE_ID}" "${KLAR_PROJECT_ID}"
done
if [[ "${KLAR_APPLY_RETENTION:-false}" != true ]]; then
  echo 'DRY RUN ONLY: no policies modified.'
  exit 0
fi
[[ "${KLAR_ENVIRONMENT:-}" == staging ]] || { echo 'Only staging changes allowed' >&2; exit 3; }
[[ -n "${KLAR_APPROVED_STAGING_PROJECT_ID:-}" && "${KLAR_PROJECT_ID}" == "${KLAR_APPROVED_STAGING_PROJECT_ID}" ]] || { echo 'Target must exactly match the approved staging project ID' >&2; exit 3; }
[[ -n "${KLAR_PRODUCTION_PROJECT_ID:-}" && "${KLAR_PROJECT_ID}" != "${KLAR_PRODUCTION_PROJECT_ID}" ]] || { echo 'Production project identity must be set and distinct from staging' >&2; exit 3; }
[[ "${KLAR_CONFIRM_RETENTION:-}" == "${KLAR_PROJECT_ID}/${KLAR_DATABASE_ID}" ]] || { echo 'Exact project/database approval required' >&2; exit 3; }
[[ "${KLAR_RETENTION_LEGAL_APPROVED:-}" == true ]] || { echo 'Legal retention matrix approval required' >&2; exit 3; }
[[ "${KLAR_RETENTION_INVENTORY_APPROVED:-}" == true ]] || { echo 'Existing expired-data and legal-hold inventory required' >&2; exit 3; }
command -v gcloud >/dev/null || { echo 'gcloud CLI unavailable' >&2; exit 3; }
cloud_environment="$(gcloud projects describe "${KLAR_PROJECT_ID}" --format='value(labels.environment)')" || { echo 'Could not independently confirm GCP project environment' >&2; exit 3; }
[[ "${cloud_environment}" == staging ]] || { echo 'GCP project is not labelled staging: refusing TTL mutation' >&2; exit 3; }
for group in "${groups[@]}"; do
  gcloud firestore fields ttls update expiresAt \
    --collection-group="${group}" \
    --database="${KLAR_DATABASE_ID}" \
    --project="${KLAR_PROJECT_ID}" \
    --enable-ttl --quiet
done
printf '%s\n' 'Activation requested for staging only; separately verify all policies become ACTIVE.'
