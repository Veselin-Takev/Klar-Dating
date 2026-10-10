# Klar Dating App - Go-Live Checkliste & Status-Report

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


---

## 3. Evidenzbasierte Release-Verifikation (10.10.2026)

**Entscheidung: NO-GO / Freigabe ausstehend.** Referenz-Commit auf `main`: `3f0fc4b70551e1d580040e9dd7722931fe87e83d`. Der [CI-Lauf 38036361126](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/38036361126) ist erfolgreich (Static Gates, Typecheck, Functions Build, Tests, Build, Production Smoke und Browser Acceptance). Die Tests belegen **keine** fertig konfigurierte Live-Umgebung. Die Checkboxen oben bleiben unverändert, bis der einzelne Prüfpunkt mit belastbarer Evidenz bestätigt wurde.

### Produktionskontrollen – verbindliche Abnahme

- [ ] Im realen Produktionsprojekt den read-only Audit `npm run audit:production-controls` mit `KLAR_PROJECT_ID`, `KLAR_REGION`, `KLAR_SERVICE`, `KLAR_EXPECTED_SERVICE_ACCOUNT`, `KLAR_REQUIRED_SECRETS` und `KLAR_REQUIRED_ALERT_POLICIES` durchführen. `production-evidence/controls.json` mit Commit-SHA und Zeitbezug revisionssicher außerhalb des öffentlichen Repositories ablegen.
- [ ] Cloud Run Service Account, Least Privilege, referenzierte Secret-Manager-Secrets und effektive IAM-Policies manuell bestätigen. Kein Klartext-Geheimnis in Commits oder Audit-Ausgaben.
- [ ] Secret-Rotation tatsächlich erproben; neue Version vom Workload beobachtet, Smoke-Test erfolgreich, alte Version deaktiviert. `docs/operational-control-evidence.template.json` verwenden und `npx tsx scripts/validate-operational-control-evidence.ts path/to/evidence.json <exact-40-char-build-sha>` ausführen.
- [ ] Cloud Monitoring: erforderliche aktivierte Policies, verifizierte Empfänger, zugestellte Testalarmierung und On-Call-Bestätigung belegen.
- [ ] OTLP-Export und Dashboard-Ingestion (HTTP-P95, Fehlerquote, Gemini-Tokens, Firestore-Transaktionen) am produktiven Dienst messen. Authentifizierung von `/api/metrics`, PII-Redaktion und Sentry-Consent überprüfen. Der statische `check:observability`-Gate allein genügt nicht.
- [ ] Staging-Lasttest und realer kontrollierter Canary-Betrieb mit dokumentierten SLOs; Rückrollfähigkeit anhand konkreter Revision verifizieren.

### Laufzeit-, Compliance- und Releasekontrollen

- [ ] Firestore-Regeltests `npm run test:rules`; Datenlöschung, Einwilligung, KYC, Vertragskündigung, CSP und Missbrauchsbegrenzung mit prüfbarer Test- und Reviewevidenz bestätigen.
- [ ] UX-Akzeptanz auf gedrosseltem Netz, Offline-Betrieb, vier Sprachen, Übergängen und Wartungsmodus dokumentieren.
- [ ] Produktions-Secrets im Cloud-Ziel validieren, `npm run build` und `npm run groesse` mit versionierter Bundle-Evidenz prüfen; niemals produktive Geheimnisse in `.env.production` committen.
- [ ] Beta-Freigabe, Store-Metadaten, Datenschutz-/AGB-Erreichbarkeit und Verantwortliche abzeichnen.
- [ ] Release nur vom exakten erfolgreichen `main`-SHA mit verifiziertem Artefakt und geschützter Produktionsumgebung genehmigen. `KLAR_PRODUCTION_RELEASE_APPROVED=true` erst nach ausdrücklicher menschlicher Freigabe setzen.

### Governance, Budget und Entscheidungsnachweis

- GitHub-Issue [#8](https://github.com/Veselin-Takev/Klar-Dating/issues/8) sammelt ausstehende Produktions-Evidenz.
- GitHub-Actions-Budget ab dieser Beauftragung: **maximal 100 zusätzliche verbrauchte Minuten**. Ohne verlässlichen Verbrauchsnachweis keine neue workflow-auslösende Aktion; bei Erreichen des Limits stoppen und vor weiteren 200 Minuten um ausdrückliche Genehmigung bitten. Dieses Dokumentations-Update löst keine Action auf `main` aus.
- Jede Abzeichnung erfordert **Prüfpunkt, exakten Build-SHA, Umgebung, UTC-Zeit, Prüfer, Ergebnis und dauerhaft zugängliche Evidenz**. `PASS` nicht aus implementierten Skripten ableiten. Unbekannt = `PENDING`, fehlgeschlagen = `FAIL`. Produktion bleibt `NO-GO`, solange ein verpflichtender Punkt `PENDING` oder `FAIL` ist.
