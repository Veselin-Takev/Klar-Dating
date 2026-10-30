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

## Independent source review checkpoint — 2026-10-30
- Parent [#221](https://github.com/Veselin-Takev/Klar-Dating/pull/221) at `74e06385e453dd4d2bc8aff6f9d810233b8a778c` passed [CI #41126197819](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41126197819), validate job `124305836454`: 12 page tests, 7 direct inventory tests, 203/203 test files. That CI does **not** cover this child fix.
- Current [Draft #222](https://github.com/Veselin-Takev/Klar-Dating/pull/222) source HEAD `d5a2f2d127049c54e35fb08c8aff33ddc491feeb`, automatic [CI #41127467161](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41127467161) was **in progress** when last inspected. No green verdict is yet asserted for this head.
- Source modifies only the pure direct aggregate scanner exception path, with fixed diagnostics. The entry point remains offline/unconnected; no customer inventory, registry migration or product release occurred.
