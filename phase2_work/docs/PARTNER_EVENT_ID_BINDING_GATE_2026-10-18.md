# P0 #55 — Authenticated partner event-ID payload binding (2026-10-18)

**Status: DRAFT / NO-GO.** The webhook route already authenticates a timestamped provider signature; this patch restricts one persisted event ID to its original event assertion.

## Change and threat
Previously `recordPartnerConversion` returned `duplicate: true` solely because a conversion document with the event ID existed. A provider retry with the same event ID but a different buyer or referral could receive duplicate success. No earned rewards were created from either case, but the ambiguity hid conflicting assertions.

The service now stores `eventBinding` as a domain-separated HMAC-SHA256 over slug, event ID, referral token, and buyer UID using the **stable audit secret**, not a rotating provider webhook secret. This binds idempotency across signing-key rotation without exposing identifiers in the event document. Exact replays remain idempotent. Mismatched or legacy events lacking a binding return HTTP 409 `partner_event_id_conflict`; older events must be reconciled by authorized operators, not silently re-associated. The existing `pending_verification` and `partner_assertion_only` states and zero-credit rule remain unchanged.

## Validation / non-goals
Run `npx vitest run tests/partnerReferralService.spec.ts` from `phase2_work` on the exact head, and all mandatory gates on the consolidated candidate. Added assertions cover normal duplicate and changed buyer UID. Static inspections, if any, do not replace emulator transaction conflict tests. Still required: separate trusted purchase/buyer proof, refund/chargeback flow, consent revocation race, stale signature, rotating signing key, 10x duplicate and parallel claims, and independent Security/Finance/Privacy approval.

## Rollout and rollback
There is no Firestore schema migration needed for new events: `eventBinding` is newly populated. **Existing** event documents without `eventBinding` will no longer return an idempotent success; partner retry/operations owners must approve this backward-compatibility behavior and reconcile known old claims. Never backfill from unverified partner data. For rollback revert the service and test commit only after analyzing affected event IDs; restoring old behavior weakens conflict detection. No production or cloud changes were executed. P0 #55 and Go-Live #8 remain open.
