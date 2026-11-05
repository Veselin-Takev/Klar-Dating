# P0 #202 – Gemeinsamer Integrations-Review (05.11.2026)

**Status: DRAFT / NO-GO.** Integrationsbranch `integration/p0-202-photo-purge-20261105` basiert exakt auf PR #203 Head `1850e0a78b22e600e5add99273b84c081ffc3892`; kein Merge nach `main`.

## Änderungen und Entscheidung bei sechs überlappenden Dateien

- `functions/src/deleteExpiredPhotos.ts`: PR #203 bleibt maßgeblich: Legacy-Cron verarbeitet nur `funnel_events`, keine biometrischen Storage-Objekte.
- `functions/src/retention.ts`: PR #203 bleibt maßgeblich: obsolete Alters-Scanner-API vollständig entfernt, generation-conditional Account-Erasure erhalten.
- `docs/DATA_RETENTION.md`: PR #203 bleibt maßgeblich, die Entscheidung über aktive TTL/Cloud-Konfiguration ist **nicht** durch Repositorytext bewiesen.
- `package.json`: PR #203 plus `check:legacy-photo-purge` in `check:enterprise`; der PR-269-Sicherheitscheck ist nun ein echtes CI-Gate.
- `tests/photoRetention.spec.ts`, `tests/storageRules.spec.ts`: PR #203 bleibt maßgeblich, weil dessen Löschpfad und Regressionstests neuer sind.
- Zusätzliche Source-Guard- und Mutationstests aus PR #269 wurden an den entfernten Helper und die Legacy-Logmeldung aus PR #203 angepasst.

## Nachweis und Restrisiken

PR #203: [CI 42017264009 PASS](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42017264009). PR #269: [CI 42020003801 PASS](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42020003801). **Diese Läufe belegen nicht den Integrations-HEAD.** Es müssen CI inklusive Enterprise Static Gates, Firestore-/Storage-Emulator-Tests, Idempotenz bei Wiederholung, Hold-/Generation-Races, aktive Scheduler-/IAM-/TTL-Konfiguration und unabhängige Security/DPO/SRE/ReleaseOwner-Reviews geprüft werden. Feature-Flag `KLAR_VERIFICATION_PHOTO_PURGE_ENABLED` bleibt default-deny. Kein Deployment, keine produktive Löschung, keine automatische Freigabe. `productionApproved=false`.

## Kombinierter CI-Nachweis und weiterer Negativtest

Der integrierte Commit `38a2e75798fb7dcf970662524612a96f3fb41ef9` hat [GitHub Actions 42021488949](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42021488949) mit `completed/success` bestanden. Der Integrations-Branch enthält nun außerdem einen gezielten Test für eine **unvollständige letzte Scan-Seite mit fehlgeschlagenem Artefakt**: Der bestehende persistierte Cursor darf weder auf `null` zurückgesetzt noch überschrieben werden; `hasMore` muss `true` bleiben, damit die Seite wiederholt wird. Dieser zusätzliche Test erzeugt einen neuen Head und benötigt daher erneuten exact-SHA-CI-Nachweis. Keine Aussage über Cloud-Deployment oder unabhängige Freigabe; `productionApproved=false`.
