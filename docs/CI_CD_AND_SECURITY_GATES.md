# CI/CD and Security Gates

**Current verified `main` HEAD:** `6f3f4f6ed8662ece91e4522d5c6dbb29abc015f7` (PR #406 merged; exact post-merge branch ref, parent and tree verified).
**Previous `main` HEAD:** `616b165d6df783b5fe9c1b45dcb9c5dd53def583`.

## Immutable verified main baseline — PR #406 / P0 #374 Package 2 (2026-11-23)

PR [#406](https://github.com/Veselin-Takev/Klar-Dating/pull/406) merged at `6f3f4f6ed8662ece91e4522d5c6dbb29abc015f7`; previous main `616b165d6df783b5fe9c1b45dcb9c5dd53def583`; merge tree `726effe0ec7f70d1039ed531a299504a281fecb4`, identical to the validated pre-merge PR HEAD tree.

| Workflow | Exact post-merge Run | Result | Evidence |
|---|---:|---|---|
| Klar Enterprise CI | [#45136353988](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45136353988) (#2312) | **SUCCESS** | Exact `head_sha=6f3f4f6ed8662ece91e4522d5c6dbb29abc015f7`; 224 files / 1,814 tests / 0 failed; token dry-run 14/14; delivery contract 40/40; cutover readiness 19/19; route guard adapter 23/23; Rules contract 9/9; Playwright 35/35; Typecheck, Functions Build, Build and Production Smoke PASS |
| Enterprise Compliance & Security Audit Gate | [#45136354255](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45136354255) (#147) | **SUCCESS** | Same exact SHA; Gitleaks non-empty range 1 commit / 0 leaks; CLI v8.24.3 checksum OK; range regression 4/4; Tier 1 549 packages and Full Supply-Chain 1,245 packages / 0 High+; Production Build PASS |

P0 #254 remains **OPEN**, `AWAITING_INDEPENDENT_APPSEC_DPO_SRE_REVIEW`; P0 #374 remains **OPEN**. `productionApproved=false`; production NO-GO. The Package 3 branch `security/p0-374-package3-storage-rules-contract-20261123` is active Draft / Unmerged; its own exact-HEAD CI and Audit runs remain **[TO VERIFY]**. Do not transfer PR #406 baseline evidence to the Draft PR.

## Package 3 candidate Storage Rules contract — CI gate addition

- `npm run test:profile-media-storage-rules-contract` runs the isolated Vitest suite from `phase2_work/`.
- The suite is hermetic and emulator-free: local candidate Rules/source reads, synthetic fixtures, and Git-blob SHA verification only; no `node:test`, Java, Firebase Emulator or cloud connection.
- The command is registered in `check:enterprise`; no workflow, Vitest config, dependency or lockfile changes.
- Candidate Rules deny all direct client Storage reads/writes and are not wired into active `firebase.json`. Persistent download-token URLs are outside Rules revocation semantics and require a separately approved revocation operation.

**Current verified `main` HEAD:** `616b165d6df783b5fe9c1b45dcb9c5dd53def583` (PR #405 merged; exact post-merge branch ref verified).  
**Previous `main` HEAD:** `8c239dd71bbeb1bfdd5373cfbe763ab2c9e5a406`.


## Immutable verified main baseline — PR #404 / P0 #254 Package 6 (2026-11-22)

PR [#404](https://github.com/Veselin-Takev/Klar-Dating/pull/404) merged at `8c239dd71bbeb1bfdd5373cfbe763ab2c9e5a406`; previous main `6f0457c1b12967415ee02a12669c94999ac8ec8b`; merge tree `5c17337773b86d0c09baff9615921e673750117b`, identical to the validated pre-merge PR HEAD tree.

| Workflow | Exact post-merge Run | Result | Evidence |
|---|---:|---|---|
| Klar Enterprise CI | [#45076269868](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45076269868) | **SUCCESS** | Exact `head_sha=8c239dd71bbeb1bfdd5373cfbe763ab2c9e5a406`; 222 test files / 1,760 tests / 0 failed; cutover readiness 19/19; Route Guard Adapter 23/23; Rules Contract 9/9; Playwright 35/35; Typecheck, Functions Build, Build and Production Smoke PASS |
| Enterprise Compliance & Security Audit Gate | [#45076269957](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45076269957) | **SUCCESS** | Same exact SHA; Gitleaks 1 commit / ~33.46 KB / 0 leaks; CLI v8.24.3 checksum OK; range regression 4/4; Tier 1 549 pkg and Full Supply-Chain 1,245 pkg / 0 High+; Production Build PASS |

P0 #254 engineering status: `AWAITING_INDEPENDENT_APPSEC_DPO_SRE_REVIEW` (issue remains OPEN; this status does not imply approval). P0 #374 remains OPEN; Package 1 Draft branch `security/p0-374-package1-profile-media-access-contract-20261122` is active. Its PR number, final HEAD and exact-head CI/Audit runs remain **[TO VERIFY]** until observed. `productionApproved=false`; production NO-GO. All previous baseline entries below remain immutable and unchanged.

## Immutable verified main baseline — PR #403 / P0 #254 Package 5 (2026-11-22)

PR [#403](https://github.com/Veselin-Takev/Klar-Dating/pull/403) merged into `main` at `6f0457c1b12967415ee02a12669c94999ac8ec8b`; previous main `b6093992bbfd5e68ac75ace34861ac36860dfe41`; tree `95692d6af3db1012dca2319c9960ce47f03e007d`, identical to the validated PR HEAD tree.
- **Klar Enterprise CI** [#45071907030](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45071907030), exact post-merge main SHA, **SUCCESS**: 222 files / 1,760 tests / 0 failed; Rules Contract 9/9; Route Guard Adapter 23/23; Playwright 35/35; typecheck, Functions Build, Build, Production Smoke and Profile Media boundary gate passed.
- **Enterprise Compliance & Security Audit Gate** [#45071907022](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45071907022), exact same SHA, **SUCCESS**: Gitleaks 1 commit / ~36.09 KB / 0 leaks; CLI v8.24.3 checksum OK; Tier 1 549 packages / 0 High+; Full Supply Chain 1,245 packages / 0 High+; Production Build passed.
- Immutable evidence applies only to this SHA. It is not production approval; `productionApproved=false`, production NO-GO and P0 #254 OPEN remain unchanged.

## Immutable verified main baseline — PR #401 / P0 #254 Package 3 (2026-11-22)

PR [#401](https://github.com/Veselin-Takev/Klar-Dating/pull/401) merged into `main` at `c20dca0d11595f91b8a86687038ea86ba89aa453`; previous main was `b516d56cec7ffb21f45e9544e3cc015391071697`. The validated pre-merge PR HEAD `e7b0b7b798570c20d21a5d6ec7965995aa60a2a7` and merge commit have identical tree SHA `711a47cc6fb56e0f77f1ff4d73a9b014aa782970`. This is immutable evidence for this exact main SHA only.

- **Klar Enterprise CI** [Run #45063508643](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45063508643) — post-merge `push` on `main`, exact `head_sha=c20dca0d11595f91b8a86687038ea86ba89aa453`, **SUCCESS**. Enterprise Static Gates including `check-profile-media-boundary`, Typecheck, Functions Build, Build and Production Smoke passed; **220 test files / 1,728 tests / 0 failed**; `legacyTenantMapping.spec.ts` **7/7**; Playwright Browser Acceptance **35/35**.
- **Enterprise Compliance & Security Audit Gate** [Run #45063508612](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45063508612) — post-merge `push` on `main`, exact same `head_sha`, **SUCCESS**. Gitleaks scanned the non-empty range `b516d56cec7ffb21f45e9544e3cc015391071697..c20dca0d11595f91b8a86687038ea86ba89aa453`: **1 commit / 32.81 KB / 0 leaks**; official CLI **v8.24.3** archive checksum `OK`; range regression **4/4**; Tier 1 **549 packages / 0 High+**; Full Supply-Chain **1,245 packages / 0 High+**; Production Build **PASS**.
- These runs certify only this exact source baseline. They do not prove live Cloud/IAM/Firestore/Storage configuration, tenant migration, legal approval or production readiness. P0 #254 remains **OPEN**; `productionApproved=false`; release **NO-GO**.
- Preserve preceding PR #400 / `b516d56...`, PR #399 / `abb3c4e...`, PR #398 / `58888c8...` and historical PR #375 / #389–#401 evidence below unchanged.

## Immutable verified main baseline — PR #402 / P0 #254 Package 4 (2026-11-22)

PR [#402](https://github.com/Veselin-Takev/Klar-Dating/pull/402) merged into `main` at `b6093992bbfd5e68ac75ace34861ac36860dfe41`; previous main was `c20dca0d11595f91b8a86687038ea86ba89aa453`. The merge tree `4aefa2d8e36e66dfe82c674bba49327faa102b4d` is identical to the validated pre-merge PR #402 HEAD tree. This immutable evidence applies only to this exact main SHA.

- **Klar Enterprise CI** [Run #45066992154](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45066992154) — post-merge `push` on `main`, exact `head_sha=b6093992bbfd5e68ac75ace34861ac36860dfe41`, **SUCCESS**. Enterprise Static Gates including `check-profile-media-boundary` and `test:tenant-rules-contract` passed; Typecheck, Functions Build, Tests, Build, Production Smoke and Playwright Browser Acceptance passed; **221 test files / 1,737 tests / 0 failed**; `tenantRulesContract.spec.ts` **9/9** on `demo-klar`; Playwright **35/35**.
- **Enterprise Compliance & Security Audit Gate** [Run #45066992124](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45066992124) — post-merge `push` on `main`, exact same `head_sha`, **SUCCESS**. Gitleaks scanned the non-empty range `c20dca0d11595f91b8a86687038ea86ba89aa453..b6093992bbfd5e68ac75ace34861ac36860dfe41`: **1 commit / approximately 33.59 KB / 0 leaks**; official CLI **v8.24.3** checksum `OK`; range regression **4/4**; Tier 1 **549 packages / 0 High+**; Full Supply-Chain **1,245 packages / 0 High+**; Production Build **PASS**.
- These runs certify only this exact source baseline. They do not prove live Cloud/IAM/Firestore/Storage configuration, tenant migration, legal approval or production readiness. P0 #254 remains **OPEN**; `productionApproved=false`; release **NO-GO**.
- Preserve prior PR #401 / `c20dca0...`, PR #400 / `b516d56...`, PR #399 / `abb3c4e...`, PR #398 / `58888c8...`, PR #375 and historical PR #389–#402 records below unchanged.

## Active Draft — P0 #254 Package 5: default-off tenant route guard adapter

- Branch: `security/p0-254-package5-tenant-route-guard-adapter-20261122`, based on exact `main@b6093992bbfd5e68ac75ace34861ac36860dfe41`; target `main`; keep **Draft / Open / Unmerged**.
- Scope: isolated injectable `tenantRouteGuardAdapter.ts`; synthetic fake-store end-to-end negative/boundary suite; concept document; script-only registration in `phase2_work/package.json`; this handover and CI/security-gates document.
- The adapter captures server-owned `enabled === true` only. Missing/undefined/non-true values deny before token verifier, resolver, policy or store. Enabled requests delegate Bearer verification with revocation check to `tenantContext.ts`, then pass only its genuine frozen context to `tenantRepository.ts`. No request body or client claim supplies owner/participant authority; admin/super_admin have no bypass.
- No server bootstrap or production route is mounted. Candidate Firestore/Storage Rules remain inactive. No migration, automatic tenant assignment, real PII, Cloud/IAM/Firestore/Storage/bucket/deployment mutation.
- Exact PR number and final PR HEAD are held in GitHub PR metadata and final handover. This Draft PR's own Klar Enterprise CI and Enterprise Compliance & Security Audit Gate exact-HEAD results: **[TO VERIFY]** until observed. Do not transfer the immutable baseline Run IDs above to this PR or create a recursive docs-only commit for its moving self-referential Run IDs.
- P0 #254 remains **OPEN**; `productionApproved=false`; production remains **NO-GO**.

## Immutable verified main baseline — PR #400 / P0 #254 Package 2 (2026-11-22)

PR [#400](https://github.com/Veselin-Takev/Klar-Dating/pull/400) merged at `b516d56cec7ffb21f45e9544e3cc015391071697`; pre-merge PR HEAD `e2dde776287c33e19044196039ee75e089ca9579` and merge commit have identical tree SHA `19274303931cf84596d8208a28f33bf43715e800`.

| Workflow | Exact-head Run | Result | Evidence |
|---|---:|---|---|
| Klar Enterprise CI | [#45035415288](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45035415288) | **SUCCESS** | Exact `head_sha=b516d56cec7ffb21f45e9544e3cc015391071697`; Enterprise Static Gates including profile-media boundary, Typecheck, Functions Build, Tests (**219 files / 1,721 passed / 0 failed**), `tenantRepository.spec.ts` **30/30**, Build, Production Smoke and Playwright **35/35** PASS |
| Enterprise Compliance & Security Audit Gate | [#45035415323](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45035415323) | **SUCCESS** | Same exact `head_sha`; Gitleaks non-zero range **1 commit / ~34.63 KB / 0 leaks**, CLI v8.24.3 checksum OK, regression **4/4**, Tier 1 **549 packages / 0 High+**, Full Supply-Chain **1,245 packages / 0 High+**, Production Build PASS |

The Gitleaks range was `abb3c4ebffef9efc1a4be8a2a19cac3f0c7e12e0..b516d56cec7ffb21f45e9544e3cc015391071697`; the workflow log confirms one commit scanned, approximately 34,630 bytes scanned and `no leaks found`. These results validate only this immutable main SHA. They do not prove live tenant isolation, Cloud/IAM state, legal approval or production readiness. Preserve the previous PR #399 baseline and historical PR #375 / #389–#400 evidence unchanged.

## Active Draft — P0 #254 Package 3: deterministic legacy mapping & quarantine

- Branch `security/p0-254-package3-legacy-mapping-quarantine-20261122` starts from exact `main@b516d56cec7ffb21f45e9544e3cc015391071697`; implementation is offline-only and uses synthetic fixtures with an explicit reviewed row-level mapping manifest.
- Gates added by this package: deterministic classification/report hashing, input immutability, malformed-manifest fail-closed behavior, duplicate/collision quarantine, forbidden-inference checks, and static absence of Firebase/database/network imports.
- This Draft PR's own Klar Enterprise CI and Enterprise Compliance & Security Audit Gate exact-head runs: **[TO VERIFY]**. Do not transfer main-baseline Run IDs to this PR and do not chase its moving SHA with a docs-only commit.

## Immutable verified main baseline — PR #399 / P0 #254 Package 1 (2026-11-22)

PR [#399](https://github.com/Veselin-Takev/Klar-Dating/pull/399) merged into `main` at `abb3c4ebffef9efc1a4be8a2a19cac3f0c7e12e0`; previous main was `58888c8e9d970c5ca514dcb9960918a64c703491`. The pre-merge PR HEAD `e4cd968e7dc2b07b12e28bd576ace690dd1efe9b` and merge commit have identical tree SHA `5fffb9d272b3c8a124aea1ab97735294a803f51b`.

| Workflow | Exact-head Run | Result | Evidence |
|---|---:|---|---|
| Klar Enterprise CI | [#45028506636](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45028506636) | **SUCCESS** | Exact `head_sha=abb3c4ebffef9efc1a4be8a2a19cac3f0c7e12e0`; Enterprise Static Gates including profile-media boundary, Typecheck, Functions Build, Tests (**218 files / 1,691 passed / 0 failed**), `tenantContext.spec.ts` **19/19**, Build, Production Smoke and Playwright **35/35** PASS |
| Enterprise Compliance & Security Audit Gate | [#45028506610](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45028506610) | **SUCCESS** | Same exact `head_sha`; Gitleaks non-zero range **1 commit / ~97.47 KB / 0 leaks**, CLI v8.24.3 checksum OK, regression **4/4**, Tier 1 **549 packages / 0 High+**, Full Supply-Chain **1,245 packages / 0 High+**, Production Build PASS |

The Gitleaks range was `58888c8e9d970c5ca514dcb9960918a64c703491..abb3c4ebffef9efc1a4be8a2a19cac3f0c7e12e0`; the log confirms one commit scanned, approximately 97,471 bytes scanned and `no leaks found`. These results validate only this immutable main SHA. They do not prove live tenant isolation, live Cloud/IAM state, legal approval or production readiness. Preserve the previous PR #398 / `58888c8...` baseline and all historical PR #375 / #389–#399 records unchanged.

## Immutable verified main baseline — PR #397 (2026-11-22)

PR [#397](https://github.com/Veselin-Takev/Klar-Dating/pull/397) merged into `main` at `6ef75da0b6f9effb297137ad2d0b8665a4cac1a0`, with previous main parent `18dd4a3dd753bdfb01875b9aea625064eb7ecce9`. The merge tree `cced2fb91275abd0474c7209029a6aac3e4be47d` is identical to the validated PR #397 tree. This is immutable source/CI evidence for this exact SHA only.

- **Klar Enterprise CI** [run #45018481241](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45018481241) — post-merge `push`, exact `head_sha=6ef75da0b6f9effb297137ad2d0b8665a4cac1a0`, **SUCCESS**. Enterprise static gates, TypeScript, Functions build, unit tests, application build, Production Smoke and Browser Acceptance passed; **216 test files / 1,652 tests / 0 failed**; the four P0 #371 suites passed **73/73** (19 + 25 + 5 + 24); Playwright Browser Acceptance **35/35** passed.
- **Enterprise Compliance & Security Audit Gate** [run #45018481240](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45018481240) — post-merge `push`, exact `head_sha=6ef75da0b6f9effb297137ad2d0b8665a4cac1a0`, **SUCCESS**. Gitleaks scanned the non-empty one-commit range from `18dd4a3dd753bdfb01875b9aea625064eb7ecce9..6ef75da0b6f9effb297137ad2d0b8665a4cac1a0`, checked **208 rules**, and found **0 leaks**; pinned CLI **v8.24.3** official archive checksum verification passed; Gitleaks range regression **4/4** passed; Tier 1 checked **549 packages / 0 High+** and Full Supply-Chain checked **1,245 packages / 0 High+**; Production Build passed.

These runs certify only this exact `main` source baseline. They do not prove live Cloud/Scheduler/IAM/Storage configuration, real staging identity, legal approval, or production readiness. `productionApproved=false`; release remains **NO-GO**.

## Active Draft — Firebase runtime project and Storage bucket identity

- Fresh branch `security/firebase-runtime-identity-hardening-20261122` starts from exact `main@6ef75da0b6f9effb297137ad2d0b8665a4cac1a0`; it ports PR #369's three runtime files and three focused regression-test files after re-review against the current baseline. The two docs-as-code files are updated in this same change.
- Stale reference [PR #369](https://github.com/Veselin-Takev/Klar-Dating/pull/369) remains an untouched Draft reference on its old base `2fa3ba223989ff248ad1abaea67f4f454f7c9f6b` (6 commits ahead / 423 behind `main@6ef75da0b6f9effb297137ad2d0b8665a4cac1a0`); it is not rebased, pushed to, or closed. The fresh-base Draft PR supersedes it for current review.
- This branch adds fail-closed environment-ID agreement and blank-ID rejection, verifies default Admin-app project identity before reuse, rejects an unverified runtime project, includes Storage-only emulator isolation, requires an explicit cross-project bucket instead of falling back to another project's checked-in config, and rejects a conflicting pre-initialized Admin-app default bucket.
- Regression tests cover conflicting/consistent/blank project IDs, Firestore/Auth/Storage emulator demo-project selection, matching/mismatching/missing Admin project identity, named-app non-reuse, missing/cross-project/explicit Storage bucket selection, Admin default-bucket mismatch and existing isolated emulator behavior. Existing E1/E2/#371 code and tests are not modified or weakened.
- This PR's own `Klar Enterprise CI` and `Enterprise Compliance & Security Audit Gate` exact-head runs: **[TO VERIFY]**. Do not transfer the main-baseline run IDs above to this PR. Record its PR number/head SHA and completed exact-head run IDs in the PR/final handover; do not create a recursive docs-only commit for moving self-referential run IDs.
- No dependencies, lockfiles, workflows, `storage.rules`, compliance Storage route, Cloud/IAM/Firestore/Storage/bucket resources, or deployments are changed. `productionApproved=false`; production remains **NO-GO**.


## Immutable post-merge CI/Audit baseline — PR #396

Both workflows below are push-triggered runs on `main` and validate only the exact commit `18dd4a3dd753bdfb01875b9aea625064eb7ecce9`.

| Workflow | Run | Result | Exact-head evidence |
|---|---:|---|---|
| Klar Enterprise CI | [#44951316282](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44951316282) | **SUCCESS** | 216 files / 1,645 tests; profile-media E2E 22/22; Playwright Browser Acceptance 35/35; typecheck, Functions build, application build, static gates and Production Smoke PASS |
| Enterprise Compliance & Security Audit Gate | [#44951316301](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44951316301) | **SUCCESS** | Gitleaks ~88 KB / 0 leaks from `83c4e31...` to this SHA; Tier 1 production audit 549 packages / 0 High+; full supply-chain audit 1,245 packages / 0 High+; production build PASS |

The prior SHA remains historical evidence, not the current main baseline. Green CI/Audit results do not demonstrate live Cloud/Scheduler/IAM state, legal review, staging migration/revocation, or production GO.

## Code-vs-issue release reconciliation at `18dd4a3...`

- **#374 / #206:** code-complete on main via merged E1/E2 (PRs #394/#396); live migration, legacy URL/cache/token revocation evidence and independent AppSec/DPO/Legal/SRE/Release sign-offs remain **[TO VERIFY]**.
- **#373:** source-level transactional deletion barrier, publication/candidate filtering and rules guard are on main; live operational and independent compliance evidence remains **[TO VERIFY]**.
- **#202:** unsafe verification-photo upload-age purge is contained and decision-aware retention source remains fail-closed. Production endpoint retains 503 `verification_storage_purge_p0_fencing_unverified`; live Scheduler/retention execution and legal approvals remain **[TO VERIFY]**.
- **#371:** all-writer Art. 17/tombstone finalization gap; current substantive branch is `security/issue-371-account-erasure-writer-fence-20261122`. The branch is Draft and its own checks are **[TO VERIFY]**.
- **#254:** tenant isolation/legacy data migration remains an open main-branch gap; RC1-branch work does not establish main production tenant isolation.

## Verified post-merge PR #397 — Art. 17 writer fence

PR [#397](https://github.com/Veselin-Takev/Klar-Dating/pull/397) merged to `main` at `6ef75da0b6f9effb297137ad2d0b8665a4cac1a0`, with previous parent `18dd4a3dd753bdfb01875b9aea625064eb7ecce9` and merge tree `cced2fb91275abd0474c7209029a6aac3e4be47d` (identical to the validated PR tree).

- `Klar Enterprise CI` [Run #45018481241](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45018481241), exact `head_sha=6ef75da0b6f9effb297137ad2d0b8665a4cac1a0`: **SUCCESS** — 216 files / 1,652 tests / 0 failed; #371 P0 suites 73/73; Playwright 35/35; static gates, typecheck, Functions build, application build and Production Smoke PASS.
- `Enterprise Compliance & Security Audit Gate` [Run #45018481240](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45018481240), same exact `head_sha`: **SUCCESS** — non-empty one-commit Gitleaks range, 208 rules / 0 leaks, Gitleaks v8.24.3 checksum OK, regression 4/4, Tier 1 549 packages / 0 High+, Full Supply-Chain 1,245 packages / 0 High+, Production Build PASS.
- These checks validate only the merged source SHA. Live purge, retention, staging, IAM, DPO/Legal sign-off and production deployment remain unverified. `productionApproved=false`; NO-GO.


## Pinned toolchain

The application dependency workspace is `phase2_work/`.

| Tool | Required version | Source of truth |
|---|---|---|
| Node.js | `22.23.3` | `phase2_work/package.json#engines` and workflow `node-version` |
| Bun | `1.4.4` | `phase2_work/package.json#packageManager` and workflow `bun-version` |
| Java | 21 | Firebase Emulator / CI setup |

Install dependencies with `bun ci` using the committed lockfile. Do not use another Bun version or hand-edit `bun.lock`.

## Toolchain pin gate

```bash
cd phase2_work
bun run check:ci-toolchain-pins
```

The package script runs policy regression tests and `scripts/check-ci-toolchain-pins.mjs`. The checker enforces the approved immutable setup actions and exact runtime versions:
- `actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1`
- `oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6`
- Node `22.23.3`
- Bun `1.4.4`

## Immutable GitHub Actions policy

All third-party GitHub Actions in governed workflows must use a full **40-character commit SHA**. Do not use floating refs such as `@v4`, `@main` or version tags as executable references. Review upstream action source and update approved pins deliberately.

Important implementation boundary: the current `check:ci-toolchain-pins` script explicitly enforces the approved `setup-node` and `setup-bun` SHAs and Node/Bun versions. Do not assume it validates every other action pin; other action references must still be checked for full immutable SHA pins.

## Two-Tier Dependency Audit

The two-tier model is now included in `main` via the PR #384 merge commit `191ce9b64205ff1e523093cf1fa3d9a523daf0e1`, in `.github/workflows/enterprise-compliance-audit-gate.yml`. The `Enterprise Compliance & Security Audit Gate` push run on that exact `main` commit is [#44603682135](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44603682135) (**success**). The prior PR-triggered Audit Gate run [#44605420707](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44605420707) was successful on earlier PR #387 head `657aaa240018e8c400db185fba1ea757c31b8af5`, and is not evidence for the main push. This does not by itself authorize production or remove unrelated production dependency blockers.

### Tier 1 — production hard-fail

Step ID: `dep_audit`

```bash
bun audit --prod --audit-level=high
```

Any High/Critical advisory in the production dependency graph fails the workflow. This is one of the six hard-fail checks used by the PR audit comment's `overallPass`.

### Tier 2 — full supply-chain advisory

Step ID: `dep_audit_full`

```bash
if ! bun audit --audit-level=high; then
  echo "::warning title=Full Supply-Chain Audit (Dev-Dependencies)::High/Critical advisory detected in devDependencies. Review logs for upstream patch availability."
  exit 1
fi
```

This step uses `continue-on-error: true`. A failed full-graph audit is rendered as `⚠️ ADVISORY` in the PR comment; it does not change the production hard-fail gate.

### Hard-fail calculation

`overallPass` is gated only by:
1. TypeScript quality
2. Unit tests
3. Compliance/security checks
4. Gitleaks
5. Production dependency audit (`dep_audit`)
6. Production build

The full supply-chain audit is reported separately. It must remain visible, but must not be confused with a production-only vulnerability.

## Standard validation sequence

```bash
cd phase2_work
bun ci
bun run check:ci-toolchain-pins
bun run typecheck
bun run test:pure
bun run build
bun audit --prod --audit-level=high
bun audit --audit-level=high
```

A failed hard-fail check blocks the PR gate. Do not weaken the command, add an ignore/allowlist, or convert a production finding into an advisory to obtain green CI.

## Playwright emulator fixture and accessible-control rules

For REST fixture updates to an **existing** Firestore document in `demo-klar`, always pass an explicit `updateMask.fieldPaths` for every changed field. A PATCH without an update mask replaces the document fields and can silently remove authoritative `users/{uid}` values such as `isAdult` and `einwilligung`; protected API requests then correctly fail closed (the observed response was `401 / alter_fehlt`). Use no mask only when intentionally creating a new isolated fixture document. For multiple field updates, append one `updateMask.fieldPaths` query parameter per field.

Axe's zero-critical/serious CUJ scans remain strict. Form controls rendered on Profile views must have programmatically associated accessible names; for range controls and selects, use visible `label[for]` elements rather than nearby paragraph text or placeholder-only names.

**Failure evidence:** initial exact-head PR #387 run [#44602173051](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44602173051) had 30 Browser Acceptance passes and four failures. The remediation change updates existing-user emulator fixtures with field masks and adds the two missing `HapticSettings` labels. New exact-head CI results remain **[TO VERIFY]** until completed.

## Art. 17 account-deletion rate-limit transaction

The UID-scoped `account_deletion_rate_limits` transaction permits at most **three** deletion requests in a 24-hour window. When the transaction snapshot does not exist, initialize it with `tx.set(ref, { count: 1, windowStartedAt: now, expiresAt: ... })`; do not call `tx.update` on a missing document. Existing records below the limit continue through `tx.update`; an exhausted limit returns HTTP 429. Genuine Firestore transaction errors remain fail-closed with HTTP 503 and must not invoke the deletion handler.

Regression coverage: `tests/accountDeletionRateLimit.spec.ts` verifies first-request HTTP 202 and initial record creation, three permitted requests plus fourth-request HTTP 429, and HTTP 503/no erasure-handler invocation on genuine transaction failure. The Playwright CUJ `tests/e2e/cuj-account-erasure.spec.ts` retains its HTTP 202 assertion and all pending-receipt, public-profile barrier, verification-revocation and UID-scoped browser-state cleanup assertions. Do not weaken these checks.

**Earlier rate-limit failure evidence:** PR #387 / HEAD `657aaa240018e8c400db185fba1ea757c31b8af5`, [Klar Enterprise CI run #44605420683](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44605420683): 33/34 Browser Acceptance tests passed; Account-Erasure received HTTP 503 at `cuj-account-erasure.spec.ts:60` because the first-request limiter called `tx.update` on a missing document. The existence-aware transaction fix and its focused regression test are on the synchronized feature branch. The next exact-head baseline run and its response-body capture failure are recorded below.


## PR #387 response-capture follow-up — 2026-11-19

On baseline HEAD `be20a55b13f2e00f54d45f9acf566db3655daaa4`, `Klar Enterprise CI` [run #44611836293](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44611836293) failed only in Browser Acceptance (33/34): the HTTP 202 check had passed, but Playwright could not read the response body after the application navigated away. The same run's focused `tests/accountDeletionRateLimit.spec.ts` suite passed **3/3**.

The response capture now occurs inside a `page.route()` handler: `route.fetch()` retrieves the upstream response, the handler reads `status()` and `json()` before releasing it, and `route.fulfill({ response })` returns the upstream result to the browser. This is test synchronization only; it does not change the account-erasure API or remove/relax any legal-erasure barrier assertion.

Audit evidence on that same baseline HEAD: `Enterprise Compliance & Security Audit Gate` [run #44611836292](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44611836292) **SUCCESS**; Tier 1 production audit **PASS** (no High+ findings across 549 checked packages); Tier 2 full supply-chain result **ADVISORY** with one High Zod advisory `GHSA-mrhx-c7xc-m3w5`. Keep the full-graph advisory visible; do not recast it as a Tier 1 production finding or suppress it.

Exact-head `Klar Enterprise CI` and `Enterprise Compliance & Security Audit Gate` results for this response-capture commit: **[TO VERIFY]** until both triggered workflows complete. All new run IDs and conclusions must be tied to this exact new HEAD.

## PR evidence rules

- Validate the exact PR HEAD SHA, not a parent or earlier commit.
- Record workflow name, run ID, conclusion and HEAD SHA.
- A skipped step is not PASS; missing CI evidence is `[TO VERIFY]`.
- Draft PRs are not merge-authorized.
- Successful CI is not independent security review or production approval.

## Hermetic Playwright Browser Acceptance and CUJ gates

The canonical Playwright configuration is `phase2_work/playwright.config.ts`:

- `testDir: './tests/e2e'` means every `*.spec.ts` in `phase2_work/tests/e2e/` is discovered automatically.
- CI uses one Chromium worker, zero retries and a 15-minute global suite timeout. Tests should use role/test-id locators and web-first assertions; fixed `waitForTimeout()` sleeps are not an accepted synchronization strategy.
- The Playwright web server starts `npm run dev:lokal`. That script invokes `firebase emulators:exec --project demo-klar --only auth,firestore,storage`; emulator endpoints are loopback-only (Auth 9099, Firestore 8080, Storage 9199).
- `.github/workflows/ci.yml` runs `bun run playwright test` in the existing **Browser acceptance** step after installing Chromium. The new CUJ specs are picked up by the existing `testDir`; no new live service, secret or production workflow dependency is introduced.
- `bun run test:production` invokes `scripts/smoke-production.mjs`, which explicitly refuses to run without Auth and Firestore emulator host variables and starts the built server locally. Its name does not authorize or imply a live production call.

New Playwright specs:
- `tests/e2e/cuj-onboarding-consent.spec.ts`
- `tests/e2e/cuj-daily-quota.spec.ts`
- `tests/e2e/cuj-icebreaker-verification.spec.ts`
- `tests/e2e/cuj-account-erasure.spec.ts`
- `tests/e2e/cuj-accessibility.spec.ts`

The fixtures use the local `demo-klar` Emulator REST endpoints and test-only accounts/documents. The account-erasure UI test asserts the server-accepted pending request, discoverability barrier and browser UID-namespace cleanup; it does not claim that the asynchronous worker completed every provider/Firestore/Storage deletion.

**Verified baseline evidence on PR #387 HEAD `be20a55b13f2e00f54d45f9acf566db3655daaa4`:** `Klar Enterprise CI` [run #44611836293](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44611836293) completed **FAILURE** because Browser Acceptance was 33/34: the HTTP 202 assertion passed, but `response.json()` at `cuj-account-erasure.spec.ts:61` ran after navigation and Chromium no longer exposed the body. The `tests/accountDeletionRateLimit.spec.ts` suite was **3/3 PASS**. The `Enterprise Compliance & Security Audit Gate` [run #44611836292](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44611836292) was **SUCCESS**: Tier 1 production audit **PASS** (no High+ findings across 549 checked packages); Tier 2 full dependency graph **ADVISORY** with one High Zod advisory `GHSA-mrhx-c7xc-m3w5`. This Tier 2 advisory remains visible and is not represented as a Tier 1 production finding. The response-capture change in this commit preserves the mandatory HTTP 202, receipt and all immediate Art. 17 barrier assertions. New exact-head workflows for this response-capture commit: **[TO VERIFY]** until completed.


## PR #387 — disposed route response correction (2026-11-19)

On exact PR HEAD `9a741c8188cfabfbf453d7d817504d74e5d19cb6`, `Klar Enterprise CI` [run #44616052807](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44616052807) completed **FAILURE**: 33/34 Browser Acceptance tests passed. The exact failing test was `tests/e2e/cuj-account-erasure.spec.ts:22`; the failing handler operation was `response.json()` at line 65. Diagnostic artifact [`browser-diagnostics-44616052807-1`](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44616052807) (artifact ID `14576445383`) records `apiResponse.json: Response has been disposed`. This disposed `route.fetch()` APIResponse prevented status/receipt capture; `deletionStatus` stayed undefined, so the strict HTTP-202 assertion failed at line 70. The test did not progress to receipt or downstream erasure-barrier assertions in this run.

The correction uses the test fixture's independent `APIRequestContext` to replay the intercepted request with its original method, URL, body and authentication/cookie headers. It reads the response body and status from that independent context, parses the receipt, then fulfills the paused browser route using the captured status, sanitized response headers and raw body bytes. This prevents the page's post-deletion navigation from disposing the captured response. It changes only test transport/synchronization; it does not weaken or remove any Art. 17 assertion. The HTTP 202, pending receipt/requestId, pending deletion record, public-profile 404, `isVerified=false`, UID-scoped localStorage cleanup and global-theme preservation assertions remain mandatory. No fixed sleep was introduced.

Audit Gate [run #44616052794](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44616052794), on the same HEAD, completed **SUCCESS**. The hard-fail checks passed; the full dependency graph audit remains **ADVISORY** and must be reported separately. Newly triggered exact-head CI for this correction: **[TO VERIFY]** until completion; record the new run IDs and conclusions against the resulting HEAD only. PR #387 remains open/Draft/unmerged and `productionApproved=false`.


## PR #387 — capture-promise synchronization correction (2026-11-19)

On PR #387 exact HEAD `4569b8ac1a82612154cfe2a556cf97b242e5f778`:

- [Klar Enterprise CI #44618445371](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44618445371): **FAILURE**, Browser Acceptance 33/34. Artifact `browser-diagnostics-44618445371-1`, ID `14576717329`. The failing test clicked the final account-delete button and immediately asserted the status variable without awaiting the asynchronous route handler. It observed `undefined`; teardown disposed the APIRequestContext while `request.fetch()` was still pending, producing `Request context disposed`. This is a test synchronization failure; downstream Art. 17 assertions were not reached in that run.
- [Enterprise Compliance & Security Audit Gate #44618446075](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44618446075): **SUCCESS**. Tier 1 production audit **PASS** (no High+ findings across 549 packages). Tier 2 full dependency graph **ADVISORY**, one High Zod advisory `GHSA-mrhx-c7xc-m3w5`.

The correction creates a typed `capturePromise` before registering the route. The route resolves it only after obtaining upstream status and parsing the JSON receipt; it rejects on fetch/body/JSON failure and aborts the intercepted browser route. The test awaits capture and click together with `Promise.all`, performs the strict HTTP-202 and receipt/requestId checks only after capture has completed, and unregisters the route using `page.unroute(deletionRoute)`. The complete set of Art. 17 assertions is retained: HTTP 202, receipt/requestId, pending deletion record, public-profile 404, `isVerified=false`, UID-scoped storage cleanup and global-theme preservation. No `waitForTimeout()` was added.

New exact-head CI runs for this correction: **[TO VERIFY]** until completed; attach their run IDs and conclusions to the new commit only. PR #387 remains Open/Draft/Unmerged. `productionApproved=false`.


## PR #382 — TypeScript import correction and exact-head workflow evidence (2026-11-19)

### Previous failing run

On PR #382 HEAD `4e203ee7383cd954003db0f4b2609b7e86ac85e9`, `Klar Enterprise CI` [run #44623218511](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44623218511) completed **FAILURE** at Typecheck:

```text
tests/accountErasure.spec.ts(150,85): error TS2552:
Cannot find name 'DeletionStoragePageComplete'.
Did you mean 'DeletionPageComplete'?
```

The later Functions build, Tests, Build, Production smoke and Browser acceptance steps were skipped. Consequently this run did not execute Playwright Browser Acceptance and did not establish 34/34.

### TypeScript fix

`src/server/deletionProgress.ts` exports both `DeletionPageComplete` and `DeletionStoragePageComplete`. The latter is the exact sentinel thrown by the Storage pagination path in `trustAndSafety.ts`, and the existing `tests/deletionLifecycle.spec.ts` imports it from the same module. `tests/accountErasure.spec.ts` used it in an `instanceof` assertion but imported only `DeletionPageComplete`. The correction adds `DeletionStoragePageComplete` to that existing named import. It does not replace the assertion, widen a type, suppress an error, change a TypeScript setting, or alter any `tsconfig` project.

### Enterprise Compliance & Security Audit Gate trigger scope

The checked-in `.github/workflows/enterprise-compliance-audit-gate.yml` declares:

- `pull_request: branches: [main]`
- `push: branches: [main, 'release/*']`
- `workflow_dispatch`

A stacked PR targeting `security/issue-374-client-media-cutover-20261118` does not match the `pull_request` base-branch filter and therefore does not receive an automatic audit run from that event. To produce exact-HEAD audit evidence for PR #382, manually dispatch **Enterprise Compliance & Security Audit Gate** with the intended Package C feature-branch ref after the fix is pushed, then verify the run's `head_sha` equals the live PR HEAD. A result for a parent or earlier SHA is not evidence for the new HEAD. No manual dispatch is performed as part of this commit/push task.

### New exact-head evidence

- `Klar Enterprise CI`: [run #44624709849](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44624709849) completed **SUCCESS** on exact HEAD `02de612e6b34a4078ed958e7cf482f558efb75cc`; Typecheck, Functions build, Tests, Build, Production Smoke and Browser Acceptance passed, with **34/34 Playwright tests**.
- `Enterprise Compliance & Security Audit Gate`: manual Run [#44629915925](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44629915925), `workflow_dispatch`, exact HEAD `02de612e6b34a4078ed958e7cf482f558efb75cc`, completed **FAILURE** at Gitleaks. Tier 1 Production Runtime Audit was skipped and is **not PASS**; follow-up on the new remediation HEAD remains **[TO VERIFY]** pending another exact-HEAD manual dispatch.

`productionApproved=false` remains mandatory. PR #382 stays open/Draft/unmerged. PR #383 and `main` are not modified. No cloud/IAM/deployment mutations are performed.

## PR #382 — manual Audit Gate Run #17: Gitleaks history findings and remediation (2026-11-19)

### Exact failure

PR #382 HEAD `02de612e6b34a4078ed958e7cf482f558efb75cc`, manual `workflow_dispatch` [Enterprise Compliance & Security Audit Gate Run #17 / ID 44629915925](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44629915925): **FAILURE**. The failed job was `Enterprise Compliance & Security Audit`; the failing step was **Gitleaks**, step 9, running Gitleaks 8.24.3. The log states that no `.gitleaks.toml` was present and the default Gitleaks rules were used. The scan examined 3,706 commits and reported **18 findings**; artifact `gitleaks-results.sarif.zip`, ID `14580783462`, was uploaded.

Earlier steps in that same job — Quality / TypeScript, Unit Tests and Compliance & Security Checks — completed **SUCCESS**. Because Gitleaks is a hard-fail step, the Tier 1 production runtime dependency audit (`bun audit --prod --audit-level=high`) and Production Build were **SKIPPED**. Therefore Run #17 has no Tier 1 PASS. The separate full dependency audit ran as advisory and reported High Zod `GHSA-mrhx-c7xc-m3w5`; that advisory was not the cause of the job failure.

### Finding classification and fix

The 18 findings were traced to their exact historical source commits and lines. They resolve to (a) SHA-256 integrity digests in two security evidence JSON files, (b) documentation/reference text in three Markdown records, (c) synthetic test fixture values for lease tokens, HMAC/consent secrets and an AdMob public-key parser, and (d) the Firebase web-app `apiKey` field in two historical app-config paths. Firebase documents Firebase web API keys as public project/app identifiers rather than authorization secrets; actual cloud API restrictions were not live-checked or mutated. The exact paths, commits, rule IDs and line numbers are recorded as fingerprints in the root `.gitleaksignore`, without copying any candidate secret values into the repository documentation.

The remediation adds **18 exact historical fingerprints** to `.gitleaksignore`. Gitleaks continues using its default built-in rules and full Git history scan; the ignore file matches only the exact historical fingerprint (commit + path + rule + line). There are no path-wide, rule-wide, regex-wide, or commit-wide exclusions. A new occurrence, changed line, new commit, or any other finding remains subject to the unmodified hard-fail Gitleaks step. This uses the supported exact-finding fingerprint ignore mechanism and does not change scanner rules or configuration.

### Exact-HEAD validation after remediation

- `Klar Enterprise CI`: newly triggered by the remediation commit; run ID and final conclusion **[TO VERIFY]** until completion. Do not infer Typecheck, Tests, Build, Production Smoke or Browser Acceptance PASS.
- `Enterprise Compliance & Security Audit Gate`: stacked PR #382 does not match the workflow `pull_request` base filter (`main`); exact-HEAD audit requires `workflow_dispatch` with the Package C branch ref. The new manual run and Tier 1 result remain **[TO VERIFY]** until dispatched and its `head_sha` is verified.

Historical snapshot from 2026-11-19 during PR #382 remediation: PR #382 was then open/Draft/unmerged. PR #382 and PR #383 were subsequently merged on 2026-11-20; see the consolidated Issue #374 section below for the final merge SHAs and integration evidence. `productionApproved=false` remains mandatory. No cloud/IAM/deployment mutation was performed.

## Issue #374 — consolidated Package C + Package D integration validation (2026-11-20)

### Merge and branch evidence

GitHub confirms the upstream dependency PRs are merged: #381 → 5d6f2e9972111d23d64f1df4af43f0ac475fdfd3, #382 → 30690f549f7eac1b925076b1227ee5508845eae0, and #383 → 1b30ea60dc9acab31020533fd55ba1cf69feaf33. Their prior open/Draft status statements in earlier entries are historical snapshots and are superseded by this section.

On security/issue-374-client-media-cutover-20261118, standard git merge --no-edit origin/security/issue-374-package-c-upload-cutover-20261118 merged source HEAD 1b30ea60dc9acab31020533fd55ba1cf69feaf33 into pre-merge integration HEAD 30690f549f7eac1b925076b1227ee5508845eae0. The resulting no-conflict ort merge commit is 0d9a058d90de148c62f8f89c4d7fb0d97054ad2d, with parents 30690f549f7eac1b925076b1227ee5508845eae0 and 1b30ea60dc9acab31020533fd55ba1cf69feaf33. It adds the four Package D security documents (815 lines total): ISSUE_374_ENTERPRISE_REVIEW_DOSSIER.md, ISSUE_374_EXECUTIVE_SUMMARY.md, ISSUE_374_RELEASE_TRACKING.md, and PACKAGE_D_MIGRATION_AND_REVOCATION_PLAN.md under phase2_work/docs/security/.

At consolidation, main was 13cce96660ba4a35d54c222e9eeae2e31f260863. git rev-list --left-right --count origin/main...HEAD returned 0 47: integration is 0 behind main and 47 commits ahead.

### Toolchain and local gate results

- Node.js 22.23.3; Bun 1.4.4 (both match the repository pins).
- bun install --frozen-lockfile: PASS, 1,331 packages installed; no lockfile edit.
- bun audit --prod --audit-level=high: PASS — no High/Critical vulnerabilities in 549 checked production packages; 3 findings below the configured threshold.
- bun run typecheck: [TO VERIFY], not PASS. The first attempt hit Node/V8 heap OOM at the default heap cap; the 640-MB retry did not complete within the 180-second sandbox command limit while using a 976-MiB memory environment. No code diagnostic was captured. Hosted CI on the new PR HEAD must provide the complete Typecheck result.

### Historical workflow results (exact earlier SHAs only)

- PR #381 Klar Enterprise CI Run #2144 / ID 44293821811, exact SHA 3befc46251559dc4965a2c9a7ccfe808af49827d: SUCCESS, Browser Acceptance 26/26.
- PR #383 Klar Enterprise CI Run #2151 / ID 44312127379, exact SHA 998b6ecb2b90bf5d3d3af04108637d175544fc82: SUCCESS, Browser Acceptance 26/26.
- PR #382 Package C Klar Enterprise CI Run #44631763988 and manual Enterprise Compliance & Security Audit Gate Run #44632518985, both exact SHA 7c94b290bea41e27059d277d9f7299d5f57b5f6b: SUCCESS. CI Browser Acceptance 34/34. Audit Gate Gitleaks PASS, Tier 1 Production Runtime Audit PASS (549 packages, no High+ findings); Tier 2 full dependency audit remains advisory with the existing Zod advisory. These earlier SHA results do not certify the consolidation merge commit.

### New Draft PR targeting main — automatic trigger expectations

Draft PR #388 is open against main and must remain Draft/unmerged. .github/workflows/ci.yml declares pull_request without a base-branch filter; .github/workflows/enterprise-compliance-audit-gate.yml restricts its pull_request trigger to branches: [main]. Both workflows therefore triggered automatically for PR #388. On its initial PR HEAD 60fb53160630c1850e4ee9a4b2ed41adb6d8c673, Klar Enterprise CI Run #2184 / ID 44701180440 completed SUCCESS (Typecheck, Tests: 1,583 passed, Build, Production Smoke, Browser Acceptance: 34/34). Audit Gate Run #19 / ID 44701180377 completed SUCCESS, with Gitleaks no leaks and Tier 1 no High/Critical production vulnerabilities across 549 packages; Tier 2 continued to report the existing High Zod advisory GHSA-mrhx-c7xc-m3w5. This additional documentation correction updates the PR HEAD, so fresh runs are required and must be matched to the new head_sha; the new exact-head run IDs and outcomes remain [TO VERIFY]. No manual workflow_dispatch is needed for the main-targeted PR.

- Klar Enterprise CI exact new PR HEAD run ID/conclusion and Typecheck, Tests, Build, Production Smoke and Browser Acceptance: [TO VERIFY] pending workflow completion.
- Enterprise Compliance & Security Audit Gate exact new PR HEAD run ID/conclusion, Gitleaks and Tier 1 Production Runtime Audit: [TO VERIFY] pending workflow completion.

productionApproved=false is unchanged. This branch consolidation performs no live cloud/IAM/Firestore/Storage or deployment operation and does not edit main.


## PR #388 merge baseline and CUJ-4 route teardown (2026-11-20)

### Post-merge `main` evidence

- PR [#388](https://github.com/Veselin-Takev/Klar-Dating/pull/388) merge SHA: `06d193e054651e74736bf7a0a6911bf954a20b84`.
- Current `main` HEAD: `06d193e054651e74736bf7a0a6911bf954a20b84` (exact match with the merge SHA).
- `Enterprise Compliance & Security Audit Gate` [Run #22 / ID 44711489596](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44711489596), exact HEAD `06d193e054651e74736bf7a0a6911bf954a20b84`: **SUCCESS**. Gitleaks: **PASS** (`no leaks found`). Tier 1 production runtime dependency audit: **PASS** (549 packages checked; no vulnerabilities at High or above; 3 findings below configured --audit-level=high). Full supply-chain audit step also completed successfully in this run.
- `Klar Enterprise CI` [Run #2187 / ID 44711489858](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44711489858), exact HEAD `06d193e054651e74736bf7a0a6911bf954a20b84`: **FAILURE**. Browser Acceptance: **33 passed / 1 failed**. The sole failure was CUJ-1 `cuj-onboarding-consent.spec.ts:29`: expected `Einwilligung wurde erteilt.`, received `Die Änderung konnte nicht bestätigt werden. Bitte erneut versuchen.` although the grant request had returned HTTP 200. Typecheck, Functions build, Tests (1,583 passed), Build and Production Smoke were PASS. Therefore post-merge Browser Acceptance was not 34/34.

### Run #2180 CUJ-4 failure diagnosis

On prior `main` HEAD `13cce96660ba4a35d54c222e9eeae2e31f260863`, `Klar Enterprise CI` [Run #2180 / ID 44622876559](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44622876559) completed Typecheck, Functions build, Tests, Build and Production Smoke successfully, but Browser Acceptance failed at `phase2_work/tests/e2e/cuj-account-erasure.spec.ts:109`: `page.unroute: Test timeout of 60000ms exceeded`.

The route handler resolves `capturePromise` once it has read the upstream status and parsed the receipt, then continues to `await route.fulfill(...)`. Capture completion can therefore race ahead of route-handler completion. Calling default `page.unroute(deletionRoute)` immediately after `Promise.all([capturePromise, click])` may wait for the still-active route callback; the observed failure is the 60-second timeout at that teardown line. It prevented the test from reaching the later Art. 17 checks.

### Deterministic route cleanup change

The hardening branch `fix/e2e-cuj4-unroute-flake-and-handover-docs` is based on verified merge/main SHA `06d193e054651e74736bf7a0a6911bf954a20b84`. It removes the pre-assertion `page.unroute(deletionRoute)` and calls `page.unrouteAll({ behavior: 'ignoreErrors' })` only after successful completion of every existing Art. 17 assertion: HTTP 202, pending receipt and requestId, pending deletion record, public-profile 404, verification revocation (`isVerified=false`), UID-scoped localStorage removal and global theme preservation. No assertion is weakened or deleted, accessibility gates are untouched, and no fixed `waitForTimeout()` is introduced.

On initial PR #389 HEAD `ddfb358d3d955524b4a3215e01c336ee975429f3`: `Klar Enterprise CI` Run #2188 / ID `44712275292` was **[TO VERIFY] / in progress** at this snapshot. `Enterprise Compliance & Security Audit Gate` Run #23 / ID `44712275190` completed **SUCCESS**: Gitleaks reported `no leaks found`; Tier 1 checked 549 production packages and found no High+ vulnerabilities. This Docs-as-Code follow-up creates a new PR HEAD; the exact-head CI and Audit Gate results for that new commit remain **[TO VERIFY]** until completed. `productionApproved=false` remains mandatory; no cloud, IAM, Firestore, Storage or deployment mutation is part of this work.

## Historical main baseline after PR #389 — UX / Accessibility / i18n work (2026-11-20)

- Historical baseline commit: PR #389 merge SHA `24a57615544f6a190e5a76900d49b65646a320b9`; preceding PR #388 merge point `06d193e054651e74736bf7a0a6911bf954a20b84`. This historical baseline was superseded by PR #390 merge SHA `8352eeec82325f9a9bd3a0b2dcf90a5e33ac53ee`.
- `Klar Enterprise CI` [Run #44717268425](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44717268425), exact SHA `24a57615544f6a190e5a76900d49b65646a320b9`: **SUCCESS**. Typecheck, Functions build, Tests (1,583 passed / 206 files), Build, Production Smoke and Browser Acceptance **34/34** passed. The configured `tests/e2e` suite includes CUJ-1 `cuj-onboarding-consent.spec.ts` and CUJ-4 `cuj-account-erasure.spec.ts`.
- `Enterprise Compliance & Security Audit Gate` [Run #44717268456](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44717268456), same exact SHA: **SUCCESS**. Gitleaks **PASS** (`no leaks found`); Tier 1 Production Runtime Audit **PASS** (549 packages, no High+ vulnerabilities); Production Build **PASS**.
- Full supply-chain advisory: existing High Zod dev-dependency finding `GHSA-mrhx-c7xc-m3w5`. It remains an advisory-only dependency follow-up. Do not modify packages or lockfiles in this workstream.
- New branch `feat/ux-a11y-i18n-audit-and-governance-polish` is based directly on `24a57615544f6a190e5a76900d49b65646a320b9`. Its Draft PR's own Enterprise CI and Audit Gate Run IDs/conclusions remain **[TO VERIFY]** until verified against the final PR `head_sha`.
- Anti-SHA-Chasing: preserve completed baseline Run IDs as immutable evidence. Do not make a self-referencing docs-only commit just to add the active PR's own Run IDs; report those IDs in the PR/final handover when available, without changing the validated HEAD.
- Release authorization remains **NO-GO**; `productionApproved=false`.

## Historical post-PR #390 main baseline and Zod remediation handover (2026-11-20)

### Current main HEAD and immutable workflow evidence

- PR #390 merged into `main`; verified merge SHA and `main` HEAD: `8352eeec82325f9a9bd3a0b2dcf90a5e33ac53ee`.
- Historical PR #389 baseline `24a57615544f6a190e5a76900d49b65646a320b9` and its exact-head Run #44717268425 / #44717268456 evidence remain recorded in the historical section above; those results are not transferred to the newer SHA.
- `Klar Enterprise CI` [Run #44739816147](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44739816147), exact SHA `8352eeec82325f9a9bd3a0b2dcf90a5e33ac53ee`: **SUCCESS**. Static Gates, Typecheck, Functions Build, Tests (**1,595 passed / 209 files / 0 failed**), Build, Production Smoke and Browser Acceptance (**35/35**) passed.
- `Enterprise Compliance & Security Audit Gate` [Run #44739816099](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44739816099), same exact SHA: **SUCCESS**. Tier 1 Production Runtime Audit **PASS** (549 packages; no High+ runtime vulnerabilities). The post-merge Gitleaks step reported no leaks but scanned `0 commits` in its merge-event range. Pre-merge PR #390 Audit Gate [Run #44737576769](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44737576769) scanned 30 commits / approximately 45.62 KB cleanly (`no leaks found`) on PR HEAD `1a97eadd4d6094b7f95324078d598e15fb49c5e5`.
- The full supply-chain audit on this baseline still reports High Zod advisory `GHSA-mrhx-c7xc-m3w5` in the Dev-inclusive graph; it is separate from Tier 1 and must remain visible until fixed and re-audited.

### Isolated Zod dependency remediation — active Draft PR workstream

- Branch `security/remediate-zod-advisory-ghsa-mrhx-c7xc-m3w5` starts at verified main SHA `8352eeec82325f9a9bd3a0b2dcf90a5e33ac53ee`. Dependency commit: `bdd4f68287fa56b47c77d8cc773a07becd28d3e9` (direct parent = exact main SHA).
- `phase2_work/package.json` declares Puppeteer `^25.18.1`; `phase2_work/bun.lock` resolves Puppeteer and Puppeteer Core `25.18.1`, `chromium-bidi@157.0.8090-0` with Zod range `^4.6.5`, and retains direct Zod `4.6.6`. The vulnerable prior nested mapping `chromium-bidi/zod -> zod@3.25.76` is removed. The MCP SDK allows Zod `^3.25 || ^4.0`; no global Zod override or audit suppression was added.
- The branch was submitted as Draft PR [#391](https://github.com/Veselin-Takev/Klar-Dating/pull/391), final PR HEAD 622ae73514ba212caec8397600b821648558680d. PR #391 is now merged into main at 2f9a4349df652ee32246f29d1291c11136a8a769; its post-merge exact-main evidence is documented in the current baseline section below.
- PR #391 exact-head validation: Klar Enterprise CI [Run #44745959136](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44745959136) **SUCCESS** (1,595 tests / 209 files; Browser Acceptance 35/35); Enterprise Compliance & Security Audit Gate [Run #44745959150](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44745959150) **SUCCESS** (Gitleaks scanned 2 commits / approximately 11.01 KB with no leaks; Tier 1 549 packages and full supply chain 1,245 packages with no High+ findings). The full resolved graph no longer reports GHSA-mrhx-c7xc-m3w5. These PR-head results are not transferred to the merge SHA; post-merge evidence is listed separately below.
- Preserve `bun audit --prod --audit-level=high` as a hard-fail Tier 1 gate. Preserve the Dev-inclusive `bun audit --audit-level=high` advisory reporting; do not ignore, suppress, or weaken either check.
- `productionApproved=false` remains mandatory. No merge to `main`, cloud, IAM, Firestore, Storage or deployment mutation is authorized or performed by this workstream.


## Verified MAIN_BASELINE_GREEN — post-PR #391 main baseline (2026-11-20)

- PR #391 merged into main; exact merge SHA and verified live main HEAD: 2f9a4349df652ee32246f29d1291c11136a8a769. This supersedes the PR #390 baseline 8352eeec82325f9a9bd3a0b2dcf90a5e33ac53ee; retain the PR #390 and PR #389 run evidence above as immutable historical records for their own SHAs.
- Klar Enterprise CI [Run #44747921722](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44747921722), exact SHA 2f9a4349df652ee32246f29d1291c11136a8a769: **SUCCESS**. Enterprise Static Gates, Typecheck, Functions Build, Tests (1,595 passed / 209 files / 0 failed), Build, Production Smoke, and Browser Acceptance (35/35 passed / 0 failed) all passed.
- Enterprise Compliance & Security Audit Gate [Run #44747921914](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44747921914), same exact SHA: **SUCCESS**. Gitleaks reported no leaks; Tier 1 Production Runtime Audit **PASS** (549 packages, 0 High+); Full Supply-Chain Audit **PASS** (1,245 packages, 0 High+). The full dependency graph retains seven findings below the configured High threshold and the production runtime graph three below that threshold. GHSA-mrhx-c7xc-m3w5 is cleared from the resolved graph.
- Gitleaks coverage caveat: the post-merge push-event scan used --no-merges --first-parent and logged 0 commits scanned. Actual PR #391 content was scanned in pre-merge exact-head Audit Gate [Run #44745959150](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44745959150): 2 commits / approximately 11.01 KB, no leaks. Do not overstate the post-merge scan's coverage.
- productionApproved=false and release NO-GO remain mandatory.

## GitHub Actions Node 24 maintenance — active Draft workstream

- Base: main at 2f9a4349df652ee32246f29d1291c11136a8a769; branch: chore/ci-actions-node24-maintenance.
- Only .github/workflows/enterprise-compliance-audit-gate.yml needs changes for the two identified Node 20 actions. gitleaks/gitleaks-action changes from ff98106e4c7b2bc287b24eaf42907196329070c7 to e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e (v3.0.0, runs.using: node24); actions/github-script changes from f28e40c7f34bde8b3046d885e986cb6290c5673b to 3a2844b7e9c422d3c10d287c895573f7108da1b3 (v9.0.0, runs.using: node24). Both are pinned to exact 40-character commit SHAs with release comments.
- The existing github-script source uses github and context; it does not require @actions/github via CommonJS or redeclare getOctokit, the v9 migration hazards. No inputs, permissions, security controls, audit commands, CI gates, app dependencies, or lockfiles are altered. All other workflow references remain full-SHA pins.
- New Draft PR final HEAD, exact-head CI and Audit Gate Run IDs/status/conclusions, and confirmation that GitHub Actions logs no longer emit a Node 20 deprecation warning: **[TO VERIFY]** pending hosted validation. Follow AGENTS.md Anti-SHA-Chasing: report exact Run IDs in final handover/PR metadata; do not create a self-referential docs-only follow-up commit.


## Verified post-PR #392 main baseline — 2026-11-20

- Verified main HEAD / PR #392 merge commit: `e1eac9ffefbb70d376cbcc72b735c8c3901e37d3`. The previous #391 HEAD `2f9a4349df652ee32246f29d1291c11136a8a769` remains historical; earlier #389/#390/#391 evidence is preserved above.
- Klar Enterprise CI [Run #2221 / ID 44806101342](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44806101342), exact head_sha `e1eac9ffefbb70d376cbcc72b735c8c3901e37d3`: SUCCESS — 1,595/1,595 tests, 209 files, Production Smoke PASS, Browser Acceptance 35/35 PASS.
- Enterprise Compliance & Security Audit Gate [Run #56 / ID 44806101226](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44806101226), same exact head_sha: SUCCESS — Gitleaks v3.0.0 step PASS; Tier 1 production runtime audit PASS (549 packages, 0 High+); Full Supply-Chain Audit PASS (1,245 packages, 0 High+).
- Post-merge Gitleaks coverage caveat: the push-event range reported 0 commits scanned due to --no-merges --first-parent; exact pre-merge PR #392 Audit Gate [Run #55 / ID 44758491336](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44758491336), source HEAD `b6064a89bea4e6cb455669179c5785ef25fde3f3`, scanned 2 commits and reported no leaks.
- The merged workflow uses immutable full-SHA pins for Gitleaks v3.0.0 and GitHub Script v9.0.0 / Node 24. No Node.js 20 Action runtime warnings appeared post-merge. Separate Node API deprecation warnings DEP0040 and DEP0169 remain distinct from Action-runner warnings.

### Active Draft PR — profile i18n migration

- Feature branch feat/profile-i18n-migration is based on exact main baseline `e1eac9ffefbb70d376cbcc72b735c8c3901e37d3`, targeting main; PR must remain Draft and unmerged.
- Profile screen and embedded profile subcomponents/flows now have **257 profile-flow leaf keys per locale** across DE/EN/ES/FR, with identical key sets and matching interpolation placeholders. Deterministic translation and feedback accessible-name tests are included.
- This active PR's own Enterprise CI and Audit Gate exact-head Run IDs/status/conclusions are [TO VERIFY] until those workflows complete. Runs #2221 and #56 certify only main SHA `e1eac9ff...`.
- No dependency, lockfile or workflow changes. No existing Art. 17 erasure, Consent, Accessibility or E2E assertions are removed or weakened.
- Anti-SHA-Chasing: record this PR's completed exact-head Run IDs in the PR/final handover; no recursive docs-only commit to chase this PR's moving SHA.
- Preserve productionApproved=false; a passing CI does not authorize a production release.

## Verified main baseline — PR #393 merge (2026-11-21)

- Exact current `main` HEAD: `b2ae22fab32d1cb017c82116769e1d372bd384b0`. This entry supersedes the prior #392 baseline; historical PR #389–#392 run records above remain immutable and are not re-labelled.
- `Klar Enterprise CI` [Run #44822376842](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44822376842), exact `head_sha` `b2ae22fab32d1cb017c82116769e1d372bd384b0`: **SUCCESS**. Unit Tests: **1,603 passed / 210 files**; Production Smoke passed; Browser Acceptance **35/35 passed**. TypeScript, Functions build and Production Build passed.
- `Enterprise Compliance & Security Audit Gate` [Run #44822377108](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44822377108), exact same `head_sha`: **SUCCESS**. Gitleaks reported **no leaks found**; Tier 1 production runtime audit checked **549 packages / 0 High+**; full supply-chain audit checked **1,245 packages / 0 High+**; Production Build passed. Below-threshold advisory counts were 3 (runtime) and 7 (full dependency graph).
- The Audit Gate log records a non-empty Gitleaks commit range from `5291b9fb8eb6c3afa94fa6566e5818726b850db9^..b2ae22fab32d1cb017c82116769e1d372bd384b0` and `no leaks found`. This is distinct from earlier merge-event runs whose `--no-merges --first-parent` range scanned zero commits.
- Exact run-to-SHA association is mandatory: these results certify only `b2ae22fab32d1cb017c82116769e1d372bd384b0`, not PR #375 or any later SHA. `productionApproved=false` remains unchanged; green CI is not production authorization.

## P0 Issue #373 — canonical Draft PR #375 acceptance and pending gates

- Canonical branch: `security/iteration2-p0-privacy-2026-11-16`; target `main`; keep PR [#375](https://github.com/Veselin-Takev/Klar-Dating/pull/375) **Draft / unmerged**. No parallel PR.
- `profileRecommendations.ts`: publication reads the user document and erasure barrier in one Firestore transaction and only writes the public projection if the barrier does not exist. Firestore retries on contention; the retry path re-reads the barrier and rejects publication after concurrent deletion wins.
- `firestore.rules`: direct reads of `public_profiles/{userId}` are denied when the target `account_deletions/{userId}` document exists; existing authentication, Guest, requester/target Adult and bilateral Block checks remain intact.
- `profileRecommendationsEndpoint.spec.ts`: 27 expanded endpoint cases after four added requester-state regressions (missing user document plus persisted `blocked`, `suspended`, `deleted` states), alongside active/missing erasure-barrier behavior, deletion-on-transaction-retry, profile publish validation and preserved main GET requester protections.
- `rules.spec.ts`: the Rules Emulator test seeds an existing target public-profile projection, creates the erasure marker, then asserts the direct read fails. The test also leaves the guest and bilateral-block regressions intact.
- PR #375's own `Klar Enterprise CI`, Rules Emulator results, and `Enterprise Compliance & Security Audit Gate` for the final head remain **[TO VERIFY]** until exact `head_sha` workflow runs complete. Baseline Runs #44822376842 and #44822377108 above do not validate PR #375.
- No dependencies, lockfiles or workflow files are in scope. Do not create a recursive docs-only commit merely to record PR #375's own moving Run IDs; record exact IDs and head SHA in the final/PR handover once observed, per `AGENTS.md` Anti-SHA-Chasing.
- Preserve all P0/P1 and operational blockers listed in `docs/HANDOVER_STATUS.md`; PR #375 only addresses the #373 publish/read erasure race. No cloud, IAM, Firestore, Storage or deployment mutation is authorized or performed.

## Historical pre-merge main baseline for E1 — 2026-11-21

- Exact `main` HEAD: `30250a1fc82f24834c7ada62f8453df04af20f2a`.
- `Klar Enterprise CI` [Run #44879246458](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44879246458): **210 test files / 35 of 35 Playwright checks PASS** on the stated baseline.
- `Enterprise Compliance & Security Audit Gate` [Run #44879246487](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44879246487): **0 High+ / Build PASS** on the stated baseline.
- Pre-merge tree-equivalent Gitleaks [Run #44878055568](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44878055568): **16.50 KB / 0 leaks**.
- These three results are tied to this immutable main baseline; they do not certify a later PR commit. Historical PR #389–#393 records and PR #375 evidence above remain unchanged.
- Historical state at this pre-merge baseline: E1 PR [#394](https://github.com/Veselin-Takev/Klar-Dating/pull/394) was Draft / unmerged and its own exact-head checks were **[TO VERIFY]** at that time. The PR was subsequently merged at `7389e57a11e4a5e3e384cbfc6992345453a5dcaa`; see the post-merge baseline below.
- Static guard command `npm run check:profile-media-boundary` is included in `check:enterprise`; it asserts that profile direct Storage reads remain denied, protected profile photos are not rendered from direct `img src` URLs, profile download-token URLs are not persisted, request URL diagnostics are redacted, and active Helmet applies `no-referrer`.
- E1 excludes migration and token-revocation executables. Those are reserved for follow-up E2 under P1 #206. `productionApproved=false`; release remains **NO-GO**.

## Verified MAIN_BASELINE_GREEN — post-PR #394 merge (2026-11-21)

- PR [#394](https://github.com/Veselin-Takev/Klar-Dating/pull/394) merged into `main` at merge commit / verified live HEAD `7389e57a11e4a5e3e384cbfc6992345453a5dcaa`. First parent: `30250a1fc82f24834c7ada62f8453df04af20f2a`; second parent: validated PR HEAD `5ed0b507c64d8e27b2252fd7c2da523769a75d97`.
- Merge tree SHA `07a8f7b7d758b247295e62f733f54063e558bb55` is identical to the pre-merge PR HEAD tree.
- `Klar Enterprise CI` [Run #44940679530](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44940679530), exact main HEAD `7389e57a11e4a5e3e384cbfc6992345453a5dcaa`: **SUCCESS** — Enterprise Static Gates (including `check-profile-media-boundary`), Typecheck, Functions Build, Build and Production Smoke passed; Tests: **212 files / 1,627 passed / 0 failed**; Playwright Browser Acceptance: **35/35 passed / 0 failed**.
- `Enterprise Compliance & Security Audit Gate` [Run #44940679384](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44940679384), same exact main HEAD: **SUCCESS** — Quality / TypeScript, Unit Tests, Compliance & Security Checks and Production Build passed; Tier 1: **549 packages / 0 High+**; Full Supply-Chain: **1,245 packages / 0 High+**.
- Post-merge Gitleaks in Run #44940679384 reported **0 commits / 0 bytes** because the push range excluded merge commits. Do not describe this as a content scan. Pre-merge PR Audit Gate [Run #44939574345](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44939574345) scanned the exact PR HEAD `5ed0b507c64d8e27b2252fd7c2da523769a75d97`: **1/1 commit, 56.67 KB, 0 leaks**. The scanned tree SHA `07a8f7b7d758b247295e62f733f54063e558bb55` is identical to the tree on the merge commit, so the merged content is covered.
- These results are SHA-bound to the PR #394 merge commit; they supersede the previous E1 base baseline without deleting or relabeling historical PR #389–#393, #375 or PR #394 pre-merge evidence. PR #394 completes E1 only; legacy media-reference migration and Firebase token revocation remain separate E2 under P1 #206.
- `productionApproved=false` and release **NO-GO** remain mandatory.

## Active Draft PR — full Gitleaks PR-range scanning

- Base: `main` at `7389e57a11e4a5e3e384cbfc6992345453a5dcaa`; branch: `ci/fix-gitleaks-full-pr-range-20261121`; target: `main`; keep **Draft / unmerged**.
- The audit workflow now uses `actions/checkout` with `fetch-depth: 0` and checks out the exact PR head. It resolves PR scans directly from `github.event.pull_request.base.sha..github.event.pull_request.head.sha`, and push scans from `before..after`; it does not call the Gitleaks Action or its unpaginated PR commits endpoint. The preflight checks commit objects, ancestry, non-empty range, complete `git log` enumeration and final HEAD equality, failing closed on mismatch.
- The pinned Gitleaks CLI v8.24.3 verifies the official release checksum manifest before use. The root `.gitleaksignore`, `--redact`, `--exit-code=2`, SARIF output and SARIF artifact upload are preserved. Push and workflow-dispatch events retain explicit scan ranges.
- Regression command: `node --test phase2_work/scripts/gitleaks-pr-range.test.mjs`. Its synthetic 32-commit history proves that commit 31, commit 32 and final HEAD are all selected; workflow assertions prohibit use of the unpaginated Action/API path.
- This Draft PR's own Klar Enterprise CI and Audit Gate are **[TO VERIFY]** until completed on its exact final `head_sha`. Record Run IDs in the PR/final handover per `AGENTS.md`; do not create a SHA-chasing docs-only commit.
- No app runtime code, dependencies, lockfiles, live cloud/IAM/Firestore/Storage resources or deployments are in scope. `productionApproved=false`; release **NO-GO**.


## Verified MAIN_BASELINE_GREEN — post-PR #395 merge (2026-11-21)

- PR [#395](https://github.com/Veselin-Takev/Klar-Dating/pull/395) merged to `main` at merge SHA / verified live `main` HEAD `83c4e31cca1a9f9e5bfb14d432f9d1bd8886532c`. Previous `main` parent: `7389e57a11e4a5e3e384cbfc6992345453a5dcaa`; validated PR HEAD: `67fdcd40c3cd27da3f31fc9ad4fc928f23a05399`.
- Merge tree SHA `6f240c6e4ce0d4eced8a47918bc5dd163cc91da7` is identical to the validated PR #395 HEAD tree. Preserve the PR #389–#395 and #375 records above as immutable SHA-specific history.
- `Klar Enterprise CI` [Run #44943576348](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44943576348), exact `head_sha` `83c4e31cca1a9f9e5bfb14d432f9d1bd8886532c`: **SUCCESS** — Enterprise Static Gates including `check-profile-media-boundary` PASS; Typecheck, Functions Build, Tests (**212 files / 1,627 passed / 0 failed**), Build and Production Smoke PASS; Playwright Browser Acceptance **35/35 passed / 0 failed**.
- `Enterprise Compliance & Security Audit Gate` [Run #44943576333](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44943576333), same exact `head_sha`: **SUCCESS** — Quality / TypeScript, Unit Tests, Compliance & Security Checks and Production Build PASS; Tier 1 Runtime Audit **549 packages / 0 High+**; Full Supply-Chain Audit **1,245 packages / 0 High+**.
- Post-merge Gitleaks in Run #44943576333 resolved the explicit push range `7389e57a11e4a5e3e384cbfc6992345453a5dcaa..83c4e31cca1a9f9e5bfb14d432f9d1bd8886532c`, used `--full-history --diff-merges=separate`, verified the official Gitleaks CLI **v8.24.3** checksum (`gitleaks_8.24.3_linux_x64.tar.gz: OK`), passed the full-range regression **4/4**, and scanned **2 commits / 42.97 KB / 0 leaks**.
- This is a development/integration baseline only. `productionApproved=false` and release **NO-GO** remain mandatory. No live Cloud, IAM, Firestore, Storage, bucket or deployment mutation is authorized or evidenced.


## Active Draft PR — P1 #206 E2 profile-media migration and token revocation

- Branch `security/issue-206-e2-media-migration-revocation-20261121` is based on the exact verified `main` SHA `83c4e31cca1a9f9e5bfb14d432f9d1bd8886532c`, targets `main`, and remains **Draft / unmerged**.
- Inventory now recognizes `photoStoragePath`, `photoPath`, `photoURL`, `photoUrl`, `photos[]`, canonical refs and owner-scoped path aliases. Object generation/metageneration are retained internally for reconciliation; command output contains aggregate counts only.
- Migration CLI defaults to dry-run, writes no Firestore or Storage data in that mode, and persists a restricted local action plan with file permissions 0600. Execution requires an exact staging project/bucket allowlist, a separately approved manifest with pinned digest, explicit staging confirmation, Firestore alias-snapshot compare-and-set, matching object generation/metageneration and bounded checkpoint/resume. A CAS conflict stops the batch.
- Revocation CLI defaults to dry-run and requires an approved staging project/bucket/object cohort. Execution patches only `firebaseStorageDownloadTokens: null` with the current `ifMetagenerationMatch`; it preserves unrelated custom metadata and object contents, verifies the post-state and stops without blind retry on conflict.
- AC-07–AC-13 unit/emulator tests have been added, including the paired test that the authenticated proxy continues serving the unchanged object after token metadata removal. Test results for this Draft PR's exact HEAD remain **[TO VERIFY]** until both hosted workflows finish.
- `Klar Enterprise CI` and `Enterprise Compliance & Security Audit Gate` Run IDs for this active PR: **[TO VERIFY]**. Per `AGENTS.md` Anti-SHA-Chasing, record exact run IDs and `head_sha` in PR/final handover; do not add recursive docs-only commits.
- Real staging revocation verification remains pending and requires separate change approval. No live Cloud/IAM/Firestore/Storage/bucket/deployment mutation was performed. `productionApproved=false`; release remains **NO-GO**.


## Verified MAIN_BASELINE_GREEN — main after PR #398 (2026-11-22)

- PR #398 merge: 58888c8e9d970c5ca514dcb9960918a64c703491; prior main parent: 6ef75da0b6f9effb297137ad2d0b8665a4cac1a0; merge tree: 414c1ac8340b28c5fbc0a87314dddc820cf67f69. PR #369 was closed unmerged; it is not a valid new branch base. This current state supersedes the earlier historical Active Draft description of #369 as open; Package 1 did not use or revive #369.
- Klar Enterprise CI [Run #45022239754](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45022239754), exact SHA 58888c8e9d970c5ca514dcb9960918a64c703491: PASS — 217 files / 1,672 tests / 0 failed; firebaseRuntime 9/9; nativeFirestoreBoundary 19/19; storageBucketIsolation 9/9; Playwright 35/35; Production Smoke PASS.
- Enterprise Compliance & Security Audit Gate [Run #45022239746](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45022239746), exact same SHA: PASS — Gitleaks range 1 commit / approximately 25.69 KB / 0 leaks, regression 4/4, Gitleaks v8.24.3 checksum verified; Tier 1 production dependencies 549 packages / 0 High+; full supply-chain 1,245 packages / 0 High+; Production Build PASS.
- This is an immutable baseline record. It is evidence for the exact main SHA only. Do not transfer it to the Package 1 branch or later SHAs.

## Package 1 — P0 #254 read-only tenant-context foundation (Draft)

- Branch security/p0-254-package1-tenant-context-inventory-20261122 is created from the exact baseline above. Target: main. Lifecycle: Draft / unmerged. PR number and final HEAD are held in live GitHub metadata.
- New resolver is injectable and read-only: Firebase Admin verifyIdToken(token, true); two independent document get() calls for tenant and membership; strict tenant/UID/active-state checks; effective roles = signed-claim roles intersected with active membership roles; routing hints can only match, never select authority; issued context is frozen and WeakSet/private-symbol validated.
- Focused tests cover absent/invalid/revoked bearer credentials, malformed claims, routing mismatches, missing/inactive/inconsistent tenant/membership, stale/over-privileged role intersection, context forgery, cross-tenant reuse and zero write operations.
- The resolver is not mounted globally. No current routes or client consumers are rewritten. No data migration, default-tenant assignment, emulator/staging/live data scan, Rules or complianceStorage 503 interlock change, Cloud/IAM/Storage/bucket/deployment mutation, workflow change, dependency or lockfile change.
- Inventory explicitly identifies source paths, SDK actors, operations, current gates, UID/Art. 17 links, candidate keys and review status. Existing flat records remain UNMAPPED until DPO/Legal-approved row-level evidence exists. P0 #254 is not closed by Package 1.
- Exact Package 1 PR-head Typecheck/tests/Enterprise CI/Audit Gate are [TO VERIFY] until hosted workflows finish on the final branch HEAD. Do not claim mainline runs as branch evidence. Per AGENTS.md Anti-SHA-Chasing, report exact branch SHA/run IDs in the final handover without recursive docs-only commits.
- productionApproved=false; release NO-GO.

## Active Draft PR — P0 #254 Package 2 tenant-scoped repository boundary

- Branch: `security/p0-254-package2-tenant-repository-boundary-20261122`; base: `main@abb3c4ebffef9efc1a4be8a2a19cac3f0c7e12e0`; target: `main`; lifecycle: **Draft / Open / Unmerged**. PR number and final HEAD are held in GitHub PR metadata/final handover.
- Exact four-file scope: new isolated `phase2_work/src/server/multitenant/tenantRepository.ts`; new fake-store BOLA/IDOR suite `phase2_work/tests/tenantRepository.spec.ts`; this file and `docs/HANDOVER_STATUS.md`.
- Gate requirements: genuine `TenantContext` WeakSet/frozen validation; tenant-only path derivation and path-shape/legacy-root rejection; trusted resource metadata bound to exact tenant and canonical path; mandatory owner and complete consistent participants; owner-only mutations; participant reads only; no `admin`/`super_admin` shortcut; no underlying store call before all authorization checks pass.
- Tests are injected/fake-store only. No production route or server bootstrap mount is permitted. New test result (**29 parameter-expanded cases authored**) and both Draft PR hosted workflow results remain **[TO VERIFY]** until completed on the final PR HEAD.
- Explicit exclusions: no Rules, Storage Rules, `complianceStorage.ts` interlock, workflows, dependencies, lockfiles, client Firebase SDK or existing route changes; no legacy record assignment, live/staging scan, migration, cutover, or Cloud/IAM/Firestore/Storage/bucket/deployment mutation.
- Package 3 deterministic mapping/quarantine dry-run remains pending. P0 #254 stays **OPEN**; `productionApproved=false`; production **NO-GO**. Do not treat main baseline runs #45028506636/#45028506610 as evidence for this Draft PR.



## Historical Iteration-2 register notice

`phase2_work/docs/ITERATION_2_REMEDIATION_REGISTER_2026-11-16.md` is a point-in-time historical snapshot, not the live repository status. Its current-state function is superseded by `docs/HANDOVER_STATUS.md` and `docs/CI_CD_AND_SECURITY_GATES.md`; retain it only as historical audit evidence and do not use it as the authoritative current register.


## Immutable verified main baseline — PR #405 / P0 #374 Package 1 (2026-11-23)

- PR [#405](https://github.com/Veselin-Takev/Klar-Dating/pull/405) merged to `main` at `616b165d6df783b5fe9c1b45dcb9c5dd53def583`; previous main `8c239dd71bbeb1bfdd5373cfbe763ab2c9e5a406`; merge tree `a71eaaf97c22854b1c57ad15296fb5128e36d5ea`, identical to validated PR #405 head tree.
- **Klar Enterprise CI** [Run #45126660444](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45126660444), exact `head_sha=616b165d6df783b5fe9c1b45dcb9c5dd53def583`, **SUCCESS**: 223 test files / 1,800 tests / 0 failed; `profileMediaDeliveryContract.spec.ts` 40/40; `check-tenant-cutover-readiness` 19/19; `tenantRouteGuardAdapter.spec.ts` 23/23; `tenantRulesContract.spec.ts` 9/9; Playwright 35/35; Enterprise Static Gates, Typecheck, Functions Build, Build and Production Smoke PASS.
- **Enterprise Compliance & Security Audit Gate** [Run #45126660669](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45126660669), exact same `head_sha`, **SUCCESS**: post-merge Gitleaks scanned 1 commit / 0 leaks; CLI v8.24.3 checksum OK; Tier 1 549 packages and Full Supply-Chain 1,245 packages / 0 High+; Production Build PASS.
- These runs certify only this immutable main SHA. PR #405 delivered the isolated/default-OFF Package 1 profile-media access contract; it did not activate a production route or approve production.
- P0 #374 Package 2 is the active Draft PR on branch `security/p0-374-package2-token-inventory-dry-run-20261123`; exact PR number and head are held in GitHub metadata. Its own Klar Enterprise CI and Audit Gate runs remain **[TO VERIFY]** until completed on the exact PR head.
- P0 #254 remains **OPEN** with status `AWAITING_INDEPENDENT_APPSEC_DPO_SRE_REVIEW`; P0 #374 remains **OPEN**. `productionApproved=false`; production **NO-GO**. No live Cloud/IAM/Firestore/Storage/bucket/deployment mutation was performed.

## Active Draft PR — P0 #374 Package 2 offline token inventory and dry-run verification

- Base: exact verified `main@616b165d6df783b5fe9c1b45dcb9c5dd53def583`; target `main`; branch `security/p0-374-package2-token-inventory-dry-run-20261123`; keep **Draft / Open / Unmerged**.
- Scope: pure offline deterministic SHA-256 inventory/plan builder; synthetic-only negative/boundary suite; concept/governance document; script-only registration and `check:enterprise` integration; handover and CI/security-gate baseline synchronization.
- Plan output contains aggregate counts and conflict taxonomy only. It does not return UIDs, object paths, download URLs, token values, generation values or raw metadata. Every generated plan explicitly asserts `storageMutations=0` and `databaseWrites=0`.
- Offline tests use synthetic fixtures only and cover deterministic digesting, missing objects, contradictory references, generation/metageneration mismatches, stale/tampered plans, independent approval rejection and sensitive-value redaction. The pure module has no Firebase, Google Cloud, database, network or filesystem dependency.
- No operational inventory/revocation CLI was executed or changed. No active production route, Rules, workflow, dependency or lockfile changes. No live migration or token revocation.
- This Draft PR's own Klar Enterprise CI and Enterprise Compliance & Security Audit Gate exact-head Run IDs/status/conclusions: **[TO VERIFY]** until observed. Per `AGENTS.md` Anti-SHA-Chasing, report exact run IDs and `head_sha` in final handover; do not create recursive docs-only commits to chase this PR's moving SHA.
- P0 #374 remains **OPEN**; P0 #254 remains **OPEN** and awaiting independent AppSec/DPO/SRE review; `productionApproved=false`; production **NO-GO**.
