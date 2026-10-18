# CODEOWNERS verified ownership fallback — 2026-10-18

**Status: Draft / Production NO-GO.** Repository `Veselin-Takev/Klar-Dating` is owned by a GitHub `User`, not the assumed `klar` organization. The GitHub connector verified `Veselin-Takev` has `admin` permission on this private repository. As a conservative intermediate safeguard, replace all unverified `@klar/security`, `@klar/engineering`, and `@klar/finance` CODEOWNERS identifiers with the confirmed owner `@Veselin-Takev`.

**Limitations:** This is a valid *owner identity fallback*, not an independent reviewer. The repository owner might author, approve, and merge changes; CODEOWNERS alone cannot require separate Security/Finance/Privacy approvals or enforce separation of duties. Draft PRs do not automatically request CODEOWNERS review. GitHub rulesets/branch protection, protected `main`, signed approvals from independent reviewers with write access, and audit/CI mandatory gates require separate verification and implementation before GO.

## Local validation
From `phase2_work`, run `node scripts/check-codeowners-owner.mjs`. The check verifies only a syntactic owner invariant and a critical-path inventory. It does not prove live branch protection, enforce independent approvals, or validate every CODEOWNERS gitignore pattern. Validate exact-head GitHub CODEOWNERS errors via the repository CODEOWNERS errors API with appropriate permissions.

## Future ownership migration
If this repository is transferred into a real GitHub organization, first create the approved teams and verify their visible existence and explicit write permission; then replace the fallback assignments atomically with appropriate new CODEOWNERS entries and independently enforced required reviewer policies. Revert this patch if a verified richer owner mapping is already available; never restore nonexistent organization teams. No production or GitHub Actions changes in this draft.
