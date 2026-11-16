# Klar — Iteration 2 remediation and PR validation register

**Audit date:** 2026-11-16  
**Baseline:** main at 2fa3ba223989ff248ad1abaea67f4f454f7c9f6b  
**Decision:** NO-GO; productionApproved=false  
**Scope:** Source-level PR review, SHA-bound CI evidence and remediation coordination. This register does not certify live cloud state or legal compliance.

## Executive status

Iteration 2 found substantial pre-existing remediation work in stacked Draft PRs. Reuse these as dependency chains; do not create duplicate patches. No source fix from these branches is present in the audited main SHA above.

| Workstream | PR / exact head | CI evidence | Assessment |
|---|---|---|---|
| Verification-photo production hard stop | [#348](https://github.com/Veselin-Takev/Klar-Dating/pull/348), a7b6e574086d02fd9ea28868b061c7072ed84f5c | [#42424069834 SUCCESS](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42424069834) | Scheduler-route interlock only; all-writer race remains |
| Account-erasure photo hard stop | [#349](https://github.com/Veselin-Takev/Klar-Dating/pull/349), ca97df699cc9b0bdca59add95cfe452293d7c141 | [#42457025368 SUCCESS](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42457025368) | Production defaults to profile-only; Art.17 completion needs DPO-approved handling |
| Firestore record-level hold guard | [#350](https://github.com/Veselin-Takev/Klar-Dating/pull/350), e89ba9c11791450eb402e8fddb7eb9e1b1fd4527 | [#42455298758 SUCCESS](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42455298758) | Rejects active/malformed holds at checked transaction points; late-hold race remains |
| Account-erasure GCS metadata validation | [#352](https://github.com/Veselin-Takev/Klar-Dating/pull/352), 90de150d1ee49a5a762c874b127a5ad286bae5e7 | [#42457805880 SUCCESS](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42457805880) | Metadata/generation validation only; not an all-writer fence |
| Combined photo deletion review candidate | [#353](https://github.com/Veselin-Takev/Klar-Dating/pull/353), c653efd6984f573ab0443bdd3723ca37f63fa320 | [#42460900607 SUCCESS](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42460900607) | Draft candidate; explicitly retains production hard stops and unresolved late-hold race |
| Firebase project/Admin identity | [#343](https://github.com/Veselin-Takev/Klar-Dating/pull/343), 601c316c4b875242989f488473bba61b4c22322c | [#42413071403 SUCCESS](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42413071403) | Parent change passed; child integration still required |
| Existing Admin app + Storage bucket isolation | [#344](https://github.com/Veselin-Takev/Klar-Dating/pull/344), 6e3a10a7dee58f3b55d9e2bc52986d686e189844 | [#42414827630 SUCCESS](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42414827630) | Exact-head CI passed; actual bucket/IAM provenance remains open |
| RC1 tenant-isolation consolidation | [#358](https://github.com/Veselin-Takev/Klar-Dating/pull/358), 1321c42ffe1c5919c1baccaada66a650ab811f93 | [#42710380877 FAILURE](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710380877) | Not certified at current head; Browser acceptance fails in consent-withdrawal UI |

A green CI run on one stacked branch does not validate another branch or a later combined SHA. Evidence above is per exact commit only. No PR is merged by this register.

## P0 — Verification-photo deletion is not safely fenced across Firestore and GCS

- The legacy scheduled upload-age deletion path is tracked by [Issue #202](https://github.com/Veselin-Takev/Klar-Dating/issues/202).
- PR #348 disables the unfenced production scheduled route with HTTP 503 before Firestore/Storage access.
- PR #349 separately prevents account erasure from using the legacy verification-photo delete path in normal production mode.
- PR #353 adds strict Firestore/GCS hold and generation validation, and requires a pre-delete authorizer.
- **Unresolved:** a Firestore legal hold or moderation revocation can still race after the final Firestore authorization and before the GCS delete. A GCS generation precondition does not fence Firestore state. External Admin SDK, console and bucket writers also need inventory and control.
- **Required:** independently reviewed monotonic all-writer deletion fence/state machine; late-hold adversarial test proving zero unauthorized deletes; approved DSAR/Art.17 pending/exception semantics; DPO, AppSec, SRE and Release Owner review; safe staging evidence.

Until then, keep the scheduled purge disabled and preserve production hard stops. Do not interpret a 503 or deferred verification-photo deletion as completed erasure.

## P0 — Tenant isolation / migration

- [Issue #254](https://github.com/Veselin-Takev/Klar-Dating/issues/254) remains the live-cutover blocker.
- PR #358 reports 50/50 registered candidate migrations and 1,636 test passes in its description, but the current exact-head CI run failed in Browser acceptance. Those reported counts are not a green exact-head pipeline.
- No production migration, default-tenant assignment, write-fencing, or root-data cutover is authorized by this audit.
- Required: complete direct-client/Admin SDK inventory, authoritative legacy-to-tenant mapping, ambiguous-record quarantine, read-only dry-run with count/hash/referential-integrity evidence, negative cross-tenant and same-tenant BOLA tests, Art.17 cascade and TTL/index evidence, independent staging review.

## P0 — TTL / retention

- [Issue #70](https://github.com/Veselin-Takev/Klar-Dating/issues/70) remains open.
- A passing validator or source script is not proof that Cloud Firestore TTL policies are active in the intended project.
- Required: exact collection-group inventory, approved TTL policy export from the correct project, active-state evidence, retention and deletion reconciliation.

## P1 — Firebase Admin / Storage identity

- PRs #343 and #344 contain fail-closed project identity and bucket selection changes, with successful exact-head CI on their respective commits.
- These are not integrated into the current main commit and are not yet one combined SHA with PR #353.
- Explicit bucket configuration is not proof of bucket ownership. Actual project ownership, IAM, retention/hold configuration and runtime service identity remain unverified.
- Do not infer or create a bucket from a project ID.

## P1 — Consent withdrawal UI regression on RC1

- [Issue #364](https://github.com/Veselin-Takev/Klar-Dating/issues/364) tracks the exact failure on PR #358.
- The consent endpoint returned HTTP 200, but the UI showed “Die Änderung konnte nicht bestätigt werden. Bitte erneut versuchen.” instead of the successful withdrawal receipt.
- Source trace: ConsentSettings.tsx requires a non-empty evidence ID and an authoritative profile readback matching that evidence and purpose value. AuthContext.fetchProfile() reads tenants/default/users/{uid} and may enrich from /api/account/status.
- Do not weaken fail-closed consent readback. Capture response body and authoritative readback, identify namespace/serialization mismatch, fix it, then rerun exact-head Playwright and Enterprise CI.

## P1 — Release evidence consistency

- [Issue #362](https://github.com/Veselin-Takev/Klar-Dating/issues/362) tracks the stale/misaligned release manifests and status document.
- Preserve historical records; create a single SHA-bound release evidence register for each current candidate.

## PR simulation / review packets

1. **PR-A — Verification-photo safety interlock and all-writer fencing**
   - Reuse: #348 → #349 → #350 → #352 → #353.
   - Risk: Critical / P0.
   - Areas: complianceStorage.ts, trustAndSafety.ts, functions/src/retention.ts, tests and retention docs.
   - Status: defensive interlocks exist in Draft branches; full fence not implemented/proven. No merge.

2. **PR-B — Firebase project and Storage identity isolation**
   - Reuse: #343 → #344, then integrate with PR-A only after conflict review.
   - Risk: High / P1 (P0 if cross-project data access is possible in deployed runtime).
   - Areas: firebaseRuntime.ts, db.ts, storage.ts and boundary tests.
   - Status: individual exact-head CI passed; combined final SHA not verified. No merge.

3. **PR-C — Tenant isolation and RC1 cutover**
   - Reuse: #358 and its dependency chain.
   - Risk: Critical / P0.
   - Status: exact-head CI failed in Browser acceptance; consent-withdrawal issue #364 opened. No merge.

4. **PR-D — Release evidence reconciliation**
   - This document is the review register for iteration 2; follow-up reconciliation tracked by #362.
   - Risk: High / P1.
   - Status: documentation-only draft on a feature branch; exact CI and review pending.

## Validation protocol

For every eventual integrated PR:
- Pin the exact base and head SHA.
- Run full Enterprise CI on the final combined SHA, including TypeScript, lint, security/static gates, unit/integration, Firestore/Storage Emulator negative cases, production build/smoke and Playwright.
- Inspect failing job logs; do not retry unchanged failing code as a substitute for a fix.
- Obtain independent Security, DPO/Legal, SRE and Release Owner approval.
- Preserve productionApproved=false until all gates have evidence.
- No direct push to main, no blind merge, no production deploy, no IAM/billing changes, no data migration or deletion.

## Current decision

**Iteration 2 is in progress.** Source-level remediation branches exist and several exact-head CI runs pass, but no integrated release candidate has passed all required gates. PR #358 currently fails Browser acceptance. P0 all-writer deletion fencing, tenant cutover evidence, live TTL/IAM/Storage evidence and independent approvals remain unresolved.

**Release decision: NO-GO.**
