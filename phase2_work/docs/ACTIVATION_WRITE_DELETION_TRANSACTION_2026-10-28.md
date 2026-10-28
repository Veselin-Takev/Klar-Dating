# Issue #8: Atomic activation-write deletion guard (2026-10-28)

**Draft — Production NO-GO.** Source: `main` `2808dc1cbb485f70b403681c108cea5a3361d950`.

## Finding

`recordActivation()` in `src/server/platform/launchPlatform.ts` used `activation_events.doc(eventId).create(...)` without checking `account_deletions/{uid}`. The separate activation **read** boundary in Draft PR #180 cannot protect this **write** path. A pending account deletion could therefore be followed by another activation document write.

## Correction

A Firestore transaction now reads `account_deletions/{uid}` and stages `tx.create(activation_events/{eventId}, ...)` in the same transaction. It throws if deletion has begun. The transaction also keeps the previous create-only event identifier semantics: duplicate event IDs remain conflict errors. The existing event-name allowlist and metadata sanitizer are unchanged. Tests assert no writes when deletion is pending, correct ordering for a permitted event, and a mocked conflict-retry denial.

## Verification and limitations

The mock suite is **not** a Firestore emulator concurrency or full cascading-delete test. The account-deletion initiation must atomically write the same marker, and any code path that directly writes `activation_events` without using this function must be audited independently. Existing call sites and test doubles are to be validated by exact-head Enterprise CI. No production storage, cloud, release approval, or main branch was altered. Independent Security/DPO and operations signoff and actual emulator/ staging evidence are still mandatory; **NO-GO**.

## 2026-10-28 — Fail-closed and duplicate-ID regression extension

Exact-head Enterprise CI `40714411059` succeeded on `b95ec5a527ff3f2108be37563ae83ed1ddc737ee`. Two further mock-transaction regression tests now assert (1) Firestore errors when reading the account deletion marker cannot result in an event creation, and (2) an already-existing event ID remains a create-only conflict instead of an overwrite or success. This is a **test-only** amendment: production logic remains unchanged. A new exact-HEAD CI result is required before accepting this additional evidence; actual Firebase emulator concurrency, cross-instance behavior, complete Art.17 cascade, Legal/Privacy/Security/SRE approvals remain unverified. **PRODUCTION NO-GO**.
