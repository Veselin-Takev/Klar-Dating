# Privacy hardening — fetch diagnostics (2026-10-30)

## Scope and source evidence
Related issue: #206. Baseline: `main` commit `2808dc1cbb485f70b403681c108cea5a3361d950`.
In `src/lib/api.ts`, `monitoredFetch` previously interpolated `input.toString()` in a debug message and supplied that URL to `melde` on fetch failures. Request URLs may include Firebase download tokens and other personal identifiers.

## Change in this branch
- Remove full request URLs and query strings from `monitoredFetch` diagnostics entirely. Use an invariant, non-user-supplied label instead of attempting to redact individual parameters.
- Do not forward the raw caught error to `melde`; use a synthetic, non-sensitive diagnostic error. Preserve the original exception for callers by rethrowing it unchanged.
- No Firebase Storage rules, access-token metadata, Firestore data, secrets, production configuration, deployment or other telemetry paths changed.

## Verification and release limits
- Source replacement was checked against the exact prior function body before committing, and the rewritten text was checked for the previously leaking URL interpolations.
- **Not yet verified:** full TypeScript/build/test suite, runtime behavior, CI status, Sentry pipeline, broader log sinks, Firebase download-token revocation, staging negative tests and production access boundaries.
- Review `melde` and `reportClientError` handling as part of CI/security review. The synthetic diagnostic error intentionally trades away raw exception detail to avoid leaking secrets.
- A dedicated unit test should capture debug and error diagnostics with an input containing `?token=sentinel`, assert token absence and confirm caller receives the original rejection. Include `Request` inputs as well as URL/string inputs.

## Outstanding P0/P1 blockers
- #202: Decision-aware biometric photo retention, Scheduler inventory and controlled migration.
- #204: Align actual Storage Rules and authoritative adult/active authorization model.
- #206: Move to authenticated, revocable profile image reads and rotate/revoke legacy bearer download URLs after approved inventory.
- #70, #56, #55, #8: Compliance, partner security and release approvals.
- PR #203 and #205 require independent review, exact-SHA gates, staging evidence and release governance.

**Production: BLOCKED / NO-GO.** This patch is a partial privacy mitigation only. Do not merge or deploy without required CI evidence and independent approval. No approval is presumed from this record.
