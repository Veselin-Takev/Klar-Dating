# CI incident: transactional account deletion accounting timeout — 2026-10-14

## Reproduced evidence
CI run [38477319573](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/38477319573) on documentation PR #37 failed in `tests/deletionAccounting.spec.ts`, case `counts existing documents once across overlapping transactions and replay`. The failure was the default Vitest **5,000 ms test timeout**, not a reported assertion mismatch. The same run reported 177 passing test suites and one failed test. Logs alone cannot prove the transaction is correct or that latency is acceptable.

## Narrow mitigation
Allow a **20,000 ms upper bound for this single test**. The test still performs two concurrent Firestore accounting operations, replay, and all the original document/counter assertions. No changes to production account deletion, authorization, transactions, data retention, or the global Vitest timeout.

## Follow-up gates
Run the targeted emulator-backed test and the full CI suite on this PR head. If retries still exceed 20 seconds, diagnose Firestore emulator contention, transaction retries and setup/cleanup overhead rather than raising the timeout repeatedly. Collect latency samples and verify each transaction remains atomic. Review production deletion processing latency and user-visible SLOs separately. Do not treat this as a functional fix until the exact-head regression passes.

`main` at incident analysis was `64218ef245b2b70b74ad19c2f77046fbf6969a52`. The run on documentation PR #37 is not evidence for that exact SHA. Production Issue #8 remains **NO-GO** pending main validation, operational evidence and explicit approval. No manual CI dispatch or local Codespace mutations.
