#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
: "${KLAR_PROJECT_ID:?KLAR_PROJECT_ID required}"
: "${KLAR_DATABASE_ID:?KLAR_DATABASE_ID required}"
[[ "${KLAR_PROJECT_ID}" =~ ^[a-z][a-z0-9-]{4,62}$ ]] || { echo 'Invalid project id' >&2; exit 2; }
[[ "${KLAR_DATABASE_ID}" =~ ^[a-zA-Z0-9_()-]+$ ]] || { echo 'Invalid database id' >&2; exit 2; }
groups=(
  messages archived_messages ki_zwischenspeicher age_attempts
  funnel_events ai_budget kyc_events account_deletions deletion_log
  partner_referral_click_rate_limits partner_referral_webhook_rate_limits
  partner_referral_admin_rate_limits partner_referral_user_rate_limits
  password_reset_rate_limits verification_mail_rate_limits
  account_deletion_rate_limits kyc_start_rate_limits kyc_reconciliation_events
  chat_message_rate_limits chat_gate_answer_rate_limits
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
[[ "${KLAR_RETENTION_MATRIX_REVISION_APPROVED:-}" == expiresAt-20-2026-10-19 ]] || { echo '20-group TTL expansion requires NEW approved retention matrix revision' >&2; exit 3; }
command -v gcloud >/dev/null || { echo 'gcloud CLI unavailable' >&2; exit 3; }
cloud_environment="$(gcloud projects describe "${KLAR_PROJECT_ID}" --format='value(labels.environment)')" || { echo 'Could not independently confirm GCP project environment' >&2; exit 3; }
[[ "${cloud_environment}" == staging ]] || { echo 'GCP project is not labelled staging: refusing TTL mutation' >&2; exit 3; }
# Preflight existing policies BEFORE the first mutation. Unapproved groups,
# nonzero offsets, wrong fields and in-progress changes block all updates.
command -v node >/dev/null || { echo 'Node runtime unavailable for TTL preflight' >&2; exit 3; }
existing_policies="$(mktemp)"
trap 'rm -f -- "$existing_policies"' EXIT
gcloud firestore fields ttls list --project="${KLAR_PROJECT_ID}" --database="${KLAR_DATABASE_ID}" --format=json > "$existing_policies"
node "$repo_root/scripts/check-retention-active-evidence.mjs" \
  --evidence "$existing_policies" --project "$KLAR_PROJECT_ID" --database "$KLAR_DATABASE_ID" --mode preflight
for group in "${groups[@]}"; do
  gcloud firestore fields ttls update expiresAt \
    --collection-group="${group}" \
    --database="${KLAR_DATABASE_ID}" \
    --project="${KLAR_PROJECT_ID}" \
    --enable-ttl --quiet
done
printf '%s\n' 'Activation requested for staging only; separately verify all policies become ACTIVE.'
