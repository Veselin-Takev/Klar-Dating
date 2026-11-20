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

## Anti-SHA-Chasing and evidence lifecycle

Agents MUST distinguish an immutable verified integration baseline from the moving HEAD of an active pull request.

1. Record exact verified `main` HEADs, prior merge SHAs, and completed CI/Audit workflow Run IDs and conclusions in `docs/HANDOVER_STATUS.md` and `docs/CI_CD_AND_SECURITY_GATES.md`. Name the exact SHA each result validates; never transfer results to another SHA.
2. For an active PR, record its current PR number, branch, and HEAD when known. Mark its own pending or not-yet-observed CI and Audit results `[TO VERIFY]`. Missing or in-progress runs are not PASS.
3. Once the active PR's own workflows complete, report their exact Run IDs, `head_sha`, status, and conclusion in the PR/final handover report. Do NOT create a recursive commit or follow-up PR solely to add that PR's self-referencing Run IDs to its own source docs: that changes the PR HEAD and invalidates the exact-HEAD evidence being recorded.
4. Do not chase a moving SHA with documentation-only commits for checks belonging to the same active PR. A new commit is justified only by a substantive code, test, policy, or independently necessary documentation change. Re-run exact-HEAD gates only when the validated HEAD changes or required evidence is genuinely missing.
5. Preserve previously verified baseline evidence as immutable history. If `main` advances, record the new baseline separately; do not rewrite or relabel prior verification.

This rule complements Docs-as-Code and the `productionApproved=false` invariant; it does not waive required documentation or validation.