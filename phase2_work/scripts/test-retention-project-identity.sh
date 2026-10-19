#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
script="${repo_root}/scripts/configure-retention.sh"
bash -n "${script}"
work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
mkdir -p "${work}/bin"
cat > "${work}/bin/gcloud" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "${MOCK_GCLOUD_LOG:?}"
if [[ "${1:-}" == projects && "${2:-}" == describe ]]; then
  printf '%s\n' "${MOCK_GCP_LABEL:-production}"
  exit 0
fi
if [[ "${1:-}" == firestore && "${2:-}" == fields && "${3:-}" == ttls && "${4:-}" == update ]]; then
  exit 0
fi
exit 4
MOCK
chmod +x "${work}/bin/gcloud"
export MOCK_GCLOUD_LOG="${work}/calls"
export PATH="${work}/bin:${PATH}"
export KLAR_PROJECT_ID=klar-staging-a KLAR_DATABASE_ID='(default)'
export KLAR_ENVIRONMENT=staging KLAR_APPROVED_STAGING_PROJECT_ID=klar-staging-a
export KLAR_PRODUCTION_PROJECT_ID=klar-production-a KLAR_CONFIRM_RETENTION='klar-staging-a/(default)'
export KLAR_RETENTION_LEGAL_APPROVED=true KLAR_RETENTION_INVENTORY_APPROVED=true
export KLAR_RETENTION_MATRIX_REVISION_APPROVED=expiresAt-20-2026-10-19
: > "${MOCK_GCLOUD_LOG}"
unset KLAR_APPLY_RETENTION || true
bash "${script}" > "${work}/dry"
grep -q 'DRY RUN ONLY' "${work}/dry"
[[ "$(grep -c '^PLAN:' "${work}/dry")" -eq 20 ]]
[[ ! -s "${MOCK_GCLOUD_LOG}" ]]
export KLAR_APPLY_RETENTION=true
export KLAR_APPROVED_STAGING_PROJECT_ID=klar-staging-other
if bash "${script}" >/dev/null 2>&1; then echo 'FAIL: wrong project accepted' >&2; exit 1; fi
[[ ! -s "${MOCK_GCLOUD_LOG}" ]]
export KLAR_APPROVED_STAGING_PROJECT_ID=klar-staging-a
export KLAR_PRODUCTION_PROJECT_ID=klar-staging-a
if bash "${script}" >/dev/null 2>&1; then echo 'FAIL: production alias accepted' >&2; exit 1; fi
[[ ! -s "${MOCK_GCLOUD_LOG}" ]]
export KLAR_PRODUCTION_PROJECT_ID=klar-production-a
export MOCK_GCP_LABEL=production
if bash "${script}" >/dev/null 2>&1; then echo 'FAIL: non-staging label accepted' >&2; exit 1; fi
[[ "$(grep -c '^firestore fields ttls update' "${MOCK_GCLOUD_LOG}" || true)" -eq 0 ]]
: > "${MOCK_GCLOUD_LOG}"
export MOCK_GCP_LABEL=staging
unset KLAR_RETENTION_MATRIX_REVISION_APPROVED
if bash "${script}" >/dev/null 2>&1; then echo 'FAIL: old TTL matrix approval accepted' >&2; exit 1; fi
[[ "$(grep -c '^firestore fields ttls update' "${MOCK_GCLOUD_LOG}" || true)" -eq 0 ]]
export KLAR_RETENTION_MATRIX_REVISION_APPROVED=expiresAt-20-2026-10-19
bash "${script}" > "${work}/apply"
[[ "$(grep -c '^firestore fields ttls update' "${MOCK_GCLOUD_LOG}")" -eq 20 ]]
[[ "$(grep -c '^projects describe' "${MOCK_GCLOUD_LOG}")" -eq 1 ]]
echo 'PASS: dry-run, project allowlist, production deny, GCP staging label, 20 gated updates'
