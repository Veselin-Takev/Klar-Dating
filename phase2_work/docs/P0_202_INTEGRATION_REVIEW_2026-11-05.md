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

## Fetch-Vertrag und Firestore-Ausfall

[CI 42051735028](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42051735028) bestätigte den vorherigen Head `8ec665459be675ddf4cc1948fd107e43c9d2e2a5` als erfolgreich. Zwei neue Negativtests prüfen den vorhandenen Fail-Closed-Pfad für nicht-arrayförmige Fetch-Antworten sowie für einen geworfenen Firestore-Abfragefehler. Beide müssen ohne Aufruf von `handle` oder `checkpoint` abbrechen. Diese Ergänzung ändert keine Produktionskonfiguration; der neue Head braucht eigene CI-Bestätigung. Unabhängige Reviews und Cloud-Evidenz bleiben offen. `productionApproved=false`.

## Exakt volle Schlussseite und Invocation-Budget

Der vorherige Head `b5adcb04184cafb89085e9538120cb081a5bc850` bestand [CI 42053518992](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42053518992). Zwei neue Tests prüfen den Grenzfall, dass eine letzte Seite genau `pageSize` Elemente enthält: Erst eine anschließende leere Fetch-Antwort bestätigt den vollständigen Abschluss und setzt den Cursor zurück. Wenn stattdessen `maxPages` erreicht wird, bleibt der zuletzt erfolgreich gespeicherte Cursor bestehen und `hasMore=true`, damit der Scheduler den Scan fortsetzen kann. Die neuen Commits erfordern eine separate CI-Bestätigung; die HTTP-Route meldet bei `hasMore=true` weiterhin einen retrybaren Status. PR #317 bleibt Draft, keine unabhängigen Reviews, `productionApproved=false`.

## Deadline-/Checkpoint-Grenze zwischen Seiten

Der vorherige Head `f9a5b24ca8e4c90aff26d93cc412c1882c03330d` bestand [CI 42056214865](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42056214865). Zwei weitere Regressionstests prüfen: (1) Deadline-Ablauf unmittelbar nach einem erfolgreich persistierten Full-Page-Checkpoint verhindert einen weiteren Fetch, erhält den Cursor und meldet `hasMore=true`; (2) ein fehlgeschlagener Checkpoint-Schreibvorgang verhindert den Fetch der nächsten Seite und propagiert den Fehler. Diese Tests ergänzen, ersetzen aber keine echte Firestore-Transaktions-/Cloud-Lastprüfung. Die neuen Commits benötigen eigene exact-SHA-CI-Evidenz; unabhängige Reviews fehlen. `productionApproved=false`.

## Independent Production Evidence Gate – release decision (2026-11-05)

**Status: BLOCKED / NO-GO; productionApproved=false.** The last tested head `b2125873e4facee9fe2f0f4ccfd9d654ce4d3d55` passed [CI 42058988928](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42058988928). Independent reviews: 0. This CI result proves repository checks only, not production deployment safety.

Required independent evidence before enabling purge:

1. **SRE inventory:** Actual deployed Cloud Functions and Scheduler jobs (including legacy `deleteExpiredPhotosCron` and signed `purgeVerificationStorageCron`), targets, enablement state, IAM identities, logs, deployment revisions, and safe migration/rollback. Never blindly delete a deployed function.
2. **AppSec + SRE writer-fencing:** Enumerate all Firestore decision writers and GCS object writers. Demonstrate that decision changes, legal holds and generation replacements cannot race a delete. Firestore transactions and GCS operations are **not** cross-service atomic; source-level guards are insufficient proof.
3. **Staging QA:** Isolated, synthetic-artifact tests for pending/conflicting/missing decision, approved/rejected retention, legal hold, 404 reconciliation, 412 generation change, database and Storage failures, retries, concurrent Scheduler invocations and persisted checkpoint recovery. Capture immutable logs without KYC photos, secrets or personal identifiers.
4. **SRE operations:** Observe lease expiration, audit receipts, sustained 503, failure counts, backlog and alert routing. Record a rehearsed stop/rollback procedure, ownership and escalation.
5. **DPO/Legal:** Signed decision on GDPR Art. 5(1)(e), Art. 9 and Art. 17, including retention basis and deletion/audit evidence.
6. **Release Owner:** Exact-SHA CI, branch protection, independent AppSec/SRE/DPO approvals, staging evidence links and explicit production enablement approval. Until then the default-deny `KLAR_VERIFICATION_PHOTO_PURGE_ENABLED` switch stays off.

| Gate | Owner | Evidence | Decision |
| --- | --- | --- | --- |
| Exact-SHA CI | Release Owner | 42058988928 (prior head) | PASS for prior head only |
| Independent PR review | AppSec | Not supplied | OPEN |
| Cloud inventory + migration | SRE | Not supplied | OPEN |
| Writer fencing + race proof | AppSec/SRE | Not supplied | OPEN |
| Synthetic staging scenarios | QA/SRE | Not supplied | OPEN |
| GDPR review | DPO/Legal | Not supplied | OPEN |
| Final production authorization | Release Owner | Not supplied | NO-GO |

Every evidence record must identify environment, deployment revision, UTC timestamp, approver and immutable artifact link. This checklist does not authorize production mutation.

## Operations: Poison-Pill-Seite und sichere Entstörung

Ein einzelner inkonsistenter Datensatz (`verification_photo_decision_conflict`, fehlender Storage-Pfad, ungültiger `decidedAt` oder nicht zuordenbarer Audit-Intent) wird absichtlich als `failed` gezählt. Der Scanner checkpointet **nicht** hinter einer teilweise fehlgeschlagenen Seite. Damit kann derselbe Fehler bei jedem Scheduler-Lauf erneut auftreten und den nachfolgenden Backlog blockieren. Dies ist eine bewusst fail-closed ausgelegte Datenschutz-Schranke, kein Anlass, die fehlerhafte Zeile zu überspringen oder den Cursor manuell vorzusetzen.

**Runbook für SRE und DPO:** (1) Bei wiederholtem 503/`failedCount>0` Alarm und P0/P1-Triage auslösen, Scanner-Flag im Zweifel deaktiviert lassen. (2) Unter restriktivem Zugriff ausschließlich Metadaten der betroffenen Firestore-Einträge und Entscheidungshistorie analysieren; keine KYC-Fotos oder Tokens in Logs/Tickets kopieren. (3) Datensatz-Ursache und rechtliche Löschgrundlage mit DPO/AppSec klären, Entscheidung/Audit-Intent nur über einen geprüften, revisionsfähigen Korrekturpfad reparieren. (4) Scanner im isolierten Staging mit identischem Fehlermuster erneut testen; Checkpoint muss erst nach vollständig erfolgreicher Seite fortschreiten. (5) Nach genehmigter Wiederaufnahme Backlog, Lease, `hasMore`, Fehlerzahl und Audit-Belege kontrollieren. **Nicht zulässig:** manuelles Cursor-Skippen, unprotokollierte Löschung, pauschale 404-Erfolgsannahme oder Aktivierung des alten Upload-Alter-Crons.

**Offene Produkt-/Governanceentscheidung:** Ob und wie eine quarantänisierte Ausnahme-Warteschlange für fehlerhafte Entscheidungen zulässig wäre, erfordert eine gesonderte Datenschutz- und Sicherheitsprüfung. Sie ist in PR #317 nicht implementiert. Der erfolgreiche [CI-Lauf 42061072824](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42061072824) gilt für den vorherigen Head `79b57708e82d43479a1f392c2a8282f62749a99c`; der Dokumentations-Commit braucht eigenen CI-Nachweis. `productionApproved=false`.

## Retention-Arithmetik: nicht-endliche Dauer und Überlauf

Der vorherige Head `488a77161cb794690032d683dff2ddf8a2f39247` bestand [CI 42063171808](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42063171808). In `storageRetentionEngine.ts` wurde eine Validierungslücke geschlossen: `NaN`, `Infinity`, `-Infinity` und arithmetischer Überlauf bei `retentionDays` werden in `calculateVerificationRetentionExpiry` jetzt explizit abgelehnt. Ein Regressionstest deckt diese Grenzwerte sowie die reguläre 30-Tage-Berechnung ab. Dies ist Defense-in-Depth für die Fristberechnung; die produktive Standardfrist bleibt unverändert. Die neuen Commits benötigen eigenen CI-Nachweis. Independent Reviews und Cloud-Fencing bleiben offen; `productionApproved=false`.

## Retention-Entscheidung: ungültige Systemzeit fail-closed

Der vorherige Head `f00a70fc3306353e80c260ee84bee90085f64af4` bestand [CI 42065941887](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42065941887). Ein weiterer Code-Fix verhindert, dass `isVerificationArtifactExpired` bei `now=Infinity` oder anderen ungültigen Evaluierungszeiten eine Löschung freigibt. Die Funktion liefert bei nicht-endlicher oder nicht-positiver Systemzeit `false`; der Regressionstest prüft `NaN`, `±Infinity`, negative und Null-Zeit sowie den exakten Ablaufzeitpunkt. Dieser Schutz ersetzt keine NTP-/Clock-Monitoring-Prüfung in Staging. Neue Commits erfordern eine eigene CI-Bestätigung; `productionApproved=false`.

## Runtime-Entscheidungswerte: explizite Allowlist vor Storage-Delete

Der vorherige Head `ebadafc7045597b9a1fcd196853c374ad2a9afc1` bestand [CI 42068507851](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42068507851). Bei der Codeprüfung wurde eine tatsächliche Defense-in-Depth-Lücke in `purgeSingleVerificationArtifact` behoben: Bisher verhinderte allein `status === 'pending'` die Löschung; unerwartete Runtime-Werte konnten trotz TypeScript-Typisierung in den Löschpfad gelangen. Jetzt dürfen **ausschließlich** `approved` und `rejected` nach Fristablauf löschen; alle übrigen Werte liefern `pending_decision`. Regressionstests prüfen unbekannte, leere und fehlende Statuswerte ohne Storage-/Audit-Aufrufe sowie beide zulässigen Entscheidungen. Die Route validiert Status zusätzlich separat; diese Engine-Schranke ist unabhängig davon. Neue Commits brauchen eigene exact-SHA-CI. `productionApproved=false`.

## CI-Fehlerursache: statische Boundary-Assertion an neue Allowlist angepasst

[CI 42071130667](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42071130667) für `7f1a94eb8a8d7422f7ece3b55c41df7286dfea4e` schlug in `check:retention-p0` fehl. Der statische Test `scripts/test-verification-photo-cron-boundary.mjs` erwartete weiterhin die alte Quelltextform `artifact.status === 'pending'`, obwohl die Engine jetzt sicherer auf `approved`/`rejected` allowlistet. Die Assertion wurde auf den neuen expliziten Entscheidungsvertrag umgestellt; die vorhandenen dynamischen Regressionstests prüfen unbekannte Statuswerte ohne Storage-/Audit-Aufruf. Es wurde **keine** Rücknahme des Sicherheits-Fixes vorgenommen. Der neue Head benötigt einen eigenen erfolgreichen CI-Lauf; `productionApproved=false`.

## HMAC-Zeitfenster: ungültige Verifier-Uhr fail-closed

Der vorherige Head `7da736acb94361e35ba40eecccd6abb956d60705` bestand [CI 42076124964](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42076124964). In `validComplianceRequest` wurde ein Grenzfall geschlossen: Bei `now=NaN` war `Math.abs(now - timestamp) > SIGNATURE_MAX_AGE_MS` stets `false`, sodass ein korrekt signierter Request die Altersprüfung trotz ungültiger Verifier-Zeit passieren konnte. Jetzt muss auch `now` eine sichere ganze Zahl sein. Der Vitest-Regressionstest prüft `NaN`, `±Infinity`, Null, negative und gebrochene Zeitwerte mit gültiger HMAC-Signatur. Der Patch ersetzt weder Clock-Synchronisation noch IAM-/Scheduler-Prüfung. Neue Commits benötigen exact-SHA-CI; `productionApproved=false`.


## A-03 Signierte Purge-Aufrufe: Einmal-Nonce und Replay-Sperre (Remediation-Zweig, 05.11.2026)

Der eigenständige, nicht gemergte Remediation-Zweig `fix/p0-202-purge-nonce-replay-20261105` (auf PR #317 aufgebaut) bindet eine zufällige UUIDv4-Nonce kryptografisch an Timestamp und **exakte Raw-Body-Bytes** des HMAC. Die API speichert jede erfolgreich verifizierte Nonce **atomar mit der Lease-Abfrage** als `verification_photo_purge_nonces/{nonce}` (ein zweiter signierter Aufruf derselben Nonce wird als HTTP 401 abgewiesen). Auch bei bereits belegter Lease wird die Nonce verbraucht, damit nach deren Ablauf kein Replay möglich wird. Die Nonce-Dokumente enthalten nur Purpose, UTC-Zeitpunkt und `expiresAt`, nicht den HMAC-Key oder die Payload. Der 15-Minuten-TTL-Marker ist **ohne separat aktivierte und geprüfte Firestore-TTL keine Löschungsgarantie**. Ein verpflichtender Cloud-/DPO-Review muss die `verification_photo_purge_nonces`-TTL je Umgebung bestätigen.

Der bestehende Standard-Deny-Interlock vor sämtlichen Firestore-/GCS-Aufrufen bleibt erhalten. Server und Scheduler müssen gemeinsam migriert und in Staging geprüft werden; alte Scheduler-Signaturen werden absichtlich abgelehnt. Ein zusätzlicher Firestore-Emulatortest prüft doppelte Nonces mit frisch berechnetem zweiten HMAC. Ein erfolgreicher Quellcode-/CI-Test ist **keine** Cloud-Aktivierung.

**Nicht gelöst:** P0 Post-Authorization-TOCTOU und vollständiges All-Writer-Fencing. Keine Cloud-/IAM-/DPO-/AppSec-/SRE-Freigabe, kein Merge, kein Produktionsdeploy; `productionApproved=false`.


## A-03 Folgehärtung: Bytegenaue HMAC-Prüfung und Busy-Replay (05.11.2026)

Bei der Review wurde ein Unterschied zwischen behaupteter **Raw-Byte-Signierung** und der Implementierung gefunden: `Buffer.toString('utf8')` im Verifier ersetzt ungültige UTF-8-Sequenzen und kann verschiedene Wire-Bytefolgen auf denselben HMAC-Eingabetext abbilden. Der Verifier aktualisiert HMAC-SHA256 jetzt erst mit dem ASCII-Präfix `timestamp.nonce.` und anschließend mit dem **unveränderten Request-Buffer**. Ein neuer Unit-Negativtest trennt das ungültige Byte `0xff` von der UTF-8-Repräsentation von U+FFFD und fordert die Ablehnung des falsch signierten Ersatztextes. Der Enterprise-Static-Guard erzwingt die bytegenaue HMAC-Eingabe.

Der neue Firestore-Emulator-Negativtest prüft auch bei aktivem fremdem Scan-Lease: erste gültig signierte Nonce → HTTP 503/busy und persistierte Nonce-Quittung; wiederholter Aufruf derselben Nonce → HTTP 401, ohne GCS-Delete, Intent oder Proof. Der Wiederanlauf muss eine **neue** Nonce verwenden. Der Code ist ausschließlich Review-Kandidat auf PR #318; der aktuelle HEAD benötigt eigene exact-SHA-CI inklusive tatsächlich gelaufener Emulator-Tests.

**Weiterhin offen:** Post-Authorization-TOCTOU/All-Writer-Fencing (P0), Cloud- und Scheduler-Migration, aktives TTL-Policy-Inventar, unabhängige AppSec-/DPO-/SRE-/Release-Owner-Freigabe. Alle produktiven Purges bleiben standardmäßig aus. `productionApproved=false`, **NO-GO**.


## VES-7: Persistierte Fehler statt Cursor-Starvation (Review-Kandidat, 05.11.2026)

Der generische Scanner wurde um die optionale, explizite `recordFailedPage`-Schnittstelle erweitert. Ohne diese Schnittstelle gilt **unverändert** das bisherige Fail-Closed-Verhalten (kein Fortschritt bei einer gescheiterten Seite). Die Verifizierungsfoto-Route verwendet diesen Callback: In einer **einzigen Firestore-Transaktion** werden `photoPurgeFailure`-Marker auf den tatsächlich fehlgeschlagenen `verification_events`-Dokumenten und der nächste Scanner-Cursor gespeichert. Die Marker enthalten nur einen typisierten Fehlercode und `lastAttemptAt`, weder UID, Storage-Pfad, freie Fehlermeldung noch signierte Request-Bytes. Bei erfolgreicher Bearbeitung wird ein alter Marker in derselben Checkpoint-Transaktion entfernt.

Wird die Failure-Journal-Transaktion abgebrochen, die Lease verloren oder eine Inkonsistenz der Fehlerzahlen festgestellt, bewegt sich der persistierte Cursor nicht. Der HTTP-Aufruf meldet bei Fehlern weiterhin `failedCount > 0` und HTTP 503; kein fehlerhafter Datensatz wird als gelöscht bestätigt. Bei der nächsten vollständigen Scanner-Runde werden die weiterhin fälligen Datensätze automatisch **wieder geprüft**. Neue Tests decken die Fortschrittsgarantie über defekte Zeilen hinweg, Journal-Schreibfehler, ungültige Fehlerlisten sowie den echten lokalen Firestore-Emulator (fehlerhafte Entscheidung → Fehlerbeleg → korrigierte Entscheidung → Beleg entfernt) ab.

**Restrisiken:** Ein unendlich langer Backlog, ein inkompatibler fremder Writer oder ein mehrfach fehlschlagender Storage-Zugriff erfordern Monitoring/Alarmierung, manuelle Eskalation und DPO-Review. Ein P0 Post-Authorization-TOCTOU-Fencing wird hiermit **nicht** implementiert. Keine Aussage über Cloud-Runtime oder getesteten CI-Endzustand vor exact-SHA-Readback. Kein Merge, keine produktive Purge-Aktivierung; `productionApproved=false`, **NO-GO**.


## VES-7 Korrektur: Kein falsches PASS nach Teilscan mit älterem Fehler

Beim Review der initialen Journal-Implementierung wurde ein wichtiger Fall erkannt: Ein Scan über gesunde Seiten nach einem früheren Fehler könnte `failedCount=0` und `hasMore=false` melden, obwohl der bisherige fehlerhafte Datensatz noch nicht erneut erreicht wurde. Das System führt daher im bestehenden globalen Scan-Checkpoint `hasUnresolvedFailures` (dauerhafte Rückstau-Sperre) und `cycleHadFailures` (Fehler während des aktuellen vollständigen Durchlaufs). Neue Scan-Zyklen beginnen nur bei `cursor=null`; der Rückstau wird erst nach einem **vollständig fehlerfreien** Scan-Zyklus, gegebenenfalls verteilt auf mehrere Läufe, aufgehoben. Ein partiell gesunder Lauf mit offenen Altfehlern bleibt HTTP 503; die Antwort führt `unresolvedFailureBacklog` als maschinenlesbare Kennzahl. Die Fehlernotizen verbleiben auf den betroffenen Verifizierungsereignissen und werden erst nach erfolgreicher Wiederverarbeitung gelöscht.

Der bestehende Firestore-Emulatorfall prüft jetzt den Rückstauwert bei fehlerhafter und anschließend reparierter Moderationsentscheidung. Ein statischer Security-Guard schützt die Präsenz der dauerhaften Latch-Logik. Diese Ergänzungen sind noch nicht durch einen finalen exact-SHA-Workflow abgenommen und ersetzen keine externe Staging-/SRE-/DPO-Evidenz. `productionApproved=false`, **NO-GO**.


## VES-7/8: Scheduler wertet Abschlussbeleg statt nur HTTP-Status aus (05.11.2026)

Der Cron-Worker akzeptierte bisher **jedes HTTP-200** als erfolgreiche Foto-Löschung, selbst wenn ein Reverse Proxy oder späterer API-Regressionsfehler `ok:false`, `failedCount > 0`, `hasMore:true` oder den neuen persistierten `unresolvedFailureBacklog:true` im Body gemeldet hätte. Das ist ein unzureichender End-to-End-Completion-Vertrag: HTTP-Erfolg allein beweist keine abgeschlossene Retention-Verarbeitung.

Der neue reine Prüfer `functions/src/verificationPurgeJobReceipt.ts` fordert auf HTTP 200 ein wohlgeformtes JSON-Objekt mit `ok:true`, `hasMore:false`, `unresolvedFailureBacklog:false`, `failedCount:0` sowie nichtnegativen sicheren Ganzzahlen für `processed`, `purgedCount`, `skippedCount`, `pages` und der exakten Summe `processed = purgedCount + skippedCount + failedCount`. Andere Antworten führen zu einer **geworfenen Exception** (Firebase-Scheduler-Retry/Fehler, nicht Erfolgsquittung). Der Body ist auf 2.048 Zeichen begrenzt; die Erfolgslogs enthalten nur aggregierte Zähler und den festen Event-Namen, keine UID, Objektpfade oder Secret-Daten.

Neue Vitest-Fälle prüfen gültige und unvollständige Belege, Typ-/Zählerfehler, älteres Response-Schema ohne Rückstau-Latch, `NaN`/`Infinity`, negative/fraktionale Werte. `check:compliance-storage-purge` kontrolliert die Verwendung des strikten Prüfers. **Rollout:** Cron und API-Protokoll müssen gemeinsam in Staging geprüft werden; ältere API-Versionen ohne `unresolvedFailureBacklog` werden bewusst nicht als Erfolg akzeptiert. Dieses Verhalten kann zusätzliche Retrying-/Error-Logs verursachen und erfordert SRE-Alarmierung, Geheimnisrotation und sichere Rücknahmeplanung.

**Evidenz:** Der Vorgänger-HEAD `ebb8bb8ffce599085ec8a6bef12b2bfaec687991` bestand [CI #1756](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42091043027) vollständig. Aus den Logs: 194 Testdateien und 1.446 Vitest-Tests bestanden; `verificationPurgeHttpEmulator.spec.ts` lief mit 19 Tests, zusätzlich 26 Playwright-Tests bestanden. **Die hier neuen Änderungen benötigen erneut exact-SHA-CI.**

**Nicht gelöst:** P0 VES-5 Firestore/GCS Post-Authorization-TOCTOU/All-Writer-Fencing; Cloud-Scheduler/IAM/TTL-Live-Nachweise und DPO/AppSec/SRE/Release-Owner-Freigaben fehlen. Kein Merge, kein Produktiv-Deployment, `KLAR_VERIFICATION_PHOTO_PURGE_ENABLED` default deny, `productionApproved=false`, NO-GO.



## P0 VES-5: Zusätzliche Quellcode-Sperre für alle Live-Löschungen (Review, 05.11.2026)

**Problem:** Die bereits nachgewiesene Firestore/GCS-Post-Authorization-TOCTOU-Lücke bleibt offen. Zuvor genügte bei korrekt signierter Scheduler-Anfrage die Umgebungsvariable `KLAR_VERIFICATION_PHOTO_PURGE_ENABLED=true`, um trotz ausstehender All-Writer-Fencing- und Release-Freigaben den destruktiven Cloud-Pfad zu aktivieren. Die Dokumentationswarnung und der bisherige Default-Deny waren gegenüber einer irrtümlichen Flag-Aktivierung nicht ausreichend.

**Temporäre Sicherung im separaten VES-5-Draft:** `VERIFICATION_PHOTO_PURGE_P0_LIVE_RELEASE_APPROVED=false` ist ein **quellcodegebundener**, nicht per Env überschreibbarer Blocker. Die Route lehnt **vor Firestore- und GCS-Zugriffen** signierte Requests auch mit aktivem Feature-Flag als HTTP 503 `verification_storage_purge_p0_live_blocked` ab. Bis zur unabhängigen Freigabe können ausschließlich lokale, isolierte Tests mit `NODE_ENV=test`, loopbackgebundenen Firestore- **und** Storage-Emulator-Hosts, ohne Cloud-Run-/Functions-Runtime-Signale und ausschließlich `demo-klar`-Projektkennungen den Destruktionspfad erreichen. Neue Unit-Negativtests prüfen Production/Staging, Cloud-Run-Kennungen, nichtlokale oder fehlende Emulatordienste und reale Projektkennungen; ein Firestore-Emulator-HTTP-Test verifiziert, dass die API selbst bei gültigem HMAC und aktivem Feature-Flag keine Firestore-/GCS-Schreibvorgänge ausführt. Der Enterprise-Static-Guard kontrolliert die Code-Sperre.

**Grenze:** Dieser P0-Sicherheitsstopp ist **keine Beseitigung der Race Condition** und keine Berechtigung für Live-Löschungen. Er sperrt ausdrücklich auch echte Staging-Purge-Durchläufe; zur geplanten Wiederaufnahme wird ein separat reviewter Code-Änderungs-PR mit reproduzierbar wirksamem All-Writer-Fencing, Cloud-/GCS-/IAM-/Legal-Hold-Staging-Nachweisen und unabhängiger AppSec-, DPO-, SRE- und Release-Owner-Freigabe benötigt. Der globale DSGVO-Löschrückstau bleibt ein operatives und rechtliches Risiko, das nicht als gelöst markiert werden darf.

**Governance:** `productionApproved=false`; kein autonomer Merge, keine Aktivierung produktiver Foto-Löschung. Neue Implementierung zunächst nur ein Draft-Review-Kandidat, dessen CI auf exaktem SHA nachgewiesen werden muss.


### P0 VES-5 Fail-Closed-Nachtrag: fehlende Projektidentität

Ein lokaler Testmodus mit gesetzten loopback-Emulator-Hosts, aber **ohne irgendeine Projektkennung**, darf die Quellcode-Sperre nicht passieren. `isVerificationPhotoPurgeRuntimeAllowed` fordert jetzt mindestens eine explizite Projektkennung, und alle vorhandenen Kennungen müssen exakt `demo-klar` lauten. Ein Unit-Negativtest prüft diesen Fall. Der zusätzliche Patch verändert keine echte Cloud-Konfiguration, führt kein Deployment aus und benötigt exact-SHA-CI.


### PR #321 CI Typecheck-Korrektur

Enterprise CI #1758 (`42098240510`) auf Commit `e2297c46db7c061621ece2321abf56e777019e68` scheiterte **im Typecheck** (TS2345), weil `Pick<NodeJS.ProcessEnv,...>` alle benannten Umgebungsvariablen als Pflicht-Properties modelliert, die tatsächliche `process.env`-Abbildung aber optionale Einträge erlaubt. Das Interface des P0-Runtime-Guards akzeptiert jetzt `Record<string, string | undefined>`; die Laufzeitbedingungen bleiben unverändert fail-closed. Der zusätzlich eingeführte Schutz verlangt weiterhin **mindestens eine** gültige Projektkennung. Nachfolgende Tests des gescheiterten CI-Laufs wurden nicht ausgeführt; neuer exact-SHA-CI-Nachweis erforderlich. Keine Produktivfreigabe.


### VES-5: Cloud-Runtime-Spoofing trotz Emulator-Variablen verhindern

Beim Review der Quellcode-Sperre fiel eine Abhängigkeitsgrenze auf: `NODE_ENV=test` und Loopback-Emulator-Variablen sind **konfigurierbar** und beweisen allein nicht, dass das Server-SDK tatsächlich ausschließlich Emulator-Dienste verwendet. Der produktive Einstiegspunkt in `server.ts` injiziert ausschließlich `getDb`; `getBucket` bleibt dort ausdrücklich **nicht** gesetzt. Die Compliance-Route erlaubt jetzt den destruktiven Testpfad nur, wenn **zusätzlich** ein expliziter `getBucket`-Mock vom lokalen Testharness injiziert wird. Eine signierte Anfrage mit wirksamem Feature-Flag und vollständig emulierten Umgebungswerten wird auf einem produktionsähnlich erstellten Router weiterhin **vor Firestore-/Storage-Zugriffen** mit HTTP 503 blockiert.

Ein lokaler Firestore-Emulator-HTTP-Negativtest prüft diesen Fall inklusive fehlender Lease, fehlendem Lösch-Intent/-Proof und null Storage-Delete-Aufrufen. Die statische CI-Policy verlangt außerdem die lokale Bucket-Injektion **nur im Test** und die tatsächliche produktive Server-Registrierung ohne injizierten Bucket. Dadurch ist ein bloßes Setzen der Emulator-Env-Variablen keine Live-Freigabe. 

Dies ist ein zusätzlicher P0-Containment-Schutz, **kein Beweis für All-Writer-Atomicity**. Exakter CI-Commit, reale Cloud-IAM-Checks, Backlog-/DSGVO-Planung und unabhängige AppSec-/DPO-/SRE-/Release-Owner-Genehmigung bleiben separat notwendig. Kein Merge und kein Produktivdeploy. `productionApproved=false` / NO-GO.


## VES-8 – HTTP-Antwortgröße vor dem Einlesen begrenzen (05.11.2026, Draft)

Codeprüfung auf PR #322 zeigte in `functions/src/purgeVerificationStorage.ts` ein reales Verfügbarkeitsrisiko: `await response.text()` lud die gesamte Antwort eines Upstream-Dienstes in den Speicher, **bevor** `text.length > 2_048` geprüft wurde. Dieser Wert zählt zudem UTF-16-Zeichen statt Wire-Bytes. Ein fehlerhafter oder kompromittierter HTTP-Antwortdienst könnte damit größere Datenmengen übertragen als benötigt. Die 150-Sekunden-Abbruchfrist begrenzt nur die Laufzeit, nicht den allokierten Speicher.

Der neue `readBoundedVerificationPurgeReceipt`-Prüfer liest den Response-Body schrittweise, akzeptiert insgesamt höchstens **2.048 Bytes**, bricht bei Überlauf den Reader ab und lehnt fehlendes oder falsches JSON-Content-Type, nicht valide UTF-8, fehlerhafte Content-Length und inkonsistente Abschlussbelege fail-closed ab. Erfolgreiche Quittungen benötigen weiterhin `ok:true`, `failedCount=0`, `hasMore=false`, `unresolvedFailureBacklog=false` sowie konsistente Zähler. Der Scheduler wertet keine empfangene Roh-Antwort als Log oder Abschlussnachweis. Neue Vitest-Negativtests decken Streaming-Abbruch, 2.048-Byte-Grenze, überhöhte Content-Length, ungültige Antworttypen und Bytes ab; der statische Enterprise-Guard verweigert `response.text()` im Scheduler.

**Freigabestatus:** Ausschließlich Review-Code auf separatem Branch; eigene exact-SHA-CI und unabhängige SRE-/AppSec-Reviews erforderlich. Der P0 Firestore/GCS-TOCTOU-Befund bleibt offen, die Cloud-Runtime-Live-Sperre bleibt aktiv, kein Deployment oder Merge, `productionApproved=false`.


## VES-8 – HTTP-Stream-Freigabe bei früher Ablehnung (05.11.2026, Draft)

Review von PR #323 zeigte eine verbleibende Robustheitslücke: Vor der Stream-Verarbeitung wurden Content-Type und deklarierte Content-Length zwar frühzeitig validiert, jedoch bei Ablehnung die Upstream-Antwort nicht explizit abgebrochen. Das ließ eine unnötige Netzwerk-/Socket-Ressourcenbelegung bis zum Fetch-Abbruch offen. Der Folgepatch cancelt diese Response-Bodies **vor** dem Fehler-Throw und bricht auch beim Streaming-Fehler oder Oversize den Reader ab. Auf unzuverlässige asynchrone Cancel-Abschlüsse wird nicht gewartet, um einen Scheduler-Hänger bei defektem Upstream zu vermeiden; Promise-Rejections werden ohne Rohpayload-Logging konsumiert. Die Prüfung selbst bleibt strikt fail-closed.

Neue Negativtests prüfen, dass falscher Content-Type oder überhöhte Content-Length schon **vor** dem ersten Stream-Lesezugriff zur Cancellation führen. Der Enterprise-Static-Guard verlangt die frühzeitige Freigabe zusätzlich zum 2-KiB-Limit. All-Writer-Fencing, produktive GCS-/Firestore-Policies, Retention-Backlog und unabhängige Freigaben bleiben unverändert offen. Alle Änderungen nur auf separatem Draft-Zweig, keine Produktivaktivierung; `productionApproved=false`.


## VES-7/VES-8 – Datensparsame Fehlertelemetrie für Purge-Rückstau (05.11.2026, Review)

Der bisherige Scheduler meldete einen HTTP-503-Fehler, aber ohne ausreichend differenzierte, feste Betriebsereignisse für SRE-Alerting; die Purge-Route gab Zähler an die Antwort zurück, ohne einen stabilen aggregierten Cloud-Logging-Eintrag zu erzeugen. Die separate Entwicklung führt daher drei strukturierte API-Ereignisse mit festem Schema ein: `verification_photo_purge_incomplete` (nur verarbeitete Anzahl, Fehleranzahl, Seitenanzahl und boolesche Rückstauflags), `verification_photo_purge_unavailable` (keine Roh-Exception) und `verification_photo_purge_p0_live_blocked` (keine Nutzerdaten). Der Cron erzeugt bei Transport-/HTTP-/Receipt-Fehler `verification_photo_purge_scheduler_failed` mit fester Stage und optionaler **numerischer** HTTP-Statuszahl, bevor er weiter fail-closed scheitert. Externe Antworttexte, Benutzer-IDs, Speicherpfade, Nonces, Secrets und Request-Bodies dürfen **niemals** in diesen Betriebsbelegen stehen.

Neue Unit-Regressionen erzwingen die Allowlist gegen versehentlich mitgegebene vertrauliche Eigenschaften; ein statischer CI-Guard kontrolliert beide Aufrufpfade. Die API meldet bei fehlerhaften/unkompletten Scans unverändert HTTP 503. Der bestehende P0-Code-Lock bleibt bestehen und ist **keine Lösung** für die Firestore/GCS-TOCTOU-Lücke.

**Betriebliche Abnahme offen:** SRE muss in der Zielumgebung Cloud-Logging-Filter auf diese Event-Namen validieren, Alarmregeln/Paging samt Kostenobergrenzen konfigurieren, 30-Tage-Retention-Rückstau und fehlende Job-Ausführungen gesondert prüfen sowie Testalarme und Incident-Runbook nachweisen. Der Logger allein ist **kein** aktiver Alarm und kein produktiver Cloud-Nachweis. AppSec-/DPO-/SRE-/Release-Owner-Abnahmen und `productionApproved=false` bleiben erforderlich. Kein autonomer Merge oder Cloud-Deployment.


## VES-7 – Fehlerjournal gegen seitenfremde Datensatz-IDs abgesichert (06.11.2026, Draft)

Die generische `scanPurgePages`-Routine validierte bislang Zahl, Fehlergründe und Eindeutigkeit der Fehlerbelege, nicht aber deren **Identität relativ zur gelesenen Seite**. Der konkrete API-Router prüfte die Mitgliedschaft später in `recordFailedPage`, aber ein anderer Adapter oder eine spätere Refaktorierung hätte einen syntaktisch gültigen Fremdbeleg zusammen mit dem Fortschrittscursor journalisieren können. Das würde die Nachvollziehbarkeit einer offenen Löschpflicht schwächen.

Die Scanner-Grenze verlangt bei fehlgeschlagenen Seiten mit aktivierter `recordFailedPage`-Funktion daher jetzt ausdrücklich `identifyItem`. Vor der Freigabe des atomaren Journal-/Cursor-Callbacks müssen sämtliche Seiten-IDs gültig, eindeutig und jede failure.id Mitglied dieser gelesenen Seite sein. Fehlende Bindung, doppelte oder fremde IDs lösen **vor jedem Journal-/Checkpoint-Write** einen fail-closed Fehler aus. Der produktionsnahe Router bindet `identifyItem: doc => doc.id`. Bei sauberem Scan bleibt der bestehende Read-only-/Checkpoint-Vertrag unverändert.

Tests prüfen gültige Poison-Pill-Seiten mit Folgefortschritt sowie gefälschte/doppelte IDs und fehlenden Adapter, ohne reale Dateien zu löschen. Der statische Enterprise-Guard verlangt die Source-Bindung. Dies ist eine P1-Audit-Härtung und **keine** Lösung der P0-Firestore/GCS-Post-Authorization-Race. Weiterhin keine Aktivierung der produktiven Löschroute, kein Merge/Deploy, `productionApproved=false`, NO-GO. Exakte SHA-CI und unabhängige Reviews sind vor Abnahme erforderlich.
