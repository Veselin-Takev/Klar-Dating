# Final Feature Hardening — Klar v149 — 7 October 2026

## Implemented

### 1. i18n
- Supported languages: DE / EN / ES / FR.
- `LanguageSwitcher` is mounted below `I18nextProvider` and `LanguagePreferenceProvider`.
- Local persistence uses the reviewed global `klar_language` preference through `userScopedStorage`.
- Authenticated preference is persisted via `/api/account/preferences`.
- `document.documentElement.lang` follows `i18next` on every language change.
- Cross-tab language changes are synchronized through the browser storage event.

### 2. Date-prep checklist
- No direct `localStorage` access remains in `src/screens/Tips.tsx` for the checklist.
- UID-owned IndexedDB queue stores pending checklist writes.
- The authenticated server endpoint reads/writes `users/{uid}/checklists/date_prep`.
- Server-side sanitization permits only the declared checklist keys and boolean values.
- Online recovery flushes the UID-specific queued write; Firestore remains the authoritative persisted source.

### 3. Identity verification
- Legacy manual verification endpoints return HTTP 410.
- Didit V3 webhook verification is raw-body/HMAC/timestamp protected.
- Provider event, application, workflow, environment, session and UID are bound before mutation.
- Duplicate events are idempotent.
- Deletion state blocks late writes.
- `isVerified` is only written by the server-side signed Didit KYC pipeline; Firestore rules prevent client introduction/change of that field.
- Reconciliation is bounded and signed, with a Firebase Scheduler every 15 minutes and a dedicated high-entropy secret.

## Verification

### PASS
- `node scripts/check-secrets.mjs`
- `node scripts/check-auth-boundary.mjs`
- `node scripts/check-public-firestore-rules.mjs`
- `node scripts/check-ai-pii-sanitizer.mjs`
- `node scripts/check-art17-deletion-audit.mjs 0`
- `node scripts/check-date-prep-checklist-boundary.mjs`
- `node scripts/check-isverified-authority.mjs`
- `node scripts/check-didit-webhook-boundaries.mjs`
- `node scripts/check-didit-kyc-integrity.mjs`
- `node scripts/check-kyc-reconciliation.mjs`
- `node scripts/check-user-storage-boundary.mjs`
- `node scripts/check-i18n.mjs`
- `node scripts/check-namen.mjs src`
- `node scripts/check-beschriftung.mjs src 0`

### BLOCKED BY RUNNER ENVIRONMENT
- `npm run typecheck`: project type packages are not installed.
- `npm run test:pure`: `vitest` is not installed.
- `npm run test:rules`: Firebase CLI is not installed.
- `npx playwright test`: Playwright is not installed/cached; offline resolution fails.
- `npm run build`: Vite is not installed.

An installation attempt was made and timed out; the environment has no usable npm registry/cache for completing the dependency graph. These gates are therefore not falsely marked PASS.

## Release decision

**NO-GO / NOT PRODUCTION APPROVED.**

The code-level feature hardening is complete and the static security/integrity gates pass. A protected CI environment must execute the exact dependency-backed test pyramid and production build on this exact artifact before Go-Live approval.

## Nachlieferung High-End Features — 07.10.2026

### Datenschutz / Consent Center
- `ConsentSettings` bietet getrennte, sofortige Zustandsänderungen für `ki_auswertung`, `fehlerberichte` und `produktanalyse`.
- `/api/einwilligung/zweck` entscheidet serverseitig atomar pro Zweck.
- Aktueller Consent-Stand und unveränderlicher Nachweis werden in einer Firestore-Transaktion gemeinsam geschrieben.
- Der Nachweis wird mit HMAC-SHA256 signiert; der aktuelle `evidenceId` wird erst nach erfolgreicher Persistenz an die UI bestätigt.
- Widerruf triggert weiterhin die vorhandene Art.-9-Purge-/Audit-Kaskade.
- Firestore-Clientzugriff auf `users/{uid}/einwilligungen/*` und `consent_audit_log/*` ist schreibgeschützt bzw. vollständig gesperrt.

### Privatsphärenmodus / Sichtschutz
- `Sichtschutz` aktiviert sich manuell, bei Tab-/Dokument-Verdeckung und nach zwei Minuten Inaktivität.
- „Wieder anzeigen“ ist ein einfacher, expliziter Unlock ohne simulierte Biometrie.
- Die UI kommuniziert die Schutzgrenze transparent: Schutz vor fremden Blicken, nicht vor einer Person mit bereits entsperrtem Gerät.
- Die bestehende temporäre Pause bleibt UID-scoped über den vorhandenen Storage-Adapter.

### Date Planner / Date Calendar
- Date Planner nutzt keine lokale Kalenderpersistenz mehr.
- Serverseitige Endpunkte liefern Verbindungen, kuratierte Date-Ideen, Date-Pläne und Verfügbarkeiten.
- Verbindung, Stadt/Region und Vibe (`Casual`, `Romantic`, `Adventure`) werden validiert.
- Server prüft beim Speichern Verifikation, Aktivität und Blockbeziehungen der gewählten Verbindung.
- Firestore-Pfade: `users/{uid}/datePlans/*` und `users/{uid}/dateAvailability/*`.
- Client-Schreibzugriffe auf diese Collections sind in den Firestore Rules verboten; Server-API verwendet Firebase Admin SDK.
- Optionale 2-Stunden-Erinnerungen werden über einen Cloud-Scheduler-Job in `functions/src/dateReminders.ts` verarbeitet und per FCM zugestellt.
- Reminder-Verarbeitung besitzt Claim-/Finalize-Semantik gegen Doppelversand bei parallelen/erneuten Ausführungen.

### Date-Vorbereitung / Checkliste
- `DatePreparationChecklistWidget` lädt den autoritativen Zustand aus `/api/checklists/date_prep`.
- Offline-Änderungen werden ausschließlich UID-scoped in IndexedDB (`klar_offline_queue_db`) gepuffert.
- Bei Online-Verbindung erfolgt authentifizierte Synchronisierung zum Firestore-Dokument `users/{uid}/checklists/date_prep`.
- Die strukturierte UI umfasst `Praktisches`, `Outfit & Styling`, `Mindset` und `Gesprächsthemen`.
- Der serverseitige Checklist-Endpunkt erzeugt die nicht-sensiblen, kuratierten Checklistenpunkte; der Client erzeugt keine dauerhaften Mock-Daten.

### Neue statische Boundary Gates
- `check:date-prep-checklist`
- `check:date-planner-boundary`
- `check:privacy-screen`
- `check:consent-center`

Alle vier neuen Feature-Gates melden im aktuellen Runner `PASS`.

## Release-Gate Status nach Nachlieferung

Die geforderten dynamischen Gates wurden erneut angesetzt. Der aktuelle Runner besitzt jedoch kein installiertes Projekt-Dependency-Set (`node_modules` fehlt), keine lokal verfügbare Firebase CLI und keine lokal gecachte Playwright-Paketauflösung. Daher sind `typecheck`, `test:pure`, `test:rules`, `playwright` und `build` in diesem Runner nicht als PASS belegbar. `npm run check:enterprise` erreicht die neuen Feature-Gates und bestehende statische Gates, stoppt danach an `check:ki`, weil das Projektpaket `typescript` im Runner fehlt.

**Release-Entscheidung:** Code-/Architektur-Härtung abgeschlossen; keine Produktionsfreigabe behauptet. Für einen echten Release-Gate-PASS ist ein CI-/Build-Runner mit installiertem Lockfile-konformem Dependency-Set und Firebase/Playwright-Infrastruktur erforderlich.
