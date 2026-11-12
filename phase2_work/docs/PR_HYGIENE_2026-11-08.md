# PR hygiene triage — 8 November 2026

This is a dated GitHub API snapshot, not a release or production approval.
Source: all open PRs, sorted by update time, paginated with 100 entries per page;
pages 1–2 returned 196 PRs and page 3 was empty. Concurrent updates can change the
queue; repeat the inventory before further actions.

## Inventory before cleanup

| Category | Count |
|---|---:|
| Open PRs | 196 |
| Draft | 194 |
| Ready for review | 2 (#315, #358) |
| Base main | 50 |
| Base another branch | 146 |
| Non-main base with no matching open parent PR | 3 |

An open parent is matched by exact base/head branch name within this repository;
this classification does not imply that a retained base branch is missing or
that the child is safe to retarget.

## Completed cleanup

The lead [#358](https://github.com/Veselin-Takev/Klar-Dating/pull/358) explicitly
consolidates #356 and #357. Both were closed as superseded, with evidence appended
to their descriptions; neither was merged and neither branch was deleted.

| Closed PR | Original head SHA | Comparison to #358 |
|---|---|---|
| #356 | 7c63dfc057394b43327b1b153817ef0fad3d5290 | ahead 36, behind 0; original head is merge base |
| #357 | e30d11e28a375d21e2ee17c6429f51ab856a2d1a | ahead 35, behind 0; original head is merge base |

The replacement head is
`04e80e803ff64b4d7d51f599e5e54ad79c4033e2`; its
[validate check](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42505817983)
was completed/success when read. This records the GitHub check result, not a fresh
local execution or an independent certification of every claim in #358.
#358 still targets `release/v0.1.1-rc1`; #355 remains the release-to-main proposal.
Manual PROMOTE and separate release approvals are not granted by housekeeping.

Arithmetic after these two closures: 194 open, 192 Draft, 2 ready; 50 against main
and 144 against other branches, before opening this housekeeping proposal.

## Next actions requiring content review

| PR | Base branch with no open parent PR | Next action |
|---|---|---|
| #219 | docs/48-atomic-referral-code-registry-adr-20261030 | Establish intended parent/integration and inspect diff before retargeting |
| #214 | docs/213-partner-concurrency-evidence-20261030 | Establish intended parent/integration and inspect diff before retargeting |
| #213 | docs/55-56-partner-trust-audit-20261030 | Establish intended parent/integration and inspect diff before retargeting |

The all-state PR lookup for each exact base branch also returned no parent PR.
No branches were deleted and no bases were changed.

#165's title says it supersedes #163, but a title alone does not prove inclusion.
Review ancestry, unique patches and discussions before closing #163. Other old
security and privacy stacks likewise require content review; age and green
ancestor CI are insufficient closure criteria. #315 remains an independent
dependency proposal until its current checks and the pin validator are reconciled.

## Governance observation

Active main ruleset `25756841` requires PRs and a strict `validate` check,
blocks deletion and non-fast-forward updates, and has no bypass actors.
At this snapshot it requires **0 approving reviews**, does not require CODEOWNER
review, does not dismiss stale reviews and does not require review-thread
resolution. These settings do not enforce the independent review expectations
in the developer guide. Address them as a separate governance change after
identifying available independent reviewers; no protection setting was changed.

## Repository improvements in this proposal

Move the subproject PR template to GitHub's recognized root `.github/` location.
Expand it with stack tracking, tested SHA/run, risk, rollback and completion
evidence. Add root contribution guidance and a README entry. These are proposed
source changes; they take effect on the default branch only after review/merge.
No application, workflow, lockfile, CODEOWNERS or production setting is changed.
