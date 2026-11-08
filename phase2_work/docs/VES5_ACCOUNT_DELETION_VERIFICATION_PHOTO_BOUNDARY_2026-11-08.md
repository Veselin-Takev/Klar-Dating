# VES-5 — Account-deletion verification photo safety boundary

**Date:** 2026-11-08 · **Status:** P0 OPEN / release NO-GO · Draft-only change

## Second destructive path found

The signed scheduled verification-photo purge in `src/server/routes/complianceStorage.ts` was blocked pending an independently validated Firestore/GCS legal-hold fencing protocol in [Draft #348](https://github.com/Veselin-Takev/Klar-Dating/pull/348). A separate real account-erasure worker in `src/server/trustAndSafety.ts` calls `deleteAccountPhotos(getAppBucket(), meineUid)` from `functions/src/retention.ts`. That helper previously deleted objects from both `verification/{uid}/` and `profiles/{uid}/` using a generation precondition and GCS object-hold metadata. The generation/Storage metadata checks do not revalidate a late **Firestore moderation or legal-hold decision**. This second writer was not blocked by the signed scheduler-route interlock.

## Review-only containment

The normal `deleteAccountPhotos(bucket, uid)` call is now **profile-only** and does not invoke GCS delete on `verification/{uid}/`. Before deleting ordinary profile images, and again before returning, it inspects the verification prefix with a bounded one-item listing. Any verification object or additional listing page causes `verification_photo_p0_fencing_unverified` and prevents the account erasure job from reporting Storage completion. If none is present, profile images keep the existing generation-conditional, bounded, resumable deletion behavior.

A clearly named `unsafe-emulator-test-only` mode preserves existing **synthetic test cases** of the historical dual-prefix function; that mode is denied in `NODE_ENV=production`. The live `purgeAccountData` caller keeps the default without a mode argument. The mandatory `check:art17-deletion-audit` suite includes a caller-scope check so the production source cannot silently opt into the unsafe test-only mode.

Negative tests prove:
- An existing verification photo blocks all Storage deletion before even listing the profile prefix.
- With zero verification photos, bounded profile erasure works and completion remains resumable.
- A verification object created during profile cleanup is not silently treated as erased.
- A production process cannot enable the unsafe test mode, and the account-delete caller cannot pass the override.
- Existing hold, generation, 404, pagination, and test-only deletion regressions remain covered.

## Limitations / rights-holder impact

This is a **defensive containment**, not a real cross-service transaction fence. A new verification photo created **after the final prefix recheck**, or via an external Storage writer outside the reviewed account-deletion protocol, still requires an all-writer tombstone / denial strategy. Do not claim absence means erasure is permanently complete without independent writer and IAM checks.

The protection intentionally **prevents account deletion from completing when unfenced verification photos remain**. That can delay DSAR/Art. 17 erasure and retention deadlines and must not become a permanent workflow. DPO/Legal and Trust & Safety must review each applicable lawful hold, timely deletion obligations, backlog aging, error categorization, operational escalation and approved safe alternatives. Do not silently mark the deletion request completed or skip provider erasure evidence.

This code is on a stacked Draft branch only, has **not** modified real accounts, Cloud Storage, Cloud IAM or Production. Keep release `productionApproved=false` and photo scheduler opt-in OFF.

## Remaining P0 and evidence

- Independent all-writer inventory of both account deletion and scheduled purge, moderators, Auth, external Admin SDK, legacy jobs, tenants and direct Cloud Storage access.
- A common monotonic deletion-fencing protocol that ensures an adverse Firestore revocation/legal hold **after the final authorization check but before GCS delete** results in **no deletion** (proved in emulator and safe staging).
- Crash/replay, object holds, 404/412, lease loss, DSAR deadline and audit evidence.
- Firebase staging project identity, real bucket IAM/holds, DPO/AppSec/SRE/Release Owner signatures and exact final integrated SHA CI.
- Dependent drafts: [#317](https://github.com/Veselin-Takev/Klar-Dating/pull/317), [#345](https://github.com/Veselin-Takev/Klar-Dating/pull/345), [#348](https://github.com/Veselin-Takev/Klar-Dating/pull/348).

## CI acceptance

```sh
cd phase2_work
node --test scripts/deletion-storage-check.mjs
npx vitest run tests/storageRules.spec.ts tests/complianceStoragePurge.spec.ts
npm run check:art17-deletion-audit
npm run check:enterprise
```

A branch CI PASS would validate the temporary interlock and regression tests, not close VES-5 or authorize a production erasure.
