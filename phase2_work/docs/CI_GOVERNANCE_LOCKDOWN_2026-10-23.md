# Klar — Enterprise CI Governance / Evidence Lockdown

> **Audit snapshot:** 2026-10-23 · **Decision: BLOCKED / PRODUCTION NO-GO**  
> This is a read-only evidence report, **not** a CI, privacy, security or legal attestation.  
> Prepared separately from the release stack; no application, workflow, IAM, GCP or production configuration is modified.

## Scope and exact identity

- Repository: [Veselin-Takev/Klar-Dating](https://github.com/Veselin-Takev/Klar-Dating)
- [Draft PR #119](https://github.com/Veselin-Takev/Klar-Dating/pull/119): `integration/p0-art17-retention-2026-10-19`, exact HEAD `7fdf29010c85f16a9b38e5c93186f32e92192f3a`.
- PR #119 base: `test/p0-art17-owner-claim-cascade-regressions-2026-10-18`, base SHA `9e886c67c97201602cd969fc57dfc9bf2d019c90`.
- [Draft PR #118](https://github.com/Veselin-Takev/Klar-Dating/pull/118): head `9e886c67c97201602cd969fc57dfc9bf2d019c90`, not merged.
- [Draft PR #116](https://github.com/Veselin-Takev/Klar-Dating/pull/116): head `fdcc8403bccb51a29f504c3100b31d6ddce9089d`, not merged.
- Read-only GitHub issue search returned **15 open issues**, including P0 [#47](https://github.com/Veselin-Takev/Klar-Dating/issues/47), [#48](https://github.com/Veselin-Takev/Klar-Dating/issues/48), [#55](https://github.com/Veselin-Takev/Klar-Dating/issues/55), [#56](https://github.com/Veselin-Takev/Klar-Dating/issues/56) and [#70](https://github.com/Veselin-Takev/Klar-Dating/issues/70), plus operational release [#8](https://github.com/Veselin-Takev/Klar-Dating/issues/8) and review-routing [#73](https://github.com/Veselin-Takev/Klar-Dating/issues/73).
- No submitted review or top-level PR discussion was returned for PR #119. The connector's PR-specific first-page workflow-run lookup and combined commit-status lookup returned empty arrays at the exact HEAD. **These scoped empty results are not an exhaustive search of all Actions triggers or an assertion that CI passed.**
- At that HEAD, `phase2_work/RELEASE_MANIFEST.json` states `releaseGovernance.decision = "NO-GO"`, `productionApproved = false`, and `releaseEvidence.status = "pending-dynamic-ci-and-remote-sync"`.

## Evidence classification (never convert "missing" into PASS)

| Class | Observation / required evidence | Current interpretation |
| --- | --- | --- |
| Repository snapshot | Draft PR state, exact head/base, open issue inventory, NO-GO manifest | **Verified read-only** at time of this report |
| Local source and mock regression checks | Historical targeted tests reported in PR #119 and dated docs | **Historical only**, not a complete exact-head release CI attestation |
| CI workflow and test steps | Complete successful run and step logs, correct immutable commit SHA, completed/skipped assessment | **Not verified** |
| Host execution receipts | Host `gates.tsv`, all **15 requested** individual logs/exit codes, `SHA256SUMS`, Node/Bun checksums, run identity | **Not provided or authenticated in this audit** |
| Production release validator | `release-go-evidence.mjs` specifies **14 mandatory gate names** and **13 integration names**, commit-bound receipts and role approvals | **Source contract verified; real receipts absent** |
| Firestore Art. 17 | Four genuine emulator integration scenarios including cascade/claims; logs with exact SHA | **Not verified** |
| TTL / legal holds | Independent approval for the revised **20-group** staging retention matrix; exact project/database identity; all ACTIVE policies and legal-hold review | **Not verified** |
| Supply chain / SAST | Lockfile-compatible root scan, Functions scan, Gitleaks/Semgrep, SBOM/provenance, zero unresolved Critical/High | **Not verified** |
| Governance approvals | Real Security, DPO, Legal, SRE, branch protection, eligible reviewers, release owner | **Not verified** |
| Operational release | Cloud/Monitoring alerts, notification delivery, rollback and live validation as required by issue #8 | **Not verified** |

**Reconciliation task:** The external host-audit requirement requests 15 individual gate logs, while the source release validator explicitly lists 14 mandatory gates. Do not treat the numbers as interchangeable or claim a defect merely from the count. Maintain a signed **mapping table** (host log -> command -> release gate / supplemental requirement -> SHA -> exit code -> log hash) before any GO decision. The required checks may differ by stage; never weaken either set to force an apparent pass.

## Confirmed CI/release source behavior

1. [`.github/workflows/ci.yml`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/.github/workflows/ci.yml) runs on `push` to `main` and on `pull_request`. Its principal `validate` job has static enterprise gates, typecheck, Functions build, emulator-backed tests, app build, smoke and Playwright stages within **one job**; there is no separately enforced P0 -> P1 `needs` topology.
2. [`scripts/ci-scope.mjs`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/scripts/ci-scope.mjs) limits the narrative-only shortcut to an explicit three-file allowlist; other changes require the full validation path. A green reduced run is **not** an all-gates release PASS.
3. [`scripts/check-release-ci.mjs`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/scripts/check-release-ci.mjs) requires an exact-commit, successful **main push** CI run, successful `validate` and required steps, and rechecks run attempt identity. A successful PR run alone cannot replace this release requirement.
4. [`.github/workflows/release.yml`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/.github/workflows/release.yml) triggers on matching `v*.*.*` tag pushes and requires the protected `production` environment plus release approval and exact-SHA CI validation; it is **not** evidence that release was approved.
5. Root uses a **Bun-only** dependency lock policy. The historical attempted root `npm audit --audit-level=high` resulted in `ENOLOCK`; a compatible reproducible root SCA process must be validated instead of suppressing the dependency gate or silently generating a competing lock. Perform Functions SCA separately.
6. CODEOWNERS in the PR #119 **base** (blob `d3873fc1d9b44883ec6c9165125144a48683b5f2`) lacks the `phase2_work` specialist additions in PR #119 **HEAD** (blob `3ecd92e7f5be76bf82adecb38705281fe5a92659`). Thus HEAD changes alone do not establish effective specialist review routing for that PR. Existence, eligibility and permissions of `@klar/*` teams, actual base-branch CODEOWNERS behavior, branch protection and independent specialty approvals remain to be validated. A CODEOWNERS entry with multiple owners does not itself establish multiple independent approvals.

## Ordered next actions — fail closed

**A. Evidence intake, without mutating production:** Acquire the host artifacts and signed approvals through an authorized secure channel. Verify sha256 manifest against actual bytes; bind each log to its process, exit status, time, runner identity, source SHA and toolchain. Do not commit secrets, tokens, PII or private host evidence into this repository.

**B. Governance preflight:** Map the host's 15 logs to the release validator's 14 mandatory gates plus any supplemental validation. Confirm CODEOWNERS/reviewer permissions and an enforceable approval policy, the approved 20-group TTL/legal-hold matrix, and whether the Actions runner-allocation incident is resolved.

**C. Authorized P0 revalidation:** Only after explicit lock release and CI-minute budget approval, validate secrets/auth boundaries, SAST/SCA, Firestore rules/Art. 17, TTL controls, TypeScript, unit tests and application/Functions build at the exact intended SHA. **Stop on fail/skip/unknown**; do not infer PASS from mocks.

**D. Authorized P1 revalidation:** Only after full P0 PASS, execute genuine emulator transactions, Playwright, smoke, load/SLO and rollback/operations checks and verify evidence logs. CI job topology should be hardened to express real P0-before-P1 dependencies in a future dedicated code PR, with local-first tests.

**E. Merge and release:** No direct `main` commit. Merge only after source review, required protected checks and separate human signoff on the exact merge candidate. Then require new exact-commit **main** CI proof, release identity/SBOM/provenance, production evidence and protected-environment approval before a production GO. No automatic deploy or TTL write while status is NO-GO.

## Isolation / change record

This **documentation-only branch** exists to make the audit trail durable without changing the frozen P0 integration or production candidates. It is intentionally not presented as a passing CI result or a merged authoritative release manifest.

- Production/TTL mutation: **none**
- Application or workflow modifications: **none**
- CI reruns initiated intentionally: **none**
- Merge, release tag, deployment: **none**
- Official production release: **NOT APPROVED**
- Next decision: **HOLD until independently authenticated evidence and responsible-owner unlock**

For new checks after this snapshot, append dated evidence records with exact SHA, source, scope and verification result; do not rewrite earlier observations into unqualified PASS.
