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
