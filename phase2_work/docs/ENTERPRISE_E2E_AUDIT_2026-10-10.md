# Klar Enterprise – risikokontrolliertes End-to-End-Audit

**Stand:** 2026-10-10. **Branch:** `ci/optimize-llm-evaluation-frozen-install-2026-10-10`. **Releaseentscheidung:** ROT / **NO-GO**. Eingefrorener R2-Kandidat unverändert.

**Prüfumfang und Grenzen:** Dateibaum-Inventar mit 1.142 Datei-/Verzeichnis-Einträgen und risikoorientierte Quellcodeprüfung ausgewählter Frontend-, Express-, Firebase-, KI-, Sicherheits-, CI- und Betriebsdateien. **Nicht** alle 1.142 Einträge wurden inhaltlich geprüft. Keine aktuelle vollständige CI auf Node 22.23.3/Bun 1.4.2/Java 21, keine echte Cloud-, Billing- oder Alarmzustellungsprüfung.

## 1. Executive Summary

**Key Findings:**
1. **SEC-01, High, Code korrigiert:** KI-PII-Redaction ließ bisher jedes Feld `data` ungefiltert. Nur `inlineData.data` (Mediendaten) darf ausgenommen bleiben.
2. **FIN-01, High, Code korrigiert:** FinOps-Freigabe-CLI übergab 3 von 8 notwendigen Validatorparametern; unabhängige Vertrauensgrenzen für Host, Umgebung, Evidence-Zeitfenster und Kostenlimit wurden nicht korrekt übergeben.
3. **OPS-01, High, Code korrigiert:** Compliance-Retry-Scheduler übersprang fehlendes `COMPLIANCE_API_ORIGIN` stillschweigend; jetzt signalisiert er Fehler.
4. **OPS-02, Critical, offen:** Echte Cloud-Run-/IAM-/Secret-/Alert-/Rollback-/On-Call-Evidenz und Human Approval fehlen weiterhin.
5. **PERF/FIN-02, Med, offen:** `ChatView.tsx` (ca. 116 KB Quelltext), zuvor nicht indizierter nutzerbezogener `getAll()`-Offline-Queue-Scan (Code nun korrigiert), globaler Firestore-AI-Tageszähler und pro Instanz wachsender `CostTracker` sind zu untersuchende Effizienz-/Betriebsrisiken, keine gemessenen Incidents.

**TCO:** Tatsächlich nachgewiesene Einsparung **0 %** mangels Billing- und Lastdaten. **[ANNAHME – illustratives Szenario, keine Prognose]:** Bei Kostenanteilen Compute 30 %, Firestore 25 %, KI 35 %, andere 10 % und komponentenweisen Einsparungen 10 %, 20 %, 15 %, 0 % wären es rechnerisch **13,25 %** Gesamt-TCO. Realisierte Einsparung kann 0 % oder negativ sein. Jede Änderung benötigt SLO-/Datenschutz-/Sicherheits-Gates.

## 2. Detaillierter Audit-Befund nach Domänen

### Frontend
| ID | Komponente / Modul | Befund / Risiko | Auswirkung | Konkrete Handlungsempfehlung | TCO-Impact |
|---|---|---|---|---|---|
| FE-01 | `src/screens/ChatView.tsx` | Großes Modul, viele Effects und Firebase-Listener; kein nachgewiesenes Leak | Med | Schrittweise Hooks/Teilkomponenten extrahieren, Listener- und Geräte-E2E beibehalten | Wartung/CPU messen |
| FE-02 | `src/lib/offlineQueue.ts` | Globaler `getAll()`-Scan wurde beseitigt; die neuen owner-spezifischen Abfragen sind implementiert, vollständige Browser-/Mehrkonten-Abnahme offen | Med | IndexedDB-Regressionen unter gepinnter CI, Konto-Wechsel/Retry/Dead-Letter und Performance-Messung | RAM/CPU messen |
| FE-03 | Vite/Bundle-Budget | Chunk- und gzip-Gates existieren; keine aktuellen Web-Vitals | Med | LCP/INP/CLS und TTI bei realistischen Netzbedingungen erheben | CDN/UX messen |

### Backend/API
| ID | Komponente / Modul | Befund / Risiko | Auswirkung | Konkrete Handlungsempfehlung | TCO-Impact |
|---|---|---|---|---|---|
| BE-01 | `server.ts` | Monolithische API-Datei (ca. 102 KB Quelltext) | Med | Domänenrouten kontrolliert extrahieren, Auth-/Contracttests | Incident-Wartung |
| BE-02 | `src/server/aiBudget.ts` | Globale tägliche Firestore-Budget-Transaktion je KI-Aufruf; mögliche Contention | Med | Konkurrenztest, strikt atomare Budgetgrenze erhalten | Retry-Kosten |
| BE-03 | Rate-Limiter-Module | In-Memory- und verteilte Variante existieren; Routenzuordnung nicht vollständig belegt | High bei kritischen In-Memory-Routen | Kritische Endpunkt-Matrix und Multi-Instance-Test | Abuse-Kosten |
| BE-04 | KI-PII-Sanitizer | `data`-Bypass **behoben**, full-gate offen | High | Vollständige KI-/Consent-/Provider-Tests | Risiko |

### Datenbank / Storage
| ID | Komponente / Modul | Befund / Risiko | Auswirkung | Konkrete Handlungsempfehlung | TCO-Impact |
|---|---|---|---|---|---|
| DB-01 | Firestore-/Storage-Rules | RBAC via Custom Claims, biometrische Client-Leserechte verwehrt; Emulator-/Prod-Abnahme offen | High | Negative Emulator- und Deployment-Evidenz | Risiko |
| DB-02 | `functions/src/retention.ts` | Paginierte, generation-aware Löschung; sequentielle Remote-Operationen | Med | Idempotente Last-/Hold-/412/404-Tests vor Parallelisierung | Storage-RPC |
| DB-03 | AI-Budget-Globalzähler | Möglicher Firestore-Hotspot; noch keine Messwerte | Med | Staging-Lasttest und Transaktions-Retry-Metrik | Firestore |

### Cloud / Infrastruktur
| ID | Komponente / Modul | Befund / Risiko | Auswirkung | Konkrete Handlungsempfehlung | TCO-Impact |
|---|---|---|---|---|---|
| CL-01 | Compliance-Scheduler | Stiller Fehlkonfigurations-Skip **behoben** | High | Cron-Fehleralarm und Queue-Fortschritt produktiv nachweisen | Incidentkosten |
| CL-02 | Produktionskontrollen | Read-only-GCP-Audit gehärtet, aber keine echte Live-Evidenz | Critical | Secret-/IAM-/Monitoring- und On-Call-Übungen mit Build-SHA | Fehlfreigabe |
| CL-03 | `load-slo.ts` / `ops/slo.json` | Synthetische Health-/Ready-GETs, keine Chat-/KI-Last; API-p95-SLO 300 ms ist Ziel, keine Messung | Med | Autorisierten realistischen Traffic-Mix messen | Compute/DB |
| CL-04 | `costTracker.ts` | In-Memory-Map ohne in diesem Modul sichtbare Retention oder Persistenz | Med | Kardinalität begrenzen, Billing-Export-Reconciliation | RAM/FinOps |
| CL-05 | Load-/Cost-Evidence-CLI | 8-Parameter-Vertrag und exakte Report-Pfadbindung **korrigiert** | High | Realen Billing-/Load-Nachweis mit Budget-Approval führen | FinOps |

### Security, Governance und Compliance
| ID | Komponente / Modul | Befund / Risiko | Auswirkung | Konkrete Handlungsempfehlung | TCO-Impact |
|---|---|---|---|---|---|
| SEC-01 | KI-Provider-PII-Grenze | Bisheriger generischer `data`-Bypass **korrigiert**, echte Provider-Abnahme offen | High | End-to-end Redaction, Consent und Telemetrie-PII-Grenzen nachweisen | DSGVO-/Vorfallrisiko |
| SEC-02 | Didit/Stripe/Auth/BGB/DSGVO | Tests und statische Gates vorhanden; alle produktiven Edge-Cases in dieser Iteration nicht verifiziert | High | Replay-/Kündigungs-/Lösch-/Re-Auth-E2E auf exact SHA | Support/Compliance |
| SEC-03 | Software Supply Chain | Gepinnte Runtime und SHA-Actions, aber kein aktueller vollständiger SCA/SAST/DAST-/SBOM-/Attestation-Nachweis für diesen Branch | High | Berichtspflichtiges vollständiges Freigabe-Gate inkl. Dependency-/Container-Scan | Sicherheitsrisiko |
| SEC-04 | Go-Live-Freigabe | Issue #8 verlangt echte operative Nachweise und Human Approval | Critical | Verantwortliche, Evidence-Links, Canary/Rollback und Signoff dokumentieren | Fehlfreigabekosten |
| SEC-05 | `ARCHITECTURE.md` | Drei Root-Dokumentationslinks und zwei Codepfade veraltet, **korrigiert** | Low | Link-Prüfung CI-weit ergänzen | Audit-/Onboardingzeit |

## 3. Priorisierter Handlungsplan (ICE)

**ICE = Impact × Confidence × Ease**; Werte 1–10. Reihenfolge gilt **innerhalb** einer P-Klasse; Compliance-/Sicherheits-P0 überschreibt P1 mit höherem ICE. Scores sind Priorisierungsurteile, keine Messungen.

| Klasse | ID / Aufgabe | Impact | Confidence | Ease | ICE | Abnahmekriterium |
|---|---|---:|---:|---:|---:|---|
| P0 | OPS-01 Compliance-Retry-Fehler sichtbar machen (**Code erledigt**) | 9 | 10 | 9 | **810** | gepinnte CI, echte Jobfehler-Alarme und Queue-Fortschritt |
| P0 | SEC-01 PII-`data`-Bypass schließen (**Code erledigt**) | 10 | 10 | 8 | **800** | vollständige KI-/Consent-/Provider-Regression |
| P0 | FIN-01 unabhängige FinOps-CLI-Abnahme (**Code erledigt**) | 8 | 10 | 9 | **720** | echter Billing-/Load-Report, Finance-Freigabe |
| P0 | OPS-02 reale Produktionsgates und Freigabe (**offen**) | 10 | 10 | 3 | **300** | Cloud-IAM, Secret-Rotation, Alert-Delivery, On-Call und Human Signoff |
| P1 | FE-02 indizierte Offline-Queue-Abfragen (**Code erledigt**) | 6 | 9 | 7 | **378** | Echte Browser-/Mehrkonten-Abnahme und gemessene Lastsenkung |
| P1 | CL-04 kardinalitätsbegrenzte Cost-Telemetrie | 7 | 9 | 6 | **378** | Begrenzung, persistente Aggregation und Billing-Abgleich |
| P1 | DB-03 globales AI-Budget unter Konkurrenzlast | 8 | 8 | 5 | **320** | P95 und Transaktionskonflikte gemessen; strikte Kostenobergrenze |
| P1 | FE-01 ChatView entkoppeln | 6 | 9 | 4 | **216** | grüne Browser-/Auth-/Übersetzungs-Verträge |
| P2 | SEC-05 Dokumentations-/Architekturlink-Gate | 4 | 10 | 9 | **360** | keine defekten internen Root-Links |
| P2 | CL-03 Last- und Kosten-Evidenz wiederkehrend | 6 | 8 | 6 | **288** | monatlich abgenommene Kosten/SLO je Build |

**Kontrollierte Umsetzung:** (1) Code- und Isolationstests lokal; (2) genau eine abgestimmte vollständige CI auf gepinnter Node-22.23.3/Bun-1.4.2/Java-21-Toolchain mit TypeScript/Vitest/Firebase/Playwright/SCA/SAST; (3) Staging-Performance, Retention/Consent/Incident/Canary-Rollback; (4) produktive read-only-Sicherheitskontrollen, Rotation, Alarmzustellung und verantwortliches GO/NO-GO. GitHub-Actions-Minuten vor Auslösung mit dem genehmigten Budget abgleichen.

## 4. Dokumentations-Updates (direkt einsetzbar)

**Bereits aktualisiert:** Root-`ARCHITECTURE.md` verweist nun auf die tatsächlich vorhandenen `phase2_work/docs/architecture/`, `governance/`, `finops/` sowie korrekte Source-/Config-Pfade. Dieser Bericht ist der aktuelle risikobasierte Auditstand, nicht die Bestätigung einer vollständigen Produktivabnahme.

### Betriebs-Runbook: Kostenfreigabe (aus `phase2_work/`)

Die folgenden Variablen sind **zuvor unabhängig** durch Betreiber/Finance festzulegen, nicht dem eingereichten Evidence-JSON zu entnehmen: `KLAR_EXPECTED_SHA` (exakter Build), `KLAR_EVIDENCE_ENVIRONMENT` (`production` oder `staging`), `KLAR_APPROVED_EVIDENCE_HOSTS` (zugelassene DNS-Namen), `KLAR_EVIDENCE_NOT_BEFORE` / `KLAR_EVIDENCE_NOT_AFTER` (genehmigtes ISO-Zeitfenster) und `KLAR_APPROVED_MAX_COST_PER_1000_REQUESTS_USD` (freigegebenes positives Finanzlimit).

```bash
bun run tsx scripts/validate-load-cost-evidence.ts \
  /approved/evidence/load-cost.json \
  /approved/evidence/load-report.json \
  "$KLAR_EXPECTED_SHA"
```

Der CLI-Abgleich verweigert fehlende Operator-Vorgaben und unterschiedliche Load-Report-Pfade. Der Cost-Evidence-Validator muss den **exakt gleichen** Build, die genehmigten Hosts/Zeiten, den positiven Budgetwert und die tatsächliche Kosten-/Request-Arithmetik bestätigen. **Kein** Preiswert wurde vom Audit erfunden.

### Betriebs-Runbook: Compliance-Retry

`COMPLIANCE_API_ORIGIN` muss auf den freigegebenen exakten HTTPS-Origin der API gesetzt sein. Fehlende Konfiguration führt beim Scheduler nun zu einem **sichtbaren Fehler statt einem stillen Erfolg**. Für die Produktion sind Scheduler-Fehleralarm, definierter On-Call, erfolgreiche Retry-Verarbeitung und eine nachweislich leere/abgearbeitete Queue separat zu prüfen.

### Nachweise, Abgrenzung und Governance

- **SEC-01:** Lokale `aiPiiSanitizer.ts` stimmt per `git hash-object` mit GitHub-Blob `6e6a1d9e72fc848d8706db9a77b0642a1a9dced5` überein; **2/2** gezielte Node-Tests und strenger Einzeldatei-TS-Check bestanden (Node 22.16.0). Vollständiger Repo-Vitest und KI-Provider-End-to-End bleiben offen.
- **FIN-01:** CLI- und Testdateien sind bytegleich zu `f47a09e0cc797b9f335c4b751c1ce919db45716b` und `dfd0c56d9ba438ae9f5456ee2dafc90fc8373ced`; **3/3** Node-Quellvertragstests bestanden. Kein realer Billing-/Load-CLI-Lauf erfolgt.
- **OPS-01:** Scheduler- und Testdateien stimmen zu `48bc1f8ae7e1fc9eb404493883ffae918b440cdd` und `0c23dc6e0279dd45833d3b949a8c847231eec2db`; **2/2** Node-Sicherheitsregressionen bestanden. Kein echter Cloud Scheduler-/Compliance-Queue-Test.
- **Freigabe:** Eingefrorener `release/candidate-preflight-2026-10-10-r2` bleibt unverändert. Diese Arbeiten sind auf dem Entwicklungsbranch. Kein Merge, Deploy, GitHub-Actions-Lauf, produktiver Cloud-Zugriff oder Human Signoff. **NO-GO.**


### 2026-10-10: FE-02 IndexedDB-Queue-Isolation und TCO-Optimierung

- **Fix im Entwicklungsbranch:** Alle vier zuvor globalen IndexedDB-Leseaufrufe sind jetzt entweder direkte `get(primaryKey)`-Operationen (Checkliste laden/synchronisieren) oder `ownerUid`-Indexabfragen (`getAll(IDBKeyRange.only(ownerUid))` für Nachrichtenflush und Remaining-Count). Die primäre `ownerUid`-Schema-Version bleibt unverändert; kein Datenverlust durch Migration vorgesehen. `src/lib/offlineQueue.ts` (Commit `9664fd2bf1636f78fdd8219298f203a539f11b10`), separater testbarer Helper `src/lib/offlineQueueIndexedReads.ts` (Commit `20c2f07268bf88596c904779fd24859cba41ac71`).
- **Regressionsschutz:** `scripts/offline-queue-index.test.mjs` (Commit `b198bbd593458773ce3a3a88275b2052d1c94e39`) prüft Quellstruktur und führt Schlüssel-/Indexleseaufrufe mit einer In-Memory-IDB-Anforderungssimulation aus. Eingebunden in CI vor Dependency-Installation und `verify:local` (Commits `24abea646276d7c359de4d778461436ab2473666`, `6b920d64d4e4f64789626b5444d6241f13393bfe`).
- **Tatsächlich ausgeführt:** Lokaler Node **22.16.0**, byteidentisches Original-Lesemodul (Git blob `b7aa13be871cf4f8eb2755a39657a8227f085f35`): **2/2 funktionale IDB-Mock-Tests PASS**, eigenständiger strenger TypeScript-DOM-Check PASS. Zusätzlich wurden sechs statische Quellcodeinvarianten am aktuellen GitHub-`offlineQueue.ts` geprüft (alle PASS). Die vollständigen sechs committed Node-Regressionstests und realer Browser/IndexedDB sowie die gepinnte Enterprise-CI sind **noch nicht ausgeführt**. **Keine gemessene Prozentersparnis**.
- **Separat offenes Sicherheitsrisiko:** Die ältere speicherbasierte `memoryQueue` verwendet für `enqueueChatMessage` eine Deduplizierung allein über `clientMessageId` und `syncQueuedActions` hat keinen verpflichtenden `ownerUid`-Parameter. Das ist von der IndexedDB-Optimierung **nicht** abgedeckt. Vor produktiver Nutzung dieses Legacy-Pfads ist UID-spezifische Deduplizierung, Leseberechtigung und Sendebindung mit Regressionstests zu verlangen; nicht ohne Callsite-Inventar API-Signaturen verändern.
- **Freigabestatus:** Legacy-Memory-Queue-Prüfung und vollständiger pinned CI/Browsertest offen, R2 eingefroren, keine Actions-Minuten, kein Merge/Deploy. **NO-GO**.
