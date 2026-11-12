# Klar – Enterprise End-to-End Audit & Production Readiness Decision

**Auditdatum:** 2026-11-02 · **Audit-ID:** KLAR-E2E-20261102-R1  
**Scope:** GitHub-Quellen, Konfiguration, CI-/PR-Metadaten, offene Issues, dokumentierte Betriebsnachweise.  
**Autoritative Source-Baseline:** `main` @ `2808dc1cbb485f70b403681c108cea5a3361d950`.  
**Neuester gezielt verifizierter Draft:** [PR #312](https://github.com/Veselin-Takev/Klar-Dating/pull/312) @ `4ef6dde5874f7602f614f68a11dce2c0062b745f`, [Enterprise CI #41474462939](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41474462939) **SUCCESS** (`validate`-Job, 32 erfolgreiche Schritte); Draft, nicht gemergt, keine unabhängige Review.  
**Geltungsbereich der Aussage:** Eine abgeschlossene **Repository- und Evidenzanalyse über alle wesentlichen E2E-Domänen**, **kein** vollständiger dynamischer Integrationstest der produktiven Infrastruktur und **kein** Penetrationstest. Keine reale Staging-/Produktionsabnahme durchgeführt.  
**Verbindliche Entscheidung:** **BLOCKED / NO-GO**, `productionApproved=false`. Keine Ausnahme allein aufgrund grüner CI.

## 1. Executive Summary

Klar weist auf der statischen Ebene substanzielle Schutzmaßnahmen auf: gepinnte Node/Bun-Toolchain, GitHub-CI mit Typecheck, Sicherheits-/Compliance-Gates, Firebase-Emulator- und Browserprüfungen, KYC-HMAC-Validierung, Firestore-Security-Rules und eine dokumentierte, bewusst blockierte Release-Governance. Das ist wertvolle **Entwicklungsevidenz**, aber keine Bestätigung der tatsächlich ausgerollten Cloud-Runtime.

Für eine Enterprise-Produktionsfreigabe existieren weiterhin kritische, nicht abschließend abgesicherte Pfade: **Legacy-Löschung biometrischer Fotos**, **False-Positive-Löschquittungen/Fehlerszenarien**, **20er-TTL-Live-/Legal-Hold-Evidenz**, **nicht migrierte Multi-Tenant-Daten und Regeln**, **fehlende erzwungene unabhängige GitHub-Approvals**, **nicht bestätigte Produktions-IAM/Alerting-/Secret-Management-Nachweise** sowie **Partner-Conversion-/Datenschutz-Gates**. Die vorliegenden Draft-PRs sind kein Nachweis, dass ihre Schutzmaßnahmen in `main`, einer Release-Revision oder Produktion wirksam sind.

**P0 heißt Freigabeblocker für den angegebenen Release-Scope; P1 heißt hohe prioritäre Abweichung mit möglichem P0-Upgrade bei bestätigter Exposition; P2 bedeutet kontrollierte Verbesserung.** Die Einstufung ist ein technisches Audit-Urteil, keine erfundene CVSS-Zahl, keine Feststellung eines produktiven Vorfalls und keine abschließende juristische Einstufung.

## 2. Methode, Audit-Scope und Evidenzvertrauen

| Domäne | Geprüfter Nachweistyp | Aussagekraft / fehlende Evidenz |
| --- | --- | --- |
| Architektur, API, Server, Client | Quellcode, Routen, Rules, Issue-Backlog | Reale Reachability, Tenants und Datensätze nicht live getestet |
| Auth, JWT, RBAC, KYC | Servermodule, Didit-Signatur-/Revocation-Pfade, Rules | Token-/Race-/BOLA-Negativtests auf **deployter** Revision nicht unabhängig belegt |
| Storage, Löschung, Art. 17, TTL | Aktiver `main`-Quellpfad, P0 #202/#70, Stacked Drafts | Keine echte GCS-404/412-/Crash-Quittung oder GCP ACTIVE-Inventur |
| CI/CD und Lieferkette | `.github/workflows/ci.yml`, `release.yml`, Node-Pins, 32-stufiges `validate` | Kein neuer Live-Deploy-/SBOM-/SCA-/Vuln-Scan-Befund für einen freigegebenen Release |
| Betrieb, SLO, Kosten, Backup | `ops/slo.json`, Runbook, Produktionskontrollen-Dokumentation | Kein produktives 30-Tage-SLI, kein Alarmempfang, Recovery-/RTO-/RPO-Drill |
| Governance und Compliance | Live-Repository-Ruleset #25756841, CODEOWNERS, Manifest, Issue #8 | Reviewer-Identität und signierte Security/DPO/Legal/SRE/ReleaseOwner-Attestationen fehlen |

Evidenzklassen: **E0** Aussage/Dokumentation ohne unabhängige Prüfung; **E1** direkt gelesene Quelle/Konfiguration auf benannter SHA; **E2** erfolgreiche automatisierte CI für exakten SHA; **E3** natives Emulator-/Staging-Testergebnis mit archivierten Logs und Manifestbindung; **E4** zeitgebundener, projekt- und revisionsgebundener Live-Cloud-/Operations-Nachweis; **E5** unabhängige, nachvollziehbare Fachfreigabe. *E2 impliziert weder E3 für alle Testszenarien noch E4/E5.*

Geprüfte Referenzen: `main` Commit `2808dc1cbb485f70b403681c108cea5a3361d950`; CI [#41474462939](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41474462939) auf PR #312; [`main`-Ruleset](https://github.com/Veselin-Takev/Klar-Dating/rules/25756841); die offenen Issues [#8](https://github.com/Veselin-Takev/Klar-Dating/issues/8), [#70](https://github.com/Veselin-Takev/Klar-Dating/issues/70), [#202](https://github.com/Veselin-Takev/Klar-Dating/issues/202), [#254](https://github.com/Veselin-Takev/Klar-Dating/issues/254), [#55](https://github.com/Veselin-Takev/Klar-Dating/issues/55), [#56](https://github.com/Veselin-Takev/Klar-Dating/issues/56), [#48](https://github.com/Veselin-Takev/Klar-Dating/issues/48), [#73](https://github.com/Veselin-Takev/Klar-Dating/issues/73), [#204](https://github.com/Veselin-Takev/Klar-Dating/issues/204), [#206](https://github.com/Veselin-Takev/Klar-Dating/issues/206), [#237](https://github.com/Veselin-Takev/Klar-Dating/issues/237) und [#71](https://github.com/Veselin-Takev/Klar-Dating/issues/71). Alle Source-Aussagen beziehen sich auf die **in diesem Bericht bezeichnete Baseline**; spätere PRs können davon abweichen.

## 3. Findings – priorisiertes Risk Register

| ID | Prio | Bereich | Verifizierter Befund und Auswirkung | Evidenz | Owner / Exit-Kriterium |
| --- | --- | --- | --- | --- | --- |
| **K-E2E-01** | **P0** | Biometrische Bildaufbewahrung | In `main` ruft `functions/src/deleteExpiredPhotos.ts` den alten `deleteExpiredPhotoPage` auf; `functions/src/retention.ts` prüft Objekt-`timeCreated` und löscht bei >30 Tagen, nicht an die Moderationsentscheidung gebunden. Risiko frühzeitiger Löschung. Keine Behauptung, dass diese Function live deployed ist. | [#202](https://github.com/Veselin-Takev/Klar-Dating/issues/202); `phase2_work/functions/src/retention.ts:11-25` | Security/DPO/SRE: autoritativ nur entscheidungsbasierter Pfad, geprüfter Legacy-Scheduler-Abschalt-/Rollback-Plan, Live-Function-/IAM-Inventur |
| **K-E2E-02** | **P0** | GCS-Delete/Receipt | `main`-`src/server/routes/complianceStorage.ts:48-80` verarbeitet ein begrenztes Batch und ruft `bucket.file(path).delete({ignoreNotFound:true})` auf; es fehlt die in Stacked-PRs ausgearbeitete Bindung an sichere Generation, Hold/Expiry und vollständige Löschquittung. Ein 404 darf nicht ohne Beleg einer tatsächlichen Löschung als Receipt gelten. | [#202](https://github.com/Veselin-Takev/Klar-Dating/issues/202), Draft [#305–#310](https://github.com/Veselin-Takev/Klar-Dating/pull/310) | Security/SRE/DPO: generation-bound GCS-404/412/Race-/Crash-Tests, durable >300-Aufträge, atomare konsistente Receipts, genehmigte Legal-Hold-Semantik |
| **K-E2E-03** | **P0** | Firestore TTL/Legal Hold | Quellmatrix enthält 20 `expiresAt`-Collection-Groups und staging-gebundene Dry-Run-/Preflight-Gates; reale `ACTIVE`-Policies, Hold-/Altbestandswirkung und separate fachliche Freigabe der sieben zusätzlichen Gruppen sind nicht belegt. Firestore TTL ist asynchron, löscht nicht transaktional und nicht rekursiv Subcollections. | [#70](https://github.com/Veselin-Takev/Klar-Dating/issues/70), [Draft #312](https://github.com/Veselin-Takev/Klar-Dating/pull/312), `scripts/configure-retention.sh` | DPO/Legal/SRE: signierte 20er Matrix, read-only echte scoped ACTIVE-Evidenz, Subcollection-/Hold- und Art.-17-Tests |
| **K-E2E-04** | **P0** | Tenant-Isolation | Die separate Multi-Tenant-Foundation [Draft #253](https://github.com/Veselin-Takev/Klar-Dating/pull/253) ist nicht global montiert. `main` enthält überwiegend flache `users/chats/subscriptions/verification_events`-Pfadkonzepte. Kein belegtes Legacy→Tenant-Mapping oder vollständige BOLA-/Storage-Isolation. | [#254](https://github.com/Veselin-Takev/Klar-Dating/issues/254), [Draft #311](https://github.com/Veselin-Takev/Klar-Dating/pull/311), `firestore.rules` | Principal Architect/AppSec/DPO: verbindlicher Claim→Membership-Check, kein Default-Tenant, read-only Mapping, BOLA-Negative, migration/write-fence/rollback proof |
| **K-E2E-05** | **P0** | Human Release Governance | Live-RuleSet #25756841 ist aktiv und verlangt strikten `validate`-Check; `required_approving_review_count=0`, `require_code_owner_review=false`, `dismiss_stale_reviews_on_push=false`, `required_review_thread_resolution=false`. CODEOWNERS benennt überwiegend denselben technischen Account, keine unabhängige Approval-Evidenz. | [Ruleset](https://github.com/Veselin-Takev/Klar-Dating/rules/25756841), [#73](https://github.com/Veselin-Takev/Klar-Dating/issues/73), `CODEOWNERS` | Repo-Admin/Security/ReleaseOwner: unabhängige zulässige Reviewer, verpflichtende Approvals inkl. Stale-/Thread-Schutz; sicherer Negativ-Merge-Test; verifizierter Exact-SHA |
| **K-E2E-06** | **P0** | Operations/Release | `RELEASE_MANIFEST.json` meldet `decision=NO-GO`, `productionApproved=false`, historischen `reviewCandidateSha`; `GO_LIVE_CHECKLIST.md` bleibt unvollständig. Keine echte Cloud-Run-/Secret-/Pager-/Canary-/Rollback-/Recovery-Evidenz vorgelegt. | [#8](https://github.com/Veselin-Takev/Klar-Dating/issues/8); `phase2_work/docs/PRODUCTION_CONTROLS_AUDIT.md` | SRE/ReleaseOwner: tatsächliche Revision-/ServiceAccount-/Secrets-/Alert- und Rollback/DR-Übungen mit unveränderlicher Evidenz |
| **K-E2E-07** | **P0** | B2B Conversion Fraud | Signierter Partner-Webhook belegt einen Schlüsselinhaber, jedoch nicht unabhängig einen realen Kauf oder die behauptete Buyer-UID. Monetarisierte Conversions dürfen ohne unabhängige Server-Bindung nicht kreditiert werden. | [#55](https://github.com/Veselin-Takev/Klar-Dating/issues/55); `src/server/routes/partnerReferrals.ts` | Product/Security/Finance: signed purchase-binding, Self-Referral-/Replay-/Refund-Reconciliation, 10x duplicate & parallel claim tests; bis dahin B2B-Conversion-Feature disable mit überprüfter serverseitiger Kill-Switch-Evidenz |
| **K-E2E-08** | **P0** | B2B Datenschutz/Art.17 | Partner-Trackingtoken, pseudonyme Ledger, Drittanbieter-Redirect und ungeklärte Retention/Legal-Hold-/Controller-Rollen; vollständige Art.-17-Kaskade nicht für deployte Umgebung belegt. | [#56](https://github.com/Veselin-Takev/Klar-Dating/issues/56), `docs/DATA_RETENTION.md` | DPO/Legal/Security: Rechtsgrundlagen, Empfänger-/Transfer-/Consent-Register, Audit/Revocation und echte Kaskadenbelege |
| **K-E2E-09** | **P1** | Profil-Storage Rules | `storage.rules:34-38` erlaubt `profiles/{uid}` `read: if signedIn()`. Das separate `storageRulesEngine.ts` verlangt Adult-/Owner-Zustand. Bestehende Regeln und Sicherheitsmodell widersprechen sich. | [#204](https://github.com/Veselin-Takev/Klar-Dating/issues/204) | AppSec/DPO/Product: verbindliche Sichtbarkeitspolicy, wirksame Rules/Emulator-Negativtests, block/deleted/adult/unknown Zustand |
| **K-E2E-10** | **P1** | Profilbild-Token | `getDownloadURL`-basierte persistierte Bild-URLs können als langlebige Bearer-Links außerhalb von Viewer-Rules weitergegeben werden; Client-Rules-Änderung allein widerruft diese nicht. | [#206](https://github.com/Veselin-Takev/Klar-Dating/issues/206) | Security/DPO: autorisierte dynamische Media-Lesepfade, Legacy-Token-Revocation, Cache/Referer/Logs-Negativtest |
| **K-E2E-11** | **P1** | Supply Chain/SCA | CI-Pins für Node 22.23.3 und Bun 1.4.4 sowie Build/SBOM-/Attestation-Code existieren. Ein aktueller unabhängiger vollständiger SCA-/OSV-/Gitleaks-/Semgrep-/Lizenz- und Release-SBOM-PASS mit unveränderlichem Artefakt ist hier **nicht nachgewiesen**. Historische Advisory-Zähler sind keine aktuelle Aussage. | `.github/workflows/ci.yml`, `release.yml`, `RELEASE_MANIFEST.json` | DevSecOps: exakte Lock-/SBOM-/Provenance-/License-/Critical-High-Berichte, akzeptierte Ausnahmen mit Frist, Artifact-Binding |
| **K-E2E-12** | **P1** | Observability/Resilience | `ops/slo.json` nennt 30 Tage, API-P95 300 ms und Error-Budget-/Burn-Rate-Ziele. `observability.ts` liest den Policywert, aber kein produktives 30-Tage-Fleet-Histogramm, echter Alarmempfang oder SRE-Restore-/Chaos-Test belegt. Alte #71-Abweichung darf nicht ohne aktuellen Source-Vergleich als noch aktiver Hardcode bezeichnet werden. | [#71](https://github.com/Veselin-Takev/Klar-Dating/issues/71), [#8](https://github.com/Veselin-Takev/Klar-Dating/issues/8) | SRE: kanonische fleet-aggregation, Pager/On-Call-Ack, Firestore-Failure-/Quota-/Recovery-/Lasttests mit Kosten |
| **K-E2E-13** | **P1** | Didit Profile UX | Server-`diditKyc.ts` enthält HMAC/Timing-safe- und Server-Status-Pfade, aber die aktive Profil-Refresh-UI ist in [#237](https://github.com/Veselin-Takev/Klar-Dating/issues/237) weiterhin auf einen retired HTTP-410-Endpunkt dokumentiert. Fix liegt auf Draft statt bestätigter Release-Basis. Kein KYC-Bypass belegt. | [#237](https://github.com/Veselin-Takev/Klar-Dating/issues/237), [Draft #295](https://github.com/Veselin-Takev/Klar-Dating/pull/295) | Product/QA: `/api/kyc/status`-Contract, strikt `approved`, Negative HTTP/Browser Tests auf exact Release |
| **K-E2E-14** | **P1** | KI-Governance | `docs/AI_ACT_CONFORMITY.md` kennzeichnet die Konformität selbst als offen. Featureweise AI-Act-Klassifikation, User-Transparenz/Interaktionshinweise, KI-Kompetenz, Human Oversight und unabhängige Datenschutzprüfung bedürfen umsetzungsbezogener Evidenz. Eine pauschale Hochrisiko-Klassifikation ist nicht begründet. | `docs/AI_ACT_CONFORMITY.md`, EU AI Act Art. 50 | CAIO/DPO/Legal/Product: Feature-/Model-/Prompt-Register, passende Risikoeinstufung, Consent-/Disclosure-/Logging-/Incident-Tests, Modelländerungs-Governance |
| **K-E2E-15** | **P1** | Test-/Release-Integration | Der erfolgreiche `validate`-CI-Job umfasst 32 Schritte inkl. Tests, Builds, Browser-Abnahme. Er ist nur für SHA `4ef6dde...` eines **Dokumentations-PRs** belegt. Der aktuelle `main`-/Release-Build und mehrere ungemergte P0-Feature-Branches haben davon keinen automatisch vererbbaren Status. | [CI #41474462939](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41474462939), [PR #312](https://github.com/Veselin-Takev/Klar-Dating/pull/312) | QA/ReleaseOwner: sequenzieller Merge-Plan; jede finale Integrations-SHA plus native Emulator-/Browser-/Security-Gates ohne Skips verifizieren |
| **K-E2E-16** | **P2** | UX/A11y/Offline/i18n | CI prüft Browserflüsse, aber es liegt kein versionsgebundenes manuelles Gerät-/Screenreader-/WCAG-2.2-/Offline-Sync-Protokoll für DE/EN/ES/FR und die sechs App-Bereiche vor. | `GO_LIVE_CHECKLIST.md`, `playwright.config.ts` | QA/Accessibility: reproduzierbare Geräte-/A11y-/Offline-Testmatrix, Release-Blocking nur bei kritischem User Impact |
| **K-E2E-17** | **P2** | TCO/FinOps | Token-/Request-Metriken und TTL-Kostenmechanismen existieren. Keine geprüften Last-/Quota-/Cloud-Run-/Firestore-/Gemini-Kostenbudgets unter Produktions-Peak und keine dokumentierte Kostenfreigabe der Partnerpiloten. | `observability.ts`, [#58](https://github.com/Veselin-Takev/Klar-Dating/issues/58) | SRE/Finance: Sizing, Peak-/10x-Lastprofil, Budget-Alerts, Kostenobergrenzen und Kill-Switch-Verifikation |

**Übergreifendes Urteil:** Acht P0, sieben P1 und zwei P2 als **auditbezogene Kontroll-/Evidenzbefunde**. Dies ist keine Zahl nachgewiesener exploitable Vulnerabilities; viele Findings betreffen fehlende externe Nachweise oder unintegrierte Drafts.

## 4. End-to-End-Abläufe: Abnahmematrix

| Geschäftskritischer Flow | Erwartete Testkette / Negativfälle | Tatsächlich unabhängig bestätigter Stand |
| --- | --- | --- |
| Registrierung → Auth/Consent → Persistenz → Logout | Revocation, Race, Offline-Queue, Session-Leak, Auth Emulator; anonyme/minderjährige Konten denied | CI-/Source-Level, echter finaler Staging-/Live-Einsatz **NOT VERIFIED** |
| KYC Didit → Webhook → State → Medien-Löschung | Signatur/Replay, Re-auth, Pending-vs-approved, Hold, CAS 404/412, Crash-Retry, Receipt | Quellkontrollen teils vorhanden, vollständige reale GCS-/Didit-/Reconciliation-E2E **BLOCKED** |
| Chat → Berechtigung → Translate → Art.17 | Cross-User/Same-Tenant IDOR, Block/Revocation, UI/Offline, redigierte KI-/Trace-Daten | CI teilweise; release-gebundene negative End-to-End-Abdeckung **NOT CERTIFIED** |
| Klar+ Stripe → Kündigung §312k → Refund | Fehlzahlung, Webhook-Idempotenz, Widerruf, Ledger, Kündigungsbestätigung, Mail-Ausfall | Source vorhanden, provider-/rechtlich bestätigte Staging-Evidenz **NOT VERIFIED** |
| Referral → Consent → Partner → Conversion → Refund | Signierter Event, unabhängige Buyer-/Purchase-Bindung, 10x Replay, Self-referral, Cascade | [#55/#56/#58] offen; monetarisierter Pilot **BLOCKED** |
| Tenant Onboarding → Request → Firestore/Storage → Migration | Claim+DB-Membership, Cross-/Same-Tenant BOLA, Fall-back deny, Rollback, Art17 | [#254] offen; globaler Cutover **BLOCKED** |
| Release → Artifact → Canary → Monitoring → Rollback | Immutable digest + SBOM, signed approvals, staged exercise, actual alert delivery, rollback | [#8] offen; **NO-GO** |

## 5. Maßnahmenplan und Reihenfolge

1. **P0 Containment:** Vor jeder Live-Freigabe Istzustand der ausgerollten Schedulers, Cloud Functions, Storage Rules, IAM, produktiven Image-Revision und relevanten Feature Flags **read-only** sichern. Bei bestätigter Exposition Incident-/Change-Management aktivieren, aber niemals aus Audit-Text automatisch live löschen/deaktivieren.
2. **P0 #202:** Legacy-Uploadalter-Worker nur nach kontrolliertem Migrations-/Rollback-Plan stilllegen, aktive Purge-Implementierung generation-bound und receipt-aware machen; 404/412/Crash/Timeout/Parallel-Races, Legal Holds, >300 und idempotente Reconciliation auf echter freigegebener Staging-Umgebung beweisen. Stacked Drafts nur sequenziell und nach Review integrieren.
3. **P0 #70:** DPO/Legal/Operations bestätigen vollständige 20er-Retentionmatrix inklusive Aufbewahrungsausnahmen/Legal Holds; scoped read-only Live-Inventur; keine `gcloud ... update` ohne gesonderten genehmigten Change; Daten-/Subcollection-Kaskaden beweisen.
4. **P0 #254:** autoritatives Legacy→Tenant-Dry-Run-Mapping ohne Default-Tenant, Audit-Quarantäne, IAM/RBAC-/BOLA-/Storage-/Art17-Negativtests; dann erst schrittweiser kontrollierter Cutover. Kein globales Middleware-On ohne Migration.
5. **Governance:** GitHub-Ruleset auf unabhängige Approvals und CODEOWNERS-Review umstellen, verifizierte Reviewer-Rechte, stale-push/thread safeguards und Negativ-Merge-Test; keine Eigenfreigabe durch denselben technischen Account.
6. **Geschäfts-/Privacy-Scope:** Entweder B2B-Conversions, Referral-Rewards und problematische Profilbild-Exposition **nachweislich serverseitig deaktivieren** (mit Policy-/Legal-Freigabe) oder #55/#56/#48/#204/#206 separat zum PASS führen.
7. **Quality & Supply Chain:** Einen autoritativen finalen Integrations-Commit bilden; Node 22.23.3, Bun 1.4.4, Functions, Lint, Typecheck, SCA/License/SBOM/Gitleaks/Semgrep, Auth/Firestore/Storage Emulator, Browser und Contract/Failure-/10x-Lasttests ohne Skips archivieren.
8. **Operations/Release:** Live-Cloud Run/SecretManager/IAM/TTL-/Rules-Konfiguration, Actual Alert-Pager-Ack, Canary-/Rollback-/Restore-Übungen, deployed SHA→Digest→SBOM→Manifest, TCO und Datenschutz-Releasesignaturen bei den jeweiligen Fachverantwortlichen belegen.

**Änderungsdisziplin:** Nur dedizierte Feature-Branches; kein Direktcommit auf `main`, keine blinden Merges; Draft-Stack zuerst parent→child, nach jedem Merge vollständige neue CI auf verändertem Integrations-SHA. CI grün = technische Voraussetzung, nicht automatisches GO.

## 6. Offizielle Release-Gates (alle Pflicht)

| Gate | Evidenzbeispiel | Aktueller Stand |
| --- | --- | --- |
| G-01 Exact source | Schutz von `main`, Codeowner-Reviews, immutable audited SHA | **FAIL/UNVERIFIED** (0 erzwungene Approvals) |
| G-02 Static/SCA | vollständige SAST/SCA/Gitleaks/SBOM/Lizenz/Secrets für finalen SHA | **NOT VERIFIED** |
| G-03 Dynamic QA | native Auth/Firestore/Storage Emulator, KYC/Payments/Art17/BOLA, E2E, negative fault injection | **NOT COMPLETE** |
| G-04 Data & Privacy | TTL 20/20 Live ACTIVE, Storage-Hold-/GCS-Receipt-/Art17-Nachweise | **BLOCKED** |
| G-05 Tenant & Access | autoritatives Mapping und Client/Admin SDK-/Storage-BOLA, Revision/Rollback | **BLOCKED** |
| G-06 AI & Consumer Legal | DPO/Legal: AI Act Featurematrix, Consent, §312k, Art. 5/9/17 DSGVO, Partnertracking | **PENDING** |
| G-07 Production Operations | Cloud IAM/Secrets, Monitoring/Delivery, SLO, Last, Restore, Canary/Rollback, Kosten | **PENDING** |
| G-08 Independent GO | Security + DPO + Legal + SRE + Finance (bei Abrechnung) + Release Owner, alle exakt signiert | **PENDING** |

**Entscheidungsregel:** GO nur, wenn keine release-scope-kritischen P0/P1-Gates offen sind, alle anwendbaren Gate-Nachweise frisch und referenziert vorliegen, Reviewer nicht zugleich ausschließlich Implementierer sind, SHA und Deploy-Artefakt übereinstimmen und der Release Owner explizit schriftlich freigibt. Ansonsten `productionApproved=false`. Nie GO aus einem GitHub-Draft, einer grünen CI oder einem unbestätigten PDF ableiten.

## 7. Normativer Referenzrahmen (nicht als Zertifizierung auszulegen)

- OWASP [ASVS 5.0.0](https://asvs.owasp.org/) – Application Security Verification Requirements, insbesondere Auth, Access Control, API, Files, Logging und Config.
- NIST [SP 800-218 SSDF v1.1](https://csrc.nist.gov/pubs/sp/800/218/final) – Secure Software Development / Lieferketten-Evidenz; Revision 1.2 wurde als Draft veröffentlicht und wird hier nicht als fertiger Standard ausgegeben.
- [DSGVO (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj) – Art. 5 (Speicherbegrenzung/Rechenschaft), Art. 9 (besondere Kategorien), Art. 17 (Löschung), Art. 25/32 (Privacy by Design/Sicherheit), Art. 35 (DSFA-Screening nach Risiko). Juristische Subsumtion und gesetzliche Ausnahmen: DPO/Legal.
- [EU AI Act – offizielle Anwendungstermine](https://ai-act-service-desk.ec.europa.eu/en/ai-act/eu-ai-act-implementation-timeline) und [Art. 50](https://ai-act-service-desk.ec.europa.eu/de/ai-act/article-50); Regeln gelten stufenweise. Featurebezogene Risikoklassifikation, Transparenz und verantwortliche Rollen sind zu bestimmen; keine pauschale High-Risk-Behauptung. [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework) als Governance-Orientierung.
- [Google Cloud Firestore TTL](https://docs.cloud.google.com/firestore/native/docs/ttl) – nicht sofort, nicht rekursiv, nicht transaktional; aktivierte Policy auf Altbestand kann Bulk-Löschung auslösen. 
- NIS-2-Relevanz und etwaige nationale Betreiberpflichten müssen mit Legal anhand **Unternehmensgröße, Tätigkeit und aktueller Umsetzungslage** bestimmt werden; das Repository allein beweist keine unmittelbare NIS-2-Unterworfenheit.

## 8. Methodische Einschränkungen und Audit-Unabhängigkeit

Dies ist eine **breite E2E-Kontrollprüfung von Repository-Evidenz**, aber kein Nachweis, dass jeder Quellpfad, jeder Drittanbieter, alle Builds und jede Cloud-Laufzeit vollständig dynamisch geprüft wurden. Keine tatsächlichen Produktionszugänge, privaten Secrets, Kundenbestände, Pentest-Konten, eingesetzten Rule-Versionen, Logs des realen GCS-Providers, Echtzeit-Latenzen oder unabhängigen rechtlichen Attestationen standen für dieses Audit zur Verfügung. Security-Befunde aus offenem GitHub-Code sind **keine Bestätigung** eines realen Data Breach. Kein CVSS, Audit-PASS-Prozentsatz oder eine Rest-Risiko-Zahl wird ohne Grundlage erfunden.

Die durch diesen Audit-Branch vorgenommenen Änderungen sind **dokumentarisch**; weder Fixes der P0-Bugs noch Cloud-Konfiguration, aktiver Sicherheitsregeln, `main`, Deployments oder Kunden-Daten. Die Dokumentation ist ein **Review-Kandidat** und benötigt selbst exakte CI und unabhängige Annahme.

**Finale Audit-Entscheidung vom 2026-11-02: PRODUCTION READINESS NO-GO / BLOCKED.** Nächste Abnahme nur über nachweisbasierte, unabhängige Freigaben des finalen integrierten Release-SHA.


## Live exact-head checkpoint — 2026-11-11 02:13 CET

- Current `main` HEAD is `2fa3ba223989ff248ad1abaea67f4f454f7c9f6b`; exact `validate` run [42710429488](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710429488), job `129478192916`, is completed/success.
- Fresh open-PR inventory: 194 open (192 Draft, 2 non-Draft); the six requested Drafts #251/#269/#203/#253/#313/#314 each have 0 reviews and are 2 commits behind main. Exact current heads, per-SHA CI/job results, ahead/behind counts, Vercel statuses, stack counts and issue state are recorded in `OPEN_PR_TRIAGE_2026-11-02.md` and `OPEN_PR_INVENTORY_2026-11-02.json` on this review branch.
- #315 is closed/unmerged; its replacement open Dependabot PR #361 fails the exact-head provenance gate. Non-Draft RC1 #358 fails the exact-head browser consent-withdrawal test (28 pass / 1 fail). #314's `validate` is green but its Vercel status remains `failure/build-rate-limit`.
- Main still contains the upload-age verification-photo worker; TTL code enumerates 20 groups but live 20/20 ACTIVE evidence is absent; tenant middleware is not mounted; profile-image rules remain signed-in-only and `getDownloadURL()` remains persisted. Issues #202/#70/#254/#8/#73/#55/#56/#204/#206 remain open.
- Active Ruleset #25756841 still requires 0 approvals and no CODEOWNERS review. Klar Vercel project exists and a production-target READY deployment is bound to this main SHA, but project metadata says `live=false`; neither is a release attestation.

**Decision remains `productionApproved=false`, BLOCKED / NO-GO.** No independent Security/AppSec, DPO/Legal, SRE, Finance (where applicable) and Release Owner approvals or complete E3/E4 operational evidence were found. No production changes or merges were made. This documentation-only checkpoint itself must pass CI on its new exact commit before being treated as technically validated.


## Live exact-head checkpoint — 2026-11-11 05:40 CET

The fresh GitHub read confirms main remains 2fa3ba223989ff248ad1abaea67f4f454f7c9f6b with exact validate run [42710429488](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710429488) completed/success. The open-PR inventory is now 194 (192 Draft, 2 non-Draft); the previous 153-PR snapshot is obsolete. Exact-head checks for #251/#269/#203/#253/#313/#314 are green, but all six remain Draft, have zero submitted reviews and are two commits behind current main. #269/#203 retain six changed-file overlaps. #315 is closed/unmerged; replacement #361 fails the exact-head signed-provenance gate. Non-Draft #358 fails the exact-head consent-withdrawal browser test (28/29, Firestore PERMISSION_DENIED). The active Ruleset #25756841 still enforces zero required approvals and no CODEOWNERS review. Main source still contains the age-based verification-photo worker; TTL/tenant/live operations and independent legal/security/SRE/release attestations remain unproven. Klar's Vercel project exists; current-main production-target deployment is READY but project metadata says live=false. The deleted login-page-prototype still returns 404 and is absent from the team list. **Decision unchanged: productionApproved=false, BLOCKED / NO-GO.** This checkpoint is documentation-only on the existing audit review branch.


## Live exact-head checkpoint — 2026-11-11 08:12 CET

**Current main:** `2fa3ba223989ff248ad1abaea67f4f454f7c9f6b`. Its exact `validate` check is run [42710429488](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710429488), job `129478192916`, `completed/success`; the Vercel commit status for this SHA is `success`. This is a successful main build/deployment status, not a production-readiness attestation.

**Fresh open-PR inventory:** 194 open PRs: 192 Drafts and 2 non-Drafts (#358, #361). 50 target `main`, 144 target other branches; 141 bases match another open PR head, 3 do not; maximum open-PR chain depth is 35. The previous 153-PR inventory is historical. Full SHA-bound inventory is in `OPEN_PR_INVENTORY_2026-11-02.json`.

| PR | Exact current head | Ahead / behind main | Exact validate run / job | Result | Reviews |
|---|---|---:|---|---|---:|
| #251 Governance | `fc03f33996ccffc73e54e6b7a6fb05914cdcbc53` | 10 / 2 | [42818199684](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42818199684) / `129836618469` | SUCCESS | 0 |
| #269 Legacy purge | `fd68656957c01618c3a085e887ece504624d18b3` | 33 / 2 | [42020003801](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42020003801) / `127220743813` | SUCCESS | 0 |
| #203 Decision purge | `1850e0a78b22e600e5add99273b84c081ffc3892` | 57 / 2 | [42017264009](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42017264009) / `127211414732` | SUCCESS | 0 |
| #253 Multi-Tenant | `036ee313747a7beb2ab926e721e3bef958304447` | 11 / 2 | [41539994863](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41539994863) / `125601704190` | SUCCESS | 0 |
| #313 Enterprise audit | `ebff2580566372e6c10dcc3f994baa332d455959` | 89 / 2 | [42961392549](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42961392549) / `130328510627` | SUCCESS | 0 |
| #314 Vercel | `e5deab1dfd629065f3dfce3a5577eb21ac966a68` | 3 / 2 | [41619572341](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41619572341) / `125861548924` | SUCCESS | 0 |
| #315 Dependabot attest | `71743b14c66d9c5f2fdca2ed73a0fda3c137d48d` (closed, unmerged) | — | [41531498018](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41531498018) / `125572558770` | FAILURE: Enterprise static gates | 1 owner approval; not independent |

All six open target Drafts are two commits behind current `main`; their green checks apply only to the exact heads above. #269 and #203 still have six overlapping files and must not be merged blindly. #315 remains closed/unmerged; replacement Draft #316 (`b1b669ed5e80a6572dc60bdbbbc08e02650283be`) has exact CI run `41596122104`, job `125783766115`, `SUCCESS`, but the provenance/attestation change is not yet integrated into `main`.

**Additional current blockers and containment work:** non-Draft #358 head `1321c42ffe1c5919c1baccaada66a650ab811f93` fails [run 42710380877](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710380877), job `129478019942`, at Browser acceptance (28/29; consent-withdrawal confirmation returns a generic failure after Firestore `PERMISSION_DENIED`); zero reviews. Non-Draft #361 head `2f90d9fef013f7a7f070a3624cadd5fd62e914ff` fails [run 42705724751](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42705724751), job `129461862107`, at Enterprise static gates because the required GitHub-signed provenance attestation bound to the immutable image digest is absent; zero reviews.

New P0 containment drafts #348 (`a7b6e574086d02fd9ea28868b061c7072ed84f5c`) and #353 (`c653efd6984f573ab0443bdd3723ca37f63fa320`) have exact CI runs [42424069834](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42424069834) / job `128558460382` and [42460900607](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42460900607) / job `128669779420`, both `SUCCESS`, with zero submitted reviews. #348 adds a production hard stop returning 503 before Firestore/GCS access while all-writer fencing is unverified. #353 adds Firestore hold checks, malformed GCS metadata rejection and a mandatory pre-delete callback while preserving that hard stop. These are unmerged Drafts: the documented late-hold-after-final-authorization race and external-writer bypass remain unresolved; a passing branch pipeline proves the interlock only, not safe cross-service deletion.

**Live Ruleset #25756841:** active on `refs/heads/main`; required status `validate` with strict policy; `required_approving_review_count=0`, `require_code_owner_review=false`, `dismiss_stale_reviews_on_push=false`, `require_last_push_approval=false`, `required_review_thread_resolution=false`, `require_extra_approval_for_unattributed_changes=true`, no bypass actors. Main `CODEOWNERS` assigns technical ownership to the repository owner and explicitly does not certify independent Security/Finance approval.

**Current main-source evidence:** `deleteExpiredPhotosCron` remains exported and scheduled every 24 hours; `retention.ts` still deletes `verification/` objects by Storage `timeCreated` older than 30 days with generation/hold checks but without moderation-decision or `fotoLoeschenAb` binding. `index.ts` exports both the legacy worker and the separate `purgeVerificationStorageCron` (scheduled daily at 03:00 UTC). This is a source/configuration finding, not proof either Scheduler is currently enabled in production. The TTL script has a 20-group staging/project/matrix preflight and dry-run path, but no actual 20/20 `ACTIVE` readback was verified. `storage.rules` still allows profile reads with `signedIn()` alone; `klar.ts` persists `getDownloadURL()` as `users/{uid}.photoURL`.

**Vercel read-only:** project `klar-dating` (`prj_9dEo2EJIDfmkx6JCS0BqwtF9fXre`) exists. A READY deployment with `target=production` is bound to the exact current main SHA; project metadata reports `live=false` and Node `26.x`, while `phase2_work/RELEASE_MANIFEST.json` pins Node `22.23.3` and retains `decision=NO-GO`, `productionApproved=false`. The exact #313 head has a READY preview with `target=null`; #314 has zero deployments for its exact head. No project settings were changed. Prior 404/absence evidence for `login-page-prototype` remains documented; no deletion was retried. Neon/Postgres/Better-Auth credentials were not accessed, rotated or revoked.

All nine watched issues (#202, #70, #254, #8, #73, #55, #56, #204, #206) remain open. No exact integrated release SHA has complete purge/receipt/race, TTL/legal-hold/Art.-17, tenant/BOLA, production-operations evidence and independent Security/AppSec, DPO/Legal, SRE, Finance (where applicable) and Release Owner approvals. **Decision remains `productionApproved=false`, BLOCKED / NO-GO.** This checkpoint is documentation-only; the resulting new #313 head must pass its own exact-head CI before it is treated as technically validated.



## Live release-watch checkpoint — 2026-11-11 12:29 CET

**Fresh, independently re-read baseline:** main is still 2fa3ba223989ff248ad1abaea67f4f454f7c9f6b (commit signature verified). Its exact validate run [42710429488](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710429488), job 129478192916, is completed/success; every required job step passed. The separate Vercel commit status is success. This is build/deployment evidence, not production-readiness approval.

### Exact open-PR inventory and stack topology

The GitHub REST pull-request collection was paginated in full: **194 open PRs, 192 Drafts, 2 non-Drafts** (#358 and #361). **50** target main, **144** target other branches; **141** non-main bases match another open PR head; **3** have no open parent (#213/#214/#219); maximum observed stack depth is **35**. The regenerated [OPEN_PR_INVENTORY_2026-11-11.json](OPEN_PR_INVENTORY_2026-11-11.json) contains all 194 exact head/base SHAs and stack depths. The previous 153/152/1 snapshot is obsolete.

The inventory records #313 at pre-update head 8ff7f42e765468189c68cd9cd0ba29f715226e58, the head at snapshot generation. Because this snapshot is committed to PR #313 itself, the resulting commit will advance #313; the post-commit PR API head and its own CI must be read separately. No self-referential SHA is claimed.

| PR | State | Exact head SHA | Ahead / behind current main | Exact validate run / job | Result | Submitted reviews |
|---|---|---|---:|---|---|---:|
| [#251 Governance](https://github.com/Veselin-Takev/Klar-Dating/pull/251) | Draft | fc03f33996ccffc73e54e6b7a6fb05914cdcbc53 | 10 / 2 | [42818199684](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42818199684) / 129836618469 | SUCCESS | 0 |
| [#269 Legacy-photo purge](https://github.com/Veselin-Takev/Klar-Dating/pull/269) | Draft | fd68656957c01618c3a085e887ece504624d18b3 | 33 / 2 | [42020003801](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42020003801) / 127220743813 | SUCCESS | 0 |
| [#203 Decision/generation purge](https://github.com/Veselin-Takev/Klar-Dating/pull/203) | Draft | 1850e0a78b22e600e5add99273b84c081ffc3892 | 57 / 2 | [42017264009](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42017264009) / 127211414732 | SUCCESS | 0 |
| [#253 Multi-Tenant](https://github.com/Veselin-Takev/Klar-Dating/pull/253) | Draft | 036ee313747a7beb2ab926e721e3bef958304447 | 11 / 2 | [41539994863](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41539994863) / 125601704190 | SUCCESS | 0 |
| [#313 Enterprise audit](https://github.com/Veselin-Takev/Klar-Dating/pull/313) | Draft | 8ff7f42e765468189c68cd9cd0ba29f715226e58 | 91 / 2 | [43006636089](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/43006636089) / 130475637841 | SUCCESS | 0 |
| [#314 Vercel evidence](https://github.com/Veselin-Takev/Klar-Dating/pull/314) | Draft | e5deab1dfd629065f3dfce3a5577eb21ac966a68 | 3 / 2 | [41619572341](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41619572341) / 125861548924 | SUCCESS; Vercel status FAILURE (build-rate-limit) | 0 |

All six open target Drafts are two commits behind current main and have no submitted review. Their green CI applies only to the exact heads above. #269 and #203 still overlap in six files: DATA_RETENTION.md, deleteExpiredPhotos.ts, retention.ts, package.json, photoRetention.spec.ts, and storageRules.spec.ts; no blind merge or simultaneous integration.

**Dependabot / non-Drafts:**
- [#315](https://github.com/Veselin-Takev/Klar-Dating/pull/315) is closed and unmerged, head 71743b14c66d9c5f2fdca2ed73a0fda3c137d48d; exact run [41531498018](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41531498018), job 125572558770, FAILURE. Its only APPROVED review was the repository owner’s self-approval, not independent.
- [#361](https://github.com/Veselin-Takev/Klar-Dating/pull/361) is the current open non-Draft Dependabot PR, head 2f90d9fef013f7a7f070a3624cadd5fd62e914ff, 1 ahead / 2 behind main, 0 reviews. Exact run [42705724751](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42705724751), job 129461862107, FAILURE in Enterprise static gates: check:release-workflow requires a GitHub-signed provenance attestation bound to the immutable image digest; that attestation is absent.
- [#358](https://github.com/Veselin-Takev/Klar-Dating/pull/358) is the other open non-Draft, targeting release/v0.1.1-rc1 at base 4a3acd90adfa6e781ce92990589fe01585c4b1e5; head 1321c42ffe1c5919c1baccaada66a650ab811f93, 50 ahead / 0 behind that base, 350 changed files, 0 reviews. Exact run [42710380877](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710380877), job 129478019942, FAILURE in Browser acceptance: 28/29 passed. The consent-withdrawal test expected “Einwilligung wurde widerrufen.” but received “Die Änderung konnte nicht bestätigt werden. Bitte erneut versuchen.” Logs also show Firestore PERMISSION_DENIED; root cause remains to be isolated. The title’s “1636 PASS” is not evidence for this exact head.

### Ruleset, issues and source-verified blockers

Live [Ruleset #25756841](https://github.com/Veselin-Takev/Klar-Dating/rules/25756841) remains active on refs/heads/main. It requires strict validate, prevents branch deletion and non-fast-forward, and has no bypass actors; it still requires **0 approvals**, require_code_owner_review=false, no stale-review dismissal, no last-push approval and no review-thread-resolution requirement.

All nine watched issues remain OPEN: #202, #70, #254, #8, #73, #55, #56, #204 and #206.

- **#202 P0:** Main still exports and schedules deleteExpiredPhotosCron every 24 hours. retention.ts lists verification/ and deletes objects older than 30 days by Storage timeCreated, with generation/hold checks but no moderation-decision/fotoLoeschenAb binding. The separate decision-based route does not remove the legacy worker. This is a source finding, not proof that the production Scheduler is enabled.
- **#70 P0:** Main TTL provisioner enumerates 20 groups, defaults to dry-run, requires explicitly approved staging/project/database/matrix gates and reads existing policies before writes. No live, project/database-bound 20/20 ACTIVE readback or independently approved Legal-Hold matrix was obtained.
- **#254 P0:** #253 remains unmerged; current main phase2_work/server.ts contains no tenant middleware reference. Legacy mapping, full BOLA/IDOR/Art.17 emulator coverage and live cutover evidence remain absent.
- **#8/#73 P0/P1:** independent approvals are not enforced; production IAM, alert delivery/on-call, canary, restore/RTO/RPO and SLO evidence remains missing.
- **#55/#56 P0 where partner monetization is in scope:** signed webhook provenance does not independently prove the real purchase/buyer; tracking legal basis, token revocation, refund/replay reconciliation and partner retention/Art.17 approvals remain open.
- **#204/#206 P1:** current storage.rules still permits profile-image reads with signedIn() alone; klar.ts persists Firebase getDownloadURL() as users/{uid}.photoURL. These are source-level access-control risks, not evidence of live exploitation.

### Vercel and release decision

Read-only Vercel team listing returns exactly one project: Klar klar-dating / prj_9dEo2EJIDfmkx6JCS0BqwtF9fXre. A production-target deployment [dpl_AJRgtKhyoF4B8ypLkXBF8vMzw32w](https://vercel.com/ves3/klar-dating/AJRgtKhyoF4B8ypLkXBF8vMzw32w) is READY and bound to current main SHA 2fa3ba223989ff248ad1abaea67f4f454f7c9f6b. Project metadata still reports live=false and Node 26.x; phase2_work/RELEASE_MANIFEST.json pins Node 22.23.3. READY deployment metadata is not proof of traffic, runtime health or release approval. The exact #313 head has a READY preview with target=null; #314 has no deployment for its exact head and its Vercel status is failure/build-rate-limit. The previously confirmed login-page-prototype deletion was not retried; the current team list contains only Klar. Neon/Postgres/Better-Auth credentials were not accessed, rotated or revoked.

**Decision:** productionApproved=false, **BLOCKED / NO-GO**. No exact integrated release SHA has complete purge/receipt/race, 20/20 TTL/legal-hold/Art.17, tenant/BOLA and production-operations evidence plus independent Security/AppSec, DPO/Legal, SRE, Finance (where applicable) and Release Owner approvals. No main commit, merge, deployment, secret access or production Firebase/GCS/IAM/Scheduler/database mutation was performed. This is a documentation-only update on the existing audit review branch; the resulting new #313 head must pass its own exact-head CI.


## Live-Revalidierung 2026-11-11 13:56 CET

**Frischer Main-Stand:** `2fa3ba223989ff248ad1abaea67f4f454f7c9f6b`. Der aktuelle Main-Check `validate` ist [Run 42710429488 / Job 129478192916](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710429488/job/129478192916), `completed/success`; der Commit-Status `Vercel` ist `success`. Das ist ein SHA-gebundener Build-/Deployment-Status, keine Betriebs- oder Datenschutzfreigabe.

### Exakte PR-Heads und CI

Alle sechs überwachten Drafts sind gegenüber dem frischen Main-HEAD jeweils **2 Commits behind**. Die nachstehenden Ergebnisse beziehen sich ausschließlich auf den jeweils genannten Head:

| PR | Exakter Head-SHA | Compare ahead/behind | Actions Run / Job | Job-Ergebnis |
|---|---|---:|---|---|
| #251 Governance | `fc03f33996ccffc73e54e6b7a6fb05914cdcbc53` | 10 / 2 | [42818199684](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42818199684) / 129836618469 | success |
| #269 Legacy-Purge | `fd68656957c01618c3a085e887ece504624d18b3` | 33 / 2 | [42020003801](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42020003801) / 127220743813 | success |
| #203 Decision-Purge | `1850e0a78b22e600e5add99273b84c081ffc3892` | 57 / 2 | [42017264009](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42017264009) / 127211414732 | success |
| #253 Multi-Tenant | `036ee313747a7beb2ab926e721e3bef958304447` | 11 / 2 | [41539994863](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41539994863) / 125601704190 | success |
| #313 Enterprise-Audit | `95fe7333132c5f4f62e5a164ebd57b8cd3ceb8df` | 92 / 2 | [43013469783](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/43013469783) / 130498591476 | success |
| #314 Vercel | `e5deab1dfd629065f3dfce3a5577eb21ac966a68` | 3 / 2 | [41619572341](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41619572341) / 125861548924 | success |

Alle sechs PRs haben **0 eingereichte Code-Reviews**. #313s exakter Head ist nun CI-grün; das ersetzt weder unabhängige Reviews noch die fehlenden E3/E4/E5-Nachweise. Vercel-Status auf #313 ist `success` (Preview `READY`, `target=null`); #314 meldet weiterhin `failure` mit `build-rate-limit`.

- #315 ist **closed, nicht gemergt**; sein Head war `71743b14c66d9c5f2fdca2ed73a0fda3c137d48d`.
- Der offene Nicht-Draft-Nachfolger #361 hat Head `2f90d9fef013f7a7f070a3624cadd5fd62e914ff`; [Run 42705724751 / Job 129461862107](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42705724751) ist `failure`. Der konkrete Blocker in `check:release-workflow`: der Production-Container-Release muss eine GitHub-signierte Provenance-Attestation erzeugen, die an den unveränderlichen Image-Digest gebunden ist. Keine Reviews.
- Zusätzlicher Nicht-Draft-RC-PR #358 (Base `release/v0.1.1-rc1`) hat Head `1321c42ffe1c5919c1baccaada66a650ab811f93`; [Run 42710380877 / Job 129478019942](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710380877) scheitert bei `Browser acceptance`. Playwright erwartet nach Widerruf den Status „Einwilligung wurde widerrufen.“; die Logs enthalten Firestore `PERMISSION_DENIED: No matching allow statements`. Die genaue Ursache ist noch zu isolieren. Vercel-Preview-Status ist success, aber das kompensiert den fehlgeschlagenen Browser-Test nicht. Keine Reviews.

### Inventar und Ruleset

Die vollständig paginierte GitHub-PR-Liste enthält **194 offene PRs: 192 Drafts und 2 Nicht-Drafts** (#358 und #361). 50 zielen direkt auf `main`, 144 auf andere Branches; 141 Bases entsprechen dem Head eines offenen PR. 53 Stack-Wurzeln, maximale Stack-Tiefe 35. Die maschinenlesbare Inventur `OPEN_PR_INVENTORY_2026-11-11.json` ist am selben Main-SHA `2fa3ba...` erzeugt und weist dieselben Zählwerte aus.

Ruleset [#25756841](https://github.com/Veselin-Takev/Klar-Dating/rules/25756841) ist aktiv und gilt für `refs/heads/main`. Es verlangt strikt den Statuscheck `validate`, verhindert Branch-Löschung und Non-Fast-Forward und hat keine Bypass-Akteure. Es verlangt aber **0 Approvals**, `require_code_owner_review=false`, keine Last-Push-Approval und keine Review-Thread-Auflösung.

### Aktuelle Source-Rechecks und Issue-Status

Alle neun Issues #202, #70, #254, #8, #73, #55, #56, #204 und #206 sind weiterhin OPEN.

- **#202 P0:** Main exportiert weiterhin `deleteExpiredPhotosCron`; der 24-Stunden-Cron ruft `deleteExpiredPhotoPage` auf. `retention.ts` löscht aus `verification/` bei `timeCreated` älter als 30 Tage und prüft Generation/Holds, aber keine Moderationsentscheidung/`fotoLoeschenAb`. Quellbefund, kein Nachweis eines aktiven produktiven Schedulers.
- **#70 P0:** Das Main-Skript führt 20 TTL-Gruppen auf, ist standardmäßig Dry-Run und sperrt Apply auf ausdrücklich bestätigtes Staging samt Projekt-/Datenbank-/Legal-/Inventar-Matrix. Es liegt weiterhin kein projektgebundener 20/20-`ACTIVE`-Cloud-Readback und kein unabhängiger Legal-Hold-Nachweis vor.
- **#254 P0:** `phase2_work/server.ts` enthält weiterhin keinen Tenant-Auth-/Middleware-Einstieg; #253 ist nicht gemergt. Mapping, vollständige Cross-Tenant-BOLA/IDOR-/Art.-17- und Live-Cutover-Evidenz fehlen.
- **#8/#73:** Ruleset erzwingt keine unabhängigen Reviews; Produktions-IAM, Alert-Zustellung/On-Call, Canary, Restore/RTO/RPO und SLO-Live-Nachweise bleiben offen.
- **#55/#56:** Käufer-/Kauf-Authentizität sowie Partnertracking-Rechtsgrundlage, Token-Widerruf und Retention/Art.-17-Freigabe bleiben offen, falls Partner-Monetarisierung im Release-Scope liegt.
- **#204 P1:** Main-`storage.rules` erlaubt Profilbild-Reads weiterhin mit `signedIn()` allein.
- **#206 P1:** Main-`klar.ts` speichert weiterhin `getDownloadURL()` als `users/{uid}.photoURL`. Beides sind Source-Risiken, kein Nachweis einer Live-Ausnutzung.

### Vercel-Read-only und Freigabe

Die authentisierte Team-Projektliste enthält genau ein Projekt: `klar-dating` / `prj_9dEo2EJIDfmkx6JCS0BqwtF9fXre`. Projektmetadaten melden `live=false` und Node `26.x`; das Main-Release-Manifest pinnt Node `22.23.3`. Das Production-Target-Deployment `dpl_AJRgtKhyoF4B8ypLkXBF8vMzw32w` ist `READY` und exakt an Main-SHA `2fa3ba...` gebunden. READY-Metadaten beweisen weder Nutzerverkehr noch Runtime-Health; die Live-/Node-Diskrepanz bleibt offen. Das bestätigte `login-page-prototype` wurde nicht erneut gelöscht; Provider-Zugangsdaten wurden nicht gelesen, rotiert oder widerrufen.

**Aktuelle Entscheidung bleibt BLOCKED / NO-GO; `productionApproved=false`.** Kein exakter integrierter Release-SHA erfüllt alle Purge-/Race-/Receipt-, TTL-/Legal-Hold-/Art.-17-, Tenant-/BOLA-, Betriebs- und unabhängigen Security-/DPO-/Legal-/SRE-/Finance-/Release-Owner-Gates. Diese Revalidierung ist ein Dokumentationsupdate auf dem bestehenden Audit-Review-Branch; ihr neuer Head benötigt erneut eigenen Exact-Head-CI. Keine Main-Änderung, kein Merge, Deployment oder produktive Cloud-/Datenbankmutation.


## Live release-watch checkpoint — 2026-11-11 14:30 CET

**Fresh main:** `2fa3ba223989ff248ad1abaea67f4f454f7c9f6b`. Repository `Veselin-Takev/Klar-Dating` exists, is public, and uses `main` as its default branch. Exact main push run [42710429488](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710429488), job `129478192916`, is `completed/success` on this SHA. GitHub's separate Vercel commit status is `success`. This is not production approval.

### Exact watched PR state, CI and review evidence

All six target Drafts still target `main` and are **2 commits behind** current main. Their previous `base_sha` remains `96c3857c53f5ced31fe1394895185f42c75bc716`; each requires a fresh integration comparison before any merge. The exact-head CI results below were read from the current PR heads and their workflow jobs:

| PR | State | Exact head SHA | Ahead / behind main | Exact Actions run / job | Job result | Vercel status | Submitted reviews |
|---|---|---|---:|---|---|---|---:|
| [#251 Governance](https://github.com/Veselin-Takev/Klar-Dating/pull/251) | Draft | `fc03f33996ccffc73e54e6b7a6fb05914cdcbc53` | 10 / 2 | [42818199684](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42818199684) / `129836618469` | success | success | 0 |
| [#269 Legacy-photo purge](https://github.com/Veselin-Takev/Klar-Dating/pull/269) | Draft | `fd68656957c01618c3a085e887ece504624d18b3` | 33 / 2 | [42020003801](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42020003801) / `127220743813` | success | success | 0 |
| [#203 Decision/generation purge](https://github.com/Veselin-Takev/Klar-Dating/pull/203) | Draft | `1850e0a78b22e600e5add99273b84c081ffc3892` | 57 / 2 | [42017264009](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42017264009) / `127211414732` | success | success | 0 |
| [#253 Multi-Tenant](https://github.com/Veselin-Takev/Klar-Dating/pull/253) | Draft | `036ee313747a7beb2ab926e721e3bef958304447` | 11 / 2 | [41539994863](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41539994863) / `125601704190` | success | success | 0 |
| [#313 Enterprise audit](https://github.com/Veselin-Takev/Klar-Dating/pull/313) | Draft | `8c1a5f96affb9457155b666b9ddf70e418ef77a7` | 93 / 2 | [43025215585](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/43025215585) / `130538124852` | **success** | success | 0 |
| [#314 Vercel evidence](https://github.com/Veselin-Takev/Klar-Dating/pull/314) | Draft | `e5deab1dfd629065f3dfce3a5577eb21ac966a68` | 3 / 2 | [41619572341](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41619572341) / `125861548924` | success | **failure: build-rate-limit** | 0 |

**Important change:** #313's exact current head `8c1a5f96...` has now completed its own `validate` job successfully. Its CI steps, including Enterprise static gates, typecheck, Functions build, tests, build, production smoke and browser acceptance, all completed successfully. The READY Vercel deployment for this head is a Preview (`target=null`), not a production deployment. The next documentation commit on this branch will create a new head and therefore needs its own exact-head CI.

**Dependabot:** #315 is closed and unmerged; exact head `71743b14c66d9c5f2fdca2ed73a0fda3c137d48d`, run [41531498018](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41531498018) failed. Its only APPROVED review is by repository owner `Veselin-Takev`, not an independent review. Current open successor #361 is non-Draft, head `2f90d9fef013f7a7f070a3624cadd5fd62e914ff`, 1 ahead / 2 behind main, 0 reviews; [run 42705724751](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42705724751), job `129461862107`, fails `check:release-workflow`: the production container release does not generate a GitHub-signed provenance attestation bound to the immutable image digest.

**Additional RC PR:** #358 is non-Draft, targets `release/v0.1.1-rc1`, head `1321c42ffe1c5919c1baccaada66a650ab811f93`, 0 reviews. [Run 42710380877](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710380877), job `129478019942`, fails Browser acceptance. Playwright's consent-withdrawal assertion expected `Einwilligung wurde widerrufen.`; it received a generic failure message. Logs contain Firestore `PERMISSION_DENIED: No matching allow statements`. The exact authorization/rules root cause remains unresolved.

### Fresh open-PR inventory and Ruleset

The GitHub pull-request collection was fully paginated again: **194 open PRs = 192 Drafts + 2 non-Drafts (#358 and #361)**; 50 target `main`, 144 target other branches; 141 bases match another open PR head; 3 have no open parent (#213, #214, #219); maximum stack depth is 35. Counts and topology are unchanged from the 11:29Z inventory snapshot, but the per-PR SHA for #313 advanced after that snapshot; use this checkpoint's exact SHA table rather than treating the older inventory JSON as current head evidence.

Live [Ruleset #25756841](https://github.com/Veselin-Takev/Klar-Dating/rules/25756841) remains active for `refs/heads/main`. It strictly requires `validate`, blocks branch deletion and non-fast-forward, and has no bypass actors. It still requires **0 approvals**, `require_code_owner_review=false`, `require_last_push_approval=false`, and `required_review_thread_resolution=false`. Root `CODEOWNERS` assigns the repository to `@Veselin-Takev`; no independent specialist reviewer is configured.

### Fresh issue and source revalidation

All watched issues **#202, #70, #254, #8, #73, #55, #56, #204 and #206 remain OPEN**.

- **#202 P0:** Main `phase2_work/functions/src/index.ts` still exports both `deleteExpiredPhotosCron` and `purgeVerificationStorageCron`. `deleteExpiredPhotos.ts` schedules the legacy worker every 24 hours. `retention.ts` still selects `verification/` objects and deletes after 30 days based on Storage `timeCreated`, with generation and Storage-hold checks but no moderation-decision/`fotoLoeschenAb` binding. This is a source finding, not proof that the production Scheduler is enabled. PR #203/#269 still share exactly six changed files: `DATA_RETENTION.md`, `deleteExpiredPhotos.ts`, `retention.ts`, `package.json`, `photoRetention.spec.ts`, `storageRules.spec.ts`; do not merge blindly.
- **#70 P0:** Main's retention script now enumerates 20 collection groups and defaults to Dry Run. Apply is guarded to an explicitly identified staging project/database and approved legal, inventory and matrix inputs. No authenticated, project/database-bound 20/20 `ACTIVE` Cloud readback or independent Legal-Hold approval was obtained in this run.
- **#254 P0:** PR #253 remains unmerged; current main `phase2_work/server.ts` contains no `tenant`/multi-tenant reference. Tenant mapping, full cross-tenant BOLA/IDOR and Art. 17 emulator proof, and live cutover evidence remain absent.
- **#8/#73:** Ruleset and CODEOWNERS do not enforce independent Security/DPO/SRE approval. Production IAM, alert delivery/on-call, canary, restore/RTO/RPO and live SLO evidence remain unverified.
- **#55/#56:** Both remain open. Partner webhook HMAC provenance does not independently prove a real purchase or buyer attribution; tracking legal basis, token revocation, refund/replay reconciliation, partner retention and Art. 17 approval remain open if partner monetization is in release scope.
- **#204 P1:** Main `phase2_work/storage.rules` still permits profile reads with `signedIn()` alone.
- **#206 P1:** Main `phase2_work/src/lib/klar.ts` still calls `getDownloadURL()` and persists the result as `users/{uid}.photoURL`. These are source-level risks, not evidence of exploitation.

### Vercel read-only state and decision

The authenticated Vercel team project list contains exactly one project: Klar `klar-dating`, ID `prj_9dEo2EJIDfmkx6JCS0BqwtF9fXre`. Project metadata reports `live=false` and Node `26.x`, while `phase2_work/RELEASE_MANIFEST.json` pins Node `22.23.3`. A production-target deployment `dpl_AJRgtKhyoF4B8ypLkXBF8vMzw32w` is `READY` and bound to exact current main SHA `2fa3ba...`; READY metadata does not establish traffic or runtime health. The newest deployment for #313 head is a READY Preview (`target=null`). The exact #314 head has GitHub Enterprise CI success but Vercel status failure due the provider's deployment rate limit. The previously confirmed `login-page-prototype` deletion was not retried; it is absent from the team project list. Neon/Postgres/Better-Auth credentials were not accessed, rotated or revoked.

**Decision remains `productionApproved=false`, BLOCKED / NO-GO.** No exact integrated release SHA has complete purge/receipt/race, 20/20 TTL/legal-hold/Art. 17, tenant/BOLA and production-operations evidence plus independent Security/AppSec, DPO/Legal, SRE, Finance (where applicable) and Release Owner approvals. No main commit, merge, production deployment, secret access or productive Firebase/GCS/IAM/Scheduler/database mutation was performed.


## Live release-watch checkpoint — 2026-11-11 15:34 CET

This checkpoint supersedes the earlier 13:56 and 14:30 tables above. It is based on fresh GitHub API reads of the current main ref, fully paginated open PR collection, exact PR heads, exact-head workflow runs/jobs, review submissions, the live Ruleset endpoint, source files at main, and read-only Vercel project/deployment queries.

### Main and exact-head status

- Repository exists, is public, and defaults to `main`. Current main ref remains `2fa3ba223989ff248ad1abaea67f4f454f7c9f6b`.
- Latest run on this exact main SHA is [42710429488](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710429488), job [129478192916](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710429488/job/129478192916): `validate=completed/success`, completed 2026-11-09 22:22:58Z. The commit status `Vercel=success` was updated 2026-11-09 22:17:01Z. No newer main SHA or main check-run was returned.
- Main-targeting PRs still report the old base SHA `96c3857c53f5ced31fe1394895185f42c75bc716`. A fresh compare against current main shows each listed main-targeting head is **2 commits behind and diverged**; do not treat their old base SHA or green CI as current-main synchronization.

| PR | State | Exact head SHA | Current main compare (ahead/behind) | Exact-head Actions run / job | Job result | Vercel status | Submitted reviews |
|---|---|---|---:|---|---|---|---:|
| [#251 Governance](https://github.com/Veselin-Takev/Klar-Dating/pull/251) | Draft/open | `fc03f33996ccffc73e54e6b7a6fb05914cdcbc53` | 10 / 2 | [42818199684](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42818199684) / `129836618469` | success | success | 0 |
| [#269 Legacy-photo purge](https://github.com/Veselin-Takev/Klar-Dating/pull/269) | Draft/open | `fd68656957c01618c3a085e887ece504624d18b3` | 33 / 2 | [42020003801](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42020003801) / `127220743813` | success | success | 0 |
| [#203 Decision/generation purge](https://github.com/Veselin-Takev/Klar-Dating/pull/203) | Draft/open | `1850e0a78b22e600e5add99273b84c081ffc3892` | 57 / 2 | [42017264009](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42017264009) / `127211414732` | success | success | 0 |
| [#253 Multi-Tenant](https://github.com/Veselin-Takev/Klar-Dating/pull/253) | Draft/open | `036ee313747a7beb2ab926e721e3bef958304447` | 11 / 2 | [41539994863](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41539994863) / `125601704190` | success | success | 0 |
| [#313 Enterprise audit](https://github.com/Veselin-Takev/Klar-Dating/pull/313) | Draft/open | `a6284c02b3b7939c10a61b386874de9fe0b474e7` | 94 / 2 | [43030345835](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/43030345835) / `130555461567` | **success** | success; Preview READY, `target=null` | 0 |
| [#314 Vercel evidence](https://github.com/Veselin-Takev/Klar-Dating/pull/314) | Draft/open | `e5deab1dfd629065f3dfce3a5577eb21ac966a68` | 3 / 2 | [41619572341](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41619572341) / `125861548924` | success | **failure: build-rate-limit**; no deployment exists for this exact SHA | 0 |

**#313 update:** The previous 14:30 checkpoint's head `8c1a5f96...` was superseded by `a6284c02...`. The new head's own `validate` job is now `completed/success`; this is not a production approval and there is still no independent review. The branch remains 94 commits ahead / 2 behind current main.

**Dependabot:** [#315](https://github.com/Veselin-Takev/Klar-Dating/pull/315) is now **closed and unmerged**, not an active PR. Its historical head is `71743b14c66d9c5f2fdca2ed73a0fda3c137d48d`; [run 41531498018 / job 125572558770](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41531498018) failed at the production-provenance gate. Its only submitted APPROVED review was by repository owner `Veselin-Takev`, not an independent reviewer. The open non-Draft successor [#361](https://github.com/Veselin-Takev/Klar-Dating/pull/361) has head `2f90d9fef013f7a7f070a3624cadd5fd62e914ff`, is 1 ahead / 2 behind main, and has zero reviews. [Run 42705724751 / job 129461862107](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42705724751/job/129461862107) fails in `Enterprise static gates`: `check:release-workflow` requires a GitHub-signed provenance attestation bound to the immutable production image digest. Updating the action pin alone does not satisfy this requirement. Vercel status on #361 is success.

**Additional non-Draft RC PR:** [#358](https://github.com/Veselin-Takev/Klar-Dating/pull/358) remains open against `release/v0.1.1-rc1`, head `1321c42ffe1c5919c1baccaada66a650ab811f93`, with zero reviews. [Run 42710380877 / job 129478019942](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710380877/job/129478019942) fails Browser acceptance. Playwright expected `Einwilligung wurde widerrufen.` after product-analytics consent withdrawal but received the generic failure message; the same run logs Firestore `PERMISSION_DENIED: No matching allow statements`. The precise rules/authorization root cause remains unisolated. Vercel status is success; this does not override the failed browser gate.

### Fresh inventory and live ruleset

- Fully paginated GitHub `pulls?state=open` pages 1 and 2 returned **194 open PRs = 192 Drafts + 2 non-Drafts (#358 and #361)**.
- **50** target `main`; **144** target other bases; **141** bases equal another open PR head; **53** stack roots; maximum stack depth **35**; no cycles; three missing open-parent references remain #213, #214, #219.
- These counts/topology were freshly recomputed in this run. `OPEN_PR_INVENTORY_2026-11-11.json` remains a dated 10:48Z inventory snapshot; its per-PR SHAs must not override the exact-head table above.
- Live [Ruleset #25756841](https://github.com/Veselin-Takev/Klar-Dating/rules/25756841) is `active` for `refs/heads/main`; strict required status check is `validate`; deletion and non-fast-forward are blocked; bypass actors are empty. It requires **0 approvals**, `require_code_owner_review=false`, `require_last_push_approval=false`, and `required_review_thread_resolution=false`. Root `CODEOWNERS` assigns the active application paths to `@Veselin-Takev`; it does not establish independent Security, DPO/Legal, SRE or Finance approval.

### Current issue/source evidence

All requested issues remain open: [#202](https://github.com/Veselin-Takev/Klar-Dating/issues/202), [#70](https://github.com/Veselin-Takev/Klar-Dating/issues/70), [#254](https://github.com/Veselin-Takev/Klar-Dating/issues/254), [#8](https://github.com/Veselin-Takev/Klar-Dating/issues/8), [#73](https://github.com/Veselin-Takev/Klar-Dating/issues/73), [#55](https://github.com/Veselin-Takev/Klar-Dating/issues/55), [#56](https://github.com/Veselin-Takev/Klar-Dating/issues/56), [#204](https://github.com/Veselin-Takev/Klar-Dating/issues/204), [#206](https://github.com/Veselin-Takev/Klar-Dating/issues/206).

- **#202 P0:** Main `phase2_work/functions/src/index.ts` still exports both `deleteExpiredPhotosCron` and `purgeVerificationStorageCron`. `deleteExpiredPhotos.ts` schedules the legacy worker every 24 hours; `retention.ts` line 16 reads Storage `timeCreated` and line 18 deletes based on 30-day upload age while only checking Storage temporary/event-based holds. It does not bind this legacy path to the Firestore moderation decision / `fotoLoeschenAb`. The newer decision-aware purge branch #203 is not integrated. The six-file #203/#269 overlap remains; no blind merge or supersession was attempted.
- **#70 P0:** Current main `configure-retention.sh` now enumerates 20 collection groups (not the older four-group snapshot), defaults to Dry Run, requires explicit project/database and an apply opt-in, reads existing TTL policy evidence before updates, and states staging-only activation. `check-retention-active-evidence.mjs` requires `ACTIVE` and exact group coverage, but its own output explicitly distinguishes offline supplied evidence from a live cloud check. No authenticated, project/database-bound 20/20 ACTIVE readback or independently approved Legal-Hold matrix was obtained.
- **#254 P0:** Current main `phase2_work/server.ts` contains no tenant/multi-tenant middleware reference. #253 remains a separate Draft branch. Full cross-tenant BOLA/IDOR, Art. 17 and live-cutover proof are absent.
- **#8/#73 P0/P1:** Both remain open. The live Ruleset does not require independent approvals; CODEOWNERS identifies the repository owner, not independent specialists. Production IAM, verified alert delivery/on-call acknowledgement, canary, restore/RTO/RPO and live SLO evidence were not obtained.
- **#55/#56 P0 where partner monetization is in scope:** Main `partnerReferralService.ts` documents that partner HMAC/signature proves message origin, not purchase or buyer attribution; no independent real-purchase binding was established. Legal basis, consent withdrawal, token revocation, refund/replay reconciliation, partner retention and Art. 17 approval remain open.
- **#204 P1:** Main `phase2_work/storage.rules` still has `allow read: if signedIn();` for `profiles/{uid}/{datei}`, without the adult/verification predicates described by the policy model.
- **#206 P1:** Main `phase2_work/src/lib/klar.ts` still calls `getDownloadURL()` and persists the bearer-style URL as `users/{uid}.photoURL`. These are source-level authorization/privacy risks, not evidence of exploitation.

### Read-only Vercel re-check

- Authenticated team listing returns exactly one project: Klar `klar-dating`, ID `prj_9dEo2EJIDfmkx6JCS0BqwtF9fXre`. Project lookup succeeds; the metadata reports `live=false`, Node `26.x`, and the known Klar domains. The repository release manifest still pins Node `22.23.3`; this configuration mismatch remains unresolved.
- Production deployment `dpl_AJRgtKhyoF4B8ypLkXBF8vMzw32w` is `READY`, target `production`, bound to main SHA `2fa3ba223989ff248ad1abaea67f4f454f7c9f6b`. READY metadata is not proof of traffic, runtime health or release approval.
- Current #313 head has Preview deployment `dpl_9DMxGjVUJaiPPaYxqneRWiyHLAa3`, state `READY`, `target=null`. No deployment exists for exact #314 head `e5deab1...`; its GitHub Vercel status is `failure/build-rate-limit`.
- The previously confirmed `login-page-prototype` deletion was not retried; it is absent from the current one-project team listing. No Neon/Postgres/Better-Auth credential was read, rotated or revoked.

**Decision:** `productionApproved=false`, **BLOCKED / NO-GO**. No exact integrated release SHA has complete purge/receipt/race, 20/20 TTL/legal-hold/Art. 17, tenant/BOLA, signed immutable-image provenance and production-operations evidence plus independent Security/AppSec, DPO/Legal, SRE, Finance (where applicable) and Release Owner approvals. This checkpoint is a documentation-only update on the existing audit review branch. Its resulting new head must pass its own exact-head CI; no main commit, merge, deployment, secret access, production Firebase/GCS/IAM/Scheduler/database mutation, Vercel project deletion or credential rotation was performed.


## Live release-watch checkpoint — 2026-11-11 22:00 CET

### Fresh main baseline and repository topology

- Fresh GitHub refs/heads/main is **2fa3ba223989ff248ad1abaea67f4f454f7c9f6b**. Its exact validate check is completed/success: [run 42710429488](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710429488), job 129478192916; commit status is success. The read-only Vercel production deployment record is READY on this same SHA (details below).
- Full pagination of pulls?state=open pages 1–2 returns **194 open PRs: 192 Drafts and 2 non-Drafts (#358 and #361)**. The former 153/152/1 snapshot is obsolete. **50** target main and **144** target other branches; **141** non-main base refs match another open PR head; **3** bases have no open-PR parent (#213/#214/#219); maximum observed stack depth is **35**. The live head-ref prefix counts are: fix 81, security 55, test 19, docs 11, integration 10, audit 7, feat 5, dependabot 1, release 1, feature 2, audit-enterprise-e2e-20261102 1, Veselin-Takev-patch-1 1.
- OPEN_PR_INVENTORY_2026-11-11.json has been regenerated from the complete current GitHub PR pages, including every current head/base SHA and stack depth. It is part of this same documentation-only commit.

### Exact-head PR / CI / review checkpoint

All seven tracked PR heads below were fetched directly from GitHub. The compare column is current main 2fa3ba2... versus that exact head. A green check on a branch two commits behind main is branch-level evidence, not merge readiness.

| PR | Current state and exact head | Main compare (ahead/behind) | Exact Actions run / job result | Vercel status | Submitted reviews |
|---|---|---:|---|---|---:|
| [#251](https://github.com/Veselin-Takev/Klar-Dating/pull/251) | Draft/open, fc03f33996ccffc73e54e6b7a6fb05914cdcbc53; title/scope is now P1 #73 live-ruleset release gate, not the earlier governance-only description | 10 / 2 | [42818199684](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42818199684), job 129836618469, validate=success | success | 0 |
| [#269](https://github.com/Veselin-Takev/Klar-Dating/pull/269) | Draft/open, fd68656957c01618c3a085e887ece504624d18b3 | 33 / 2 | [42020003801](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42020003801), job 127220743813, validate=success | success | 0 |
| [#203](https://github.com/Veselin-Takev/Klar-Dating/pull/203) | Draft/open, 1850e0a78b22e600e5add99273b84c081ffc3892 | 57 / 2 | [42017264009](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42017264009), job 127211414732, validate=success | success | 0 |
| [#253](https://github.com/Veselin-Takev/Klar-Dating/pull/253) | Draft/open, 036ee313747a7beb2ab926e721e3bef958304447 | 11 / 2 | [41539994863](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41539994863), job 125601704190, validate=success | success | 0 |
| [#313](https://github.com/Veselin-Takev/Klar-Dating/pull/313) | Draft/open, bd5f5421f6a9f61338955a70510843e120c3f1de | 96 / 2 | [43080642443](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/43080642443), job 130731974310, validate=success | success; exact-head Preview READY, target=null | 0 |
| [#314](https://github.com/Veselin-Takev/Klar-Dating/pull/314) | Draft/open, e5deab1dfd629065f3dfce3a5577eb21ac966a68 | 3 / 2 | [41619572341](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41619572341), job 125861548924, validate=success | **failure: build-rate-limit**; no deployment for this exact head | 0 |
| [#315](https://github.com/Veselin-Takev/Klar-Dating/pull/315) | **closed, unmerged**; historical head 71743b14c66d9c5f2fdca2ed73a0fda3c137d48d | — | [41531498018](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41531498018), job 125572558770, validate=failure at the production provenance gate | historical Vercel success | 1 owner approval; **0 independent** |
| [#361](https://github.com/Veselin-Takev/Klar-Dating/pull/361) | **non-Draft/open**, 2f90d9fef013f7a7f070a3624cadd5fd62e914ff | 1 / 2 | [42705724751](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42705724751), job 129461862107, validate=failure | success | 0 |

Additional release-workflow dependency evidence:

- #361 proposes actions/attest@badbb428b0055a04f53d6ce00bda98cf1c04e56e and actions/setup-java@v6.2.0. Its exact-head failure is not a transient Vercel issue: check:release-workflow says the production container release must generate a GitHub-signed provenance attestation bound to the immutable image digest.
- Draft #316, head b1b669ed5e80a6572dc60bdbbbc08e02650283be, has exact validate=success on run [41596122104](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41596122104), job 125783766115, but pins the older 4d7d4075... action commit and has zero reviews. #251's current head uses the newer badbb428... pin and changes the same release workflow/validator files. Do not merge #316/#251/#361 blindly or assume the old #315 approval applies.
- #251's current head contains synthetic Ruleset and attestation-pin regression tests and a fail-closed live Ruleset preflight; it does not change the actual GitHub Ruleset. Its exact CI success is not a human review or a live release execution.
- Additional non-Draft #358 is open against release/v0.1.1-rc1, head 1321c42ffe1c5919c1baccaada66a650ab811f93, with zero reviews. Its exact run [42710380877](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710380877), job 129478019942, fails Browser acceptance: Playwright expected Einwilligung wurde widerrufen. after consent withdrawal but received the generic failure message; logs also contain Firestore PERMISSION_DENIED: No matching allow statements. The precise authorization root cause remains unisolated. Earlier success on a different source/documentation SHA is not current approval. Vercel status is success.

### Active main Ruleset #25756841

Live API still reports Ruleset 25756841 as **active** for refs/heads/main, with strict required status check validate, deletion protection, non-fast-forward protection and an empty bypass-actor list. The pull-request rule nevertheless requires **0 approving reviews**; require_code_owner_review=false, dismiss_stale_reviews_on_push=false, require_last_push_approval=false, and required_review_thread_resolution=false. Thus the live ruleset does not enforce the independent specialist reviews required for GO. #251 does not alter these live settings.

### Issue and source evidence

All watched issues remain **open**: [#202](https://github.com/Veselin-Takev/Klar-Dating/issues/202), [#70](https://github.com/Veselin-Takev/Klar-Dating/issues/70), [#254](https://github.com/Veselin-Takev/Klar-Dating/issues/254), [#8](https://github.com/Veselin-Takev/Klar-Dating/issues/8), [#73](https://github.com/Veselin-Takev/Klar-Dating/issues/73), [#55](https://github.com/Veselin-Takev/Klar-Dating/issues/55), [#56](https://github.com/Veselin-Takev/Klar-Dating/issues/56), [#204](https://github.com/Veselin-Takev/Klar-Dating/issues/204), [#206](https://github.com/Veselin-Takev/Klar-Dating/issues/206).

- **P0 #202:** Current main still exports deleteExpiredPhotosCron from phase2_work/functions/src/index.ts; the worker runs every 24 hours and retention.ts deletes verification/ objects based on Storage timeCreated older than 30 days, with hold/generation checks but without binding to the moderation decision / fotoLoeschenAb. This is source evidence, not proof the Scheduler is live. #203 and #269 are both Draft and 2 commits behind main; their exact-head CI is green, but both have zero reviews and overlap in exactly six files: docs/DATA_RETENTION.md, functions/src/deleteExpiredPhotos.ts, functions/src/retention.ts, package.json, tests/photoRetention.spec.ts, tests/storageRules.spec.ts. No blind merge or cross-PR integration was performed.
- **P0 #70:** Current configure-retention.sh enumerates 20 collection groups, defaults to dry-run and requires explicit staging identity, legal/inventory approval and a new 20-group matrix revision before apply. Main DATA_RETENTION.md still contains 13-group verification statements. No project/database-bound 20/20 ACTIVE TTL readback or independently approved Legal-Hold/Art.17 evidence was obtained.
- **P0 #254:** #253 remains a Draft tenant foundation, 11 ahead / 2 behind main, zero reviews. The #358 RC migration claim is not a live cutover proof and its current head fails Browser acceptance. Cross-tenant BOLA/IDOR, legacy data mapping, Firestore/Storage Rules and Art.17 live evidence remain unapproved.
- **#8 / #73:** Production Cloud Run/IAM identity, actual alert delivery and on-call acknowledgement, canary/rollback, restore/RTO/RPO and live SLO evidence remain absent; live Ruleset approvals remain zero.
- **#55 / #56:** Main partner service records proofStatus=partner_assertion_only and rewardStatus=pending_verification, and does not award qualified counters from a partner assertion alone. This is a useful control, not proof of real purchase/buyer attribution. Legal basis, consent withdrawal/revocation, recipient logs, retention and Art.17 evidence remain open.
- **P1 #204:** Current main phase2_work/storage.rules still allows profile-image reads with allow read: if signedIn();, without the adult/verification predicates required by the policy model.
- **P1 #206:** Current main phase2_work/src/lib/klar.ts still calls getDownloadURL() and stores the bearer URL in users/{uid}.photoURL; monitoredFetch still includes raw input.toString() in console/error diagnostics. These are source-derived risks, not evidence of exploitation.

### Read-only Vercel re-check

- Authenticated lookup confirms Klar Vercel project klar-dating still exists: prj_9dEo2EJIDfmkx6JCS0BqwtF9fXre. Project metadata reports live=false and Node 26.x; the release manifest pins Node 22.23.3, so the configuration mismatch remains unresolved.
- Production deployment dpl_AJRgtKhyoF4B8ypLkXBF8vMzw32w is READY, target production, and bound to exact main SHA 2fa3ba223989ff248ad1abaea67f4f454f7c9f6b. READY metadata does not prove user traffic, runtime health or production approval.
- Current #313 head has a READY preview with target=null; #314 has no deployment for its exact head and its Vercel status is failure/build-rate-limit.
- The previously confirmed login-page-prototype deletion was not retried. No Neon/Postgres/Better-Auth credential was read, rotated or revoked.

**Decision:** productionApproved=false, **BLOCKED / NO-GO**. No exact integrated release SHA has complete purge/receipt/race, 20/20 TTL/legal-hold/Art.17, tenant/BOLA, signed immutable-image provenance and production-operations evidence plus independent Security/AppSec, DPO/Legal, SRE, Finance (where applicable) and Release Owner approvals. This checkpoint is documentation-only on the existing audit review branch. The resulting new #313 head must pass its own exact-head CI; no main commit, merge, production deployment, secret access or production Firebase/GCS/IAM/Scheduler/database mutation was performed.


## Live release-watch checkpoint — 2026-11-11 22:46 CET

**Fresh baseline and main CI.** The repository still exists, is public, and defaults to `main`. The freshly read, signed main HEAD is `2fa3ba223989ff248ad1abaea67f4f454f7c9f6b` (commit signature verified). Its exact `validate` check is [run 42710429488 / job 129478192916](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710429488/job/129478192916), `completed/success`; every required job step passed. The separate Vercel commit status is `success`. This does not establish production traffic or approval.

**Fresh open-PR inventory.** GitHub REST pages 1 and 2 were fetched again: **194 open PRs = 192 Drafts + 2 non-Drafts (#358 and #361)**. **50** target `main`, **144** target other branches; **141** non-main bases match another open PR head; **3** stack roots have no open parent (#213, #214, #219); there are **53** roots including `main`, and maximum observed stack depth is **35**. The previous 153/152/1 count is obsolete.

### Exact-head CI and review checkpoint

The current PR heads, checks and reviews were fetched directly. Compare counts are against main `2fa3ba223989ff248ad1abaea67f4f454f7c9f6b`; a green check on a branch two commits behind main remains branch-only evidence.

| PR | Current state / exact head | Ahead / behind main | Exact `validate` run / job | Result | Submitted reviews |
|---|---|---:|---|---|---:|
| [#251 Governance / #73](https://github.com/Veselin-Takev/Klar-Dating/pull/251) | Draft/open `fc03f33996ccffc73e54e6b7a6fb05914cdcbc53` | 10 / 2 | [42818199684](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42818199684) / `129836618469` | success; all required steps passed | 0 |
| [#269 Legacy-photo purge](https://github.com/Veselin-Takev/Klar-Dating/pull/269) | Draft/open `fd68656957c01618c3a085e887ece504624d18b3` | 33 / 2 | [42020003801](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42020003801) / `127220743813` | success; all required steps passed | 0 |
| [#203 Decision/generation purge](https://github.com/Veselin-Takev/Klar-Dating/pull/203) | Draft/open `1850e0a78b22e600e5add99273b84c081ffc3892` | 57 / 2 | [42017264009](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42017264009) / `127211414732` | success; all required steps passed | 0 |
| [#253 Multi-Tenant](https://github.com/Veselin-Takev/Klar-Dating/pull/253) | Draft/open `036ee313747a7beb2ab926e721e3bef958304447` | 11 / 2 | [41539994863](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41539994863) / `125601704190` | success; all required steps passed | 0 |
| [#313 Enterprise audit](https://github.com/Veselin-Takev/Klar-Dating/pull/313) | Draft/open `f3c399908b0a464fe2db3d05dab529b6342292b4` | 97 / 2 | [43100347874](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/43100347874) / `130789641918` | success; all required steps passed | 0 |
| [#314 Vercel evidence](https://github.com/Veselin-Takev/Klar-Dating/pull/314) | Draft/open `e5deab1dfd629065f3dfce3a5577eb21ac966a68` | 3 / 2 | [41619572341](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41619572341) / `125861548924` | success | 0 |
| [#315 Dependabot attest](https://github.com/Veselin-Takev/Klar-Dating/pull/315) | closed, unmerged; historical head `71743b14c66d9c5f2fdca2ed73a0fda3c137d48d` | — | [41531498018](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41531498018) / `125572558770` | failure at Enterprise static gates: missing signed image-digest provenance | 1 owner self-approval; not independent |

**Vercel and replacement PRs.** #313's exact-head preview deployment is READY with `target=null`; #314 has no deployment for its exact head and its GitHub Vercel commit status is `failure` (`build-rate-limit`). The existing Draft [#316](https://github.com/Veselin-Takev/Klar-Dating/pull/316), head `b1b669ed5e80a6572dc60bdbbbc08e02650283be`, has exact `validate` run [41596122104 / job 125783766115](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41596122104), success, but 0 reviews and is not integrated. The current non-Draft Dependabot replacement [#361](https://github.com/Veselin-Takev/Klar-Dating/pull/361), head `2f90d9fef013f7a7f070a3624cadd5fd62e914ff` (1 / 2 ahead/behind), has 0 reviews and exact run [42705724751 / job 129461862107](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42705724751), failure at Enterprise static gates: `check:release-workflow` requires a GitHub-signed provenance attestation bound to the immutable container image digest; it is absent. The other non-Draft [#358](https://github.com/Veselin-Takev/Klar-Dating/pull/358), head `1321c42ffe1c5919c1baccaada66a650ab811f93`, has 0 reviews and exact run [42710380877 / job 129478019942](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710380877), failure at Browser acceptance: **28/29** passed; the consent-withdrawal test expected `Einwilligung wurde widerrufen.` but received a generic failure after Firestore `PERMISSION_DENIED`. Root cause is not established.

### Live Ruleset and source-verified blockers

Live [Ruleset #25756841](https://github.com/Veselin-Takev/Klar-Dating/rules/25756841) remains active for `refs/heads/main`: strict required `validate`, branch deletion and non-fast-forward blocked, no bypass actors. It still requires **0 approvals**, `require_code_owner_review=false`, `dismiss_stale_reviews_on_push=false`, `require_last_push_approval=false` and `required_review_thread_resolution=false`.

All nine watched issues remain **OPEN**: [#202](https://github.com/Veselin-Takev/Klar-Dating/issues/202), [#70](https://github.com/Veselin-Takev/Klar-Dating/issues/70), [#254](https://github.com/Veselin-Takev/Klar-Dating/issues/254), [#8](https://github.com/Veselin-Takev/Klar-Dating/issues/8), [#73](https://github.com/Veselin-Takev/Klar-Dating/issues/73), [#55](https://github.com/Veselin-Takev/Klar-Dating/issues/55), [#56](https://github.com/Veselin-Takev/Klar-Dating/issues/56), [#204](https://github.com/Veselin-Takev/Klar-Dating/issues/204) and [#206](https://github.com/Veselin-Takev/Klar-Dating/issues/206).

- **P0 #202:** Current main still exports and schedules `deleteExpiredPhotosCron` every 24 hours. `retention.ts` lists `verification/` objects and deletes after 30 days using Storage `timeCreated`, with generation and hold checks but no moderation-decision / `fotoLoeschenAb` binding. The separate decision-based purge export does not remove the legacy worker. This is a source finding; actual production Scheduler enablement was not verified.
- **P0 #70:** Main's TTL script enumerates 20 groups, defaults to dry-run and allows apply only to an explicitly approved staging project/database with legal and inventory gates. `RELEASE_MANIFEST.json` still says live TTL is `NOT_VERIFIED`; no fresh project/database-bound 20/20 `ACTIVE` readback or independently approved legal-hold matrix was obtained.
- **P0 #254:** Main `phase2_work/server.ts` does not mount tenant middleware; #253 remains an unmerged Draft. Authoritative legacy-to-tenant mapping, full cross-tenant BOLA/IDOR/Art. 17 evidence and controlled live cutover remain absent.
- **P0/P1 #8/#73:** The active ruleset does not enforce independent approvals. Production IAM, alert delivery/on-call acknowledgement, canary, restore/RTO/RPO and live SLO evidence remain unverified.
- **P0 #55/#56 where partner monetization is in scope:** Both issues remain open; independent purchase/buyer binding, partner tracking legal basis, token revocation, refund/replay reconciliation and approved retention/Art. 17 evidence are not complete.
- **P1 #204/#206:** Main `storage.rules` still permits profile reads with `signedIn()` alone; `klar.ts` still persists Firebase `getDownloadURL()` as `users/{uid}.photoURL`. These are source-level policy risks, not evidence of live exploitation.

Newer containment Drafts [#348](https://github.com/Veselin-Takev/Klar-Dating/pull/348) (`a7b6e574086d02fd9ea28868b061c7072ed84f5c`) and [#353](https://github.com/Veselin-Takev/Klar-Dating/pull/353) (`c653efd6984f573ab0443bdd3723ca37f63fa320`) still have exact `validate=success` but **zero submitted reviews**. #348 adds a production purge hard-stop; #353 adds hold guards. Neither is integrated, and neither CI result proves the late-hold / cross-service race or all-writer fencing in live infrastructure. #269 and #203 still overlap in six files; do not merge them blindly.

### Read-only Vercel state and decision

The authenticated Vercel team list still contains exactly one project: Klar `klar-dating`, ID `prj_9dEo2EJIDfmkx6JCS0BqwtF9fXre`. Project metadata reports `live=false` and Node `26.x`. Production deployment `dpl_AJRgtKhyoF4B8ypLkXBF8vMzw32w` is READY, target `production`, bound to the exact main SHA above; the latest project deployment is a READY preview (`target=null`). #313 has a READY preview on its exact head (`target=null`); #314 has no exact-head deployment. The prior API-confirmed deletion of `login-page-prototype` remains the recorded result; no further deletion was attempted. Neon/Postgres/Better-Auth credentials were not accessed, rotated or revoked.

**Decision: `productionApproved=false`, BLOCKED / NO-GO.** No exact integrated release SHA has complete purge/receipt/race, 20/20 TTL/legal-hold/Art. 17, tenant/BOLA, signed immutable-image provenance and production-operations evidence plus independent Security/AppSec, DPO/Legal, SRE, Finance (where applicable) and Release Owner approvals. No merge, deployment, secret access or production Firebase/GCS/IAM/Scheduler/database mutation was performed. This is a documentation-only update on the existing audit review branch; the resulting new #313 head must pass its own exact-head CI before it is treated as technically validated.


## Live release-watch checkpoint — 2026-11-12 05:02 CET

This checkpoint was collected from fresh GitHub and Vercel read-only API responses. It supersedes prior PR-count and exact-head snapshots, but it does not constitute an independent approval.

### Fresh main and current PR topology

- Repository exists, is public, is not archived, and uses `main` as its default branch.
- Fresh `main` HEAD: `2fa3ba223989ff248ad1abaea67f4f454f7c9f6b` (merge of PR #359, repository PR-hygiene documentation).
- Exact main push run [42710429488](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710429488), job `validate` / `129478192916`: `completed/success`. Separate GitHub Vercel status: `success`.
- Fully paginated open-PR list: **194 open PRs, 192 Drafts, 2 non-Drafts (#358 and #361)**. **50** target `main`, **144** target other branches; **141** non-main base refs match another open PR head; **3** bases have no open-PR parent; **53** stack roots; maximum observed depth **35**.
- Head-ref prefixes: fix 81, security 55, test 19, docs 11, integration 10, audit 7, feat 5, dependabot 1, release 1, feature 2, audit-enterprise-e2e-20261102 1, Veselin-Takev-patch-1 1.
- Largest dependency stacks: #269 = 40 PRs; #317 = 27; #203 = 20; #253 = 14; #219 = 10; #192 = 10; #160 = 6; #214 = 5; #337 = 4; #172 = 4.
- The fresh list matches the summary in `OPEN_PR_INVENTORY_2026-11-12.json` (generated 2026-11-12 02:39:08Z); no redundant inventory rewrite was made.

### Exact watched PR heads, CI, Vercel and reviews

All six open target PRs remain Drafts, target `main`, and are **2 commits behind** current main. Compare counts below use the fresh main SHA above and each exact current PR head. A green branch check is not a merge or release approval.

| PR | Exact current head | Ahead / behind | Exact Actions run / job | GitHub/Vercel status | Reviews / threads |
|---|---|---:|---|---|---:|
| #251 Governance / P1 #73 live-ruleset gate | `fc03f33996ccffc73e54e6b7a6fb05914cdcbc53` | 10 / 2 | [42818199684](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42818199684) / `validate` `129836618469` — success | Vercel success | 0 / 0 |
| #269 Legacy-photo purge | `fd68656957c01618c3a085e887ece504624d18b3` | 33 / 2 | [42020003801](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42020003801) / `validate` `127220743813` — success | Vercel success | 0 / 0 |
| #203 Decision/generation-bound purge | `1850e0a78b22e600e5add99273b84c081ffc3892` | 57 / 2 | [42017264009](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42017264009) / `validate` `127211414732` — success | Vercel success | 0 / 0 |
| #253 Multi-Tenant | `036ee313747a7beb2ab926e721e3bef958304447` | 11 / 2 | [41539994863](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41539994863) / `validate` `125601704190` — success | Vercel success | 0 / 0 |
| #313 Enterprise audit | `514cc7f0dd16a31ac130f9d525566a65a2881d60` | 99 / 2 | [43143286614](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/43143286614) / `validate` `130935150221` — success | Vercel success | 0 / 0 |
| #314 Vercel setup | `e5deab1dfd629065f3dfce3a5577eb21ac966a68` | 3 / 2 | [41619572341](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41619572341) / `validate` `125861548924` — success | **Vercel failure: `build-rate-limit`; no deployment for this exact head** | 0 / 0 |
| #315 Dependabot attest | `71743b14c66d9c5f2fdca2ed73a0fda3c137d48d` | closed / unmerged | [41531498018](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41531498018) / `validate` `125572558770` — failure at Enterprise static gates; downstream checks skipped | Historical Vercel success | 1 owner approval; 0 independent |

PR #269 and #203 still change the same six files: `phase2_work/docs/DATA_RETENTION.md`, `phase2_work/functions/src/deleteExpiredPhotos.ts`, `phase2_work/functions/src/retention.ts`, `phase2_work/package.json`, `phase2_work/tests/photoRetention.spec.ts`, and `phase2_work/tests/storageRules.spec.ts`. Their independent green CI results do not resolve the integration conflict; do not merge either blindly or together.

### Other open non-Draft PRs

- [#358](https://github.com/Veselin-Takev/Klar-Dating/pull/358), head `1321c42ffe1c5919c1baccaada66a650ab811f93`, targets `release/v0.1.1-rc1`; run [42710380877](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710380877), job `129478019942`, fails at Browser acceptance. The consent-withdrawal test is 28/29; logs show Firestore `PERMISSION_DENIED: No matching allow statements`. Zero reviews. The precise authorization root cause remains unisolated.
- [#361](https://github.com/Veselin-Takev/Klar-Dating/pull/361), head `2f90d9fef013f7a7f070a3624cadd5fd62e914ff`, targets `main`; run [42705724751](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42705724751), job `129461862107`, fails at Enterprise static gates because the production container release lacks GitHub-signed provenance attestation bound to the immutable image digest. Zero reviews.
- #315 remains closed and unmerged; its former approval does not transfer to #361.

### Active main Ruleset #25756841

Live API confirms the ruleset is `active` for `refs/heads/main`. It strictly requires status context `validate`, but `required_approving_review_count=0`, `require_code_owner_review=false`, `dismiss_stale_reviews_on_push=false`, `require_last_push_approval=false`, and `required_review_thread_resolution=false`. The six watched open Drafts have no submitted reviews and no review threads. This does not meet the required independent-review gate.

### Fresh source and issue rechecks

All nine issues remain OPEN: #202, #70, #254, #8, #73, #55, #56, #204 and #206.

- **#202 P0:** current main still exports `deleteExpiredPhotosCron` from `phase2_work/functions/src/index.ts`; the worker schedules every 24 hours and calls `deleteExpiredPhotoPage`. Current `retention.ts` lists `verification/` objects and deletes by `timeCreated` older than 30 days, with generation and Storage-hold checks but no moderation-decision / `fotoLoeschenAb` binding. This is a source finding, not proof that a production Scheduler is active.
- **#70 P0:** current main `configure-retention.sh` enumerates 20 collection groups and gates apply to explicitly approved staging, project/database identity, legal matrix and inventory. No project-bound 20/20 `ACTIVE` Cloud readback or independent Legal-Hold proof was found.
- **#254 P0:** `phase2_work/src/server/multitenant/tenantAuth.ts` is absent from current main; tenant middleware, legacy mapping and full cross-tenant BOLA/IDOR/Art. 17 live-cutover evidence remain unproven. #253 is still an unmerged Draft.
- **#8 / #73:** production IAM, alert delivery/on-call, canary, restore/RTO/RPO, sustained SLO evidence and enforceable independent review remain unproven.
- **#55 / #56:** partner purchase/buyer authenticity, tracking legal basis, revocation and retention/Art. 17 approval remain open if partner monetization is in release scope.
- **#204 P1:** current main `storage.rules` still permits `/profiles/{uid}/{datei}` reads with `signedIn()` alone; the policy engine requires adult-state checks for reader and target.
- **#206 P1:** current main `klar.ts` still calls `getDownloadURL()` and persists the URL to `users/{uid}.photoURL`; the Profile screen renders that stored URL. This is a source risk, not evidence of live exploitation.

### Read-only Vercel check and release decision

- Authenticated Vercel team listing contains exactly one project: Klar `klar-dating`, ID `prj_9dEo2EJIDfmkx6JCS0BqwtF9fXre`. Project metadata reports `live=false`, Node `26.x`, and the Klar domains; the repository release manifest pins Node `22.23.3`.
- Production-target deployment `dpl_AJRgtKhyoF4B8ypLkXBF8vMzw32w` is `READY` and bound to exact main SHA `2fa3ba223989ff248ad1abaea67f4f454f7c9f6b`. READY is not proof of user traffic, runtime health or approval.
- The previously confirmed `login-page-prototype` deletion remains closed out: it was not queried for another deletion attempt; the team listing contains only Klar. No Neon/Postgres/Better-Auth credential was read, rotated or revoked.

**Decision remains `productionApproved=false`, BLOCKED / NO-GO.** No exact integrated release SHA has complete purge/receipt/race, TTL/legal-hold/Art. 17, tenant/BOLA, production-operations and independent Security/AppSec, DPO/Legal, SRE, Finance (where applicable) and Release Owner approvals. No merge, main commit, deployment, secret access, production Firebase/GCS/IAM/Scheduler/database mutation or credential rotation was performed. This audit-branch documentation update itself must pass CI on its new exact head before being treated as technically validated.


## Live release-watch checkpoint — 2026-11-12 05:51 CET

Fresh read-only verification supersedes the earlier #313 head recorded in the 05:02 checkpoint. No main-branch mutation, merge, deployment, secret read, credential rotation, or production Firebase/GCS/IAM/Scheduler/database change was performed.

### Main and PR topology

- Repository remains public, unarchived, default branch `main`. Fresh main HEAD: `2fa3ba223989ff248ad1abaea67f4f454f7c9f6b` (merge of PR #359); commit signature verified.
- Exact main Actions run [42710429488](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710429488), job `validate` / `129478192916`: `completed/success`.
- Freshly paginated GitHub PR pages: **194 open, 192 Drafts, 2 non-Drafts (#358 and #361)**. **50** target `main`, **144** target other branches; **141** non-main base refs match an open PR head, **3** bases have no open-PR parent (#219/#214/#213), **53** stack roots, maximum observed stack depth **35**.
- Head-ref prefixes: fix 81, security 55, test 19, docs 11, integration 10, audit 7, feat 5, feature 2, dependabot 1, release 1, audit-enterprise-e2e-20261102 1, Veselin-Takev-patch-1 1.
- Largest current stacks: #269 40 PRs; #317 27; #203 20; #253 14; #192 and #219 10 each; #160 6; #214 5; #140 and #172 4 each.

### Exact watched PR heads, checks, and reviews

All six watched open PRs remain Drafts targeting `main`, retain base SHA `96c3857c53f5ced31fe1394895185f42c75bc716`, and compare as **2 commits behind** fresh main. Green checks below are exact-head CI evidence only, not merge or release approval.

| PR | Exact head | Ahead / behind | Exact Actions run / job | Vercel / reviews |
|---|---|---:|---|---|
| #251 Governance / #73 | `fc03f33996ccffc73e54e6b7a6fb05914cdcbc53` | 10 / 2 | [42818199684](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42818199684) / `validate` `129836618469` — success | Preview success; 0 reviews / 0 threads |
| #269 legacy-photo kill-switch | `fd68656957c01618c3a085e887ece504624d18b3` | 33 / 2 | [42020003801](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42020003801) / `validate` `127220743813` — success | Preview success; 0 / 0 |
| #203 decision/generation-bound purge | `1850e0a78b22e600e5add99273b84c081ffc3892` | 57 / 2 | [42017264009](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42017264009) / `validate` `127211414732` — success | Preview success; 0 / 0 |
| #253 Multi-Tenant | `036ee313747a7beb2ab926e721e3bef958304447` | 11 / 2 | [41539994863](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41539994863) / `validate` `125601704190` — success | Preview success; 0 / 0 |
| #313 Enterprise audit | `6db8309ef06a7cfa80275a7027606e3e80ada4c0` | 100 / 2 | [43152764788](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/43152764788) / `validate` `130965610290` — success | Preview check success; preview deployment READY, target=null; 0 / 0 |
| #314 Vercel setup | `e5deab1dfd629065f3dfce3a5577eb21ac966a68` | 3 / 2 | [41619572341](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41619572341) / `validate` `125861548924` — success | No deployment for this exact head; two branch previews belong to older SHAs; 0 / 0 |

PR #269 and #203 still overlap in six files: `phase2_work/docs/DATA_RETENTION.md`, `phase2_work/functions/src/deleteExpiredPhotos.ts`, `phase2_work/functions/src/retention.ts`, `phase2_work/package.json`, `phase2_work/tests/photoRetention.spec.ts`, and `phase2_work/tests/storageRules.spec.ts`. Do not merge them blindly or together.

[PR #315](https://github.com/Veselin-Takev/Klar-Dating/pull/315) is **closed, unmerged**; its exact head was `71743b14c66d9c5f2fdca2ed73a0fda3c137d48d`, and run [41531498018](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41531498018), job `validate` / `125572558770`, failed at Enterprise static gates. Its single approval was by the repository owner, not an independent review. The current non-Draft Dependabot successor is [#361](https://github.com/Veselin-Takev/Klar-Dating/pull/361), head `2f90d9fef013f7a7f070a3624cadd5fd62e914ff`; it updates `actions/attest` from `b60c2628...` to `badbb428...` and `actions/setup-java`. Its exact run [42705724751](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42705724751), job `validate` / `129461862107`, failed at `Enterprise static gates`: `check:release-workflow` reports that production container release must generate GitHub-signed provenance bound to the immutable image digest. #361 has 0 reviews. Do not merge it unreviewed.

The other non-Draft [#358](https://github.com/Veselin-Takev/Klar-Dating/pull/358) targets `release/v0.1.1-rc1`, head `1321c42ffe1c5919c1baccaada66a650ab811f93`; run [42710380877](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710380877), job `validate` / `129478019942`, failed at Browser acceptance. The failing test is `tests/e2e/privacy-settings.spec.ts` (analytics consent after withdrawal); emulator logs include Firestore `PERMISSION_DENIED: No matching allow statements`. Root cause remains unisolated; 0 reviews.

### Live main Ruleset #25756841

GitHub API confirms enforcement is `active` for `refs/heads/main`. Required status context is strict `validate`; required approving review count is **0**, `require_code_owner_review=false`, `dismiss_stale_reviews_on_push=false`, `require_last_push_approval=false`, and `required_review_thread_resolution=false`. No bypass actors are configured and the current user cannot bypass. This does not satisfy the independent-review release gate.

### Fresh source and issue rechecks

All nine issues remain **OPEN**: #202, #70, #254, #8, #73, #55, #56, #204, and #206.

- **#202 P0:** fresh main still exports `deleteExpiredPhotosCron`; it runs every 24 hours. `retention.ts` lists `verification/` objects and deletes when Storage `timeCreated` is older than 30 days, with generation/hold checks but no moderation-decision or `fotoLoeschenAb` binding. This is source evidence, not proof that a production Scheduler is active.
- **#70 P0:** current `configure-retention.sh` now enumerates 20 collection groups and fail-closes apply to explicitly approved staging with project/database, legal-matrix, inventory, and preflight checks. The source-level group coverage is present; **no project-bound 20/20 Firestore TTL `ACTIVE` readback or independent legal-hold evidence** is available. The remaining blocker is operational proof, not the former four-group script.
- **#254 P0:** `phase2_work/src/server/multitenant/tenantAuth.ts` is absent from fresh main; #253 remains an unmerged Draft. Full legacy mapping, Firestore/Storage/API tenant isolation and BOLA/IDOR/Art. 17 live-cutover evidence remain unproven.
- **#8 / #73:** production IAM, alert delivery/on-call, canary, restore/RTO/RPO, sustained SLO evidence and enforceable independent CODEOWNERS/review policy remain unproven.
- **#55 / #56:** partner purchase/buyer authenticity, tracking legal basis, consent revocation and retention/Art. 17 approval remain open if partner monetization is in release scope.
- **#204 P1:** current `storage.rules` still allows `/profiles/{uid}/{datei}` reads with `signedIn()` alone, while the policy engine requires adult-state checks for both reader and target.
- **#206 P1:** current `klar.ts` still obtains a Firebase `getDownloadURL()`, persists it as `users/{uid}.photoURL`, and the Profile screen renders the stored URL. This is a source-derived revocation-bypass risk, not evidence of exploitation.

### Read-only Vercel state and decision

- Vercel team listing contains only Klar project `klar-dating`, ID `prj_9dEo2EJIDfmkx6JCS0BqwtF9fXre`, linked to this GitHub repository. Direct project read succeeds. Project metadata reports `live=false` and Node `26.x`; repository `phase2_work/.nvmrc` pins `22.23.3` (package engine is `>=22.23.3`). Treat this as runtime-configuration drift requiring owner review, not proof of an incident.
- Production-target deployment `dpl_AJRgtKhyoF4B8ypLkXBF8vMzw32w` is `READY` and bound to exact main SHA `2fa3ba223989ff248ad1abaea67f4f454f7c9f6b`. READY is not proof of user traffic, runtime health, or approval.
- The latest audit-branch deployment for #313 is a READY preview (target=null) on exact #313 head `6db8309...`. For #314, the only listed branch previews are on older SHAs `abb76a29...` and `acb78f9f...`; no deployment for its current exact head was found.
- The previously confirmed `login-page-prototype` deletion remains closed out; no further deletion attempt was made. No Neon/Postgres/Better-Auth credential was read, rotated, or revoked.

**Decision: `productionApproved=false`, BLOCKED / NO-GO.** No exact integrated release SHA has complete deletion/receipt/race, TTL/legal-hold/Art. 17, tenant/BOLA, production-operations and independent Security/AppSec, DPO/Legal, SRE, Finance (where applicable), and Release Owner approvals. The documentation update made from this checkpoint is on the existing audit review branch only; its resulting new exact head must pass its own CI before it is treated as technically validated. This checkpoint is not a human attestation or production approval.
