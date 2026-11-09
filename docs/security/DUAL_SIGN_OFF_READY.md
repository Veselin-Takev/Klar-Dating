# Dual Sign-Off Review Bundle — PR #360 / v0.1.1-rc1

**Bundle prepared. Release status: BLOCKED — WAITING FOR PRODUCTION EVIDENCE.**
PR #360 remains Draft; `productionApproved=false`. The requested target status
**READY FOR LEGAL & TECH SIGN-OFF** may be set only after the open evidence gates
below have been satisfied. This document records review readiness and outstanding
work; it is not a compliance certificate or a human signature.

## Evidence register

| Evidence | Source / scope | Status |
|:---|:---|:---|
| Existing code hardening | [Exact-head CI 42533662057](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42533662057), commit `7666ba45b16eaf7b640dfa22d4761390e2276411` | 1,692 PASS: 1,577 Vitest + 86 Enterprise Node + 29 browser E2E |
| Auth migration implementation | [Admin script](../../phase2_work/scripts/migrate-revoke-legacy-tokens.ts), [runbook](../../phase2_work/docs/security/LEGACY_TOKEN_MIGRATION_RUNBOOK.md) | Dry-run default, explicit scope, resumable apply, aggregate receipts |
| New migration/collector regressions | [Unit suite](../../phase2_work/tests/operationalHardening.spec.ts), [native CLI suite](../../phase2_work/tests/legacyTokenMigrationNative.spec.ts) | 22 PASS, included in the 1,714 main-suite total |
| Production Auth inventory/dry-run | Operator ADC and approved project/Auth tenant inventory | NOT RUN — no GCP identity available |
| Production legacy session and Storage capability migration | Separate Auth and Storage migration receipts | NOT EXECUTED |
| Live IAM bindings and runtime identities | [Evidence status](live-iam-evidence.json), [read-only collector](../../phase2_work/scripts/export-live-iam-evidence.ts) | UNVERIFIED — no authenticated export or state-backed Terraform plan available |
| Terraform intended grants | [Source module](../../infra/iam/main.tf), source hash in IAM status artifact | Source configuration only; not live evidence |
| Prior privacy/operational gates | [Remediation evidence](../../phase2_work/docs/security/SYSTEM_REMEDIATION_EVIDENCE.json), [go-live register](../../phase2_work/docs/GO_LIVE_EVIDENCE_REGISTER_2026-10-10.md) | Open gates preserved; no independent production attestation |

## Current verification

Local validation: **1,599 Vitest / 213 files + 86 Enterprise Node + 29 Chromium
E2E = 1,714 PASS**. The 22 operational regressions and original audit subsets are
included, not added twice. Typecheck, Enterprise gates, Functions and application
builds pass. Strict Semgrep: 616 rules, 1,183 targets, zero findings/parser errors,
700/700 first-party runtime files covered.

The isolated native CLI run passed on 2026-11-09: dry-run reported one eligible
synthetic user, zero revocations and a complete inventory; provider validity stayed
unchanged. Apply revoked once; a completed rerun inspected/revoked zero accounts.
A checkpoint tenant mismatch failed without changing provider state. This is
**emulator-only evidence**, not a production dry-run.

[Machine-readable verification and log/source hashes](OPERATIONAL_VERIFICATION.json)
record the claim scope. The full CI on the final exact PR head remains required;
consult the PR checks and final PR description for the authoritative run.

## Collect the missing IAM evidence

With an approved read-only GCP identity, a clean checkout and the pinned Node
toolchain, run from `phase2_work`:

```sh
KLAR_IAM_PRIVATE_OUTPUT="$KLAR_EVIDENCE_VAULT/iam-private.json" \
KLAR_IAM_SUMMARY_OUTPUT="$KLAR_EVIDENCE_VAULT/iam-summary.json" \
node --import=tsx scripts/export-live-iam-evidence.ts
```

Required scope variables: `KLAR_PROJECT_ID`, `KLAR_REGION`, `KLAR_SERVICE`,
`KLAR_STORAGE_BUCKET`. The user confirmed `klar-admin` as the project ID; service,
region, bucket and GCP identity remain outstanding. Existing output files are
rejected. The private raw capture
includes Cloud Run service and invoker policy, every serving/tagged revision's
identity, project and ancestor policies, bucket IAM/configuration, Firestore
database inventory, runtime service-account policy and the custom runtime Auth
role. Failure of any required read stops publication of a success receipt. Raw
Cloud Run configuration can contain personal data or secrets: keep it outside Git
in the approved restricted vault. The minimized summary contains runtime role
bindings and revision identities with SHA-256 references to the private capture.
After review, replace `live-iam-evidence.json` with that summary and record the
controlled raw-export link, reviewer, captured time and exact release/build SHA.

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
