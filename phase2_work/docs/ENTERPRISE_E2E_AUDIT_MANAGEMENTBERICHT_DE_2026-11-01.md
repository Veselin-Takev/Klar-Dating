# Klar — Enterprise-End-to-End-Audit: Managementbericht

**Stand:** 01.11.2026 · **Repository:** Veselin-Takev/Klar-Dating · **Referenz-SHA `main`:** [`2808dc1cbb485f70b403681c108cea5a3361d950`](https://github.com/Veselin-Takev/Klar-Dating/commit/2808dc1cbb485f70b403681c108cea5a3361d950)  
**Entscheidung:** **BLOCKED / PRODUCTION NO-GO**  
**Vollständiges technisches Befundregister, E2E-Testmatrix und Nachweisstruktur:** [ENTERPRISE_END_TO_END_AUDIT_2026-11-01.md](ENTERPRISE_END_TO_END_AUDIT_2026-11-01.md)

## Prüfauftrag und Aussagegrenze

Geprüft wurden der tatsächliche `main`-Stand, GitHub-Issues und Draft-PRs, konkrete Firebase-, Node-/Functions-, Security-Rules-, Datenschutz- und Löschpfade, CI-Workflow, Supply-Chain-Nachweise, Go-Live-Manifest, Runbook und Governance. Externe Maßstäbe: OWASP ASVS 5.0, NIST SP 800-218 (final 1.1), Firebase Admin-/Client-Autorisierung, GCS-Generation-Preconditions und DSGVO.

**Dies ist ein umfassender risikobasierter Quellcode-, Architektur-, CI- und Freigabeaudit, jedoch kein abgeschlossenes Ausführen sämtlicher produktiver End-to-End-Tests.** Nicht eingesehen bzw. nicht authentisch geprüft wurden reale produktive Cloud-Run-/Firebase-/GCS-Konfigurationen, private Kundendaten, Cloud-IAM-Rollen, unabhängige Vertrags-/DPO-Unterschriften, tatsächlich ausgelöste Monitoring-Alarme, Restore- und Canary-Übungen oder Stripe-/Didit-Liveprozesse. Deshalb bleiben diese Nachweise **OFFEN**, nicht `PASS`.

Die GitHub-Abfrage lieferte **20 offene Issues** und **mindestens 100 offene PRs** (Abfrage auf 100 begrenzt). Getrennte Draft-Ergebnisse dürfen niemals wie ein gemeinsamer freigegebener Integrationsstand behandelt werden.

## Executive Risk Register

| Kennung | Priorität | Festgestellter Sachverhalt | Erforderliche Mindestmaßnahme |
|---|---|---|---|
| **E2E-01** | P0 | Tenant-Middleware aus [#253](https://github.com/Veselin-Takev/Klar-Dating/pull/253) nicht global aktiv; Legacy-Daten flach, Admin SDK umgeht Client-Regeln; [Issue #254](https://github.com/Veselin-Takev/Klar-Dating/issues/254) offen | Eindeutige Tenant-Zuordnung, Datensatzinventur, getrennte Admin-/Client-/Storage-Rechte, Cross-Tenant-IDOR-Negativtests, rechtssichere Löschkaskaden |
| **E2E-02** | P0 | Alter `deleteExpiredPhotosCron` löscht im `main`-Quellcode nach Upload-Alter; [#269](https://github.com/Veselin-Takev/Klar-Dating/pull/269) deaktiviert Pfad **nur in einem ungemergten Draft** | Deployed Scheduler und Revisionen durch SRE lesen; Löschung bei offener Verifizierung verbieten, Migrations-/Rollback-Freigabe |
| **E2E-03** | P0 | Moderationsbasierter Foto-Purge verwendet sichtbaren GCS-Delete ohne `ifGenerationMatch` und getrenntes Firestore-Audit | Generationsbindung, erneute Entscheidungs-/Hold-Prüfung, 404/412-/Race-/Wiederholungstests |
| **E2E-04** | P0 | 20 TTL-Gruppen dokumentiert, echter `ACTIVE`-Status in Zielumgebungen/Legal Holds unbewiesen; [#70](https://github.com/Veselin-Takev/Klar-Dating/issues/70) | Nur lesende Staging- und genehmigte Produktionsnachweise, DPO-/Legal-Freigabe |
| **E2E-05** | P0 | Partner-/Referral-Zurechnung, Buyer-Authentizität und Consent-/DSGVO-Fragen nicht freigegeben; [#48](https://github.com/Veselin-Takev/Klar-Dating/issues/48), [#55](https://github.com/Veselin-Takev/Klar-Dating/issues/55), [#56](https://github.com/Veselin-Takev/Klar-Dating/issues/56) | Manipulations-/Replay-/Doppelbuchungs-/Refund-Tests, Provider- und Vertragsbelege, Widerruf, Art. 17 |
| **E2E-06** | P0 (Release) | Kein gültiger vollständiger Release-Nachweis; Schutzregel/Code-Owner-Freigaben unzureichend nachgewiesen, [#73](https://github.com/Veselin-Takev/Klar-Dating/issues/73), [#8](https://github.com/Veselin-Takev/Klar-Dating/issues/8) | Live-Regelabgleich, unabhängige Approvals, Negativ-Merge-Tests, signierter Produktionsentscheid |
| **E2E-07** | P0 (Release) | Abhängigkeitsprüfung (OSV) historisch mit verbleibenden Advisories; kein sauberer finaler SCA-Nachweis auf aktuellem `main`/Release-Kandidaten | Neuer OSV- und Secret-/SAST-Scan, vollständige Lock-/SBOM-/Image-Provenienz ohne Blanket-Waiver |
| **E2E-08** | P1 | Main Storage Rules erlauben Profilbildlesezugriff für jedes angemeldete Konto; [#204](https://github.com/Veselin-Takev/Klar-Dating/issues/204) | Erwachsenen-/Status-/Blockierungsprüfung mit nativen Emulator- und Staging-Negativtests |
| **E2E-09** | P1 | Langfristig nutzbare Firebase `getDownloadURL()`-Profiltokens umgehen nachträgliche Viewer-Sperre; [#206](https://github.com/Veselin-Takev/Klar-Dating/issues/206) | Revokabler autorisierter Bildabruf, Tokenmigration, Log-/Cache-/Referrer-Schutz |
| **E2E-10** | P1 | Verifizierungsrefresh über ausgedienten HTTP-410-Pfad berichtet; [#237](https://github.com/Veselin-Takev/Klar-Dating/issues/237) | Didit-Status als autoritative Quelle in echten E2E-Tests |
| **E2E-11** | P1 | Auf `main` verweist `validUserMutableUpdate()` auf `userId` ohne eigenen Parameter; Draft [#267](https://github.com/Veselin-Takev/Klar-Dating/pull/267) korrigiert dies | Regeln beider Deploy-Roots unabhängig testen, SHA-gebundene Emulator-Gates |
| **E2E-12** | P1 | Monitoring-P95, Alarmzustellung, On-Call, Restore, Canary und Rollback nicht real abgenommen | SRE-Nachweis mit exaktem Build/Revision-SHA, tatsächlich bestätigtem Alarm und Recovery Drill |
| **E2E-13** | P1 | §312k-BGB, Referral-Rewards, Zahlungsfehler, Marketingversprechen, Performance und Pilotwirtschaftlichkeit benötigen fachliche Abnahme | E2E-Zahlungs-/Kündigungs-/Refund-Prozesse, Product-/Legal-/Finance-Review |

P0/P1 beziehen sich auf Release- und Architekturprioritäten; weder eine tatsächliche Datenpanne noch einen laufenden Angriff haben wir behauptet.

## Exakt geprüfte GitHub-CI

| Prüfobjekt | Nachweis | Ergebnis |
|---|---|---|
| Draft [#267](https://github.com/Veselin-Takev/Klar-Dating/pull/267), SHA `32598e8` | [CI #41246347258](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41246347258) | **SUCCESS** einschließlich zuvor verifizierten Firestore-Emulators, nur dieser Branch |
| Draft [#268](https://github.com/Veselin-Takev/Klar-Dating/pull/268), SHA `71c0d31` | [CI #41282765859](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41282765859) | **SUCCESS** für Inventur und Audit-Regressionschecks, keine Tenant-Migration |
| Draft [#269](https://github.com/Veselin-Takev/Klar-Dating/pull/269), SHA `54ef22b` | [CI #41283792515](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41283792515) | **SUCCESS** mit Static Gates, Typecheck, Functions Build, Tests, Build, Smoke, Browser-Acceptance; **nicht deployed** |
| `main`, SHA `2808dc1` | aktueller GitHub-Commit | Keine in diesem Audit unabhängig vollständige kombinierte GO-Evidenz für den finalen SHA / Release |

**Konfliktsperre:** PR #268 und #269 ergänzen jeweils die `check:enterprise`-Zeichenkette. Bei einem später genehmigten Integrationsschritt müssen `check:tenant-inventory` **und** `check:legacy-photo-purge` in der finalen Konfiguration existieren und erneut erfolgreich laufen. Stacked PRs #253–#267 mit ihren Abhängigkeiten nicht blind in `main` zusammenführen.

## Zehn verpflichtende E2E-Testbereiche

1. Registrierung, Alters-/Consent-Guard, Offline-Onboarding, Gerätewechsel, Token-Revoke und Logout.
2. Tenant A/B, gleiche und fremde UIDs, Rollenwechsel, Listen/Listener/Subcollections, Admin-SDK-Bypass.
3. Profil- und Storage-Autorisierung einschließlich Bilder, Sperren, geteilter Download-Tokens und Holds.
4. Entdecken, Chat, Moderation, Übersetzung, Datenschutz, Offline-Retry und Replay.
5. KI-Auswertung, granulare Einwilligung, PII-Sanitizing, Provider-Ausfall und Budget.
6. Didit-KYC Erfolg/Abbruch/Replay, Entscheidung und Foto-Löschraces.
7. Stripe/Klar+, Zahlungsfehler, §312k-Kündigung, Bestätigung, Refund.
8. Partner/Webhooks, Buyer-Bindung, Consent-Widerruf, Fraud-/Doppelbuchungs-/Reward-Races.
9. Art. 15/17 Export, Quarantäne, Nested Cascade, Legal Holds, TTL und Reconciliation.
10. Immutable Build/SBOM, SCA/SAST, on-call Alarmzustellung, Backup-Restore, Canary und Rollback.

Je Test sind ein erlaubter Positivfall und gezielte verweigerte Negativfälle mit **Null Datenoffenlegung** erforderlich; Nachweise müssen Quell-SHA, Zielumgebung, Exit-Code, Logs/Hash und unabhängige Prüferkennung tragen.

## Nächste umsetzbare Arbeitseinheiten

**Unmittelbar (P0):** Ein befugtes SRE-Team muss den tatsächlichen produktiven `deleteExpiredPhotosCron` lesen und einen genehmigten Staging-Retirement-/Deploy-Plan erstellen. Parallel müssen #254 Tenant-Mapping und Admin-/Client-/Storage-Isolation sowie #202 Generation/Entscheidungs-Rechecks in getrennten reviewbaren PRs abgeschlossen werden. Anschließend #55/#48/#56/#70 und Supply Chain. 

**Vor Release:** Schutz von `main` mit wirksamen unabhängigen GitHub-Approvals, vollständiger CI auf dem *zusammengeführten* SHA, echte Staging-Evidenz sowie DPO/Legal/AppSec/SRE/Finance- und Release-Owner-Signaturen. Das Produktionsmanifest bleibt bis dahin `NO-GO` und `productionApproved=false`.

**Audit-Verantwortung:** Dieser Bericht ist eine Evidenzaufnahme und ein Maßnahmenplan, **keine Freigabebestätigung**. Keine produktive Cloud-/Firebase-/Storage-Mutation und kein Merge wurde im Audit vorgenommen.

## Fortschreibung 01.11.2026 — Scheduler-Erfolg und Pagination (#202)

Der zugrunde liegende [PR #271](https://github.com/Veselin-Takev/Klar-Dating/pull/271) wurde auf dem SHA `504fd783` vollständig per [Actions #41285159760](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41285159760) validiert. Ein danach identifizierter Fehler betraf die Erfolgsbestätigung: `complianceStorage.ts` antwortete selbst bei einzelnen GCS-/Auditfehlern mit HTTP 200. Der zeitgesteuerte Aufruf sah dadurch irrtümlich einen Erfolg. Die neue isolierte Änderung meldet **503 bei fehlerhaften Einzelobjekten oder unvollständigen Daten**, gibt nur aggregierte Zähler ohne persönliche Pfade/Fehler aus und führt echte signierte HTTP-Testfälle gegen synthetische Abhängigkeiten aus. Die neue CI auf SHA `cd519330` bleibt bis zum tatsächlich bestätigten vollständigen Lauf **unverifiziert**.

**Weitere P0-Vollständigkeitslücke:** Die Firestore-Abfrage beschränkt sich auf die ersten 100 fälligen Datensätze. Ohne dauerhaftes Cursor-/Pagination-Konzept können bereits bearbeitete und weiterhin fällige Datensätze nachfolgende Fotos verdrängen. Das ist **nicht** durch die HTTP-503-Korrektur gelöst. Erforderlich sind ein unabhängiger, DPO-/SRE-genehmigter Entwurf zur belastbaren Wiederaufnahme, Tests mit mehr als 100 Alt-/Neu-/Hold-/Fehlerfällen und ein Staging-Nachweis mit tatsächlicher GCS-Semantik. **Produktionsfreigabe unverändert BLOCKED/NO-GO.**

## Nachtrag 01.11.2026 — CI-Korrektur und neue begrenzte Seitenverarbeitung

[PR #271](https://github.com/Veselin-Takev/Klar-Dating/pull/271) meldete zunächst in [CI #41285780965](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41285780965) **FAIL** (ein Test erwartete für die absichtlich verweigerte HTTP-401-Antwort JSON statt Klartext; 1.406 andere Tests bestanden). Die Testauswertung wurde ohne Herabsetzen einer Sicherheitskontrolle unter SHA `d7acb084` korrigiert. Vollständige Exact-SHA-CI erst nach Abschluss von #41286317717 anerkennen.

Ein zusätzlicher **Draft-PR [#272](https://github.com/Veselin-Takev/Klar-Dating/pull/272)** führt eine geordnete, zunächst vollständig lesende Firestore-Cursor-Prüfung über höchstens 300 fällige Einträge ein. Damit erreichen auch berechtigte Fotos hinter 100 bereits erledigten Datensätzen den Löschpfad. Bei über 300 Einträgen gilt explizit **HTTP 503 und keine Löschung**; diese Grenze ist nur ein sicherer Übergangszustand und kein produktionsfähiger Retention-Nachweis. Pflicht vor GO: dauerhafte skalierbare Job-Warteschlange/Checkpoint, Backfill fehlender Felder, Last-/Recovery-/Hold-Tests, unabhängige AppSec/DPO/SRE-Abnahme und bestätigter Cloud-Scheduler-Istzustand. CI für neuen PR-#272-Head `fc1f0c1f` noch nicht abschließend bestätigt. **NO-GO**.

## Fortschreibung 01.11.2026 — Keine Teillöschung bei beschädigten Retention-Daten

Bei der Quellprüfung von [Draft #272](https://github.com/Veselin-Takev/Klar-Dating/pull/272) wurde eine zusätzliche P0-Sicherheitslücke festgestellt: Eine fehlerhafte fällige Firestore-Zeile konnte erst **nach** der physischen Löschung anderer, gültiger Verifizierungsfotos erkannt werden. Außerdem konnten mehrere Verifizierungsereignisse denselben GCS-Dateipfad beanspruchen. Die isolierte Korrektur prüft deshalb die gesamte begrenzt erfasste Datensatzgruppe vor dem ersten Storage-Zugriff auf ungültige Zeilen, widersprüchliche/pending Entscheidungen, bekannte Holds und doppelte Pfade. Bei Problemen ist das Ergebnis HTTP 503 und **null Löschungen**. Ergänzende signierte HTTP-Negativtests prüfen insbesondere eine beschädigte zweite Zeile nach einem gültigen ersten Datensatz.

Exakte ältere Branch-CI-Nachweise: #271 `d7acb084` [Run 41286317717](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41286317717) SUCCESS; #272 `fc1f0c1f` [Run 41286528523](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41286528523) SUCCESS. **Neuer #272 Head `b7c3d889` noch nicht vollständig CI-validiert**, [Run 41287253676](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41287253676). Kollektionsweite Pfad-Eindeutigkeit auch über nicht fällige oder unvollständige Ereignisse, Warteschlange für mehr als 300 fällige Datensätze, atomare GCS/Firestore-Abstimmung, Staging-/Scheduler-/Legal-Nachweise bleiben offen. **Produktionsfreigabe weiterhin NO-GO.**

## Fortschreibung 01.11.2026 — Vollständige Vorabprüfung vor GCS-Löschungen

Nach erfolgreicher CI für die frühere Pagination (`fc1f0c1f`, Run #41286528523) zeigte der Quellcode einen zusätzlichen P0-Fehler: Ungültige fällige Datensätze wurden erst als Fehler erkannt, **nachdem** andere Fotos bereits gelöscht werden konnten. Gleichzeitige Datensätze mit identischem Storage-Pfad waren ebenfalls nicht ausgeschlossen. In [Draft #272](https://github.com/Veselin-Takev/Klar-Dating/pull/272) wurden deshalb Prüfungen der gesamten begrenzten fälligen Gruppe **vor dem ersten Storage-Zugriff** ergänzt. Ungültige/ausstehende/widersprüchliche Datensätze und doppelte Dateipfade führen zu HTTP 503 ohne eine einzige physische Löschung. Negative HTTP-Tests sind enthalten.

Das erste CI des geänderten Codes (`b7c3d889`, [#41287253676](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41287253676)) scheiterte am Typecheck, weil der direkte Arrayindex trotz Umfangsprüfung laut `noUncheckedIndexedAccess` undefiniert sein kann. Der Code verwendet jetzt typisierte Iteration und einen ausdrücklichen Fehlpfad für fehlende Snapshots. Für den neuen #272-Commit `61c78d33` läuft [CI #41287450907](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41287450907); **kein vollständiger PASS behauptet**. Die fachlichen Restblocker bleiben die Verarbeitung über 300 Fälligkeiten, globale Pfad-Eindeutigkeit, konkurrierende Firestore-/GCS-Entscheidungen, Wiederanlauf/Nachweis und die echten Staging-/Betriebsfreigaben. **Produktionsfreigabe NO-GO.**

## Fortschreibung 01.11.2026 — Lesende Retention-Rückstandsaufnahme

Der letzte Sicherheits-PR [#272](https://github.com/Veselin-Takev/Klar-Dating/pull/272) hat auf dem exakten Commit `61c78d33` [CI #41287450907](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41287450907) erfolgreich abgeschlossen; er ist jedoch **nicht gemergt oder produktiv ausgerollt**.

Der neue gestapelte [Draft #273](https://github.com/Veselin-Takev/Klar-Dating/pull/273) liefert als Voraussetzung für eine skalierbare Lösung eine **ausschließlich lesende Rückstandsaufnahme**. Sie zählt auch Datensätze mit fehlender Löschfrist, offenen oder widersprüchlichen Entscheidungen, bekannten Aufbewahrungssperren und mehrfach zugeordneten Fotopfaden. Sie verarbeitet bei Tests über 1.100 simulierte Datensätze, meldet begrenzte oder unvollständige Durchläufe ausdrücklich und gibt **keine personenbezogenen IDs, GCS-Pfade oder Rohdaten** aus. Ein Hilfskommando darf ausschließlich mit lokalem Firestore-Emulator, `demo-*`-Projekt und Loopback-Adresse laufen. Zugriffsverweigerungstests sind Teil des obligatorischen Enterprise-Gates.

**Keine vollständige Umsetzung der Retention-Warteschlange:** Die Daten wurden bisher nur synthetisch geprüft; keine echte Staging- oder Produktionsbestandsaufnahme liegt vor. Der 300-Einträge-Löschstopp bleibt erhalten. Verbindlich offen sind ein serverseitig autorisierter, ausfallsicherer Work-Index mit Transaktions-Lease und Idempotenz, die Überprüfung älterer Datensätze ohne Ablaufmarker, GCS-/Firestore-Race- und Hold-Tests, Scheduler-Istzustand und externe AppSec-/DPO-/SRE-Freigaben. Die CI für den neuen #273-Commit ist getrennt zu bestätigen. **NO-GO.**


## Fortschreibung 01.11.2026 — Lease-/Löschbeleg-Zustände (Draft #274)

Die isolierte Retention-Rückstandsaufnahme aus [Draft #273](https://github.com/Veselin-Takev/Klar-Dating/pull/273) wurde auf Commit `5223b4c7` vollständig per [CI #41288386062](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41288386062) validiert, ist aber ausschließlich für einen lokalen Emulator gedacht.

In einem darauf aufbauenden [Draft #274](https://github.com/Veselin-Takev/Klar-Dating/pull/274) wurden **noch nicht aktivierte** Zustandsübergänge für eine künftige Retention-Warteschlange geschaffen: Lease mit Ablaufzeit, wechselndem Worker-Token und Versionszähler; getrennte Zustände für ein noch nicht gelöschtes Foto und einen noch ausstehenden, aber bereits beobachteten GCS-Löschvorgang; Wiederaufnahme ausschließlich der Belegprüfung und terminaler Abschluss. Eine unbenutzte Firestore-Transaktionshülle und Sicherheits-/Negativtests sind enthalten. Der neue Branch hat noch **keinen abschließend geprüften CI-PASS** ([Run #41289417424](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41289417424) beim Eintrag aktiv). Der aktive Lösch-Endpoint und die Scheduler werden nicht an diese Komponenten angeschlossen.

**P0 unverändert:** Es existiert weiterhin keine ausgerollte dauerhafte Queue und keine belastbare Cross-System-Transaktion zwischen Firestore und GCS. Bei einem Absturz unmittelbar nach der physischen Löschung, aber vor der Speicherung des Belegs ist eine gesonderte Reconciliation erforderlich. Weiter fehlen die Verarbeitung von mehr als 300 fälligen Einträgen, globale Objekt-/Tenant-Zuordnung, echte Emulator- und Staging-Tests, Legal Holds, Datenschutz-/SRE-/AppSec-Freigaben. Bis dahin **BLOCKED / NO-GO**.


## Nachtrag 01.11.2026 — Absturzsicherung durch vorab gespeicherte Löschabsicht

[Draft #274](https://github.com/Veselin-Takev/Klar-Dating/pull/274) hat auf SHA `0a01784e` die gesamte [CI #41289646248](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41289646248) bestanden. Bei der Folgeprüfung wurde eine kritische Lücke im **noch nicht aktivierten Entwurf** erkannt: Nach erfolgreicher GCS-Löschung, aber vor dem Firestore-Auditbeleg, konnte ein abgelaufener `leased`-Datensatz erneut als frischer Löschauftrag übernommen werden.

Der neue gestapelte [Draft #275](https://github.com/Veselin-Takev/Klar-Dating/pull/275) ergänzt deshalb den Zustand `delete_intent`, der in einem künftig autorisierten Worker **vor dem physikalischen GCS-Aufruf** transaktional gespeichert werden muss und die konkrete Objektgeneration und Lease-Epoche festhält. Bei Absturz nach dieser Absicht erfolgt **keine automatische zweite Löschung**. Selbst HTTP 404, geänderte Objektgeneration oder ein noch vorhandenes Objekt liefern lediglich einen manuellen, unabhängig zu überprüfenden Belegfall. Negative Worker-/CAS-/Crash-Tests und CI-Regeln wurden ergänzt. Die CI für Commit `7b30adf7` ist noch nicht abgeschlossen ([Run #41290477469](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41290477469)); kein PASS behauptet.

Die neue Komponente ist **nicht produktiv verdrahtet**. Vor GO sind ein geprüfter Producer/Consumer, dauerhafte GCS-/Firestore-Belegabstimmung, Massendatenverarbeitung, native Emulator-/GCS-Staging-Tests, Rechts-/Datenschutz-/SRE-Freigaben notwendig. **BLOCKED / NO-GO**.


## Nachtrag 01.11.2026 — Firestore-Transaktionen mit echtem Emulator prüfen

Für den Vorgänger [Draft #275](https://github.com/Veselin-Takev/Klar-Dating/pull/275), Commit `7b30adf7`, ist die vollständige [CI #41290477469](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41290477469) erfolgreich abgeschlossen. Das beweist jedoch keine produktive Lösch- und Wiederanlaufkette.

Im ungenutzten Transaktionsadapter war bislang ein Sprung von `ready` direkt zu `complete` möglich, wenn ein manipulierter Aufrufer gültige Versionszähler lieferte; ebenso konnte eine vorab gespeicherte Objektgeneration ausgetauscht werden. Der neue gestapelte [Draft #276](https://github.com/Veselin-Takev/Klar-Dating/pull/276) unterbindet diese Zustandswechsel zusätzlich **innerhalb des Firestore-Adapters**. Eine neue Testdatei verwendet den **lokalen echten Firestore-Emulator** mit synthetischen Datensätzen im `demo-klar`-Projekt, um gleichzeitige Lease-Übernahmen, persistente Löschabsichten nach einem neuen Lesevorgang und unerlaubten Abschluss zu prüfen. Weitere Negativ- und Mutationstests sind enthalten.

**Nachweisgrenze:** Neue CI auf SHA `a8c2830a` noch nicht vollständig bestätigt. Die neue Codebasis ist Draft, nicht produktiv angebunden, und die Firestore-/GCS-Löschbelege sind nicht vollständig rekonziliert. Die Verarbeitung über 300 fällige Datensätze, fachlich verifizierte Zugriffs- und Legal-Hold-Grenzen, Staging-GCS-Proben und unabhängige Freigaben fehlen weiter. **NO-GO.**


## Fortschreibung 01.11.2026 — Lease-/Audit-Feldintegrität (Draft #277)

[PR #276](https://github.com/Veselin-Takev/Klar-Dating/pull/276) hat auf SHA `a8c2830a` die vollständige [CI #41291380045](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41291380045) bestanden. Im CI-Log wurde bestätigt, dass **drei native Firestore-Emulator-Tests tatsächlich ausgeführt und bestanden** wurden.

Bei der erneuten Quellprüfung zeigte sich eine zusätzliche Designschwäche im weiterhin **inaktiven** Firestore-Transaktionsadapter: Auch ein grundsätzlich zulässiger Zustandswechsel hätte durch einen fehlerhaften Aufrufer mit manipuliertem Worker-Token, nicht erhöhtem Versuchs-Zähler oder verfälschtem Löschzeitpunkt gespeichert werden können. Der neue gestapelte [Draft #277](https://github.com/Veselin-Takev/Klar-Dating/pull/277) prüft diese sicherheitsrelevanten Daten nun zusätzlich zur Zustandsmatrix, ergänzt Negativtests und eine vierte native Emulator-Prüfung. Der aktuelle Commit `4c1e04ee` wird durch [CI #41316005858](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41316005858) geprüft; **kein abschließender PASS unterstellt**.

Nicht gelöst sind eine produktive Job-Warteschlange, autorisierte und überprüfte Lösch- und Belegabläufe, mehr als 300 fällige Einträge, globale GCS-Objektzuordnung und Mandantentrennung, echte Staging-Nachweise sowie unterschriebene Datenschutz-, Security- und Betriebsfreigaben. Keine produktiven Änderungen, kein Merge. **BLOCKED / NO-GO**.


## Nachtrag 01.11.2026 — Typisierte und eingeschränkte Retention-Operationen

Für [Draft #277](https://github.com/Veselin-Takev/Klar-Dating/pull/277), SHA `4c1e04ee`, ist der vollständige [CI-Lauf #41316005858](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41316005858) erfolgreich. Die Logs belegen vier ausgeführte und erfolgreiche native Firestore-Emulator-Tests.

In der bislang **nicht produktiv angebundenen** Retention-Transaktionshülle war weiterhin ein frei übergebener Änderungs-Callback öffentlich aufrufbar. Ein späterer fehlerhafter Integrationsaufruf hätte damit trotz formal gültiger Zustandsfelder einen nicht authentifizierten Löschbeleg erzeugen können. Der neue gestapelte [Draft #278](https://github.com/Veselin-Takev/Klar-Dating/pull/278) ersetzt diese öffentliche Schnittstelle durch **vier typisierte Vorbereitungs-Operationen** (Lease übernehmen, unvollständige Arbeit vor Löschung zurückstellen, Löschabsicht vorbereiten, sperren). Eine Löschbeobachtung oder finale Belegbestätigung wird ohne unabhängigen GCS-/Audit-Nachweis ausdrücklich **nicht** angeboten. Unbekannte Befehle und versteckte Zusatzfelder werden bereits vor Firestore-Zugriff verweigert; Unit-/Emulator-/Mutationstests sind aktualisiert.

**Nachweisgrenze:** Der neue SHA `bcaede0e` wird separat unter [CI #41332732631](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41332732631) geprüft. Dieses API-Hardening macht keine dauerhafte produktive Lösch-Warteschlange verfügbar, schließt kein GCS-/Firestore-Absturzfenster und erteilt keine Security-/Datenschutz-/SRE-Freigaben. P0 #202 bleibt offen und **Production NO-GO**.


## Nachtrag 01.11.2026 — Serverseitige Zeit und unveränderliche Transaktionsbefehle

Der Vorgänger [PR #278](https://github.com/Veselin-Takev/Klar-Dating/pull/278), SHA `bcaede0e`, hat [CI #41332732631](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41332732631) vollständig bestanden. Die vier nativen Firestore-Emulator-Tests wurden laut CI-Log ausgeführt und bestanden.

Bei der Folgeprüfung blieb ein Zeitmanipulationsrisiko in dem weiterhin **nicht produktiv angebundenen** Adapter: Der Aufrufer durfte `now` für Lease-Übernahmen und Löschabsichten angeben. Zudem konnten mutable Befehlswerte während asynchroner Firestore-Transaktionswiederholungen theoretisch geändert werden. Der neue isolierte [Draft #279](https://github.com/Veselin-Takev/Klar-Dating/pull/279) sperrt Zeitfelder aus allen vier Aufrufen, ermittelt einen einzigen überprüften Zeitpunkt mit der Serveruhr und verwendet eine vor Beginn der Transaktion kopierte Befehlsstruktur. Zusätzliche Unit-/Emulator-/Sicherheitsmutationstests sind committed.

**Restblocker:** Eine lokale Serveruhr ist kein unabhängiger Nachweis korrekter Zeitverteilung zwischen mehreren produktiven Workern. Es fehlen Synchronisations-/Drift-Grenzen, eine live autorisierte Auftragsquelle und Worker, Tenant-/UID-/GCS-/Legal-Hold-Nachweise, belastbare 404/412-Belege, Verarbeitung über 300 fälliger Einträge und unabhängige Datenschutz-/Security-/SRE-/Release-Freigaben. Der neue Code besitzt noch **keinen vollständig nachgewiesenen Exact-Head-CI-PASS**. **NO-GO.**


## Fortschreibung 01.11.2026 — CAS-Befehlsdaten ohne aktive Getter prüfen

Vorgänger [Draft #279](https://github.com/Veselin-Takev/Klar-Dating/pull/279), SHA `2dc57166`, hat [CI #41334295241](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41334295241) vollständig bestanden; fünf native Firestore-Emulator-Tests wurden laut Protokoll tatsächlich ausgeführt und erfolgreich abgeschlossen.

Beim Review des **weiterhin inaktiven** Retention-Adapters zeigte sich eine zusätzliche Eingangsprüfungslücke: Versteckte, nicht aufzählbare oder symbolbasierte Eigenschaften wurden nicht erkannt, und das Lesen von JavaScript-Gettern hätte Code während der Validierung ausführen können. Im neuen gestapelten [Draft #280](https://github.com/Veselin-Takev/Klar-Dating/pull/280) werden deshalb nur eigene, aufzählbare, primitive **Dateneigenschaften** angenommen; Sonderfelder und Zugriffs-Getter werden vor dem ersten Firestore-Zugriff verweigert. Dazu wurden Unit-Negativtests, ein sechster nativer Emulator-Test und verpflichtende Sicherheitsmutations-Checks ergänzt. [CI #41335454638](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41335454638) für den neuen Commit war beim Bericht noch nicht abgeschlossen.

Die Änderung ist ein zusätzliches Sicherheitsnetz gegen fehlerhafte Aufrufe, **keine Zulassung eines echten Löschdienstes**. Die produktive Ausführung, globale Mandanten-/Fotozuordnung, gesicherte GCS-Löschbelege, mehr als 300 fällige Einträge, Synchronisation verteilter Uhren, echte Stagingtests und unabhängige Fachfreigaben bleiben offen. **BLOCKED / NO-GO.**


## Nachtrag 01.11.2026 — Gemeinsame P0-Sicherheitsprüfungen (Draft #281)

Die ungemergten Quellcodeänderungen zu Foto-Retention [#280](https://github.com/Veselin-Takev/Klar-Dating/pull/280) und mandantenbezogener Zugriffs-Inventur [#268](https://github.com/Veselin-Takev/Klar-Dating/pull/268) haben ihre **jeweiligen** exakten CI-Prüfungen [#41336278230](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41336278230) beziehungsweise [#41282765859](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41282765859) bestanden. #280 bestätigt zusätzlich sechs tatsächlich ausgeführte native Firestore-Emulator-Tests.

Der neue isolierte [Draft #281](https://github.com/Veselin-Takev/Klar-Dating/pull/281) übernimmt exakt vier unabhängige lesende Tenant-Scanner- und Testdateien, ergänzt deren Pflichtprüfung, erhält die bestehende Retention-Gate-Kette und führt Mutationstests gegen versehentlich deaktivierte Sicherheitsprüfungen ein. Die **erstmalige gemeinsame CI** auf SHA `26e9ed2a` läuft unter [#41338044005](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41338044005). Ein grünes Gesamtergebnis darf erst nach Abschluss behauptet werden.

Die Quellinventur dient ausschließlich der Erkennung möglicher Zugriffsstellen. Sie ersetzt **keine** reale Mandantentrennung, Rechtmäßigkeit der Legacy-Migration, DSGVO-Art.-17-Löschkaskade, produktive Retention-Verarbeitung oder unabhängige Freigaben. Ohne vollständigen Cutover, geschützte GCS-Belege, Staging-/Betriebsnachweise und Fachfreigaben bleibt die Produktionsfreigabe **BLOCKED / NO-GO**.


## Fortschreibung 01.11.2026 — Firebase-Regeldateien in der Mandanten-Evidenz

[Draft #281](https://github.com/Veselin-Takev/Klar-Dating/pull/281), SHA `26e9ed2a`, hat die **gemeinsame** CI für Tenant-Quellinventur und Retention-Sicherheitsprüfungen [#41338044005](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41338044005) bestanden. Laut CI-Log wurden sechs native Firestore-Emulator-Tests ausgeführt und bestanden.

Die bisherige Inventur erfasst aber nur Anwendungscode. Der neue isolierte [Draft #282](https://github.com/Veselin-Takev/Klar-Dating/pull/282) ergänzt daher die Prüfung der in `firebase.json` referenzierten Firestore- und Storage-Regeldateien und ihres Emulator-Gegenstücks. Fehlende oder umgelenkte Quellen sowie abweichende Konfigurationspfade werden verweigert. Für die tatsächlich geprüften lokalen Regeldateien werden Prüfsummen, Dateigrößen und Zeilennummern ausgewählter Mandanten-/Legacy-Marker erfasst, **ohne Regelquelltexte oder Nutzerdaten auszugeben**. Die Ergebnisse behaupten ausdrücklich **keine** bestätigte Mandantentrennung und **keine** verifizierte Produktionsbereitstellung. Neue Negativtests und Pflicht-Gates ergänzen die bestehende Sicherheitskette. Die neue [CI #41339344795](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41339344795) ist noch nicht vollständig abgeschlossen.

Echte produktive Firestore-/Storage-Rechte, Legacy-Migration, Tenant-/Art.-17-Datenbeziehungen, ein produktiver biometrischer Retention-Worker, GCS-Absturzbelege und unabhängige Fachfreigaben bleiben erforderlich. **Production BLOCKED / NO-GO.**


## Nachtrag 01.11.2026 — Echte Firestore-Regeltests für Tenant-Claims

Die lokal konfigurierten Firebase-Regeldateien wurden im ungemergten [Draft #282](https://github.com/Veselin-Takev/Klar-Dating/pull/282) mit [CI #41339344795](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41339344795) erfolgreich geprüft. Eine reine Quellinventur reicht jedoch für P0 #254 nicht aus.

Der neue [Draft #283](https://github.com/Veselin-Takev/Klar-Dating/pull/283) fügt sechs native Firestore-Emulator-Tests mit synthetischen Konten und simulierten signierten Tenant-Claims hinzu. Dabei wird ein wichtiger **verbleibender Migrationsblocker** bewusst sichtbar: Das globale Legacy-Nutzerprofil ist aktuell an die UID, **nicht an den Tenant-Claim**, gebunden. Dieselbe UID kann ihr Legacy-Profil deshalb auch mit einem anderen Tenant-Claim lesen. Dagegen sind die künftigen Tenant-Unterpfade für alle Clients noch gesperrt, einschließlich rechtmäßiger Eigentümer; sie sind somit **noch nicht funktionsfähig**. Fremde UID-Zugriffe, gefälschte Administratorrollen, unzulässige Tenant-Feldänderungen und anonyme Zugriffe werden gesondert geprüft. Das sind Quell-/Emulatorbefunde, **keine Behauptung einer ausgenutzten Produktionslücke**.

Ein neuer Enterprise-CI-Check verhindert das stille Auslassen dieser Tests. Der aktuelle Code-SHA `29716be0` wird unter [CI #41341495412](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41341495412) geprüft; das Resultat ist noch offen. Mandantenmitgliedschaft, produktive Rules, Storage/Admin-SDK-Zugriffe, Legacy-Cutover, Datenschutz-/Art.-17-Löschkaskaden und Security-/Legal-/SRE-Freigaben stehen weiter aus. **BLOCKED / NO-GO.**


## Fortschreibung 01.11.2026 — Mandantenbezogene Storage-Nachweise

[Draft #283](https://github.com/Veselin-Takev/Klar-Dating/pull/283) hat die vollständige [CI #41341786655](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41341786655) bestanden. Die Protokolle bestätigen sechs tatsächlich ausgeführte Tenant-Firestore-Rules-Tests und sechs Retention-Emulator-Tests bei insgesamt 1.468 bestandenen Tests.

Ein neuer Quellbefund betrifft die Profilbilder im Firebase Storage: Die bisherigen globalen `profiles/{uid}`-Bilder sind nach den eingecheckten Regeln für **alle angemeldeten Konten** lesbar – unabhängig von einem späteren Mandanten-Claim. Dies kann für die aktuelle Dating-App bewusst öffentlich sein, ist für einen Multi-Tenant-Cutover aber **keine ausreichende Mandantengrenze**. Biometrische Verifizierungsbilder bleiben auf Client-Ebene gesperrt; neue mandantenspezifische Storage-Pfade sind ebenfalls noch für alle Clients gesperrt.

Der neue ungemergte [Draft #284](https://github.com/Veselin-Takev/Klar-Dating/pull/284) ergänzt vier native Storage-Emulator-Tests mit ausschließlich synthetischen Objekten: bereichsübergreifende Profilbild-Lesbarkeit, Fremdschreib-/Löschverbot, Schutz der Verifizierungsbilder und noch gesperrte Tenant-Pfade. Zusätzlich werden die Tests als Pflicht-Gate geschützt. Der CI-Lauf [#41342604486](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41342604486) ist noch nicht vollständig bestätigt.

Vor Produktionsfreigabe müssen Produktverantwortliche und Datenschutz die Medien-Sichtbarkeit vereinbaren; Mandantenberechtigungen, echte Rule-Deployments, URL- und Backend-Zugriffe, Datenmigration, Art.-17-Löschkaskade sowie die gesamte Foto-Retention und unabhängige Fachfreigaben müssen nachgewiesen werden. **NO-GO.**


## Nachtrag 01.11.2026 — Profilbild-Zugriff im tatsächlichen Storage-Emulator testen

Der reine Quellmarker-Entwurf [#285](https://github.com/Veselin-Takev/Klar-Dating/pull/285) SHA `170a0586` bestand [CI #41342756886](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41342756886). Neu angelegter [Draft #286](https://github.com/Veselin-Takev/Klar-Dating/pull/286) ergänzt zwei echte Storage-Emulator-Tests: Ein Nutzer mit anderem synthetischem Mandanten-Claim kann nach den **aktuellen** Regelquellen ein Profilbild eines anderen Kontos lesen, aber nicht überschreiben; nicht angemeldete Nutzer können es nicht lesen. Verifizierungsfotos bleiben sowohl dem Eigentümer als auch einem mandantenfremden Client unzugänglich, obwohl ein berechtigter Eigentümer sie hochladen darf. Diese erwarteten Ergebnisse müssen noch durch [CI #41343839097](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41343839097) verifiziert werden.

Eine mandantenübergreifende Sichtbarkeit von **Profilbildern kann fachlich vorgesehen sein**. Die Prüfung ist keine nachgewiesene Datenpanne und ersetzt weder eine unterschriebene Datenschutz-/Produktentscheidung noch den Nachweis ausgerollter Regeln, den Admin-SDK-Audit oder reale Migrations- und Berechtigungstests. P0 #202/#254 und **Production NO-GO** bleiben offen.


## Nachtrag 01.11.2026 — Tenant-Claims im echten Storage-Emulator

Der vorherige Source-Review [Draft #285](https://github.com/Veselin-Takev/Klar-Dating/pull/285) hat auf SHA `170a0586` die gesamte [CI #41342756886](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41342756886) bestanden. Der Fund `allow read: if signedIn()` bei Profilbildern ist jedoch ein fachlich zu bewertender **Zugriffsbereich** und kein Nachweis eines produktiven Datenlecks.

Neue gestapelte [Draft #287](https://github.com/Veselin-Takev/Klar-Dating/pull/287) ergänzt zwei ausführbare **native Storage-Emulator**-Szenarien für unterschiedliche `tenantId`-Claims. Sie halten das Verhalten der unveränderten Quellregeln fest: Die Profilbild-Metadaten eines Tenant-A-Nutzers sind für einen angemeldeten Tenant-B-Nutzer lesbar, während fremdes Hochladen/Löschen und unautorisierte Lesezugriffe abgelehnt werden. Biometrische Verifizierungsfotos bleiben auch für Eigentümer und fremde Tenant-Nutzer clientseitig lesegesperrt. Es werden nur synthetische Daten im lokalen `demo-klar`-Emulator verwendet; **keine produktiven Regeln geändert**. Ein zusätzlicher CI-Mutationstest soll verhindern, dass diese Tests unbemerkt entfernt werden. [CI #41343976817](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41343976817) für den neuen Commit läuft und ist noch kein bestandener Gesamtnachweis.

Offen bleiben die **unabhängige Produkt-/Datenschutzentscheidung zur tenantübergreifenden Profilsichtbarkeit**, der Abgleich mit tatsächlich ausgerollten Storage-Regeln und Admin-SDK-Grenzen, die vollständige Tenant-Migration, die Art.-17-Löschkaskade sowie P0 #202 mit nachgewiesener GCS-Löschbeleg-/Wiederanlaufkette. **Offizielle Produktion: BLOCKED/NO-GO.**


## Nachtrag 01.11.2026 — Gemeinsame Storage-/Firestore-Tests bestanden, Freigabe bleibt gesperrt

Für den absichtlich deduplizierten [Entwurfs-PR #288](https://github.com/Veselin-Takev/Klar-Dating/pull/288) wurde der unveränderliche Commit `c358d4360e36ef7a68555c2471f17648358557f7` in [GitHub Actions #41345204334](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41345204334) **vollständig erfolgreich** geprüft. Im Originalprotokoll stehen **vier tatsächlich ausgeführte Storage-Regeltests, sechs Tenant-Firestore-Regeltests und sechs Retention-Firestore-Tests**; außerdem 1.472 bestandene Vitest-Tests in 200 Dateien, ein bestandener Produktions-Smoke-Test und 26 bestandene Browser-Acceptance-Tests. Ein alternativer Draft #287 besteht ebenfalls einen eigenen CI-Lauf, würde aber Testumfang und Gate-Spezifikationen teilweise doppeln; **kein blindes Zusammenführen**.

Das ist ein überprüfbarer Fortschritt bei der **lokalen Code- und Testqualität**, nicht bei der produktiven Freigabe. Die aktuell dokumentierte Profilbild-Regel erlaubt jedem angemeldeten Client das Lesen ohne Mandantenprüfung; dies kann Teil der Dating-Profilentdeckung sein. Ob das im neuen Mandantenmodell rechtlich und fachlich zulässig sein soll, müssen **Produkt, Datenschutz und Legal ausdrücklich entscheiden**. Die Entscheidungsoptionen und Negativtest-Matrix sind in [P0_254_STORAGE_VISIBILITY_DECISION_GATE_2026-11-01.md](P0_254_STORAGE_VISIBILITY_DECISION_GATE_2026-11-01.md) festgehalten. Weiterhin fehlen produktive Rules-/IAM-/Admin-SDK-Nachweise, Tenant-Migration einschließlich Art. 17 und eine rechtssichere biometrische Foto-Löschkette mit GCS-404/412-Belegen, Holds und Verarbeitung von mehr als 300 offenen Einträgen. Kein `main`-Merge, kein Rollout, keine Kundendatenmutation und keine unabhängige Freigabe. P0 #202/#254 **OFFEN**, `productionApproved=false`, **PRODUCTION NO-GO**.


## Nachtrag 01.11.2026 — Sicherheitsprüfungen müssen in CI ausgeführt werden (PR #289)

Auf dem von #288 abgeleiteten [Draft-PR #289](https://github.com/Veselin-Takev/Klar-Dating/pull/289) wurde eine weitere CI-Vertrauenslücke behoben: Drei verpflichtende Firebase-Emulator-Testgruppen dürfen in GitHub Actions bei fehlender oder fehlerhafter Emulator-Konfiguration nicht mehr unbemerkt übersprungen werden. Der genaue Commit `fd62b44c0c763ca58ae358fd10c92138b1aff3b3` bestand vollständig [CI #41347553626](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41347553626). Protokolliert sind **vier tatsächlich ausgeführte Storage-, sechs Tenant-Firestore- und sechs Retention-Firestore-Tests**, die neuen automatischen CI-Regressionsprüfungen, **1.472** bestandene Vitest-Tests, der Produktions-Smoke-Test und **26** bestandene Browser-Acceptance-Tests. Die Änderung betrifft nur Test-/CI-Sicherheit und **keine produktive Firebase-/GCS-Infrastruktur**. Eine separate bewusste Fehlkonfigurations-Ausführung wird durch den bisherigen Source-Mutationstest nicht ersetzt.

**Managemententscheidung unverändert:** Kein Release ohne legitimierte Profilmedien-Sichtbarkeit (Produkt, Datenschutz, Legal), tatsächliche mandantenfeste Admin-SDK-/Firestore-/Storage-/IAM-Nachweise, sichere Migration und Art.-17-Kaskade sowie für P0 #202 eine nachgewiesene gesetzeskonforme biometrische Löschkette einschließlich GCS-404/412-/Wiederanlauf-Belegen und mehr als 300 fälligen Einträgen. Beide P0 bleiben offen. Keine Integration, kein Deployment und keine Freigabesignaturen; `productionApproved=false`, **BLOCKED / NO-GO**.


## Nachtrag 01.11.2026 — Tatsächliche CI-Fehlkonfiguration erfolgreich nachgewiesen (#290)

Der neue [Draft-PR #290](https://github.com/Veselin-Takev/Klar-Dating/pull/290) auf dem exakten Commit `a93fdc993beb294b684404a26be30a67d23f27b3` hat den kompletten [GitHub-Actions-Lauf #41348580636](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41348580636) **bestanden**. Im Originalprotokoll ist die echte Negativprüfung `P0 native Firebase safety suites actually FAIL without emulators in GitHub CI` als **PASS** aufgeführt: Ohne Emulatoren scheitern die Sicherheits-Testgruppen ausdrücklich, statt unbemerkt übersprungen zu werden. Danach wurden unter zugelassenem `demo-klar` vier Storage-, sechs Tenant-Firestore- und sechs Retention-Firestore-Fälle real ausgeführt. Insgesamt: **1.472** bestandene Vitest-Tests, Production-Smoke-Test und **26** Browser-Acceptance-Tests PASS. Der Fix sichert den Testprozess, nicht die produktive Umgebung.

Die beiden Produktionsblocker **P0 #202 und #254 bleiben unverändert offen**. Es fehlen eine unterschriebene rechtskonforme Profilmedien-Sichtbarkeit, produktiv geprüfte Mandantenzuordnung und Admin-SDK-/IAM-/Storage-/Firestore-Regeln, rechtssichere Art.-17-Migration, echte GCS-404/412-/Absturz-Belege und ein dauerhafter Löschbetrieb für mehr als 300 fällige Einträge sowie die unabhängigen AppSec-/DPO-/Legal-/SRE-/Release-Freigaben. Kein Merge, kein Cloud-Rollout, keine Kundendatenänderung. `productionApproved=false`, **Production BLOCKED / NO-GO**.


## Nachtrag 01.11.2026 — Sicherheitsprüfung der Profilbild-Sichtbarkeit für Gastkonten

Die neue Quellanalyse zeigt eine unterschiedliche Sicherheitsgrenze: Die aktuell eingecheckten Firebase-Storage-Regeln erlauben `profiles/{uid}/{datei}` bereits für jedes **angemeldete** Konto, also auch ein anonym authentifiziertes Gastkonto. Die Firestore-Suche nach `public_profiles` prüft dagegen Gaststatus, Erwachsenenstatus und Blockierungen. Firestore-Suchberechtigungen schützen **nicht automatisch** den direkten Zugriff auf Storage-Mediendateien. Dieser Befund ist eine **fachlich und datenschutzrechtlich zu bewertende Abweichung**, kein Beleg für einen tatsächlichen produktiven Datenabfluss.

Der neue isolierte [Draft #291](https://github.com/Veselin-Takev/Klar-Dating/pull/291) auf Commit `b3aa77c199fc8f94a28490b13ba91e87aaadf07a` ergänzt nur einen nativen Emulator-Test mit synthetischen Profilbildern: Gast-Lesen und Metadatenzugriff werden geprüft, unerlaubtes Gast-Schreiben und Löschen müssen abgewiesen werden. Mutationstests sichern diese Feststellungen gegen unbemerktes Entfernen ab. [CI #41350043310](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41350043310) war zu diesem Zeitpunkt **eingereiht**, nicht erfolgreich bestätigt. Die vorangehende #290-CI war auf eigenem SHA erfolgreich, berechtigt aber nicht zur Freigabe des neuen Commits.

Weiter fehlen die unterschriebene Product-/DPO-/Legal-Entscheidung zur Medien- und Altersfreigabe, produktive Rules-/IAM-/Admin-SDK-BOLA-/Art.-17-Nachweise und für P0 #202 die verifizierte biometrische Löschkette mit Legal-Holds, GCS-404/412- und Crash-Belegen sowie mehr als 300 fälligen Vorgängen. Kein Merge, keine produktive Datenänderung, keine offizielle Freigabe. `productionApproved=false`, **Production BLOCKED/NO-GO**.


## Nachtrag 01.11.2026 — Gastprofil-Speicherberechtigungen vollständig CI-geprüft

Der weitere [Draft-PR #291](https://github.com/Veselin-Takev/Klar-Dating/pull/291) auf dem unveränderlichen Commit `b3aa77c199fc8f94a28490b13ba91e87aaadf07a` hat den kompletten [CI-Lauf #41350043310](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41350043310) **bestanden**. Originalprotokolle bestätigen fünf tatsächlich ausgeführte Storage-, sechs Tenant-Firestore- und sechs Retention-Firestore-Tests, insgesamt **1.473** erfolgreiche Vitest-Tests in 200 Dateien, den bestandenen Produktion-Smoke-Test sowie **26** bestandene Browser-Acceptance-Tests. Ebenfalls erfolgreich war der absichtliche Teststart ohne Firebase-Emulator, der die sicherheitskritischen Testgruppen zum kontrollierten Abbruch zwingt. Die vorherige Governance-Dokumentations-CI [#41350146993](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41350146993) ist für deren früheren SHA erfolgreich; der neue Dokumentationsstand wird erneut geprüft.

**Fachliches Restrisiko:** Die eingecheckten Storage-Regeln erlauben auch anonym authentifizierten Gastkonten das Lesen von Profilmedien und Metadaten. Die Firestore-Profilsuche hat dagegen eigene Gast-, Erwachsenen- und Blockierungs-Gates. Diese Diskrepanz ist lokal durch echte Emulator-Tests bestätigt, **nicht** als produktiver Datenabfluss nachgewiesen. Eine verbindliche Sichtbarkeitsentscheidung durch Produkt, Datenschutz und Rechtsabteilung ist erforderlich. Ferner sind P0 #202 und #254 weiter offen: live Tenant-/Admin-SDK-/IAM-/Rules-Sicherheit, sichere Art.-17-Kaskade, rechtssichere biometrische GCS-Löschkette mit 404/412-/Hold-/Crash-Belegen, dauerhafter >300-Queue-Betrieb und unabhängige Freigabesignaturen. Kein Merge, kein Rollout, keine Kundendatenoperation; `productionApproved=false` und **Production BLOCKED/NO-GO**.


## Nachtrag 01.11.2026 — Verbindliche, unabhängige Release-Owner-Freigabe

Bei der Prüfung des technischen Freigabegates wurde festgestellt, dass die bisherige strukturelle Attestierung die Rollen Security, DPO, Legal und SRE erfasst, aber **keine separate Release-Owner-Unterschrift** verlangt. Es handelt sich um eine nachgewiesene Lücke im **Quellcode der Strukturprüfung**, nicht um einen Beleg einer tatsächlich durchgeführten oder missbräuchlichen Produktionsfreigabe.

Der isolierte, von `main` abgeleitete [Draft #292](https://github.com/Veselin-Takev/Klar-Dating/pull/292) auf `c7e83d309fb64fff132b0e513db682c6acf21f1e` ergänzt diese Pflichtrolle, die exakte Commitbindung, einen Nachweislink und eine Prüfung gegen offensichtlich identische Prüferidentitäten bei anderen Rollen. Automatische Negativtests decken fehlende, veraltete oder selbst attestierte Release-Owner-Records ab. Der neue [CI-Lauf #41352169125](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41352169125) war bei der Dokumentation **noch nicht abgeschlossen**.

Eine formal gültige digitale Struktur ersetzt weder echte Identitätsprüfung noch unabhängige Freigaben. P0 #202 (biometrische Retention und GCS-Quittungen) sowie P0 #254 (Mandantentrennung, Art.-17-Migration und Medienzugriff), tatsächliche Cloud-Protokolle und reale Freigabesignaturen bleiben ausstehend. Keine Änderungen in `main`, kein Merge oder Deployment, `productionApproved=false`, **Production BLOCKED / NO-GO**.


## Nachtrag 01.11.2026 — Release-Owner-Prüfung CI-bestätigt (#292)

Der neu erstellte, isolierte [Draft #292](https://github.com/Veselin-Takev/Klar-Dating/pull/292) auf SHA `c7e83d309fb64fff132b0e513db682c6acf21f1e` hat den vollständigen [GitHub-Actions-Lauf #41352169125](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41352169125) **bestanden**. Die Original-Logs belegen 64 erfolgreiche Node-Freigabestrukturtests, darunter alle Negativprüfungen auf fehlende, nicht commitgebundene, beleglose und scheinbar selbst unterzeichnete Release-Owner-Records. Außerdem sind **1.372** Vitest-Tests in 192 Dateien, Production Smoke und **26** Browser-Acceptance-Tests bestanden. Diese Zahlen beziehen sich ausschließlich auf den separaten, von `main` abgeleiteten Code-Branch; die gestapelte P0-Kette hat einen anderen Teststand. Noch kein kombinierter Release-SHA.

**Keine offizielle Freigabe:** Die technische Rollentrennung kann weder echte Identitäten noch die verlinkten Freigaben kryptografisch verifizieren. Die Person des Release Owners und alle vier unabhängigen Fachrollen müssen auf dem endgültigen Release-Artefakt identifiziert und signiert werden. P0 #202 (biometrische Löschkette mit GCS-Generation/404/412/Legal Holds/Quittungs-Recovery/>300 dauerhaften Jobs) und P0 #254 (Mandanten-/Admin-SDK-/IAM-/Rules-Isolation und Art.-17-Migration) bleiben offen; die Rechtsentscheidung über Gast-/Erwachsenen- und mandantenübergreifende Mediennutzung fehlt. `productionApproved=false`, **Production BLOCKED/NO-GO**, kein Merge oder Deployment.


## Nachtrag 01.11.2026 — Gemeinsame technische Prüfung der P0-Testbasis und Release-Owner-Kontrolle

Die neue isolierte [Draft-Integration #293](https://github.com/Veselin-Takev/Klar-Dating/pull/293) auf Commit `e372270fa5bc43663355c8f2d8191f125c5d55b4` überträgt **genau zwei**, zuvor gegen `main` als konfliktfrei geprüfte Source-/Testdateien aus dem unabhängig bestandenen Release-Owner-Draft #292 auf die bereits CI-bestandene P0-Testkette #291. Die dritte Änderung ist ausschließlich das technische Integrationsprotokoll. [GitHub bestätigt diesen Drei-Dateien-Diff](https://github.com/Veselin-Takev/Klar-Dating/pull/293/files). Dadurch kann die kombinierte Sicherheits-Testbasis erstmals **auf demselben Commit** geprüft werden, ohne unkontrollierte Merges oder Änderungen an Firebase-Regeln und produktiven Daten.

Die neue [CI #41353102974](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41353102974) war beim Nachtrag **noch aktiv**. Die bestandenen Einzel-PR-Tests gelten nicht automatisch als Nachweis der kombinierten Version. Die vorherige Governance-CI #41352274801 wurde **abgebrochen**, nicht bestanden.

Eine technische Integration ersetzt nicht die unterschriebene Produkt-/Datenschutz-/Legal-Entscheidung über Profilbilder, die Cloud-/Admin-SDK-/Tenant-/Art.-17-Sicherheit, die produktive biometrische GCS-Löschverarbeitung samt Quittungen und >300 fälligen Einträgen oder die unabhängigen Security/DPO/Legal/SRE/Release-Owner-Freigaben. `productionApproved=false`; **Production BLOCKED/NO-GO**, kein Merge/Deployment/Produktivdatenzugriff.


## Nachtrag 01.11.2026 — Gemeinsame Sicherheitsintegration bestanden, verpflichtende P0-Belege präzisiert

Die vollständige [CI #41353102974](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41353102974) für den gemeinsamen, ungemergten [Draft #293](https://github.com/Veselin-Takev/Klar-Dating/pull/293) auf `e372270fa5bc43663355c8f2d8191f125c5d55b4` hat **bestanden**: 64 Release-Owner-Strukturprüfungen, ein tatsächlich ausgeführter CI-Negativtest ohne Emulator, fünf native Storage-, sechs Tenant-Firestore- und sechs Retention-Firestore-Tests, insgesamt 1.473 Vitest-Tests und 26 Browser-Acceptance-Tests. Das ist ein konkreter Fortschritt beim sicheren Zusammenführen der Testbasis, **keine Produktionsfreigabe**.

Ein zusätzlich erkannter Schema-Befund: Das Release-Gate verlangte noch keine ausdrücklich benannten, einzeln nachweisbaren Belege für die zentralen P0-Produktionsrisiken. Der neue gestapelte [Draft #294](https://github.com/Veselin-Takev/Klar-Dating/pull/294) auf `85c092b708497b5954aaf5cbfe8a901a401e3549` fordert daher gesonderte exakte-Commit-Nachweise für Admin-SDK-Mandantentrennung, Legacy-/Art.-17-Migration, datenschutzrechtlich genehmigte Profilmedien-Sichtbarkeit, GCS-Generation/404/412-/Löschquittungen, dauerhaften Löschbetrieb mit mehr als 300 Fällen und tatsächliche Scheduler-/IAM-Berechtigungen. Fehlende, übersprungene und ungültige Felder sperren künftig die strukturelle Freigabe; die neue [CI #41354106319](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41354106319) lief bei Dokumentation noch. Die Strukturprüfung kann echte Unterschriften und Cloud-Belege **nicht** selbst authentisieren.

Die P0-Themen #202 und #254 bleiben offen. Tatsächliche Datenlöschungen, Tenant-Migration, produktive IAM/Rules-Konfigurationen, alle Betriebsbelege und unabhängige Security-/DPO-/Legal-/SRE-/Release-Owner-Freigaben fehlen. Keine Änderung an `main`, kein Merge, keine Cloud-/Kundendatenaktion; `productionApproved=false`, **Production BLOCKED/NO-GO**.


## Nachtrag 01.11.2026 — P0-Freigabesperren vollständig CI-bestanden; KYC-Profilfehler behoben

Der gestapelte, nicht gemergte [Draft #294](https://github.com/Veselin-Takev/Klar-Dating/pull/294), Commit `85c092b708497b5954aaf5cbfe8a901a401e3549`, hat die vollständige [CI #41354106319](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41354106319) **bestanden**. Im Originalprotokoll sind sämtliche 24 Negativtests zu den sechs neuen P0-Freigabenachweisen, fünf Storage-, sechs Tenant-Firestore- und sechs Retention-Firestore-Testfälle, 1.473 Vitest-Tests, Production-Smoke und 26 Browser-Tests erfolgreich. Ebenso hat der unmittelbar vorherige Governance-Dokumentationsstand [CI #41354223698](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41354223698) bestanden.

Zusätzlich wurde [P1 #237](https://github.com/Veselin-Takev/Klar-Dating/issues/237) in einem separaten, direkt auf `main` basierenden [Draft #295](https://github.com/Veselin-Takev/Klar-Dating/pull/295) auf SHA `57cc4519e46f3287905a5b0d90463a7194ce6e53` behoben. Das Profil nutzte beim Aktualisieren des KYC-Status fälschlich einen stillgelegten Endpunkt mit HTTP 410. Der Dialog verwendet nun ausschließlich das signierte Didit-Statusverfahren; nur die eindeutige serverseitige Antwort `approved` löst eine Profilaktualisierung aus. Unverfügbare, ungeprüfte und fehlerhafte Antworten bleiben gesperrt. Neue Komponenten- und API-Quelltests sichern die Änderung ab. [CI #41355375724](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41355375724) lief zum Nachtragszeitpunkt, daher **kein vorweggenommener PASS** für #295.

Die verbesserten P0-Freigabegates belegen noch **nicht**, dass die tatsächlichen Rechts-/Cloud-/Sicherheitsnachweise existieren oder unabhängig unterschrieben wurden. Biometrics-Retention P0 #202, echte Mandantenisolierung P0 #254, Art.-17 und die signierte Medienentscheidung, GCS-404/412-/Legal-Hold-/Wiederanlaufbelege, dauerhafte >300-Queue und Freigaben durch Security/DPO/Legal/SRE/Release Owner bleiben offen. Kein Merge, keine Änderung an `main`, keine Cloud-/Kundendatenmutation. `productionApproved=false`, **Production BLOCKED / NO-GO**.


## Nachtrag 01.11.2026 — Didit-Profilstatus geprüft und in P0-Sicherheitsbasis aufgenommen

Der isolierte, noch ungemergte [Draft #295](https://github.com/Veselin-Takev/Klar-Dating/pull/295), SHA `57cc4519e46f3287905a5b0d90463a7194ce6e53`, hat die vollständige [CI #41355375724](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41355375724) **bestanden**, darunter **18 neue Didit-Komponententests**, insgesamt **1.390 Vitest-Tests**, Production-Smoke und **26** Browser-Acceptance-Tests. Der aktive Profil-Dialog nutzt nun den authentifizierten Didit-Serverstatus, statt fälschlich den zurückgezogenen HTTP-410-Endpunkt abzufragen; nur eine eindeutige `approved`-Antwort kann die Aktualisierung auslösen. Die vorherige Governance-CI [#41355541319](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41355541319) wurde ebenfalls erfolgreich abgeschlossen.

Ein neuer gestapelter [Draft #296](https://github.com/Veselin-Takev/Klar-Dating/pull/296) auf `4e8a8481a0c4b9a369b72d7bd2739e8a28cb5c96` überträgt die exakt geprüfte Didit-Korrektur in die bereits bestandene P0-Release-Gate-Kette #294. Der eigenständige `package.json`-Abgleich erhielt sämtliche P0-Tests und ergänzte nur den benötigten Didit-Quelltest. Die neue kombinierte [CI #41356725824](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41356725824) war bei Dokumentation **noch aktiv**; die bestandenen Einzeltests zählen nicht als Ersatz.

Die produktiven P0-Blocker biometrische GCS-Löschung und Tenant-/Art.-17-Isolation sowie signierte Medien-, Datenschutz-, Security-, SRE- und Release-Freigaben bleiben offen. Keine Änderungen an `main`, kein Cloud-/Kundendatenzugriff, kein Merge oder Deployment. `productionApproved=false`; **Production BLOCKED/NO-GO**.


## Nachtrag 01.11.2026 — Gemeinsame P0-/Didit-Prüfung bestanden; P95-Metrikreferenz korrigiert

Der integrierte [Draft #296](https://github.com/Veselin-Takev/Klar-Dating/pull/296), Commit `4e8a8481a0c4b9a369b72d7bd2739e8a28cb5c96`, hat die vollständige [CI #41356725824](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41356725824) **bestanden**. Das Originalprotokoll bestätigt 1.491 erfolgreiche Vitest-Tests in 201 Dateien, 18 Didit-Profilstatus-Tests, fünf echte native Storage-, sechs Tenant-Firestore- und sechs Retention-Firestore-Emulatorprüfungen, die absichtliche Negativprüfung ohne Emulator, Production Smoke und 26 Browser-Acceptance-Tests. Auch der vorherige Governance-Commit `5af9028c8e08cd6b0a61c16e2050e469c66f1317` hat [CI #41356862508](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41356862508) erfolgreich absolviert. Das begründet **keine Produktivfreigabe**.

Neu wurde eine konkrete Inkonsistenz bei P1 #71 festgestellt: Die kanonische P95-Policy bezog sich auf eine nicht vorhandene Metrik `klar_http_latency_ms`, obwohl der Server `klar_http_request_duration_ms{quantile="0.95"}` ausgibt. Ein neuer gestapelter [Draft #297](https://github.com/Veselin-Takev/Klar-Dating/pull/297), Commit `7b059d0b28b38ca0e0d12bfc93d070ae63bb07f7`, vereinheitlicht die Namensreferenz und verschärft den obligatorischen Regressionstest. Die vorhandene 300-ms-Schwelle und die positiven Grenztests bleiben unangetastet; [CI #41357839577](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41357839577) war bei Erfassung **noch aktiv**. Der aktuelle In-Process-Gauge ersetzt keine 30-Tage-Messung über mehrere Instanzen und kein SRE-genehmigtes Alarmkonzept.

P0 #202 und #254 bleiben offen: keine reale signierte Cloud-/Art.-17-/IAM-/Admin-SDK-/GCS-Quittungs- und Mandantenschutzfreigabe, keine nachgewiesene dauerhafte >300-Löschverarbeitung, keine genehmigte Medien-Sichtbarkeit und keine unabhängigen Security-/DPO-/Legal-/SRE-/ReleaseOwner-Unterschriften. Kein Merge, Deployment oder Kundendatenzugriff. `productionApproved=false`, **Production BLOCKED/NO-GO**.


## Nachtrag 01.11.2026 — P95-Abgleich CI-bestanden; GCS-Generation im P0-Löschprototyp begrenzt

Der gestapelte [Draft #297](https://github.com/Veselin-Takev/Klar-Dating/pull/297), exakter Commit `7b059d0b28b38ca0e0d12bfc93d070ae63bb07f7`, hat [CI #41357839577](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41357839577) **bestanden**. Das SLO-Regelwerk verweist nun auf die tatsächlich veröffentlichte P95-Prometheus-Metrik, weiterhin mit **300 ms** Sollwert. Ebenso hat die bisherige Dokumentationsversion `e089cc6a208a4d8da1c4eb7b0467982cded67efe` [CI #41357982476](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41357982476) **bestanden**. Eine echte 30-Tage-P95-Messung über mehrere Instanzen und genehmigte Pager-Alerts sind damit noch nicht belegt.

Bei der weiteren P0-202-Prüfung wurde ein zusätzlicher Quellcode-Befund gefunden: Im **noch nicht produktiv angeschlossenen** Retention-Zustandsmodell waren unendlich lange positive Dezimalzahlen als GCS-Generation zulässig. Der neue [Draft #298](https://github.com/Veselin-Takev/Klar-Dating/pull/298), Head `a426ca2174ee071ce591342555b3ffb8ec682c74`, akzeptiert nur kanonische positive 64-Bit-Generationsstrings und prüft das schon vor einer Firestore-Transaktion. Zusätzliche reine Tests, vier native Firestore-Emulator-Negativfälle und CI-Mutationsgates verhindern ein unbemerktes Entfernen dieser Schranke. **[CI #41359081792](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41359081792) war beim Nachtrag noch aktiv**. Keine Aktivierung physischer Löschungen, kein Scheduler-/IAM-/Produktivdatenzugriff.

Die produktive GCS-Löschkette mit Legal-Holds, 404/412-, Crash- und revisionsfesten Belegen, die dauerhafte Verarbeitung von über 300 Fällen, die echte Mandanten- und Art.-17-Migration sowie die unabhängigen Security-/DPO-/Legal-/SRE-/ReleaseOwner-Freigaben bleiben ausdrücklich ausstehend. `productionApproved=false`, **Production BLOCKED / NO-GO**, kein Merge oder Deployment.


## Nachtrag 01.11.2026 — GCS-Generation CI-bestanden, Quittungsintegrität zusätzlich abgesichert

Der ungemergte [Draft #298](https://github.com/Veselin-Takev/Klar-Dating/pull/298), Commit `a426ca2174ee071ce591342555b3ffb8ec682c74`, hat [CI #41359081792](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41359081792) vollständig **bestanden**: 1.497 Vitest-Tests, 20 reine Retention-Zustandstests, zehn native Retention-Firestore-Tests, die negative Emulatorprüfung, Production-Smoke und 26 Browser-Tests. Auch der vorherige Governance-Commit `c1a42ce83d80b82d2edd09fa436be184741f0aba` hat [CI #41359214269](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41359214269) **bestanden**. Die bestandenen Tests gelten jeweils nur für die geprüften Commits.

Zusätzlich wurde die **Quittungsintegrität** des weiterhin inerten P0-202-Löschmodells auf einen belegbaren Quellbefund geprüft. Ein synthetisch manipulierter gespeicherter GCS-Intent mit einer ungültigen Generation konnte zuvor wegen bloßer Zeichenkettengleichheit als passende Löschbeobachtung fortschreiten. [Draft #299](https://github.com/Veselin-Takev/Klar-Dating/pull/299), Head `277d9e4150a01799f49358e9193c291199f02638`, verlangt nun gültige und übereinstimmende 64-Bit-GCS-Generationen für Beobachtung, Quittungs-Wiederaufnahme, Abschluss und Firestore-Transaktionsübergänge; neue Negativ- und Mutationstests prüfen dies. [CI #41360321213](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41360321213) war zum Zeitpunkt der Dokumentation **noch aktiv**. Es werden weder echte GCS-Objekte gelöscht noch produktive Scheduler/IAM geändert.

Die rechtssichere produktive P0-202-Löschkette mit Legal Holds, 404/412-/Crash-Belegen und nachgewiesener >300-Queue, das P0-254-Mandanten-/Art.-17-Cutover, die signierte Profilmedien-Entscheidung und unabhängige Security-/DPO-/Legal-/SRE-/ReleaseOwner-Freigaben sind weiterhin **offen**. `productionApproved=false`, **Production BLOCKED/NO-GO**, kein Merge, Deployment oder Kundendatenzugriff.


## Nachtrag 01.11.2026 — Sicherheits-Testlücke in #299 erkannt und behoben

Die erste CI für den Quittungsintegritäts-Fix #299 (`277d9e4150a01799f49358e9193c291199f02638`) ist [#41360321213](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41360321213) **fehlgeschlagen**. Ein echter Mutationstest zeigte, dass die statische Quellenprüfung das Entfernen *einer von zwei* notwendigen Quittungs-Schranken übersehen konnte. Der Guard wurde deshalb auf das Vorhandensein **beider** Schranken verschärft, nicht deaktiviert. Neuer Commit `8f845a91c30255996444293bd4a754dfca6c8d52`, [CI #41360551340](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41360551340) zum Erfassungszeitpunkt **noch nicht vollständig bestanden**. Keine reale GCS-Löschung, keine produktive IAM-/Scheduler-Änderung. P0 #202/#254 und Freigaben weiterhin BLOCKED, `productionApproved=false`, NO-GO.


## Nachtrag 01.11.2026 — Zweiter CI-Befund #299 behoben

Nach der ersten Korrektur der Mutationstest-Abdeckung fiel [CI #41360551340](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41360551340) für den Quittungsintegritäts-Draft #299 an sechs **TypeScript-Fehlern TS18048** aus: Der Prüfer garantierte zur Laufzeit gültige Quittungsfelder, gab diese Zusicherung aber nicht als Typverengung an den Compiler weiter. Das wurde mit einem **Typschutz-Prädikat** und einer zusätzlichen kanonischen Prüfung der gespeicherten Firestore-Generation behoben; Sicherheitsprüfungen bleiben vollständig erhalten. Neuer Commit `453e40cf0037e9bd0a5484fa56e24d98a47918ce`, neue [CI #41360832251](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41360832251) **noch ohne Gesamt-PASS** beim Nachtrag. Beide vorigen #299-Läufe sind ausdrücklich fehlgeschlagen. Die produktive GCS-Löschkette und Tenant-/Art.-17-Freigaben bleiben P0 BLOCKED, kein Merge/Deployment/Kundendatenzugriff, `productionApproved=false`, NO-GO.


## Nachtrag 02.11.2026 — P0-Quittungs-CI erfolgreich, erneute Löscharbeit bei widersprüchlichen Altmarkern gesperrt

[Draft #299](https://github.com/Veselin-Takev/Klar-Dating/pull/299) auf `453e40cf0037e9bd0a5484fa56e24d98a47918ce` hat [CI #41360832251](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41360832251) **vollständig bestanden**: 1.499 Vitest-Tests, 22 reine Retention-Zustandstests, zehn native Retention-Firestore-Emulatorfälle, Production Smoke und 26 Browser-Tests. Die vorangegangenen zwei fehlgeschlagenen CI-Läufe bleiben ausdrücklich protokolliert. Der bisherige Governance-Dokumentationsstand `67497670a9fae73adb2440c329ecf5ece26a3353` hat [CI #41360973285](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41360973285) ebenfalls bestanden.

Ein weiterer Quellbefund bei P0 #202: Der weiterhin **nicht produktiv angebundene** Retention-Zustandsautomat konnte einen synthetisch beschädigten `ready`-/`leased`-Datensatz mit altem Quittungs-Digest, Abschlussdatum oder Quarantänemarker als neue Arbeit behandeln. [Draft #300](https://github.com/Veselin-Takev/Klar-Dating/pull/300), initialer SHA `8037801d8abd51ed6bcc152ad230106f8cefba73`, sperrt diese Kombinationen und prüft sie mit zusätzlichen reinen und nativen Firestore-Tests. Die normale Wiederaufnahme nie gelöschter Aufgaben bleibt erlaubt. **Die neue exakte CI für #300 ist noch nicht bestätigt**. Kein physischer GCS-Delete, keine neue IAM-/Scheduler-Regel, keine Änderungen an Produktionsdaten.

Reale gesetzeskonforme biometrische GCS-Löschbelege, >300 dauerhaft verarbeitete Aufträge, Tenant-/Admin-SDK-/Art.-17-Cutover und unabhängig unterschriebene Security-/DPO-/Legal-/SRE-/ReleaseOwner-Entscheidungen bleiben ausstehend. `productionApproved=false`, **Production BLOCKED / NO-GO**.


## Nachtrag 02.11.2026 — Vollständiger #300 CI-PASS; lokale Projektidentität bei Retention-Inventur gehärtet

Der ungemergte [Draft #300](https://github.com/Veselin-Takev/Klar-Dating/pull/300), SHA `8037801d8abd51ed6bcc152ad230106f8cefba73`, hat [CI #41413739405](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41413739405) vollständig **bestanden**, einschließlich 1.507 Vitest-Tests, 24 reiner Retention-Zustandsprüfungen, **16 nativer Retention-Firestore-Emulatorfälle**, Negativprüfung ohne Emulator, Production Smoke und 26 Browser-Tests. Der vorherige Governance-Dokumentationsstand `4c13d62593f17188a4271af975cab424039c1e2d` hat [CI #41413945305](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41413945305) ebenfalls **bestanden**.

Bei der lokalen, nur lesenden Retention-Inventur zeigte die Quellenanalyse eine Maskierung widersprüchlicher Umgebungsvariablen: `GCLOUD_PROJECT=demo-klar` überdeckte bislang einen möglichen zweiten Wert `GOOGLE_CLOUD_PROJECT=real-customer-prod`. Die Emulator- und Loopbackpflicht bestanden bereits, daher liegt **kein belegter Produktivzugriff** vor. Der neue [Draft #301](https://github.com/Veselin-Takev/Klar-Dating/pull/301), SHA `4df133e2c0cf03e01dd2d726979adeee8f4615ed`, verlangt nun für jede gesetzte Projektvariable exakt `demo-klar`; vier Negativtests belegen die Abweisung widersprüchlicher oder abweichender Identitäten ohne Datenzugriff. Vollständige [CI #41415425785](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41415425785) zum Zeitpunkt der Dokumentation **noch aktiv**. Es gab keinen Cloud-, Scheduler-, IAM- oder Kundendaten-Eingriff.

Die produktiven P0-202-GCS-Entscheidungs-/Hold-/404/412-/Crash-Belege und >300 langlebige Löschjobs, P0-254-Tenant-/Art.-17-/Admin-SDK-Migration, signierte Gast-/Alters-/Medienentscheidung und unabhängige Security-/DPO-/Legal-/SRE-/Release-Owner-Freigaben bleiben offen. `productionApproved=false`, **Production BLOCKED/NO-GO**, keine Merges oder Deployments.
