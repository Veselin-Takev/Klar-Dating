#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
script=scripts/configure-retention.sh
bash -n "$script"
output="$(KLAR_PROJECT_ID=klar-staging-123 KLAR_DATABASE_ID='(default)' bash "$script")"
[[ "$(grep -c '^PLAN:' <<< "$output")" -eq 20 ]]
grep -q 'DRY RUN ONLY' <<< "$output"
if KLAR_PROJECT_ID=klar-staging-123 KLAR_DATABASE_ID='(default)' KLAR_APPLY_RETENTION=true bash "$script" >/dev/null 2>&1; then
  echo "FAIL: apply without approvals succeeded" >&2
  exit 1
fi
if KLAR_PROJECT_ID=klar-staging-123 KLAR_DATABASE_ID='(default)' KLAR_ENVIRONMENT=production KLAR_APPLY_RETENTION=true KLAR_CONFIRM_RETENTION='klar-staging-123/(default)' KLAR_RETENTION_LEGAL_APPROVED=true KLAR_RETENTION_INVENTORY_APPROVED=true bash "$script" >/dev/null 2>&1; then
  echo "FAIL: production apply succeeded" >&2
  exit 1
fi
echo "PASS: syntax, 20 groups, default dry run, denied unapproved and production apply"
