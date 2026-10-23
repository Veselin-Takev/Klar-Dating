# Klar — 57 open pull requests: verified triage and cleanup plan
**GitHub snapshot 2026-10-23 | status NO-GO | no merges authorized.**

Repository: https://github.com/Veselin-Takev/Klar-Dating; `main` HEAD `bee87aea09a8d10b2e2c3fb74e38e5ecb12be008`. Open-PR inventory and **exact-HEAD check-run conclusions for all 57 PRs** were queried from GitHub. This is a **portfolio/CI/diff sampling** review, not a line-by-line semantic code audit of all 57 pull requests.

**Summary:** 57 open = 20 targeting main (12 FAIL, 6 PASS, 2 checks missing) + 37 stacked Draft PRs targeting other branches (36 FAIL, 1 checks missing). Therefore **48 CI FAIL, 6 CI PASS, 3 without check-runs; 0 PRs ready for immediate merge or release.** Historical CI PASS does not qualify a new merge SHA or production.

## Full 57-PR decision register

| Pull request | Target | Exact-head CI | Area | Merge/cleanup recommendation |
|---|---|---|---|---|
| [#121](https://github.com/Veselin-Takev/Klar-Dating/pull/121) | main | FAIL | Retention integration | BLOCK: failing TS18048; 210 commits / 99 files; split |
| [#120](https://github.com/Veselin-Takev/Klar-Dating/pull/120) | main | FAIL | GitHub Actions | BLOCK: failing provenance gate; coordinate pinned action/validator |
| [#119](https://github.com/Veselin-Takev/Klar-Dating/pull/119) | feature/test branch | NOT FOUND | Art17 / TTL | HOLD: stacked Draft; ancestor of #121; no check |
| [#118](https://github.com/Veselin-Takev/Klar-Dating/pull/118) | feature/test branch | FAIL | Art17 / TTL | HOLD: 13/20 TTL matrix/stack, consolidate |
| [#117](https://github.com/Veselin-Takev/Klar-Dating/pull/117) | feature/test branch | FAIL | Art17 / TTL | HOLD: 13/20 TTL matrix/stack, consolidate |
| [#116](https://github.com/Veselin-Takev/Klar-Dating/pull/116) | feature/test branch | FAIL | Art17 / TTL | HOLD: 13/20 TTL matrix/stack, consolidate |
| [#115](https://github.com/Veselin-Takev/Klar-Dating/pull/115) | feature/test branch | FAIL | Art17 / TTL | HOLD: 13/20 TTL matrix/stack, consolidate |
| [#114](https://github.com/Veselin-Takev/Klar-Dating/pull/114) | feature/test branch | FAIL | Art17 / TTL | HOLD: 13/20 TTL matrix/stack, consolidate |
| [#113](https://github.com/Veselin-Takev/Klar-Dating/pull/113) | feature/test branch | FAIL | Partner consent / webhook | HOLD: stacked Draft, CI fail, dependency review |
| [#112](https://github.com/Veselin-Takev/Klar-Dating/pull/112) | feature/test branch | FAIL | Partner consent / webhook | HOLD: stacked Draft, CI fail, dependency review |
| [#111](https://github.com/Veselin-Takev/Klar-Dating/pull/111) | feature/test branch | FAIL | Partner consent / webhook | HOLD: stacked Draft, CI fail, dependency review |
| [#110](https://github.com/Veselin-Takev/Klar-Dating/pull/110) | feature/test branch | FAIL | Partner consent / webhook | HOLD: stacked Draft, CI fail, dependency review |
| [#109](https://github.com/Veselin-Takev/Klar-Dating/pull/109) | feature/test branch | FAIL | Partner consent / webhook | HOLD: stacked Draft, CI fail, dependency review |
| [#108](https://github.com/Veselin-Takev/Klar-Dating/pull/108) | feature/test branch | FAIL | Partner consent / webhook | HOLD: stacked Draft, CI fail, dependency review |
| [#107](https://github.com/Veselin-Takev/Klar-Dating/pull/107) | feature/test branch | FAIL | Partner consent / webhook | HOLD: stacked Draft, CI fail, dependency review |
| [#106](https://github.com/Veselin-Takev/Klar-Dating/pull/106) | feature/test branch | FAIL | Partner consent / webhook | HOLD: stacked Draft, CI fail, dependency review |
| [#105](https://github.com/Veselin-Takev/Klar-Dating/pull/105) | feature/test branch | FAIL | Partner consent / webhook | HOLD: stacked Draft, CI fail, dependency review |
| [#104](https://github.com/Veselin-Takev/Klar-Dating/pull/104) | feature/test branch | FAIL | Partner consent / webhook | HOLD: stacked Draft, CI fail, dependency review |
| [#103](https://github.com/Veselin-Takev/Klar-Dating/pull/103) | feature/test branch | FAIL | Partner consent / webhook | HOLD: stacked Draft, CI fail, dependency review |
| [#102](https://github.com/Veselin-Takev/Klar-Dating/pull/102) | feature/test branch | FAIL | Partner consent / webhook | HOLD: stacked Draft, CI fail, dependency review |
| [#101](https://github.com/Veselin-Takev/Klar-Dating/pull/101) | feature/test branch | FAIL | Partner consent / webhook | HOLD: stacked Draft, CI fail, dependency review |
| [#100](https://github.com/Veselin-Takev/Klar-Dating/pull/100) | feature/test branch | FAIL | Partner consent / webhook | HOLD: stacked Draft, CI fail, dependency review |
| [#99](https://github.com/Veselin-Takev/Klar-Dating/pull/99) | feature/test branch | FAIL | Partner consent / webhook | HOLD: stacked Draft, CI fail, dependency review |
| [#98](https://github.com/Veselin-Takev/Klar-Dating/pull/98) | feature/test branch | FAIL | Partner consent / webhook | HOLD: stacked Draft, CI fail, dependency review |
| [#97](https://github.com/Veselin-Takev/Klar-Dating/pull/97) | feature/test branch | FAIL | Partner consent / webhook | HOLD: stacked Draft, CI fail, dependency review |
| [#96](https://github.com/Veselin-Takev/Klar-Dating/pull/96) | feature/test branch | FAIL | Partner consent / webhook | HOLD: stacked Draft, CI fail, dependency review |
| [#95](https://github.com/Veselin-Takev/Klar-Dating/pull/95) | feature/test branch | FAIL | Partner consent / webhook | HOLD: stacked Draft, CI fail, dependency review |
| [#94](https://github.com/Veselin-Takev/Klar-Dating/pull/94) | feature/test branch | FAIL | Partner consent / webhook | HOLD: stacked Draft, CI fail, dependency review |
| [#93](https://github.com/Veselin-Takev/Klar-Dating/pull/93) | feature/test branch | FAIL | Partner consent / webhook | HOLD: stacked Draft, CI fail, dependency review |
| [#92](https://github.com/Veselin-Takev/Klar-Dating/pull/92) | feature/test branch | FAIL | Marketing evidence | HOLD: stacked Draft, CI fail, dependency review |
| [#91](https://github.com/Veselin-Takev/Klar-Dating/pull/91) | feature/test branch | FAIL | Marketing evidence | HOLD: stacked Draft, CI fail, dependency review |
| [#90](https://github.com/Veselin-Takev/Klar-Dating/pull/90) | feature/test branch | FAIL | Marketing evidence | HOLD: stacked Draft, CI fail, dependency review |
| [#89](https://github.com/Veselin-Takev/Klar-Dating/pull/89) | feature/test branch | FAIL | Marketing evidence | HOLD: stacked Draft, CI fail, dependency review |
| [#88](https://github.com/Veselin-Takev/Klar-Dating/pull/88) | main | FAIL | Marketing claim matrix | HOLD: marketing claims and CI |
| [#87](https://github.com/Veselin-Takev/Klar-Dating/pull/87) | feature/test branch | FAIL | Partner visitor privacy | HOLD: security/privacy scope CI fail or missing review |
| [#86](https://github.com/Veselin-Takev/Klar-Dating/pull/86) | feature/test branch | FAIL | Partner visitor privacy | HOLD: security/privacy scope CI fail or missing review |
| [#85](https://github.com/Veselin-Takev/Klar-Dating/pull/85) | feature/test branch | FAIL | Partner visitor privacy | HOLD: security/privacy scope CI fail or missing review |
| [#84](https://github.com/Veselin-Takev/Klar-Dating/pull/84) | feature/test branch | FAIL | Partner visitor privacy | HOLD: security/privacy scope CI fail or missing review |
| [#83](https://github.com/Veselin-Takev/Klar-Dating/pull/83) | main | FAIL | Partner redirect | HOLD: security/privacy scope CI fail or missing review |
| [#82](https://github.com/Veselin-Takev/Klar-Dating/pull/82) | feature/test branch | FAIL | CODEOWNERS | HOLD: CODEOWNERS governance unresolved |
| [#81](https://github.com/Veselin-Takev/Klar-Dating/pull/81) | main | FAIL | Partner webhook | HOLD: security/privacy scope CI fail or missing review |
| [#80](https://github.com/Veselin-Takev/Klar-Dating/pull/80) | main | FAIL | Partner webhook | HOLD: security/privacy scope CI fail or missing review |
| [#79](https://github.com/Veselin-Takev/Klar-Dating/pull/79) | main | FAIL | Consent visitor | HOLD: security/privacy scope CI fail or missing review |
| [#78](https://github.com/Veselin-Takev/Klar-Dating/pull/78) | feature/test branch | FAIL | TTL staging | HOLD: 13/20 TTL matrix/stack, consolidate |
| [#77](https://github.com/Veselin-Takev/Klar-Dating/pull/77) | main | FAIL | P95 SLO | HOLD: source fix in #119/#121; fleet SLO not proven |
| [#76](https://github.com/Veselin-Takev/Klar-Dating/pull/76) | main | FAIL | CODEOWNERS | HOLD: CODEOWNERS governance unresolved |
| [#75](https://github.com/Veselin-Takev/Klar-Dating/pull/75) | main | FAIL | TTL staging | HOLD: 13/20 TTL matrix/stack, consolidate |
| [#74](https://github.com/Veselin-Takev/Klar-Dating/pull/74) | main | FAIL | Auth / profile | HOLD: auth CI failure, security E2E missing |
| [#72](https://github.com/Veselin-Takev/Klar-Dating/pull/72) | main | FAIL | Technical audit | HOLD: outdated audit + CI fail |
| [#69](https://github.com/Veselin-Takev/Klar-Dating/pull/69) | main | PASS | Partner route privacy | REVIEW SECOND; Security/DPO; privacy code |
| [#68](https://github.com/Veselin-Takev/Klar-Dating/pull/68) | main | PASS | Privacy documentation | REVIEW FIRST; DPO/Security; docs-only |
| [#67](https://github.com/Veselin-Takev/Klar-Dating/pull/67) | main | PASS | Partner route privacy | SUPERSEDED CANDIDATE: close only after successor accepted |
| [#66](https://github.com/Veselin-Takev/Klar-Dating/pull/66) | main | PASS | Partner route privacy | SUPERSEDED CANDIDATE: close only after successor accepted |
| [#65](https://github.com/Veselin-Takev/Klar-Dating/pull/65) | main | PASS | Privacy documentation | SUPERSEDED CANDIDATE: close only after successor accepted |
| [#63](https://github.com/Veselin-Takev/Klar-Dating/pull/63) | main | NOT FOUND | Privacy documentation | HOLD: no check, revalidate/superseded |
| [#62](https://github.com/Veselin-Takev/Klar-Dating/pull/62) | main | PASS | Partner route privacy | HOLD: merge conflict, overlaps routes |
| [#29](https://github.com/Veselin-Takev/Klar-Dating/pull/29) | main | NOT FOUND | Firebase ADC diagnostic | HOLD: no check, revalidate/superseded |

## P0: real CI failure causes (read original job logs)

**#120 Dependabot action pins**: [failed validate job](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/39330127982/job/119378713450) at `f9c5d5e495febec84e0f585c178ddcf636476417`. Scope: 2 workflow files, 1 commit. `check:release-workflow` **fails** because `actions/attest` was bumped from `7d8b1cacecb65f487779b3b98fd5296a018d1a1b` to `7a37fbbab9669658a566371acd1cf2f8c7a40d32`, while `phase2_work/scripts/check-release-workflow.mjs` still requires the former literal commit SHA. Remaining CI stages skipped. Solution only after Security verification of authentic action provenance: **pin a reviewed accepted SHA in both workflow and fail-closed policy validator, add mutation/regression for untrusted pins**, run tests and reauthorize exact-head CI. Never remove signed-attestation requirement.

**#121 integrated retention**: [failed validate job](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/39928292366/job/120329990475) at `ac967215604c8cb65ee116ae004b9076f181e076`. **99 modified files, 210 commits**. Enterprise static gates PASS, then TypeScript **TS18048 at src/server/observability.ts(156,179)**: optional `API_P95_SLO_MS` is possibly undefined. Correct with an explicit validated numeric return type/typed guard that **throws on invalid SLO policy**; do not mask using unchecked non-null assertions or a 1500ms fallback. Rerun all three TS configurations and complete enterprise/functional tests. GitHub compare shows **PR #119 HEAD is the direct Git ancestor of #121 HEAD (+3 commits)**; do not merge both separately. Split into isolated reviewable changes; preserve Art17 consent, TTL legal hold, exact-group and security protections.

**#119**: Draft stacked on test branch (not main), zero exact-head check-runs, no submitted reviews. BASE CODEOWNERS lacks all 17/17 specialized assignments that appear in PR head; team/write permissions and protection require administrator validation. Keep open as source/ancestry reference; no direct main merge.

## Which green checks merit review, not immediate merge?

- **#68 docs-only (3 files)**: [validate PASS all major steps](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/38615144145/job/116028200592) on historic exact commit. Draft, no submitted reviews. Verify 2026-10-14 analysis against current main and obtain DPO/Legal/Security review. **First conditional review candidate**, not product release proof.
- **#69 partner admin/webhook privacy (4 files)**: [validate PASS all major steps](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/38615452707/job/116029257921) on its historic exact commit. Adds protective no-cache/no-store/no-referrer middleware before auth/distributed limiter/HMAC and targeted error-path tests; Draft, no submitted reviews. Require current-base, HMAC/403/500 negative-case, DPO/Security and independent GitHub approval. **Second conditional review candidate**, not a cure for P0 buyer proof/third-party token privacy.
- #65/#66/#67 have historical `validate` PASS but are antecedents with overlapping content. #62 has historic PASS but GitHub `mergeable:false` (conflicts). **None eligible for immediate merge.**
- #29 and #63 lack exact-head check-runs. The other 48 failed. No approval is inferred from empty legacy combined-commit-status response.

## Cleanup queue — recommendations only, not executed
1. **Proposed supersession**: #63 and #65 → #68, after verifying exact documentation parity, provenance and acceptance of #68.
2. **Proposed supersession**: #66 and #67 → #69, after verifying all privacy middleware and test coverage. Do not close/merge before accepted successor.
3. **Conflicted #62**: independently compare personalized-link response protection with current main and #69, then decide whether rebase or close as fully duplicated.
4. **Retention/security stacks**: #75/#78/#114–#119 and #79–#113 are dependent; avoid sequential blind merges. Consolidate and revalidate every nonduplicated fix on a small branch based on updated main, close former Drafts only after accepted replacements/traceability.
5. **CODEOWNERS alternatives #76/#82**: no substitute owner with no independent approval; repository owner account versus role teams must be authenticated. Existing `main` metadata reported `protected:false`; administrative policy evidence remains missing.
6. #77 and #121 share the canonical 300ms P95 source fix, **not** a proved 30-day fleet SLO. #74 auth/profile CI FAIL, #88 claim-gates CI FAIL, no opportunistic merge.

## Evidence standard and hard stop
No unchanged CI result or `mergeable:true` waives CODEOWNERS, Security/DPO/Finance review, a full exact-source qualified host, or legal controls. Product P0 issues #47/#48/#55/#56/#70, P1 #57/#71/#73 and #8 remain. **0/15 mandatory host gates and 0/4 independent final release approvals demonstrated.**

**No PR was merged, closed, converted to Ready, retargeted, re-run or modified.** No paid CI, production, Cloud, Stripe, Firebase or main writes. This document is an *audit-branch-only recommendation*, not a permission change.
