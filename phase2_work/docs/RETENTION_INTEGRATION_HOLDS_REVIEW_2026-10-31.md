# P0 #202 — konsolidierter Retention-Integrationskandidat: Hold-Guards
**Stand:** 31.10.2026 · **Status:** DRAFT / BLOCKED / NO-GO

## Herkunft und Invarianten
Dieser Branch `integration/202-retention-holds-review-20261031` wurde **direkt** von `fix/202-photo-retention-status-error-boundary-20261030` (PR [#229](https://github.com/Veselin-Takev/Klar-Dating/pull/229), auf [#203](https://github.com/Veselin-Takev/Klar-Dating/pull/203) gestapelt) erstellt. Der bestehende Scanner aus #203 wird **nicht ersetzt**: `scanPurgePages`, 25×4-Seitenbudget, Firestore-Lease/Checkpoint, generationgebundener `photoPurgeIntent`, 404-Reconciliation mit Absenzkontrolle, finale Firestore-Revalidierung und 503 bei unvollständiger Bearbeitung bleiben im Integrationskandidaten erhalten. Der in #229 fixierte explizite Final-Status-Check und die Redigierung von Providerfehlern bleiben erhalten.

**Konkrete selektive Ergänzung aus Review von #231:**
1. In `src/server/routes/complianceStorage.ts` prüft `inspectVerificationStorageGeneration` nun neben `temporaryHold` und `eventBasedHold` auch `retentionExpirationTime` und `retention.retainUntilTime`. Zukünftige oder unparsebare Zeitangaben verweigern die Löschung. Der vorhandene `ifGenerationMatch`-DELETE bleibt erhalten. Es gibt weiterhin **keine** Möglichkeit, einen Cloud-Storage-Hold zu umgehen oder zu entfernen.
2. `assertStillEligibleForPurge` verweigert die Löschung zusätzlich bei allen vorhandenen `legalHold`-/`retentionHold`-Werten außer dem ausdrücklich booleschen `false` (fehlende Felder bleiben aus Kompatibilitätsgründen zulässig) im aktuellen `verification_events`-Datensatz. Diese Funktion wird in der Scanner-Implementierung vor Intent/DELETE sowie beim Auditschreiben erneut ausgeführt.
3. `tests/complianceStoragePurge.spec.ts` ergänzt Positiv-/Negativtests: gesetzter Legal-/Retention-Hold, geänderter Entscheidungszeitpunkt, Status/UID/Pfad, künftiger Retention-Ablauf, fehlerhafte Metadata und dezimale GCS-Generation außerhalb der JS-safe-integer-Grenze.
4. `scripts/check-compliance-storage-purge.mjs` erzwingt als Bestandteil der bestehenden Enterprise-Checkkette, dass die Source-Guardrails und der wiederaufnehmbare Scanner im Quellstand weiterhin vorhanden sind.

## 31.10.2026 — exakter CI-Nachweis und zusätzliche Typ-Härtung
- **Vollständiger CI-PASS** für den vorangegangenen Head `3bd48be6e86af0c69802261feb95f7b3bf78e88a` mit [Workflow #41177957634](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41177957634) einschließlich Enterprise-Static, TypeScript, Functions-Build, Tests, App-Build und Browser-Acceptance. Dieser Nachweis **gilt nicht** automatisch für die anschließenden Commits.
- Die Storage-Metadatenprüfung verweigert jetzt auch unerwartete Hold-Wertetypen (beispielsweise den String `"false"`), fehlende/mehrdeutige `retention.retainUntilTime`-Werte bei vorhandenem Retention-Objekt und unbrauchbare Retention-Zeitstempel. Die fachliche Entscheidungsgate verweigert explizites `legalHold:null`, `retentionHold:0` und `legalHold:"false"`. Ein **fehlendes** Feld ist wegen historischer Datensätze vorerst zulässig; tatsächliche Legal Holds außerhalb dieses Dokuments werden dadurch **nicht** beweisbar erfasst.
- Die negativen Vitest-Fälle und das obligatorische `check:compliance-storage-purge`-Quellgate wurden aktualisiert. **Nachweis der vollständigen CI auf neuem Head noch ausstehend.**
- Google Cloud dokumentiert `ifGenerationMatch` für bedingtes Löschen und die Storage-Metadaten `temporaryHold`, `eventBasedHold`, `retentionExpirationTime` und `retention.retainUntilTime`: https://docs.cloud.google.com/storage/docs/deleting-objects und https://docs.cloud.google.com/storage/docs/using-object-lock. Synthetische Testdaten ersetzen keinen echten Staging-SDK-Test.

## 31.10.2026 — CI-Failure Root Cause und Regressionstest-Korrektur

- Der automatische CI-Lauf [#41178564324](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41178564324) am vorherigen Head `89de08ad404b88d661410fc68d0a4556bea0c85e` endete mit **FAIL** bei `check:retention-p0` / `scripts/test-verification-photo-cron-boundary.mjs`. Die genaue Fehlermeldung laut GitHub-Joblog: `Purge route must respect temporary object holds`. Ursache: ein statischer Test verlangte den älteren String `temporaryHold === true`, der durch die strengere Helper-Prüfung `isActiveOrMalformedHold(metadata.temporaryHold)` ersetzt wurde; die tatsächliche Sicherheitsbedingung wurde **verschärft**, nicht entfernt.
- Der Test prüft jetzt die neue, fail-closed Semantik direkt, einschließlich der booleschen `false`-Ausnahme und der Firestore-`legalHold`-/`retentionHold`-Bedingungen. Eine zusätzliche Mutationsprüfung erkennt die Regression zurück zu `value === true`.
- **Aktueller Head nach dieser Änderung benötigt einen neuen eigenständigen vollständigen PASS.** Die bis dahin vorhandenen erfolgreichen Checks des alten Heads dürfen weder die fehlgeschlagene CI überspielen noch als Nachweis des neuen Code-Standes gelten.
- Dies ist ein **statischer Test-Contract-Fix**, kein realer Cloud-Test und keine Erlaubnis zur Löschung. In `main` und Produktion wurde nichts verändert.

## 31.10.2026 — zweiter CI-Regressionstestfehler, exakt diagnostiziert

- [CI #41178668396](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41178668396) am Head `4464fb5ce8de25a4c615bc23035c797164f35631` **FAIL** im Pflichtgate `check:retention-p0`. GitHub-Joblog: `Purge route must reject active or malformed temporary object holds`. Die TypeScript-/Build-/Emulator-Schritte wurden dadurch **übersprungen**, nicht bestanden.
- Ursache war **doppelte Backslash-Escapierung in den neuen JavaScript-RegExp-Literalen** von `scripts/test-verification-photo-cron-boundary.mjs`, nicht ein fehlender Codepfad. Der korrigierte Test nutzt reguläre `\\(`, `\\.`, `\\)`-Regex-Escapes im Quelltext. Vor dem Commit wurden **sechs** relevante Regex-Ausdrücke programmatisch direkt gegen den über GitHub gelesenen Route-Quellstand validiert; alle trafen zu. Dies ist eine lokale Quelltext-Vorprüfung, **kein** ausgeführter Node-/CI-Test.
- Aktualisiert in Commit `19307901220c63bada9b2d7bd24868ffefc323c7`. **Ein vollständiger neuer exakter CI-PASS nach der Dokumentationsänderung steht aus.** Frühere CI-Läufe `41177957634` PASS und `41178564324` FAIL sowie `41178668396` FAIL sind getrennt zu behandeln.
- Kein Code-Rollback der strengeren Hold-Prüfung, kein produktiver Scheduler-Eingriff. **NO-GO**.

## Evidenzstatus
**Quelle:** GitHub-Blob-Vergleich von PR #203/#229/#231 und isolierter Feature-Branch; keine Live- oder Kundendaten. Vor Änderungen hatte die #229-Route den Blob `a25c8c5bd6aa4cd8eb7bbb36a3f508ce0fb5ea68`. Die Änderung ist auf diese eng begrenzte API-/Test-/Gate-Ergänzung beschränkt.

- **Quellcode:** aktualisiert; Compiler- und Testsuite-Nachweis **erst nach erfolgreichem, exaktem CI-Lauf** möglich. Eine automatische GitHub-PR-CI kann nach Anlage des Draft-PR laufen; kein manueller Actions-Dispatch.
- **Testtiefe:** die neuen Fälle sind synthetische Vitest-/Quellcode-Negativtests, **kein** GCS-Staging- oder live Storage-Hold-Test.
- **Kompatibilität:** #231 darf **nicht** als Ganzes hineingemergt werden; dessen verkürzte `complianceStorage.ts` würde den langlebigen Scanner/Intent/Checkpoint ersetzen. Ein selektives Quellreview ist bereits durchgeführt, jedoch **noch kein unabhängiges Review**.

## Noch offene P0-Freigabeblockaden
- **Originale Generation fehlt:** Historischer manueller `verification_events`-Writer in `klarCore.ts` persistiert keine beim Upload gesicherte GCS-Generation. Ein erst unmittelbar vor Löschung ermitteltes und im Intent verzeichnetes Generation-Token belegt nicht die ursprüngliche Objektidentität. Keine automatische Backfill-/Altobjekt-Löschung ohne DPO-geprüften Migrationsplan.
- **Cross-Service-Race:** Globaler Scanner-Lease schützt den Scanner-Cursor, sperrt aber weder sämtliche Firestore-Entscheidungs-Writer noch neue GCS-Uploads auf demselben Pfad. Fehlt eine koordinierte per-Candidate Claim-/Writer-Fencing-Strategie. Letzte Read-vor-Delete-Kontrolle ist eine Mitigation, keine atomare Garantie.
- **Retention-Sonderfälle:** tatsächliches GCS-Retention-Lock-/Hold-Verhalten mit verwendetem SDK und Bucket in Staging verifizieren; 404/412, Crash nach DELETE vor Audit, Idempotenz und fehlende Generation separat prüfen.
- **Produktionszustand:** deployed Cloud Functions/Scheduler, aktive TTL/Storage-Rules, IAM, Alert-Pager, echte Art.-17-/KYC-Regeln und alte Objekte noch **nicht** inventarisiert.
- **Freigaben:** unabhängige Security, DPO/Legal, SRE und Release Owner-Signoffs, exakte CI-SHA, Rückfall-/Canary-Plan und unveränderliche Evidenz ausstehend.

**Weder `main` noch eine produktive Cloud-Ressource wurde verändert.** Kein Merge, kein Deploy, keine Löschung, kein stillschweigendes GO.
