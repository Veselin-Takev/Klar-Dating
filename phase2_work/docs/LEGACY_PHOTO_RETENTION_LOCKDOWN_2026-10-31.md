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
- Source edited atomically on a dedicated branch. Static regression test added; **CI and runtime tests not yet confirmed** at this head SHA.
- Required: run Functions typecheck/build and test suite, execute a real Storage/Firestore Emulator test covering pending, approved/rejected, missing decision, legal holds, generation conflicts, retries, 404/412 and reconciliation.
- Read-only inventory of deployed Cloud Functions and Scheduler jobs, environment variables, Storage bucket policy and audit trail; do not assume a source change is deployed.
- DPO/Legal/Security/SRE must approve decision-anchored retention (including Art. 5(1)(e), Art. 9, Art. 17), dry-run and controlled staging rollout, rollback, and historical photo reconciliation.
- Deployment may update the legacy function in place only after formal sign-offs; its source-level disablement does not disable an already deployed old version.
- Avoid reintroducing upload-age deletion through any direct call to `deleteExpiredPhotoPage`.

**Production: BLOCKED / NO-GO.** No merge, production deployment or retention data mutation authorized.
