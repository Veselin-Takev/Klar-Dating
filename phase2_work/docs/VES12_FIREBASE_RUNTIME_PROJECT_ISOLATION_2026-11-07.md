# VES-12 — Firebase runtime project isolation (2026-11-07)

**Review-only change; staging/production NO-GO.** Project `klar-admin` identity was confirmed by user-provided Google Cloud and Firebase console screenshots (project number `999168390318`). The latest Cloud Billing screenshot links it to user-selected account `Mein Rechnungskonto`, but a verified EUR 10 project budget is **not yet evidenced**. The saved budget UI showed name `10`, **0.00 EUR/0.00 EUR** in spend/target, and thresholds **50/90/100**, so the intended 10 EUR and 50/80/100 acceptance criteria remain open.

## Source defect

The backend Firebase Admin SDK resolver, `src/server/firebaseRuntime.ts`, previously selected `GCLOUD_PROJECT || GOOGLE_CLOUD_PROJECT` without detecting disagreement. It also could pair a staging project explicitly set in the environment with a **named Firestore database ID inherited from another project** in `firebase-applet-config.json`. The current checked-in `main` Web SDK config / `.firebaserc` point at a separate Google AI Studio project, not `klar-admin`.

## Changes (review-only branch based on `main`)
- Reject any mismatch between nonempty `GCLOUD_PROJECT`, `GOOGLE_CLOUD_PROJECT`, and `FIREBASE_PROJECT_ID` **before** Firebase Admin SDK project/database selection. Do not silently prefer the first provider.
- Accept `FIREBASE_PROJECT_ID` alone as an explicit identity and retain dedicated `demo-*` emulator isolation.
- When a selected project differs from the checked-in Web SDK project's `projectId`, **do not** inherit that project's named `firestoreDatabaseId`. Choose the default Firestore database if `FIRESTORE_DATABASE_ID` is not explicitly set; explicit database overrides remain supported for reviewed deployment settings.
- Add regression tests covering conflicting env IDs (including emulator), consistent IDs, exact database override, and prevention of stale named database selection.
- This change **does not** alter `firebase-applet-config.json`, `.firebaserc`, Firebase Rules, Vercel settings, production environment variables, IAM, Cloud Billing, or resources. It does **not** prove an actual deployed `(default)` database exists.

## Required test and release evidence
- [ ] Exact-commit CI (pinned Node v22.23.3) PASS and targeted `vitest run tests/firebaseRuntime.spec.ts` PASS.
- [ ] Review current calling services and environment migration; ensure no legitimate production environment relies on inconsistent project identity.
- [ ] Confirm `klar-admin` Web Firebase app, Auth, Firestore database ID/region, Admin ADC, Cloud Run SA and Vercel preview upstream are all the same intended staging boundary.
- [ ] Google Cloud budget: scoped EUR 10 monthly alerts 50/80/100, independently verified by saved UI or API. Ordinary alerts are not a hard spend cap.
- [ ] Staging API verified end-to-end with synthetic accounts; independent AppSec/SRE/QA review.
- [ ] VES-5 real Firestore/GCS late-hold adversarial proof and VES-11 age API remain P0 open, production release `productionApproved=false`.

Reference: [VES-12](https://linear.app/takev/issue/VES-12), [Release evidence Draft PR #341](https://github.com/Veselin-Takev/Klar-Dating/pull/341).

## Follow-up: pre-initialized Admin app cross-project reuse

The `getServerFirebaseApp()` consumer in `src/server/db.ts` originally used `getApps()[0]` without checking either the Admin app's default name or `app.options.projectId`. Even after validating environment variables in PR #343, a **previously initialized** Firebase Admin app with a different project ID could be reused for Firestore, Auth, and Storage, silently defeating the project selection.

The stacked review branch **requires the default Admin app** (`[DEFAULT]`) and rejects an already-initialized default app when its configured `options.projectId` is absent or does not match the resolved runtime project ID. It initializes a correct default app when only unrelated named Admin apps exist. This intentionally fails closed for ambiguous app identity. It never reuses a non-default named app.

New unit cases in `tests/nativeFirestoreBoundary.spec.ts` cover an existing default app with matching, conflicting or missing project ID, as well as a pre-existing unrelated named app. The suite also asserts that Firestore initialization remains fail-closed on mismatch. Compatibility of environments relying on implicit ADC app initialization must be reviewed before merge; no automatic change to Cloud Run or Firebase Admin credentials is made.

**Verification pending:** exact-head CI and independent runtime review on the dependent PR. The parent #343 CI success only attests SHA `601c316c4b875242989f488473bba61b4c22322c`. Neither its success nor these source-level changes constitute real `klar-admin` Firestore/Cloud verification.


## Follow-up: Storage bucket selection must not cross project boundaries

A further read-only source audit found `src/server/storage.ts` was still using `process.env.FIREBASE_STORAGE_BUCKET || config.storageBucket` unconditionally. Since the checked-in `firebase-applet-config.json` belongs to another Firebase project, a backend configured for `klar-admin` could have accessed that **other project's Cloud Storage bucket** if the explicit environment override was missing. That is particularly dangerous for verification-photo uploads and deletion paths and must be isolated independently from Firestore database identity.

The stacked branch now **fails closed before obtaining a bucket** unless either:
- An explicit nonblank `FIREBASE_STORAGE_BUCKET` is provided in the reviewed runtime environment, or
- The already-validated Admin app's project ID exactly matches the checked-in config project ID, in which case its existing configured storage bucket is usable.

A `gs://` prefix is rejected (the variable must contain the bucket name only). Storage emulator mode stays restricted to `demo-*` projects; it never uses the checked-in real bucket. New `tests/storageBucketIsolation.spec.ts` covers cross-project denial, explicit staging selection, matching default, blank override, invalid prefix, and demo emulator isolation.

This code does not create, authorize or access a real GCS bucket. **Actual bucket ownership, Admin SDK identity, Cloud Storage holds/IAM, and real late Legal Hold race tests remain mandatory P0 VES-5 gates.** The `klar-admin` staging bucket is not created and must not be guessed from the project ID: only a provisioned, approved resource name may be configured.

This revision supersedes any earlier CI result on the same draft branch. Require a new exact-HEAD Enterprise CI, peer review and separate staged cloud evidence before merge. The project budget gate (EUR 10 monthly, 50/80/100 alerts) remains unverified.

