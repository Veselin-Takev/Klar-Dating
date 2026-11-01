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
