# Klar Enterprise – risikokontrolliertes End-to-End-Audit

**Stand:** 2026-10-10. **Branch:** `ci/optimize-llm-evaluation-frozen-install-2026-10-10`. **Releaseentscheidung:** ROT / **NO-GO**. Eingefrorener R2-Kandidat unverändert.

**Prüfumfang und Grenzen:** Dateibaum-Inventar mit 1.142 Datei-/Verzeichnis-Einträgen und risikoorientierte Quellcodeprüfung ausgewählter Frontend-, Express-, Firebase-, KI-, Sicherheits-, CI- und Betriebsdateien. **Nicht** alle 1.142 Einträge wurden inhaltlich geprüft. Keine aktuelle vollständige CI auf Node 22.23.3/Bun 1.4.2/Java 21, keine echte Cloud-, Billing- oder Alarmzustellungsprüfung.

## 1. Executive Summary

**Key Findings:**
1. **SEC-01, High, Code korrigiert:** KI-PII-Redaction ließ bisher jedes Feld `data` ungefiltert. Nur `inlineData.data` (Mediendaten) darf ausgenommen bleiben.
2. **FIN-01, High, Code korrigiert:** FinOps-Freigabe-CLI übergab 3 von 8 notwendigen Validatorparametern; unabhängige Vertrauensgrenzen für Host, Umgebung, Evidence-Zeitfenster und Kostenlimit wurden nicht korrekt übergeben.
3. **OPS-01, High, Code korrigiert:** Compliance-Retry-Scheduler übersprang fehlendes `COMPLIANCE_API_ORIGIN` stillschweigend; jetzt signalisiert er Fehler.
4. **OPS-02, Critical, offen:** Echte Cloud-Run-/IAM-/Secret-/Alert-/Rollback-/On-Call-Evidenz und Human Approval fehlen weiterhin.
5. **PERF/FIN-02, Med, offen:** `ChatView.tsx` (ca. 116 KB Quelltext), nicht indizierter nutzerbezogener `getAll()`-Offline-Queue-Scan, globaler Firestore-AI-Tageszähler und pro Instanz wachsender `CostTracker` sind zu untersuchende Effizienz-/Betriebsrisiken, keine gemessenen Incidents.

**TCO:** Tatsächlich nachgewiesene Einsparung **0 %** mangels Billing- und Lastdaten. **[ANNAHME – illustratives Szenario, keine Prognose]:** Bei Kostenanteilen Compute 30 %, Firestore 25 %, KI 35 %, andere 10 % und komponentenweisen Einsparungen 10 %, 20 %, 15 %, 0 % wären es rechnerisch **13,25 %** Gesamt-TCO. Realisierte Einsparung kann 0 % oder negativ sein. Jede Änderung benötigt SLO-/Datenschutz-/Sicherheits-Gates.

## 2. Detaillierter Audit-Befund nach Domänen

### Frontend
| ID | Komponente / Modul | Befund / Risiko | Auswirkung | Konkrete Handlungsempfehlung | TCO-Impact |
|---|---|---|---|---|---|
| FE-01 | `src/screens/ChatView.tsx` | Großes Modul, viele Effects und Firebase-Listener; kein nachgewiesenes Leak | Med | Schrittweise Hooks/Teilkomponenten extrahieren, Listener- und Geräte-E2E beibehalten | Wartung/CPU messen |
| FE-02 | `src/lib/offlineQueue.ts` | `getAll()` liest Queue global, Nutzerfilter folgt später | Med | Bestehenden `ownerUid`-Index verwenden, Konto-Wechsel und Retry testen | RAM/CPU messen |
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
