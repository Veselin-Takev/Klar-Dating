# Klar — Operational Hardening, PR #360 — 2026-11-09

**1.714 Hauptsuite-Tests PASS. Freigabebündel vorbereitet; Produktion NO-GO und PR Draft bis zu den fehlenden Betriebsnachweisen und manuellen Freigaben.**

Neu: steuerbares Auth-Session-Migrationsskript mit Trockenlauf als Standard, festem Stichtag, Scope-gebundenem 0600-Checkpoint, wiederaufnehmbarer Pagination und bestätigtem Provider-Widerruf. Der native CLI-Trockenlauf gegen synthetische Auth-Emulator-Konten verändert keine Auth-Daten; Apply und idempotente Wiederholung wurden ebenfalls verifiziert. Ein produktiver Trockenlauf oder Widerruf wurde nicht ausgeführt.

Aktuell lokal: **1.599 Vitest / 213 Dateien + 86 Enterprise Node + 29 Chromium-E2E = 1.714 PASS**. Die 22 neuen operativen Tests sind enthalten. Enterprise-Gates, Typecheck und beide Builds PASS; Semgrep 616 Regeln / 1.183 Ziele, 0 Findings/Parserfehler, 700/700 eigene Runtime-Dateien abgedeckt. Die vollständige CI am neuen exakten PR-Head bleibt die maßgebliche Abschlussprüfung.

Projekt-ID vom Nutzer bestätigt: `klar-admin`. GCP-Identität, freigegebene Cloud-Run-Service-/Regions-/Bucket-Zuordnung und Live-IAM-/Terraform-State-Nachweise fehlen weiterhin. Der Collector erfasst lesend aktive Revisionen und geerbte Policies; das IAM-Statusartefakt weist **UNVERIFIED** aus und enthält ausschließlich den belegbaren Terraform-Sollzustand.

Zielstatus nach Schließung aller Evidenz-Gates: **READY FOR LEGAL & TECH SIGN-OFF**. Aktuell **BLOCKED_MISSING_PRODUCTION_EVIDENCE**; `productionApproved=false`. Keine Behauptung eines Live-Exports, einer produktiven Gesamtmigration oder rechtlichen Zertifizierung. Frühere Betriebs-/Datenschutz-Gates bleiben offen.

[Dual-Sign-Off-Bündel](docs/security/DUAL_SIGN_OFF_READY.md) · [Prüfevidenz](docs/security/OPERATIONAL_VERIFICATION.json) · [IAM-Evidenzstatus](docs/security/live-iam-evidence.json).

---

## Historischer Stand vor diesem Operations-Arbeitspaket

# Klar — PR #360 System-Remediation, v0.1.1-rc1

**Code-Remediation und Regressionen verifiziert: 1.692 PASS. Produktion NO-GO. PR #360 bleibt Draft.**

Verifizierter Runtime-Commit: `f13c736781daaa333040df5a67c1b0ff7b002c6d`. [Vollständige Enterprise-CI: SUCCESS](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42532259296). **1.577 Vitest / 211 Dateien + 86 Enterprise Node + 29 Chromium-E2E = 1.692 Hauptsuite-Tests.** Die enthaltenen 79 Audit-Tests, der zusätzliche native 116er-Lauf, 118 wiederholte Rules-Tests und sechs wiederholte Launch-Tests werden nicht doppelt addiert.

Implementiert: authentisierte Medienauslieferung mit Streaming und begrenztem Upload-Speicher; Widerruf statischer Capabilities; dauerhafte DSA-/Legacy-Fences und unabhängig wiederholter Auth-/Medien-Widerruf; transaktionale Legal-Hold-Prüfung; wiederaufnehmbare Bild-Purges mit expliziter Provenienz; zentrale Logging-Allowlist und gemeinsame Firestore-Quoten mit begrenzter Serialisierung.

Semgrep: 616 Regeln, 1.176 Ziele, 0 Findings/Parserfehler; 698/698 eigene Runtime-Dateien abgedeckt. Enterprise-Gates, Typechecks, beide Builds, Produktions-Smoke und Produktions-High/Critical-Advisory-Gate PASS. `re2js` bleibt 2.8.7; vier Moderate/ein Low liegen unter der High-Schwelle.

**Die Produktions-Gates bleiben offen:** Alt-Capabilities und Altsperren sind nicht produktiv inventarisiert/migriert. Effektive IAM-/Edge-/Logging-/Retention-Policies, All-Writer-/Hold-Races, freigegebene Purge-Nachweise, Queue-Eskalation und erreichbare Beschwerde-/DSAR-Kanäle gesperrter Personen sind nicht unabhängig attestiert. Verifikationsbilder ohne freigegebene kontobezogene Nachweise bleiben gesperrt. `productionApproved=false`; kein Merge, Deployment, IAM-Apply oder finales Sign-Off.

[Implementierung und Betriebs-Gates](phase2_work/docs/security/SYSTEM_REMEDIATION_2026-11-08.md) · [Maschinenlesbare Evidenz](phase2_work/docs/security/SYSTEM_REMEDIATION_EVIDENCE.json).

Die historische Wave-3-Quellcode-Baseline und ihre ursprünglichen Grenzen bleiben im [Zertifizierungsbericht](phase2_work/docs/security/MIGRATION_WAVE3_CERTIFICATION.md) dokumentiert. Neue Status-/Evidenz-Metadaten ändern den genannten geprüften Runtime-Code nicht.
