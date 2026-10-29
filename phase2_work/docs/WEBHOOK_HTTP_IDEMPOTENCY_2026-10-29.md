# Signed partner webhook HTTP idempotency — 2026-10-29

**DRAFT / PRODUCTION NO-GO**

## New regression
The Express HTTP test seeds a verified active campaign, a signed referral binding and two consenting adult buyers in a deterministic Firestore double. A fresh valid signed conversion must return HTTP 201, an exact signed retry HTTP 200 with `already_recorded`, and a signed replay using the *same provider event ID* with a different buyer HTTP 409 `partner_event_id_conflict`. Private no-store/no-referrer headers are checked. The mock's document factory now supports auto IDs for the audit ledger.

## Evidence limitations
New code is committed but untested at this exact HEAD. In-memory transactions do not model Firestore optimistic concurrency, process crashes, distributed workers or emulator behavior. A partner-signed assertion never proves an actual purchase; reward stays pending_verification. Require exact-HEAD CI, Firebase emulator concurrency, external conversion provenance verification, independent Security/DPO/SRE reviewers and Release Owner GO.

## Merge governance
Stacked on draft #198 → #197 … #192. Choose one reviewed merge path and revalidate final SHA; do not merge ancestors redundantly. Issues #55, #56, #70, #8 remain open. No deploy. **BLOCKED/NO-GO.**
