# P0 VES-15 – Account-erasure GCS metadata preconditions and unresolved cross-service hold race

**2026-11-08 · Draft review only · NO-GO · `productionApproved=false`**

## Read-only audit evidence

The DSGVO Art. 17 account-erasure workflow in `src/server/trustAndSafety.ts` invokes `deleteAccountPhotos(getAppBucket(), uid)` from `functions/src/retention.ts`, which lists both `verification/${uid}/` and `profiles/${uid}/` then invokes GCS `file.delete({ ifGenerationMatch: generation })`.

This is a **separate destructive writer path** from `src/server/routes/complianceStorage.ts` (P0 VES-5). It does not take a Firestore `verification_events` decision/hold record, purge intent or a monotonic cross-writer fence as an input. The dedicated retention-purge flag `KLAR_VERIFICATION_PHOTO_PURGE_ENABLED` **does not govern this Art.-17 deletion**. A valid GCS generation condition checks storage object identity but does *not* enforce an independently changed Firestore Legal Hold. This is source-backed risk, not evidence that a live user suffered an unlawful deletion.

## This narrow code-hardening change

Before a storage delete during account erasure, require:
- A non-null metadata response.
- For each GCS `temporaryHold` or `eventBasedHold`, either the property is **absent** or is exactly the boolean `false`. Active holds, `null`, strings such as `"false"`, `0` and nested objects **fail closed**. Unknown is not evidence of authorization.
- A positive, decimal GCS generation supplied as a string or safe integer. Invalid, missing, negative, rounded or non-decimal generations fail closed, and the original `ifGenerationMatch` precondition is retained.
- Existing bounded two-prefix pagination, 404/412/retry handling, duplicate-safe idempotency and parent account-deletion orchestration remain unchanged.

The standalone `scripts/deletion-storage-check.mjs` executes the **real dependency-free TypeScript module** through Node's strip-types and covers malformed hold fields, unsafe generation representations, missing metadata, and asserts **zero physical delete calls**. It also deliberately **characterizes the unresolved P0**: even with an independently simulated Firestore verification record marked `legalHold=true`, a GCS object without a Storage hold is currently deleted by the account-erasure function because that function receives **no Firestore legal-hold state**. This characterization is a *proof of missing coordination*, not a passed legal-hold safety test. It MUST be replaced by a negative no-deletion test once the all-writer contract is implemented.

## Mandatory P0 closure: not implemented by this patch

1. Obtain AppSec/DPO/Legal-approved transition semantics for both mandatory erasure and justified legal preservation: state, actor, scope, lease/token and durable evidence for partial, held, resumed and completed deletion.
2. Enforce the same monotonic cross-writer fencing on **both** retention-purge and direct account-erasure paths. All writers (KYC/moderation, verification requests, account deletion, Admin SDK, Firebase/Cloud Console, external jobs) must honor it.
3. Adversarial barrier test **AFTER** final Firestore authorization and **BEFORE** GCS delete: a new Legal Hold/revocation must be unable to cause unauthorized irreversible deletion. Include crash, 404/412, stale lease and GCS hold transitions; run exact SHA tests in emulator and authorized Cloud staging.
4. Verify correct Firebase/GCS project, bucket, tenant, permissions and retention policy (VES-12); independently sign off with AppSec/DPO/SRE/Release Owner. Preserve accurate Art.-17 acknowledgment and retryability.
5. Merge only after independent review and a green **single integrated final HEAD** across the #317 → #345 → #350 → this branch dependency; no bulk merge of separate green Drafts.

## Evidence links

- [Parent VES-5](https://linear.app/takev/issue/VES-5)
- [New account-erasure blocker VES-15](https://linear.app/takev/issue/VES-15)
- [Parent review Draft #350](https://github.com/Veselin-Takev/Klar-Dating/pull/350)
- [Release evidence register Draft #341](https://github.com/Veselin-Takev/Klar-Dating/pull/341)

**Safety:** no changes to `main`, release gate, Cloud IAM/billing, service account, buckets, production objects or live user data. Retention purge stays OFF, `productionApproved=false`, **NO-GO**.