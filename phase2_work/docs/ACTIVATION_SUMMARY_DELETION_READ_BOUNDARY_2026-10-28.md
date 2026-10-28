# Activation summary read boundary — Art.17 marker (2026-10-28)

**Status: DRAFT / PRODUCTION NO-GO**. Baseline `main` SHA `2808dc1cbb485f70b403681c108cea5a3361d950`.

## Finding

`GET /api/activation/summary` returned the authenticated account's recorded activation history without checking `account_deletions/{uid}`. Once an account deletion begins, this readback can be inconsistent with the privacy lifecycle. This endpoint is independently authenticated and rate-limited, so the fix adds a focused server-side deletion check instead of changing the whole activation subsystem.

## Fix, regression evidence and limitations

The handler reads the account-deletion marker before querying `activation_events`, returns HTTP 409 when deletion is pending and avoids querying historical activation data. If the deletion status cannot be loaded it fails closed with the existing generic HTTP 503 error. Two new HTTP regression tests verify pending deletion and Firestore read failures; the existing success test now explicitly models an absent deletion marker.

**Concurrency limitation:** the marker read and event query are not a single transactional snapshot. This is a defense-in-depth read guard and does not independently prove full Art.17 cascade integrity or close an intervening deletion race. Authoritative deletion controls and emulator/staging race evidence remain mandatory. No client-side activity, reward logic, cloud settings, or retention timeline changed. Require exact-HEAD CI, Security/DPO approvals and no production deployment until formally authorized. Rollback by reverting this isolated PR. **NO-GO**.

## 2026-10-28 — Transactional snapshot hardening

Follow-up on the exact previous HEAD `4491eedb9806a33765d76e91a9d9e4635d033e5e` (Enterprise CI run `40709454659`: SUCCESS). Both the `account_deletions/{uid}` marker and the bounded (100) `activation_events` query are now read via `db.runTransaction(tx => tx.get(...))` rather than two independent Firestore reads. On a Firestore transaction conflict the SDK retries; if the marker exists on the successful transaction attempt, no activation data is disclosed. The query is still UID-scoped, capped, and protected by its separate rate limiter. Tests now mock transactional reads including the rate limiter, absence/presence/errors, and a simulated marker-write retry (a mock, **not** a Firebase emulator concurrency proof). No evidence of verified live Firestore serialization or production snapshot behavior is claimed. A new exact-HEAD CI success, Firebase emulator race test, and independent DPO/Security review remain required. **PRODUCTION NO-GO.**

## Response privacy headers and current verification — 2026-10-28

The exact-head Enterprise CI run `40710916419` passed for commit `dd863d9977830b763b844d9254c32aca7cfb826d`. This follow-up sets `Cache-Control: no-store, private`, `Pragma: no-cache` and `Referrer-Policy: no-referrer` before the activation-summary limiter and handler, covering 200, 401, 409, 503, and middleware errors. The HTTP regression suite now asserts these headers on authenticated success, no-session, deletion-pending and Firestore-error cases. These headers prevent compliant browser/shared caches from reusing account activity responses; they do not replace server-side authorization, CDN controls or Art.17 deletion verification. A **fresh exact-HEAD CI** is required for this amendment; no formal production approval was granted. **NO-GO**.
