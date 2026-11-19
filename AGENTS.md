# Repository Agent Governance

These rules are binding for every AI agent and automated coding assistant working in this repository.

## Docs-as-Code is mandatory

Whenever a change affects **pull-request status or dependency order, dependency versions or policy, CI/CD workflows or gates, or architecture/security invariants**, the agent MUST:

1. Read and verify the current repository state and the exact target branch/commit before editing.
2. Review and update `docs/HANDOVER_STATUS.md` to reflect the resulting handover state, blockers, dependencies and evidence.
3. Review and update `docs/CI_CD_AND_SECURITY_GATES.md` to reflect any changed workflows, validation commands, security controls, toolchain or release-gate behavior.
4. If either document is genuinely unaffected, explicitly record that it was reviewed and is not applicable in the PR description or change record. Do not silently skip the review.
5. Keep all statements evidence-based: identify the exact commit/PR, workflow run and conclusion where applicable. Mark missing or unverified evidence as `[TO VERIFY]`; never infer PASS.

Documentation updates are part of the same change and must be included before the work is considered complete. Do not claim Docs-as-Code compliance based only on a review that did not reconcile changed facts.

## Release authorization invariant

`productionApproved=false` MUST remain unchanged for all agent work unless an explicitly authorized release decision changes it. No AI agent may infer production approval from green CI, merged code, a successful preview deployment, or a passing review. Without explicit authorization, preserve NO-GO and do not perform production deployment or cloud/IAM mutations.

## Branch and scope discipline

- Work only on the explicitly authorized feature branch; never commit directly to `main`.
- Respect task-specific protected PRs, branches, files and operational boundaries.
- Do not merge, close, mark ready, or otherwise change PR lifecycle state unless explicitly authorized.
- Treat missing CI/security evidence as unverified, not successful.
- Keep changes narrowly scoped and report exact commit SHAs and validation evidence.
