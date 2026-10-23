# PR #119 — Gate 07 SCA decision request (2026-10-23)

**State: UNAPPROVED. Production: NO-GO / HARD STOP.** This is a read-only, cost-free release-governance decision request, not a command or permission to run a new host audit.

Immutable target: PR #119 head `7fdf29010c85f16a9b38e5c93186f32e92192f3a`, tree `05f22f0ca387ae37573b1f81e85ead901dce3da9`.

## Independently cross-checked source evidence
All five files extracted from the original PR-119 source archive matched the canonical GitHub tree Git-blob IDs:
- `phase2_work/package.json` — `4b37a7466a1d1e9ad8669511306305f989b67ed5`
- `phase2_work/functions/package.json` — `8242b57cf8af6199dae5c30cdc69e2baa2536558`
- `phase2_work/bun.lock` — `6093576caa87c53c2a69f9416c31fb58504ece32`
- `phase2_work/functions/package-lock.json` — `6c504a9a3ecb4dd7ed8a9a799202b768ef421d94`
- `phase2_work/scripts/check-dependency-locks.mjs` — `6a3c8728b56d684f037dc6ba77c366e52fe66aa1`

Application: Bun 1.4.2, `bun.lock`, no application npm lock; the checked-in dependency policy explicitly forbids one. Functions: separate npm lock. Original Mandatory Gate 07: `npm audit --audit-level=high`, requiring an npm lockfile by default. Consequently the original Gate 07 contract conflicts with the source policy, without proving any vulnerability. The offline nonexecuting SCA contract screen on these **five SHA-matched inputs** returned **exit 1 / BLOCKED / NO-GO**. All **91/91 local audit-tooling tests PASS** using Node.js 22.16.0, which is not the production runtime. No official host gate ran.

## Proposed versioned SCA gate policy — NOT AUTHORIZED
Security and Release Owner must independently approve a compound Gate 07 covering **both** graphs, provisionally:
1. `(cd phase2_work && bun audit --audit-level=high)`, against the exact committed application `bun.lock`.
2. `(cd phase2_work/functions && npm audit --audit-level=high)`, against the committed Functions `package-lock.json`.

Both must complete with genuine exit 0 and full original logs; unreachable advisory registries, skipped packages, unknown registry policies, failing subchecks or missing evidence must fail closed. Review actual Bun 1.4.2 and npm 10.9.2 syntax/coverage on an approved host; these commands are proposals, not results. Preserve the 15-gate contract through a formally versioned composite Gate 07 with two separately evidenced substeps, or document a different approved count. Do **not** silently relabel either command as the old Gate 07 PASS.

Before an authorized host run, Security/SRE must separately approve and pin the exact Gitleaks and Semgrep binaries/configs and independent provenance; unapproved `npx` downloads are forbidden. Resolve whether private scoped dependencies are excluded, advisory service access, dev dependency coverage and the high-severity acceptance threshold.

## Sign-off fields (deliberately empty)
- Versioned replacement gate contract ID: **MISSING**
- Authenticated Security signature and timestamp: **MISSING**
- Authenticated Release Owner signature and timestamp: **MISSING**
- Approved scanner executables/digests/rules and image provenance: **MISSING**
- Approved zero-cost host identity, source SHA, and audit scope: **MISSING**
- Four independent *final* release approvals (Security, DPO/Legal, SRE, Release Owner): **0/4**
- Host-executed release gates passing: **0/15**

The user's allowance for **cost-free** work does not stand in for independent Security/Release Owner approval. No CI jobs, merges, deployments, production operations, edits to the original gate catalog, or new application correction cycles are authorized.

## Audit guard and rollback
A new **locally tested only** read-only contract-screen candidate (13/13 targeted tests; combined local audit suites 91/91) maps the immutable 15 commands and detects this discrepancy. It must be separately reviewed and remote-integrated before being used as an official audit prerequisite. A static output, even if structurally clean, never grants GO or proves host provenance. Revert this isolated documentation commit to roll back these review notes; no schema, dependency, product code or workflow change is included.

References: [prior static reconciliation](PR119_GATE_CONTRACT_STATIC_RECONCILIATION_2026-10-23.md), [SCA ADR](ADR_PR119_SCA_LOCKFILE_GATE_RECONCILIATION_2026-10-23.md), [npm audit v10](https://docs.npmjs.com/cli/v10/commands/npm-audit/), [Bun audit](https://bun.com/docs/pm/cli/audit).
