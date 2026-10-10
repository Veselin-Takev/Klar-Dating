# Go-Live Evidence Register — Klar Enterprise
Date: 2026-10-10. Release decision: **NO-GO**. Tracking: [GitHub #8](https://github.com/Veselin-Takev/Klar-Dating/issues/8).

This register is an operational acceptance artifact. **PENDING means no verifiable production evidence is present**, not that a control has been tested and failed. Never substitute green emulator CI, static source inspection, or an offline profiler for evidence collected on the exact production release candidate.

| Gate | Evidence required | Owner / approver | Status |
| --- | --- | --- | --- |
| Exact artifact provenance | Immutable build SHA, matching successful CI run, signed/attested image digest, deployed revision | Release engineer / release approver | PENDING |
| Cloud Run IAM / identity | `audit:production-controls` output with real project, region, service, workload service account, prohibited-role review | Cloud security / security approver | PENDING |
| Secret governance | Rotation ticket, version metadata without values, post-rotation functional smoke and revocation check | Secret custodian / security approver | PENDING |
| Monitoring / P95 SLO | Enabled policy for P95 > 1500 ms, service dashboard, verified notification channel and timestamped alert delivery and acknowledgement | SRE / on-call owner | PENDING |
| Observability / privacy | Protected metrics endpoint, collector ingest/export, Sentry opt-in/PII filter check and trace correlation | SRE and privacy owner | PENDING |
| GDPR / account erasure | Real integration evidence for Art. 17 cascading deletion, retention and audit immutability; restore/error behavior | Privacy / DPO | PENDING |
| KYC / payment / cancellation | Signed Didit webhook replay/abort guards, Stripe failure path, §312k cancellation and notification receipts | Security / product/legal | PENDING |
| Canary and rollback | Deployment checklist, rehearsal timestamp, automatic stop conditions, rollback to prior revision and ownership | Release engineer / incident commander | PENDING |
| Final signoff | Explicit security, privacy, operations and business signoffs tied to one release SHA | Authorized release approvers | PENDING |

## Release acceptance rules

1. Resolve one exact candidate SHA and deployment artifact digest. Associate every evidence artifact with the same commit and environment. Any candidate source change invalidates the prior signoff for the changed artifact.
2. Run `npm run audit:production-controls` in an authorized real-cloud environment using the required `KLAR_*` variables specified in `docs/PRODUCTION_CONTROLS_AUDIT.md`; store evidence in an access-controlled location outside Git. Verify the live Cloud Run service account, secret bindings, IAM and notification policies.
3. Run the operational evidence validator with the **exact SHA**, and independently witness alert notification delivery, on-call acknowledgement, secret rotation and smoke tests. Record who reviewed each gate, when, source revision and evidence URI. Do not commit secrets, raw PII, or cloud access tokens.
4. Reconcile the incremental GitHub Actions allowance of **100 minutes** against billed usage before scheduling a remote run. Do not start remote workflows simply to complete this register.
5. **STOP/NO-GO** on missing evidence, wrong SHA, unverified IAM boundary, failed live alert delivery, incomplete privacy flow, absent rollback proof, or unsigned required approver. Production approval must be explicit, never inferred from green CI.

## Current evidence boundary

The last known main CI run `38036361126` passed on SHA `3f0fc4b70551e1d580040e9dd7722931fe87e83d` (2026-10-10); this is **development validation only**. The unmerged candidate branch `ci/optimize-llm-evaluation-frozen-install-2026-10-10` has narrower isolated Node-based component tests; it has **not** passed exact candidate full frozen-toolchain validation. There is no verified evidence of deployed production controls, alert delivery, on-call acknowledgement, rotation or live rollback in the inspected issue. All listed gates remain PENDING and release remains NO-GO.

This register is updated as proof becomes available. The final approval is a deliberate release-management decision, not an automated interpretation of this Markdown file.


## 2026-10-10 — Operational evidence validator CLI contract corrected

**Defect confirmed by source inspection:** `scripts/validate-operational-control-evidence.ts` previously supplied only `(evidence, buildSha)` to `validateOperationalControlEvidence`, which requires `(evidence, buildSha, expectedEnvironment, approvedEvidenceHosts, evidenceNotBefore)`. With the missing host list, the validator attempted `.map()` on `undefined`. This rendered the published operational evidence command unusable.

**Candidate fix committed:** the CLI now requires an explicitly supplied exact lowercase 40-character SHA (no ambiguous CI/environment fallback), explicit `KLAR_EVIDENCE_ENVIRONMENT` (`production` or `staging`), a comma-separated DNS-only `KLAR_APPROVED_EVIDENCE_HOSTS` allowlist, and `KLAR_EVIDENCE_NOT_BEFORE`. All five parameters are passed to the existing domain validator. Missing/malformed parameters reject the command instead of implicitly widening trust.

Example (illustrative only; substitute authentic private host policy and candidate SHA):
```sh
cd phase2_work
KLAR_EVIDENCE_ENVIRONMENT=production \
KLAR_APPROVED_EVIDENCE_HOSTS=records.example.org \
KLAR_EVIDENCE_NOT_BEFORE=2026-10-10T00:00:00Z \
npx tsx scripts/validate-operational-control-evidence.ts /private/controls.json <exact-40-character-commit-sha>
```

**Current validation boundary:** source-level correction; no real production evidence was retrieved, no cloud-side secret rotation or alert drill was executed, and the full local pinned-toolchain test suite remains unrun. A schema PASS alone is not release authorization; the security and SRE owners must still attest evidence authenticity and provenance. The release remains NO-GO; no new GitHub Actions minutes were used.


## 2026-10-10 — Strict timestamp and evidence URL safety

The domain validator `src/server/platform/operationalControlEvidence.ts` has been tightened: exercise timestamps and the `evidenceNotBefore` threshold must use complete ISO-8601 datetimes with an explicit `Z` or offset, rather than relying on permissive `Date.parse()` coercion of date-only or natural-language input. Evidence URLs now reject embedded usernames, passwords, URL fragments, or empty hosts; approved-host allowlisting and exact build-SHA checks remain mandatory. Added two Vitest regression cases in `tests/operationalControlEvidence.spec.ts` to verify these rules.

**Status:** Source changes and regression tests have been committed on the isolated candidate branch. A full local test execution under Node 22.23.3 / Bun 1.4.2 and an actual production evidence review remain PENDING. This is no claim of a passed test suite or operational approval. No new Actions workflows or deployments were initiated. Release remains **NO-GO** and the incremental 100-minute Actions limit remains binding.
