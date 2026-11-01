# P0 #202 — Server-owned clock and immutable transaction-command snapshot

**Date:** 2026-11-01. **Source branch:** `security/p0-202-server-clock-retention-commands-20261101`  
**Parent:** unmerged [Draft PR #278](https://github.com/Veselin-Takev/Klar-Dating/pull/278), exact SHA `bcaede0ea892f6a7ce5b42371bdad9f2d9ae0774`; [full CI #41332732631](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41332732631) SUCCESS, including **four actually executed native Firestore Emulator tests**.  
**Decision:** **P0 #202 OPEN / Production BLOCKED-NO-GO.** All changes remain confined to an unused, no-GCS adapter.

## Finding

The typed `executePurgeWorkCommand` API in #278 eliminated arbitrary transaction callbacks but retained `now` as a **caller-supplied field** of claim, release, delete-intent and quarantine commands. An erroneous or attacker-influenced future adapter caller could falsely expire another worker's lease, prematurely release an ineligible job or misstate the preparation time of a GCS delete intent. The runtime field allowlist accepted these timestamps.

In addition, command properties were read by the retriable Firestore transaction callback from the original mutable command object. JavaScript objects can be modified by a caller after a transaction begins; without a captured value snapshot, a retried callback may see different tokens, generation or duration than the command initially inspected.

## Narrow, inert remediation

- Remove `now` from all four supported typed command variants and runtime field allowlists. Any `now` key, including a forged far-future timestamp, is rejected with `purge_work_unsupported_command` **before Firestore IO**.
- Capture `Date.now()` **once in the server-side dispatcher before invoking `runTransaction`**. Its finite, safe positive integer value is checked. The same instant is passed to every pure state transition even if Firestore retries the callback. This is not a claim of cross-host clock synchronization.
- Snapshot only the approved primitive command fields into a fresh plain object before the transaction begins. Reject non-plain objects and unsupported properties; transaction retries therefore execute with the same command data, not a caller-mutable reference.
- Unit tests use controlled local `Date.now` to assert rejection of spoofed timestamps, consistent lease times during replay and fail-closed invalid clock behavior. Native `demo-klar` Firestore Emulator tests exercise typed claims, post-commit delete intent, forgery denial and server timestamp spoof denial. No live/cloud GCS API is invoked.
- Mandatory `check:purge-work-inert` now additionally checks for the server-owned clock and command snapshot. Mutation tests prevent replacing the time with caller input or bypassing the snapshot.

## Critical remaining evidence and limitations

1. **No trusted global time guarantee:** `Date.now()` is the local process clock. An incorrectly configured, skewed or compromised worker still creates unsafe lease decisions. A production implementation requires a documented clock-skew bound, monitoring, emulator/staging fault-injection with clock drift, a trusted time strategy, explicit timeout/fencing behavior and SRE approval.
2. **Authorization is still missing:** The unused adapter does not authenticate its caller, bind source tenant/UID/challenge/object generation/hold decisions, or verify eligible retention records. These must be independently enforced before a real queue producer/worker may call any pre-delete command.
3. **No physical-delete/receipt proof:** It does not connect to Cloud Storage, Scheduler or an append-only audited receipt. GCS 404/412, legal holds and crash-before-receipt ambiguity remain blocked. `delete_intent` expiry never permits automatic re-delete.
4. **No complete retention implementation:** More than 300 due events still trigger the current fail-closed interim limit. A durable eligible-index/lease/claim producer, non-starving worker, legacy missing-field backfill, tenant migration, provenance and live system inventory remain unverified.
5. **No external approvers:** Native Firestore Emulator source tests and exact-head CI do not replace independent AppSec/DPO/Legal/SRE/Release Owner acceptance, genuine staging GCS preconditions, final merged-SHA checks or signed production approval.

No direct main commit, merge, deployment, production Firestore/GCS query or mutation was performed. **Keep `RELEASE_MANIFEST.json` `productionApproved=false` and the release decision NO-GO.**

## 2026-11-01 — CI traceability follow-up

Initial head `41bebee582f21082661622337299088a26a75d07` [CI #41333883487](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41333883487) **FAILED** in `Enterprise static gates`, because the mandatory source guard still expected the old `executePureCommand(current, command)` form. The new dispatcher correctly uses `executePureCommand(current, preparedCommand, now)`; the source guard was corrected (not bypassed) in SHA `e3358e064c611836276645f297400436df74f846`. Its fresh [CI #41334015267](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41334015267) was not complete at this entry. Do not count the failed earlier SHA or inherited green parent CI as evidence for this new head. Production NO-GO.
