# CI/CD and Security Gates

**Current `main` HEAD:** `191ce9b64205ff1e523093cf1fa3d9a523daf0e1` (includes PR #384 merge).  

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

`productionApproved=false` remains mandatory. PR #382 remains open/Draft/unmerged; PR #383 and `main` are not modified. No cloud/IAM/deployment mutation is performed.

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
