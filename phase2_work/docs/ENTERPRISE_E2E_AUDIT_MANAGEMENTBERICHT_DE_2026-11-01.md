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
