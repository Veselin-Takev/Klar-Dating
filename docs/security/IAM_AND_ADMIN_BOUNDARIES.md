# IAM and Admin SDK boundaries — v0.1.1-rc1

Status: **WAVE 3 SOURCE BASELINE CERTIFIED; PRODUCTION OPERATIONAL GATES OPEN.**
`baselineFixed=true`; `productionApproved=false`. Full source CI: https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42504754895, commit `951b16b243354321ca9c2c31bde8deab9e00060a`.

## Current application and deployment boundaries

All 50 registered source candidates are migrated/hardened. API and Functions factories return closed tenant repositories; native clients/refs remain private reviewed infrastructure, with exact-file source hashes and mandatory anti-bypass checks. The emulator fixture alias is denied in production/cloud and statically banned from application imports. Native transactions remain authoritative. Local repositories are explicit local-only empty stores, never cloud-error fallback or fabricated auth state. AI-cache/budget owner/erasure fences and four tenant-bound maintenance scripts are verified.

Client Rules do not restrict Admin SDK. The repository is an application control, not an IAM sandbox. API tenant authority comes from verified default-tenant claims; named tenant and request-context collisions fail closed. Maintenance tenants come from explicit trusted deployment configuration. Resource-level authorization remains mandatory inside the namespace.

Static Cloud Run/Terraform/IAM manifests declare dedicated runtime identities and explicit least-privilege bindings and pass source matching. `roles/datastore.user` is database-wide; hard IAM tenant boundaries may require separate databases/projects/identities. No effective IAM export, inherited-policy attestation, IAM apply, production deployment or data migration was performed. Auth administration, Stripe, FCM and Storage require separate external-service evidence. Owner/Editor, key creation and token-creator grants are not justified by application access.

Production flags remain off pending reviewed root-data migration/cutover, workload identity/effective IAM, ACTIVE-TTL evidence, external dispatch/erasure fencing and human production approval. Physical verification-photo purge remains hard-disabled. AI database caps are tenant-global; provider-wide aggregate spend limits remain a separate operational control.

Current evidence: 1636 comparable main-suite PASS; 118 repeated Rules; strict repository SAST 0 findings / 0 diagnostics; 681/681 first-party runtime source coverage; typecheck/build/smoke PASS. [Source certification](../../phase2_work/docs/security/MIGRATION_WAVE3_CERTIFICATION.md) and [machine evidence](../../phase2_work/docs/security/WAVE3_VERIFICATION.json). No universal or deployed-IAM isolation claim is made.

## Historical checkpoints

The checkpoints below describe earlier immutable commits. Their migration counts and unresolved paths are historical and superseded by the current inventory above.

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

## Wave 2 source checkpoint — 2026-11-08

Source migration: 10/50 candidates, 40 still legacy. KYC, contract/refund ledger,
subscription reader, reminder/expiry Functions and compliance worker use closed
scoped repository operations. Signed API maintenance jobs reject missing/foreign
tenant context. Deployer selects scheduler namespace; API supports default only.
Scoped deletion rows are never passed into the root-based deletion worker.
All production migration flags remain OFF; effective IAM and cross-service erasure
fencing are unverified. See phase2_work/docs/security/MIGRATION_WAVE2.md.

Wave 2 verified checkpoint: full CI 42490475690 SUCCESS on
fff55a978c6184e46b687ba80cefd184cd341900, 1,574 main-suite PASS; 92 Rules repeated.
Pinned constructor-boundary Semgrep: 0. Repository-wide auto: 35 findings and 41
parser warnings, FAILED. Source adoption remains 10/50, C/D/E IN_PROGRESS.
No deployed IAM, live cutover or cross-service erasure certification is asserted.
baselineFixed=false; productionApproved=false; stop for Wave 3 review.

## Wave 3: closed native capabilities and explicit local stores

The 50-file source register is certified at `951b16b243354321ca9c2c31bde8deab9e00060a` by full CI https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42504754895; production approval remains false. API and Functions factories now return `TenantAwareFirestoreRepository`; native client construction remains private to two exact factory files, and native refs are confined to the canonical repository. `ADMIN_INFRASTRUCTURE.json` pins the reviewed contents of those files, the canonical wrapper and the compatibility fixture facade. The source guard walks untracked source too, covers server/core, Functions, scripts and native imports across application source, and rejects constructor aliases, namespace/dynamic imports, raw fixture imports and computed raw methods. The Semgrep constructor rule exempts only the two factory paths, not arbitrary files in their directories. These source hashes are review evidence, not proof of deployed IAM.

`getDb` is now an emulator-fixture compatibility alias, blocked in production/managed cloud and outside loopback `demo-` emulators. Application imports are statically forbidden. Production factories return closed repositories; shutdown/startup expose no raw SDK. Local repositories are explicitly instantiated, empty by default, development/test-only and never activated by a cloud failure. They cannot synthesize verified identity, age or consent. Durable JSON snapshots are tenant-separated, schema validated, atomically replaced and protected from stale overwrite. Native SDK semantics and transactions remain authoritative for application production operations.

AI reservation caps are **tenant-global**, not a cross-tenant platform aggregate. Provider/account-wide spend limits remain a separate operational control. AI cache and budget writes recheck the scoped user and account-deletion marker inside the transaction. Maintenance commands require an explicit trusted tenant; seeds and profile repair default to dry-run. Production migration flags and live data/IAM application remain off pending operator review. Physical verification-photo purge remains hard-denied until cross-service fencing is independently evidenced. `productionApproved` remains false.
