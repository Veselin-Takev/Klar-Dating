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

## CI-Fehler und Reparatur: Legacy-Guard-RegExp (05.11.2026)

[CI 42039804571](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42039804571) auf `8083fe0dfa6c1a817b05ca2d21321e4ff80bff04` schlug im Schritt `Enterprise static gates` fehl: Node 22 meldete `SyntaxError: Invalid regular expression: Unterminated group` in `scripts/check-legacy-photo-purge.mjs`. Ursache war doppelte Backslash-Escapierung innerhalb eines JavaScript-RegExp-Literals (`\\\\b`, `\\\\s`, `\\\\(`). Commit `f8e35ec098a5aa5c6ec8a8bede4b245a10aa7964` korrigiert die Escapes; der Mutationstest für Throwing-Shim und Const-Alias bleibt bestehen. Die Reparatur ist bis zu einem **neuen erfolgreichen exact-SHA-CI-Lauf** nicht als verifiziert anzusehen. Keine Produktivfreigabe: `productionApproved=false`.

## Legacy-Helper-Referenzen (05.11.2026)

Die Regex-Reparatur auf Head `fbf3aa1dc69d989777ff58cf979659685e42ac12` ist durch [CI 42041342103](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42041342103) bestätigt. Eine weitere statische Guard-Härtung erkennt neben Deklarationen auch direkte Aufrufe und Zuweisungen von `deleteExpiredPhotoPage` im geprüften `functions/src/retention.ts`-Quelltext. Zwei zusätzliche Mutationstests prüfen diese Varianten. Diese textbasierte Schranke ist ausdrücklich **kein** vollständiger AST-/Call-Graph-Beweis; Alias-Aufrufe, dynamische Imports und fremde Quellen benötigen separate Reviews. Neue Commits bedürfen eigener exact-SHA-CI-Prüfung. `productionApproved=false`.

## Offene Cloud-Evidenz für die Freigabe (05.11.2026)

Die Implementierung in `src/server/routes/complianceStorage.ts` führt Lease-Prüfungen, transaktionale Purge-Intents, Generation-Preconditions, Storage-Metadatenkontrollen und einen Audit-Proof durch. **Diese Codeprüfung beweist keine Cross-Service-Atomizität** zwischen Firestore und Cloud Storage. Für die Freigabe sind folgende **noch nicht belegte** Staging-/Produktionsnachweise mit Umgebung, Zeitstempel, verantwortlicher Person und redigiertem Beleg erforderlich:

1. Cloud Scheduler / Cloud Functions: Inventar der tatsächlich deployten Legacy- und neuen Trigger, Region, Zeitplan, Service Account, Aufrufpfad und Nachweis, dass der alte Upload-Alter-Löschpfad keine Fotos mehr löscht.
2. Firestore: reale Lease-Konkurrenz, Ablauf und Wiederaufnahme sowie Checkpoint-Replay nach Prozessabbruch; keine gleichzeitigen Löschungen durch überlappende Worker.
3. Storage: Holds/Retention-Locks, Generation-412, bereits fehlendes Objekt (404) mit und ohne persistierten Intent, Wiederauftauchen eines Objekts und Prüfung der Objektgeneration bei Reconciliation.
4. Datenschutz/Audit: Entscheidungsänderung vor Löschung, idempotente Wiederholung, vollständige und minimierte Audit-Evidenz sowie Art.-17-Löschung unabhängig vom Scheduler.
5. Betrieb: signierter Job-Aufruf, IAM/Secret-Rotation, Monitoring und Alarmierung, kontrollierter Canary, Rollback und Eskalation bei Fehlerquote/Backlog.

**Gate:** Solange diese Belege und unabhängige DPO-, AppSec-, SRE- und Release-Owner-Freigaben fehlen, bleiben PR #317 Draft und `productionApproved=false`. CI-Erfolg ist nur Repository-Evidenz. Der CI-Lauf [42042948194](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42042948194) für den vorherigen Head `17ec5f046ba8bd74f1b0e9edb2dd4f6ec0b32339` war bei der Abfrage `in_progress`.

## Abgleich mit den Acceptance Criteria von Issue #202

Quelle: [Issue #202](https://github.com/Veselin-Takev/Klar-Dating/issues/202), Status bei Abfrage `open`. Der vorherige Head `ef2da6da5b41f40bb7178857c0fdd37b24add13e` bestand [CI 42044726657](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42044726657).

| Kriterium | Repository-Stand | Für Abschluss weiterhin erforderlich |
| --- | --- | --- |
| Ein autoritativer, entscheidungsbasierter Purge-Pfad | Legacy-Upload-Alter-Löschung im Quelltext deaktiviert, neuer signierter Pfad und statischer Guard im Integrations-PR | Deploytes Scheduler-/Functions-Inventar, sichere Migration und Rollback |
| Bounded Scan, Generation, Holds, 404/412 und Audit | Scanner-, Retention- und HTTP-Tests sowie transaktionale Intent-/Audit-Implementierung vorhanden | Staging-Nachweis zu Lease-Fencing, Objekt-Replacement, Storage-Retention und Cross-Service-Races |
| Pending/Approved/Rejected, beschädigte Daten, Retries | Regressionstests in PR #317 enthalten; keine Aussage über vollständige Produktionsabdeckung | Emulator-Ergebnis je Acceptance Case mit Testnamen und Logs unabhängig abnehmen |
| Korrekte Retention-Dokumentation und Art.-5/9/17-Review | `DATA_RETENTION.md` korrigiert, Einschränkungen dokumentiert | Schriftliche DPO-/Legal-Freigabe und Policy-Abgleich |
| Sichere Aktivierung | **Nicht durchgeführt** | Genehmigter Staging-Canary, Live-Konfigurationsnachweis, AppSec/SRE/ReleaseOwner-Signoff |

**Entscheidung:** Issue #202 nicht schließen, keine Produktionsfreigabe aus CI ableiten. Das separate [Issue #204](https://github.com/Veselin-Takev/Klar-Dating/issues/204) zu Profilbild-Zugriffsregeln bleibt ein eigenständiger P1-Sicherheitsbefund und wird nicht stillschweigend durch den Foto-Purge-PR als behoben dargestellt. `productionApproved=false`.

## Negative Scanner-Grenzwerte (05.11.2026)

[CI 42046257238](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42046257238) bestätigt den vorherigen Head `0b5dd9c1e4d81112609fceb8875c8fd26329bf5a` als erfolgreich; für die nachfolgenden Änderungen gilt dieser Nachweis **nicht**. Zwei neue Testfälle in `scripts/test-verification-purge-scan.mjs` prüfen, dass ungültige Scan-Limits (Null, zu groß, NaN/Infinity) bereits vor Fetch/Handle/Checkpoint abgewiesen werden und ungültige Ergebniszähler (NaN, negativ, Bruchteile, Infinity) niemals einen Checkpoint schreiben. Dies sind Repository-Regressionstests, keine Emulator-/Cloud-Evidenz. PR #317 hat bei der letzten Abfrage keine Reviews und bleibt Draft; `productionApproved=false`.

## Persistierte und geladene Cursor: Fail-Closed-Negativtests

Der vorherige Head `67e034402f82f488a7519c3d220d9afd6a6c1056` bestand [CI 42048286928](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42048286928). Zwei weitere Regressionstests prüfen nun ungültige persistierte Cursor (negative/zu große Zeit, ungültige Nanosekunden, Bruchteile, leere/überlange IDs, Pfadtrennzeichen, falsche Datentypen) und ungültige Cursor aus der Fetch-Antwort. Die Assertions stellen sicher, dass vor einer Ablehnung weder Lösch-Handler noch Checkpoint-Schreibvorgänge aufgerufen werden; bei persistiert ungültigem Cursor findet auch kein Fetch statt. Der neue Commit benötigt eine eigene exact-SHA-CI-Bestätigung. `productionApproved=false`.

## Cursor-Fortsetzung und Short-Page-Abschluss

Zwei zusätzliche Regressionstests sichern die Wiederaufnahmegrenze ab: Ein vom Fetch gelieferter Cursor, der gleich oder kleiner als der persistierte Checkpoint ist, wird vor Handle/Checkpoint fail-closed zurückgewiesen. Eine erfolgreiche, kürzere Schlussseite verarbeitet alle Einträge und setzt danach den Checkpoint explizit auf `null`, ohne fälschlich `hasMore` zu setzen. Dies ergänzt die vorhandenen Tests zu fehlgeschlagenen Teilseiten (kein Reset bei Fehlern). Der zuvor gestartete [CI-Lauf 42049971806](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42049971806) für `55947d977288d4736436f03e50c3f243b9a01aaf` war bei der Abfrage noch `in_progress`; die neuen Commits benötigen ihren eigenen CI-Nachweis. `productionApproved=false`.

## Scanner-Adapter: expliziter Fail-Closed-Fehler für defekte Zeilen

Der Scanner prüft nun vor dem Zugriff auf `item.cursor`, ob eine Fetch-Zeile überhaupt ein Objekt mit Cursor-Feld ist. Fehlerhafte Adapter-Ergebnisse (`null`, `undefined`, primitive Werte oder fehlendes Feld) lösen stabil `purge_page_invalid` aus, statt eines zufälligen JavaScript-`TypeError`. Ein Regressionstest bestätigt, dass weder `handle` noch `checkpoint` aufgerufen werden. Die Änderung verhindert keine Storage-Races und ist nicht als Cloud-Nachweis zu werten. Für den vorherigen Head `3976a9301bbb6c18dcf6177ed9b0ad2ab10c9a29` war [CI 42051291415](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42051291415) bei der letzten Abfrage noch in Bearbeitung; der aktuelle Head benötigt erneut eine CI-Prüfung. PR #317 bleibt Draft und `productionApproved=false`.
