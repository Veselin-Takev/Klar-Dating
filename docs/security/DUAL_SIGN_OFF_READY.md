# Dual Sign-Off Review Bundle — PR #360 / v0.1.1-rc1

**Bundle prepared. Release gate: WAITING FOR IAM CREDENTIAL BINDING; production NO-GO.**
PR #360 remains Draft; `productionApproved=false`. The requested target status
**READY FOR LEGAL & TECH SIGN-OFF** may be set only after the open evidence gates
below have been satisfied. This document records review readiness and outstanding
work; it is not a compliance certificate or a human signature.

## Evidence register

| Evidence | Source / scope | Status |
|:---|:---|:---|
| Historical code hardening | [Exact-head CI 42533662057](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42533662057), commit `7666ba45b16eaf7b640dfa22d4761390e2276411` | 1,692 PASS: 1,577 Vitest + 86 Enterprise Node + 29 browser E2E |
| Auth migration implementation | [Admin script](../../phase2_work/scripts/migrate-revoke-legacy-tokens.ts), [runbook](../../phase2_work/docs/security/LEGACY_TOKEN_MIGRATION_RUNBOOK.md) | Dry-run default, explicit scope, resumable apply, aggregate receipts |
| New migration/collector regressions | [Unit suite](../../phase2_work/tests/operationalHardening.spec.ts), [native CLI suite](../../phase2_work/tests/legacyTokenMigrationNative.spec.ts) | 22 PASS, included in the 1,714 main-suite total |
| Production Auth inventory/dry-run | Operator ADC and approved project/Auth tenant inventory | NOT RUN — no GCP identity available |
| Production legacy session and Storage capability migration | Separate Auth and Storage migration receipts | NOT EXECUTED |
| Live IAM bindings and runtime identities | [Evidence status](live-iam-evidence.json), [read-only collector](../../phase2_work/scripts/export-live-iam-evidence.ts) | UNVERIFIED — no authenticated export or state-backed Terraform plan available |
| Terraform intended grants | [Source module](../../infra/iam/main.tf), source hash in IAM status artifact | Source configuration only; not live evidence |
| Prior privacy/operational gates | [Remediation evidence](../../phase2_work/docs/security/SYSTEM_REMEDIATION_EVIDENCE.json), [go-live register](../../phase2_work/docs/GO_LIVE_EVIDENCE_REGISTER_2026-10-10.md) | Open gates preserved; no independent production attestation |

## Current verification

**Verified code/test baseline:** commit `8910cb64be3a287459680a66a9742be896b72560`,
[full Enterprise CI 42540209271: SUCCESS](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42540209271).
The baseline verifies: **1,599 Vitest / 213 files + 86 Enterprise Node + 29 Chromium
E2E = 1,714 PASS**. The 22 operational regressions and original audit subsets are
included, not added twice. Typecheck, Enterprise gates, Functions and application
builds pass. Strict Semgrep: 616 rules, 1,184 targets, zero findings/parser errors,
700/700 first-party runtime files covered.

The isolated native CLI run passed on 2026-11-09: dry-run reported one eligible
synthetic user, zero revocations and a complete inventory; provider validity stayed
unchanged. Apply revoked once; a completed rerun inspected/revoked zero accounts.
A checkpoint tenant mismatch failed without changing provider state. The final
isolated Auth-tenant test also verifies an actual pre-migration JWT is rejected
with `auth/id-token-revoked` after apply, and a fresh session remains valid after
the completed rerun. This is
**emulator-only evidence**, not a production dry-run.

[Machine-readable verification and log/source hashes](OPERATIONAL_VERIFICATION.json)
record the claim scope. The baseline above includes the verified token script and
actual synthetic JWT rejection/survival checks. The new shell handover wrapper adds
13 separately counted synthetic regression tests for atomic publication, denied
reads, identity/scope mismatches, private outputs and preserved prior captures.
These tests do not produce production IAM evidence. Consult final PR-head CI for
the new wrapper and handover changes; the fixed baseline above remains traceable.

## Infrastruktur-Verifikation — AUSSTEHEND

**Pending: final GCP credential binding and live capture.** Project `klar-admin` is
confirmed; approved region, Cloud Run service, bucket and read-only gcloud service
account are not bound. The current IAM status remains UNVERIFIED.

The [access/variable specification](GCP_LIVE_IAM_REQUIREMENTS.md) defines
`roles/iam.securityReviewer`, supplemental `roles/run.viewer` and the bucket
metadata read permission, parent-policy scope, credential selectors and the exact
`GCP_PROJECT_ID`, `GCP_REGION`, `STORAGE_BUCKET_NAME` mapping.
The [static handover manifest](GCP_HANDOVER_MANIFEST.json) records all pending
inputs and the verified code baseline.

After binding the approved environment variables and credentials, run from the
clean repository root:

```sh
bash scripts/collect-live-iam-evidence.sh
```

The [wrapper](../../scripts/collect-live-iam-evidence.sh) stages all reads and
validates hashes/scope/identity before atomically publishing a complete private
external directory with `live-iam-evidence.json`, raw policies, toolchain evidence
and `HANDOVER_MANIFEST.json`. Failed or partial reads publish no bundle. It never
modifies the repository IAM status or grants a release approval.

Raw Cloud Run configuration may contain secrets/PII: keep it in the restricted
vault. After independent infrastructure review, copy only the approved minimized
summary into `docs/security/live-iam-evidence.json` and record its controlled
raw-export link, reviewer, capture time and exact SHA. A live capture still requires
human least-privilege review and closure of the existing release gates.

Firestore grants are captured from project/ancestor IAM; database-scoped
conditional grants require explicit review. Captured allow policies alone do not
prove effective least privilege. Review group/inherited/conditional grants, deny
policies, principal access boundaries, impersonation and cross-project access.
Inspect every granted custom role and secret resource. Run the existing
`npm run audit:production-controls` for secret mappings and monitoring configuration,
and archive actual rotation and alert-delivery exercises as required by the existing
[production controls runbook](../../phase2_work/docs/PRODUCTION_CONTROLS_AUDIT.md).

## Required Tech Lead review

- Exact release-head CI is green, including new tests, strict Semgrep, builds and E2E.
- All approved Auth namespaces have complete production dry-run and migration receipts;
  legacy media-capability migration and suspension inventory are independently attested.
- Runtime identities and project/ancestor/bucket bindings match approved Terraform intent;
  the least-privilege review covers custom roles and the boundaries listed above.
- Effective edge, ingress, shared limits, logging/retention/TTL policies, retry monitoring
  and escalation have live evidence. Rollback/recovery and on-call alert delivery are recorded.

## Required Legal Counsel review

- Art. 17/Legal Hold/all-writer race containment and per-account purge provenance are
  independently evidenced; pending or held verification assets remain contained.
- Retention schedule, legal bases, DSAR and complaint/appeal channels for locked users
  are operationally reachable and approved. Auth migration receipts contain no user PII.
- Approve the maintenance scope and user session impact, and confirm the evidence-vault
  access and retention rules for private IAM exports and operator receipts.

## Human approval record

| Role | Reviewer / identity | Exact release SHA and evidence bundle | Date / decision |
|:---|:---|:---|:---|
| Tech Lead | Pending | Pending | NOT SIGNED |
| Legal Counsel | Pending | Pending | NOT SIGNED |

Only after the evidence gates are complete, request both signatures and set
`READY FOR LEGAL & TECH SIGN-OFF`. Keep Draft until the manual approvals are
recorded. No merge, deployment, production Auth mutation or IAM apply was performed
by preparation of this bundle.
