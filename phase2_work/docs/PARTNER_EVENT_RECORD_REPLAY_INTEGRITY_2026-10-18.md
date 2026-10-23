# P0 #55 — Partner conversion event-record integrity on replay (2026-10-18)

**Status:** Draft / **NO-GO**. Stacked on buyer-claim consistency PR #94.

## Threat and fix
Previously an exact signed webhook replay could pass the HMAC eventBinding check and matching buyer-claim check even if the persisted conversion document had separately changed campaign, referral, buyer, owner, proof status or reward status. The webhook payload authenticates an assertion from the provider, but does not authorize arbitrary persisted modifications.

The Firestore transaction now checks the event document's `campaignId`, `referralId`, pseudonymous `buyerRef` and `ownerRef` against expected values, and requires `proofStatus='partner_assertion_only'` and `rewardStatus='pending_verification'`. Conflicts fail closed with 409 `partner_event_inconsistent`, without writing or crediting rewards. The existing eventBinding and buyer-claim checks remain.

## Tests, backward compatibility and rollback
The Vitest mock tests intentionally tamper with each of the six protected event fields, expect failure, restore the record and verify that a genuine duplicate is acknowledged. **The new Vitest tests are not evidence of successful execution until run.** Run on pinned Node 22.23.3; follow with real Firebase Emulator transaction tests and provider HTTP signature tests.

This is a deliberately restrictive invariant for the **current pending-verification-only pipeline**. If a separately approved future reconciliation legitimately advances a conversion to verified/settled, a versioned status transition and replay policy must be specified and tested before deployment. Legacy records with missing fields are quarantined, never repaired automatically. Provider retries may receive 409. Any rollback that removes this check must be separately security-approved. Never infer real purchase from provider HMAC.

Full required security, performance, privacy, fraud, finance, retention and production signoffs are outstanding. No production changes, main merge, or paid CI run. P0 #55 / Go-live #8 remain open.
