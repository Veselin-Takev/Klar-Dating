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
if [[ "${1:-}" == firestore && "${2:-}" == fields && "${3:-}" == ttls && "${4:-}" == list ]]; then
  [[ "${MOCK_TTL_LIST_FAIL:-false}" != true ]] || exit 21
  printf '%s\n' "${MOCK_TTL_LIST_JSON:-[]}"
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
[[ "$(grep -c '^firestore fields ttls list' "${MOCK_GCLOUD_LOG}")" -eq 1 ]]
# New updates must be idempotent: existing ACTIVE policies are skipped.
: > "$MOCK_GCLOUD_LOG"
export MOCK_TTL_LIST_JSON='[{"name":"projects/klar-staging-a/databases/(default)/collectionGroups/messages/fields/expiresAt","ttlConfig":{"state":"ACTIVE"}},{"name":"projects/klar-staging-a/databases/(default)/collectionGroups/archived_messages/fields/expiresAt","ttlConfig":{"state":"ACTIVE"}}]'
bash "${script}" > "$work/partial"
[[ "$(grep -c '^firestore fields ttls update' "$MOCK_GCLOUD_LOG")" -eq 18 ]]
[[ "$(grep -c '^SKIP: TTL policy already ACTIVE' "$work/partial")" -eq 2 ]]
: > "$MOCK_GCLOUD_LOG"
export MOCK_TTL_LIST_JSON="$(node -e 'const fs=require("fs");const s=fs.readFileSync(process.argv[1],"utf8");const g=s.match(/groups=\(\s*([\s\S]*?)\s*\)/)[1].trim().split(/\s+/);process.stdout.write(JSON.stringify(g.map(x=>({name:"projects/klar-staging-a/databases/(default)/collectionGroups/"+x+"/fields/expiresAt",ttlConfig:{state:"ACTIVE"}}))))' "$script")"
bash "$script" > "$work/already-active"
[[ "$(grep -c '^firestore fields ttls update' "$MOCK_GCLOUD_LOG" || true)" -eq 0 ]]
[[ "$(grep -c '^SKIP: TTL policy already ACTIVE' "$work/already-active")" -eq 20 ]]
# No write may occur if even one existing TTL policy was unapproved or
# altered; actual gcloud calls are a fake executable in this test.
: > "$MOCK_GCLOUD_LOG"
export MOCK_TTL_LIST_JSON='[{"name":"projects/klar-staging-a/databases/(default)/collectionGroups/unapproved_group/fields/expiresAt","ttlConfig":{"state":"ACTIVE"}}]'
if bash "${script}" >"${work}/unsafe" 2>&1; then echo 'FAIL: unapproved existing TTL accepted' >&2; exit 1; fi
[[ "$(grep -c '^firestore fields ttls update' "${MOCK_GCLOUD_LOG}" || true)" -eq 0 ]]
[[ "$(grep -c '^firestore fields ttls list' "${MOCK_GCLOUD_LOG}" || true)" -eq 1 ]]
: > "$MOCK_GCLOUD_LOG"
export MOCK_TTL_LIST_JSON='[{"name":"projects/klar-staging-a/databases/(default)/collectionGroups/messages/fields/expiresAt","ttlConfig":{"state":"CREATING"}}]'
if bash "${script}" >/dev/null 2>&1; then echo 'FAIL: in-progress TTL modification accepted' >&2; exit 1; fi
[[ "$(grep -c '^firestore fields ttls update' "${MOCK_GCLOUD_LOG}" || true)" -eq 0 ]]
: > "$MOCK_GCLOUD_LOG"
export MOCK_TTL_LIST_JSON='[]'
export MOCK_TTL_LIST_FAIL=true
if bash "${script}" >/dev/null 2>&1; then echo 'FAIL: gcloud list error accepted' >&2; exit 1; fi
[[ "$(grep -c '^firestore fields ttls update' "${MOCK_GCLOUD_LOG}" || true)" -eq 0 ]]
unset MOCK_TTL_LIST_FAIL
echo 'PASS: dry-run, GCP staging identity, read-only existing-TTL preflight and 20 gated updates; unsafe preflight blocks all writes'
