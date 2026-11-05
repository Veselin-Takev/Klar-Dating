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

## Dokumentations- und Guard-Härtung

[CI 42022732490](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42022732490) für Head `e9963740e5a7cd5ce41fb7016f8b1cf24568b6e9` wurde bei der Prüfung als `in_progress` gemeldet; kein Erfolg wird vor Abschluss behauptet. Die bisher zu großzügige Dokumentationsbedingung im Legacy-Guard (beliebige Erwähnung von `Legacy`) wurde auf eine konkrete Erklärung des deaktivierten Upload-Alter-Pfades eingeschränkt. Ein Mutationstest schlägt bei irreführender Reaktivierungsbehauptung fehl. Die überholte Aussage, der Scanner werfe bei Einzelfehlern eine Exception, wurde aus `DATA_RETENTION.md` berichtigt: tatsächliches Verhalten ist Zähler + `hasMore=true` ohne Cursor-Checkpoint. Der neue Head muss erneut exact-SHA CI bestehen. `productionApproved=false`.

## Initiale Deadline-Grenze (05.11.2026)

Der Head `72334db4f5d6fff42c5ade554d0e9d88bfe35bec` hat [CI 42023865779](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42023865779) erfolgreich abgeschlossen. Die anschließende Review entdeckte, dass `scanPurgePages()` die Deadline zuvor erst **ab Seite zwei** prüfte (`n > 0`). Bei bereits abgelaufener Laufzeit konnte daher eine erste Seite trotzdem Storage- und Firestore-Operationen starten. Die Deadline wird nun vor **jeder** Seite einschließlich der ersten geprüft. Ein Negativtest bestätigt: `hasMore=true`, null Fetches, null Checkpoints, unveränderte Ausgangsposition bei initial überschrittener Deadline. Die Prüfung begrenzt den Start einer Seite, nicht bereits laufende asynchrone Operationen; Timeout-/Lease-Fencing und Cloud-Writer-Koordination bleiben offene P0-Nachweise. Die neuen Commits brauchen eigenen exact-SHA-CI-Lauf. `productionApproved=false`.

## CI-Fehlerbehebung: Deadline-Testvertrag (05.11.2026)

Der exakte Head `8da7480ffdec98d1359fae9dbc6d73a3ac52069b` schlug in [CI 42025519920](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42025519920) beim Enterprise-Static-Gate fehl: Der ältere Test `a deadline is respected after a complete page checkpoint` verwendete `deadline: () => true` und erwartete dennoch 40 verarbeitete Einträge. Seit der absichtlichen Härtung **vor** der ersten Seite ist diese Erwartung widersprüchlich (`actual=0`). Der Test simuliert jetzt korrekt einen Fristablauf **nach** der ersten vollständigen Seite (erster Deadline-Check `false`, zweiter `true`); der neue separate Initial-Deadline-Test bleibt erhalten. Erneuter exact-SHA-CI-Nachweis erforderlich. Keine Freigabe: `productionApproved=false`.

## Deadline nach Firestore-Page-Fetch (05.11.2026)

[CI 42032391116](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42032391116) für den vorherigen Head `395074b7f2881d674c1c48a27de387a9011b2a7b` war beim Abruf noch `in_progress`. Zusätzliche Review: Ein Fetch kann die verfügbare Laufzeit aufbrauchen, obwohl die Deadline vor dem Fetch noch nicht erreicht war. Der Scanner prüft deshalb **nach Fetch und Cursor-Validierung, vor `handle()`** erneut die Deadline und gibt `hasMore=true` zurück, ohne Storage-Mutationen oder Cursor-Checkpoint zu starten. Neuer Negativtest simuliert Deadline-Überschreitung während des Fetches; der bestehende Nach-Erstseite-Test berücksichtigt nun beide Deadline-Prüfpunkte. Die neue Änderung benötigt eigenen CI-Lauf. Dies ist kein Ersatz für Cross-Service-Fencing oder Abbruch bereits gestarteter Mutationen. `productionApproved=false`.

## Leere Scan-Seite nach Deadline (05.11.2026)

Der integrierte Head `51555430072b1186f229dc2d672c9a6569399f79` bestand [CI 42033613901](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42033613901) (`completed/success`). Weitere Edge-Case-Prüfung: Der Empty-Page-Pfad schrieb zuvor `checkpoint(null)` **vor** dem nachgelagerten Deadline-Check. Wenn ein langsamer Fetch die Deadline überschritt und eine leere Seite lieferte, konnte der persistierte Cursor dennoch zurückgesetzt werden. Der Deadline-Check liegt nun direkt nach der Page-Formvalidierung und vor dem Empty-Page-Zweig; ein Negativtest fordert bei während des Fetches überschrittener Deadline `hasMore=true` und null Checkpoint-Schreibvorgänge. Neue Commits benötigen erneute exact-SHA-CI-Bestätigung. Cloud- und Lease-Fencing bleibt offen; `productionApproved=false`.

## Integrations-Freigabekriterien und Review-Nachweise

Bei der Prüfung am 05.11.2026 waren für [Draft PR #317](https://github.com/Veselin-Takev/Klar-Dating/pull/317) **keine Pull-Request-Reviews** registriert. Der CI-Lauf [42035138822](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42035138822) für Head `5f75a00fbf5379187c5de175101083fee57e7378` war bei der letzten Abfrage noch `in_progress`; Erfolg ist nicht bestätigt.

Vor einem Merge sind mindestens erforderlich: (1) erfolgreiche verpflichtende Checks auf dem **aktuellen** Head; (2) unabhängige Code- und Security-Reviews der kombinierten PR #203/#269-Änderungen einschließlich der Storage- und Audit-Races; (3) explizite Entscheidung, dass die überlappenden Einzel-PRs nicht separat und widersprüchlich gemergt werden; (4) dokumentierter Rollout- und Rücknahmeplan für beide exportierten Scheduler, einschließlich Live-Inventar; (5) keine Änderung des `productionApproved=false`-Status durch einen bloßen Merge. Produktionsaktivierung benötigt darüber hinaus Staging-/Cloud-Evidenz zu Holds, Generationen, Lease, Retention und unabhängige DPO/AppSec/SRE/Release-Owner-Freigaben. Kein autonomer Merge oder Cloud-Change ohne diese Nachweise.

## Cursor- und Checkpoint-Negativtests

Der vorherige Head `cb7722922d19d4b3fade107a2de07b3c58cbbc69` hat [CI 42036767735](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42036767735) bestanden. Für die Fortsetzung der P0-Härtung wurden drei zusätzliche Offline-Negativtests ergänzt: (1) doppelte Cursor-Zeilen werden vor `handle()` und vor `checkpoint()` abgelehnt; (2) ein fehlgeschlagener persistenter Checkpoint nach erfolgreicher Seitenverarbeitung wird als Fehler propagiert, statt Erfolg zu melden; (3) dasselbe gilt für den Reset-Checkpoint einer leeren Seite. Sie prüfen vorhandene Fail-Closed-Verträge und ersetzen weder reale Firestore-Transaktionen noch Crash-/Replay-/Lease-Tests. Neuer exact-SHA-CI-Nachweis erforderlich; `productionApproved=false`.

## Legacy-API endgültig entfernen (05.11.2026)

Der vorherige Head `0d3bd517cc06c73d0ed9e6ad657af186f0246a24` bestand [CI 42038280647](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42038280647). Der kombinierte PR übernimmt die vollständige Entfernung von `deleteExpiredPhotoPage` aus PR #203. Der zuvor für PR #269 noch akzeptierte Throwing-Shim ist im Integrationsstand unnötig und würde eine alte, gefährliche API-Signatur dauerhaft erhalten. Der Legacy-Guard verbietet nun die Wiedereinführung der Funktion **auch als Throwing-Shim** sowie eine gleichnamige `const`-Deklaration; zwei neue Mutationstests sichern diese Grenze. Der `deleteAccountPhotos`-Pfad für Art.-17-Löschung bleibt ausdrücklich erhalten. Die neuen Commits benötigen einen eigenen CI-Nachweis. Keine Produktionsfreigabe: `productionApproved=false`.
