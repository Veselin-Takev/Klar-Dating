# IAM and Admin SDK boundaries — v0.1.1-rc1

Status: IMPLEMENTATION REVIEW / MIGRATION BLOCKED. baselineFixed=false;
productionApproved=false. This document is not a live IAM attestation.

## Security model and privilege inventory

Firebase client Security Rules do not restrict service-account Admin SDK calls.
The repository wrapper is an application control, not a replacement for IAM.
No deployed service-account email, effective IAM binding export, inherited
organization/folder policy or credential inventory was available in this audit.
Actual permissions are therefore UNVERIFIED; no least-privilege claim is made.

| Principal / process | Observed source access | Required boundary / evidence |
| --- | --- | --- |
| Express runtime | ADC via server/db.ts; native Firestore collection/document/transactions | Dedicated runtime identity; verified tenant context; scoped repository adoption; effective IAM export |
| Functions maintenance | functions/src/runtime.ts selects configured database/bucket | Separate maintenance identity and explicit project/database/bucket; job-specific roles and deployed service-account evidence |
| Reminder scheduler | dateReminders.ts uses direct SDK and global collectionGroup(datePlans) | Explicit tenant enumeration and scoped query strategy; no unreviewed global scan |
| CI | Synthetic loopback demo-klar emulator data | No production credential or cloud write dependency; repository-local source gates |
| Release deployer | Protected release workflow; actual cloud roles not verified | Distinct workload identity, deploy permissions separate from runtime data permissions; reviewed binding export |
| External tools/operators | Not enumerated by repository source scan | Signed owner inventory, key/token rotation evidence, IAM conditions and access logs |

Proposed permissions must be verified against actual workload needs: runtime
Firestore data access is typically covered by roles/datastore.user; this role
is database-wide and does NOT enforce arbitrary document-path tenant isolation.
Do not describe a tenants/{id} path prefix as an IAM sandbox. Hard IAM tenant
boundaries may require separate databases/projects and identities. Storage
object permissions, Auth administration and scheduler invocation require their
own reviewed grants. Owner/Editor, service-account key creation and token-creator
roles are not justified merely by application data access.

## TenantAwareFirestoreRepository

src/server/TenantAwareFirestoreRepository.ts keeps its native db private and
resolves the supported default namespace from server-verified claims. Every
operation uses tenants/default/{relativeDocumentPath}; explicit tenant paths,
traversal, empty segments and ambiguous encodings are rejected. Read/write data
must pass the supplied Zod schema. There are no raw refs, global collectionGroup,
transactions or arbitrary query escape hatches. Named-tenant provisioning is
unsupported by the current resolver. Tenant isolation does not replace
per-resource user authorization inside a tenant.

The wrapper is currently a migration target, NOT the access path for the whole
legacy application. docs/security/LEGACY_ADMIN_ACCESS.json under phase2_work
pins the source hashes of 50 legacy consumer files. The CI drift guard detects
added or changed matched access sites and demands review. It is a bounded
lexical inventory, not complete dataflow analysis: aliases, dynamic access,
reflection, other source trees and external writers need independent review.
`node scripts/check-admin-sdk-boundaries.mjs --certify` deliberately FAILS while
those files remain. An inventory refresh is not a certification or remediation.

## Mandatory migration before adoption / certification

1. Define the complete tenant lifecycle, claims mapping and job execution context.
2. Map each root collection and subcollection to tenant ownership, including
   global/system data, payment/customer mapping, Art.17, audit and legal holds.
3. Migrate references, transactions, queries, indexes, Functions triggers,
   Scheduler jobs, clients and client Rules together. Current Rules do not
   authorize client access to tenants/{tenant}/...; a wrapper-only path switch
   would silently split server and client state.
4. Create a reviewed dry-run manifest with counts/hashes, consistent cutover,
   rollback and deletion/hold invariants. Never run this migration against real
   data as part of a source-code audit.
5. Remove legacy consumers, deny unscoped factories/imports, test native
   transaction/reference escape attempts and obtain independent IAM evidence.
6. Run full candidate CI plus deployed negative access tests and human review.

## Evidence and limitation

Tests exercise the wrapper with typed doubles and native emulator data, confirm
root records are unchanged, and reject foreign tenant paths. The source-gate
negative test adds an unscoped consumer in a temporary Git fixture and verifies
rejection; the certification test verifies refusal while legacy access exists.
Prior CI counts are historical until the new candidate completes CI. No claim
of zero cross-tenant access, universal wrapper adoption or production readiness
is supported while the legacy list is nonempty.

## Verified Admin wrapper checkpoint — 2026-11-08

[Full CI 42480731945](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42480731945)
SUCCESS on code `b0dca22ce84b722bbdc9d6ba2ea3419c0fb47056`:
1,437 Vitest + 86 Enterprise Node + 26 Browser = **1,549 PASS**.
Additional mandatory Admin-source negative test: 1 PASS. Dedicated Rules: 92
PASS repeated, not double-counted. Typecheck, Functions/App builds and smoke PASS.
Native emulator verifies scoped repository read/write/delete without modifying
legacy root data. This is wrapper verification, not universal adoption.

**Admin SDK gate closure FAILED:** 50 legacy consumer files remain unmigrated.
The --certify command returns failure as designed. The source scanner detects
matched access drift, not all possible alias/reflection bypasses. Wrapper-only
path rewriting would split existing root-based clients, Rules, transactions and
jobs; the migration plan must be implemented and tested before adoption.
Effective deployed IAM and external writer inventory are still UNVERIFIED.
IAM_AND_ADMIN_BOUNDARIES.md is documentation, not privilege attestation.

baselineFixed=false; productionApproved=false. PR #358 remains DRAFT and is not
READY FOR HUMAN MERGE SIGN-OFF. No CERTIFIED_PROCEED. This metadata checkpoint
references the immutable tested code SHA; its own automatic CI is separate.

## Static IAM manifest matching — 2026-11-08

serviceAccountName is absent from both Cloud Run source templates
(deploy/templates/cloud-run.json and deploy/templates/service.json in phase2_work).
No IAM role binding manifests or Terraform IAM resources are present in the
reviewed repository inventory. Document/source consistency is checked by
scripts/check-iam-manifest-matching.mjs; --certify exits nonzero. Therefore
static IAM conformity cannot be VERIFIED as least privilege. Actual default
runtime identities and inherited grants must not be inferred from absent fields.

Native SDK factories are now confined to server/firestoreRepository and
functions/src/firestoreRepository. db.ts remains a legacy compatibility facade,
not a tenant-scoped repository. Functions reminder now uses the explicit
maintenance database. This removes direct SDK creation from job code without
pretending that the global query or the 50 legacy consumer files are migrated.
Semgrep check-auth-boundary is a real pinned-tool CI gate with positive/negative
fixtures; the older check:auth-boundary Node command alone was not Semgrep.
The factory guard checks creation sites; it does not certify all legacy queries.

## Verified factory/guardrail refactoring — 2026-11-08

[Full CI 42482088663](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42482088663)
SUCCESS on code `9a93f02ab8ca500f8aa0459fcbdd84ce48bf4f2a`.
1,437 Vitest + 86 Enterprise Node + 26 Playwright = **1,549 PASS**.
Dedicated Rules: 92 repeated PASS, not double-counted. Semgrep 1.184.0 rule
fixtures PASS; production scan: 119 files, zero findings. Typecheck, native
Functions/App builds, smoke, fallback policy and static gates PASS.

This verifies native factory confinement and the configured anti-bypass rule.
It DOES NOT mean the 50 candidate legacy consumers have adopted tenant paths.
The registry is a lexical candidate inventory, not proof that every listed
file directly creates an Admin SDK instance. db.ts and maintenance adapters
remain legacy capabilities; global queries and root paths still need migration.
Static IAM matching is consistent with documentation but reports absent runtime
serviceAccountName and IAM binding manifests. --certify still fails.

**baselineFixed=false; productionApproved=false; PR #358 DRAFT.**
The requested 50/50 migration and verified static IAM conformity are unfinished;
no CERTIFIED_PROCEED. This metadata update records immutable tested code; its
own automatic CI is distinct from the completed code run.

## Enterprise atomic batches A/B and IAM — 2026-11-08

Migration progress **2/50 source consumers**, 48 remaining (see
[batch register](../../phase2_work/docs/security/MIGRATION_BATCHES.json)). Batch A migrates the chat
archival job to scoped queries/cursor and a closed transaction interface. Batch B
migrates the Checklist API to the shared repository with Zod validation. A single
canonical repository in functions/src/firestoreRepository is shared by both builds;
the API adapter derives tenant authority from verified claims, while the scheduler
requires explicit deployer-controlled tenant configuration. No raw refs escape.

Both batches require explicit migration-ready cutover flags. No live data copy,
cloud operation or flag activation has occurred. Root data is neither migrated
automatically nor used as a fallback; API returns 503 until its cutover is approved.
The server's root-based Auth gates and other consumers are still legacy and must
be accounted for in the remaining coordinated migrations. Synthetic CI alone
sets the Checklist flag to exercise the approved-test-data path.

infra/iam creates a dedicated klar-runtime service account with Firestore data
role in an explicit application project, limited Auth custom role, bucket-scoped
object role and optional per-secret grants. The role is NOT document-path tenant
IAM. Source Cloud Run templates now have a render-only serviceAccountName slot;
rendered artifacts require an explicit matching klar-runtime email and approved
project. Missing/default/cross-project identities fail before deployment. Six
render/negative IAM tests PASS locally; Terraform 1.13.5 init/validate/fmt PASS
locally. No provisioning, plan/apply or effective cloud-IAM verification is claimed.

Full changed-candidate CI pending. baselineFixed=false; productionApproved=false.
Stop after these bounded batches for review; no CERTIFIED_PROCEED.

## Batch A/B verified checkpoint — 2026-11-08

Full [CI 42484272103](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42484272103)
SUCCESS on `84575f87f42d581e1ca071270a4b8a042e36dbad`: **1,552 PASS**
(1,440 Vitest in 198 files + 86 Enterprise Node + 26 Playwright). Dedicated
Rules: 92 repeated PASS, not double-counted. Six additional IAM render/negative
checks PASS. Semgrep fixture PASS and production scan 119 files / zero findings.
Typecheck, Functions/App builds and production smoke PASS.

Batch A native tests verify tenant-local archive transactions/cursors, pending
erasure protection and unchanged foreign-tenant/root records. Batch B verifies
scoped API merge writes, retained root data and 503 before approved cutover.
The shared helper uses native Date values at the API/Functions SDK boundary to
avoid cross-package Timestamp instances. Release CLI tests now supply the
explicit synthetic runtime identity required by rendering. The initial candidate
CI exposed both integration issues; both pass in the completed run above.

Progress: **2/50 consumer files migrated in source, 48 open**. Terraform runtime
identity/bindings are IMPLEMENTED; local init/validate/fmt PASS. No plan/apply,
service-account creation, deployed IAM attestation, live data migration or
production cutover was performed. Source identity slots remain render-only;
missing/default/cross-project service accounts are rejected by rendering.

baselineFixed=false; productionApproved=false. PR #358 remains DRAFT for review
of these bounded batches. Work stops here for the next review step, with no
CERTIFIED_PROCEED. This metadata checkpoint refers to the immutable tested code
SHA; its own automatic CI is separate.
