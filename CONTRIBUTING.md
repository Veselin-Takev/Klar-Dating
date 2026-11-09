# Contributing to Klar

The active application, dependency graph and validation commands live in
`phase2_work/`. Start with the [developer guide](phase2_work/docs/DEVELOPMENT.md)
and [project status](phase2_work/docs/PROJECT_STATUS.md).

## Reviewable changes

Use one PR for one coherent outcome. Keep follow-up fixes in the existing branch
when they address the same review; create a child PR only for an independently
reviewable change. Use a descriptive Conventional Commit style title and the
[repository PR template](.github/pull_request_template.md). Keep generated builds,
dependency directories, local environment files and sensitive runtime evidence out
of Git. Preserve historical audit/release evidence unless its retention and
references have been reviewed.

Document the problem, final behavior, risks, relevant issue, verification and
rollback. Do not add implementation-mirroring tests for narrative changes.
Behavioral changes need relevant regression and failure-path coverage.

## Stacked PRs

For every child, identify the parent PR, exact parent SHA, intended integration
branch and remaining dependencies. Target the immediate parent branch for an
incremental review. Do not bulk-retarget children to main: doing so can expose
the entire stack as the child diff.

After parent integration, inspect the child's diff and ancestry before changing
its base. A squash/rebase merge does not preserve the original commit ancestry.
Resolve overlaps deliberately and rerun the required checks on the resulting
revision. Three-way comparisons and patch review are necessary when an alleged
replacement is not a descendant.

Prefer fixing and consolidating an existing integration PR over opening successive
audit/fix PRs for the same outcome. Link the canonical replacement from each
superseded PR and verify that unique code, tests, documentation and discussions
have been accounted for before closing it. Closure is not merge approval.

## Validation and review

Use the commands and pinned toolchain in the developer guide and the current
`.github/workflows/ci.yml`. Run applicable checks from `phase2_work/`. Record
the full tested source SHA, CI run URL, results and limitations. A parent's green
CI, a prior revision or a successful subset does not certify the child or an
integrated release candidate. Do not weaken CI scope or tests for housekeeping.

Keep unfinished work as Draft. Before requesting review, provide a focused diff,
current checks and enough evidence for an independent reviewer. Address review
threads without resolving findings that remain unfixed. CODEOWNERS identifies
technical ownership; it does not prove independent Security, DPO, SRE or release
approval.

Repository enforcement and contribution policy are distinct: verify live rules
rather than assuming these instructions configure GitHub. Code merge, staging
promotion and production approval remain separate decisions under the existing
release process.

## Cleanup cadence

Triage the queue weekly: active work, blocked dependencies, verified superseded
work, and abandoned proposals. Age alone is not a reason to close a security fix.
For blocked work, identify the dependency and next action in its PR description.
Check for bases without an open parent PR; a retained branch may still be a valid
base, so investigate before retargeting or deleting it.

Close verified superseded children before their parents. Retain branch refs while
open children, release evidence or reproducibility depend on them. Delete a branch
only after verifying those dependencies and the applicable retention requirements.
Avoid force pushes, blanket stale-PR automation and mass branch deletion as
housekeeping shortcuts. Do not merge, deploy or change protection rules merely
to make the queue appear clean.

The [8 November 2026 triage](phase2_work/docs/PR_HYGIENE_2026-11-08.md) records
the first inventory and the narrowly verified cleanup.
