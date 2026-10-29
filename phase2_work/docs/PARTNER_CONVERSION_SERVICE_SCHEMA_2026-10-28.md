# Partner conversion service strict validation — Issue #55
Date: 2026-10-28. Baseline `main`: `2808dc1cbb485f70b403681c108cea5a3361d950`. **Draft / Production NO-GO**.

## Verified gap
The HTTP route `POST /partner/webhook/:slug` already applies `PartnerConversionPayloadSchema.safeParse`, but the exported `recordPartnerConversion` service accepted the statically typed object without independently checking its runtime shape. Future internal callers, tests and refactors could bypass the route-level validation.

## Targeted correction
`recordPartnerConversion` now rejects input failing the existing strict Zod payload schema with `400 invalid_partner_event` **before** Firestore access or persistence. The schema rejects unexpected fields, bad event IDs, non-hex referral tokens, noncanonical event names and malformed buyer identifiers. Five negative regression fixtures prove failure before the database client is accessed; the positive/idempotency and pending-verification tests remain unchanged. This is defense in depth, not a new business process.

## Residual critical risk
A valid HMAC and valid schema only prove that a holder of the webhook secret asserted an event. The current service correctly stores `proofStatus: partner_assertion_only` and `rewardStatus: pending_verification` without incrementing qualified conversion counters. **This change does not establish independent buyer identity, payment capture, refund/chargeback finality or partner-contract evidence.** Those are separate P0 release requirements under #55. Require exact-HEAD CI, emulator/E2E, reviewed provider contracts, Security/DPO and Operations approvals before closing #55 or considering production GO. No merge/deploy performed.

## Direct service caller slug boundary — 2026-10-28

The first exact-HEAD CI run on `33c48b2eb0239d6e30eaa99ad80d573b4fdb3190` was SUCCESS (run `40777056211`). Review found that the HTTP route validated campaign slugs, but the exported conversion service did not. Added the same canonical slug regex to `recordPartnerConversion` before any Firestore access or event-ID HMAC derivation. Nine negative fixtures verify that malformed, path-like, uppercase, leading/trailing-hyphen or overlength slugs are rejected at the service boundary. A passing service guard still does not independently prove a purchase, chargeback finality or buyer ownership. New exact-HEAD CI and external evidence remain required; **NO-GO**.

## Campaign slug binding consistency (2026-10-29)

Reviewed the current #55 conversion trust boundary after exact-head CI `40778473151` passed for `713cddfe090e861cd6b5136ba6c4cc211d1e1121`. A referral can carry its own `campaignSlug`, but previously the conversion service did not compare that stored value with the signed webhook's slug. New preflight and transactional consistency checks reject a populated, inconsistent referral slug before event or claim creation. The regression mutates `campaignSlug` to a different campaign and expects `partner_campaign_binding_conflict`; restoring the original record preserves the existing positive assertion-only path. **Legacy referral records without a slug remain tolerated for backward compatibility and must be inventoried/migrated before strong binding can be claimed.** This does not prove real purchase identity or permit rewards. Verify new CI on exact HEAD; production remains NO-GO pending external proof and approvals.
