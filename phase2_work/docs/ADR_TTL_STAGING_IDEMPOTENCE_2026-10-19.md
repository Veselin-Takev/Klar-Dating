# ADR-2026-10-19: Idempotent TTL staging activation with fail-closed evidence

**Status:** Proposed; no production release sign-off. **Decision:** skip already ACTIVE and approved TTL policies after scoped read-only preflight, rather than re-requesting all 20 updates.

## Context

The 20-group approved retention plan was gated to an explicit non-production Firestore project/database, legal/inventory confirmation, Cloud staging label and a separate source-level preflight that rejects unexpected or non-ACTIVE policies. Reissuing `gcloud firestore fields ttls update --enable-ttl` for every already ACTIVE policy is not a minimal or deterministic change plan and complicates operational audit/quotas.

## Decision

1. Default dry-run remains unchanged; live Cloud access is still forbidden without the existing independently approved staging change ticket.
2. The read-only preflight validates all existing TTL records against the 20-group allowlist (field `expiresAt`, `ACTIVE`, zero/default offset, correct project/database) before returning **machine-readable** existing group identifiers via `--mode preflight-ids`.
3. The staging loop skips each already ACTIVE group; only missing approved policies are eligible for sequential update. Mock regression tests prove **20, 18 and 0** requested updates for **0, 2 and 20** already active groups, respectively, and fail closed for unsafe input.
4. The separate final evidence validation still requires **all 20 ACTIVE**. A successful before-write subset check must never be reported as final active evidence.

## Security/operational limitations

- Snapshots are not a cross-service transaction: an independent administrator could modify a policy after preflight (**TOCTOU**). Require a controlled change window, Cloud IAM separation of duty and final independent evidence.
- Firestore TTL activation takes time, is billed per document deletion, can delete existing expired documents and does not recursively delete subcollections.
- Sequential operations may partially succeed if the process fails. Preserve the change ticket and captured stdout; reconcile the actual state read-only before retrying. Do not automatically disable existing policies to simulate rollback.
- Consent/Art.17 legal-hold exceptions require their own data-classification controls; do not assume TTL enforces holds.

## N-1 and rollback

No schema, collection name, expiration timestamp type, API contract, security rules or index definition changed. The prior application code is N-1 compatible. Reverting this CLI control changes future *staging provisioning commands* only; it does not undo external Cloud policies or resurrect deleted data. Roll back by reverting this commit on the development branch after approval; never merge/deploy automatically. Clear evidence/re-approval is required for any true Cloud policy rollback.

## Verification

Use `npm run check:retention-p0` plus the complete mandatory Enterprise Gate checklist and true approved staging proof. Current evidence remains local fixture/mock only. **Production NO-GO.**
