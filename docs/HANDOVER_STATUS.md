# Klar Developer Handover Status

**Snapshot:** 2026-11-20
**Main HEAD (verified after PR #388 merge):** `06d193e054651e74736bf7a0a6911bf954a20b84`
**Release decision:** **NO-GO** — `productionApproved=false` is a hard invariant.

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
- [#369](https://github.com/Veselin-Takev/Klar-Dating/pull/369): Draft Firebase runtime project/Storage identity boundary; live staging identity remains unproven.
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

### Documented dev-only Zod 3 exception

The current main lockfile records `chromium-bidi@17.0.2` with dependency `zod: ^3.24.1`, resolved as `chromium-bidi/zod -> zod@3.25.76`. `chromium-bidi` is pulled by `puppeteer` / `puppeteer-core`; `puppeteer` is declared under `devDependencies`. The direct application dependency remains `zod@4.6.6`. This specific lockfile path is a **dev-only transitive exception**, not evidence that the runtime graph uses Zod 3. Do not add a global override forcing Zod 3 to Zod 4. Resolve only through compatible parent updates and re-check with `bun why zod` when the graph changes.

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
- `Klar Enterprise CI` Run **#2187 / ID 44711489858** is attached to exact HEAD `06d193e054651e74736bf7a0a6911bf954a20b84`; at this handover snapshot it is still **[TO VERIFY] / in progress**. The final Browser Acceptance count, including the requested 34/34, is not claimed until the run completes.

### Historical CUJ-4 timeout and scoped remediation

Historical `Klar Enterprise CI` Run [#2180 / ID 44622876559](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44622876559), exact prior `main` HEAD `13cce96660ba4a35d54c222e9eeae2e31f260863`, failed only at Browser Acceptance. Playwright reported `page.unroute: Test timeout of 60000ms exceeded` at `phase2_work/tests/e2e/cuj-account-erasure.spec.ts:109`. Typecheck, Functions build, unit/integration Tests, Build and Production Smoke had completed successfully in that run.

The route callback resolves `capturePromise` after reading the upstream status and complete JSON receipt, but before its subsequent `await route.fulfill(...)` has necessarily settled. Therefore completion of `capturePromise` does not prove that the route callback has finished. The test called default `page.unroute(deletionRoute)` immediately after capture/click synchronization; this teardown waits for active route handlers and hit the 60-second test timeout before the downstream Art. 17 assertions were reached.

The hardening change removes that early blocking `page.unroute` call and invokes `page.unrouteAll({ behavior: 'ignoreErrors' })` only after all existing deletion receipt, pending-job, public-profile 404, `isVerified=false`, UID-scoped browser-state cleanup and global-theme-preservation assertions complete. It does not weaken Art. 17 or accessibility assertions, change application behavior, or add `waitForTimeout()`.

### Hardening PR evidence

- Feature branch: `fix/e2e-cuj4-unroute-flake-and-handover-docs`, based on `06d193e054651e74736bf7a0a6911bf954a20b84`.
- New Draft PR CI and Audit Gate exact-head run IDs/conclusions: **[TO VERIFY]** until GitHub Actions completes. Do not infer PASS.
- `productionApproved=false` remains unchanged; this merge and the green Audit Gate do not constitute production approval.
