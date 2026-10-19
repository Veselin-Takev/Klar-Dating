#!/usr/bin/env bash
# Offline only: a mock gcloud must be the sole provider of all project data.
set -euo pipefail
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
runner="$root/scripts/verify-retention-staging-live.sh"
bash -n "$runner"
work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
mkdir -p "$work/bin"
cat > "$work/bin/gcloud" <<'GCLOUD'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$MOCK_GCLOUD_LOG"
if [[ "$1" == projects && "$2" == describe ]]; then
  printf '%s\n' "$MOCK_GCP_LABEL"
elif [[ "$1" == firestore && "$2" == fields && "$3" == ttls && "$4" == list ]]; then
  [[ "${MOCK_LIST_FAIL:-false}" != true ]] || exit 24
  cat "$MOCK_TTL_DATA"
else
  echo 'FAIL: unexpected or mutating gcloud call' >&2
  exit 95
fi
GCLOUD
chmod +x "$work/bin/gcloud"
node - "$root" "$work/valid.json" "$work/creating.json" "$work/missing.json" <<'NODE'
const fs = require('node:fs');
const text = fs.readFileSync(process.argv[2] + '/scripts/configure-retention.sh', 'utf8');
const match = text.match(/(?:^|\n)groups=\(\s*([\s\S]*?)\s*\)/);
if (!match) throw new Error('TTL matrix unavailable');
const groups = match[1].trim().split(/\s+/);
if (groups.length !== 13) throw new Error('Expected exactly 13 groups');
const fields = groups.map(group => ({
  name: 'projects/klar-staging-test/databases/(default)/collectionGroups/' + group + '/fields/expiresAt',
  ttlConfig: { state: 'ACTIVE' },
}));
fs.writeFileSync(process.argv[3], JSON.stringify(fields));
fs.writeFileSync(process.argv[4], JSON.stringify(fields.map((f, i) => i === 0 ? {...f, ttlConfig: {state:'CREATING'}} : f)));
fs.writeFileSync(process.argv[5], JSON.stringify(fields.slice(1)));
NODE
export PATH="$work/bin:$PATH"
export MOCK_GCLOUD_LOG="$work/gcloud.log"
export MOCK_GCP_LABEL=staging
export MOCK_TTL_DATA="$work/valid.json"
export KLAR_ENVIRONMENT=staging
export KLAR_PROJECT_ID=klar-staging-test
export KLAR_DATABASE_ID='(default)'
export KLAR_APPROVED_STAGING_PROJECT_ID=klar-staging-test
export KLAR_PRODUCTION_PROJECT_ID=klar-production-test
export KLAR_CONFIRM_RETENTION='klar-staging-test/(default)'
unset KLAR_APPLY_RETENTION KLAR_TTL_EVIDENCE_PATH || true

: > "$MOCK_GCLOUD_LOG"
export KLAR_TTL_EVIDENCE_PATH="$work/captured.json"
bash "$runner" > "$work/success.out"
grep -q 'READ-ONLY STAGING TTL evidence PASS' "$work/success.out"
cmp "$MOCK_TTL_DATA" "$KLAR_TTL_EVIDENCE_PATH"
[[ "$(stat -c '%a' "$KLAR_TTL_EVIDENCE_PATH")" == 600 ]]
[[ "$(grep -c '^projects describe' "$MOCK_GCLOUD_LOG")" == 1 ]]
[[ "$(grep -c '^firestore fields ttls list' "$MOCK_GCLOUD_LOG")" == 1 ]]
[[ "$(grep -c '^firestore fields ttls update' "$MOCK_GCLOUD_LOG" || true)" == 0 ]]
echo 'PASS: valid read-only staging capture scoped to project/database, mode 0600, zero mutations'

failed=0
deny() {
  local label="$1"
  shift
  if "$@" > "$work/denied.stdout" 2> "$work/denied.stderr"; then
    echo "FAIL: $label was accepted" >&2
    exit 1
  fi
  if grep -q '^firestore fields ttls update' "$MOCK_GCLOUD_LOG"; then
    echo "FAIL: gcloud mutation occurred during $label" >&2
    exit 1
  fi
  failed=$((failed + 1))
}
: > "$MOCK_GCLOUD_LOG"
deny 'existing output file' bash "$runner"
export KLAR_TTL_EVIDENCE_PATH="$work/invalid-export.json"
KLAR_ENVIRONMENT=production deny 'production env' bash "$runner"
KLAR_APPROVED_STAGING_PROJECT_ID=klar-other-test deny 'wrong staging allowlist' bash "$runner"
KLAR_PRODUCTION_PROJECT_ID=klar-staging-test deny 'production alias' bash "$runner"
KLAR_CONFIRM_RETENTION='klar-staging-test/other' deny 'database mismatch' bash "$runner"
KLAR_APPLY_RETENTION=true deny 'mutating mode' bash "$runner"
MOCK_GCP_LABEL=production deny 'wrong GCP project label' bash "$runner"
MOCK_TTL_DATA="$work/creating.json" deny 'unready TTL state' bash "$runner"
MOCK_TTL_DATA="$work/missing.json" deny 'missing TTL group' bash "$runner"
MOCK_LIST_FAIL=true deny 'failed gcloud response' bash "$runner"
ln -s "$work/nonexistent.json" "$work/symlink.json"
KLAR_TTL_EVIDENCE_PATH="$work/symlink.json" deny 'symlink output target' bash "$runner"
KLAR_TTL_EVIDENCE_PATH="$root/docs/do-not-create-ttl-evidence.json" deny 'output inside repo' bash "$runner"
[[ ! -e "$root/docs/do-not-create-ttl-evidence.json" ]]
[[ ! -e "$work/invalid-export.json" ]]
[[ "$(grep -c '^firestore fields ttls update' "$MOCK_GCLOUD_LOG" || true)" == 0 ]]
echo "PASS: $failed fail-closed read-only staging evidence scenarios (mock gcloud only)"
