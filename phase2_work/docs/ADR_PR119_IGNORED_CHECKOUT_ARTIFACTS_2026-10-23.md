# ADR — PR #119 ignored checkout artifacts must fail closed (2026-10-23)

**Decision:** Audit-tooling-only correction; technical PASS does not grant GO. **Release: NO-GO / HARD STOP.**
**Target application SHA:** `7fdf29010c85f16a9b38e5c93186f32e92192f3a`

## Reproduced problem
`git status --porcelain=v1 --untracked-files=all` omits ignored files. A clean-looking repository can contain a physical `.env`, ignored `node_modules/`, or other files affecting a later test/build. Real temporary repositories demonstrated empty default status with ignored malicious files. The existing index guard separately detects `assume-unchanged` and `skip-worktree` flags.

## Decision
Before any dependency install, query `git ls-files --others --ignored --exclude-standard -z` and require zero ignored entries. Preserve index-flag and exact HEAD/tree checks. Fail closed on probe errors, report only the presence of ignored paths (not their names, which can expose secrets). Do not modify the checkout or run any build/network operations. Once a build produces ignored files, this *pre-install* preflight must not be rerun against that altered worktree; use a fresh checkout and separate post-install gates.

## Evidence
35/35 preflight tests PASS, including temporary Git repositories with an ignored `.env`, ignored dependency subtree, clean control, and enumeration failure; 43/43 existing validator/sealer tests PASS. Combined 78/78 PASS under **local Node.js v22.16.0**, not the mandatory 22.23.3 Enterprise host. Real free-only preflight: exit **1 / NO-GO**, seven unmet local conditions. Git SHA/object proof and host attestation remain independent requirements.

## Boundaries and rollback
No application files, `main`, PR #119, lockfiles, Firestore schema/rules or deployment configuration change. No costed runner, Actions workflow, merge, deployment or host-gate execution is authorized. Rollback: revert only this audit-branch commit after impact review. Even a valid technical PASS is **not** a Security, DPO, SRE, Release Owner approval or production GO. **0/15 qualified host gates** and **0/4 independent approvals** remain evidenced.

Reference: https://git-scm.com/docs/git-ls-files
