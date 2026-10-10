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


### 2026-10-10 — FE-02 Follow-up: Legacy-Memory-Queue mit Benutzerisolierung

**Bestätigter Codebefund und Korrektur auf Entwicklungsbranch:**
- `enqueueChatMessage` deduplizierte bislang nur nach `clientMessageId`, sodass dieselbe ID von zwei Konten zusammenfiel. Jetzt gelten `uid + clientMessageId` als Idempotenzschlüssel. Eingabedaten werden validiert und die Legacy-Queue auf höchstens 100 Einträge je UID begrenzt.
- `getQueuedActions` und `getQueuedMessagesForChat` erfordern jetzt `ownerUid` und liefern ausschließlich entsprechende Queue-Einträge. `syncQueuedActions` erfordert `ownerUid` **und** ein nichtleeres Auth-Token, schickt nur die Aktionen dieses Kontos und verwendet einen Bearer-Header. Fehlende UID oder Authentifizierung führt fail-closed zum Fehler. Source-Commit `f26769c1887de35c9112785457e5617d6c8d2d87`.
- `AuthContext.logOut` räumt jetzt per `clearQueueForUser(uid)` sowohl die IndexedDB- als auch die speicherbasierte Queue auf (Commit `dc712c9ec8c68d6bd40039ee7dbc85c4352e2f7b`). Diagnose-Logs tragen die UID, werden beim Lesen und Entfernen gefiltert und unter einem *explizit UID-gescopten* Storage-Key persistent gespeichert; maximal 100 pro UID, 1000 im Arbeitsspeicher (Commits `c1a46797e51f2857b04e5b44e72be51f6e92c69b`, `c7599c4a855b0ef6246b464e342c5f841b763683`).
- **Callsite-Befund:** Die geprüften Hauptkomponenten `ChatView` und `SyncBanner` verwenden bereits die separaten persistenten IndexedDB-APIs. Der ältere Memory-Queue-Pfad ist vor allem durch Enterprise-Tests sichtbar; ein vollständiger repositoryweiter Callsite-Audit ist noch offen.

**Tests und CI-Abdeckung:** `tests/enterprise/offlineQueueResilience.spec.ts` umfasst jetzt zusätzlich gleiche IDs verschiedener Konten, getrennte Lese- und Sendepfade, leere Auth-/Owner-Werte, Logout-Isolation und Diagnose-Logs (Commits `282a1a33b8615bbf723d1644e7daf8b22cf25170`, `f29cd7708a579639d9e46bd6e751418d17a2c354`, `9904f4ec22cb0a51e1ced11ce0f78333db8892a1`). **Wichtig:** Diese `tests/enterprise/**`-Datei ist in `vitest.config.ts` ausgeschlossen. Deshalb wurde zusätzlich `tests/legacyOfflineQueueIsolation.spec.ts` mit vier Mehrkontenfällen im **regulären** Vitest-Verzeichnis angelegt (Commit `f47c8ba86ae9e1af2f34d1036667e42f14ab72a1`).

Der frühe, dependencies-freie Quellcode-Regressionstest `scripts/legacy-queue-isolation.test.mjs` (Commit `38b8d44dc7d4c3ccb18161450d40162e8aade16b`) ist in `.github/workflows/ci.yml` und `scripts/local-preflight.mjs` eingebunden (Commits `ef33e42187e6848e4e5ddcfdfc55792f647a5ab0`, `9da56f211717ec1ca45fc922d312613ad82a0c7a`). Die aktuellen Original-GitHub-Dateien wurden direkt auf **9/9 source invariants PASS** geprüft (Owner-ID, Token, Logout, Log-Persistenz und Beschränkungen); **kein vollständiger Vitest-/Node-Testlauf** wurde in dieser Iteration ausgeführt.

**Security-Restgrenze:** Eine vom Client übergebene UID ist keine serverseitige Authentifizierung. Der API-Endpunkt muss den tatsächlich signierten Firebase-ID-Token unabhängig prüfen und Sender-/Chat-Berechtigungen erzwingen; die Client-Queue verhindert lediglich versehentliche kontenübergreifende Verarbeitung. Der Bearer-Token wurde nicht kryptografisch gegen die UID im Client geprüft. Vor formellem GO: authentifizierte Multi-Account-E2E-Tests, Logout während laufender Requests, serverseitige UID-/Chat-Authorization, Firestore-Regeln, pinned CI und operative Cloud-Freigabe.

**Ergebnis:** Code-Fix erfolgt, aber ungeprüfte End-to-End-Bedingungen und Release-Gates bleiben offen. R2 eingefroren, kein GitHub Actions-Lauf/Merge/Deploy. **NO-GO**.


### 2026-10-10 — P0 Nachrichtenversand: verifizierte Senderidentität und Replay-Abbruch

**Prüfung der produktiven API-Grenze:** `server.ts` verlangt vor dem Chat-Router einen Firebase-ID-Token, den Firebase Admin mit `verifyIdToken(idToken, true)` inklusive Revocation-Check verifiziert; `req.user` wird ausschließlich aus dem verifizierten Token gesetzt. `src/server/messages.ts` bezieht die UID aus `currentUserId(req)` und verwendet `readChatAccess` sowohl vor externer Nachrichtensicherheitsprüfung als auch im Firestore-Schreib-Transaction. Der Server verwendet die Request-UID **nicht** als Nachrichtenabsender. Ein Identitäts- oder Berechtigungs-Bypass durch Body-`uid` konnte in diesem Pfad **nicht** nachgewiesen werden.

**Defense in Depth umgesetzt:** Der Nachrichtenhandler verweigert jetzt mit `403 sender_mismatch` jede ausdrücklich übermittelte `uid`, `ownerUid` oder `senderId`, die vom verifizierten Token abweicht (Commit `bd4077c64f46b1fd14af06bcbe46dcdd69797bd0`). Dies verhindert insbesondere, dass eine nach Kontowechsel irrtümlich mit dem Token eines anderen Kontos wiederaufgenommene Alt-Nachricht stillschweigend diesem anderen Absender zugeschrieben wird. Drei neue Emulator-Szenarien plus ein Positivfall für verifizierte UID und gleicher clientMessageId zweier Nutzer in `tests/chatPersistence.spec.ts` (Commits `f01c5a7a813e3ed403a0f15f2b37236f10d0479d`, `4e54005c4d8a012a1e4b14b0a0f032da0b065843`).

**Client-Race behoben:** `flushOfflineQueue` erhält optional ein `AbortSignal` und eine `isCurrentUser`-Prüffunktion und beendet Replay vor dem nächsten Request sowie nach ausstehenden Fetch-/JSON-Schritten, ohne beim Abbruch Retry-/Dead-Letter-Zähler zu verändern (Commit `985c5b6dc529cf82b1dff53a17a9187b1a09771d`). `SyncBanner` beendet aktive Läufe beim Authwechsel, bei Offline-Zustand und beim Unmount, verhindert Duplikatstarts, zeigt statt einer unhandled Promise-Rejection einen neutralen Synchronisierungsfehler und erlaubt Neustart bei wiederhergestellter Verbindung (Commits `a7893f5262f24dec7e2e658b1c92f5e9baca7541`, `b2bc8b582cfceea4561ad9b353f975c9f352a2f0`). Beim Start von `AuthContext.logOut` wird ein explizites Cancel-Ereignis ausgelöst – **bevor** der asynchrone serverseitige Revocation-Aufruf beginnt –, und der Synchronisierer bleibt für die abzumeldende UID pausiert (Commits `94c005556a835900cfff434fee829f43098f9a89`, `8770c252db435b48b63c1c558da579f4e77cac04`, `2cb4a2409e0f25bf8330887e13ae2363907ba4c6`).

**Regressionen:** `tests/offlineReplayCancellation.spec.ts` enthält vier ausführbare Vitest-Szenarien für vorab abgebrochenen Replay, Kontoänderung vor Request, Kontoänderung während HTTP und Abort-Fehler ohne Retry-Inkrement (Commit `d65060e91db8a7e02570e1a2dbc8d3c1f38bd12b`, Test-Mock-Typisierung `91e806f702a74533744847e9ffb3ea57ea7f957b`). `scripts/offline-replay-auth.test.mjs` ist als günstiger Node-Quellschutz vor der Dependency-Installation in CI und lokalem Preflight eingebunden (Commits `a16a6486f29204ee1c3fd4613c8e8ed3d4683801`, `8a2d5830fa441d2f4c3310efcfd2a838fd5ed67d`, `754384785c4973507bd84f12f6a0ba43b10c77fe`).

**Tatsächlicher Nachweis und Grenzen:** Im aktuellen GitHub-Quellstand wurden **13/13 gezielte statische Sicherheitsbedingungen** gegen die Originaldateien bestätigt, darunter verifizierte Firebase-UID, zweimalige Transaktions-Chat-Prüfung, Ablehnung widersprüchlicher Body-IDs, Replay-Abbruch nach Netzwerkwarten und Cancel beim Logout-Start. **Keine** Vitest-/Firebase-Emulator-/Playwright-Ausführung der neu hinzugefügten Tests, kein vollständiger Node 22.23.3/Bun 1.4.2/Java 21-Preflight und keine produktive Alarm-/Cloud-Freigabe in dieser Iteration. Ein schon laufender HTTP-Request kann beim Logout bereits den Server erreicht haben; die serverseitige Revocation-/Authorization-Grenze bleibt daher zwingend. R2 eingefroren, keine GitHub-Actions-Minuten, kein Merge/Deploy. **NO-GO**.


### 2026-10-10 — P1 Betriebsresilienz: automatische, begrenzte Offline-Wiederaufnahme

**Bestätigter Funktionsbefund:** Der `SyncBanner` startete nach einem fehlgeschlagenen, aber korrekt in IndexedDB verbliebenen Offline-Sendeversuch keinen weiteren Versuch, solange die Verbindung bestehen blieb und weder ein neues Online- noch ein Auth-Ereignis eintraf. Dadurch konnten Nachrichten ohne sichtbaren erneut ausgelösten Retry liegen bleiben. Separat meldete `flushOfflineQueue` nur *neu* dead-lettered Nachrichten des aktuellen Durchlaufs; ein späterer Durchlauf konnte die Warnanzeige über bereits vorhandene Dead-Letter-Nachrichten auf 0 setzen.

**Korrekturen ausschließlich im Entwicklungsbranch:**
- `src/components/SyncBanner.tsx`: bei weiterhin offenen Nachrichten und bestehender Internetverbindung genau **einen** Retry nach 60 Sekunden vormerken; `retryDelayMs` ist bereits auf max. 60 Sekunden begrenzt. Kein Polling bei leerer Queue, keine überlappenden Sends. Geplante Timer bei Online-/Offline-Wechsel, Logout, Auth-Wechsel und Component-Unmount löschen. Commit `ba257001b37e94692a6fd1f740e71c321827473f`.
- `src/lib/offlineQueue.ts`: `deadLettered` als **gesamte Anzahl** aktuell für diesen User gespeicherter Dead-Letter-Einträge zurückgeben und `remaining` getrennt aus derselben UID-begrenzten IndexedDB-Abfrage berechnen. Keine Änderung der atomaren Message-Persistierung, Retry-Grenzen oder Firestore-Sendeauthorisierung. Commit `6a98f2fd406fbe1819f78baa595f8146e89ad6f2`.
- Regressionen: günstiger Node-Source-Guard `scripts/offline-retry-scheduler.test.mjs` (Commits `bc707212fa0f47aaf20c63235a59922e5e2806ca`, `5af7e1c5dde27b69bc00a633cbc7770acaf0bd65`), in `.github/workflows/ci.yml` und `scripts/local-preflight.mjs` hinterlegt (Commits `38ebbca03768b873d0475457b110bd97202c93af`, `ef1037066d85667b94327e4a67f998bb5bae0361`). Zwei zusätzliche reguläre Vitest-Fälle testen bestehende Dead-Letter-Warnung und parallele noch nicht fällige Retry-Nachrichten (`tests/offlineReplayCancellation.spec.ts`, Commit `e848f4b0669fb3ec2bf4dd6ae214cf03d92a78fd`).

**Nachweisgrenze:** Die aktuellen GitHub-Quelltexte und CI-Einträge wurden direkt abgerufen; **14/14 gezielte statische Invarianten** bestätigt, insbesondere Dauer, User-Session-Bindung, vollständige Timerbereinigung und fortbestehende Dead-Letter-Warnungen. Die neu committed Node-/Vitest-Regressionen wurden **noch nicht** als ausführbarer Test unter der vorgeschriebenen Node-22.23.3-/Bun-1.4.2-Toolchain gestartet. Echte Browser-IndexedDB/Netzunterbrechung/Mehrtab-/Logout-Tests und quantifizierte TCO-Einsparungen bleiben ausstehend.

**Operative Abnahme:** Wiederaufnahme bei stabiler Verbindung mit ungesendeter Nachricht, maximal fünf Versuche und erwarteter Backoff, persistierende Dead-Letter-Anzeige, kein Retry nach Logout oder Unmount und keine fremden UID-Aktionen. Die Client-Abbruchmechanismen ersetzen weder serverseitige Tokenprüfung noch Idempotenz. R2 unverändert, kein Actions-Lauf, Merge oder Deploy; **NO-GO**.
