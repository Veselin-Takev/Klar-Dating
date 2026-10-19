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
