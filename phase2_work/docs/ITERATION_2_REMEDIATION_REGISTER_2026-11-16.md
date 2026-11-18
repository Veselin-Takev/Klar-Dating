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

## Same-day follow-up — legacy upload-age worker interlock

[PR #363](https://github.com/Veselin-Takev/Klar-Dating/pull/363) was opened on 2026-11-16 against main to disable the legacy upload-age-based verification-photo deletion in functions/src/deleteExpiredPhotos.ts.

- Exact head: cd25203b782eeebe9fd608993c67f4fd2dcf7341.
- Change: remove Storage bucket listing and upload-age deletion from the legacy scheduled worker; retain the scheduler export to avoid an unplanned function deletion; preserve independent funnel-event cleanup; add a Node regression test to the Functions build and correct DATA_RETENTION documentation.
- Enterprise CI run [#43869160182](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/43869160182) was still in progress at register update time.
- This partially mitigates Issue #202 at source level only. The deployed legacy function is unchanged until an approved deployment. The separate decision-aware purge route and its Firestore/GCS late-hold race remain P0.

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


---

# Phase 0 — Baseline consolidation & SHA-bound P0 remediation matrix

**As of:** 2026-11-17 · **Main baseline:** \`2fa3ba223989ff248ad1abaea67f4f454f7c9f6b\` · **Target:** Draft PR #365, branch \`audit/iteration2-remediation-register-20261116\` · **Decision:** NO-GO / \`productionApproved=false\`.

Scope is documentation and evidence planning only. No merge, deployment, cloud/IAM/billing, migration, data mutation, token rotation, scheduler change or destructive operation is authorized. Findings are tied to main baseline unless explicitly marked PR-head evidence. Green CI on a PR head does not certify main, a sibling PR or a later integrated SHA.

## 0.1 Canonical PR / duplicate map

Do not close, retarget, merge or delete PRs through this register. “Superseded” below is a proposed ownership decision pending owner confirmation and exact diff comparison, not a GitHub state change.

| Issue | Canonical PR / base → head | Duplicate or component | Decision / open boundary |
|---|---|---|---|
| #202 legacy upload-age purge | **#368**, main \`2fa3ba223989ff248ad1abaea67f4f454f7c9f6b\` → \`92d71f69851d7f1209b89d04a00353b0ed773358\` | #363 same base → current \`b395c7e2581943f7969c362b24da9f4c335642bb\` | #368 canonical per #370. #363 overlaps and must not be independently integrated. Compare final diffs before owner-confirmed closure. #368 CI #43883028260 SUCCESS is exact-head only; deployed Scheduler state unknown. |
| #371 Art.17 photo-erasure bypass | **#353** integrated review candidate, base #349 head \`ca97df699cc9b0bdca59add95cfe452293d7c141\` → \`c653efd6984f573ab0443bdd3723ca37f63fa320\` | #345/#348/#349/#350/#352 components; #317 ancestor | #353 combines hard-stops/hold/metadata checks but not proven post-final-auth GCS safety or all-writer fencing. Treat components as provenance, not separate production approvals. |
| #374 + #206 media access / bearer URLs | **No complete canonical PR.** New PR required from main \`2fa3ba223989ff248ad1abaea67f4f454f7c9f6b\`. | #376 partial guest-read fix, main → \`b186d14e697b81a57bebf511214d559a11020c81\`; #205 historical rules work | #376 does not close target adult/block/deletion checks or old download-token URL revocation. |
| #373 public-profile resurrection | **#375**, main \`2fa3ba223989ff248ad1abaea67f4f454f7c9f6b\` → \`0055d2d32689d15c47108ddf4a712d93b2f5265f\` | No duplicate verified | Canonical candidate; exact-head CI #43888474459 FAILED Typecheck (step 19). |
| #358 / #364 RC1 consent | **#358**, RC base \`4a3acd90adfa6e781ce92990589fe01585c4b1e5\` → \`1321c42ffe1c5919c1baccaada66a650ab811f93\` | #356/#357 stated as consolidated by #358 | #358 CI #42710380877 FAILED Playwright; #364 is blocker issue, not fix PR. Fix on child from exact #358 head; preserve fail-closed receipt/readback. |
| #370 duplicate governance | **This register in #365** | #363/#368; #344/#369 | Record canonical ownership; no PR state mutation. |
| #362 stale manifests/status | **This register in #365**, then separate atomic docs change | #326 separate Git file-provenance audit | Do not conflate #326 with release governance; preserve history. |
| #372 matching pagination | **#377**, main \`2fa3ba223989ff248ad1abaea67f4f454f7c9f6b\` → \`034164b3125c757a0b5c8a4828ec1b3a234e110a\` | No duplicate verified | CI #43888205840 SUCCESS; scale/cost/latency/index/authorization evidence remains. |
| #254 tenant cutover | **#358** current candidate, not certified | #358 consolidates #356/#357 | #364 failure blocks RC1; 50/50 and 1,636 counts do not override failed exact-head CI. |
| #70 TTL; #8 operations/SLO; #73/#251 CODEOWNERS/branch protection | **No canonical remediation PR verified in this pass** | Validators/static tests are not live operational proof | Need authorized read-only TTL/ruleset/permissions/SLO evidence; otherwise UNKNOWN. |

### Firebase Admin identity deduplication (#343/#344/#369)

**#369 canonical**, main \`2fa3ba223989ff248ad1abaea67f4f454f7c9f6b\` → \`e44d2f9bfb349babf902171feb6194d3100649b3\`. #343 is component/ancestor; #344 is superseded by #369 after exact diff review. Do not merge either independently. #369 CI #43882884789 SUCCESS applies only to its head and does not prove live project/bucket ownership, IAM or deployed service identity.

## 0.2 Exact dependency / integration order

This is review order, not merge authorization. Stacked branches have different bases; do not bulk-merge PRs numerically.

**Workstream A — #202/#371:**
1. Compare exact file diffs and overlapping hunks for #317/#345/#348/#349/#350/#352/#353 in \`complianceStorage.ts\`, \`retention.ts\`, \`trustAndSafety.ts\`, \`deleteExpiredPhotos.ts\`, rules and tests.
2. Retain #345 explicit bucket boundary: base \`37c7487246303c5af1543ca1e5afe31e2cf2e0f4\` → \`e1db047498a797220869ad88243de958c9e17f22\`.
3. Retain #348 production purge hard-stop: #345 head \`e1db047498a797220869ad88243de958c9e17f22\` → \`a7b6e574086d02fd9ea28868b061c7072ed84f5c\`.
4. Retain #349 account-erasure hard-stop: #348 head \`a7b6e574086d02fd9ea28868b061c7072ed84f5c\` → \`ca97df699cc9b0bdca59add95cfe452293d7c141\`.
5. Reconcile #350 record-hold guard: #345 head \`e1db047498a797220869ad88243de958c9e17f22\` → \`e89ba9c11791450eb402e8fddb7eb9e1b1fd4527\`; then #352 metadata/generation guard: #350 head \`e89ba9c11791450eb402e8fddb7eb9e1b1fd4527\` → \`90de150d1ee49a5a762c874b127a5ad286bae5e7\`.
6. Use #353 (base #349 head \`ca97df699cc9b0bdca59add95cfe452293d7c141\`, head \`c653efd6984f573ab0443bdd3723ca37f63fa320\`) as integration review reference. Verify by diff that all invariants survive in a clean main-based candidate; if not, create a clean main-based integration branch and port reviewed changes in order. Never blindly merge sibling stacks.
7. Keep every hard-stop; never activate physical photo deletion.

**Workstream B — #343/#344/#369:** review parent/child diffs, use #369 as consolidated reference, test conflicting \`GCLOUD_PROJECT\` / \`GOOGLE_CLOUD_PROJECT\` / \`FIREBASE_PROJECT_ID\`, Admin default-app identity, named-app reuse and Firestore database/Storage bucket binding. Integrate with Workstream A only after Firebase initializer/bucket/test-fixture conflict review. Exact-head CI required on the final combined SHA; individual green runs do not transfer.

**Workstream C:** fix #375 Typecheck before re-running emulator/rules/Playwright; design a new complete #374/#206 media PR (reuse #376 only if appropriate); fix #364 on an exact child of #358 and rerun RC1 CI. Keep RC1 separate from mainline P0 batch.

## 0.3 SHA-bound remediation matrix

| Priority / issue | Canonical PR & exact base → head | Technical gap remaining | Required emulator / Playwright / security proof | Rollback trigger / safe response |
|---|---|---|---|---|
| **P0-1 #371 Art.17 photo erasure** | #353 base #349 head \`ca97df699cc9b0bdca59add95cfe452293d7c141\` → \`c653efd6984f573ab0443bdd3723ca37f63fa320\`. Dependencies #345 \`37c7487…→e1db047…\`; #348 \`e1db047…→a7b6e57…\`; #349 \`a7b6e57…→ca97df6…\`; #350 \`e1db047…→e89ba9c…\`; #352 \`e89ba9c…→90de150…\`. | **P0 open:** #353 does not prove a hold/revocation after final Firestore authorization but before GCS delete. External Admin SDK, console, Scheduler, moderation, KYC/IAM and other writers remain UNKNOWN. DPO-approved pending/exception semantics are unsigned; deferred photo deletion cannot be reported as completed Art.17 erasure. | **Firestore Emulator:** deterministic post-final-auth late-hold/revocation race; zero physical delete, no purge proof, durable pending state for scheduler + Art.17 paths; malformed/missing decision, object holds, generation replacement, 404/412, crash/replay/idempotency/retry. **Storage Emulator:** unsafe states deny with zero Storage calls. **Playwright:** completed vs pending/held erasure state, retry/audit receipt, no false success. **Security:** full source + authorized read-only external writer/IAM/Scheduler/bucket inventory; independently reviewed monotonic all-writer fence; authorized staging adversarial no-delete proof; AppSec + DPO/Legal + SRE signoff. #353 CI #42460900607 SUCCESS is branch-local only. | Stop if a hold race deletes, a writer bypasses fence, malformed state becomes eligible, bucket identity is ambiguous, or Art.17 falsely completes. Retain/restore HTTP 503 + account-erasure hard-stops, keep purge disabled, preserve evidence/pending state. Never roll back to legacy destructive path. |
| **P0-2 #374/#206 profile media / download tokens** | **No complete canonical PR yet.** New PR base main \`2fa3ba223989ff248ad1abaea67f4f454f7c9f6b\`. #376 partial base same → \`b186d14e697b81a57bebf511214d559a11020c81\`. | #376 only denies guest reads. It does not enforce target adult/active, block or deletion state, nor revoke existing Firebase \`getDownloadURL()\` bearer URLs. #206 confirms \`photoURL\` stores tokens and consumers render them. Old copied URLs may bypass Rules changes. Full server-authorized media/byte-read design and migration absent. | **Storage Emulator:** anonymous/guest/underage/adult allowed/blocked/suspended/deletion-pending/missing-target/direct-path negatives. **Firestore/API Emulator:** requester + target checks; no public bearer URL. **Playwright:** allowed adult; deny guest/minor/blocked/deleting; session switch, stale cache, offline, dual-read and expiry/revocation. **Security:** inventory token metadata without PII export; opaque-handle migration; prove old \`?token=\` revoked in authorized staging (emulator insufficient); inspect logs/telemetry/referrers/source maps/public projections/cache; TTL/rate limits/audit. #376 CI #43887646474 SUCCESS is partial only. | Stop if blocked/minor/deleting viewer reads media, old token remains usable, token leaks, or valid adult access breaks. Keep direct reads fail-closed; stop new token issuance; preserve opaque mapping; rollback only routing/migration under reviewed plan. Never restore public long-lived bearer URLs. |
| **P0-3 #373 public-profile resurrection** | #375 base main \`2fa3ba223989ff248ad1abaea67f4f454f7c9f6b\` → \`0055d2d32689d15c47108ddf4a712d93b2f5265f\`. | Transaction + target-side Rules guard proposed, but CI #43888474459 FAILED Typecheck (step 19); tests are not validated at this head. All public writers/readers and stale retries must honor barrier. | **Firestore Emulator:** publish-before-delete, delete-before-publish, concurrent retries, stale retry after barrier, missing/malformed barrier, direct target read; inventory all writers. **Playwright:** no discovery/search/direct read after barrier; no success on rejected publish; receipt/state agree. **Security:** Rules target check, transaction conflict domain, cache invalidation, BOLA/IDOR, fail-closed. Full Typecheck/Rules/Emulator/unit/build/browser CI on corrected SHA. | Stop if profile recreated/readable after barrier, transaction bypassed, valid users broadly denied, or erasure/discoverability disagree. Preserve barrier/read denial; stop rollout and fix forward. Do not remove barrier. |
| **P0-4 #202 legacy age purge** | #368 base main \`2fa3ba223989ff248ad1abaea67f4f454f7c9f6b\` → \`92d71f69851d7f1209b89d04a00353b0ed773358\`; duplicate #363 same base → \`b395c7e2581943f7969c362b24da9f4c335642bb\`; #348 route hard-stop head \`a7b6e574086d02fd9ea28868b061c7072ed84f5c\`. | #368 removes Storage list/delete from legacy worker, retains scheduler export and funnel cleanup. It does not prove deployed scheduler revision, inventory other writers, or close separate decision route late-hold race (#348/#353). | **Functions/Firestore/Storage Emulator:** old upload + pending/missing/corrupt decision MUST NOT delete; decision + \`fotoLoeschenAb\` deadline; active/malformed holds, generation replacement, 404/412, retry/partial batch/audit; assert zero Storage calls from legacy worker. **Playwright:** retention UI only if it exists (otherwise N/A); full browser suite still required. **Security/ops:** enumerate exports/writers; authorized read-only deployed function/Scheduler/bucket/IAM/retention evidence. #368 CI #43883028260 SUCCESS exact-head only. | Stop if worker deletes by \`timeCreated\`, pending image deleted, scheduler migration reactivates destructive endpoint, or funnel cleanup regresses. Retain no-op Storage behavior and hard-stop; suspend promotion. Never restore age-based deletion. |
| **P1 gate #358/#364 consent withdrawal** | #358 base RC \`4a3acd90adfa6e781ce92990589fe01585c4b1e5\` → \`1321c42ffe1c5919c1baccaada66a650ab811f93\`; fix child from exact head. | CI #42710380877 FAILED Playwright \`tests/e2e/privacy-settings.spec.ts:4\`. Endpoint HTTP 200, but UI shows “Die Änderung konnte nicht bestätigt werden. Bitte erneut versuchen.” instead of “Einwilligung wurde widerrufen.” ConsentSettings requires \`ok===true\`, evidenceId, then authoritative profile readback matching evidence + purpose. Response body/readback namespace or serialization root cause not yet evidenced. Never weaken readback. | **Firestore Emulator:** same UID/tenant receipt + evidence ID + purpose + timestamp + server state; wrong namespace, stale cache, missing evidence, replay, cross-tenant negatives. **Playwright:** reproduce withdrawal; success only after authoritative readback; analytics stops before grant and after withdrawal; capture response and \`/api/account/status\`/profile payload with PII redacted. **Security/privacy:** stale cache/retry/tenant mismatch cannot re-enable consent; independent privacy review; full exact-head Enterprise CI/browser. #364 says 28 other Chromium tests passed; irrelevant to failed assertion. | Stop if UI reports success without durable evidence, analytics continues after withdrawal, stale profile re-enables consent, or tenant mismatch yields false receipt. Retain fail-closed state/backend withdrawal/audit; stop RC promotion; fix forward. Never relax evidence/readback. |

## 0.4 Toolchain and manifest alignment plan (#362)

**Verified at main SHA:**
- Root \`package.json\` blob \`fdf368656027465eb88226ab6535c58f1c44b61a\`: \`packageManager=bun@1.4.4\`, Node \`>=22.23.3\`.
- Root \`bun.lock\` blob \`c19f6d8f0227f225955724133441db6c538b041b\`, lockfileVersion 3.
- Root \`Dockerfile\` blob \`aa25814c43ca9cfd8a6fcbe977f8e72ae7c53ff6\`: Bun 1.4.4 pinned by digest; Node 22.23.3 runtime.
- RC1 manifest blob \`98b2f1cabe273bfd945682c5cb7bbfe2e1d96e1a\` on \`release/v0.1.1-rc1\`: Bun 1.4.2, dated 2026-11-08, immutable base \`96c3857c53f5ced31fe1394895185f42c75bc716\`.
- Root manifest blob \`3ec2beb2a3e01487394f581a41dedc8d56b5b81b\` dated 2026-09-15; phase2 manifest blob \`31d8199009a0ddc48a6bc9d9b910d5ef939b33e9\` dated 2026-10-08. Both retain 2026-10-10 NO-GO and stale candidate SHA \`286a991e776885199bb1028d380e239821de88ac\`.
- \`PROJECT_STATUS.md\` blob \`18915683f4a8e17f06b184fc06ce688bd1059d46\` has no November entry; latest entries 2026-10-26.

**Exact sequence — do not downgrade package.json:**
1. Keep main packageManager Bun 1.4.4; do not downgrade to 1.4.2 to match historical RC manifest.
2. Inventory root/phase2 package manifests, Bun locks, Functions locks/packageManager, all active Actions setup-Bun pins, Dockerfiles/digests, devcontainer/Codespaces, release scripts, cache keys and SBOM/provenance. Separate main from historical RC branch.
3. Prove frozen install with Bun 1.4.4 + Node 22.23.3 in isolated CI: frozen lock install, Functions install/build, typecheck, unit/emulator, Playwright, enterprise checks, production build/smoke. Record runner, versions, lock hashes and run URL.
4. Only if every active pin and frozen-install agrees, amend the **current candidate** manifest to Bun 1.4.4 / Node 22.23.3 and bind exact SHA. Do not rewrite historical RC1 as if its original candidate used 1.4.4; append dated supersession referencing original base and new main SHA.
5. If an active CI/Functions/container pin still requires 1.4.2, stop and resolve in a separate reviewed toolchain PR. No dependency upgrade/lock regeneration in this docs-only change.
6. Synchronize root + phase2 manifests from one schema/canonical governance block. Preserve historical releaseDate, provenance, old CI and decisions. Add \`asOf=2026-11-17\`, \`baselineSha=2fa3ba…\`, NO-GO, \`productionApproved=false\`, \`candidateVerified=false\` unless an immutable RC is fully verified, exact PR/CI evidence and blockers. Never copy PR-head PASS to main.
7. Add dated 2026-11-17 section to PROJECT_STATUS separating main, RC branch, PR heads, CI results/failures, unknown operations and independent approvals; link this register and #362.
8. Run \`npm run check:deployment\`, JSON/schema consistency, markdown lint, duplicate-field consistency and full docs CI on PR head; record exact SHA/results.
9. Update both manifests and PROJECT_STATUS atomically in a separately reviewed docs PR. Preserve NO-GO and false production approval in every manifest/dashboard.

## 0.5 Review order and Phase 0 exit

Review order if separately authorized: (1) photo deletion containment #345/#348/#349/#350/#352/#353; (2) new complete media authorization PR #374/#206; (3) corrected #375; (4) #368 over #363 coordinated with #348/#353; (5) #358 only after #364 and browser CI pass; (6) #369 over #343/#344 after conflict review; (7) #377 and documentation/manifests #365 as separate tracks.

Every integrated candidate needs exact-SHA TypeScript, static/secret/dependency checks, unit/Node, native Firestore + Storage Emulator, Rules, Functions build, production build/smoke and full Playwright. Inspect raw failures. Then obtain independent AppSec, DPO/Legal, SRE and Release Owner review plus authorized staging evidence. CI cannot prove deployed Scheduler/IAM/TTL/bucket identity, late-hold safety or rollback readiness.

Phase 0 checklist:
- [x] Baseline and target docs PR pinned.
- [x] Canonical/duplicate mapping recorded without PR state mutation.
- [x] P0/P1 gaps, proof and rollback triggers defined.
- [x] Toolchain drift and manifest sync sequence defined.
- [ ] Owner accepts canonical PR choices.
- [ ] Exact diffs compared for overlapping PRs before closure/integration.
- [ ] This docs PR exact-head CI, markdown/JSON validation and independent review pass.
- [ ] Root/phase2 manifests and PROJECT_STATUS synchronized in separate atomic docs change.
- [ ] P0 evidence and independent operational/legal/security approvals complete.

**Phase 0 decision: BLOCKED / NO-GO.** This is a plan/evidence index, not a claim any P0 is closed. \`productionApproved=false\` remains mandatory. No main merge, cloud/deployment/configuration change, IAM/billing action, data migration, token rotation, scheduler operation or physical deletion is authorized.


---

# Phase 0 follow-up — CI verification, duplicate PR diff audit, and #375 typecheck triage

**Audit date:** 2026-11-17  
**Comparison baseline:** \`main@2fa3ba223989ff248ad1abaea67f4f454f7c9f6b\`  
**Audit branch:** \`audit/iteration2-remediation-register-20261116\`  
**Constraints:** read-only source inspection + this documentation update only. No PRs closed, no merges, no cloud/deployment changes. \`productionApproved=false\` / NO-GO retained.

## F0.1 PR #365 exact-head CI result

**PASS — GitHub Actions Run #44044744941**, workflow \`Klar Enterprise CI\`, run number 2078, attempt 1.

- Exact head: \`8377c933395a857ff404445c87525341e9309fe0\`
- Exact base: \`2fa3ba223989ff248ad1abaea67f4f454f7c9f6b\`
- PR: #365, branch \`audit/iteration2-remediation-register-20261116\`
- Job \`validate\`: \`success\`
- All validation steps passed, including Enterprise static gates, Typecheck, Functions build, Tests, Build, Production smoke and Browser acceptance.
- Browser failure diagnostics step skipped as expected because browser acceptance passed.

Evidence: https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44044744941

This is an exact-head CI PASS for the documentation-only PR #365. It does not validate the P0 remediation PRs, a combined code SHA, live cloud configuration, or production readiness.

## F0.2 File-level delta audit — #363 versus #368 (#202)

Both PRs are open Drafts and independently based on the same requested mainline SHA:

- #363 head \`b395c7e2581943f7969c362b24da9f4c335642bb\`, base \`2fa3ba223989ff248ad1abaea67f4f454f7c9f6b\`.
- #368 head \`92d71f69851d7f1209b89d04a00353b0ed773358\`, base \`2fa3ba223989ff248ad1abaea67f4f454f7c9f6b\`.

### Shared-file findings

| File | #363 | #368 | Delta / decision |
|---|---|---|---|
| \`phase2_work/functions/src/deleteExpiredPhotos.ts\` | Removes bucket access and upload-age deletion; retains scheduler export and funnel cleanup; marker \`verification_photo_retention_disabled_legacy_worker\` / reason \`decision_aware_fenced_purge_required\`. | Same core fail-closed behavior; marker \`verification_photo_retention_disabled\` / reason \`legacy_upload_age_worker_not_authorized\`; retains funnel cleanup and records \`checkedAt\`. | Both stop the legacy worker from listing/deleting verification objects. #368's wording/marker is internally paired with its guard scripts. Do not cherry-pick #363 source wholesale. |
| \`phase2_work/docs/DATA_RETENTION.md\` | Explicitly describes the separate \`purgeVerificationStorageCron\` / \`/api/admin/purge-verification-storage\` path as unfenced and requiring all-writer/late-hold proof. | More explicit that a generation precondition alone does not prevent a late Legal-Hold race; a deletion receipt is valid only after an authorized physical delete; disabled legacy worker is not Art.17 completion. | Preserve #363's separate-endpoint wording if not already elsewhere in the canonical register; #368's audit/receipt language is stronger. No security logic gap in the worker itself. |

### Unique files and assertions

**Only in #363:**
- \`phase2_work/functions/package.json\` adds \`tests/legacy-photo-retention.node.cjs\` to the Functions \`build\` script.
- \`phase2_work/functions/tests/legacy-photo-retention.node.cjs\` adds two assertions:
  1. Worker source must not reference \`getMaintenanceBucket\` or \`deleteExpiredPhotoPage\`, and must contain the disabled marker + decision-aware reason.
  2. The independent \`funnel_events\` / \`expiresAt\` cleanup and \`funnel_event_retention\` log remain.

**Only in #368:**
- \`phase2_work/scripts/check-retention-matrix.mjs\` adds static assertions that the legacy worker cannot reference the photo deletion helper, obtain the Storage bucket, or scan \`verification/\`; it also requires the explicit fail-closed marker.
- \`phase2_work/scripts/test-retention-matrix.mjs\` adds a mutation test that injects a legacy delete call and asserts the matrix guard fails.

### CI execution evidence and closure recommendation

- #363 exact head \`b395c7e2581943f7969c362b24da9f4c335642bb\`: Run #43880654865 completed SUCCESS.
- #368 exact head \`92d71f69851d7f1209b89d04a00353b0ed773358\`: Run #43883028260 completed SUCCESS. Its \`Enterprise static gates\` executes \`bun run check:enterprise\`; the phase2 \`check:enterprise\` includes \`check:retention-p0\`, which runs \`check-retention-matrix.mjs\` and \`test-retention-matrix.mjs\`. Its Functions build also passed.

**Delta verdict:** #368 is the better canonical PR: it has the stronger mutation guard and explicit no-delete assertions, and the guard is wired into Enterprise CI. However, #363 has one unique regression assertion not found in #368: preservation of the unrelated funnel-event cleanup. The exact marker assertions in #363 cannot be copied verbatim because #368 intentionally uses different marker/reason strings.

**Required before owner-approved closure of #363:** port the funnel-event-preservation assertions into #368's existing \`test-retention-matrix.mjs\` (or an equivalent test invoked by \`check:retention-p0\`), asserting \`funnel_events\`, \`expiresAt\`, and \`funnel_event_retention\` remain present; retain #368's own marker assertion. Then rerun exact-head Enterprise CI on the updated #368 head. After that evidence and owner sign-off, #363 can be closed as superseded. Until then, closure is **not yet safe**. No PR was closed by this audit.

## F0.3 File-level delta audit — #343 / #344 versus #369 (Firebase project identity)

### Exact branch provenance

- #343 base \`96c3857c53f5ced31fe1394895185f42c75bc716\`, head \`601c316c4b875242989f488473bba61b4c22322c\`.
- #344 stacked base #343 head \`601c316c4b875242989f488473bba61b4c22322c\`, head \`6e3a10a7dee58f3b55d9e2bc52986d686e189844\`.
- #369 consolidated base main \`2fa3ba223989ff248ad1abaea67f4f454f7c9f6b\`, head \`e44d2f9bfb349babf902171feb6194d3100649b3\`.

### Code and test patch comparison

The unified patch for each shared code/test file was byte-for-byte identical between its original component PR and #369:

| Component PR | Shared file | #369 equivalent | Delta |
|---|---|---|---|
| #343 | \`phase2_work/src/server/firebaseRuntime.ts\` | Same path | Identical patch |
| #343 | \`phase2_work/tests/firebaseRuntime.spec.ts\` | Same path | Identical patch |
| #344 | \`phase2_work/src/server/db.ts\` | Same path | Identical patch |
| #344 | \`phase2_work/src/server/storage.ts\` | Same path | Identical patch |
| #344 | \`phase2_work/tests/nativeFirestoreBoundary.spec.ts\` | Same path | Identical patch |
| #344 | \`phase2_work/tests/storageBucketIsolation.spec.ts\` | Same path | Identical patch |

Therefore no unique runtime or Storage security assertion from #343/#344 is missing from #369's code/tests. #369 carries the environment-ID mismatch and stale database-ID protections, default Admin app identity checks, wrong-project bucket fail-closed behavior, blank/gs:// rejection, demo-only Storage emulator behavior, and their associated tests.

### Unique documentation delta

Both #343 and #344 modify \`phase2_work/docs/VES12_FIREBASE_RUNTIME_PROJECT_ISOLATION_2026-11-07.md\`; #369 does not include that documentation file. It contains historical context that should be preserved in the canonical audit register:
- source defect and rationale for rejecting inconsistent runtime project IDs and stale Firestore database IDs;
- default Admin app reuse risk and compatibility review requirement;
- cross-project Storage bucket fallback risk and explicit bucket requirement;
- prior failed #344 test run #42414110302 (missing default export in the \`node:fs\` Vitest mock), subsequent corrected exact-head run #42414827630 SUCCESS;
- staging project/bucket ownership, IAM, real resource existence and EUR 10 budget evidence remain separate and unverified gates.

The unique file is evidence/documentation, not an omitted runtime control. Its essential risk and gate content is captured in this register; do not merge #343/#344 solely to preserve the duplicate documentation file.

### Exact-head CI and closure recommendation

- #369 exact head \`e44d2f9bfb349babf902171feb6194d3100649b3\`: Run #43882884789 completed SUCCESS.
- #344 exact head \`6e3a10a7dee58f3b55d9e2bc52986d686e189844\`: Run #42414827630 completed SUCCESS.
- #343 exact head \`601c316c4b875242989f488473bba61b4c22322c\`: Run #42413071403 previously documented as SUCCESS; its older base and separate SHA do not certify #369.

**Delta verdict:** #369 is a clean main-based consolidation and contains every code/test patch from #343 and #344. No cherry-pick of runtime or Storage code/tests is required. Once the owner confirms #369 is the canonical path and its independent AppSec/SRE + staging identity gates remain tracked, #343 and #344 are safe candidates for owner-approved closure as superseded. No PR was closed by this audit.

**Important boundary:** successful unit tests and CI do not establish that any actual staging project, Firestore database, bucket, IAM policy, Cloud Run service account or billing budget exists or is correctly configured. No cloud access or mutation was performed.

## F0.4 PR #375 Typecheck root cause — #373

Run #43888474459 exact head \`0055d2d32689d15c47108ddf4a712d93b2f5265f\` failed in job \`validate\`, step 19 \`Typecheck\`. The exact compiler output is:

\`\`\`text
tests/profileRecommendationsEndpoint.spec.ts(50,44): error TS2556:
A spread argument must either have a tuple type or be passed to a rest parameter.
\`\`\`

No other TypeScript compiler diagnostic was emitted in that run. Steps after Typecheck (Functions build, Tests, Build, Production smoke, Playwright) were skipped as a consequence.

### Exact source location

File: \`phase2_work/tests/profileRecommendationsEndpoint.spec.ts\`

- Line 18: \`const set = vi.fn(async () => undefined);\` — mock currently has zero declared parameters.
- Line 35: \`const stagedWrites: unknown[][] = [];\` — staged write entries are arbitrary arrays, not fixed tuples.
- Line 40: transaction mock captures \`set\` arguments with \`stagedWrites.push(args)\`, preserving the unbounded \`unknown[]\` type.
- **Line 50, column 44:** \`for (const args of stagedWrites) set(...args);\` — spreads an \`unknown[]\` into a zero-argument mock; this is the TS2556 source.

### Minimal type-safe correction specification

Keep this isolated to the test helper; do not alter production route or Firestore Rules to suppress the diagnostic.

1. Type the mock as a two-argument write operation, e.g. \`const set = vi.fn(async (_ref: unknown, _data: unknown) => undefined);\`.
2. Replace \`unknown[][]\` with a fixed tuple array, e.g. \`const stagedWrites: Array<[ref: unknown, data: unknown]> = [];\`.
3. Type the transaction test-double's \`set\` callback as accepting \`(ref: unknown, data: unknown)\` and push \`[ref, data]\`, not an arbitrary rest array.
4. Replay with explicit tuple destructuring: \`for (const [ref, data] of stagedWrites) set(ref, data);\`.
5. Keep the existing race simulation semantics: first attempt's staged writes are discarded when deletion wins; second attempt sees \`account_deletions/{uid}\` and writes nothing.
6. Rerun \`bun run typecheck\` on the new exact PR head, then full Enterprise CI, Firestore Rules Emulator, unit tests and Playwright. Do not reuse Run #43888474459 as validation for a changed SHA.

This is a test-double typing defect, not evidence that the production transaction is correct. The mocked retry is not a substitute for a native Firestore Emulator concurrency test.

## F0.5 Consolidated decision

| Workstream | Technical delta result | Owner action |
|---|---|---|
| #363 → #368 | #368 stronger and CI-wired; #363 has unique funnel cleanup assertion to port/adapt | Keep #363 open until assertion is ported and #368 exact-head CI reruns; then owner may close #363 |
| #343/#344 → #369 | All runtime and Storage code/test patches identical in #369; only shared documentation file omitted | #369 canonical; #343/#344 can be owner-closed after canonical confirmation and tracking of external staging gates |
| #375 | One exact TS2556 at test helper line 50, caused by untyped rest spread | Apply tuple typing on a child/new head, rerun all required checks |

**Audit outcome:** #365 CI PASS. #369 consolidation is code/test complete relative to #343/#344. #368 is the preferred #202 candidate but needs the unique funnel cleanup assertion ported before #363 closure. #375 remains blocked pending the specified test-helper correction and fresh exact-head validation.

All PRs remain in their existing GitHub states. No merges, closures, code changes to remediation PRs, cloud/deployment changes, IAM/billing operations or data mutations were performed. \`productionApproved=false\`; production remains NO-GO.


---

# Phase 0 follow-up — supersession closure evidence and final PR #375 CI

**Evidence date:** 2026-11-17  
**Audit branch:** `audit/iteration2-remediation-register-20261116`  
**Release decision:** NO-GO / `productionApproved=false`.

## F0.6 Owner-approved supersession closures

The repository owner explicitly authorized the following duplicate closures. Each PR was closed without merging and received a top-level audit comment containing its canonical PR, canonical commit SHA and exact-head Enterprise CI run.

| Closed PR | Canonical PR | Canonical head SHA | Exact-head Enterprise CI | Closure comment |
|---|---|---|---|---|
| [#363](https://github.com/Veselin-Takev/Klar-Dating/pull/363) | [#368](https://github.com/Veselin-Takev/Klar-Dating/pull/368) | `554fa00957ba21e5ae49d0f30e5f6dc06eea1cfb` | [#44047303449 SUCCESS](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44047303449) | [comment #6943142612](https://github.com/Veselin-Takev/Klar-Dating/pull/363#issuecomment-6943142612) |
| [#343](https://github.com/Veselin-Takev/Klar-Dating/pull/343) | [#369](https://github.com/Veselin-Takev/Klar-Dating/pull/369) | `e44d2f9bfb349babf902171feb6194d3100649b3` | [#43882884789 SUCCESS](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/43882884789) | [comment #6943144135](https://github.com/Veselin-Takev/Klar-Dating/pull/343#issuecomment-6943144135) |
| [#344](https://github.com/Veselin-Takev/Klar-Dating/pull/344) | [#369](https://github.com/Veselin-Takev/Klar-Dating/pull/369) | `e44d2f9bfb349babf902171feb6194d3100649b3` | [#43882884789 SUCCESS](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/43882884789) | [comment #6943145843](https://github.com/Veselin-Takev/Klar-Dating/pull/344#issuecomment-6943145843) |

GitHub state was verified as closed for all three; all report `merged=false`. Canonical ownership is #368 for #363 and #369 for #343/#344. No branch deletion, merge, deployment or cloud operation was performed.

## F0.7 Updated exact-head evidence — canonical PR #368

- PR: [#368](https://github.com/Veselin-Takev/Klar-Dating/pull/368)
- Exact head: `554fa00957ba21e5ae49d0f30e5f6dc06eea1cfb`
- Enterprise CI: [Run #44047303449](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44047303449) — completed SUCCESS.
- Verified gates: Enterprise static gates, Typecheck, Functions build, Tests, Build, Production smoke and Browser acceptance all passed.
- Retention guard output confirms the canonical 20-group TTL guard, 13 TTL mutations, legacy photo-purge hard-stop and three funnel-retention mutations. The run is source/CI evidence only; it performs no cloud writes and does not establish live TTL or deployed Scheduler state.

## F0.8 Final exact-head validation — PR #375 / Issue #373

- PR: [#375](https://github.com/Veselin-Takev/Klar-Dating/pull/375)
- Exact head: `289babdded7818c6720ea353a9621c452314cb5a`
- Enterprise CI: [Run #44049314291](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44049314291) — completed SUCCESS, run number 2082, job `validate` success.
- `phase2_work/tests/profileRecommendationsEndpoint.spec.ts`: 17 tests passed, including the deletion-wins retry race.
- Test mock now records one outer `runTransaction` invocation and two transaction-callback attempts. The first attempt's staged writes are discarded when the simulated deletion wins; the second observes `account_deletions/{uid}` and returns the deletion barrier result. The test asserts `transactionAttempts` called twice and `store.set` not called.
- Full suite: 192 test files / 1,375 tests passed.
- Enterprise static gates, Typecheck, Functions build, Tests, Build, Production smoke and Browser acceptance (26 tests) all passed. Browser failure diagnostics were skipped because acceptance passed.

**Verdict:** PR #375 is technically validated on this exact head for the repository's Enterprise CI pipeline. This does not prove native Firestore concurrency semantics in production, live cloud state, independent security review or release approval. Keep emulator adversarial coverage and independent review as release gates.

## F0.9 Updated consolidated decision

- #363, #343 and #344: closed as owner-approved superseded duplicates; none merged.
- #368: canonical legacy-photo-worker hard-stop candidate; exact-head CI #44047303449 SUCCESS.
- #369: canonical Firebase/Admin identity candidate; exact-head CI #43882884789 SUCCESS.
- #375: exact-head Enterprise CI #44049314291 SUCCESS; test/typecheck/build/smoke/Playwright gates passed.
- #371 / #353: remains P0 OPEN. The late Firestore legal-hold/moderation-revocation race before physical GCS deletion and the complete all-writer inventory/fence are not resolved by CI on #353.

No PR merge to main, production deployment, cloud/IAM/billing change, data migration or physical deletion was performed. `productionApproved=false` remains mandatory; release decision remains NO-GO.

## 0.4 Package A — Issue #371 deletion fence (PR #378 exact-head CI)

**Verified 2026-11-17.** PR [#378](https://github.com/Veselin-Takev/Klar-Dating/pull/378) is an open Draft PR on branch `security/issue-371-deletion-fence-package-a-20261117`, exact head `6667764fa7a5123fa27981178193c13387283e1f`. The SHA-bound GitHub Actions run [#44054128397](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44054128397) completed with conclusion **success**.

- Fence test file: **12/12 passed**, including **7/7 Firestore Emulator transaction tests** and **5/5 pure unit tests**.
- Full Vitest suite: **195 files / 1,495 tests passed**.
- Browser acceptance (Playwright): **26/26 passed**.
- Enterprise CI gates, TypeScript, Functions build, tests, application build, production smoke and browser acceptance all completed successfully on the exact head above.
- This evidence is specific to PR #378 / SHA `6667764fa7a5123fa27981178193c13387283e1f`; it does not validate an integrated purge route, moderation/legal-hold writers, external Storage writers, production configuration or live Cloud state.
- PR #378 remains open, draft and unmerged. Package A supplies the schema/state-machine helpers only; Issue #371 remains **P0 open** pending Package B integration, deterministic late-hold barrier proof, all-writer inventory and independent approvals.

**Release decision unchanged:** `productionApproved=false`; **NO-GO**. No production deployment, Cloud/IAM change, migration or destructive operation is authorized by this evidence.

## F0.10 Package B — PR #379 exact-head enterprise validation and Issue #371 all-writer gate

**Evidence verified 2026-11-18.** Draft PR [#379](https://github.com/Veselin-Takev/Klar-Dating/pull/379), branch `security/issue-371-deletion-fence-package-b-20261117`, exact head `bd42b333ae341384cf819727b3ec4ad97d5a658b), has a completed **Klar Enterprise CI SUCCESS** run [#44260930996](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44260930996).

- Full Vitest suite: **196/196 test files and 1,512/1,512 tests passed**.
- Targeted suites: `verificationPurgeHttpEmulator.spec.ts` **23/23**, `complianceStoragePurge.spec.ts` **90/90**, `verificationDeletionFence.spec.ts` **15/15**.
- Browser Acceptance: **26/26 passed**.
- Enterprise static gates, Typecheck, Functions build, Tests, Build, Production Smoke and Browser Acceptance all completed with SUCCESS on the exact SHA above.
- The Firestore/Auth/Storage emulator workflow used the isolated `demo-klar` project. These are source/CI tests, not evidence of a live GCS deletion or deployed Cloud state.

### Package B technical evidence and limits

The active `complianceStorage.ts` route now persists a generation-, metageneration-, path- and decision-bound `photoPurgeIntent` before issuing a conditional GCS delete; rechecks Storage metadata and current Firestore eligibility/holds/lease before deletion; and supplies both `ifGenerationMatch` and `ifMetagenerationMatch`. The fence module records exact delete attempts, closes attempts after definitive 412 or pre-delete rejection, supports confirmed-404 reconciliation, and allows attempt reclamation only by a worker holding the active singleton purge lease.

The nine previously failing `verificationPurgeHttpEmulator.spec.ts` regression cases passed in the exact-head CI run: GCS 412 handling, audit-transaction failure after deletion, replacement generation, changed moderation decision, changed canonical decision, late `legalHold`, late `photoPurgeHold`, expired lease before deletion, and stale-worker/successor-lease reconciliation.

### Remaining Issue #371 closure gates

- The successful PR #379 CI result establishes the tested Package B path only. It is not a complete all-writer proof.
- Independently inspect every moderation/verification decision writer, verification upload path, legal-hold writer, Storage retention worker, account-erasure path and any other Storage Admin SDK caller for use of the same generation-bound fence.
- Verify Art. 17 account erasure cannot report completion while verification objects, active holds, unresolved delete attempts or storage-fence records remain.
- The residual Firestore-to-GCS cross-service TOCTOU interval remains: these services do not share an atomic transaction. Supported-writer adoption and independent adversarial review remain required.
- Independent AppSec review, DPO/legal sign-off and SRE review are still outstanding.

**Release decision unchanged:** `productionApproved=false` / **NO-GO**. PR #379 remains Draft and unmerged. No staging or production deletion is authorized. Do not merge to `main`; no live Cloud resources, IAM bindings, billing or deployment configuration were changed.
