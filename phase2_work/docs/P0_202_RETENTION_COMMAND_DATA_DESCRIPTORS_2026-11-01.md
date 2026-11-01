# P0 #202 — Safe runtime descriptors for typed retention CAS commands

**Date:** 2026-11-01. **Base:** stacked unmerged [Draft PR #279](https://github.com/Veselin-Takev/Klar-Dating/pull/279), exact code SHA `2dc5716610740d6196efbbee07b23d7f2a7ed0b3`. [CI #41334295241](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41334295241) completed **SUCCESS** across all steps; job log verifies **five** real native Firestore Emulator tests actually ran and passed.  
**Status:** P0 #202 **OPEN**; Klar **Production BLOCKED / NO-GO**. This component remains isolated from live routes, Cloud Scheduler and GCS.

## Source-backed finding

The unused prototype `executePurgeWorkCommand` rejected unknown *enumerable* command keys and took a copy before Firestore transaction retries. However, `Object.keys(command)` excluded symbol and non-enumerable keys; subsequent property reads such as `command.token` could invoke caller-defined getters and side effects **during input validation**. JavaScript's static TypeScript interface does not prevent malformed runtime objects from being passed by a future integration. This was a hardening gap in an inert source boundary, **not evidence of a production exploit**.

## Isolated mitigation

- `snapshotCommand` now accepts only ordinary/null-prototype, non-array objects and inspects **own property descriptors**, not caller property getters.
- It rejects inherited/prototype-rich objects, symbol keys, hidden/non-enumerable properties, accessor descriptors, unsupported fields and values that are not expected primitives. It also enforces required/optional per-command fields, opaque worker-token shape, bounded lease duration, positive safe integer epoch/retry, unsigned decimal object generation, and a documented quarantine reason. Input is returned as a **fresh plain data object** before the first asynchronous Firestore transaction.
- The trusted server-clock acquisition and write-ahead intent, token/epoch field fences and no-auto-retry policy from #279 remain untouched. Receipt observation and finalization are **not exposed** by this API.
- Offline tests confirm the getter is **never called** and no transaction begins for malicious accessors, hidden timestamps, symbol fields, inherited properties, malformed commands and invalid primitives, while normal/frozen/null-prototype data inputs work.
- An additional **sixth native Firestore Emulator** case verifies an accessor-bearing input is denied without invoking its getter, with the synthetic queue document remaining unchanged.
- Mandatory `check:purge-work-inert` and its mutation tests detect removal of descriptor-only inspection, symbol/hidden-field checking and getter rejection.

## Verification / release limitations

This code is an **inert prototype**, not an authorization boundary against malicious code executing within the same trusted Node.js process (for example, a hostile JavaScript Proxy can intercept reflective operations). A future production producer/consumer must authenticate and authorize its calls, use validated JSON/server-generated records, avoid ambient privileges and independently enforce tenant/UID/challenge/GCS generation, moderation decisions, legal holds, decision time and expiry. This source-only hardening does **not** prove distributed trusted clock synchronization, guarantee atomic Firestore/GCS deletion, provide authenticated 404/412 receipts or implement the >300 retention backlog. Real staging, live Cloud Scheduler/IAM/TTL inventory, AppSec/DPO/Legal/SRE/Release Owner signoffs, and final merged-SHA gates remain outstanding.

**Do not merge or deploy this prototype based only on a branch's green CI.** Exact-head native Emulator/full CI required; if CI fails, log cause and corrected SHA without inheriting parent PASS. P0 #202 remains OPEN; `productionApproved=false`.
