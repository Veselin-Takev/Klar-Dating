# VES-5 — Temporary production hard stop for unfenced verification-photo purge

**Date:** 2026-11-08 (Europe/Berlin)  
**Status:** P0 OPEN · productionApproved=false · NO-GO · review-only stacked Draft

## Confirmed safety gap

The parent [Draft #317](https://github.com/Veselin-Takev/Klar-Dating/pull/317) includes a signed, opt-in verification-photo retention route that commits a Firestore purge intent, revalidates verification decisions in Firestore, then issues a generation-conditional GCS delete. However, a moderator's hold/revocation **after the last Firestore revalidation and before the GCS delete** can still leave the GCS generation unchanged. A GCS generation precondition cannot make a Firestore decision atomic. An existing adversarial regression in `tests/complianceStoragePurge.spec.ts` demonstrates that race.

The dependent [Draft #345](https://github.com/Veselin-Takev/Klar-Dating/pull/345) already requires an explicit Cloud Storage bucket but can still enable the unfenced route with `KLAR_VERIFICATION_PHOTO_PURGE_ENABLED=true` and a configured bucket. Environment configuration is not a substitute for independent all-writer authorization fencing.

## Temporary defense in depth

This stacked branch adds an additional **hard stop before `getDb()`, any Firestore lease and all GCS calls**. The normal HTTP route returns **503 / `verification_storage_purge_p0_fencing_unverified`**, including when the HMAC is authentic, `FIREBASE_STORAGE_BUCKET` is set and the opt-in variable is `true`. It blocks both a production process (`NODE_ENV=production`) and any normal router instance without the test-only injected `getBucket` dependency. Existing signed-request authentication, no-bucket 503 and disabled-flag 503 remain unchanged.

The normal application entrypoint `phase2_work/server.ts` creates this route with `{ getDb: getFirestore }` and no `getBucket`. The mandatory static `check:compliance-storage-purge` now verifies that the router is wired without the injected bucket and that the hard stop appears before Firestore access. **The `getBucket` test injector is retained only to preserve isolated emulator regression tests**, and production mode rejects even an injected bucket. It must never be wired to the production server.

Two signed HTTP regressions verify that a fully configured normal route cannot touch Firestore and that a production-mode instance cannot bypass the block even with an injected test bucket. All tests use synthetic requests and no real GCP resources.

## Operational and compliance effects

- This **does not solve** the all-writer fencing problem. It only prevents this unfenced implementation from being activated in the reviewed production runtime.
- Pausing automated photo deletion can increase retention backlog and conflict with erasure timelines if left without an approved alternative. The DPO/Legal owner must review any lawful hold, Article 17 handling, DSAR deletion pathway, retention scheduler error alarms and manual safe remediation procedure before a release. Do not silently acknowledge 503 as a completed deletion.
- No production purge job, Cloud Scheduler, Firestore document, GCS object, IAM role or billing configuration is modified by this branch.
- To remove the P0 hard stop, first establish an independently reviewed **all-writer** state machine with monotonic deletion fence, legal-hold semantics, Firestore/GCS concurrency protocol (or supported safe redesign), negative **late-hold-after-final-check** proof, crash/replay behavior, signed audit evidence, real Staging GCS/Firestore, and AppSec/DPO/SRE/Release Owner approval. Requires exact integrated SHA and CI.
- The existing Firebase SDK project-isolation changes in [Draft #343](https://github.com/Veselin-Takev/Klar-Dating/pull/343), [#344](https://github.com/Veselin-Takev/Klar-Dating/pull/344), and explicit bucket guard [#345](https://github.com/Veselin-Takev/Klar-Dating/pull/345) must be reconciled before release.

## Acceptance / evidence

```sh
cd phase2_work
npx vitest run tests/complianceStoragePurge.spec.ts tests/verificationPurgeHttpEmulator.spec.ts
npm run check:compliance-storage-purge
npm run check:retention-p0
npm run check:enterprise
```

A passing branch pipeline is evidence of this **interlock only**. It cannot prove safe cross-system deletion and cannot close VES-5. Keep `KLAR_VERIFICATION_PHOTO_PURGE_ENABLED` off until P0 is fully resolved and formally signed. NO-GO.
