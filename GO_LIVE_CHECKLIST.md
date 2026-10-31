# Klar Dating App - Go-Live Checkliste & Status-Report

## Freigabe-Nachtrag vom 31.10.2026 — BLOCKED / NO-GO

Dieser Abschnitt ergänzt den historischen Status vom 10.10.2026. **Die frühere RC-/Branch-Angabe bleibt Historie**, keine Behauptung über den aktuellen Freigabe-Branch. Aktueller überprüfter PR-Basestand: `main` SHA `2808dc1cbb485f70b403681c108cea5a3361d950`; danach erfolgte hier keine unabhängige Produktionsevidenzprüfung. Verbindliche Issue-/PR-Abhängigkeiten: [Release-Blocker-Karte](phase2_work/docs/RELEASE_BLOCKER_DEPENDENCY_MAP_2026-10-31.md) in [Draft #249](https://github.com/Veselin-Takev/Klar-Dating/pull/249), **noch nicht in `main` integriert**.

**P0-/P1-Release-Blocker (keine Freigabe):**
- [ ] [#202](https://github.com/Veselin-Takev/Klar-Dating/issues/202) biometrische Entscheidungs-Retention, vollständiger Admin-/Scheduler-/All-Writer-Audit, Storage Holds, Reconciliation und echtes Staging; P0-Änderungen u. a. in [gestapeltem Draft #243](https://github.com/Veselin-Takev/Klar-Dating/pull/243).
- [ ] [#55](https://github.com/Veselin-Takev/Klar-Dating/issues/55) B2B-Webhooks: authentische Käufer-/Bestellzuordnung und Fraud/Refund statt bloßer HMAC-Behauptung; Drafts [#246](https://github.com/Veselin-Takev/Klar-Dating/pull/246) → [#247](https://github.com/Veselin-Takev/Klar-Dating/pull/247).
- [ ] [#56](https://github.com/Veselin-Takev/Klar-Dating/issues/56) B2B-Tracking/Datenschutz: Consent, DPA/Vertragsgrundlage, Datenverzeichnis, TTL, Art. 17 und Freigabe durch Datenschutz/Legal.
- [ ] [#48](https://github.com/Veselin-Takev/Klar-Dating/issues/48) Member Referral: Anti-Abuse, DIDIT-KYC/UID-Bindung, zulässige Klar+-Zeiträume und idempotente/rückabwickelbare Rewards, getrennt vom B2B-Flow.
- [ ] [#70](https://github.com/Veselin-Takev/Klar-Dating/issues/70) echte Firestore-TTL-ACTIVE-Provisionierungsbelege je Umgebung, genehmigte Legal-Hold-Retention-Matrix und Art.-17-Verhalten. Das aktuelle `phase2_work/scripts/configure-retention.sh` plant **20** Collection-Groups und beschränkt Mutationen auf bestätigtes Staging; der ursprünglich gemeldete Vier-Gruppen-Codebefund ist in dieser `main`-Quelle bereits überholt, die **Produktionsbelege fehlen weiterhin**.
- [ ] [#204](https://github.com/Veselin-Takev/Klar-Dating/issues/204)/[#206](https://github.com/Veselin-Takev/Klar-Dating/issues/206) profilbildbezogene Zugriffe: Storage-Alters-Gate, Block-/Erasure-Policy und **Widerruf alter Bearer-Downloadlinks**; CI allein beweist keinen Cloud-Regel- oder Token-Rollout.
- [ ] [#8](https://github.com/Veselin-Takev/Klar-Dating/issues/8) formale Produktionskontrollen: Cloud Run/Secret Manager/IAM, Alarmzustellung/On-Call, OTLP/P95, Backup/Restore, Canary/Rollback, unveränderliche Herkunfts-/Log-Evidenz, unabhängige AppSec/DPO/SRE/Finance-/Release-Owner-Zustimmung.

**Beobachtete GitHub-Workflow-Metadaten** (nur PR-Head, kein integrativer Production-GO-Nachweis): Enterprise CI [#243](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41191871749), [#247](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41195934570) und [#248](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41204001572) waren `completed/success`; [#249](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41205869303) wurde bei Abfrage noch als `in_progress` ausgewiesen. Artefakte/Job-Logs, Staging und externes Approval wurden nicht vollständig geprüft; dieser Dokumentationsnachtrag verändert den Head-SHA und benötigt eigene erneute CI-Prüfung.

**Freigabeentscheidung:** `BLOCKED / NO-GO`. Kein direktes `main`-Update, kein Merge/Deployment, keine Cloud-/Datenmutation; Referenzen zu gestapelten Drafts sind **keine** Integrationsfreigabe.

---

## Aktueller Release-Status (10.10.2026) – NO-GO

**Entwicklungsbranch:** `ci/optimize-llm-evaluation-frozen-install-2026-10-10`. Der eingefrorene Release-Kandidat `release/candidate-preflight-2026-10-10-r2` darf nicht verändert, automatisch veröffentlicht oder ohne ausdrückliche technische und operative Freigabe gemergt werden. Die historische Statusbeschreibung vom 08.09.2026 weiter unten ersetzt **keinen** aktuellen Go-Live-Nachweis.

**P0 Cloud Run/Secret Manager – Quellcodekorrektur, keine Produktionsfreigabe:** Der read-only Audit ermittelt die tatsächlichen Secret-Manager-Ressourcen über Cloud-Run-`run.googleapis.com/secrets`-Aliasse, statt IAM-Abfragen ungeprüft auf Variablennamen zu richten. Mehrdeutige doppelte Secret-Umgebungsvariablen, ungültige Aliasse und rein bedingte IAM-Bindings führen fail-closed zum fehlenden Freigabenachweis. Erforderliche Monitoring-Policies müssen einen ausdrücklich verifizierten Benachrichtigungskanal referenzieren. Siehe `phase2_work/docs/PRODUCTION_CONTROLS_AUDIT.md` und `phase2_work/docs/FINAL_RELEASE_VERIFICATION_2026-10-10.md`.

**Offene Produktionsnachweise (nicht abgehakt):**

- [ ] Vollständige Enterprise-Pipeline auf exakt geprüftem Commit mit Node 22.23.3, Bun 1.4.2, Java 21, TypeScript, Firebase-Emulator, Playwright und Security-Gates.
- [ ] Cloud Run/Secret-Manager-Read-only-Audit mit echten Projekt-Zugangsdaten und exakt verifizierter Build-SHA; private externe unveränderliche Auditdatei im freigegebenen Evidence-Speicher.
- [ ] Tatsächliche Secret-Rotation, Produktions-Smoketest und Rechte-Nachweis am *referenzierten* Secret; menschliche Least-Privilege-Freigabe insbesondere bei projektübergreifenden oder bedingten IAM-Bindings.
- [ ] Produktiver Test der Alarmzustellung, verifizierter Zielkanal, On-Call-Empfang/Acknowledgement, Monitoring-/OTLP-/P95-Kontrollen mit datenschutzkonformer Evidenz.
- [ ] Finale Risikoentscheidung, Rollback-/Canary-Plan, Schutzregeln und explizite Zustimmung der verantwortlichen Personen.

**Entscheidung:** **NO-GO** bis alle erforderlichen technischen und operativen Freigaben mit echter Evidenz dokumentiert sind. Lokale isolierte Regressionstests sind dafür kein Ersatz.

---


## 1. Status-Report (08.09.2026)

### Aktueller Entwicklungsstand
Die Klar Dating App ("Weniger Swipes. Mehr echte Gespräche.") hat wesentliche Entwicklungsmeilensteine erreicht.
Die App ist als Single-Page Application (React/Vite) mit einem Express-Backend und Firebase-Infrastruktur konzipiert.

**Abgeschlossene Features & Verbesserungen:**
- **Authentifizierung & Sicherheit:** Firebase Auth ist integriert. Server-seitiges Rate-Limiting und strenge CSP-Header (Helmet) sind aktiv.
- **Offline & Synchronisierung:** Ein Sync-Indikator in der Systemleiste zeigt den letzten erfolgreichen Abgleich mit Firestore an (`useFirestoreSyncTime`).
- **Barrierefreiheit & i18n:** `react-i18next` ist implementiert (Deutsch, Englisch, Spanisch, Französisch). Das `<html> lang`-Attribut wird dynamisch synchronisiert. Die Sprachenauswahl ist persistent.
- **Routing & Rendering-Stabilität:** `AnimatedRoutes` wurde refaktorisiert. Die `Suspense`-Knoten sind nun innerhalb von `AnimatePresence` so gekapselt, dass CSS-Konflikte (`opacity: 0`) den Fallback-Lader (`Ladepunkt`) nicht unterdrücken. Ein `ErrorBoundary` umgibt alle dynamischen `lazy`-Importe, um Netzwerkfehler (wie z. B. 429 Too Many Requests bei langsamen Verbindungen) abzufangen.
- **Profil & Verifizierung:** Die Verifizierungsstufen ('Basic', 'Verified', 'Fully Verified') sind als visuelle Badges im Profil implementiert.
- **Preview/Entwicklungsumgebung:** Das 429-Too-Many-Requests-Problem der Preview-Umgebung wurde durch Anpassungen des Build-Prozesses behoben (Pre-Bundling für die Preview).

### Offene Punkte (Known Issues)
- **Umgebungsvariablen:** Für die finale Produktionsumgebung müssen die Firebase- und Sentry-Schlüssel im Ziel-Host hinterlegt werden.
- **App-Store Compliance:** Bestimmte Apple/Google-Richtlinien (z. B. Account-Löschung aus der App heraus) sind implementiert, müssen aber im Review-Prozess validiert werden.

---

## 2. Go-Live Checkliste

### Phase 1: Security & Compliance Audit
- [ ] **Firestore Security Rules:** Überprüfen, ob `firestore.rules` im Emulator alle Tests bestehen ( `npm run test:rules`).
- [ ] **DSGVO & Rechtstexte:** Verifizierung des Einwilligungs-Gates für neue Nutzer und Verfügbarkeit von AGB/Datenschutzrichtlinien ohne aktiven Account (Art. 13 DSGVO).
- [ ] **Rate-Limiting & Abuse Prevention:** Bestätigung der Schwellenwerte im `apiLimiter` (aktuell 5000/15min) für die Produktion. Anpassung auf reale Lastanforderungen.
- [ ] **Content Security Policy (CSP):** Finale Prüfung der erlaubten externen Quellen (z.B. Google Fonts, Firebase Auth Domains) in `server.ts`.

### Phase 2: Performance & QA
- [ ] **Lazy Loading & Code Splitting:** Verifizieren, dass die `lazy`-Imports reibungslos laden und der `Ladepunkt` bei schwachen Verbindungen (3G-Drosselung in DevTools) sichtbar ist.
- [ ] **Offline-Fähigkeit:** Testen der App im Offline-Modus. Werden kritische Daten aus dem LocalStorage gelesen und der Fehler-Status korrekt im UI angezeigt?
- [ ] **Multisprachigkeit (i18n):** Durchklicken der Kern-Screens in allen verfügbaren Sprachen (DE, EN, ES, FR), um auf abgeschnittenen Text oder Layout-Verschiebungen zu prüfen.
- [ ] **Animationen:** Überprüfung, ob `AnimatePresence` saubere Ein- und Ausblendungen für alle Hauptrouten garantiert (kein "Pop-in").

### Phase 3: Infrastruktur & Deployment
- [ ] **Environment Variables:** Erstellen einer `.env.production` basierend auf `.env.example` und Einpflegen der Live-Keys in die Cloud-Umgebung (z.B. Cloud Run).
- [ ] **Build-Prozess:** Ausführen von `npm run build` und `npm run groesse`, um sicherzustellen, dass das Bundle optimiert und fehlerfrei ist.
- [ ] **Logs & Monitoring:** Sentry-Initialisierung aktivieren. Überprüfen, ob Error-Boundaries relevante Fehler an Sentry weiterleiten, ohne sensible Nutzerdaten (PII) zu übermitteln.

### Phase 4: Launch
- [ ] **Soft-Launch (Beta):** Freigabe an eine geschlossene Gruppe.
- [ ] **Wartungsmodus:** Verifizieren, dass der Wartungsmodus über das Firestore-Dokument `config/maintenance` in Echtzeit (ohne Neuladen) gesteuert werden kann.
- [ ] **Marketing & App-Store:** Bereitstellung von Screenshots und Metadaten für den Release.
