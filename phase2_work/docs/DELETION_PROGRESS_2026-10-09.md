> Historischer Nachweis des Quellbranches `31363ebeb4251d788f877c008c12c5f7d7583e83`. Die hier genannten Testläufe gelten nicht als Validierung des am 10.10.2026 konsolidierten Korrekturbranches; siehe `DELETION_CONSOLIDATION_2026-10-10.md`.

# DB-01 follow-up: confirmed progress within a deletion time slice

Date: 2026-10-09. Base: merged PR #6, `aa56cfcbcd2b8327ddd7a716d45dba7dd7fc3111`.

## Failure and correction

The previous worker preserved its failure budget for complete 25-chat pages but treated a 45-second time-slice expiry inside a large collection as a real failure. Repeated successful batches could therefore still exhaust the 50-failure ceiling.

The new invocation-local budget records progress only after an acknowledged deletion batch, deletion of an existing chat, or acknowledged pseudonymization batch. At the next cooperative deadline check, confirmed progress raises a distinct typed continuation signal. The worker restores only the attempt consumed by that acquisition and increments `completedSlices`, not `completedPages`. Existing genuine failures remain counted. An expiry without acknowledged progress and any actual database/provider exception remain failures. Account deletion does not proceed to authentication removal on a partial slice.

Async-local state isolates simultaneous accounts. The remaining Firestore documents form the restart checkpoint; no arbitrary cursor can skip undeleted children. Chat documents remain until their messages, archives and gate answers have been removed. The budget is cooperative between operations, not a cancellation deadline for an in-flight SDK call. Storage/recursive-delete/provider behavior needs its own bounds and evidence.

## Local evidence

- Four focused budget tests failed before implementation and passed afterward: no-progress expiry, progress expiry, real database failure preservation and concurrent-context isolation.
- Firestore/Auth/Storage emulator run: **3 files, 17 tests PASS**, including 51 worker continuations without consuming prior failures, lease safety and the account-erasure tests. Both Vitest and the emulator orchestrator exited 0.
- A real 51-chat fixture completes both full pages and the final partial page, checks all message/archive/gate-answer subcollections, preserves an unrelated chat and repeats the purge without changing the deterministic receipt.
- The 51 worker continuations inject the progress signal; they are not evidence of 1,275 real chats or measured 45-second production behavior.
- Enterprise static gates PASS. All three TypeScript projects PASS.
- No remote validation run has been triggered for this candidate.

## Follow-up candidate

[Cumulative accounting](DELETION_ACCOUNTING_2026-10-09.md) now coordinates counted mutations with durable job totals and publishes receipts only at final-sweep completion. This supersedes the counter limitation below for new version-2 jobs; legacy migration and deployment validation remain open.

## Historical acceptance gaps at the slice-only candidate

DB-01 is **not fully closed**. Receipt counters still summarize the terminal invocation instead of all previous pages/slices. Do not present them as cumulative account totals. Correcting this requires durable, idempotent counter updates coordinated with destructive commits and defined final-sweep semantics; incrementing counters separately after a delete would lose or duplicate counts on failures.

Production storage retention execution, complete provider deletion evidence, restore-drill results, load/cost measurements and independent approvals are not proven by these tests. No production data or credentials were accessed. Production remains **NO-GO / NOT CONFIRMED**.
