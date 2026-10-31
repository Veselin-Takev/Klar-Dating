# Issue #202 — legacy photo retention fail-closed patch (2026-10-31)

## Verified source finding
Previously `functions/src/deleteExpiredPhotos.ts` invoked `deleteExpiredPhotoPage` from `retention.ts`, which deleted `verification/` objects based on Storage `timeCreated` after 30 days, with no moderation decision or `fotoLoeschenAb` check. In contrast, `purgeVerificationStorageCron` delegates to the audited, decision-aware server endpoint. This is a **source finding only**, not proof of deployed functions or past customer deletion.

## Change and boundaries
- Keep `deleteExpiredPhotosCron` exported and scheduled, but **eliminate its verification-photo deletion call**. This avoids implicitly requesting remote Cloud Functions deletion during a deployment.
- Preserve its separate bounded `funnel_events` expiry cleanup (400 documents per execution).
- Preserve `purgeVerificationStorageCron` as the designated decision-aware purge path. The unused lower-level helper remains in `retention.ts` pending a separate approved cleanup, and must not be invoked by a scheduler.
- Add source-level regression gate `node --test scripts/test-legacy-photo-retention-boundary.mjs`.
- No production state, storage object, function, scheduler, IAM rule, secret, main branch or deployed job was changed.

## Evidence and remaining acceptance criteria
- Klar Enterprise CI **passed** at prior head `773e8a083a5044b4d2c85c08dd736f01826f96a1`: [workflow 41174002807](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41174002807). This is not evidence for subsequent commits.
- Integrated the static regression test into the mandatory `check:retention-p0` script in `package.json`, which is invoked by `check:enterprise`. **CI confirmation of the new head SHA is pending.** This test checks forbidden source calls and the preservation of separate workers; it does not model Firebase authorization, retention decisions, or a deployed scheduler.
- Required: run Functions typecheck/build and test suite, execute a real Storage/Firestore Emulator test covering pending, approved/rejected, missing decision, legal holds, generation conflicts, retries, 404/412 and reconciliation.
- Read-only inventory of deployed Cloud Functions and Scheduler jobs, environment variables, Storage bucket policy and audit trail; do not assume a source change is deployed.
- DPO/Legal/Security/SRE must approve decision-anchored retention (including Art. 5(1)(e), Art. 9, Art. 17), dry-run and controlled staging rollout, rollback, and historical photo reconciliation.
- Deployment may update the legacy function in place only after formal sign-offs; its source-level disablement does not disable an already deployed old version.
- Avoid reintroducing upload-age deletion through any direct call to `deleteExpiredPhotoPage`.



## 2026-10-31 additional source-audit and fail-closed guard
- Previous head `9c6ece1ee6f6173111bb20c2ccd40b5d22fb54be` passed [Klar Enterprise CI run 41174666145](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41174666145); **this pass is not evidence for the new changes below**.
- The exported `functions/src/retention.ts::deleteExpiredPhotoPage` still contained the old upload-age deletion implementation, which could have been called directly even after the scheduler was changed. It now throws `legacy_photo_age_retention_disabled` unconditionally and never scans Storage. This is intentional fail-closed behavior, not success.
- Updated `tests/photoRetention.spec.ts` and the real-Storage-emulator conditional test in `tests/storageRules.spec.ts` to require the legacy helper to fail and leave objects untouched. Expanded the mandatory source regression guard.
- `scripts/check-retention-config.mjs` previously asserted that the **legacy scheduler** read `verification_events` directly, contradicting the actual decision-aware API design. The check now looks at `purgeVerificationStorageCron` and `complianceStorage.ts` for the authoritative path and guards the retired helper. This standalone script has **not** been added to CI as part of this PR; its separate TTL provision checks are tracked by #70.

### Newly identified remaining P0 source risks (not remediated)
- `src/server/routes/complianceStorage.ts` currently issues `bucket.file(path).delete({ ignoreNotFound: true })` without a Storage generation precondition or a preceding object hold check. Concurrent object replacement and hold/error/audit reconciliation still need explicit tests and a reviewed design.
- The Firestore transaction that writes `photoPurged` checks the UID, but does not revalidate unchanged decision/state/path/generation against the earlier query snapshot. A concurrency design is needed before the authoritative path is considered verified.
- An already deployed legacy scheduled worker is not disabled by a source-only patch. Perform read-only Cloud Scheduler and Firebase Functions inventory followed by controlled staging rollout and Security/DPO/SRE sign-off.

**The new commits' CI, real emulator behavior and staging evidence are pending. Production remains NO-GO.**

**Production: BLOCKED / NO-GO.** No merge, production deployment or retention data mutation authorized.
