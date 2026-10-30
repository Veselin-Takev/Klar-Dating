# P0 #48: Runtime validation of offline inventory diagnostic codes

**2026-10-30 · ISOLATED FEATURE BRANCH · NOT REVIEWED / NOT CI-VERIFIED · PRODUCTION BLOCKED / NO-GO**

## Exact verified parent
[Draft PR #222](https://github.com/Veselin-Takev/Klar-Dating/pull/222), source commit `06fe8509cfda12eed1abc080efa17c9e17b2b8e2`, passed [Enterprise CI #41128352587](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41128352587), validate job `124312949643`: the original log confirms 13 paginated inventory tests, 10 direct inventory tests and 203/203 test files PASS. This PASS applies **only** to the parent; it does not verify the branch documented here.

## Narrow source-grounded finding
`MemberReferralInventoryValidationFailure` exported its TypeScript diagnostic-code union but accepted the `code` argument at runtime without validation. TypeScript types disappear at runtime. A JavaScript caller or an adapter using an unsafe cast could construct a validation error with a freeform UID or referral code in `Error.message`. The wrapper then re-created an internal validation failure using that code, potentially embedding a private value in the new error message/stack. This is a *potential* boundary issue in offline-only code, not evidence of a customer-data breach. It is distinct from the previously corrected ordinary upstream `Error` message spoofing.

## Candidate protection (no production activation)
- The exported diagnostic class now accepts only a runtime `ReadonlySet` of known fixed diagnostic tokens, otherwise replacing the value with `member_referral_inventory_source_failure`.
- The sanitized `code` is nonwritable and nonconfigurable, preventing changes to the code after construction or replacement by a getter. The stack/message is constructed using **only** the sanitized value, and the page and direct analyzers continue to rethrow new exceptions.
- The two offline Vitest files add synthetic cases for incorrect runtime casts, PII-bearing codes, non-leakage through the error stack, nonwritable property behavior, and page/direct rejection. Existing page continuity, legacy collision counts and incomplete-source safeguards remain unchanged.
- The source does not access Firebase, databases, files, network, real customer data, payment, age, Didit, or the running member-referral routes. No migration/registry backfill or reward can be triggered.

## CI/resource governance and mandatory acceptance
This feature branch is **intentionally not an open PR**, avoiding an automatic pull-request workflow while prior GitHub Actions consumption and remaining authorized CI minutes are not independently established. No new CI PASS is claimed. The next permitted verification must use the branch's exact immutable SHA, run the local `demo-klar` emulator/Rules, TypeScript, static Security/Privacy/Art.-17 gates, all direct/page tests, build/browser acceptance, and then be independently reviewed. If Actions budget has reached the agreed cap, obtain explicit additional authorization before opening a PR that triggers CI.

This source-only hardening does **not** advance approved real-data inventory, full source scan completeness, unique-only migration, claim-time registry enforcement, interrupted Art.-17 deletion recovery, live Firestore TTL, photo-retention, Didit, consent, anti-fraud, or KYC authorization. These are independent release blockers requiring Product, DPO/Legal, Security, Operations/SRE and Release Owner signoff.

**No direct `main` commit, PR #119/RC R2 edit, merge, deploy, manual Actions dispatch, secrets rotation or production account access. PRODUCTION BLOCKED / NO-GO.**
