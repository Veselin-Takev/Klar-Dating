# Launch founding membership — account-deletion transaction guard (2026-10-28)

**Status: Draft / Production NO-GO.** Source baseline: main `2808dc1cbb485f70b403681c108cea5a3361d950`.

## Finding

`POST /api/launch/founding-claim` previously read the user and cohort state, but did not read the corresponding `account_deletions/{uid}` marker. A deletion-pending account could still claim a founding rank or receive an `already: true` response and generate a new activation event. This conflicts with fail-closed account deletion and governance issue #8, and touches the launch/referral product trust boundary (#48).

## Fix

Read user, deletion marker, and founding cohort in a single Firestore transaction using `tx.getAll`. If the deletion marker exists, return HTTP 409 with `reason: account_deleting` before any cohort write, membership write, or activation event; this also prevents stale membership disclosure. Accounts with no deletion marker retain their previous success semantics. Do not delete existing founding memberships here; GDPR cascade ownership remains with the account-deletion worker.

## Evidence and open checks

`tests/launchEndpoint.spec.ts` adds negative cases for pending deletion on new and existing memberships and a positive eligible-account case, asserting zero cohort writes and activation on denial. These mocked transaction tests are **not** a substitute for Firebase emulator races, server-side Art.17 cascade validation, or live staging evidence. Require exact-HEAD enterprise CI, emulator, Security/DPO approval, and retention review. No cloud, production, or TTL mutation. Rollback: revert this isolated PR. **NO-GO.**

## Exact-head CI failure triage — 2026-10-28

Enterprise CI run `40699098974` on `65c9521f6b38a22c6d63ef89c5a6e104678d51f6` failed three new founding HTTP tests (expected 409/200, received 503). Root cause: test-only Firestore mock lacked `tx.get()`, which is required by the UID-scoped distributed rate limiter upstream of the route. The production limiter correctly denied access when its store could not be read. Updated mock transaction implements `get()` and restricts write assertions to the `users/` and `system/` business documents, excluding permitted rate-limit accounting; the route's deletion guard was not bypassed or weakened. This correction must have a new exact-HEAD CI PASS before merging. **NO-GO**.
