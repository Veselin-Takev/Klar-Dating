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


### 2026-10-19 — GO-Behauptung aus externem PDF nicht freigegeben (P0 Release-Governance)

**Aktueller Status: NO-GO.** GitHub belegt weiterhin 15 offene Issues und ungemergte Draft-PR #119. Die externe PDF mit "GO / 0 Issues / alle Tests PASS" ist **keine** gültige Build-, Emulator-, Rechts- oder CI-Attestation. Das enthaltene Beispiel `referralRef.delete()` löscht Firestore-Subcollections nicht; die pauschale 30-Tage-Partner-Referral-Löschung ist ohne genehmigte Retention-/Legal-Hold-Matrix unzulässig als automatische Produktionsfreigabe.

Die bisherige Produktionsfreigabeprüfung akzeptierte nur `KLAR_PRODUCTION_RELEASE_APPROVED=true`, selbst während `RELEASE_MANIFEST.json` noch NO-GO meldete. Sie wurde fail-closed um Manifest, vollständige Go-Live-Checkliste, 14 commitgebundene Gate-Belege, 13 Compliance/Emulator/TTL-Belege, sauberes Critical/High-SCA und unabhängige Security/DPO/Legal/SRE-Freigaben erweitert. Positive synthetische Tests belegen lediglich das Prüfungsschema, nicht die Echtheit einer externen Signatur. CI und produktiver Release bleiben bis zu echten Nachweisen gesperrt. ADR/Belege: `docs/ADR_RELEASE_GO_EVIDENCE_2026-10-19.md`, `docs/GO_CLAIM_AUDIT_2026-10-19.md`.


### 2026-10-19 — Reproduzierbare Release-Guard-Validierung, weiterhin NO-GO

Unter SHA-256-verifiziertem Node v22.23.3 wurden **45** fail-closed Release-Evidenztests und die Release-Workflow-Quellprüfung erfolgreich ausgeführt. Das reale `check-production-release-approval.mjs` verweigert bei gesetztem Test-Flag `KLAR_PRODUCTION_RELEASE_APPROVED=true` weiterhin die Produktion, solange das GitHub-Manifest NO-GO und fehlende echte Gate-Evidenz meldet. Dies ist das **korrekte erwartete Scheitern**, nicht eine fehlgeschlagene Regression. Der vollständige 14-Gate-Testdurchlauf meldete **5 PASS / 9 FAIL oder blockiert**: Enterprise/TypeScript-Modul fehlt; Root-npm-audit=ENOLOCK wegen Bun-only; Gitleaks/Semgrep fehlen; tsc/Vitest/firebase-tools/Playwright/Vite nicht vorhanden. **Kein GO, keine geschlossene Issue-Liste, keine unabhängigen Legal/DPO/Security/SRE-Signoffs.**

Der unveränderte `bun.lock` darf nicht durch `npm ci` oder ein neues npm-Lockfile umgangen werden. Umfassende Sicherheits- und Integrationsbelege bleiben Pflicht. Weitere Details in `docs/GO_CLAIM_AUDIT_2026-10-19.md`.


### 2026-10-19 — GO checklist parser fail-closed security regression

The production release evidence checker formerly accepted an **empty** or title-only checklist and failed to recognize unchecked GitHub Flavored Markdown tasks using `*`, `+`, ordered numeric markers or extra whitespace. The checker now requires at least one task and rejects all unchecked or malformed task markers (`[-*+]`, `1.`, `2)` syntax). **55** synthetic structure/negative Node22 release-evidence regressions PASS; separate TTL, Art.17, emulator profile, CODEOWNERS and workflow source gates PASS. The real release approval checker still rejects the actual `NO-GO` manifest even when `KLAR_PRODUCTION_RELEASE_APPROVED=true` is provided in a negative test.

**Compliance scope:** structural validation is not authentic signed CI evidence; actual Firestore Emulator transactions, live 20-group TTL and legal-hold approvals, full security scanning and independent Security/DPO/Legal/SRE signoff remain unverified. Preserve **NO-GO** and open Issues. ADR: `docs/ADR_GO_CHECKLIST_TASK_PARSER_2026-10-19.md`.


#### Lokaler Mandatory-Gate-Lauf (19.10.2026, Node v22.23.3, SHA-256-verifiziert)

**5/14 PASS; 9/14 FAIL oder nicht ausführbar.** PASS: `check-secrets.mjs`, `check-auth-boundary.mjs`, `check-public-firestore-rules.mjs`, `check-ai-pii-sanitizer.mjs` und `check-art17-deletion-audit.mjs 0`. FAIL/BLOCKIERT: `npm run check:enterprise` (TypeScript-Modul nicht installiert), Root-`npm audit --audit-level=high` (kein npm-Lockfile, Bun-only Root), Gitleaks und Semgrep (ohne installierte lokale Executables, kein Auto-Download), TypeScript, Vitest, Firebase Rules (`firebase-tools` fehlt), Playwright (nicht installiert), Build (`vite` fehlt). Dieses Ergebnis belegt **keinen vollständigen** Supply-Chain-/SAST-/Emulator-/Browser-Test; produktive Security/DPO/Legal/SRE-Abnahmen fehlen. Der Release-Status bleibt **NO-GO**. Der Checkout enthält nur den isolierten Arbeitsstand; keine produktive Cloud-Anpassung wurde vorgenommen.
