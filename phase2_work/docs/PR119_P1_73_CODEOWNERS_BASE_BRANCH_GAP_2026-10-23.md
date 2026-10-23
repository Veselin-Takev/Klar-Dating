# P1 #73 — CODEOWNERS base-branch review gap, PR #119 (2026-10-23)

**Verified static governance gap. Release NO-GO / HARD STOP. Audit-only, zero-cost.**

## Immutable GitHub evidence

| Reference | Source | Git blob |
|---|---|---|
| PR #119 actual base: `test/p0-art17-owner-claim-cascade-regressions-2026-10-18` | commit `9e886c67c97201602cd969fc57dfc9bf2d019c90`, tree `baf1bf734d05f32d8a92cd772a35ac98a663ef4c` | root CODEOWNERS `d3873fc1d9b44883ec6c9165125144a48683b5f2` (303 bytes) |
| PR #119 head | commit `7fdf29010c85f16a9b38e5c93186f32e92192f3a`, tree `05f22f0ca387ae37573b1f81e85ead901dce3da9` | root CODEOWNERS `3ecd92e7f5be76bf82adecb38705281fe5a92659` (1,931 bytes) |

Both GitHub trees were fully enumerated (`truncated=false`). They contain a root `CODEOWNERS` and `phase2_work/CODEOWNERS`, but neither `.github/CODEOWNERS` nor `docs/CODEOWNERS`. The nested file is **not** an effective repository-level CODEOWNERS discovery location. The original two root files were also compared byte-for-byte using actual Git blob SHA-1 object identity.

## New evidence, beyond previous source-only checks

The original head already fixes the original P1 source-level ownership gap: it adds specific Security and Finance assignments for the active `phase2_work/` paths. However, **GitHub evaluates CODEOWNERS from the *base* branch of the pull request**, not the proposed head. This PR's base still uses the old root-only policy, whose `* @klar/engineering` default covers active files but the specialist `/src/server/` and `/firestore.rules` patterns do not target `phase2_work/`.

A dedicated read-only offline screen compared **17 fixed critical paths** (authorization, partner/webhooks, Stripe, Firestore/Storage, retention, production/runbook and release workflow). Results: **base 0/17 with required specialist Security/Finance roles; head 17/17**. This is a static comparison of pattern/owner strings only. It does **not** imply that the head's named teams exist, have write permission, or will actually be requested.

Local targeted regression tests: **26/26 PASS** on Node v22.16.0 (unqualified runtime), including exact blob identity, later-rule precedence, absence of base specialist coverage, unsupported patterns, forged file rejection and fail-closed CLI behavior. A genuine run on the two pinned source files returned **exit 1, BASE_CODEOWNERS_SPECIALIST_GAP, NO-GO**. The new test candidate remains **local, not yet committed** to this branch; no Enterprise host gate credit.

## Independent live GitHub checks and limits

- PR #119 remains Draft, open and unmerged. GitHub officially **does not auto-request CODEOWNERS reviews for Draft PRs**.
- GitHub GET PR reviews at the audit point returned **[] (zero submitted reviews)**.
- GitHub GET rulesets returned **[]**, but effective protection on the actual base was **not** independently attested. The GitHub App could not read the `main` branch protection endpoint (403), and the CODEOWNERS parse-errors endpoint was unavailable to this connector.
- The identifiers `@klar/security`, `@klar/finance`, `@klar/engineering` have **unverified** team existence, visibility, base-repository write access and syntactic resolution. Do not infer their valid membership from the head file or root repo ownership.
- A CODEOWNERS rule with multiple owners **does not require all of them to approve**; independent Security/Finance decision gates must be separately verified.

## Required administrator and release-owner decision

1. Independently approve the intended base branch and genuine reviewer identities; apply an audited, independently reviewed canonical CODEOWNERS policy on the **actual protected base**, without changing PR #119 or `main` under this audit-only authorization.
2. Authenticated repository administrators must verify CODEOWNERS parse errors, exact team visibility/write access and `require_code_owner_reviews`/ruleset enforcement on the **target** branch.
3. Use separate positive/negative test PRs to prove routing of Security, Finance and Privacy reviews, including prevention of unreviewed changes and author self-approval. Archive settings/IDs/dates and human authorizations.
4. Do not mark issue #73 closed or lift release HARD STOP until independently authenticated approvals are present; existing Gate 07 Bun/npm conflict, mandatory 15 host gates and four final human signoffs remain unresolved.

**No modifications** to PR #119, its base, `main`, CODEOWNERS, permissions, reviewers, CI, Cloud, production or any paid resource. Reverting this audit-only report restores the prior documentation and cannot retroactively enforce ownership.

Official docs: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners . Issue: https://github.com/Veselin-Takev/Klar-Dating/issues/73 .

**P1 #73 OPEN. Mandatory host PASS 0/15 evidenced. Independent final approvals 0/4. PRODUCTION NO-GO.**


## Read-only checker integration (2026-10-23)

The exact tested `scripts/screen-pr119-base-codeowners.mjs`, its 26 local tests and pinned base/head `CODEOWNERS` fixtures are now integrated on **the isolated audit branch only**. Repeated local tests: **26/26 PASS** on Node.js **22.16.0**. Actual pinned-source CLI: **exit 1 / `BASE_CODEOWNERS_SPECIALIST_GAP` / NO-GO**, base **0/17** specialist paths and head **17/17**. Historical input blobs match the immutable PR base/head trees. This tool does **not** authenticate a live GitHub permissions/ruleset configuration; CODEOWNERS of the actual base branch and authenticated independent reviews remain missing. No original source, main, base or PR branch modification; no CI, paid runner or production change. P1 #73 OPEN, 0/15 qualified host-gate PASS, 0/4 final independent approvals.
