# P0 #70 — Operational TTL 20-group policy guidance (2026-10-29)

**Status:** isolated source/documentation correction; Production **NO-GO**.

## Verified discrepancy

On base main 2808dc1cbb485f70b403681c108cea5a3361d950, the staging provisioner and read-only TTL evidence validator require 20 scoped collection-group expiresAt TTL policies. Current operational paragraphs in DATA_RETENTION.md and PRODUCTION_RUNBOOK.md still instructed reviewers to verify only 13; the staging apply example omitted the independent 20-group revision marker.

## Atomic correction and tests

- Current retention operation and read-only reviewer instructions consistently require 20 ACTIVE expiresAt groups for the authorized project/database.
- The commented apply example now includes KLAR_RETENTION_MATRIX_REVISION_APPROVED=expiresAt-20-2026-10-19, in addition to all existing independent Legal/Inventory/Project/Database gates.
- The existing source matrix checker now rejects obsolete 13-group instructions in current sections of both documentation files, while preserving historical audit statements.
- Five fail-closed fixture mutations cover stale operator and reviewer counts, missing revision approval and stale runbook count. All fixtures are local; no gcloud calls.

## Remaining release evidence

Execute the source checks locally and complete exact-head CI when the approved Actions budget permits. No live cloud TTL policy has been queried or activated. The complete signed retention matrix, historic expiration/hold inventory, actual staging ACTIVE state, Art.17 cascade and independent DPO/Legal/SRE/Release-owner signoffs remain unverified. Do not merge or deploy without those gates. **NO-GO.**
