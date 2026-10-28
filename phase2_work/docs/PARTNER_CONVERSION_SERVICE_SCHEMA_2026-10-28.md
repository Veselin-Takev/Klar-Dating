# Partner conversion service strict validation — Issue #55
Date: 2026-10-28. Baseline `main`: `2808dc1cbb485f70b403681c108cea5a3361d950`. **Draft / Production NO-GO**.

## Verified gap
The HTTP route `POST /partner/webhook/:slug` already applies `PartnerConversionPayloadSchema.safeParse`, but the exported `recordPartnerConversion` service accepted the statically typed object without independently checking its runtime shape. Future internal callers, tests and refactors could bypass the route-level validation.

## Targeted correction
`recordPartnerConversion` now rejects input failing the existing strict Zod payload schema with `400 invalid_partner_event` **before** Firestore access or persistence. The schema rejects unexpected fields, bad event IDs, non-hex referral tokens, noncanonical event names and malformed buyer identifiers. Five negative regression fixtures prove failure before the database client is accessed; the positive/idempotency and pending-verification tests remain unchanged. This is defense in depth, not a new business process.

## Residual critical risk
A valid HMAC and valid schema only prove that a holder of the webhook secret asserted an event. The current service correctly stores `proofStatus: partner_assertion_only` and `rewardStatus: pending_verification` without incrementing qualified conversion counters. **This change does not establish independent buyer identity, payment capture, refund/chargeback finality or partner-contract evidence.** Those are separate P0 release requirements under #55. Require exact-HEAD CI, emulator/E2E, reviewed provider contracts, Security/DPO and Operations approvals before closing #55 or considering production GO. No merge/deploy performed.
