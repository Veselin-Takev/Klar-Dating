# P1 Issue #73 — CODEOWNERS, reviewer identity and protected merge policy audit

**Review date:** 2026-10-23  
**Status:** **BLOCKED / NO-GO** — reviewer and branch governance have **not** been independently validated.  
**Repository:** `Veselin-Takev/Klar-Dating` (GitHub metadata: **public**, owner `Veselin-Takev`, owner account type `User`, default branch `main`).  
**In-scope [Draft PR #119](https://github.com/Veselin-Takev/Klar-Dating/pull/119):** HEAD `7fdf29010c85f16a9b38e5c93186f32e92192f3a` -> base `9e886c67c97201602cd969fc57dfc9bf2d019c90` (branch `test/p0-art17-owner-claim-cascade-regressions-2026-10-18`), open and not merged.  
**Change scope:** Documentation only on `docs/ci-governance-audit-2026-10-23`; no change to `main`, frozen PR #119, CODEOWNERS configuration, workflows, GitHub settings, Cloud or production.

**Method:** Read-only GitHub connector calls, full CODEOWNERS source comparison, PR review metadata, repo metadata and GitHub official CODEOWNERS/ruleset documentation. No tests, commands, security scans, CI, PR mutations or owner/team approval actions were executed. An API denial is **unknown**, never proof that a required protection is absent or active.

## 1. Exact source and enforcement findings

| Check | Observed result at audit | Implication |
| --- | --- | --- |
| Repository identity | GitHub `get_repo`: `owner.type="User"` and `owner.login="Veselin-Takev"`, repository visibility public, default `main` | This is a **personal-account repository**. Team-style `@klar/...` references must **not** be assumed valid organization teams with write permission in this repository. |
| Actual CODEOWNERS file | `/CODEOWNERS` exists on `main`, PR base and PR head; `/.github/CODEOWNERS` and `/docs/CODEOWNERS` lookups returned 404 on all three refs | Root file is the source considered under GitHub's file location precedence, subject to GitHub parsing and owner permission checks. |
| PR #119 base CODEOWNERS | [Base file](https://github.com/Veselin-Takev/Klar-Dating/blob/9e886c67c97201602cd969fc57dfc9bf2d019c90/CODEOWNERS), blob `d3873fc1d9b44883ec6c9165125144a48683b5f2`; default `* @klar/engineering`; specialist Security/Finance targets only old root paths `/src/server/...`, `/firestore.rules`, `/storage.rules`; `/.github/` generic engineering | The active `/phase2_work/src/server/*`, `/phase2_work/firestore.rules` and `/phase2_work/storage.rules` have **no explicit specialist rule in the base CODEOWNERS**. |
| PR #119 head CODEOWNERS | [HEAD file](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/CODEOWNERS), blob `3ecd92e7f5be76bf82adecb38705281fe5a92659`, adds `/phase2_work/`, partner routes, authorization, deletion, Stripe, rules, retention, manifest, release/CI policy and `/.github/workflows/` specialist owner patterns | HEAD-side specificity improves **static source coverage**, but GitHub applies the **base branch's** CODEOWNERS for current PR review routing. |
| Main CODEOWNERS | Same blob `d3873fc1...` as PR base at inspection | Direct merge to `main` from the current configuration would likewise lack effective `phase2_work` specialist-path rules. No merge is authorized. |
| Owners referenced in source | `@klar/engineering`, `@klar/security`, `@klar/finance` | GitHub teams are organization member groups with repository access. Since this is a personal repository, **their eligibility as GitHub CODEOWNERS here is not established**, even if an unrelated `klar` organization exists. Fixing path patterns alone does not prove real reviewers. |
| Reviews / reviewer requests | `list_pull_request_reviews` returned **0 submitted reviews**; `get_pr_info` `requested_reviewers=null`, `requested_team_reviewers=null` | No submitted approval attests the examined PR. Draft PRs do **not automatically request** CODEOWNERS reviews. Null requested-reviewer lists are not standalone proof of active invalid CODEOWNERS but provide no positive reviewer assignment proof. |
| GitHub repository Rulesets | Read-only `GET /repos/Veselin-Takev/Klar-Dating/rulesets` returned literal `[]` | No repository-level rulesets were listed by this API. This **does not prove** absence of all branch protection or other repository policies. |
| Classic main branch protection | `GET /repos/.../branches/main/protection` returned **403, `Resource not accessible by integration`** | **UNVERIFIED** due to insufficient GitHub integration scope. Do not claim enabled/disabled, required reviewers/checks, stale-review dismissal or admin bypass status. |
| Other branch protection APIs | URL for slash-containing base branch not accepted by the GitHub fetch wrapper; branch-effective-rules URLs also not permitted | **UNVERIFIED**. Do not infer default settings or bypass. |
| Static `check-codeowners.mjs` | [HEAD script](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/scripts/check-codeowners.mjs) has literal-path owner assertions (including `phase2_work` security/finance). Source script explicitly warns: `GitHub team permissions and branch rules NOT VERIFIED`. | It validates **strings and source precedence** on a checkout only; no GitHub team membership/write permissions, successful codeowner requests or protected branch settings. **Not executed during this review**. |

## 2. Important GitHub semantics and why one CODEOWNERS PASS is insufficient

GitHub's published rules require CODEOWNERS to be in the pull request **base branch** to generate relevant review requests. Team codeowners need a visible team with **explicit write permission**, and `@org/team` entities are tied to GitHub organizations. Draft PRs do not automatically send CODEOWNERS review requests. When a CODEOWNERS rule lists several owners for the same path, **approval from any one of them** can meet the ordinary "Require review from Code Owners" condition; that does **not** force distinct Security and Finance signoffs.

Sources:
- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners
- https://docs.github.com/en/organizations/organizing-members-into-teams/about-teams
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule

**Distinction:** CODEOWNERS review is a *merge workflow* approval, not an independent DPO/Legal/SRE operational attestation. A row containing `@klar/security @klar/finance @klar/engineering` cannot independently guarantee one acceptance from each specialty. Release gating needs separately authenticated approvals bound to the immutable SHA.

## 3. Remediation options — policy decisions, NOT performed

| Option | Preconditions and tradeoff | Recommended acceptance gate |
| --- | --- | --- |
| **A. Stay in personal repository with named human CODEOWNERS** | Verify actual individual GitHub usernames and explicit **write** permission; replace unsatisfiable `@klar/team` placeholders with eligible `@username` owners on the protected base branch, after owner authorization and approved branch strategy | Each required source path resolves to at least one **real eligible** codeowner; human reviewers are distinct from last pusher and ownership conflicts; no default placeholder pretending to be review. |
| **B. Formally migrate repository to an approved GitHub organization** | Separate change-management project; verify owners, billing/runner/security settings, redirects, access, Actions secrets, audit/protection migration and user approval. An organization named `klar` or teams of that name must be verified, not invented. | Actual `@org/team` owner paths, team visibility/write permission and protected rulesets confirmed under new repo identity, historical signatures/CI validity reviewed |
| **C. Independent role attestations independent of CODEOWNERS** | On current/personal repository, use approved protected merge workflow, independent named Security/Finance reviewer approvals plus separate DPO/Legal/SRE signoffs in a controlled evidence system; enforce via independently reviewed, non-bypassable trusted check/merge policy if platform supports | Negative tests: one engineering approval must **not** satisfy Security+Finance approval requirement, and a release without DPO/Legal/SRE fails closed |

**Recommendation for current locked repo:** Request an explicit Release Owner decision between Option A and Option B. Until then keep `NO-GO`; **do not** assume silently that the HEAD `@klar/*` patterns enable specialists. If remaining in a personal repository, prefer explicit eligible individual codeowner usernames and a policy separate from CODEOWNERS for cross-domain signoffs. Any required source or settings change must be made on an **authorized dedicated governance branch only after audit unlock**, with reviewed rollback and required checks; never by editing this report's documentation branch as a substitute.

## 4. Required evidence and negative acceptance cases after authorized unlock

| Case | Required proof | Owner | Status |
| --- | --- | --- | --- |
| Repository ownership topology | Exact owner account type, eligible user/team principals, write permission and CODEOWNERS error/validation output at base SHA | Repository Admin | **PARTIAL**: owner type verified; eligibility unverified |
| Effective CODEOWNERS branch selection | Active `/CODEOWNERS` at actual PR **base** and `main`; all critical `phase2_work` and `.github/workflows` paths covered | Repository Admin + Security | **FAIL in source-path specificity** on inspected base; updated head-only definitions not yet effective |
| Protected branch/ruleset settings | Trusted admin export of `require_pull_request_reviews`, `require_code_owner_reviews`, approval count, stale review dismissal, most-recent-push approval, required CI checks, administrator/bypass actors | GitHub Admin + Release Owner | **BLOCKED / 403** |
| Distinct specialty approvals | Real review from authorized Security for auth, consent, KYC and Rules; Finance for partner/Stripe/entitlements; DPO/Legal for retention; SRE for live changes | Security + Finance + DPO/Legal + SRE | **NOT VERIFIED** |
| Malicious or bypassed CODEOWNERS patterns | Tests reject later matching wildcard/overrides, invalid reviewer identity, old-root path reliance, foreign repo team without permissions | Security + QA | **DEFINED IN SOURCE; NOT RUN HERE** |
| PR review requests and non-Draft behavior | After explicit approval to alter PR status, verify real codeowner routing and protections. **Never** mark frozen PR #119 ready automatically or use it for test mutations | GitHub Admin + Security | **NOT AUTHORIZED** |
| Single-approver versus dual-domain control | Demonstrate that one engineering or one security approval **alone** cannot advance a sensitive finance + security code change under agreed policy | Release Owner + Security + Finance | **NOT VERIFIED** |
| Post-review source change | Approval invalidation on altered HEAD / base, stale reviews and exact SHA-bound signatures | GitHub Admin + QA | **NOT VERIFIED** |
| Exact merge candidate and post-merge main CI | All protected checks and approvers at candidate SHA, then a separate exact-SHA `main` push validation | Release Owner + SRE | **NOT AUTHORIZED** |
| Operational release attestation | Cryptographically authenticated signed 15-log intake, 14 release gates, 13 integrations, and genuine independent Security/DPO/Legal/SRE release approvals | Release Owner | **NO-GO** |

**Security caveat:** The present GitHub connector could read repository metadata, CODEOWNERS and repository-level rulesets, but could not read classic branch protection. The required next step is a **privileged read-only governance export from an authorized GitHub admin**, delivered as verifiable evidence outside the repository, not a permission bypass or branch/settings modification by this assistant. Signature/hash of any export must be independently authenticated.

## 5. Change isolation and next authorized step

- PR #119 remains Draft, open, unmerged, at HEAD `7fdf29010c85f16a9b38e5c93186f32e92192f3a`.
- Only the isolated **documentation branch** is intended to receive this source-backed report and an evidence-register link.
- No test, command, workflow run, build, CI-minute expense, source edit, production deploy, protected branch settings, reviewer request, PR transition, issue closure or merge is authorized or claimed.
- [Issue #73](https://github.com/Veselin-Takev/Klar-Dating/issues/73) stays **OPEN**. [Release Issue #8](https://github.com/Veselin-Takev/Klar-Dating/issues/8) stays **NO-GO**.
- Obtain GitHub admin export of actual branch protection and enforceable reviewer permissions; select valid owner topology and evidence route; acquire host-gate artifacts and accountable independent release signoffs **before lifting the Governance Lockdown**.

Related: [Issue #8 production gate reconciliation](ISSUE_8_PRODUCTION_GO_LIVE_GATE_RECONCILIATION_2026-10-23.md), [P0 release issue evidence register](P0_RELEASE_EVIDENCE_TRACEABILITY_2026-10-23.md), [Host evidence intake](CI_HOST_EVIDENCE_INTAKE_RUNBOOK_2026-10-23.md).

**Final result:** static source coverage in PR HEAD is improved, but **effective approval enforcement is NOT established on PR base, eligible teams or protected branch**. Official Production Readiness remains **BLOCKED / NO-GO**.
