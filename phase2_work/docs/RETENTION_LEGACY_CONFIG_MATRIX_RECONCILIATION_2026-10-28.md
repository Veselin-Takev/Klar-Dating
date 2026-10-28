# Retention configuration legacy-check reconciliation — Issue #70 (2026-10-28)

**Draft / Production NO-GO**. Baseline `main` SHA `2808dc1cbb485f70b403681c108cea5a3361d950`.

## Root cause

`scripts/check-retention-config.mjs` still parsed the obsolete `for collection_group in ...; do` loop even though the guarded retention provisioner has moved to an explicit 20-group `groups=(...)` array. Consequently the independent legacy check reported all nine original required groups as missing for the current correct script. The canonical `scripts/check-retention-matrix.mjs` already validates exact group ordering, count, documentation, staging-only dry-run gates, the preflight and idempotency checks.

## Fix

The legacy checker now imports and executes the canonical matrix gate and reads the same `groups=(...)` list for its nine writer/document crosschecks; duplicate entries and absent matrix fail closed. Existing message/archive/KYC/photo-writer checks and confirmation checks remain intact. No new TTL group, retention duration, deletion procedure, live cloud call or production mutation is introduced.

## Verification boundary

Run from `phase2_work`: `node scripts/check-retention-matrix.mjs` and `node scripts/check-retention-config.mjs`, then the full `npm run check:retention-p0` and exact-HEAD CI. The static gates are not evidence of deployed ACTIVE TTL policies. Approved legal holds, retention matrix approval, real scoped `gcloud firestore fields ttls list` evidence and independent Security/DPO/SRE signoff remain outstanding under #70/#8. **Production NO-GO**.
