# CODEOWNERS Governance – active phase2_work (2026-10-19)

**Status:** Proposed, unmerged Draft branch. **Production:** NO-GO.

## Verified issue #73

The original root CODEOWNERS specialized /src/server/authorization.ts, /src/server/stripeService.ts and /firestore.rules, while the active application and Firestore rules live under phase2_work/. The broad engineering default did not provide the specialized security or finance assignments on those real paths. GitHub uses repository-root-relative patterns and the last matching rule.

## Remediation and reproducible checks

Root CODEOWNERS now covers the actual authorization, Trust & Safety, webhook/partner referral, Stripe, Firestore/Storage rules, retention, release manifest, Go-Live and workflow paths. Existing security, finance and engineering role identifiers have been preserved without inventing any new accounts.

The pure Node gate check:codeowners parses only the literal and directory CODEOWNERS patterns actually used for these sensitive paths. Six regression tests cover effective ownership, ordering, root/phase2 isolation, missing finance/security assignments and later general override. Integrated into check:enterprise. This static check **does not validate GitHub account/team authorization**.

## Outstanding permissions and independent approvals

The repository owner is a personal GitHub User (Veselin-Takev), while the original CODEOWNERS roles are @klar/engineering, @klar/security and @klar/finance. Team existence, visibility, write permission, GitHub CODEOWNERS API errors, base-branch CODEOWNERS and required code-owner reviews have **not** been verified. Do not mark P1 #73 as resolved. Even where multiple owners appear on one line, GitHub's CODEOWNERS approval rule does not automatically require unanimous Security+Finance reviews: independent protected-branch/environment controls remain mandatory.

**Required administrator evidence:** verify the intended reviewer identities or approved repository migration, GitHub CODEOWNERS errors for the base SHA, team/write access, protected review ruleset, and positive/negative PR reviewer routing. No unverified substitution with the sole repository owner is authorized.

## N-1 and rollback

No Firestore indexes, schema, collection fields, user data, secrets, API contracts or runtime deployment change. Prior data remains N-1 compatible. Rollback of this policy on the feature branch restores missing phase2_work specialization; do not use rollback to bypass independent security review. Main, release, TTL and Cloud resources remain untouched.

Official reference: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners


## 2026-10-23 — Verified base/head CODEOWNERS enforcement gap for Draft PR #119

The 19 October checker validated the improved **head** source but did not establish actual code-owner review requirements on the **PR base**. New cost-free proof identifies the true PR base commit `9e886c67c97201602cd969fc57dfc9bf2d019c90`, whose root CODEOWNERS Git blob is `d3873fc1d9b44883ec6c9165125144a48683b5f2` (legacy rules). The head `7fdf29010c85f16a9b38e5c93186f32e92192f3a` blob `3ecd92e7f5be76bf82adecb38705281fe5a92659` adds explicit specialist ownership. The narrowly scoped 17-path source comparison reports **base 0/17**, head **17/17** specialist coverage; a new locally tested 26-case regression checker deliberately returns **NO-GO**, and is **not** yet integrated. GitHub documents that **base** CODEOWNERS governs PR review requests, and Draft PRs are not auto-requested. PR review GET returned zero submissions. Actual team existence/write permissions and protection requiring reviews remain unconfirmed, and the GitHub connector could not read main protection (403). No source/code owners/PR/main/protection rules were changed. See `PR119_P1_73_CODEOWNERS_BASE_BRANCH_GAP_2026-10-23.md`. Issue #73 OPEN and Release NO-GO pending independent administrator proof.
