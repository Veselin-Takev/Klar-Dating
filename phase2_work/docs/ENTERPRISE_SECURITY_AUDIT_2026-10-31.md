# Klar — Enterprise Security & Privacy Audit
**Stand:** 31. Oktober 2026 · **Befund-/Freigabestatus:** **BLOCKED / NO-GO**  
**Repository:** [Veselin-Takev/Klar-Dating](https://github.com/Veselin-Takev/Klar-Dating) · **produktionsnaher Vergleichsstand:** `main` @ [`2808dc1cbb485f70b403681c108cea5a3361d950`](https://github.com/Veselin-Takev/Klar-Dating/commit/2808dc1cbb485f70b403681c108cea5a3361d950)  
**Audittyp:** quellenbasierte Sicherheits- und Governance-Prüfung mit GitHub-API-Evidenz, Prüfketten-/Issue-/PR-Sichtung und externem Standardabgleich. **Kein Penetrationstest und keine unabhängige externe Zertifizierung.**

## 1. Executive Decision
**Eine offizielle Produktionsfreigabe ist nicht vertretbar.** Auf `main` bestehen nachvollziehbare Datenschutz-/Sicherheitsrisiken bei Verifizierungsfotos und Profilmedien. Technische Gegenmaßnahmen liegen in ungemergten PRs; die erfolgreiche Prüfung eines PR-Branches ist **kein** Nachweis für `main`, eine produktive Cloud-Konfiguration oder reale Datenmigration. Kritische Datenschutz-/Partner-Vertrauens- und operative Release-Nachweise sind offen.

**Gesamtbewertung:** technisch deutlich gehärtete Architektur mit nachweisbar vorhandenen Schutzansätzen, **aber ein nicht freigabefähiger Integrations-/Datenschutz-/Operationszustand**. Kein belegter akuter Angriff, keine bestätigte Kompromittierung und keine festgestellte Menge ausnutzbarer CVEs — diese wären durch separate Live-, SAST-, SCA- und historische Secrets-Prüfungen festzustellen.

### Risikoklassifizierung
- **P0 / Release-blocking:** unkontrollierte Legacy-Löschung biometrischer Fotos auf `main` (#202); nicht abgeschlossene sichere Cross-Service-Purge-Migration (#202); fehlende prüfbare Release-/Cloud-Nachweise (#8); fachlich ungeklärte Conversion-Authentizität (#55) und Partner-Datenschutz-/Retention (#56).
- **P1 / High:** Profilbildzugriff über breite Storage-Regel (#204); langlebige Download-Capability-URLs (#206); fehlender eigenständiger Datenschutz-/Security-Review-Nachweis; tatsächliche Anwendung von TTL-/Hold-Policies (#70) und Alarmzustellung (#71) nicht belegt; vollständige SCA/SAST/Secrets-History nicht belegt.
- **P2 / Governance:** zahlreiche parallele ungemergte PRs mit Konflikt-/Integrationsrisiko, technische CODEOWNERS-Zuordnung statt unabhängigem Spezialreview; veraltete Issue-Textstände neben inzwischen korrigiertem `main`-Quellcode.

## 2. Methode, Standards, Evidenzqualität
**Referenzrahmen:** [OWASP ASVS 5.0.0](https://asvs.owasp.org/) als Anforderungsstruktur für Web/API-Sicherheit; [NIST SP 800-218 SSDF 1.1](https://csrc.nist.gov/pubs/sp/800/218/final) für Entwicklung, Änderungs- und Lieferkettenkontrollen; Zero-Trust-/Least-Privilege-/Privacy-by-Design-Prinzipien; DSGVO insbesondere Art. 5, 9, 17, 25, 32 (fachliche Rechtsprüfung ausstehend). **Kein Anspruch auf vollständige ASVS-Anforderungserfüllung oder formal durchgeführtetes ASVS-L2-Audit.**

**Evidenzklassen:**
- **S1 — Quellcode nachgesehen:** exakte Repository-Datei auf festem `main`-Commit per GitHub Connector gelesen.
- **S2 — PR-Code/CI:** GitHub-PR bzw. dessen Code/Workflow auf konkreter Head-SHA; belegt nur diesen Änderungsstand.
- **S3 — Dokument/Issue:** Sollzustand und gemeldeter Befund; nicht automatisch eine aktuelle Schwachstelle.
- **N — nicht geprüft:** Live-Infrastruktur, Accounts, Produktionsdaten, Network DAST, vollständiger Dependency-SBOM/CVE-Scan, Git-History-Secret-Scan, externer Penetrationstest, IAM, Cloud Scheduler und tatsächliche Lieferfähigkeit von Monitoring.

**Scope:** `phase2_work` TypeScript/React/Express/Firebase, Rules/Storage, Cloud Functions, Auth/RBAC, Didit-KYC, Stripe, Partner/Referral, KI/Telemetrie, CI/Release, Datenaufbewahrung und Betriebsnachweise; Root-GitHub-Workflow/Go-Live-Dokumentation. Dateien wurden **risikobasiert/stichprobenartig**, nicht lückenlos gegen jeden Commit und jede Dependency gelesen. Öffentliche GitHub-Suchergebnisse sind nur eine Quellcodehilfe. Keine gefährlichen Requests, keine Produktionstests, kein Deployment, kein Secretzugriff.

## 3. Nachweismatrix der prüfbaren GitHub-Baseline
| Evidenz | Ergebnis | Konsequenz |
|---|---|---|
| Repository-Metadaten | GitHub meldet `visibility: public`, Default `main`; ein öffentlicher Code-Stand ist nicht per se eine Schwachstelle | Geheimnisse und personenbezogene Prüfbelege müssen konsequent außerhalb des Repositories bleiben; History-Scan nötig |
| `main`-SHA | `2808dc1cbb485f70b403681c108cea5a3361d950` | Alle `main`-Feststellungen beziehen sich auf exakt diesen Stand |
| `.github/workflows/ci.yml` | Scope-Preflight, Enterprise-Static-Gates, Typecheck, Functions Build, Emulator-Tests, Build, Smoke und Playwright stehen im Workflow | Gute CI-Abdeckung; nicht gleich Live-/Release-Attestation |
| [CI #41175963163](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41175963163) | GitHub meldet `completed/success` auf [PR #231](https://github.com/Veselin-Takev/Klar-Dating/pull/231) Head `c0cf0620a6b206adbe6c401117f81d6dedcc8da0`; Job `validate`, Typecheck/Functions Build/Tests/Build/Browser acceptance erfolgreich | **Branchbezogen**, nicht `main`, nicht Real-Cloud-/IAM-/Rechtsfreigabe |
| [PR #230](https://github.com/Veselin-Takev/Klar-Dating/pull/230) | Diagnostik-Härtung (#206), CI-Success zuvor bestätigt, ungemergt | Teilfix, kein Token-Rückruf |
| [PR #231](https://github.com/Veselin-Takev/Klar-Dating/pull/231) | Legacy-/entscheidungsbasierte Foto-Löschung gehärtet; zuletzt geprüfter PR-Head erfolgreich; kein unabhängiger Review gefunden | Cross-Service-TOCTOU und Live-Rollout weiter offen |
| `phase2_work/RELEASE_MANIFEST.json` | `releaseGovernance.decision: NO-GO` | Formeller GO-Nachweis fehlt |
| `GO_LIVE_CHECKLIST.md` (Root und phase2) | Offene produktive Secret-/IAM-/Alarm-/KYC-/DSGVO-/Go-Live-Nachweise | Vor Freigabe mit echten Attestations ausfüllen |
| 72 über GitHub-Suche gemeldete offene PRs zum Prüfzeitpunkt | Mehrere overlapping Feature-/Privacy-/Security-Branches | Integrations-Reihenfolge, Rebase/Change-Review und Branch-Hygiene erforderlich; Zahl kann sich ändern |

## 4. Kritische und hohe Befunde

### SEC-01 — P0 · Legacy-Age-Delete für biometrische Verifizierungsfotos
**Status:** auf `main` **quellcodebestätigt**; Gegenmaßnahmen ungemergt.  
**Evidenz:** [`phase2_work/functions/src/deleteExpiredPhotos.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/2808dc1cbb485f70b403681c108cea5a3361d950/phase2_work/functions/src/deleteExpiredPhotos.ts) importiert `deleteExpiredPhotoPage` und ruft die Funktion planmäßig auf; [`retention.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/2808dc1cbb485f70b403681c108cea5a3361d950/phase2_work/functions/src/retention.ts) prüft `timeCreated`, nicht den Moderations-Entscheidungszeitpunkt `fotoLoeschenAb`. Außerdem ist `purgeVerificationStorageCron` separat exportiert.
**Risiko:** Löschung eines noch offenen, nicht entschiedenen Identitätsnachweises durch Upload-Alter; Verstoß gegen definierte fachliche Retentionsregeln; Datenverlust. Ob ein solcher Worker **tatsächlich produktiv** läuft, ist nicht belegt.
**Remediation:** [PR #231](https://github.com/Veselin-Takev/Klar-Dating/pull/231) deaktiviert Legacy-Pfad fail-closed, erhält den Export, aktualisiert Tests, ergänzt Hold-/GCS-Generation-Checks. Gegenüber [PR #203](https://github.com/Veselin-Takev/Klar-Dating/pull/203) und [PR #229](https://github.com/Veselin-Takev/Klar-Dating/pull/229) Änderungen vor Merge sequenziell konsolidieren; nicht blind parallel mergen.
**Abnahme:** überprüfter deployed-function-/Scheduler-Inventar-Export, Storage-/Firestore-Negativtests, Staging-Rollout, Freigabe Security/DPO/SRE, Rückfallplan; kein automatisches Löschen alter Functions.

### SEC-02 — P0 · Entscheidungs-/Storage-Transaktionsgrenze und Lösch-Audit
**Status:** `main` ungeprüft sicher; Draft-Gegenmaßnahmen **nur teilweise risikomindernd**.  
**Evidenz:** [`src/server/routes/complianceStorage.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/2808dc1cbb485f70b403681c108cea5a3361d950/phase2_work/src/server/routes/complianceStorage.ts) löscht auf `main` mit `ignoreNotFound: true` ohne `ifGenerationMatch`, und der Audit-Transaktionscheck vergleicht lediglich UID. [PR #231](https://github.com/Veselin-Takev/Klar-Dating/pull/231) ergänzt Hold-Metadaten, Generation-Precondition, erneute Entscheidungsprüfung, HTTP 503 bei Partial Failure und negative Tests.
**Restrisiko:** Firestore-Status und Cloud Storage lassen sich **nicht atomar** in einer einzelnen Transaktion ändern. Statusänderung zwischen Preflight und GCS-Delete bleibt möglich; selbst ein transaktionaler Audit-Check kann eine erfolgte Löschung nicht rückgängig machen. Ein zuvor ausgetauschtes Objekt muss außerdem mit der ursprünglich autorisierten Generation verknüpft sein.
**Abnahme:** zweiphasiger serverseitiger Retention-Claim/Lease, sämtliche Status-Writer müssen ihn einhalten, Generation/Path am Entscheidungsereignis binden, Hold- und 404/412-Reconciliation, kontrollierte E2E-Konflikttests und persistenter Audit-Beleg. Siehe [Google Cloud GCS Request Preconditions](https://docs.cloud.google.com/storage/docs/request-preconditions).

### SEC-03 — P1 · Profilbild-Storage-Regeln zu breit
**Status:** `main` **quellcodebestätigt**.
**Evidenz:** [`storage.rules`](https://github.com/Veselin-Takev/Klar-Dating/blob/2808dc1cbb485f70b403681c108cea5a3361d950/phase2_work/storage.rules) enthält bei `/profiles/{uid}/{datei}` `allow read: if signedIn();`, während [`storageRulesEngine.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/2808dc1cbb485f70b403681c108cea5a3361d950/phase2_work/src/server/platform/storageRulesEngine.ts) adulte und verifizierte Zugriffsannahmen modelliert.
**Risiko:** Jeder angemeldete Account kann über den Storage-SDK-Pfad Profilfotos lesen, unabhängig von vorgesehenen Ziel-/Requester-Trust-Gates. Das KYC-Foto selbst hat in den Regeln `allow read: if false`; diese Trennung ist positiv.
**Remediation:** [PR #205](https://github.com/Veselin-Takev/Klar-Dating/pull/205) und [PR #209/#210](https://github.com/Veselin-Takev/Klar-Dating/pull/210) mit echten Rules-Emulator-Negativtests überprüfen; Zugriffs-/Löschungsstatus dynamisch und fail-closed aus autoritativen Daten ziehen.
**Grenze:** Verschärfte Regeln allein invalidieren bereits ausgegebene Download-Capability-URLs nicht.

### SEC-04 — P1 · Dauerhafte Profilfoto-Download-URLs
**Status:** `main` **quellcodebestätigt**.  
**Evidenz:** [`src/lib/klar.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/2808dc1cbb485f70b403681c108cea5a3361d950/phase2_work/src/lib/klar.ts) ruft nach Upload `getDownloadURL()` auf und speichert die URL in `users/{uid}.photoURL`. [Issue #206](https://github.com/Veselin-Takev/Klar-Dating/issues/206) dokumentiert weitere UI-Verbraucher und unwiderrufene historische Token.
**Risiko:** Wer den Link kennt, kann bei gültigem Download-Token das Profilbild unter Umständen unabhängig vom aktuellen Viewer-Auth-Status abrufen; Weitergabe über Telemetrie, Browser-/Proxy-Logs, Referer etc. potenziell möglich.
**Remediation:** [PR #208](https://github.com/Veselin-Takev/Klar-Dating/pull/208) (authentifizierte Medienauslieferung), [PR #207](https://github.com/Veselin-Takev/Klar-Dating/pull/207) / [#230](https://github.com/Veselin-Takev/Klar-Dating/pull/230) (Leckageoberflächen), [PR #211](https://github.com/Veselin-Takev/Klar-Dating/pull/211) (Rotation/Revocation). Nach inventarisierter Migration Legacy-Capabilities gezielt widerrufen. Datenschutz- und Betriebsfolgen der Bildauslieferung prüfen.

### SEC-05 — P0 · Partner-Webhook beweist Schlüsselbesitz, nicht den Kauf
**Status:** **fachliche Vertrauensgrenze offen**, keine bestätigte Signaturumgehung.  
**Evidenz:** [`partnerReferralCore.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/2808dc1cbb485f70b403681c108cea5a3361d950/phase2_work/src/server/partnerReferralCore.ts) erfordert strukturierte `eventId`, `referralToken`, `buyerUid` und HMAC-Zeitfenster; [`partnerReferrals.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/2808dc1cbb485f70b403681c108cea5a3361d950/phase2_work/src/server/routes/partnerReferrals.ts) prüft signierte Webhooks. [Issue #55](https://github.com/Veselin-Takev/Klar-Dating/issues/55) verlangt unabhängige Kauf-/Buyer-Evidenz.
**Risiko:** Selbst korrekt signierte, aber fachlich falsche Angaben eines kompromittierten/fehlerhaften Partners könnten unberechtigte Conversions und Rewards auslösen.
**Abnahme:** Partnerbeleg/Server-to-Server-Quittung, Buyer-Binding ohne unnötiges PII, Konsistenz mit Stripe/Orderstatus soweit relevant, Refund/Chargeback-Reversal, Idempotenz/Replay/Concurrency und echte Partner-Staging-Verträge/Testfälle. Nicht nur `HMAC PASS` als End-to-End-Authentizität interpretieren.

### SEC-06 — P0 · Partner-Referral-Datenschutz, Retention und Drittweitergabe
**Status:** rechtlich/operativ **offen**.
**Evidenz:** [Issue #56](https://github.com/Veselin-Takev/Klar-Dating/issues/56), [`DATA_RETENTION.md`](https://github.com/Veselin-Takev/Klar-Dating/blob/2808dc1cbb485f70b403681c108cea5a3361d950/phase2_work/docs/DATA_RETENTION.md). Partner-Klicks geben ggf. Referral-Token an Dritte weiter; HMAC-Pseudonyme sind bei erneuter Zuordenbarkeit nicht anonym.
**Risiko:** Unvollständige VVT-/Zweck-/Rechtsgrundlagen- und Drittempfängerklärung; undeutliche Löschfristen/Legal-Holds; potenzielle Fehlbewertung von Einwilligung/Widerruf.
**Abnahme:** Datenschutz- und Rechtsgrundlagenmatrix pro Event, Datentransfer-Diagramm, Vertrags-/Auftragsverarbeitungsprüfung je Partner, Consent-/Withdrawal-/Art.17-Tests, echte TTL-Policies und Löschbelege. DPO/Legal dokumentieren Risikoentscheidung.

### SEC-07 — P0 Governance · Kein nachgewiesener Production-Readiness-GO
**Status:** **belegt**.
**Evidenz:** [`RELEASE_MANIFEST.json`](https://github.com/Veselin-Takev/Klar-Dating/blob/2808dc1cbb485f70b403681c108cea5a3361d950/phase2_work/RELEASE_MANIFEST.json) hat `NO-GO`; [`GO_LIVE_CHECKLIST.md`](https://github.com/Veselin-Takev/Klar-Dating/blob/2808dc1cbb485f70b403681c108cea5a3361d950/GO_LIVE_CHECKLIST.md) und [Issue #8](https://github.com/Veselin-Takev/Klar-Dating/issues/8) verlangen echte Produktionskontrollen. [`.github/workflows/release.yml`](https://github.com/Veselin-Takev/Klar-Dating/blob/2808dc1cbb485f70b403681c108cea5a3361d950/.github/workflows/release.yml) prüft produktive Umgebung, Release-Zustimmung, SHA, SBOM, Attestations und Artefakte.
**Risiko:** Grün auf PR-CI oder ein synthetischer Release-Evidence-Test könnte als Produktivfreigabe fehlinterpretiert werden.
**Abnahme:** konkrete Cloud-Run-/IAM-/Secret-Manager-Identität, Secret-Rotation, Alert-Zustellung/On-Call-Ack, echte Produktions-Smoketests, Immutable Build/SBOM/Provenance, Rollback/Canary, Security/DPO/Legal/SRE/Release Owner-Signoffs am selben Build und dokumentierter GO-Beschluss.

### SEC-08 — P1 · SAST/SCA/Secrets-History nicht vollständig attestiert
**Status:** **Nachweislücke**, kein behauptetes CVE- oder Secret-Leck.
**Evidenz:** [`scripts/check-secrets.mjs`](https://github.com/Veselin-Takev/Klar-Dating/blob/2808dc1cbb485f70b403681c108cea5a3361d950/phase2_work/scripts/check-secrets.mjs) nutzt Pattern-Erkennung **im aktuellen Working Tree** und enthält eine gehashte Ausnahme für die öffentliche Firebase-Web-Konfiguration; dies beweist nicht, dass Cloud-API-Key-Restriktionen gesetzt sind. [`release-go-evidence.mjs`](https://github.com/Veselin-Takev/Klar-Dating/blob/2808dc1cbb485f70b403681c108cea5a3361d950/phase2_work/scripts/release-go-evidence.mjs) erwartet High/Critical-SCA, Gitleaks und Semgrep als Release-Gates.
**Risiko:** unbekannte historische Secrets, transitive Advisories, nicht gescannte Container/Functions. **Null CVEs / null Leaks sind nicht attestiert.**
**Abnahme:** SCA beider Dependency-Graphen samt SBOM/Advisory-Snapshot, Container-SCA, Gitleaks inkl. vollständiger Git-History, Semgrep/SAST, GitHub Secret Scanning/Push Protection, nachgewiesene Rotation bestätigter Funde, signierte CI-Evidence pro SHA.

### SEC-09 — P1 · Release-/Review-Integrationsrisiko durch viele offene PRs
**Status:** GitHub-Metadaten **bestätigen** zum Prüfzeitpunkt zahlreiche offene, sich thematisch überschneidende Security/Privacy-PRs (72 vom Connector gelistete offene PRs). [PR #203](https://github.com/Veselin-Takev/Klar-Dating/pull/203), [#229](https://github.com/Veselin-Takev/Klar-Dating/pull/229) und [#231](https://github.com/Veselin-Takev/Klar-Dating/pull/231) bearbeiten denselben Retention-Bereich; [#205](https://github.com/Veselin-Takev/Klar-Dating/pull/205), [#208](https://github.com/Veselin-Takev/Klar-Dating/pull/208) und [#230](https://github.com/Veselin-Takev/Klar-Dating/pull/230) überschneiden sich bei Profilmedien/Diagnostik.
**Risiko:** isoliert grüne Branches können bei Reihenfolge, Rebase oder Konfliktlösung gemeinsame Sicherheitsinvarianten verlieren. [`CODEOWNERS`](https://github.com/Veselin-Takev/Klar-Dating/blob/2808dc1cbb485f70b403681c108cea5a3361d950/CODEOWNERS) ordnet aktive `phase2_work`-Pfade technisch zu, jedoch einem einzelnen Account; das ist **kein unabhängiger Security-/Finance-Review**.
**Abnahme:** verbindliche Integrations-/Abhängigkeitsmatrix, Stop-the-line bei Security-Rebase, alle Tests nach Merge-Simulation und erneut auf Integrations-SHA, keine selbst genehmigten Hochrisiko-Änderungen.

## 5. Domain-by-domain Control Assessment
| Sicherheitsdomäne | Positiv im Quellcode nachgesehen | Restprüfung / Risiko |
|---|---|---|
| Auth / RBAC | `authorization.ts` arbeitet mit tokengebundenen `req.user`-Claims; `firestore.rules` verbietet direkte Clientschreibpfade für Partner-Ledger und fordert Owner für User-Daten | Nachweis serverseitiger ID-Token-Validierung/Revocation **für sämtliche** Routen und Privilegübergänge; negative Rolle/Deletion-Pending-Tests |
| Firebase Security Rules | Verifizierungsfotos mit clientseitigem `read:false`; Owner-gated Uploads; Firestore-Partnerkollektionen `read/write:false` | Profilfoto-Reads in `storage.rules` P1; Rules-Emulator-Replay gegen exakt zu deployende Rules; Admin SDK umgeht Rules |
| KYC / Didit | `diditKyc.ts` enthält strikte Konfiguration, HMAC+Timestamp, Workflow/App/Environment-Binding und Prüfung von Kontext/Status | Echte Provider-Sandbox/Live-Eventfolge, Replay, Entscheidungskonflikte, Retention/Fotoübergabe, Didit-DPA und Schlüsselrotation |
| Payments / Stripe | `stripeService.ts` verwendet SDK-Signaturprüfung `constructEvent`, begrenzt Return-URL-Origin und nutzt Checkout-Idempotency-Key | End-to-End-Refund/Chargeback/Kündigung (§312k BGB fachlich prüfen), wiederholte Out-of-order Events, reale webhook Secrets/Rotation |
| Referrals / Partner | HMAC, strikte Zod-Schemas, verteilte Limits und serverseitige Collections sind vorhanden | Vertragliche Conversion-Authentizität P0; Consent-Epoch, Käuferzuordnung, Vertrauensmodell, Art.17/Lifecycle und Partner-E2E |
| KI / Privacy | `aiPiiSanitizer.ts` reduziert E-Mail/IBAN/Telefonmuster; `src/main.tsx` deaktiviert Tracing und sendDefaultPii; `telemetryPrivacy.ts` erfordert Consent | Regex-Filter sind **keine** DLP-/Art.9-Garantie; vollständige Prompt-/Output-/Log-/Retention-Datenflüsse, Sentry real und externe KI-Verträge testen |
| Secrets / Runtime | `db.ts` erlaubt Durable-DB-Fallback nur bei `NODE_ENV=development`; `.env.example` enthält Platzhalter | Nachweis tatsächlicher Prod-Service-Accounts/ADC, no-fallback unter Staging/Prod, Scope/Access, Secret Manager, Rotation, History-Scan |
| CI / Supply chain | Pinning einzelner Actions, `persist-credentials:false`, Least-Permission `contents:read` in CI, Build/Tests/Emulator/Playwright; Release-Workflow mit SBOM/Attestation | Vollständige SAST/SCA/History-Scan-Abdeckung und effektive Branch Protection/Environment Approvals sind damit **nicht** bewiesen |
| Observability | `src/server/observability.ts` zieht P95-Schwelle direkt aus `ops/slo.json` (300 ms), somit ist die alte dokumentierte 1500-ms-Abweichung im aktuellen `main` **nicht mehr reproduzierbar** | Reale Histogramme, Alert-Rules, Verified Notification Channel, Pager-Delivery und Error-Budget-Review fehlen; Issue #71 operativ offen |
| TTL / Retention | `scripts/configure-retention.sh` enthält **20 Collection-Groups** und hat Dry-run/Genehmigungsgates; frühere Meldung „nur vier Gruppen“ entspricht nicht dem aktuellen `main` | Tatsächliche Firestore-TTL-Policies/Index-Bau, Ausnahmen, Legal Hold und genehmigte Retention Matrix müssen live/read-only belegt werden (#70) |
| Delivery / Operations | Release-Evidence-Checks blockieren auf NO-GO-Manifest, Checklisten und Review-Nachweis; Produktions-Controls-Auditor ist dokumentiert | Echte Cloud Run IAM/Secret-, Monitoring/On-call-, SLO-, Rollback- und Canary-Nachweise weiterhin ausstehend |

**Wichtig zu #70, #71 und #73:** Die älteren Issue-Texte belegen keinen fortbestehenden Quellcodefehler, wenn der feste `main`-Stand bereits korrigiert ist. Die produktiven Konfigurationsnachweise, die verantwortliche Prüfung und das administrative Schließen nach Abnahme sind davon getrennt.

## 6. Bedrohungsmodell — zentrale Trust Boundaries
1. **Browser → Express API:** ID-Token/Session, Account-Lifecycle, CSRF-/Origin-/CSP-/Rate-Limit-Policy sowie Schema-Validierung; negative 401/403/429-Fälle pro Schreibroute.
2. **Browser → Firebase Rules/Storage:** Firebase Auth/Claims können nie die Prüfung von serverseitigem Accountstatus und Zielprofil-Eignung ersetzen. Capability-URLs sind ein separater Bypass-Kanal.
3. **Express Admin SDK → Firestore/Storage:** Rules werden umgangen; der Server ist zwingend Policy-Enforcement-Point mit Transaktions- und Least-Privilege-Prinzip.
4. **Didit/Stripe/Partner → Webhooks:** Transport-Herkunft per Signatur ist von geschäftlicher Wahrheit, Käuferbindung, Replay/Idempotenz und Rückabwicklung zu trennen.
5. **Scheduler → Compliance API:** Secret-Signaturen schützen Anfragen, aber keine falsche Daten-Selektion, cross-service race oder einen noch deployten alten Worker.
6. **Service → KI/Sentry/Partner-Dritte:** explizite Rechtsgrundlage/Consent, PII-Minimierung, Retention, Auslands-/Subprozessorprüfung und Löschrückmeldung.
7. **GitHub CI → Release → Cloud:** untrusted PR-Code, Actions-Rechte, Dependencies, Artefakt-Digest, unabhängige Approvals und überprüfbare reale Deployment-Identität.

## 7. Maßnahmenplan mit Gates und Verantwortlichkeiten

### Phase A — sofortige Blocker (vor jeder Release-Freigabe)
| Reihenfolge | Maßnahme | Verantwortlich | Akzeptanznachweis |
|---|---|---|---|
| A1 | Produktions-Release auf NO-GO lassen; aktuelle Firebase-/Scheduler-/Cloud Run-Inventur **read-only** | Release Owner + SRE | SHA, Projekt, Function-Version, Scheduler-Targets, Cloud Run Revision und Inventurbelege |
| A2 | #202: PRs #203/#229/#231 technisch konsolidieren; Legacy-Age-Worker im genehmigten Rollout kontrolliert stilllegen | AppSec + Backend + DPO | Staging 404/412/Hold, Decision-Race, Objektgeneration, Audit-Recovery, Real-GCS-Predicate, Backfill/rollback |
| A3 | #204/#206: adult/active rules und autorisierte Profilbild-Reads integrieren; alte URLs nach genehmigtem Inventar widerrufen | AppSec + Privacy + Frontend | negative Auth/Revocation/Deletion/Race-Tests, URL-Capability-Rotation |
| A4 | #55/#56: Partner-Kaufnachweis, Consent/Buyer-Binding, DSFA-Screening/VVT/Retention und Withdrawal | Security + DPO + Partner Owner | signiertes Partner-Staging-E2E, Rechtsgrundlagenmatrix, Lösch- und Reversal-Nachweis |
| A5 | #8/#70: echte Produktions-Controls und 20-Group-TTL/Hold-Konfiguration prüfen | SRE + Compliance | IAM-/Secret-/Monitoring-/Scheduler-/TTL-Read-only-Reports mit geschützter SHA-gebundener Evidenz |

### Phase B — überprüfbare Security Gates auf Integrations-SHA
- Node 22.23.3/Bun 1.4.2/Java 21, unveränderte Locks, `check:enterprise`, `typecheck`, Functions Build, Rule/Storage/Firestore-Emulator-Tests, API/Playwright, KYC/Stripe/Partner/Art17-Fail-Close, `build`, Produktions-Smoketest **ohne produktive Nutzerdatenmanipulation**.
- SAST/SCA: `npm audit`/OSV und beide Package-Graphs, Gitleaks **inkl. Git-History**, Semgrep/CodeQL, SBOM und signierte Artefaktprovenienz. Kritische/hohe Funde vollständig bearbeiten oder formal begründete, genehmigte Ausnahmen mit Ablauf festhalten.
- Threat-model-review für Bildmedien, KYC-Biometrie, Buyer-Claims, Consent-Widerruf, AI-Exfiltration, Audit-Immutability und Backup/Restore; Missbrauchstests auf wiederholte/konkurrierende Requests.
- Code-Review/Approval: Security, Datenschutz/Legal, Operations/SRE, Release Owner **unabhängig und auf denselben SHA**; keine Selbstfreigabe. PR-Konflikte im Integrationsbranch vor Merge mit allen Gates erneut testen.

### Phase C — kontrollierter Produktionsnachweis
- Genehmigte Change Window/Runbook, Canary/Traffic Split, echte Verfügbarkeit und Last, Alarmzustellung an erreichbaren On-Call inkl. Acknowledgement, überprüfter Rollback und Recovery Drill.
- Cloud Run Secret Manager/Service Account/Permissions, WAF-/DDoS-/Abuse-Gates, Firestore TTL, Storage Lifecycle/holds, Scheduler, Partner-/Didit-/Stripe-Schlüsselmaterial und Datenschutz-Verträge live kontrollieren; private Evidenz **nicht** im öffentlichen Repo speichern.
- Release-Manifest und Go-Live-Checkliste erst nach dokumentiertem, menschlichem GO aktualisieren. Kein automatischer GO durch grüne CI.

## 8. Prüfungsgrenzen, Fehlende Beweise & Konfidenz
**Verifizierbar (hoch):** konkrete `main`-Codebefunde SEC-01/03/04, Main Release-Manifest NO-GO, aktuelle SLO-/CODEOWNERS-/TTL-Quellkorrekturen, tatsächlich erfolgreicher CI-Job für PR-Head.  
**Mittlere Konfidenz / Fachrisiko:** #55/#56 basieren auf Quellstrukturen und offenem Geschäfts-/Privacy-Vertrauensmodell; ein signierter Partner-Webhook allein beweist keinen realen Kauf.  
**Nicht belegt:** produktiver Scheduler-Stand, tatsächlicher Zugriff auf Bilder über bereits geleakte Tokens, echte Secrets/CVEs/Compromise, Vollständigkeit aller Rollen-/API-Kontrollen, Real-Provider-Events, DAST/Pentest, reale Cloud Policies/SLO-Alarmierung, Live-Lösch- und Revocation-Migration. **Nicht geprüft ≠ bestanden oder fehlgeschlagen.**

**Verdikt des Security-Audits:** **BLOCKED / NO-GO.** Kein unabhängiger Produktivsicherheitsnachweis. Maßnahmen und PRs sind erst nach vollständigem Integrations- und Staging-Nachweis als behoben zu kennzeichnen.

---
### Anhänge / Primärreferenzen
- [GitHub Issues #8, #55, #56, #70, #202, #204, #206](https://github.com/Veselin-Takev/Klar-Dating/issues) — lebendes Backlog; Issue-Text nicht als unveränderliche Quellwahrheit interpretieren.
- [`main`-Audit-Stand](https://github.com/Veselin-Takev/Klar-Dating/commit/2808dc1cbb485f70b403681c108cea5a3361d950); [CI PR #231](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41175963163).
- [OWASP ASVS 5.0.0](https://asvs.owasp.org/), [NIST SSDF 1.1](https://csrc.nist.gov/pubs/sp/800/218/final), [Google Cloud Storage Preconditions](https://docs.cloud.google.com/storage/docs/request-preconditions).
