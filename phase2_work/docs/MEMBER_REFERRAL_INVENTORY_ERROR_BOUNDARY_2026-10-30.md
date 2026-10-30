# P0 #48 — Direct offline inventory source-error privacy hardening (2026-10-30)

**Status: isolated Draft candidate. No cloud data, migration or production activation. PRODUCTION BLOCKED / NO-GO.**

## Confirmed source boundary
The offline aggregate inventory function `summarizeMemberReferralInventory` (introduced in [Draft #220](https://github.com/Veselin-Takev/Klar-Dating/pull/220)) accepts arbitrary synchronous or asynchronous iterables. Its original `for await` loop propagated source iterator exceptions unchanged; a future authorized export adapter could accidentally include UIDs, invitation codes or cursors in the thrown error's message, stack or cause. Record property getters could do the same. This is a preventive privacy/source-hardening finding, **not evidence of a production data leak or live inventory being processed**.

The child [Draft #221](https://github.com/Veselin-Takev/Klar-Dating/pull/221) introduced a fixed-error boundary for **paged calls** only. Direct callers of the underlying aggregate analyzer still needed an independent guard.

## Precise fix
`src/server/memberReferralMigrationInventory.ts` wraps its bounded `for await` classification in a fail-closed exception boundary:
- Caller-supplied exceptions, malformed thrown objects and exploding record getters are transformed into **new** `Error('member_referral_inventory_source_failure')` objects, without the original message, stack, cause or data.
- Its own resource-limit diagnostic remains the fixed string `member_referral_inventory_limit_exceeded`; the original exception object is **never** propagated, including for a spoofed upstream matching message.
- The invalid configured limit still returns its fixed `member_referral_inventory_invalid_limit` error.
- No returned record identifiers, codes or cursors; the unchanged aggregate result still has `coverage:'provided_stream_only'` and `migrationAuthorized:false`. No source attestation or complete scan is inferred.

## Verification
`tests/memberReferralMigrationInventory.spec.ts` includes a synthetic throw containing a private UID/code in the message, a non-Error thrown object, a getter throwing an identifier-bearing message, stable fixed resource-limit errors, and the existing positive collision/absence and incomplete-source cases. Assertions check the error message, stack, lack of cause and no false success.

**This head's CI is not confirmed PASS at authorship.** Require exact-head TypeScript/Enterprise static gates, new Vitest cases, the parent's page-integrity negative tests, active `demo-klar` Firestore emulator and Rules evidence, build and browser acceptance. Do not inherit the predecessor's green CI automatically.

## Governance and next gates
All work remains disconnected from live Referrals and cloud inventory. Parent #219's atomic reservation is not activated; #220/#221 are offline prototypes. A credible real-data inventory requires DPO/Security-approved least-privilege source access, true scan completeness evidence, privacy-safe reporting thresholds and retention, plus transactional backfill/migration, Art.17 interrupted-retry tests, explicit claim-time ownership, Didit/age/consent and independently signed Product/SRE/Release decisions. No `main` commit, manual Actions dispatch, merge, deployment or actual customer data access. Frozen PR #119 and RC R2 remain unchanged. **P0 #48 OPEN; PRODUCTION NO-GO.**

## Exact-head CI failure and verified corrective design — 2026-10-30

- Initial [Draft #222](https://github.com/Veselin-Takev/Klar-Dating/pull/222) SHA `d5a2f2d127049c54e35fb08c8aff33ddc491feeb`: [CI #41127467161](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41127467161) **completed / failure**, job `124309598250` failed in **Tests**, not Typecheck. The original job log reports **four** failed assertions in `memberReferralInventoryPages.spec.ts`: the direct inventory's new outer catch converted legitimate page validation errors (`member_referral_pages_incomplete`, `member_referral_pages_invalid_continuation`, `member_referral_pages_overflow`) into `member_referral_pages_source_failure`. There were 202 passing test files, 1 failed test file; 1471 passing tests, 4 failing tests. Do not represent this initial head as passing.
- Root cause: error trust was determined at the wrong layer. The direct scanner's catch cannot distinguish its own validation failures from genuine errors emitted by the caller-supplied iterator when using only `Error.message`.
- Corrective code in **current child Draft head** `06fe8509cfda12eed1abc080efa17c9e17b2b8e2` introduces a typed `MemberReferralInventoryValidationFailure` with a finite, trusted diagnostic-code union. Page validation and the direct scanner's internal resource limits throw this specialized error. Generic source errors—including plain `Error` objects whose messages spoof an internal code—are converted to fixed `...source_failure` diagnostics; only branded internal validation faults retain specific codes. New tests check deliberate message-spoofing in direct and paginated ingestion.
- This repaired code retains no message, cause or source stack from unexpected upstream exceptions, preserving the previous privacy requirement while restoring the user-facing fixed validation semantics.
- Corrected-head automatic [CI #41128352587](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41128352587) was **pending** at the checkpoint. No PASS for this revised head is asserted until original tests and typecheck/enterprise/browser job status are verified.
- The entire path remains local/offline, unconnected to deployed member referrals and ineligible to authorize a migration. No personal live data processed; no registry backfill, deployment or production change. **P0 #48; PRODUCTION BLOCKED / NO-GO**.
