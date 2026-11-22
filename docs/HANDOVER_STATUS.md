# Klar Developer Handover Status

**Snapshot:** 2026-11-22
**Main HEAD (verified after PR #397 merge):** `6ef75da0b6f9effb297137ad2d0b8665a4cac1a0`
**Previous main HEAD:** `18dd4a3dd753bdfb01875b9aea625064eb7ecce9` (the exact baseline before PR #397)
**Release decision:** **NO-GO** — `productionApproved=false` is a hard invariant.

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


## Immutable verified main baseline — 2026-11-21

PR [#396](https://github.com/Veselin-Takev/Klar-Dating/pull/396) merged into `main` at `18dd4a3dd753bdfb01875b9aea625064eb7ecce9`, with previous main parent `83c4e31cca1a9f9e5bfb14d432f9d1bd8886532c`. The baseline is immutable evidence; results below validate only this exact SHA.

- **Klar Enterprise CI** [run #44951316282](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44951316282) — `push` on `main`, exact HEAD `18dd4a3dd753bdfb01875b9aea625064eb7ecce9`, **SUCCESS**. Enterprise static gates, TypeScript, Functions build, application build and Production Smoke passed; **216 test files / 1,645 tests** passed; Playwright Browser Acceptance **35/35** passed. Profile-media E2E boundary coverage: **22/22** across six suites.
- **Enterprise Compliance & Security Audit Gate** [run #44951316301](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44951316301) — `push` on `main`, exact HEAD `18dd4a3dd753bdfb01875b9aea625064eb7ecce9`, **SUCCESS**. Post-merge Gitleaks scanned approximately **88 KB** from previous main `83c4e31...` to this SHA with **0 leaks**; Tier 1 production audit checked **549 packages** with **0 High+** findings; full supply-chain audit checked **1,245 packages** with **0 High+** findings; production build passed.

These results certify the source/CI baseline only. They do not prove deployed Cloud/Scheduler/IAM state, actual staging migration/revocation, independent legal/security approvals, or production readiness.

## Code-vs-issue reconciliation at main `18dd4a3...`

- **#374 / #206 — CODE_COMPLETE_ON_MAIN (source implementation; operations/sign-off remain open).** E1 and E2 implementation are merged through PRs #394 and #396. The Storage rules copies deny direct client reads for protected verification/profile media; authenticated media proxy and migration/token-revocation tooling are present. Live inventory and migration execution, legacy token/cache/copy-link revocation proof, staging evidence, and independent AppSec/DPO/Legal/SRE/Release sign-off remain **[TO VERIFY]**.
- **#373 — CODE_COMPLETE_ON_MAIN (source implementation).** The account-deletion barrier is used transactionally by public-profile publication and candidate selection, and Firestore rules deny reads when the target deletion barrier exists. Live operational and independent compliance evidence remains **[TO VERIFY]**.
- **#202 — CODE_COMPLETE_ON_MAIN (unsafe-age-purge containment and decision-aware source path).** The legacy verification-photo upload-age deletion behavior has been removed/contained; decision-aware retention code remains fail-closed. The production route still returns **503** with `verification_storage_purge_p0_fencing_unverified` while production fencing is unverified. Scheduler inventory, live retention execution, retention/legal policy and DPO approval remain **[TO VERIFY]**.
- **#371 — OPEN P0 CODE/INTEGRATION GAP; Draft workstream.** The existing deletion fence primitives do not by themselves prove atomicity across every verification writer and Art. 17 final-sweep transaction. The substantive branch `security/issue-371-account-erasure-writer-fence-20261122` adds the missing tombstone/writer-intent integration and adversarial emulator coverage. It is not merged or production-authorized; held/unresolved evidence remains blocked pending DPO/Legal policy.
- **#254 — OPEN P0 MULTI-TENANT ISOLATION GAP.** Main still requires a separately governed tenant-context, legacy data mapping, rules/repository cutover and BOLA/IDOR emulator validation. Work on `release/v0.1.1-rc1` does not certify tenant isolation on `main`.

## Verified post-merge PR #397 — Art. 17 writer fence

PR [#397](https://github.com/Veselin-Takev/Klar-Dating/pull/397) merged into `main` at `6ef75da0b6f9effb297137ad2d0b8665a4cac1a0` from previous parent `18dd4a3dd753bdfb01875b9aea625064eb7ecce9`; the merge tree is `cced2fb91275abd0474c7209029a6aac3e4be47d` and matches the validated PR tree. The merge did not authorize production use.

- `Klar Enterprise CI` [run #45018481241](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45018481241), exact `head_sha=6ef75da0b6f9effb297137ad2d0b8665a4cac1a0`: **SUCCESS** — 216 test files / 1,652 tests / 0 failed; the four P0 #371 suites passed 73/73; Playwright Browser Acceptance 35/35; static gates, TypeScript, Functions build, application build and Production Smoke passed.
- `Enterprise Compliance & Security Audit Gate` [run #45018481240](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45018481240), same exact `head_sha`: **SUCCESS** — one commit scanned by Gitleaks, 208 rules / 0 leaks, CLI v8.24.3 checksum OK, regression 4/4, Tier 1 549 packages / 0 High+, Full Supply-Chain 1,245 packages / 0 High+, Production Build passed.
- The merged #371 writer-intent/tombstone fence remains subject to independent DPO/Legal and operational evidence; CI does not certify live purge, retention, or production deployment. `productionApproved=false` remains mandatory.

---

## 5-minute quickstart

Prerequisites: Node.js **22.23.3**, Bun **1.4.4**, Java 21 for Firebase Emulator workflows.

```bash
git clone https://github.com/Veselin-Takev/Klar-Dating.git
cd Klar-Dating/phase2_work
node --version       # v22.23.3
bun --version        # 1.4.4
bun ci               # frozen install from committed lockfile
bun run check:ci-toolchain-pins
bun run typecheck
bun run test:pure
bun run build
```

Use a feature branch; never commit directly to `main`. Use the isolated `demo-*` project for emulator work. Never hand-edit `bun.lock`, suppress advisories, or treat missing checks as PASS.

## Live PR state and dependency order

GitHub reported **198 open PRs: 196 Draft and 2 non-Draft**. The full inventory contains exact PR number, branch, Draft state, HEAD SHA and latest observed PR-triggered CI conclusion: [Open PR Inventory (2026-11-19)](OPEN_PR_INVENTORY_2026-11-19.md). CI values not found in the inspected workflow-run window are marked `[TO VERIFY]`.

**No PR is presently authorized for merge.** The two non-Draft PRs have latest observed `Klar Enterprise CI` failures:
- [#361](https://github.com/Veselin-Takev/Klar-Dating/pull/361), base `main`, HEAD `b80c29a2b6d210b20af5e537a8433223c17f2dc4`, run [43963492671](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/43963492671): **failure**.
- [#358](https://github.com/Veselin-Takev/Klar-Dating/pull/358), base `release/v0.1.1-rc1`, HEAD `1321c42ffe1c5919c1baccaada66a650ab811f93`, run [42710380877](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710380877): **failure**. This belongs to the release branch, not the `main` merge queue.

Verified dependency order:
1. Package B [#381](https://github.com/Veselin-Takev/Klar-Dating/pull/381) is merged and provides the base branch for Package C.
2. Package C [#382](https://github.com/Veselin-Takev/Klar-Dating/pull/382) and Package D [#383](https://github.com/Veselin-Takev/Klar-Dating/pull/383) are now merged in sequence. #382 merge commit: `30690f549f7eac1b925076b1227ee5508845eae0` (2026-11-20 07:37:37 UTC); #383 merge commit: `1b30ea60dc9acab31020533fd55ba1cf69feaf33` (2026-11-20 07:38:33 UTC). The current Issue #374 integration consolidation and exact merge parents are recorded in the 2026-11-20 addendum below.
3. Integration candidate [#353](https://github.com/Veselin-Takev/Klar-Dating/pull/353) precedes deletion-fence Package A [#378](https://github.com/Veselin-Takev/Klar-Dating/pull/378), because #378 targets #353's branch. Both remain Draft; this dependency chain is not production approval.

Other active candidates:
- [#368](https://github.com/Veselin-Takev/Klar-Dating/pull/368): Draft P0 safety interlock to keep legacy upload-age verification-photo purge disabled. CI success does not prove deployed scheduler state or all-writer fencing.
- [#369](https://github.com/Veselin-Takev/Klar-Dating/pull/369): untouched stale Draft reference on base `2fa3ba223989ff248ad1abaea67f4f454f7c9f6b`; superseded for current review by the new fresh-base Firebase runtime identity Draft branch above. PR #369 remains open and unmodified.
- [#375](https://github.com/Veselin-Takev/Klar-Dating/pull/375): Draft public-profile read/publication barrier during account erasure.
- [#384](https://github.com/Veselin-Takev/Klar-Dating/pull/384): Draft two-tier dependency audit gate; latest Audit Gate run [44584526500](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44584526500) failed on production `re2js@2.8.6`.

## Active P0/P1 blockers

### P0 — deletion and retention safety

- Keep verification-photo purge disabled. PR #368 explicitly calls itself a P0 safety interlock and states it does not complete the Firestore/GCS all-writer fence or prove that the deployed scheduler runs the new code.
- VES-5/VES-15 integration candidate #353 preserves production hard-stops, but its evidence states that external IAM/Console/Scheduler/Cloud Audit Log/tenant writers remain unknown and all-writer post-authorization race safety is not proven.
- PR #378 adds the monotonic Firestore deletion-fence schema, but explicitly does not integrate it into GCS purge, account erasure, upload, moderation or external writer paths.
- Live TTL/retention ACTIVE evidence, deployed scheduler identity, legal-hold race coverage, independent AppSec/DPO/SRE review and rollback/restore drills remain **[TO VERIFY]** against current production evidence.

### P1 — production dependency audit

PR #384's latest exact-head Audit Gate run failed because `re2js@2.8.6` remains in the production path `firebase > @firebase/firestore-compat > @firebase/firestore > re2js`. Advisory: GHSA-gg6h-894w-4m9c; fixed boundary `2.8.7`. This is a production hard-fail, not a dev-only advisory.

### Historical dev-only Zod 3 resolution at the PR #389 baseline

At the immutable PR #389 baseline (`24a57615544f6a190e5a76900d49b65646a320b9`), the lockfile recorded `chromium-bidi@17.0.2` with dependency `zod: ^3.24.1`, resolved as `chromium-bidi/zod -> zod@3.25.76`. `chromium-bidi` was pulled by `puppeteer` / `puppeteer-core`; `puppeteer` was declared under `devDependencies`. The direct application dependency was already `zod@4.6.6`. This was a **dev-only transitive exception**, not evidence that the runtime graph used Zod 3. Do not add a global override forcing Zod 3 to Zod 4. The isolated security branch updates Puppeteer to a version whose `chromium-bidi` dependency accepts Zod 4; its exact-PR hosted audit remains `[TO VERIFY]`.

## Hermetic Playwright critical-user-journey coverage

**Candidate branch:** `test/e2e-critical-user-journeys`  
**Base:** `main` at `191ce9b64205ff1e523093cf1fa3d9a523daf0e1`  
**Branch synchronization:** merged `origin/main` at `191ce9b64205ff1e523093cf1fa3d9a523daf0e1` into this branch via merge commit `8c6ba106e047c1b54c37e35258e8b8543047cfb4` (13 previously missing main commits; no overlapping source paths in the main-side delta).  
**PR:** [#387](https://github.com/Veselin-Takev/Klar-Dating/pull/387) — Open, Draft, unmerged  
**Initial exact-head Browser Acceptance:** failed in [run #44602173051](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44602173051) on HEAD `6acb0f4f0f47b7ef866c43bdba765358edbfcec4` (30 passed / 4 failed).  
**Latest completed exact-head Browser Acceptance before this fix:** failed in [Klar Enterprise CI run #44605420683](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44605420683) on HEAD `657aaa240018e8c400db185fba1ea757c31b8af5` (33 passed / 1 failed); `cuj-account-erasure.spec.ts:60` received HTTP 503 instead of HTTP 202 because the first-time account deletion rate limiter attempted `tx.update` on a missing document.  
**Rate-limit remediation:** current change uses `tx.set` for a missing record, retains the three-request/24-hour limit and 429 rejection, and adds `tests/accountDeletionRateLimit.spec.ts`; the E2E assertion for HTTP 202 and the Art. 17 immediate erasure barriers is unchanged.  
**Exact-head Klar Enterprise CI for rate-limit remediation HEAD `be20a55b13f2e00f54d45f9acf566db3655daaa4`:** [run #44611836293](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44611836293) — **FAILURE**. Typecheck, Functions build, Tests, Build and Production Smoke passed; Browser Acceptance was 33/34. The HTTP 202 status assertion passed; the sole failure was Playwright response-body retrieval at `cuj-account-erasure.spec.ts:61` after navigation (`Network.getResponseBody` response unavailable).

The read-first audit found existing coverage for under-18 rejection and the mandatory age gate (`tests/e2e/e2e-critical-flows.spec.ts`), optional consent acceptance/onboarding (`tests/e2e/onboarding.spec.ts`), consent withdrawal (`tests/e2e/privacy-settings.spec.ts`), one-sided icebreaker/fail-closed chat status (`tests/e2e/chat-security.spec.ts`) and public-entry accessibility (`tests/e2e/accessibility.spec.ts`). New non-duplicative specs add:

- `tests/e2e/cuj-onboarding-consent.spec.ts`: optional product-analysis consent grant through the UI and persisted server readback.
- `tests/e2e/cuj-daily-quota.spec.ts`: all eight contacts plus ninth-contact rejection for both free and Plus plans, quota API readback and exhausted Dashboard state.
- `tests/e2e/cuj-icebreaker-verification.spec.ts`: two-user UI unlock only after both users answer both questions; stale textual verification status cannot override `isVerified=false`.
- `tests/e2e/cuj-account-erasure.spec.ts`: Art. 17 deletion request, immediate public-profile barrier, UID-scoped browser cleanup and preservation of global device preference. This verifies request acceptance and the immediate barrier, **not** completion of the asynchronous deletion worker.
- `tests/e2e/cuj-accessibility.spec.ts`: axe WCAG A/AA scans on age/consent onboarding, Dashboard, Profile safety and account controls; the gate asserts zero serious/critical violations.

All new fixtures use loopback Firebase Auth/Firestore Emulator APIs under `demo-klar`; no live cloud, production, KYC, payment or external AI calls are part of these new journeys. The existing Playwright config discovers `tests/e2e` and the existing Enterprise CI Browser Acceptance step runs the complete suite. No workflow change is needed.

Local `bun run typecheck`, `bun run test:pure` and Playwright execution were **not run in this execution environment** because no local `phase2_work` checkout/runtime is mounted. These results remain **[TO VERIFY]**; do not report PASS until local or exact-head CI evidence is available. `productionApproved=false` remains mandatory.

### CI failure analysis and remediation — 2026-11-19

Initial exact-head run [#44602173051](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44602173051) completed Typecheck, Tests, Build and Production Smoke successfully. Browser Acceptance reported **30 passed / 4 failed**.

- The login/age-gate failures and the contact endpoint's `401 / alter_fehlt` shared one fixture root cause: Firestore REST `PATCH` calls without `updateMask.fieldPaths` replaced the existing `users/{uid}` document, removing authoritative `isAdult` and `einwilligung` fields written by the age/consent APIs. Existing-user fixture updates now use explicit masks; new fixture documents may still be created without a mask.
- Axe found two real critical accessibility violations in `HapticSettings`: the pattern `select` lacked an accessible name and the intensity range input lacked an associated label. Both controls now have visible, programmatically associated labels. Axe assertions are unchanged.

The fixture-mask and accessibility remediations are reflected in exact-head run #44605420683; Typecheck, Tests, Build and Production Smoke passed, while Browser Acceptance remained 33/34 because of the first-time deletion rate-limit document bug described above. The present fix adds an existence-aware transaction write and a focused regression test; the browser test continues to require HTTP 202, the pending receipt, public-profile removal, verification revocation and UID-scoped browser-state cleanup. The asynchronous deletion worker's completion remains outside this browser assertion. The new exact-head CI result remains **[TO VERIFY]** until GitHub Actions completes.

### Art. 17 first-request rate-limit fix — 2026-11-19

The latest failing Browser Acceptance exposed a first-request defect in `accountDeleteLimiter`: when the hashed UID-scoped document did not exist, the transaction fell through to `tx.update`, which fails for a missing Firestore document and returned the fail-closed HTTP 503. The fix initializes a missing record with `tx.set` (`count: 1`, current 24-hour window, expiry); existing records still increment with `tx.update`, the fourth request in a 24-hour window remains rejected with HTTP 429, and genuine transaction failures still return HTTP 503 without invoking erasure. Focused regression coverage is in `phase2_work/tests/accountDeletionRateLimit.spec.ts`; exact-head run [#44611836293](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44611836293) recorded **3/3 PASS** for this file. The associated Browser Acceptance response-body failure is documented below.


### Account-erasure response-body capture remediation — 2026-11-19

**Verified baseline evidence on PR #387 HEAD `be20a55b13f2e00f54d45f9acf566db3655daaa4`:**

- `Klar Enterprise CI` [run #44611836293](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44611836293): **FAILURE**. Typecheck, Functions build, Tests, Build and Production Smoke passed. Browser Acceptance completed 33/34; HTTP 202 was received and its status assertion passed, but the test then attempted `response.json()` after navigation and Chromium reported that the response body was no longer available. This is a Playwright response-capture failure; it does not indicate a non-202 API response.
- `tests/accountDeletionRateLimit.spec.ts`: **3/3 PASS** in the Tests step of run #44611836293.
- `Enterprise Compliance & Security Audit Gate` [run #44611836292](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44611836292): **SUCCESS**. Tier 1 production audit: **PASS**, `bun audit --prod --audit-level=high` found no High+ vulnerabilities across 549 checked packages (three below the configured threshold). Tier 2 full supply-chain audit: **ADVISORY**, one High Zod advisory `GHSA-mrhx-c7xc-m3w5` in the full dependency graph. The advisory is reported separately and does not override the Tier 1 production hard-fail result.

**Response-capture fix in this change:** `cuj-account-erasure.spec.ts` now intercepts `POST /api/account/delete` with `page.route()`, obtains the upstream result via `route.fetch()`, captures its status and parses the JSON receipt inside the route handler, then relays the same upstream response using `route.fulfill({ response })`. The test asserts HTTP 202 and validates the pending receipt after the browser action. The existing pending-job, public-profile 404, verification-revocation, UID-scoped localStorage cleanup and global-theme-preservation assertions remain in place and are not weakened. No `waitForTimeout()` was added.

**New commit validation:** exact-head `Klar Enterprise CI` and `Enterprise Compliance & Security Audit Gate` runs for this response-capture commit: **[TO VERIFY]** until GitHub Actions reports completion. Do not infer PASS from the prior baseline runs.

## Release invariant

`productionApproved=false` remains mandatory. No merge, deployment, cloud/IAM/Firestore/Storage mutation, live migration or production purge is authorized by this handover. A green CI run, source-level fix or Draft PR does not equal production GO.


### PR #387 — follow-up to disposed route response (2026-11-19)

**Exact-head failure evidence:** PR #387 HEAD `9a741c8188cfabfbf453d7d817504d74e5d19cb6`, `Klar Enterprise CI` [run #44616052807](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44616052807) — **FAILURE**, Browser Acceptance **33/34**. The diagnostic artifact `browser-diagnostics-44616052807-1` (artifact ID `14576445383`) confirms `tests/e2e/cuj-account-erasure.spec.ts:22`; the failing handler line was 65. `route.fetch()` returned an APIResponse whose body was already disposed when `response.json()` ran (`apiResponse.json: Response has been disposed`). Consequently `deletionStatus` remained undefined and the strict HTTP-202 assertion failed at line 70. This run did **not** establish a downstream Art. 17 barrier failure: receipt and downstream assertions were not reached.

The replacement keeps the browser request paused, copies the original request method, URL, body and authentication/cookie headers into the test fixture's independent `APIRequestContext`, reads the upstream status and body there, parses the receipt before releasing the route, then fulfills the browser request with the captured status, response headers and bytes. This avoids tying response-body lifetime to the page navigation. HTTP 202, pending receipt/requestId, pending deletion job, public-profile 404, verification revocation, UID-scoped browser-state removal and global-theme preservation assertions remain intact. No `waitForTimeout()` was added.

The separate `Enterprise Compliance & Security Audit Gate` [run #44616052794](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44616052794) on the same HEAD completed **SUCCESS** (six hard-fail checks PASS; full supply-chain audit remains ADVISORY). Exact-head validation for the new response-capture correction: **[TO VERIFY]** until the newly triggered workflows complete. `productionApproved=false`; PR #387 remains Draft and unmerged.


### PR #387 — capture-promise synchronization (2026-11-19)

**Verified prior exact-head runs on `4569b8ac1a82612154cfe2a556cf97b242e5f778`:**

- `Klar Enterprise CI` [run #44618445371](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44618445371): **FAILURE**, Browser Acceptance **33/34**. Diagnostic artifact `browser-diagnostics-44618445371-1` (artifact ID `14576717329`). The failure is a test race in `cuj-account-erasure.spec.ts`: the test clicked the final-delete button and asserted `deletionStatus === 202` without waiting for the intercepted route handler. The status was still undefined at assertion time; test teardown then disposed the fixture `APIRequestContext`, causing the in-flight `request.fetch()` to fail with `Request context disposed`. This is not evidence of a server-side 202 failure or a downstream Art. 17 barrier failure.
- `Enterprise Compliance & Security Audit Gate` [run #44618446075](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44618446075): **SUCCESS**. Tier 1 production dependency audit **PASS**: no High+ vulnerabilities across 549 checked packages. Tier 2 full dependency graph **ADVISORY**: one High Zod advisory `GHSA-mrhx-c7xc-m3w5` in the full graph; the advisory step is non-blocking and remains explicitly visible.

**Synchronization correction in this commit:** the route handler now resolves a typed `capturePromise` only after it has read the upstream status and parsed the complete JSON receipt. It rejects that promise if request/response capture fails. The test awaits `Promise.all([capturePromise, finalDeleteButton.click()])` before asserting HTTP 202 and receipt/requestId, then unregisters the route with `page.unroute(deletionRoute)`. This ensures test teardown cannot dispose the request context before capture has completed. All Art. 17 assertions remain unchanged: 202, pending receipt/requestId, pending deletion record, public-profile 404, verification revocation, UID-scoped localStorage cleanup and global theme preservation. No fixed sleeps were added.

New exact-head CI for this synchronization correction: **[TO VERIFY]** until the newly triggered workflows complete. `productionApproved=false`; PR #387 remains open/Draft/unmerged.


### PR #382 — missing deletion progress type import (2026-11-19)

**Verified failure baseline:** PR #382 HEAD `4e203ee7383cd954003db0f4b2609b7e86ac85e9`, `Klar Enterprise CI` [run #44623218511](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44623218511) completed **FAILURE**. Typecheck stopped at `tests/accountErasure.spec.ts(150,85)` with TS2552: `Cannot find name 'DeletionStoragePageComplete'. Did you mean 'DeletionPageComplete'?`. The subsequent Functions build, Tests, Build, Production smoke and Browser acceptance steps were skipped; this run provides no 34/34 Playwright evidence.

**Type correction in this follow-up:** `DeletionStoragePageComplete` is already exported by `src/server/deletionProgress.ts` and is imported/used by `tests/deletionLifecycle.spec.ts`. `accountErasure.spec.ts` already asserted `purgeAccountData(...)` rejects with an instance of that exact storage-page sentinel but omitted it from its named import. The test now imports both `DeletionPageComplete` and `DeletionStoragePageComplete` from the existing module. The runtime assertion and all other test assertions are unchanged. No TypeScript compiler options, strictness settings or project references were changed.

**Audit workflow trigger scope:** `.github/workflows/enterprise-compliance-audit-gate.yml` has `pull_request` with `branches: [main]`, plus `push` for `main` and `release/*`, and `workflow_dispatch`. PR #382 is stacked on `security/issue-374-client-media-cutover-20261118`, not `main`; its pull-request event therefore does not automatically trigger this audit workflow. Exact-HEAD audit evidence for a stacked PR requires manually dispatching this workflow against the intended feature-branch ref and verifying the resulting run's `head_sha` equals the PR HEAD. No manual audit dispatch was initiated in this change.

**Verified validation for the type-import commit `02de612e6b34a4078ed958e7cf482f558efb75cc`:** `Klar Enterprise CI` [run #44624709849](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44624709849) completed **SUCCESS** on that exact HEAD. Typecheck, Functions build, Tests, Build, Production Smoke and Browser Acceptance succeeded; the Browser Acceptance log records **34 passed (2.4m)**. The subsequent manual `Enterprise Compliance & Security Audit Gate` [run #44629915925](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44629915925), also on that exact SHA, failed at Gitleaks; the production runtime dependency audit and production build were skipped. The failure diagnosis and exact-fingerprint remediation are recorded below. No Tier 1 Production Audit PASS is inferred from the skipped step.

`productionApproved=false` remains mandatory. PR #382 remains open and Draft; do not merge. PR #383 and `main` are out of scope. No cloud, IAM, deployment, Firestore or Storage mutation is authorized or performed.

### PR #382 — manual Audit Gate Run #17 Gitleaks failure and exact-fingerprint remediation (2026-11-19)

**Exact failure evidence:** PR #382 HEAD `02de612e6b34a4078ed958e7cf482f558efb75cc`; `Enterprise Compliance & Security Audit Gate` [Run #17 / ID 44629915925](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44629915925), event `workflow_dispatch`, branch `security/issue-374-package-c-upload-cutover-20261118`, completed **FAILURE**. The only failing step was **Gitleaks** (step 9, action using Gitleaks 8.24.3). Quality / TypeScript, Unit Tests and Compliance & Security Checks all passed. Gitleaks scanned 3,706 commits and reported 18 findings; it emitted artifact `gitleaks-results.sarif.zip` (artifact ID `14580783462`). The hard-fail production runtime dependency audit (Tier 1) and Production Build were skipped after Gitleaks failed. The full dependency audit ran as advisory and reported the existing High Zod advisory `GHSA-mrhx-c7xc-m3w5`; this did not cause the job failure.

**Finding classification (no secret values copied into this record):** the 18 exact findings are historical false positives in SHA-256 evidence digests (`OPERATIONAL_VERIFICATION.json`, `LEGACY_ADMIN_ACCESS.json`), documentation lines containing policy/reference material, synthetic test-only `leaseToken`/HMAC/consent values and a public-key parser fixture, plus the `apiKey` field in the checked-in Firebase web-app configuration. Firebase documents Firebase web-app API keys as public project/app identifiers, with authorization enforced by IAM, Security Rules and App Check; the specific cloud restrictions for these project keys were not checked or changed in this task. The test and evidence values were confirmed in their historical source contexts. No credential values are recorded here.

**Minimal remediation:** add root `.gitleaksignore` with exactly the 18 commit/path/rule/line fingerprints emitted by Run #17. This is an exact-fingerprint exception for these historical occurrences only. It does not add path-wide or rule-wide exclusions, alter Gitleaks rules/configuration, reduce the 3,706-commit scan scope, change the Gitleaks action, exit code or `continue-on-error` behavior, or suppress future occurrences with different fingerprints. Gitleaks remains a hard-fail step; newly introduced and otherwise unmatched findings still fail the workflow.

**New commit validation:** new `Klar Enterprise CI` exact-HEAD run: **[TO VERIFY]** until GitHub Actions completes. New `Enterprise Compliance & Security Audit Gate` exact-HEAD `workflow_dispatch`: **[TO VERIFY]** until a manual dispatch is made against the new branch HEAD and the Tier 1 Production Runtime Audit is shown as PASS. Run #17 on the previous SHA is historical failure evidence, not a PASS for the remediation commit.

Historical snapshot from 2026-11-19 during PR #382 remediation: PR #382 was then open and Draft. PR #382 and PR #383 were subsequently merged on 2026-11-20; see the Issue #374 addendum below for their merge SHAs and the consolidated integration state. `productionApproved=false` remains mandatory. No cloud, IAM, deployment, Firestore or Storage mutation was performed.

## Issue #374 — Package C + D consolidated integration handover (2026-11-20)

**Release decision: NO-GO.** productionApproved=false remains unchanged. This integration is a Draft review candidate only; green CI or merged code does not authorize production rollout.

### Verified merged PR chain

- PR #381 (Package B / authenticated client profile-media foundation): merged 2026-11-19 10:17:00 UTC; merge commit 5d6f2e9972111d23d64f1df4af43f0ac475fdfd3.
- PR #382 (Package C / legacy profile upload and token inventory): merged 2026-11-20 07:37:37 UTC; merge commit 30690f549f7eac1b925076b1227ee5508845eae0.
- PR #383 (Package D / profile-media migration and staged token-revocation plan): merged 2026-11-20 07:38:33 UTC; merge commit 1b30ea60dc9acab31020533fd55ba1cf69feaf33.

These merge states supersede the earlier entries above that describe PR #382 or #383 as open/Draft. Those entries remain historical run-specific evidence, not current lifecycle status.

### Integration consolidation

- Authorized integration branch: security/issue-374-client-media-cutover-20261118.
- Exact pre-merge integration HEAD: 30690f549f7eac1b925076b1227ee5508845eae0 (PR #382 merge).
- Exact Package C source HEAD containing Package D: 1b30ea60dc9acab31020533fd55ba1cf69feaf33 (PR #383 merge).
- Standard git merge --no-edit completed with the ort strategy and no conflicts. Consolidation merge commit: 0d9a058d90de148c62f8f89c4d7fb0d97054ad2d; parents, in order: 30690f549f7eac1b925076b1227ee5508845eae0 and 1b30ea60dc9acab31020533fd55ba1cf69feaf33. No rebase, force-push or history rewrite was used.
- All four Package D documents are present under phase2_work/docs/security/: ISSUE_374_ENTERPRISE_REVIEW_DOSSIER.md, ISSUE_374_EXECUTIVE_SUMMARY.md, ISSUE_374_RELEASE_TRACKING.md, and PACKAGE_D_MIGRATION_AND_REVOCATION_PLAN.md (815 inserted lines total).
- Main synchronization at this consolidation point: main HEAD 13cce96660ba4a35d54c222e9eeae2e31f260863; git rev-list --left-right --count origin/main...HEAD = 0 47 (zero commits behind, 47 branch-only commits).

### Historical exact-head evidence (not transferable to the new integration HEAD)

- PR #381: Klar Enterprise CI Run #2144 / ID 44293821811 on commit 3befc46251559dc4965a2c9a7ccfe808af49827d: SUCCESS, including 26/26 Browser Acceptance. This is historical coverage on the pre-merge profile-media branch head.
- PR #383: Klar Enterprise CI Run #2151 / ID 44312127379 on commit 998b6ecb2b90bf5d3d3af04108637d175544fc82: SUCCESS, Browser Acceptance 26/26. It is not validation of the consolidated integration HEAD.
- PR #382: final Package C Klar Enterprise CI Run #44631763988 and manual Enterprise Compliance & Security Audit Gate Run #44632518985 both completed SUCCESS on Package C commit 7c94b290bea41e27059d277d9f7299d5f57b5f6b. CI recorded 34/34 Browser Acceptance. Audit Gate recorded Gitleaks PASS and Tier 1 Production Runtime Audit PASS (549 packages; no High+ findings); Tier 2 full-supply-chain audit remains advisory with the existing Zod advisory. These results do not validate Package D or the new integration commit.

### Local validation on the consolidated branch

- Toolchain: Node.js v22.23.3 and Bun 1.4.4, matching the repository pins.
- bun install --frozen-lockfile: PASS, 1,331 packages installed; the committed lockfile was not changed.
- bun audit --prod --audit-level=high: PASS, no High/Critical vulnerabilities (549 production packages checked; 3 below the configured threshold).
- bun run typecheck: [TO VERIFY]. The first local attempt terminated with a V8 heap-out-of-memory error at the sandbox's default heap limit. A retry with a 640-MB heap remained in the first TypeScript project beyond the 180-second command limit in a 976-MiB sandbox and was stopped due to resource pressure. No TypeScript diagnostic failure was observed, but local Typecheck is not claimed as PASS. Hosted CI on the new main-targeted Draft PR must provide the complete validation.

### New main-targeted Draft integration PR

Draft PR #388 is open against main and remains Draft/unmerged. The initial PR HEAD was 60fb53160630c1850e4ee9a4b2ed41adb6d8c673. On that exact HEAD, Klar Enterprise CI Run #2184 / ID 44701180440 completed SUCCESS with Typecheck, Tests (1,583 passed), Build, Production Smoke and Browser Acceptance (34/34) all passing. Enterprise Compliance & Security Audit Gate Run #19 / ID 44701180377 completed SUCCESS; Gitleaks reported no leaks and Tier 1 found no High/Critical production vulnerabilities across 549 packages. The Tier 2 full-supply-chain advisory still reported the existing High Zod advisory GHSA-mrhx-c7xc-m3w5. This additional documentation correction creates a new PR HEAD, so the new exact-head Klar Enterprise CI and Audit Gate run IDs, conclusions and per-step outcomes remain [TO VERIFY] pending hosted execution. .github/workflows/ci.yml accepts pull_request events without a base-branch restriction; .github/workflows/enterprise-compliance-audit-gate.yml restricts its pull_request trigger to main, which the new PR will target.

No live cloud, IAM, Firestore, Storage or deployment mutation was performed. Main was not edited. productionApproved=false remains mandatory.


## PR #388 merge and CUJ-4 route-teardown hardening (2026-11-20)

### Verified merge and post-merge workflow evidence

- PR [#388](https://github.com/Veselin-Takev/Klar-Dating/pull/388) is **merged** into `main`. Merge SHA and current `main` HEAD: `06d193e054651e74736bf7a0a6911bf954a20b84` (verified identical).
- `Enterprise Compliance & Security Audit Gate` Run **#22 / ID 44711489596** on exact HEAD `06d193e054651e74736bf7a0a6911bf954a20b84`: **SUCCESS**. Gitleaks: **PASS**, `no leaks found`. Tier 1 Production Runtime Audit: **PASS**, `bun audit --prod --audit-level=high` reported no vulnerabilities across 549 checked packages (3 below the configured threshold).
- `Klar Enterprise CI` Run [#2187 / ID 44711489858](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44711489858), exact HEAD `06d193e054651e74736bf7a0a6911bf954a20b84`: **FAILURE**. Browser Acceptance: **33 passed / 1 failed**. The sole failure was CUJ-1 `cuj-onboarding-consent.spec.ts:29`: expected `Einwilligung wurde erteilt.`, received `Die Änderung konnte nicht bestätigt werden. Bitte erneut versuchen.` after the grant request had returned HTTP 200. Typecheck, Functions build, Tests (1,583 passed), Build and Production Smoke were PASS. Therefore 34/34 is not established.

### Historical CUJ-4 timeout and scoped remediation

Historical `Klar Enterprise CI` Run [#2180 / ID 44622876559](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44622876559), exact prior `main` HEAD `13cce96660ba4a35d54c222e9eeae2e31f260863`, failed only at Browser Acceptance. Playwright reported `page.unroute: Test timeout of 60000ms exceeded` at `phase2_work/tests/e2e/cuj-account-erasure.spec.ts:109`. Typecheck, Functions build, unit/integration Tests, Build and Production Smoke had completed successfully in that run.

The route callback resolves `capturePromise` after reading the upstream status and complete JSON receipt, but before its subsequent `await route.fulfill(...)` has necessarily settled. Therefore completion of `capturePromise` does not prove that the route callback has finished. The test called default `page.unroute(deletionRoute)` immediately after capture/click synchronization; this teardown waits for active route handlers and hit the 60-second test timeout before the downstream Art. 17 assertions were reached.

The hardening change removes that early blocking `page.unroute` call and invokes `page.unrouteAll({ behavior: 'ignoreErrors' })` only after all existing deletion receipt, pending-job, public-profile 404, `isVerified=false`, UID-scoped browser-state cleanup and global-theme-preservation assertions complete. It does not weaken Art. 17 or accessibility assertions, change application behavior, or add `waitForTimeout()`.

### Hardening PR evidence

- Feature branch: `fix/e2e-cuj4-unroute-flake-and-handover-docs`, based on `06d193e054651e74736bf7a0a6911bf954a20b84`.
- On the initial hardening PR HEAD `ddfb358d3d955524b4a3215e01c336ee975429f3`, `Enterprise Compliance & Security Audit Gate` Run #23 / ID `44712275190` completed **SUCCESS** (Gitleaks no leaks; Tier 1 production audit passed across 549 packages). `Klar Enterprise CI` Run #2188 / ID `44712275292` was still **[TO VERIFY] / in progress** when this documentation follow-up was prepared.
- This Docs-as-Code follow-up changes the PR HEAD; exact-head CI and Audit Gate runs for the resulting new commit are **[TO VERIFY]** until they complete.
- `productionApproved=false` remains unchanged; this merge and the green Audit Gate do not constitute production approval.

## Historical verified main baseline after PR #389 — UX / Accessibility / i18n workstream (2026-11-20)

### Immutable baseline and exact-head workflow evidence

- Prior verified main integration point from PR #388: `06d193e054651e74736bf7a0a6911bf954a20b84`.
- PR #389 merged into `main`; merge SHA and verified current `main` HEAD: `24a57615544f6a190e5a76900d49b65646a320b9` (exact match).
- `Klar Enterprise CI` [Run #44717268425](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44717268425), exact `head_sha` `24a57615544f6a190e5a76900d49b65646a320b9`: **SUCCESS**. Typecheck, Functions build, Tests (**1,583 passed / 206 files**), Build, Production Smoke and Browser Acceptance passed. Browser Acceptance recorded **34 passed (2.3m)**; the configured `tests/e2e` suite includes CUJ-1 `cuj-onboarding-consent.spec.ts` and CUJ-4 `cuj-account-erasure.spec.ts`.
- `Enterprise Compliance & Security Audit Gate` [Run #44717268456](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44717268456), same exact `head_sha`: **SUCCESS**. Gitleaks reported **no leaks found**; Tier 1 Production Runtime Audit checked 549 packages and found no High+ production vulnerabilities; Production Build passed.
- Full-supply-chain/dev-dependency advisory: existing High Zod finding `GHSA-mrhx-c7xc-m3w5`. This is a separate, non-blocking dev-dependency follow-up, not a Tier 1 production-runtime failure. Do not change dependency manifests or lockfiles in this UX/a11y/i18n workstream.
- Feature branch `feat/ux-a11y-i18n-audit-and-governance-polish` starts at the immutable verified SHA `24a57615544f6a190e5a76900d49b65646a320b9`. Its own Draft PR number/HEAD-bound CI and Audit Gate evidence remains **[TO VERIFY]** until PR creation and exact-head workflow completion.
- `productionApproved=false` remains mandatory. This baseline is authorized for feature development only, not production release.

## Historical MAIN_BASELINE_GREEN — post-PR #390 main baseline (2026-11-20)

### Immutable main baseline and post-merge evidence

- PR [#390](https://github.com/Veselin-Takev/Klar-Dating/pull/390) merged into `main` at `8352eeec82325f9a9bd3a0b2dcf90a5e33ac53ee`; the verified `main` HEAD matched this full merge SHA at the time of this handover.
- Historical PR #389 baseline remains preserved above: `24a57615544f6a190e5a76900d49b65646a320b9`, with its own exact-head CI/Audit results unchanged.
- `Klar Enterprise CI` [Run #44739816147](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44739816147), exact `head_sha` `8352eeec82325f9a9bd3a0b2dcf90a5e33ac53ee`: **SUCCESS**. Enterprise Static Gates, Typecheck, Functions Build, Tests (**1,595 passed / 209 files / 0 failed**), Build and Production Smoke passed. Browser Acceptance: **35/35 passed** (2.4m).
- `Enterprise Compliance & Security Audit Gate` [Run #44739816099](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44739816099), same exact `head_sha`: **SUCCESS**. Tier 1 Production Runtime Audit **PASS**; `bun audit --prod --audit-level=high` found no High+ vulnerability across 549 checked packages.
- Post-merge Gitleaks step in Run #44739816099 concluded successfully and reported no leaks, but its log states `0 commits scanned` for the merge-event `--no-merges --first-parent` range. The separate pre-merge PR #390 Audit Gate [Run #44737576769](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44737576769), exact PR HEAD `1a97eadd4d6094b7f95324078d598e15fb49c5e5`, scanned **30 commits / approximately 45.62 KB** and reported **no leaks found**.
- The full supply-chain audit on the PR #390 merge baseline continued to report the High dev-dependency advisory `GHSA-mrhx-c7xc-m3w5`; it was advisory-only and did not change the Tier 1 production-runtime PASS.

### Isolated Zod advisory remediation workstream

- Security branch: `security/remediate-zod-advisory-ghsa-mrhx-c7xc-m3w5`.
- Dependency commit `bdd4f68287fa56b47c77d8cc773a07becd28d3e9` is directly based on PR #390 merge SHA `8352eeec82325f9a9bd3a0b2dcf90a5e33ac53ee`; it changes `phase2_work/package.json` Puppeteer from `^25.11.0` to `^25.18.1` and updates `phase2_work/bun.lock`.
- Lockfile resolution replaces `chromium-bidi@17.0.2` (dependency `zod: ^3.24.1`, nested `zod@3.25.76`) with `chromium-bidi@157.0.8090-0` (dependency `zod: ^4.6.5`). The direct application Zod remains `4.6.6`; the MCP SDK dependency range accepts `^3.25 || ^4.0`, allowing the patched root Zod 4.6.6. The old `chromium-bidi/zod` nested lock entry is removed. No global Zod-major override is added.
- The repository owner reports that the dependency update and lockfile were generated and verified with Bun in Codespaces. This handover records the checked-in manifest/lockfile state; exact-HEAD hosted validation remains authoritative.
- The remediation branch was submitted as Draft PR [#391](https://github.com/Veselin-Takev/Klar-Dating/pull/391), with final PR HEAD `622ae73514ba212caec8397600b821648558680d`. Its exact-head `Klar Enterprise CI` [Run #44745959136](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44745959136) and `Enterprise Compliance & Security Audit Gate` [Run #44745959150](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44745959150) both completed **SUCCESS**. CI recorded 1,595 passed tests / 209 files and Browser Acceptance 35/35; the audit found no High+ findings in either the 549-package production runtime or the 1,245-package full supply chain, clearing `GHSA-mrhx-c7xc-m3w5` from the resolved graph. Its Gitleaks run scanned 2 commits / approximately 11.01 KB and reported no leaks. PR #391 subsequently merged; the exact post-merge `main` evidence is recorded in the next baseline section.
- Do not weaken or suppress `bun audit --prod --audit-level=high` or the full supply-chain audit. Keep production runtime audit hard-fail and report the Dev-inclusive advisory separately until exact-head results prove it is cleared.
- `productionApproved=false` remains mandatory. This baseline authorizes isolated development only, not production release. No merge, cloud, IAM, Firestore, Storage or deployment mutation is authorized by this handover.


## Verified MAIN_BASELINE_GREEN — post-PR #391 main baseline (2026-11-20)

### Immutable main baseline and post-merge evidence

- PR [#391](https://github.com/Veselin-Takev/Klar-Dating/pull/391) merged into main; confirmed merge SHA: 2f9a4349df652ee32246f29d1291c11136a8a769. The live main ref was verified at this exact SHA, superseding the prior PR #390 baseline 8352eeec82325f9a9bd3a0b2dcf90a5e33ac53ee.
- The PR #390 baseline and its Run #44739816147 / #44739816099 evidence remain preserved in the historical section above. The earlier PR #389 baseline and its exact-head evidence remain unchanged.
- Klar Enterprise CI [Run #44747921722](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44747921722), exact head_sha 2f9a4349df652ee32246f29d1291c11136a8a769: **SUCCESS**. Enterprise Static Gates, Typecheck, Functions Build, Tests (1,595 passed / 209 files / 0 failed), Build, Production Smoke, and Browser Acceptance (35/35 passed / 0 failed) all passed.
- Enterprise Compliance & Security Audit Gate [Run #44747921914](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44747921914), same exact head_sha: **SUCCESS**. Gitleaks step completed and reported no leaks; Tier 1 Production Runtime Audit passed with no High+ findings across 549 packages; Full Supply-Chain Audit passed with no High+ findings across 1,245 packages. The full graph had seven findings below the configured High threshold; the runtime graph had three below that threshold. The previous High Zod advisory GHSA-mrhx-c7xc-m3w5 is cleared from the resolved full dependency graph.
- **Gitleaks coverage caveat:** the post-merge push-event command used --no-merges --first-parent over the PR dependency-base-to-merge range and logged 0 commits scanned; its clean outcome alone does not prove the merge diff was scanned. The PR #391 exact-head Audit Gate [Run #44745959150](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44745959150) scanned the two PR commits (approximately 11.01 KB) and reported no leaks found.
- Release authorization remains **NO-GO**; productionApproved=false. This is a green verified development baseline, not production approval.

## Active Draft workstream — GitHub Actions Node 24 maintenance

- Branch chore/ci-actions-node24-maintenance starts directly from verified main SHA 2f9a4349df652ee32246f29d1291c11136a8a769.
- The only workflow file changed is .github/workflows/enterprise-compliance-audit-gate.yml: Gitleaks is upgraded from ff98106e4c7b2bc287b24eaf42907196329070c7 to e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e (gitleaks/gitleaks-action v3.0.0, verified node24); GitHub Script is upgraded from f28e40c7f34bde8b3046d885e986cb6290c5673b to 3a2844b7e9c422d3c10d287c895573f7108da1b3 (actions/github-script v9.0.0, verified node24). Both remain full 40-character commit-SHA pins with release comments.
- The existing github-script body uses the injected github and context objects and does not use the v9-incompatible require('@actions/github') pattern or redeclare getOctokit. Existing inputs, environment variables, permissions, Gitleaks step ID, Tier 1 hard-fail command, full-supply-chain advisory command, and CI gates are unchanged. No app dependency manifest or lockfile is changed. All other workflow action references remain full 40-character SHA pins.
- This branch's new Draft PR exact HEAD, Klar Enterprise CI Run ID/conclusion, Enterprise Compliance & Security Audit Gate Run ID/conclusion, and verification that no Node 20 deprecation warning remains in the final-head logs: **[TO VERIFY]** until hosted workflows complete on the final PR head_sha. Per Anti-SHA-Chasing, report those exact Run IDs and outcomes in the final handover / PR metadata; do not create a recursive docs-only commit to embed self-referential run IDs.


## Verified MAIN_BASELINE_GREEN — post-PR #392 main baseline (2026-11-20)

- PR [#392](https://github.com/Veselin-Takev/Klar-Dating/pull/392) merged into main; exact merge SHA and verified main HEAD: `e1eac9ffefbb70d376cbcc72b735c8c3901e37d3`. This supersedes the earlier #391 baseline `2f9a4349df652ee32246f29d1291c11136a8a769`. Prior #389/#390/#391 history and evidence above remain historical and are not rewritten or transferred.
- Klar Enterprise CI [Run #2221 / ID 44806101342](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44806101342), exact SHA `e1eac9ffefbb70d376cbcc72b735c8c3901e37d3`: SUCCESS. Static gates, Typecheck, Functions Build, Tests (1,595 passed / 209 files / 0 failed), Build and Production Smoke passed; Browser Acceptance 35/35 passed.
- Enterprise Compliance & Security Audit Gate [Run #56 / ID 44806101226](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44806101226), same exact SHA: SUCCESS. Gitleaks v3.0.0 step succeeded; Tier 1 Production Runtime Audit and Full Supply-Chain Audit passed with 0 High+ findings (549 production packages / 1,245 total packages).
- Gitleaks caveat: the post-merge push run reported 0 commits scanned because the merge event range used --no-merges --first-parent. Pre-merge PR #392 Audit Gate [Run #55 / ID 44758491336](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44758491336), exact source HEAD `b6064a89bea4e6cb455669179c5785ef25fde3f3`, scanned 2 commits and reported no leaks.
- The merged workflow keeps Gitleaks v3.0.0 and GitHub Script v9.0.0 pinned to immutable full SHAs with Node 24. No Node.js 20 Action deprecation warning appeared in the post-merge logs; separate DEP0040 (punycode) and DEP0169 (url.parse) Node API warnings were present and are not Action-runner warnings.

### Active Draft — Profile i18n migration

- Branch: feat/profile-i18n-migration, created from verified baseline `e1eac9ffefbb70d376cbcc72b735c8c3901e37d3`; intended target is main. PR lifecycle must remain Draft / unmerged.
- Scope: Profile screen and name editor/status feedback, local/remote feedback, import/interests/No-Gos, Bio Coach, radar and settings navigation; profile detail/theme selectors; profile AI-check and history labels; profile milestone card. DE/EN/ES/FR catalog namespaces have 257 profile-flow leaf keys per catalog, equal key sets and matching interpolation placeholders.
- This active PR's own Klar Enterprise CI and Enterprise Compliance & Security Audit Gate run IDs, exact head_sha, status and conclusions: [TO VERIFY] until hosted workflows complete. The baseline Run #2221 / #56 above validates only the main SHA and is not evidence for this feature branch.
- No dependency, lockfile or workflow file is changed. Art. 17 erasure, Consent, Accessibility and existing E2E assertions remain in place. No Cloud, IAM, Firestore, Storage or deployment mutation is performed.
- Anti-SHA-Chasing: after the active PR's workflows complete, report exact Run IDs and head_sha in the PR/final handover; do not create a recursive docs-only commit solely to add the PR's own run IDs.
- productionApproved=false remains unchanged; Production remains NO-GO.

## Verified MAIN_BASELINE_GREEN — post-PR #393 main baseline (2026-11-21)

- PR [#393](https://github.com/Veselin-Takev/Klar-Dating/pull/393) is merged; verified `main` HEAD is exactly `b2ae22fab32d1cb017c82116769e1d372bd384b0`. This supersedes PR #392 baseline `e1eac9ffefbb70d376cbcc72b735c8c3901e37d3). The existing #389–#392 history and exact-SHA workflow evidence above remain unchanged and historical.
- `Klar Enterprise CI` [Run #44822376842](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44822376842), job `validate` / ID `136586244158`, exact `head_sha` `b2ae22fab32d1cb017c82116769e1d372bd384b0`: **SUCCESS**. Tests: **1,603 passed / 210 files / 0 failed**; Production Smoke **PASS**; Browser Acceptance **35/35 passed**. TypeScript, Functions build, and application build completed successfully.
- `Enterprise Compliance & Security Audit Gate` [Run #44822377108](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44822377108), job `Enterprise Compliance & Security Audit` / ID `136586244987`, same exact `head_sha`: **SUCCESS**. Gitleaks: **PASS**, no leaks found; Tier 1 Production Runtime Audit: **PASS**, 549 packages / 0 High+; Full Supply-Chain Audit: **PASS**, 1,245 packages / 0 High+; Production Build: **PASS**. The below-threshold counts were 3 (runtime) and 7 (full graph); no High-or-higher finding was reported.
- These workflow results certify only the immutable `main` SHA above. They are not evidence for an active PR head and do not authorize production. `productionApproved=false` and release **NO-GO** remain mandatory.

### Issue #373 — canonical Draft remediation PR #375

- GitHub issue #373 remains **OPEN**. Canonical PR [#375](https://github.com/Veselin-Takev/Klar-Dating/pull/375), branch `security/iteration2-p0-privacy-2026-11-16`, targets `main` and remains **Draft / unmerged**. The branch is based on exact baseline `b2ae22fab32d1cb017c82116769e1d372bd384b0`; the initial verified PR head was `762bfa8067f76ee20a24375df8739a722289c4f3` (five commits ahead, zero behind). Keep #375 as the sole remediation PR for #373; do not create a parallel PR.
- Source review confirms `POST /profile/publish` reads `users/{uid}` and `account_deletions/{uid}` within one Firestore transaction before staging `public_profiles/{uid}`. Any existing erasure document blocks publication; Firestore transaction contention retries re-read the barrier, preventing a stale publication from winning after deletion. Missing user, non-adult, example-profile, and incomplete-projection conditions fail closed.
- Firestore Rules deny direct reads of an existing `public_profiles/{userId}` when `account_deletions/{userId}` exists, while retaining authentication, guest denial, requester/target Adult gating, and both-direction block checks. The Rules Emulator test seeds an actual target public-profile document before asserting the deletion-barrier read is denied.
- The endpoint suite now contains **27 expanded cases** (the original 23 plus four explicit GET requester regressions for missing user documents and persisted `blocked`, `suspended`, and `deleted` states). It also covers authentication, existing/missing erasure barrier, deletion winning a transaction retry, missing/underage/incomplete publication state, malformed recommendation queries, Guest/Adult/Block/Suspension/deletion-pending requester gates, and fail-closed recommendation errors. The Rules test explicitly verifies denial for a pre-existing public projection under an active target erasure barrier.
- These are source-level findings, not a test-pass claim. PR #375 exact-head `Klar Enterprise CI`, Rules Emulator execution, and `Enterprise Compliance & Security Audit Gate` remain **[TO VERIFY]** until their workflow runs complete on the final PR `head_sha`.

### Remaining open P0/P1 and operational blockers (GitHub issue state checked 2026-11-21)

The following tracked issues were returned as **OPEN** by GitHub at this snapshot. Their issue state is not a substitute for acceptance evidence or closure:

- **P0 privacy/security/compliance:** #202 legacy photo-retention scheduler/live verification (source-side protection is present; live scheduler/deployment evidence remains `[TO VERIFY]`); #254 multi-tenant live cutover, legacy mapping and Art. 17/RBAC isolation; #371 Art. 17 erasure worker versus verification-photo hold decisions; #373 publication/deletion race (addressed in Draft #375, pending exact-head gates and independent review); #70 TTL provisioning coverage; #55 partner conversion authenticity; #56 GDPR inventory/tracking-token/legal-basis/Art. 17 retention; #48 referral Zero-Trust identity, abuse and reward gates.
- **P1 security/privacy/functionality/governance:** #204 Storage profile-image visibility policy; #206 revocable authorization for legacy Firebase download URLs; #237 retired verification-status endpoint; #372 recommendation scan truncation at 500 profiles; #73 CODEOWNERS/specialist-review alignment; #71 API P95 SLO consistency/evidence; #57 reward/ledger lifecycle and reversal; #58 partner-pilot E2E/load/cost/operations evidence; #49 invite pass/deep links/accessibility; #50 consent-based referral measurement/experiment; #51 local liquidity/free-offer readiness; #53 reward unit-economics decision.
- **Release operations:** #8 production controls, monitoring and operational approvals remain open. No item above is cleared by the green main baseline or by PR #375 source changes.

No production approval, merge, deployment, live cloud/IAM/Firestore/Storage mutation, or production-data operation is authorized or performed by this workstream.
 
## Historical pre-merge MAIN_BASELINE_GREEN — E1 base baseline (2026-11-21)

- The verified base for E1 is `main` at exact HEAD `30250a1fc82f24834c7ada62f8453df04af20f2a`. This supersedes the older #393 main baseline above; prior #389–#393 merge history and PR #375 evidence remain preserved and SHA-bound as historical records.
- `Klar Enterprise CI` [Run #44879246458](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44879246458) validates the stated baseline: **210 test files** and **35/35 Playwright** passed.
- `Enterprise Compliance & Security Audit Gate` [Run #44879246487](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44879246487) validates the stated baseline: **0 High+** findings and **Build PASS**.
- Pre-merge tree-equivalent Gitleaks [Run #44878055568](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44878055568): **16.50 KB scanned / 0 leaks**. This is scoped to the equivalent tree evidence; it is not evidence for subsequent changed trees.
- These results certify only the exact `main` baseline above. They do not approve production or transfer to an E1 branch HEAD.
- Historical state at this pre-merge baseline: canonical E1 PR [#394](https://github.com/Veselin-Takev/Klar-Dating/pull/394) was open / Draft / unmerged, and its own exact-head checks were **[TO VERIFY]** at that time. It was subsequently merged at `7389e57a11e4a5e3e384cbfc6992345453a5dcaa`; see the post-merge baseline below.
- E1 covers Storage Rules + pure-model parity, authenticated UI media consumers, diagnostics/active Helmet, static boundary enforcement and docs reconciliation. E2 is a separate follow-up for the legacy Firestore media-reference migration and Firebase download-token revocation CLI for P1 #206.
- `productionApproved=false` remains mandatory; release remains **NO-GO**. No cloud, IAM, Firestore, Storage, bucket or deployment mutation is authorized or performed by this source change.

## Verified MAIN_BASELINE_GREEN — post-PR #394 merge (2026-11-21)

- PR [#394](https://github.com/Veselin-Takev/Klar-Dating/pull/394) merged into `main` at merge commit / verified live HEAD `7389e57a11e4a5e3e384cbfc6992345453a5dcaa`. Its first parent is the prior main baseline `30250a1fc82f24834c7ada62f8453df04af20f2a`; its second parent is the validated PR HEAD `5ed0b507c64d8e27b2252fd7c2da523769a75d97`.
- Merge commit tree SHA `07a8f7b7d758b247295e62f733f54063e558bb55` is bit-for-bit identical to the PR HEAD tree; the E1 diff contains 40 files.
- `Klar Enterprise CI` [Run #44940679530](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44940679530), exact main SHA `7389e57a11e4a5e3e384cbfc6992345453a5dcaa`: **SUCCESS** — 212 test files / 1,627 tests passed, Production Smoke passed, and Browser Acceptance 35/35 passed. Enterprise Static Gates (including the profile-media boundary check), Typecheck, Functions Build and Build passed.
- `Enterprise Compliance & Security Audit Gate` [Run #44940679384](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44940679384), exact same main SHA: **SUCCESS** — Tier 1 Production Runtime Audit checked 549 packages / 0 High+; Full Supply-Chain Audit checked 1,245 packages / 0 High+; Production Build passed.
- Post-merge Gitleaks in Run #44940679384 used `--no-merges --first-parent` and reported **0 commits / 0 bytes**; this post-merge step alone is not content-scan evidence. The complete E1 tree was scanned before merge in PR Audit Gate [Run #44939574345](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44939574345), exact PR HEAD `5ed0b507c64d8e27b2252fd7c2da523769a75d97`: **1/1 commit, 56.67 KB, 0 leaks**. Its tree SHA is identical to the merged main tree above, so this pre-merge scan covers the exact merged content.
- Preserve the immutable earlier main baseline records above; these post-merge runs certify only `7389e57a11e4a5e3e384cbfc6992345453a5dcaa`. PR #394 completes E1 for P0 #374; E2 migration and token-revocation executables remain excluded and are follow-up work under P1 #206.
- `productionApproved=false` remains mandatory and release remains **NO-GO**. Green CI, merge and successful secret scanning do not authorize production operations.

## Active Draft PR — complete Gitleaks PR-range coverage

- Base: `main` at verified HEAD `7389e57a11e4a5e3e384cbfc6992345453a5dcaa`; branch: `ci/fix-gitleaks-full-pr-range-20261121`; target: `main`; lifecycle: **Draft / unmerged** (PR number is recorded in GitHub metadata once created).
- `.github/workflows/enterprise-compliance-audit-gate.yml` replaces the Gitleaks Action's unpaginated PR commit-list lookup with a direct, full-history Gitleaks CLI scan over the event's exact `base.sha..head.sha` range. Checkout uses `fetch-depth: 0` and checks out the actual PR head. Range resolution verifies the base/head objects, ancestry, non-empty range, complete git-log commit enumeration and final checked-out HEAD; any inconsistency fails closed.
- Push events scan `before..after`; manual workflow dispatch scans the selected HEAD's parent..HEAD. The scan retains root `.gitleaksignore`, `--redact`, `--exit-code=2`, SARIF output and artifact upload. Gitleaks CLI v8.24.3 is pinned and its official release checksum manifest is verified before execution.
- Regression proof: `node --test phase2_work/scripts/gitleaks-pr-range.test.mjs` builds a deterministic 32-commit Git history and asserts that all commits, including PR commits 31, 32 and final HEAD, are in the exact scan log range; static checks reject the unpaginated action/API path.
- This Draft PR's own `Klar Enterprise CI` and `Enterprise Compliance & Security Audit Gate` runs remain **[TO VERIFY]** until completed on its exact final `head_sha`. Per `AGENTS.md` Anti-SHA-Chasing, record resulting Run IDs in the final handover/PR metadata; do not create a self-referential docs-only follow-up commit.
- No application runtime code, app dependencies, lockfiles, live Cloud/IAM/Firestore/Storage state or deployment configuration is changed. `productionApproved=false`; release remains **NO-GO**.


## Verified MAIN_BASELINE_GREEN — post-PR #395 merge (2026-11-21)

- PR [#395](https://github.com/Veselin-Takev/Klar-Dating/pull/395) merged to `main` at merge SHA / verified live `main` HEAD `83c4e31cca1a9f9e5bfb14d432f9d1bd8886532c`. Previous `main` parent: `7389e57a11e4a5e3e384cbfc6992345453a5dcaa`; validated PR HEAD: `67fdcd40c3cd27da3f31fc9ad4fc928f23a05399`.
- Merge tree SHA `6f240c6e4ce0d4eced8a47918bc5dd163cc91da7` is identical to the validated PR #395 HEAD tree. Preserve the PR #389–#395 and #375 records above as immutable SHA-specific history.
- `Klar Enterprise CI` [Run #44943576348](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44943576348), exact `head_sha` `83c4e31cca1a9f9e5bfb14d432f9d1bd8886532c`: **SUCCESS** — Enterprise Static Gates including `check-profile-media-boundary` PASS; Typecheck, Functions Build, Tests (**212 files / 1,627 passed / 0 failed**), Build and Production Smoke PASS; Playwright Browser Acceptance **35/35 passed / 0 failed**.
- `Enterprise Compliance & Security Audit Gate` [Run #44943576333](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44943576333), same exact `head_sha`: **SUCCESS** — Quality / TypeScript, Unit Tests, Compliance & Security Checks and Production Build PASS; Tier 1 Runtime Audit **549 packages / 0 High+**; Full Supply-Chain Audit **1,245 packages / 0 High+**.
- Post-merge Gitleaks in Run #44943576333 resolved the explicit push range `7389e57a11e4a5e3e384cbfc6992345453a5dcaa..83c4e31cca1a9f9e5bfb14d432f9d1bd8886532c`, used `--full-history --diff-merges=separate`, verified the official Gitleaks CLI **v8.24.3** checksum (`gitleaks_8.24.3_linux_x64.tar.gz: OK`), passed the full-range regression **4/4**, and scanned **2 commits / 42.97 KB / 0 leaks**.
- This is a development/integration baseline only. `productionApproved=false` and release **NO-GO** remain mandatory. No live Cloud, IAM, Firestore, Storage, bucket or deployment mutation is authorized or evidenced.


## Active P1 #206 E2 — media migration and token-revocation implementation

- Feature branch: `security/issue-206-e2-media-migration-revocation-20261121`, created directly from verified `main` SHA `83c4e31cca1a9f9e5bfb14d432f9d1bd8886532c`; target `main`; lifecycle **Draft / unmerged**.
- E1 PR #394 is merged at `7389e57a11e4a5e3e384cbfc6992345453a5dcaa`. E2 is the separate P1 #206 implementation: inventory alias/version coverage, dry-run-first canonical-reference migration with Firestore compare-and-set and bounded local checkpoints, and explicitly approved, metageneration-gated removal of only `firebaseStorageDownloadTokens`.
- CLI target selection fails closed unless the project and bucket exactly match the separately provisioned staging allowlist. Execution additionally requires a staging-approved manifest, its independently pinned SHA-256 digest and explicit confirmation. Dry-run is the default for both CLIs. No project/bucket has been approved or selected for a real staging run in this PR.
- Unit and emulator coverage has been added for AC-07–AC-13, including the paired authenticated proxy verification. The PR's own exact-head `Klar Enterprise CI` and `Enterprise Compliance & Security Audit Gate` are **[TO VERIFY]** until hosted workflows complete on the final PR HEAD.
- Anti-SHA-Chasing: preserve the exact baseline Run IDs above; do not create a follow-up docs-only commit to record this active PR's own moving Run IDs. Report those IDs and the final head SHA in the PR/final handover.
- Staging-only migration/revocation execution, old-token negative verification in the real staging environment, independent AppSec/DPO/SRE review and Release Owner approval remain pending. `productionApproved=false`; production remains **NO-GO**.


## Verified MAIN_BASELINE_GREEN — post-PR #398 merge (2026-11-22)

- PR #398 merged to main on 2026-11-22 at 12:25:54 UTC. Merge commit and verified main HEAD: 58888c8e9d970c5ca514dcb9960918a64c703491. Previous main HEAD / first parent: 6ef75da0b6f9effb297137ad2d0b8665a4cac1a0. Merge tree SHA: 414c1ac8340b28c5fbc0a87314dddc820cf67f69; this is identical to PR #398 pre-merge HEAD tree. PR #369 is closed, unmerged (merged=false); do not revive it as an integration base.
- Klar Enterprise CI [Run #45022239754](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45022239754), exact main SHA 58888c8e9d970c5ca514dcb9960918a64c703491: SUCCESS — 217 test files / 1,672 tests passed / 0 failed; firebaseRuntime 9/9, nativeFirestoreBoundary 19/19, storageBucketIsolation 9/9; Production Smoke passed; Playwright Browser Acceptance 35/35 passed. Enterprise static gates, Typecheck, Functions Build and Build passed.
- Enterprise Compliance & Security Audit Gate [Run #45022239746](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45022239746), same exact main SHA: SUCCESS — quality/TypeScript, unit tests, compliance/security checks and production build passed. Gitleaks full-range regression 4/4; official CLI v8.24.3 checksum verified; post-merge range 6ef75da0b6f9effb297137ad2d0b8665a4cac1a0..58888c8e9d970c5ca514dcb9960918a64c703491 scanned 1 commit / approximately 25.69 KB / 0 leaks. Tier 1 production audit: 549 packages / 0 High+; full supply-chain audit: 1,245 packages / 0 High+.
- Preserve all earlier baseline evidence as immutable history. These runs certify only main@58888c8e9d970c5ca514dcb9960918a64c703491. They do not transfer to a later feature-branch SHA and do not approve production.
- PR #398 did not change the Firestore or Storage Rules, complianceStorage production interlock, workflows or dependency lockfiles. PR #369 remains closed/unmerged.
- productionApproved=false remains mandatory; release remains NO-GO. Green CI, merge and successful secret scanning do not authorize production operations.

## Active Draft workstream — P0 #254 Package 1 tenant-context foundation

- Branch: security/p0-254-package1-tenant-context-inventory-20261122; target main at exact base 58888c8e9d970c5ca514dcb9960918a64c703491; keep Draft / unmerged. PR number and final head SHA are recorded in GitHub metadata after creation.
- Package 1 adds a source-level Firestore/Storage/Art. 17 inventory, an injectable read-only tenant context resolver and focused boundary tests. The resolver verifies Firebase ID tokens with revocation checking, reads tenants/{tenantId} and tenants/{tenantId}/members/{uid} independently, intersects signed roles with active membership roles, treats X-Tenant-ID/host only as mismatch-detecting hints, and issues a frozen non-forgeable context. It is deliberately not mounted in server.ts.
- Flat legacy collections and client SDK consumers remain unmapped. No default tenant assignment, migration, live/staging data query, Firestore/Storage Rules change, route/client rewrite, Cloud/IAM mutation, or deployment is in scope. Explicit exclusions include complianceStorage.ts (503 interlock), both Rules files, server.ts, workflows, dependencies and lockfiles. Old Draft PRs #253, #287 and #288 were not used.
- P0 #254 remains OPEN / BLOCKED pending approved row-level legacy mapping, tenant-aware Rules/routes/client cut-over, full Art. 17/legal-hold and cross-tenant negative evidence, IAM/staging evidence and independent security/DPO/Legal/SRE review.
- This branch's exact-head Klar Enterprise CI and Enterprise Compliance & Security Audit Gate results are [TO VERIFY] until completed on the final PR head SHA. Per AGENTS.md Anti-SHA-Chasing, record exact PR head and run IDs in final handover/PR metadata; do not create recursive docs-only commits for the PR's own run IDs.
- productionApproved=false; production remains NO-GO.
