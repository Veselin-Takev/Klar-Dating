# P0 #371 Package 1 — Verification Storage Writer Inventory & Boundary Audit

**Source baseline:** `main@a15d8950bc67a7eb9c9893455ee83cfdd1174957` (tree `342ed00ddd999ae7acc4b221ce858325ccd92e1b`).
**Previous main:** `d0f766dce8dd907a59398ccbdfd081415601db18`; PR #408 merged to main.
**Branch:** `security/p0-371-all-writer-inventory-package1-20261123`; Draft PR against `main`.
**Status:** offline source inventory and static fail-closed boundary. No live Cloud or IAM evidence is claimed.
**Release invariant:** P0 #254, #374 and #371 remain **OPEN**; `productionApproved=false`; production **NO-GO**.

## Executive finding

The reviewed source tree contains one application verification-object upload path and the existing deletion/hold/finalize paths described below. The application upload already reserves a durable Writer-Intent, writes the trusted backend marker, and completes the intent only after the related Firestore writes. Finalized objects are independently registered through the existing retryable Cloud Function → HMAC API route → `verificationObjectRegistration.ts` → `verificationDeletionFence.ts` chain.

The account-erasure Storage helper is deliberately **profile-only** in its default mode. It refuses to report progress/completion while any `verification/{uid}/` object remains, checking before and after profile cleanup. Its verification-deletion override is restricted to isolated local emulator tests. The signed scheduled purge route remains Default-OFF and has a production **503 P0 hard-stop** because cross-service authorization is not yet proven atomic.

**No verified missing internal verification writer was identified in this source review.** Accordingly, Package 1 adds no runtime writer, no parallel fence, and no duplicate race suite. The new static gate makes the existing internal boundary explicit and rejects newly introduced unregistered Storage mutation paths. This is a source-level result, not proof that external actors or deployed infrastructure cannot write.

## Internal writer and lifecycle inventory

| Surface | Source path | Operation / role | Existing boundary | Assessment |
|---|---|---|---|---|
| Application verification upload | `phase2_work/src/server/klarCore.ts` | Admin SDK `bucket.file(pfad).save(...)` to `verification/{uid}/...` | Calls `beginVerificationDeletionWriterIntent` before upload; includes `TRUSTED_VERIFICATION_WRITER_MARKER`, UID/challenge/creator metadata; reads stored generation/metageneration; calls `completeVerificationDeletionWriterIntent` only after verification request and user-state writes. | **BOUND — existing canonical writer contract** |
| **Preservation-hold Storage adapter** | **`phase2_work/server.ts`** | **One `getStorage()` acquisition; `storage.bucket(bucketName)` / default bucket selection; `bucket.file(path)`; exposes `getMetadata()` and `setMetadata(metadata, options)` to the hold router. This is the separate Storage-touching adapter callsite, not an object-content upload/delete writer.** | **Bound exclusively to `createVerificationDeletionHoldRouter`; metadata mutation is delegated to the router, which calls `beginVerificationDeletionHold` and `confirmVerificationDeletionHold` with generation + metageneration preconditions. The static gate requires this exact single adapter shape and fails closed on extra Storage mutations, additional `getStorage()` calls, or aliased factory/method references in `server.ts`.** | **BOUND — narrowly allowlisted preservation-hold adapter; no general Storage exemption** |
| Finalize trigger | `phase2_work/functions/src/verificationObjectFinalized.ts`; exported from `functions/src/index.ts` | Cloud Functions v2 `onObjectFinalized`, `retry: true`; forwards immutable event body to signed API | HMAC SHA-256 request; transient non-2xx failures throw for retry; 409/422 are terminal invalid-object rejections. | **BOUND — event registration transport**; actual deployment status unknown |
| Finalize HTTP route | `phase2_work/src/server/routes/verificationObjectFinalized.ts` | Validates signed finalize event and delegates registration | Calls existing `registerFinalizedVerificationObject`; maps invalid identity/bucket/fence errors to non-success responses. | **BOUND — canonical registration adapter** |
| Canonical object registration | `phase2_work/src/server/platform/verificationObjectRegistration.ts` | Validates `verification/` path, configured bucket, object generation/metageneration and backend marker | Calls `ensureVerificationDeletionFenceForUploadedObject` from `verificationDeletionFence.ts`; late/post-tombstone objects remain fenced/unresolved. | **BOUND — existing PR #397 baseline** |
| Deletion fence and writer-intent state | `phase2_work/src/server/platform/verificationDeletionFence.ts` | Firestore transactional fence, Writer-Intent, finalize registration, holds, CAS, receipts and erasure reconciliation | Canonical shared state machine reused by upload, finalize and account-erasure code. | **BOUND — existing PR #397 baseline** |
| Account-erasure caller | `phase2_work/src/server/trustAndSafety.ts` | Calls `deleteAccountPhotos(getAppBucket(), meineUid)` | Does not opt into unsafe emulator mode; false result / exception prevents erasure from being treated as complete. | **BOUND — profile-only caller** |
| Account-erasure Storage helper | `phase2_work/functions/src/retention.ts` | Lists profile prefix and deletes profile objects with generation precondition; checks verification prefix separately | Default mode is `profile-only`; checks `verification/{uid}/` before and after profile cleanup and throws `verification_photo_p0_fencing_unverified` if any remain. Verification deletion mode requires local test environment, explicit test opt-in and local Storage Emulator. | **BOUND — production profile-only hard-stop**; verification deletion remains disabled |
| Scheduled purge proxy | `phase2_work/functions/src/purgeVerificationStorage.ts` | Scheduler signs a request to `/api/admin/purge-verification-storage`; it does not access Storage directly | HMAC request, fixed HTTPS origin, bounded timeout and retries; downstream route remains Default-OFF / production 503. | **BOUND — proxy only; no active purge authorization** |
| Purge API route | `phase2_work/src/server/routes/complianceStorage.ts` | Existing decision/hold/CAS/Storage deletion implementation | Default-OFF flag; explicit bucket validation; production or non-test-injected path returns 503 before Firestore/Storage access because cross-service writer fencing is unverified; canonical deletion CAS/fence helpers remain in source. | **BLOCKED BY DESIGN — do not weaken 503 interlock** |
| Hold / moderation metadata path | `phase2_work/src/server/routes/verificationDeletionHold.ts` | Sets Storage temporary hold with generation + metageneration preconditions | Calls `beginVerificationDeletionHold` and `confirmVerificationDeletionHold` against canonical fence; not an object-content upload or delete. | **BOUND — hold-state writer** |
| Legacy upload-age scheduler | `phase2_work/functions/src/deleteExpiredPhotos.ts` | Retained scheduler entry point now deletes only expired `funnel_events` | No verification Storage listing, file access or photo deletion; verification photo age-based deletion is disabled. | **DISABLED — preserve scheduler entry point** |

### Adjacent Storage code outside the verification writer set

Profile-media inventory, migration and token-revocation utilities use the configured application bucket for `profiles/` media and are not verification-object writers. They are separate workflows with their own offline/default-off controls; this Package 1 does not execute them. Test-only emulator fixtures and test cleanup operations are not production writer paths and are excluded from the production source scan.

## Gap audit and regression coverage

- **Internal writer gaps closed in this PR:** none verified. No code change to application upload, account-erasure, hold, finalize, scheduler or purge runtime was justified by the source evidence.
- **Existing race/boundary suites retained:** `tests/verificationDeletionFence.spec.ts`, `tests/accountErasure.spec.ts`, `tests/deletionLifecycle.spec.ts`, `tests/complianceStoragePurge.spec.ts`, `tests/verificationObjectFinalizedHttpEmulator.spec.ts`, and `tests/verificationPurgeHttpEmulator.spec.ts`. They already cover fence state, erasure barriers, delayed finalize/replay, purge interlocks and failure boundaries; this PR does not duplicate them.
- **New coverage:** hermetic `node:test` source-boundary fixtures for unregistered Admin SDK upload, bypassed delete, missing Writer-Intent, dynamic prefix/path evasion, an unregistered mutation in top-level `server.ts`, and aliased/indirect bucket/file factories. The expanded suite has eight tests (the original four plus three additional server-adapter/alias cases).
- **Supported static API boundary:** direct `getStorage()`, `.bucket(...)`, `.file(...)`, `.getFiles()`, and direct file mutation calls including `.save()`, `.delete()`, `.deleteFiles()`, `.setMetadata()`, `.createWriteStream()`, `.copy()`, `.move()`, `.rename()`, `.upload()`, `.makePublic()` and `.makePrivate()`. Method/factory aliases assigned from Storage objects are rejected in the scanned sources; the top-level `server.ts` hold adapter is the only exact-shape exception.
- **Static-analysis limits:** this is a conservative source-regression guard, not a TypeScript AST, control-flow, whole-program alias or runtime taint analysis. Computed property access, reflection/proxies, dynamic imports, runtime-generated code, obfuscated aliases across module boundaries, SDK calls hidden behind unscanned dependencies, and external principals are not proven absent. These are out of scope for this static gate and require independent AppSec review; the scan must not be represented as proof against arbitrary JavaScript/runtime indirection.
- No Firebase SDK, emulator, network, Cloud credentials, database, bucket, or external service is used by the synthetic tests.

## External and policy boundaries — unresolved

| Actor / decision | Evidence available in this PR | Status |
|---|---|---|
| Project IAM principals, service accounts and inherited roles | No live IAM inventory is permitted or performed. | **UNRESOLVED / REVIEW_REQUIRED** |
| Google Cloud Console / Firebase Console manual Admin SDK or object operations | Not represented by repository source; no Console activity or audit-log inspection performed. | **UNRESOLVED / REVIEW_REQUIRED** |
| Cloud Storage bucket lifecycle rules, retention policies, soft-delete, object holds and managed transfers | No bucket configuration or object inventory inspected. | **UNRESOLVED / REVIEW_REQUIRED** |
| External services, CI credentials, signed URLs and out-of-band Admin SDK clients | Repository search cannot establish the absence of independent principals or URLs. | **UNRESOLVED / REVIEW_REQUIRED** |
| DPO/Legal decisions on Art. 17 erasure exceptions, statutory retention, legal holds and retention periods | Engineering code cannot establish lawful basis or resolve conflicting obligations. | **UNRESOLVED / REVIEW_REQUIRED** |
| Trust & Safety moderation, appeal, quarantine, evidence preservation and release of holds | Existing technical hold APIs do not authenticate policy approval or decide when a hold may be lifted. | **UNRESOLVED / REVIEW_REQUIRED** |
| Production deployment identity and actual deployed scheduler/trigger versions | Source exports do not prove what is deployed or enabled. | **UNRESOLVED / REVIEW_REQUIRED** |

These items require independent AppSec, DPO/Legal, SRE and Release Owner review and, where authorized, a separately approved operational evidence plan. No synthetic fixture, source scan or CI pass may be represented as that evidence.

## Static gate

Run from `phase2_work/`:

```bash
npm run check:verification-writer-boundary
```

The command runs the repository source scan followed by Node's built-in test runner:

```bash
node scripts/check-verification-writer-boundary.mjs
node --test scripts/check-verification-writer-boundary.test.mjs
```

The gate scans `src/server/`, `functions/src/`, and the explicit top-level `server.ts` production entry point; it excludes test files and generated/dependency directories. It checks the supported direct Storage API patterns and method/factory aliases described above, and validates only the single reviewed preservation-hold adapter in `server.ts`. It is intentionally fail-closed for new/unregistered Storage mutations. Static analysis cannot prove the absence of arbitrary reflection or runtime-generated calls; those require independent AppSec review. No Firebase SDK, emulator, network, Cloud credentials, database, bucket, or external service is used.

## Explicit exclusions

- No cherry-pick or source copy from PRs #349, #352, #353 or #378; no parallel deletion-fence module.
- No weakening or modification of Default-OFF, profile-only hard-stop, or the P0 503 interlock in `complianceStorage.ts`.
- No active root or phase2 `storage.rules`, `firestore.rules`, `firebase.json`, workflow, Vitest config, dependency or lockfile changes.
- No live GCS delete, bucket/object inventory, photo purge, IAM/Console/Lifecycle inspection, Firestore/Storage mutation, scheduler/trigger mutation or deployment.
- No real UID, PII, token, URL, secret, credential, bucket object name or production evidence.
- No production approval or release state transition.

P0 #254 Packages 1–6 and P0 #374 Packages 1–4 are recorded as **offline engineering packages complete / AWAITING_INDEPENDENT_APPSEC_DPO_SRE_REVIEW**; the issues remain OPEN. P0 #371 Package 1 is this active Draft PR and remains subject to exact-head CI and independent review. `productionApproved=false`; production **NO-GO**.