# SEC-01 release CI binding — 2026-10-10

## Candidate scope

Parent: 2ec4aaaca2205adb0d7b3df56fd66d204ba22368.
This correction follows the INF-01 runtime candidate on the same non-PR branch.
Neither correction is merged or production-approved.

## Enforced publication contract

Before dependency installation and container publication, check-release-ci.mjs:

1. Requires a vMAJOR.MINOR.PATCH tag and identical checked-out HEAD, peeled tag and GITHUB_SHA.
2. Queries only api.github.com with the ephemeral workflow token and Actions read permission.
   Redirects are rejected, requests time out after 10 seconds, and pagination is capped at ten pages.
3. Selects the newest run returned for the exact SHA, push event, main branch and ci.yml workflow.
   It does not filter the query by success or fall back to older successful runs.
4. Validates run repository, source repository, workflow path, SHA, event, branch and successful completion.
5. Fetches jobs for that run attempt and requires exactly one successful validate job with the same SHA/attempt.
6. Requires every named validation step to succeed, including typecheck, Functions build, tests,
   application build, production smoke and browser acceptance. Missing, duplicate, skipped or failed steps block release.
7. Re-reads run state to reject a changed or restarted attempt during evidence collection.
8. Writes release/ci-validation.json containing SHA, run, attempt, job and required-step identifiers.
   The existing checksum ledger and artifact upload cover this file. Tokens and API bodies are not recorded.

API errors, malformed responses and incomplete evidence block publication; there is no bypass input.
CI remains separate from the release job, avoiding duplicate full application validation during publication.
The existing explicit production approval remains required. CI success does not replace operational approval.

Release dependency installation now uses bun ci and checks git diff for package.json and bun.lock.
It no longer regenerates the application lockfile. The opt-in LLM evaluation workflow is outside this correction.

## Local evidence and limits

Available interpreter: Node 24.19.0, not the required Node 22.23.3.
38 dependency-free tests passed: 32 release-policy cases plus 6 runtime/scope cases.
Coverage includes wrong identities, missing/skipped/failed stages, ambiguous jobs, API errors,
pagination, changed attempts, older-success rejection and early invalid-tag rejection.
The HTTP tests use injected fixtures; they are not a live authenticated GitHub integration test.
Runtime alignment, toolchain pins and the strengthened release structural gate passed.
Both workflows parsed as YAML; the unconditional prepublication gate and Actions read permission were verified.

Full local project validation, Docker publication and a live release integration remain unexecuted.
No Actions run, PR, main push, tag, deployment or production approval was initiated.
Before CI-triggering promotion, follow CI_RESOURCE_POLICY.md, validate with the approved toolchain
and reconcile the current incremental Actions budget. Historical balances are not current billing.

## Operating procedure

After the candidate is reviewed and merged, wait for the full main CI on the actual merge SHA.
A successful PR run or success for a parent SHA is insufficient. Tag only that validated commit,
with the independently required production approvals. Do not disable the gate to work around API failures.
If required CI step names change, update REQUIRED_STEPS and the regression coverage in the same change.
Branch protection and production-environment protections remain separate open governance controls.
This gate evaluates GitHub evidence at verification time; it is not a replacement for those protections.

## Status

SEC-01: implementation complete on candidate; full validation and merge pending.
Production: NO-GO / NOT CONFIRMED.
Next P0: BE-01 token revocation, followed by DB-01 cumulative final deletion receipts.

## API references

- https://docs.github.com/en/rest/actions/workflow-runs
- https://docs.github.com/en/rest/actions/workflow-jobs
