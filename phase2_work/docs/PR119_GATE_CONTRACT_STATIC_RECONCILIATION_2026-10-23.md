# PR #119 — Static mandatory-gate contract reconciliation (2026-10-23)

**Decision: NO-GO / HARD STOP. Static evidence only. No mandatory release gate was executed for this report.**
**Scope:** immutable PR #119 commit `7fdf29010c85f16a9b38e5c93186f32e92192f3a`, Git tree `05f22f0ca387ae37573b1f81e85ead901dce3da9`, GitHub tree API reported 1,300 entries with `truncated=false`. Read-only review; no CI, Docker, installs, paid services, merge or production action.

## Authoritative source observations

- The runnable application's gate working directory is `phase2_work/`, not repository root. The direct check scripts in the requested gate set exist under `phase2_work/scripts/`, but not in root `scripts/`.
- `phase2_work/package.json` declares `packageManager: bun@1.4.2`, `engines.node: >=22.23.3`, and build/typecheck/pure/rules test scripts. Source: [application package.json](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/package.json).
- The immutable tree contains `phase2_work/bun.lock` and `phase2_work/functions/package-lock.json`, **not** `phase2_work/package-lock.json`. The file [check-dependency-locks.mjs](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/scripts/check-dependency-locks.mjs) **rejects** creating a `phase2_work/package-lock.json` and requires an npm lockfile for Functions.
- The exact mandatory command `npm audit --audit-level=high` requires an npm lockfile by default; see [npm audit documentation](https://docs.npmjs.com/cli/v10/commands/npm-audit/). A separate **offline local control experiment**, npm 10.9.2, package.json plus bun.lock but no package-lock, returned `ENOLOCK` and exit 1. This is **not** a qualified execution of mandatory Gate 07.
- [Bun audit documentation](https://bun.sh/docs/pm/cli/audit) describes a security scan based on `bun.lock`; a potential Bun scan must be approved as a change to the release gate policy, never silently substituted. The separately locked Functions npm graph also needs coverage.
- The application package declares `@playwright/test` and `eslint`, but not Gitleaks or Semgrep. The exact `npx` scanner invocations must never be permitted to download arbitrary tools at audit time. Verify/approve exact binaries, versions, digests, source, configuration and the semantics of those requested commands first.
- The read-only checkout tool cannot establish trusted host identity or signatory authenticity; running it against an audit-branch checkout rather than the exact PR SHA is forbidden.

## All 15 requested gates — static contract, **not executed**

| # | Mandatory command | Static status only |
|---:|---|---|
| 01 | `npm run check:enterprise` | Script declared in phase2_work/package.json; tests not executed |
| 02 | `node scripts/check-secrets.mjs` | Source script exists under phase2_work/scripts/ |
| 03 | `node scripts/check-auth-boundary.mjs` | Source script exists under phase2_work/scripts/ |
| 04 | `node scripts/check-public-firestore-rules.mjs` | Source script exists under phase2_work/scripts/ |
| 05 | `node scripts/check-ai-pii-sanitizer.mjs` | Source script exists under phase2_work/scripts/ |
| 06 | `node scripts/check-art17-deletion-audit.mjs 0` | Source script exists under phase2_work/scripts/ |
| 07 | `npm audit --audit-level=high` | STRUCTURAL POLICY CONFLICT: Bun-only application, no application npm lockfile; npm exits ENOLOCK in offline reproduction |
| 08 | `npx gitleaks detect --source . --no-git` | SCANNER PROVENANCE OPEN: gitleaks not declared in phase2_work/package.json; do not allow unreviewed npx network install |
| 09 | `npx semgrep --config=auto --error` | SCANNER PROVENANCE OPEN: semgrep not declared in phase2_work/package.json; do not allow unreviewed npx network install |
| 10 | `npm run typecheck` | Script declared; dependencies and pinned runtime required |
| 11 | `npm run test:pure` | Script declared; dependencies and pinned runtime required |
| 12 | `npm run test:rules` | Script declared; local Firestore Emulator prerequisites required |
| 13 | `npx playwright test` | @playwright/test is declared; browser install must be trusted and pre-provisioned |
| 14 | `npm run build` | Script declared; dependencies and pinned runtime required |
| 15 | `npx eslint . --max-warnings=0` | eslint is declared; full scan not executed |

**Summary:** 15/15 commands mapped; **0/15 host-execution PASS evidenced**. Static command presence is not a PASS. **0/4 independent release approvals evidenced.** Open GitHub issues at this read-only check: **15**. PR #119 remains Draft/open/unmerged.

## Required governance decision before any host execution

1. **Release Owner + Security:** approve the exact mandatory SCA contract for **both** Bun application and npm Functions graphs, without weakening required severity thresholds or dropping Gate 07 without a formally versioned replacement. In particular, do not generate a conflicting app package-lock on the immutable candidate or use `npm audit --no-package-lock` as a quiet bypass.
2. **Security + SRE:** approve offline/pre-installed and pinned Gitleaks, Semgrep, browsers and scanner rule sets; document the exact executable names/versions and a deterministic audit command. Avoid unreviewed `npx` downloads.
3. **Release Owner:** document separate authorization for a real immutable-host run only if it can be completed **at zero monetary/CI-minute cost**, as the requester explicitly limits all current work to cost-free operations. Evidence of the approved host identity and image provenance is still missing.
4. Only after the formal gate contract is resolved, run the full approved set on the exact commit, seal raw logs, independently verify checksum and attestation provenance, and obtain Security, DPO/Legal, SRE and Release Owner approvals. Technical evidence never automatically confers GO.

## Scope and rollback

This is documentation-only and intentionally does not change `package.json`, lockfiles, dependency installation, scanner versions, GitHub workflow triggers, production settings, `main` or PR #119. Revert only this isolated audit-branch commit to roll back documentation. The existing exhausted application correction cycles and **NO-GO/HARD STOP** remain unchanged.
