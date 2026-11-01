# P0 #254 — Firebase Rules Source Evidence and Config Parity (Read-only)

**Date:** 2026-11-01 · **Branch:** `security/p0-254-firebase-rules-source-evidence-20261101`  
**Parent:** unmerged [Draft #281](https://github.com/Veselin-Takev/Klar-Dating/pull/281) SHA `26e9ed2a15bf8e5af468fc35b3e0fb45ddd92f5d`, [combined CI #41338044005](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41338044005) **SUCCESS** with enterprise static gates, Typecheck, Functions Build, 1,462 passing Vitest tests in 198 files, **six executed native Firestore Emulator cases**, app build, smoke and browser acceptance. This does not certify deployed rules.

## Source-backed coverage gap

The read-only tenant inventory imported from [Draft #268](https://github.com/Veselin-Takev/Klar-Dating/pull/268) scans TypeScript/JavaScript in `src`, `functions/src`, `scripts`, plus `server.ts`; it does **not** include Firebase Rules and deployment config. The actual `phase2_work/firebase.json` selects `firestore.rules` and `storage.rules`, while `firebase.pruefung.json` selects `firestore.rules`. These rule files govern client authorization and photo access independently of the Admin SDK. Tenant cutover cannot be approved from TS/JS inventory alone. The local Firestore Rules contain a flat `match /users/{userId}` path, and Storage rules contain a flat `verification/{uid}/{datei}` path. Those are concrete **migration-review candidates**, not proof of an active cross-tenant vulnerability.

## Source-only correction

- New `scripts/check-tenant-rules-surfaces.mjs` resolves the expected Firestore and Storage rules paths **only from the local checked-in deployment config**; it refuses missing, redirected and unexpected paths, emulator drift, symlinks or malformed rules. No Firebase API or network access is needed.
- The deterministic output contains per-file SHA-256, source byte size and **line numbers of selected lexical namespace markers** (flat users, verification photos and possible tenants namespace). It never prints rule source, customer data, credentials or signed URLs. Each surface explicitly records `tenantIsolationCertified=false` and `deployedRulesVerified=false`; final approval is `BLOCKED_INDEPENDENT_REVIEW`.
- Node negative tests verify exact source SHA, the existence of both rule surfaces, no leaked rule content, path redirection, missing storage rules, divergent emulator config and invalid/missing source fail-closed.
- `check:tenant-rules-surfaces` is added to mandatory `check:enterprise` **in addition to** previously integrated Tenant source inventory and all Retention gates. Dual-P0 mutation regression now refuses silently dropping this evidence check.
- **No change** to production Firestore/Storage Rules, Firebase deployments, user records, tenant mapping, biometric objects, IAM or Cloud Scheduler.

## Remaining release blockers

1. This is source integrity/coverage evidence, **not verification of the rules deployed in any production Firebase project**. Trusted deployment inventory, actual IAM, rules releases and verified Firebase project identity remain outstanding.
2. A lexical match does not prove proper tenant access controls, nor does the absence of a textual match prove authorization safety. Need native Auth/Firestore/Storage emulator **cross-tenant and same-tenant BOLA/IDOR negative tests**, Admin-SDK cross-tenant access review, and reviewed Firestore query/index rules.
3. Requires independent, DPO-signed legacy-to-tenant ownership mapping, ambiguous row quarantine, durable migration with write fences, audit/Art.-17 cascade, and rollback testing. No default tenant is authorized.
4. P0 #202 still requires a genuine durable retention job producer+consumer, decision/legal hold and exact GCS-generation provenance, staging 404/412/replacement crash receipts, throughput >300 records, trusted clock and approved Scheduler/IAM cutover.
5. Independent AppSec/DPO/Legal/SRE/Release Owner signoffs and final combined merged-SHA CI are mandatory. Previous source-only green checks are insufficient.

**Both P0 #202 and #254 remain OPEN. Production BLOCKED / NO-GO; `productionApproved=false`.**
