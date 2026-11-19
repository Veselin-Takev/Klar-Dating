# CI/CD and Security Gates

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

The two-tier model is implemented on Draft PR #384 in `.github/workflows/enterprise-compliance-audit-gate.yml`; it is **not yet part of main**.

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

**Validation evidence for this candidate:** local `bun run typecheck`, `bun run test:pure` and `bun run playwright test` are **[TO VERIFY]** because no local checkout/runtime was available in the execution environment. Do not infer PASS from source inspection or a preview deployment. Record the exact commit SHA and `Klar Enterprise CI` run ID/conclusion once observed.
