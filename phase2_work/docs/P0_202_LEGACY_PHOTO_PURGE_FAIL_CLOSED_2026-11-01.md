# P0 #202 — Legacy upload-age photo purge disabled (source-only remediation)

**Date:** 2026-11-01  
**Branch:** `fix/p0-202-disable-legacy-photo-purge-20261101` (based on `main`)  
**Release status:** **BLOCKED / PRODUCTION NO-GO**. This change is **not deployed** and is not proof of current Cloud Scheduler state.

## Verified source finding

In the original `functions/src/deleteExpiredPhotos.ts`, the scheduled `deleteExpiredPhotosCron` invokes `deleteExpiredPhotoPage(getMaintenanceBucket(), now, pageToken)`, which scans every object under `verification/` and decides to delete based on its GCS `timeCreated` plus 30 days, irrespective of `verification_events.status` and the authoritative moderation decision timestamp. The independent signed `purgeVerificationStorageCron` already exists but does not make that legacy deletion safe. [P0 #202](https://github.com/Veselin-Takev/Klar-Dating/issues/202).

## Implemented fail-closed remediation (unmerged)

1. Preserve `deleteExpiredPhotosCron` export and schedule for **deployment compatibility**. Its callback no longer lists, reads or deletes GCS photo objects; it emits `legacy_verification_photo_purge_disabled`. Bounded `funnel_events` cleanup is retained, with its own metric.
2. Leave `deleteAccountPhotos` (Art.-17 subject erasure) separate. Replace the obsolete `deleteExpiredPhotoPage` helper with an unconditional `legacy_age_only_photo_purge_disabled` error **before any Storage access**; even an overlooked old caller fails closed.
3. `photoRetention.spec.ts`: assert old/undecided verification photos cannot be scanned or deleted, even when the caller supplies a date beyond 30 days or an old page cursor. `storageRules.spec.ts`: the real isolated Storage emulator case now verifies a photo survives the deprecated age-only worker invocation, and explicitly removes its test fixture afterward.
4. `scripts/check-legacy-photo-purge.mjs` plus **mutation regression tests** verify disabled worker, no age-only calls, no object reads, retention helper tripwire, still-deployed function export, continued `funnel_events` cleanup, and an independent signed decision-aware scheduler. Mandatory `check:legacy-photo-purge` is inserted into `check:enterprise`. The historical `check-retention-config.mjs` is aligned with the maintained retention policy gates.
5. `docs/DATA_RETENTION.md` now correctly identifies `purgeVerificationStorageCron` + the API route/retention engine as the intended decision-aware path, rather than incorrectly attributing it to `deleteExpiredPhotosCron`.

## Not fixed or approved by this patch

- **Live deployment:** An already deployed `deleteExpiredPhotosCron` continues executing its **previous deployed code** until the approved fix is actually deployed or a Cloud Scheduler job is separately disabled. This branch performs neither action; SRE must inventory deployed function revisions, scheduler/job execution, service account permissions, retry configuration, backlog and safe rollback.
- **Modern purge races:** The source of `src/server/routes/complianceStorage.ts` currently invokes GCS `.delete({ignoreNotFound:true})` without a visible `ifGenerationMatch`, and checks Firestore decision history separately from the physical delete. Separate generation fencing, changed-decision/hold, 404/412 and reconciliation fixes remain P0 work under #202 before enabling live purging.
- **Privacy/legal:** Independent DPO/Legal signoff for Art. 5(1)(e), Art. 9, Art. 17; evidence retention, legal holds and actual storage provenance remain absent.
- **Release:** Real CI on this branch's exact SHA, Storage Emulator tests, deployed IAM/Cloud Scheduler evidence, 14 mandatory gates where applicable, and independent Security/SRE/DPO/Release Owner signoffs are not automatically conferred by source changes. `main` remains unchanged; no GO.
- **Integration sequencing:** Draft PR #268 also edits the long `check:enterprise` command in `package.json` on a separate main-based branch. Before any approved sequential merge, reconcile and retest both mandatory gates; do not silently lose either security check.

## Staging-only proof required before deployment

Confirm an authorized staging snapshot of Cloud Functions and Scheduler, with SHA/revision provenance. In a non-production Firebase emulator/storage test, supply a 31-day-old *pending* photo and show zero object deletion; supply approved/rejected photos with decisions older than 30 days and show correct deletion and immutable evidence; simulate a replaced generation and a hold; inject failed network/storage/audit writes and verify retries/receipts do not falsely claim completion. Separately prove `funnel_events` TTL cleanup still runs. Attach logs with exit code, run ID, exact source/rules SHA, job identities and reviewer approvals. Only then may the release owner consider a controlled deployment plan.

**No production mutation or claimed official release approval. P0 #202 remains OPEN / NO-GO.**

## Regression-Gate-Erweiterung (2026-11-02, weiterhin Draft)

Der quelltextbasierte Fail-closed-Guard in `scripts/check-legacy-photo-purge.mjs` wurde auf zusätzliche direkte Storage-SDK-/Bucket-/Metadaten-Zugriffsmuster sowie ein Alias-Import des alten Retention-Helpers erweitert. Vier neue Mutationsprüfungen in `scripts/check-legacy-photo-purge.test.mjs` verhindern Regressionen, die den bisherigen Pattern-Guard umgehen konnten. **Das bleibt ein Source-Regression-Gate (E1/E2), keine AST-basierte Vollständigkeitsgarantie und kein Beleg über aktiven Cloud-Scheduler-/Firestore-/GCS-Laufzeitstatus (E4).**

Der PR-Head hat sich nach der Änderung geändert; die zuvor erfolgreiche GitHub-CI für SHA `54ef22b87d40c90711e575d7e133b9311417f2f1` gilt **nicht** als Testnachweis für diesen neuen SHA. Vor Merge aktuelle Checks, unabhängige Reviews und einen gegen den aktuellen `main` integrierten Teststand nachweisen. Es gab keine Cloud-, `main`- oder produktive Datenänderung. `productionApproved=false`, **NO-GO**.

## Review-Abgleich 05.11.2026

Erneuter Read-only-Abgleich mit `main`: `functions/src/deleteExpiredPhotos.ts` ruft weiterhin `deleteExpiredPhotoPage()` auf; `functions/src/retention.ts` selektiert nach `timeCreated + 30 Tage` ohne autoritative Moderationsentscheidung. PR #269 ersetzt den alten Scan durch einen fail-closed Tripwire und erhält den exportierten Scheduler-Namen sowie die separate `funnel_events`-Bereinigung. Exakter bisheriger PR-Head `895aaa3da2056d7799f887596b89c09207699925` hatte CI-Run [41527555204](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41527555204) mit `completed/success`. Der hierdurch entstehende neue Head muss erneut validiert werden. PR #203 überlappt beim Retention-Code: keine parallelen Blind-Merges. Keine Cloud-Deaktivierung oder Live-Wirksamkeit nachgewiesen; Security-, SRE- und DPO-Freigaben fehlen. **productionApproved=false / NO-GO**.

## CI- und Integrationsnachtrag 05.11.2026

Der exakte PR-#269-Head `b25374275ba28515f907e624e54d94ad595bd5e3` hat GitHub Actions [42001269676](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42001269676) mit `completed/success` abgeschlossen. PR #251 Head `7ff8b6d7350d336d2e1b4eb054f65d5f058ef91f` hat ebenfalls [41999970921](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41999970921) mit `completed/success` abgeschlossen. Beide sind unabhängige CI-Belege, **keine** menschliche Abnahme oder Cloud-Bestätigung.

Vollständiger Dateinamen-Abgleich der PR-Patches #269 und #203 zeigt **sechs gemeinsame Dateien**: `docs/DATA_RETENTION.md`, `functions/src/deleteExpiredPhotos.ts`, `functions/src/retention.ts`, `package.json`, `tests/photoRetention.spec.ts`, `tests/storageRules.spec.ts` (jeweils unter `phase2_work/`). Die vier #269-exklusiven Dateien sind `docs/P0_202_LEGACY_PHOTO_PURGE_FAIL_CLOSED_2026-11-01.md`, `scripts/check-legacy-photo-purge.mjs`, `scripts/check-legacy-photo-purge.test.mjs`, `scripts/check-retention-config.mjs`. Dies ist eine Dateischnittmenge, **kein** Nachweis tatsächlicher Git-Merge-Konflikte. Integration ausschließlich sequenziell nach Rebase, semantischem Review der Sicherheitsinvarianten, vollständigen Negativtests und neuer exact-SHA-CI. Dieser Dokumentations-Commit selbst benötigt neue CI. `productionApproved=false` / **NO-GO**.
