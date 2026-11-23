# P0 #371 Package 2 — Verification Deletion Cutover-Readiness & Independent Evidence Gate

**State:** isolated Draft PR; offline-only; not merged; no operational cutover.  
**Baseline:** `main@2854162816037486031cec8fb169ccda1a10deaa` (Tree `59d93e346cb5805ba8efaf57d076af93f30beab2`).  
**Maximum validator verdict:** `ELIGIBLE_FOR_INDEPENDENT_REVIEW`.  
**Production authorization:** `productionApproved=false` — **NO-GO**.

## 1. Purpose and boundary

Package 1 inventories internal verification writers and enforces a hermetic static source boundary. Package 2 adds an offline evidence validator for the prerequisites that source inspection cannot establish: cloud principals, external writers, bucket policy, deployed trigger/scheduler state, legal decisions and operational recovery.

The validator is a **document/evidence gate**, not a deletion tool, cloud probe, authorization service or production readiness declaration. It imports only Node built-ins (`crypto`, `fs`, `path`, `url`). It makes no network, Firebase, Google Cloud, IAM, Firestore, Storage, bucket, scheduler or deployment calls.

Only two verdicts exist:

- `BLOCKED`: any missing, stale, expired, contradictory, mismatched, unsafe or non-zero-operation evidence.
- `ELIGIBLE_FOR_INDEPENDENT_REVIEW`: complete, internally consistent evidence has been assembled and structurally validated; independent humans must still review it.

There is no `PRODUCTION_APPROVED` or equivalent success state. The highest possible result is eligibility to enter independent review.

## 2. Pinned main and Package 1 baseline

The validator pins the exact source baseline and rejects a different main SHA or Tree SHA:

- Main SHA: `2854162816037486031cec8fb169ccda1a10deaa`
- Main Tree: `59d93e346cb5805ba8efaf57d076af93f30beab2`
- Package 1 merge: PR #409, merge commit `2854162816037486031cec8fb169ccda1a10deaa`.
- Package 1 post-merge Klar Enterprise CI: Run [#45245284270](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45245284270), workflow #2328, exact SHA above; PASS.
- Writer boundary evidence: 135 production source files scanned; 8/8 synthetic tests passed; 0 failed.
- Package 1 source artifacts are pinned by Git Blob SHA-1: writer-boundary checker, its `node:test` suite, inventory document, `klarCore.ts`, `verificationObjectRegistration.ts`, `verificationDeletionFence.ts`, `accountDeletion.ts`, `trustAndSafety.ts`, `functions/src/retention.ts`, and `complianceStorage.ts`.

The evidence bundle must contain a local copy of every pinned artifact. For each file, the manifest records both SHA-256 and Git-Blob-SHA-1. The validator checks both against file bytes and checks source Blob SHAs against the pinned main baseline. A source file changing on main requires an explicitly reviewed new baseline, not silent acceptance.

## 3. Fail-closed evidence requirements

### 3.1 Internal source and Package 1 boundary

Required evidence covers:

- Canonical upload Writer-Intent creation and completion in `klarCore.ts`.
- Finalize event registration through `verificationObjectRegistration.ts`.
- Canonical state machine, writer-intent, hold reservation and generation/metageneration CAS in `verificationDeletionFence.ts`.
- Static writer-boundary checker, its isolated `node:test` suite and Package 1 inventory.
- Exact source Blob SHA, SHA-256, and exact main SHA/Tree binding.

### 3.2 Erasure hard-stop and production purge interlock

The account-erasure path remains profile-only by default. `deleteAccountPhotos` defaults to `profile-only`, checks for unfenced verification objects before and after profile deletion, and does not include the verification prefix in its deletion prefixes in that mode. The account-deletion server path requires verification deletion artifacts to be absent before it can report completion.

The compliance Storage route retains its production hard-stop: production requests return HTTP 503 with `verification_storage_purge_p0_fencing_unverified`. A configured secret, environment variable or local test adapter is not production authorization.

The validator checks the source artifact identities and required invariant markers. It does not execute either runtime path or call the providers.

### 3.3 External and policy evidence — all six required

Every category must be `VERIFIED`, have a resolvable local evidence artifact reference, a named accountable owner and a valid timestamp. `UNRESOLVED`, `REVIEW_REQUIRED`, missing or contradictory records block eligibility.

| Required category | Evidence expected |
|---|---|
| IAM / service-account principals and inherited permissions | Principal inventory, effective-role inheritance, least-privilege assessment, reviewer evidence |
| External Admin SDK writers and signed URLs | External writer/client inventory, key ownership, signed URL authority and expiry controls |
| Bucket Lifecycle, retention, soft-delete and holds | Exact bucket-policy export, retention/soft-delete settings, legal-hold and object-hold configuration |
| Deployed finalize trigger and scheduler state | Deployment identity, trigger generation/configuration, scheduler target and disabled/enabled state evidence |
| DPO / Legal policy | Legal hold, moderation, appeal, quarantine, Art. 17 exception and release decision records |
| SRE recovery and operations | Monitoring, alerting, backup/recovery, rollback and incident procedures with rehearsal evidence |

The evidence package must not contain real UID values, tokens, signed URLs, secrets or raw personal data. Use redacted evidence references and controlled evidence custody.

### 3.4 Independent reviewer records

Three distinct approvals are mandatory: `APPSEC`, `DPO_LEGAL` and `SRE`. A single optional `RELEASE_OWNER` record is permitted. Every record must include:

- distinct signer reference and reviewer identity claim;
- exact scope `P0_371_PACKAGE_2_OFFLINE_CUTOVER_READINESS`;
- decision `APPROVED`;
- signed timestamp and non-expired expiry;
- exact evidence digest binding.

The local validator checks structure, role uniqueness, signer-reference uniqueness, timestamp validity, expiry and digest binding. **It does not authenticate reviewer identity, verify a signature, establish reviewer independence, or validate the authority of the claimed owner.** Those are external human/process controls.

### 3.5 Integrity, paths and zero operations

Every evidence artifact is checked using SHA-256 and Git-Blob-SHA-1. Paths must be relative, remain within the evidence root, contain no traversal segments and resolve through no symlink. Evidence artifacts are limited to regular files of at most 5 MiB.

The manifest must explicitly assert:

- `storageMutations === 0`
- `firestoreWrites === 0`
- `cloudOperations === 0`
- `deployments === 0`

Missing counters or any non-zero value block the result. These are declared assertions, not independent telemetry: this validator itself is offline and performs no such operations.

## 4. Synthetic test contract

Run:

```bash
node --test scripts/check-verification-deletion-cutover-readiness.test.mjs
npm run check:verification-deletion-cutover-readiness
```

The synthetic suite covers the maximum eligible verdict plus missing/mismatched main and source SHAs, missing Package 1/interlock evidence, unresolved external categories, missing/expired/duplicate/contradictory/digest-mismatched reviewer approvals, unsafe paths and symlinks, tampered file hashes, and each non-zero operation counter. The fixtures are synthetic only and do not represent live cloud evidence or actual reviewer approvals.

## 5. Rollback and hard-stop invariants

- Keep account-erasure `profile-only` behavior as the production default.
- Keep the compliance Storage production response at HTTP 503 while cross-writer operational fencing remains unverified.
- Keep all verification-photo purge activation switches OFF; do not add a production route or bucket adapter.
- Any missing/mismatched source baseline, external evidence, reviewer record or evidence digest means `BLOCKED`.
- Any unexpected writer, hold conflict, missing object version, contradictory policy or evidence expiry means stop and return to the existing hard-stop; never retry by weakening a precondition.
- No deletion, migration, revocation, scheduler invocation or recovery mutation is part of Package 2.

Rollback here means preserving/restoring the already deployed Default-OFF/profile-only and 503 code baseline, not executing a cloud rollback. Any real operational rollback or cutover requires a separate approved change, exact target identity, independent authorization and staging evidence.

## 6. Explicit unresolved boundary

Until independent evidence is assembled and reviewed, the following are not established by source tests or green CI: actual IAM/service-account effective permissions; external Admin SDK and signed URL writers; bucket Lifecycle/retention/soft-delete/holds; deployed finalize trigger and scheduler state; DPO/Legal policy and decisions; SRE recovery/monitoring/rollback readiness.

This Draft PR does not close P0 #371, does not close P0 #254, P0 #374 or P0 #373, and does not approve production. `productionApproved=false`; release **NO-GO**.
