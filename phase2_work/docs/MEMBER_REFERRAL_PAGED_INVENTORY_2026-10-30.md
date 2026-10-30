# P0 #48 – Offline paginated member-referral inventory integrity (2026-10-30)

**Status:** isolated Draft candidate, deliberately unconnected. **PRODUCTION BLOCKED / NO-GO.**

## Parent verified evidence
Parent [Draft PR #220](https://github.com/Veselin-Takev/Klar-Dating/pull/220) exact HEAD `8091cd6811e2c9ab8713a8c771468dfa22ba4c6a` passed [Enterprise CI #41123682738](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41123682738), validate job `124296600259` completed/success. The original job log explicitly reports `tests/memberReferralMigrationInventory.spec.ts (7 tests)` PASS, `tests/rules.spec.ts (88 tests)` PASS and `202 passed (202)` test files. These are synthetic/local and emulator tests, **not** approval to read or migrate live accounts.

## Newly implemented offline-only page boundary
`src/server/memberReferralInventoryPages.ts` provides `summarizePagedMemberReferralInventory(pages, maxRecords, maxPages)`, accepting only **caller-supplied** synchronous or asynchronous page envelopes, with no Firebase SDK, filesystem, HTTP client, network call or background task.

Each page declares a monotonically increasing zero-based index, a stable opaque scope label, the input cursor, the next cursor, terminal flag and a bounded array of records. The validator:
- denies missing/out-of-order page indexes, inconsistent input cursor chains, reused next cursors and changes in the supplied scope;
- denies nonterminal empty pages, a terminal page with a continuation token, pages after terminal, missing terminal, oversized pages and resource-budget overflow;
- fails closed if the iterator throws or if the underlying aggregate inventory exceeds its row bound;
- streams validated rows through the parent count-only collision analyzer so duplicate owners **across page boundaries** remain visible;
- returns only aggregate counts and a `pagesRead` count. Cursor contents, source labels, UIDs and invitation codes are never included in the returned report.

The result still marks `coverage:'provided_stream_only'`, `pageChain:'validated_supplied_pages_only'` and `migrationAuthorized:false`. Even a perfect cursor chain supplied by a caller **cannot prove that the original Firestore query returned a complete, point-in-time snapshot**; that requires a separate authorized source-side evidence protocol and read consistency requirements. Do not call the supplied scope label a cryptographically verified snapshot.

## Tests and exact-head acceptance
`tests/memberReferralInventoryPages.spec.ts` includes ten focused Vitest cases covering positive aggregation across page boundaries, valid empty input, missing page, cursor gap, changed scope, replayed cursor, incomplete scan, invalid terminal, extra page, row/page limits, interrupted async iterator and never-approved migration. All use synthetic identities/codes.

**No exact-head CI PASS is claimed for the new code before it is executed.** Require TypeScript, seven original analyzer tests, all new page-integrity tests, the existing real Firestore emulator and Rules suites, Enterprise security gates, build/browser acceptance, with original source logs.

## Explicitly outstanding migration controls
The offline code processes ephemeral caller-provided records in memory; it does not enumerate or export customer Firestore records, create a cursor, checkpoint external state, produce a DPO approval, reconcile full collection counts, generate registry writes, qualify invitations, or deploy.

A future real-data inventory must require approved IAM/read scope and privacy controls; deterministic, stable ordering, consistent source watermark/snapshot semantics, trusted start/end evidence, read-page receipts, independently verifiable counts/digests, secure resume, storage retention and safe incident recovery. No raw code/UID should be shared in CI logs. A clean offline report is not a GO criterion.

Before any migration, review the proposed [atomic registry ADR](ADR_MEMBER_REFERRAL_ATOMIC_CODE_OWNERSHIP_2026-10-30.md), pending claim-time verification, Art. 17 interrupted recovery, Didit/age/consent authorization and legacy collision-handling policy with Product, DPO/Legal, Security, SRE and Release Owner.

**Governance:** no merge, main changes, manual Actions dispatch, real account reads, registry migration, route activation or deployment. PR #119/RC R2 frozen; issues #48/#8 and other P0 risks remain **BLOCKED / NO-GO**.

## Exact-head CI and privacy correction (2026-10-30)
- Initial [Draft PR #221](https://github.com/Veselin-Takev/Klar-Dating/pull/221) source `1aba8d29ca28143f1b100f87328c71b3d29e42e0`: [Enterprise CI #41124913035](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41124913035) **completed/success**, validate job `124300609787` successful. Original log explicitly reports `tests/memberReferralInventoryPages.spec.ts (11 tests)` PASS, `tests/memberReferralMigrationInventory.spec.ts (7 tests)` PASS, and **203/203 test files** PASS. This proof applies only to that initial head.
- Further source review exposed a **potential privacy leak** at the offline iterator exception boundary. The initial helper let arbitrary upstream `Error` messages escape, which could embed owner UIDs, referral codes or page cursors if an authorized future data source included them in its diagnostic text. No customer exposure or actual leaked production log is known; the concern is preventive.
- Corrective source commit `be14423133179e95af649cb82907caeb30fc6d69`: fresh fixed-code errors are used for known validation failures and any untrusted unexpected upstream exception becomes `member_referral_pages_source_failure`. Original exception/message/stack/cause are **not propagated**. Test commit `74e06385e453dd4d2bc8aff6f9d810233b8a778c` includes redaction tests for a synthetic private UID/code/cursor and a spoofed error prefix while retaining positive page-integrity cases.
- Corrected-head automatic [CI #41126197819](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41126197819) was **pending** when inspected. A PASS on the old commit must **not** be transferred to this changed code; require direct TypeScript, security, browser and new test log confirmation.
- Still no actual Firestore source snapshot, data inventory, registry backfill, claim-route activation, staging verification, merge or deployment. Privacy/Product/SRE approvals and full P0 #48 release criteria remain **NO-GO**.
