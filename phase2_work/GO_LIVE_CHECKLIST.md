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


### 2026-10-19 — AI-Code-Review / CODEOWNERS bypass hardening, weiterhin NO-GO

Semantisches AI-Code-Review entdeckte einen P1-Review-Guard-Fehler: lokale `CODEOWNERS`-Prüfung akzeptierte zusätzliche GitHub-Glob-/unanchored-Override-Regeln, die Security-/Finance-Zuständigkeit in GitHub überschreiben können. Weitere AI-Review-Runden entdeckten fehlende Prüfung für Literal-Directory ohne Slash, fehlendes globales `*` und fehlerhafte Team-Identitäten. Fail-closed-Korrektur und **24 Node-Regressionen PASS** im lokalen Workspace unter Node v22.23.3. Die unabhängige semantische AI-Quellprüfung der beiden ausführbaren Änderungen meldete nach Korrekturen **PASS (begrenzter Scope)**; der obligatorische statische ESLint-Lauf mit `npx --no-install eslint . --max-warnings=0` war wegen fehlender lokaler Abhängigkeiten **nicht ausführbar**, daher **AI-Code-Review insgesamt NICHT PASS**. Rechtmäßige reale GitHub-Team-/CODEOWNERS-/Branch-Protection-Reviews, echte TTL-/Firestore-Emulator-/SAST- und Supply-Chain-Nachweise fehlen. `zod` ist als Dependency vorhanden, `pino`, `ioredis`, `bullmq` nicht – ohne Architektur- und Security-Prüfung keine spekulativen Infrastrukturdependencies hinzufügen. ADR: `docs/ADR_CODEOWNERS_FAIL_CLOSED_AI_REVIEW_2026-10-19.md`; Review: `docs/AI_CODE_REVIEW_CODEOWNERS_2026-10-19.md`. **Release: NO-GO.**


### 2026-10-19 — Enterprise Status & Compliance Dashboard (NO-GO)

Das bestehende AdminHealthStatusWidget wurde als Enterprise-Statusanzeige mit geschütztem, read-only /api/admin/health-check und strict Boolean-/Freshness-Statusmodell neu implementiert. Vorherige /api/check-safety-POST sowie HTTP 400/401 als gesund und irreführende „Alle Systeme gesund“-Behauptungen wurden entfernt. SLO-P95, DSGVO Art.17/TTL, KI-Budget und CI-/Security-Gates werden ohne Datenquelle als **Nicht verifiziert** angezeigt. Auth-Wechsel invalidiert den Status und abgebrochene/alte Antworten werden verworfen.

Das §312k-Audit-Widget zeigt nur begrenzte Marker-Zählwerte statt falscher 100%-/PII-frei-/Rechtskonformitätszusicherungen und verhindert stale Filter-Ergebnisse. Zehn native Node-Tests sind in `check:enterprise` aufgenommen. Diese Quell-/Modellprüfungen sind kein E2E- oder vollständiges AI-Code-Review. ADR: docs/ADR_ENTERPRISE_ADMIN_STATUS_2026-10-19.md; Review: docs/AI_CODE_REVIEW_ENTERPRISE_DASHBOARD_2026-10-19.md. **NO-GO**.


#### Finale Validierungsrunde — 2026-10-19

Der exakt archivierte Draft-Commit `51864c8a8ef29c696a1b7e420a19eeb7cc903a47` wurde mit SHA-256-verifiziertem Node 22.23.3 geprüft: **Enterprise-Dashboard 10/10 PASS**, CODEOWNERS 24/24 PASS, Release-GO-Review 55/55 PASS. Weitere statische/Offline-Tests für 20 TTL-Retention-Gruppen, Art.17 (18 Preflight-Fälle), Lockfiles und Release-Workflow PASS. Auf demselben Code: **5/14 Pflichtgates PASS** (Secrets, Auth-Boundary, Public Firestore Rules, AI PII Sanitizer, Art.17 Boundary), **9/14 FAIL oder nicht ausführbar** (Enterprise/TypeScript-Modul fehlt; Root-npm-audit ENOLOCK im Bun-only-Root; Gitleaks und Semgrep nicht vorhanden; tsc, Vitest, Firebase CLI, Playwright und Vite fehlen). Zusätzliches `npx --no-install eslint . --max-warnings=0`: **FAIL/nicht ausführbar**. Deshalb **AI-Code-Review gesamt NICHT PASS** und **Production NO-GO**. Echtzeit-Dashboard-SLO-, Art.17-/TTL-, KI-Budget- und Security-Gates bleiben ohne geeignete autorisierte Live-Messquelle ausdrücklich unbekannt; rechtliche Abnahmen und echte E2E-Tests fehlen.


### 2026-11-01 — Enterprise End-to-End Audit: exact-main NO-GO

**Audit baseline:** `main` `2808dc1cbb485f70b403681c108cea5a3361d950`. See [ENTERPRISE_END_TO_END_AUDIT_2026-11-01.md](docs/ENTERPRISE_END_TO_END_AUDIT_2026-11-01.md) for evidence grades, source-backed risk register, 10-track negative E2E acceptance matrix and release prerequisites; [deutscher Managementbericht](docs/ENTERPRISE_E2E_AUDIT_MANAGEMENTBERICHT_DE_2026-11-01.md) for the prioritized findings and decisions.

**GitHub CI evidence only:** Draft #267 SHA `32598e8` run [41246347258](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41246347258) SUCCESS; Draft #268 SHA `71c0d31` run [41282765859](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41282765859) SUCCESS. Draft #269 SHA `54ef22b` [run 41283792515](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41283792515) has since completed **SUCCESS** (validated exact-head job gates); the fix remains unmerged and undeployed.. These isolated PR test results are **not** proof that patches are merged to main, deployed, or fully integrated together.

**Unresolved mandatory approvals** (all unchecked until immutable signed evidence is attached):

- [ ] P0 #254: tenant-specific Admin SDK, Firestore and Storage authorization, signed legacy mapping, staged migration, Art.-17 isolation, rollback and cross-tenant negative tests
- [ ] P0 #202: deployed Cloud Scheduler status, fail-closed legacy purge, decision-aware GCS generation/hold/race/404/412 tests and signed DPO/SRE approval
- [ ] P0 #55/#48/#56 and #70: buyer/event authenticity, consent/withdrawal, erasure/retention, 20 TTL policies' live ACTIVE state and lawful holds
- [ ] P1 #204/#206/#237: adult-gated media, revocable download tokens, authoritative Didit verification refresh and native E2E tests
- [ ] Full final-main and candidate-image SHA-bound CI, SCA/OSV high+critical review, SAST, Gitleaks, SBOM, exact deployed image digest, genuine approved staging/provider evidence
- [ ] Main protection/independent CODEOWNERS approvals, delivered alerts/on-call, backup restoration, canary/rollback and AppSec/DPO/Legal/Finance/SRE/Release Owner signoffs

**Decision:** BLOCKED / Production NO-GO. `RELEASE_MANIFEST.json` remains unmodified with `productionApproved=false`. No production deployment or datastore mutation is authorized by this audit.


### 2026-11-01 — P0 #202 scalable retention evidence still OPEN

- [x] Source-only bounded purge preflight and negative tests on **unmerged** Draft [#272](https://github.com/Veselin-Takev/Klar-Dating/pull/272), exact SHA `61c78d3311dfdba2dec7910f11505d32e2f34479`; [CI #41287450907](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41287450907) SUCCESS. This is **not** live deployment evidence.
- [ ] Scalable durable work queue/lease and replay-safe receipts for >300 due events; old missing-expiry data mapping, global object ownership/duplicate checks, legal holds and Firestore→GCS race reconciliation approved by DPO/AppSec/SRE
- [ ] Real staging Storage 404/412/retention-hold tests, deployed Cloud Scheduler inventory, independent production authorization
- [ ] New **read-only** local-Emulator backlog census in [Draft #273](https://github.com/Veselin-Takev/Klar-Dating/pull/273), SHA `5223b4c796c46c126a1f7ebfc5bebf931ffa991a`, must pass its own exact-head CI. Census counts **do not** close the durable worker requirement and have not been collected from customer data.

**Current release decision:** BLOCKED / NO-GO. `productionApproved=false`.


### 2026-11-01 — P0 #202 durable-work prototype is NOT a release gate PASS

- [x] Pure lease/receipt state model and unused Firestore transaction adapter implemented in unmerged [Draft #274](https://github.com/Veselin-Takev/Klar-Dating/pull/274); mandatory no-live-binding/mutation source gates and synthetic regression tests committed. **Exact-head CI #41289417424 must still pass.**
- [ ] Authoritative tenant/UID/challenge+GCS generation queue producer and globally unique ownership, approved legal hold policy
- [ ] Correct, horizontally scalable (>300) queue consumer; transaction leases, expiring/stale worker contention with native Firestore Emulator proof
- [ ] Durable GCS→Firestore receipt/outbox reconciliation proving crash recovery, object replacement, 404/412 preconditions and audit integrity
- [ ] Approved real staging/production read-only inventory and independent SRE/AppSec/DPO/Legal/Release Owner signoffs; final combined exact-main security gates

**Unmerged prototype is inert, cannot process live photos, and cannot justify GO. Maintain `productionApproved=false`.**


### 2026-11-01 — P0 #202 write-ahead crash-fencing remains unapproved

- [x] Pure state-only design of `delete_intent`, intended generation/lease epoch and no-auto-delete recovery policy added in [unmerged Draft #275](https://github.com/Veselin-Takev/Klar-Dating/pull/275), current source SHA `7b30adf79e8020101b081ec80e5f4edb0e7d0460`. The code is **not** connected to Cloud Scheduler, GCS or active purge endpoint.
- [ ] **Exact-head CI #41290477469** must be fully successful; no previous PR's green CI is a substitute.
- [ ] Independently enforce durable Firestore intent write-before-GCS external effect, with real crash injection, valid leases, generation bounds and authenticated 404/412 reconciliation receipts.
- [ ] Final durable queue for >300 events, authoritative tenant/UID/object ownership + consent/retention holds, native Firestore Emulator concurrency and approved staging GCS behavior.
- [ ] Deployed Scheduler/IAM/TTL inventory and AppSec/DPO/Legal/SRE/Release Owner signed authorizations on final merged and deployed artifact SHA.

No release claim. Remain `NO-GO` and `productionApproved=false`.


### 2026-11-01 — Native Firestore Emulator gate / delete-intent invariants (Draft #276)

- [x] Source-only native Firestore Emulator contention tests and second-line transactional state-transition checks added in unmerged [Draft #276](https://github.com/Veselin-Takev/Klar-Dating/pull/276), initial head SHA `a8c2830ae325ddf49d07e22508f235898df70204`. This records source implementation **only**, not a passed test.
- [ ] Check exact SHA #276 full CI to verify the native emulator tests actually **executed**, not silently skipped, and all security gates PASS; no historical prior CI transfer.
- [ ] Staging GCS generation/404/412/hold tests, actual durable delete-intent ordering and independently authenticated final receipt; cross-service crash/operator recovery.
- [ ] Scalable >300 due queue/producer, real tenant mapping/UID/decision, missing-expiry/hold backfill, production scheduler/TTL/IAM evidence and signed independent AppSec/DPO/Legal/SRE/Release Owner approvals.

**Production still BLOCKED/NO-GO. Do not set `productionApproved=true`.**


### 2026-11-01 — P0 #202 field-level CAS security regression (Draft #277)

- [x] Parent #276 exact SHA `a8c2830ae325ddf49d07e22508f235898df70204`: [CI #41291380045](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41291380045) SUCCESS; log proves all 3 native Firestore Emulator tests were executed, not skipped. Source-only/unmerged validation.
- [x] New isolated [Draft #277](https://github.com/Veselin-Takev/Klar-Dating/pull/277) source adds field-level lease token/epoch/attempt, generation-observation and receipt integrity checks, offline forgery regressions, a 4th real Emulator case, and mandatory mutation security gates.
- [ ] Confirm **new exact-head SHA `4c1e04eef8935753b990a50ef4ca99432414c334`** full CI [#41316005858](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41316005858) succeeds and 4 native emulator tests actually run.
- [ ] Replace arbitrary callback API with reviewed, least-privilege typed actions plus authoritative tenant/UID/hold checks and independent audit receipt authentication.
- [ ] Complete durable >300-workload producer/consumer and crash/replay/404/412/hold staging tests, Scheduler deployment review and independent Security/DPO/Legal/SRE/Release Owner approvals.

These changes do not authorize any customer-photo operation or production GO. `productionApproved=false`, **BLOCKED / NO-GO**.


### 2026-11-01 — Typed, non-finalizing purge commands (Draft #278)

- [x] Parent #277 exact commit `4c1e04eef8935753b990a50ef4ca99432414c334`, [CI #41316005858](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41316005858) SUCCESS, including **4 executed native Firestore Emulator tests**.
- [x] In unmerged [Draft #278](https://github.com/Veselin-Takev/Klar-Dating/pull/278), the unused Firestore CAS adapter now exports only a typed four-operation **pre-delete** API, rejects arbitrary callbacks, unknown commands and hidden fields, and withholds unverified GCS/audit completion operations. Tests and static mutation gate updated.
- [ ] Verify latest #278 source SHA `bcaede0ea892f6a7ce5b42371bdad9f2d9ae0774` exact-head full [CI #41332732631](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41332732631), including execution of **4 native Emulator tests** (not skipped).
- [ ] Validate tenant/UID/legal holds, GCS generations/404/412 and authenticated append-only receipt in approved staging; native >300 backlog worker, actual deployed Scheduler/IAM/TTL inventory and independent signed AppSec/DPO/Legal/SRE/Release Owner approvals.

No current production change, no GO. `productionApproved=false`.


### 2026-11-01 — P0 #202 caller-time spoof prevention (unmerged Draft #279)

- [x] Parent [Draft #278](https://github.com/Veselin-Takev/Klar-Dating/pull/278) SHA `bcaede0ea892f6a7ce5b42371bdad9f2d9ae0774`: [full CI #41332732631](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41332732631) SUCCESS; 4 native Firestore Emulator tests actually executed.
- [x] Source-only [Draft #279](https://github.com/Veselin-Takev/Klar-Dating/pull/279) adds server process timestamp ownership, rejects caller `now` field and snapshots immutable-by-copy command fields before retried transaction; Unit/Emulator/mutation tests updated.
- [ ] Verify exact-head #279 SHA `41bebee582f21082661622337299088a26a75d07` full CI, including **five actually executed native Firestore Emulator tests**. Do not reuse #278 PASS.
- [ ] Measure and enforce distributed clock skew/time source, trusted producer/consumer authorization, tenant/UID/image ownership and legal holds, GCS generation/404/412/receipt staging crash recovery, >300 backlog and real live Scheduler/IAM/TTL/rollback.
- [ ] Require independent AppSec/DPO/Legal/SRE/Release Owner signed approval on the final combined deployed SHA.

No production activation or GO. Keep `productionApproved=false`.


### 2026-11-01 — P0 #202 runtime CAS data descriptor gate (Draft #280)

- [x] Parent #279 SHA `2dc5716610740d6196efbbee07b23d7f2a7ed0b3` [CI #41334295241](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41334295241) fully SUCCESS, including **5 actually executed native Firestore Emulator tests**.
- [x] Unmerged [Draft #280](https://github.com/Veselin-Takev/Klar-Dating/pull/280) adds data-descriptor-only runtime input validation, forbids getters, non-enumerable and symbol fields, and adds unit/native/mutation regression tests without touching production purge.
- [ ] New SHA `edf3281a9a9e82c8fdc9e7dc74809547ea3a714d` must finish full [CI #41335454638](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41335454638), with **6** native Emulator tests actually executed and PASS.
- [ ] Trusted command producer/consumer, tenant/UID/GCS/legal-hold checks, operation receipts and 404/412 crash reconciliation, >300 durable backlog, real deployed Scheduler/IAM/TTL audit and independent DPO/AppSec/Legal/SRE/Release Owner GO.

**P0 #202 OPEN. `productionApproved=false`. Production BLOCKED / NO-GO.**


### 2026-11-01 — PR #280 exact-head red CI and corrected assertion

- [x] Latest #280 source correction on SHA `4f53bcfef9d31ddbd9672465b2362ee1f7d726ac`: test now asserts that invalid GCS generation `0` is refused **before another Firestore transaction**, with error `purge_work_unsupported_command`.
- [ ] Confirm [CI #41336278230](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41336278230) full SUCCESS on that exact SHA including all **six** native Firestore Emulator tests; previous [#41335672265](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41335672265) FAILED one stale test expectation after static/type/build PASS, and must not be counted as GO.
- [ ] Full multi-tenant source integration, durable retention producer/consumer >300, trusted clock, GCS 404/412/hold/receipt staged recovery, external AppSec/DPO/Legal/SRE/Release Owner approvals.

**Do not release; `productionApproved=false`; P0 #202 OPEN, NO-GO.**


### 2026-11-01 — Mandatory coexistence of tenant and retention enterprise CI gates

- [x] Independent unmerged exact-head CIs: #280 `4f53bcfef9d31ddbd9672465b2362ee1f7d726ac` [#41336278230](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41336278230) SUCCESS with **6 executed** native Firestore Emulator cases, and #268 `71c0d31c6e8ad3e8c681f793dd3daba285d50c7c` [#41282765859](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41282765859) SUCCESS.
- [x] Isolated stacked [Draft #281](https://github.com/Veselin-Takev/Klar-Dating/pull/281) incorporates source-pinned read-only tenant scanner/tests into retention branch; enterprise CI invokes both Tenant + Retention checks, with a new negative gate against dropping either.
- [ ] Obtain **new combined exact-head full CI #41338044005** on SHA `26e9ed2a15bf8e5af468fc35b3e0fb45ddd92f5d`; verify Tenant scanner and all Retention gates actually ran, plus 6 native Emulator tests. Separate green PRs do **not** satisfy this item.
- [ ] Finish authoritative tenant isolation and approved migration, actual durable photo retention worker/receipts and >300 due handling, staging GCS 404/412/holds and independent signed DPO/AppSec/Legal/SRE/Release Owner GO on the final merged/deployed SHA.

Still `productionApproved=false`; both P0 #202 and #254 **OPEN**, production **NO-GO**.


### 2026-11-01 — Tenant Firebase Rules source and config evidence (unmerged #282)

- [x] Source gate convergence [Draft #281](https://github.com/Veselin-Takev/Klar-Dating/pull/281) SHA `26e9ed2a15bf8e5af468fc35b3e0fb45ddd92f5d` passed full [CI #41338044005](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41338044005): tenant inventory and retention safety checks in one chain; 6 native Firestore Emulator cases actually executed and PASS.
- [x] New unmerged [Draft #282](https://github.com/Veselin-Takev/Klar-Dating/pull/282) checks **local Firestore + Storage Rules source SHA** and configured Firebase/emulator Rules paths; rejects missing, redirected or malformed inputs; test/mutation gate added to `check:enterprise`, without deploying or changing Rules.
- [ ] Verify new #282 exact-head `5c82c3c2f7847a63eef09a863e194106cfba96d9` [CI #41339344795](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41339344795) full PASS, including 6 real native Firestore Emulator tests and combined Tenant/Retention checks.
- [ ] Obtain signed evidence of **actual deployed** Rules, Firebase project identity and least-privilege IAM; cross-tenant/same-tenant BOLA/IDOR negatives in Auth/Firestore/Storage Emulators and Admin SDK.
- [ ] Independently approve lawful tenant data mapping/migration and Art.-17 cascade, deployed Retention reconciliation with GCS 404/412, safe >300 queue, staging and independent AppSec/DPO/Legal/SRE/Release Owner GO.

**P0 #202/#254 OPEN; no production approval, `productionApproved=false`.**


### 2026-11-01 — Native Tenant Claims Firestore Rules proof (Draft #283)

- [x] Parent #282 local Firebase Rules source/config proof SHA `5c82c3c2f7847a63eef09a863e194106cfba96d9` passed [CI #41339344795](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41339344795), **not** a deployed-Rules or tenant authorization approval.
- [x] New unmerged [Draft #283](https://github.com/Veselin-Takev/Klar-Dating/pull/283) defines **6 native Firestore Rules Emulator tests** for current global UID path behavior and default-denied tenant paths. One intentionally confirms global legacy UID read persists across tenantId claim changes, a **release-blocking gap**.
- [ ] Require full latest-head SHA `29716be04eb50833248c2693455a952c9f098ddb` [CI #41341495412](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41341495412) SUCCESS and logs proving **6 new tenant tests + 6 existing native retention tests** ran (not silently skipped).
- [ ] Independently design/approve signed tenant membership, globally authoritative UID/tenant mapping, tenant Firestore Rules/Storage Rules and Admin SDK server guards; complete cross-tenant BOLA/IDOR tests, legacy data/Art.-17 migration and staged deployment/rollback.
- [ ] Complete P0 #202 active retention worker with legal holds, >300 queue, GCS 404/412/durable receipts; obtain final AppSec/DPO/Legal/SRE/Release Owner signatures.

Both P0s OPEN, `productionApproved=false`, **NO-GO**.


### 2026-11-01 — P0 #254 native Storage Rules tenant boundary evidence (Draft #284)

- [x] [Draft #283](https://github.com/Veselin-Takev/Klar-Dating/pull/283), SHA `d2d77d700bcdf8cfd54b943a244f6faafb7590b8`: [CI #41341786655](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41341786655) full SUCCESS, 6 actual Tenant Firestore + 6 Retention Firestore Emulator cases, 1,468 Vitest tests.
- [x] [Draft #284](https://github.com/Veselin-Takev/Klar-Dating/pull/284) source-only 4-case Storage Rules Emulator evidence added (cross-tenant signed-in legacy profile-image read succeeds; cross-owner write/delete fails; verification image reads fail; tenant-prefixed Storage object still deny-by-default). Mandatory enterprise/dual-P0 mutation gate added. No Rules changes.
- [ ] Verify exact-head SHA `4ee71941061b0c9234033aa2ee81c40f8949f3c0` [CI #41342604486](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41342604486) SUCCESS **and** logs proving 4 native Storage + 6 Tenant Firestore + 6 Retention Firestore tests actually executed.
- [ ] Obtain Product/DPO-approved media-visibility policy; signed tenant identity and membership, tenant-aware Storage/Firestore Rules, Admin SDK tenant/BOLA checks, deployed source provenance, migration/Art.17/rollback and IAM/Scheduler/GCS verified receipts, plus all independent release signoffs.

**P0 #254 and #202 OPEN; `productionApproved=false`; BLOCKED/NO-GO.**

## 2026-11-01 — P0 #254 Storage profile visibility review (Draft #285)

Parent [Draft #282](https://github.com/Veselin-Takev/Klar-Dating/pull/282) SHA `5c82c3c2f7847a63eef09a863e194106cfba96d9` completed [CI #41339344795](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41339344795) SUCCESS, validating checked-in Firebase Rules source evidence only. Current `storage.rules` contains flat `profiles/{uid}/{datei}` and `allow read: if signedIn();`, allowing signed-in-user reads at the client Rules layer without a tenant test in that expression; biometric verification photos remain client read-denied in source. This may be deliberate public-profile functionality and is **not evidence of current deployed Rules, a demonstrated exploit, or legal noncompliance**.

New unmerged [Draft #285](https://github.com/Veselin-Takev/Klar-Dating/pull/285), initial SHA `170a0586b22aed47a37c8d82e6cf6843896c6c32`, adds a read-only Storage source marker review with SHA/line metadata, explicit `reviewRequired`, `tenantIsolationCertified=false`, `livePermissionVerified=false`, negative tests and mandatory dual-P0 gate preservation. No Security Rules were changed. [CI #41342756886](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41342756886) pending exact-head validation. Independent product/privacy determination for profile visibility and real Auth/Storage cross-tenant BOLA tests, deployed Rules proof, tenant migration, #202 durable GCS/receipt controls and human AppSec/DPO/SRE/Release Owner approvals remain outstanding. **P0 #254/#202 OPEN; Production NO-GO.**


### 2026-11-01 — Native Storage Emulator policy characterization (Draft #286)

- [x] Parent #285 exact SHA `170a0586b22aed47a37c8d82e6cf6843896c6c32` [CI #41342756886](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41342756886) full SUCCESS; this was only a source-risk marker.
- [x] New unmerged [Draft #286](https://github.com/Veselin-Takev/Klar-Dating/pull/286) adds two native Storage Emulator tenant-claim test scenarios (cross-tenant profile-read characterized as current allowed, biometric client read denied), with synthetic emulator-only objects and no Rules changes.
- [ ] Confirm exact SHA `1090aae0747c0b4163d46cbb234b0e7fff9f80da` [CI #41343839097](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41343839097) full PASS, especially that **five** Storage Rules Emulator tests and six Firestore CAS Emulator tests actually executed.
- [ ] DPO/Product/Legal authorize intended visibility of signed-in profile images *across tenants*; run cross-/same-tenant Auth/Firestore/Storage/Admin-SDK BOLA negatives and verify production Rules/IAM deploy hash.
- [ ] Still block real GCS photo deletion until independent Art.-17/hold/generation 404/412 receipts, >300 queue, Scheduler review, and AppSec/DPO/SRE/Release Owner signatures.

`productionApproved=false`; both P0 #202/#254 remain OPEN.


### 2026-11-01 — P0 #254 native Storage Emulator cross-tenant tests (unmerged #287)

- [x] Parent [Draft #285](https://github.com/Veselin-Takev/Klar-Dating/pull/285) SHA `170a0586b22aed47a37c8d82e6cf6843896c6c32` full [CI #41342756886](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41342756886) SUCCESS, source review only.
- [x] New isolated [Draft #287](https://github.com/Veselin-Takev/Klar-Dating/pull/287) introduces **two** real Storage Emulator tenant-A/B tests for current profile metadata visibility, anonymous/foreign writes denial, and verification photo read prohibition, plus mandatory CI coverage/mutation checks; no Security Rules modification.
- [ ] Verify exact SHA `5f9c94b12b26d3ca9b62f4cfb82cd2f660b10a47` full [CI #41343976817](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41343976817), including explicit job log confirming **both new native Storage cases actually executed**, six prior Firestore Emulator cases and combined Tenant/Retention gates.
- [ ] Product/DPO/Legal signoff on cross-tenant profile discoverability; verify deployed rule hash, project/bucket, Admin SDK authorization and same/cross-tenant BOLA/IDOR/deleted-user negative tests.
- [ ] Finish P0 #202 authorized, generation-fenced GCS receipts and >300 durable queue, lawful tenant migration, real stage/IAM/Scheduler evidence and signed AppSec/DPO/SRE/Release Owner GO.

**P0 #202/#254 OPEN. `productionApproved=false`, Production BLOCKED/NO-GO.**


## 2026-11-01 — Storage tenant test mutation CI correction, Draft #287

First SHA `5f9c94b12b26d3ca9b62f4cfb82cd2f660b10a47` of [Draft #287](https://github.com/Veselin-Takev/Klar-Dating/pull/287) failed [CI #41343976817](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41343976817) in the new **static coverage mutation test**. The fixture modified only one tenant-B claim while another native test still retained tenant-B, so the combined source guard correctly remained satisfied. The mutation was changed from `replace` to `replaceAll`, simulating **complete removal** of the tenant-B claim coverage. The corresponding source test fix is SHA `f36453c917f522cd6f034388645577e60de0ba03`. A technical-document follow-up makes the current PR head `ac6142bdfb74015ef282ac427f0866b85f0b2a42`, [CI #41344157885](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41344157885) **queued** when recorded. The previous code-only CI was canceled by the follow-up commit; no full PASS is claimed for either pending head. **Confirm two native Storage scenarios actually executed, plus six Firestore Emulator cases.** No main merge, deployed Rules or real customer photo action. P0 #254/#202 OPEN; Production NO-GO.


## 2026-11-01 — Controlled Storage evidence consolidation (stacked Draft #288)

[Draft #284](https://github.com/Veselin-Takev/Klar-Dating/pull/284), SHA `47d4fbc3afc1e9a3207d01d11621d1079929af5d`, **PASS** [CI #41342810126](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41342810126) with six native Tenant Firestore Rules, four native Storage Rules and six Retention Firestore tests. The separate #285 and #287 source-only investigations **overlap** with this already validated suite; they should not be blindly merged.

New isolated [Draft #288](https://github.com/Veselin-Takev/Klar-Dating/pull/288), current initial SHA `c358d4360e36ef7a68555c2471f17648358557f7`, deliberately bases on #284, imports only the **two SHA-pinned** read-only Storage source risk scripts from #285 (original Git blobs `703636517b0de2f2f5e07ec2603305f5010040d1`, `ce68990b34821d47768523b228c2ebb48ffebbec`) and adds metadata visibility/denial assertions **inside the existing four native Storage tests** rather than importing #287's duplicate test cases. Mandatory `check:tenant-native-storage` and `check:dual-p0-integration` mutation tests now preserve these extra assertions and `check:storage-tenant-risk`. All existing Tenant/Retention source gates retained, Rules unchanged.

New exact-head [CI #41345204334](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41345204334) **in progress** at this entry; do **not** transfer the separate #284 PASS to the combined code. Verify all four Storage, six Tenant Firestore, six Retention cases actually executed and the new source SHA report; use the exact CI job logs. A separate #287 test pass/failure cannot approve this consolidation. No productive Rules deploy, tenant cutover, P0 #202 GCS receipts, >300 durable queue, Admin SDK BOLA evidence or independent AppSec/DPO/Legal/SRE/Release Owner GO. P0 #254 and #202 OPEN, **BLOCKED/NO-GO**, `productionApproved=false`.


### 2026-11-01 — Verified P0 #254 converged Storage evidence and still-open approvals

- [x] [Stacked Draft #288](https://github.com/Veselin-Takev/Klar-Dating/pull/288) exact SHA `c358d4360e36ef7a68555c2471f17648358557f7` [CI #41345204334](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41345204334): full SUCCESS. CI logs verify **4 native Storage**, **6 Tenant Firestore**, **6 Retention Firestore** Emulator tests, **1,472 Vitest tests in 200 files**, production smoke and 26 browser acceptance PASS. Earlier *in progress* note is superseded for that SHA only.
- [x] Alternative overlapping #287 exact SHA `4ea1cd63a38eae45284dcb84722ec43e53c7aa81` [CI #41344683269](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41344683269) PASS with five native Storage tests. This is **not** permission to merge duplicate/conflicting suites.
- [ ] Product, DPO and Legal sign the **profile-media visibility policy**, using [P0 #254 decision gate](docs/P0_254_STORAGE_VISIBILITY_DECISION_GATE_2026-11-01.md); do not equate signed-in cross-tenant profile reads in current source/emulator with authorized tenant discovery.
- [ ] AppSec/QA provide same/cross-tenant Auth/Firestore/Storage **and** server-side Admin SDK BOLA/IDOR negative tests, account revocation, signed-URL migration and deployed Rules/IAM provenance.
- [ ] Privacy/Operations close P0 #202: lawful decision/holds, GCS generation-fenced deletes with 404/412/worker-crash receipts and a durable **>300** due-item work queue validated on approved staging.
- [ ] QA/SRE/Release Owner provide *final integrated and approved SHA*, clean supply-chain and release gates, monitoring/rollback and independent signed AppSec/DPO/Legal/SRE/Release Owner GO.

**Both P0 #202 and #254 stay OPEN. Unmerged draft results cannot release `main`; `productionApproved=false`; BLOCKED / NO-GO.**


### 2026-11-01 — New P0 CI emulator fail-closed regression (Draft #289)

- [x] Isolated [Draft #289](https://github.com/Veselin-Takev/Klar-Dating/pull/289) based on #288 adds mandatory CI execution for three native Storage/Tenant/Retention Firestore Emulator suites; if the authorized loopback `demo-klar` Emulator is absent/misconfigured, CI fails instead of silently skipping. Source/mutation and dual-P0 gates were added. No production Rules, IAM, Scheduler, retention workers or data changes.
- [ ] Verify **exact PR #289 head SHA `fd62b44c0c763ca58ae358fd10c92138b1aff3b3`** complete [CI #41347553626](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41347553626) SUCCESS with **4 real Storage, 6 Tenant Firestore and 6 Retention Firestore** tests executed, plus all static/type/build/smoke/browser gates; pending at this entry. Prior #288 PASS cannot substitute for #289.
- [ ] Preserve Product/DPO/Legal profile-media decision, Admin SDK BOLA/IDOR, live Firebase Rules/IAM, Tenant/Art.17 migration, P0 #202 generation/404/412/GCS/legal-hold receipts, durable >300 queue and independent AppSec/DPO/Legal/SRE/Release Owner GO as release blockers.

**P0 #202/#254 OPEN. `productionApproved=false`, release BLOCKED/NO-GO.**
