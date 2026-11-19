# Klar Developer Handover Status

**Snapshot:** 2026-11-19  
**Main HEAD:** `191ce9b64205ff1e523093cf1fa3d9a523daf0e1`  
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
2. Package C [#382](https://github.com/Veselin-Takev/Klar-Dating/pull/382) precedes Package D [#383](https://github.com/Veselin-Takev/Klar-Dating/pull/383), because #383 targets #382's branch. Both are Draft. Latest observed CI: #382 success, run [44566140085](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44566140085); #383 success, run [44312127379](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44312127379). Draft and independent review still block merge.
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
