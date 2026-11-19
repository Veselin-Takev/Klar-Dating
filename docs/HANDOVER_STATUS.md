# Klar Developer Handover Status

**Snapshot:** 2026-11-19  
**Main HEAD:** `14a00816a491ae50ff862c723312440a92017713`  
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
**Base:** `main` at `14a00816a491ae50ff862c723312440a92017713`  
**PR:** [#387](https://github.com/Veselin-Takev/Klar-Dating/pull/387) — Open, Draft, unmerged  
**Initial exact-head Browser Acceptance:** failed in [Klar Enterprise CI run #44602173051](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/44602173051) on HEAD `6acb0f4f0f47b7ef866c43bdba765358edbfcec4`; the remediation commit is on this branch and its new exact-head CI is [TO VERIFY]

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

The corrected code and this evidence update are included in the same remediation change. New exact-head Typecheck and Browser Acceptance results remain **[TO VERIFY]** until the next CI run completes. The Art. 17 browser test still proves request acceptance and immediate barriers only, not asynchronous deletion-worker completion.

## Release invariant

`productionApproved=false` remains mandatory. No merge, deployment, cloud/IAM/Firestore/Storage mutation, live migration or production purge is authorized by this handover. A green CI run, source-level fix or Draft PR does not equal production GO.
