# Klar — End-to-End Enterprise Audit

**Auditdatum:** 2026-10-07  
**Baseline:** Klar Enterprise v149 Final Master Consolidated  
**Scope:** Frontend, Express API, Firestore, Cloud Functions/Scheduler, AI/translation, security/compliance, CI/CD, documentation and TCO.

## 1. Executive Summary

**Gesamtstatus: GELB — statische Enterprise-/Security-Gates grün, dynamische Produktionszertifizierung ausstehend.**

### Key Findings

1. **CI/CD-Integrität:** Der GitHub-Playwright-Workflow enthielt eine fehlerhafte Step-Struktur. Das wurde korrigiert. GitLab CI verwendete zusätzlich eine veraltete Node-22.23.0-Pinning-Stufe gegenüber der Repository-Baseline 22.23.3; ebenfalls korrigiert.
2. **Legacy-AI-Übersetzung:** Ein unreferenziertes `src/server/translation.ts` enthielt einen direkten Gemini-Aufruf und einen Dummy-Fallback. Es wurde entfernt. Der produktive Pfad bleibt `translationEngine -> translationService`, mit Sanitization, Timeout und fail-safe Originaltext.
3. **Firestore-Observability:** Der zentrale Durable-DB-Pfad instrumentiert Transaktionen. Direkte Admin-SDK-Transaktionen existieren weiterhin an mehreren Legacy-/Service-Stellen; sie müssen in der CI-/Runtime-Abnahme gegen den tatsächlichen Trace-Bestand geprüft werden. Dies ist **P1**, kein behaupteter Produktions-PASS.
4. **Chat-Leseweg:** `/api/chats` lädt bis zu 50 Gespräche und führt pro Eintrag zusätzliche Zugriffs-/Profilabfragen aus. Das ist ein potenzielles N+1-Muster und sollte bei realen Lastdaten per Trace/Firestore-Metrik bestätigt und anschließend gebündelt optimiert werden.
5. **Release-Zertifizierung:** Der bereitgestellte Runner besitzt nicht die vollständige Dependency-/Emulator-/Browser-Toolchain. Typecheck, Vitest, Firebase-Emulatoren, Playwright und Build sind deshalb nicht lokal als PASS belegbar.

### TCO-Hebel

Ohne reale Traffic-, Firestore-Read-, Gemini- und Hosting-Rechnungsdaten werden **keine erfundenen Prozentwerte** ausgewiesen. Messbar priorisiert sind:
- Chat-Read-N+1: potenziell hoher Firestore-Read-Hebel.
- Translation: 1.5s Timeout + kein kommerzieller Fallback verhindert unkontrollierte AI-Kosten.
- Gemini: zentrale Budget-/Token-Begrenzung und minutengenaue Observability ermöglichen spätere echte FinOps-Optimierung.

## 2. Detaillierter Audit-Befund nach Domänen

### Frontend

| ID | Komponente / Modul | Befund / Risiko | Auswirkung | Handlungsempfehlung | TCO-Impact |
|---|---|---|---|---|---|
| FE-01 | ChatView | Readability-/Accessibility-Härtung vorhanden | Low | E2E/Axe auf installierter CI-Toolchain ausführen | Low |
| FE-02 | Date Planner / Calendar | UID-gebundene serverseitige Autorität vorhanden | Low | Emulator- und Browserjourneys grün bestätigen | Low |
| FE-03 | Language Switcher | DE/EN/ES/FR, i18next und Root-`lang` statisch abgesichert | Low | Browser-Test mit Keyboard/Screenreader durchführen | Low |

### Backend/API

| ID | Komponente / Modul | Befund / Risiko | Auswirkung | Handlungsempfehlung | TCO-Impact |
|---|---|---|---|---|---|
| BE-01 | Translation | Legacy-Direktpfad entfernt; produktiver Pfad sanitisiert und begrenzt | Medium | CI-Gate `check:legacy-translation-boundary` beibehalten | Positiv |
| BE-02 | Chat list | Bis zu 50 Chats; Access-/Profil-State wird jetzt dedupliziert per Bulk-Read geladen | High | Runtime-Traces erheben und Firestore-Read-/Latency-Amplification vor vollständiger P1-Schließung messen | Potenziell hoch |
| BE-03 | AI | Zentrale Budgetierung, Timeout und strukturierte Antworten vorhanden | Medium | CI mit echten Gemini-Metriken validieren | Positiv |
| BE-04 | Rate limiting | Kritische Pfade besitzen verteilte Firestore-Limits; mehrere Read-/Admin-Limits sind process-local | Medium | Nur bei Multi-Instance-Risiko auf Shared Store migrieren; nicht pauschal ohne Lastnachweis | Mittel |

### Datenbank

| ID | Komponente / Modul | Befund / Risiko | Auswirkung | Handlungsempfehlung | TCO-Impact |
|---|---|---|---|---|---|
| DB-01 | Firestore Rules | Öffentliche/unbedingte Client-Schreibrechte nicht vorhanden | High | Emulator-Gate als Release-Blocker beibehalten | Neutral |
| DB-02 | UID-scoped planner/checklist | Serverautorität und UID-Scope vorhanden | High | Race-/Ownership-Tests in CI ausführen | Neutral |
| DB-03 | Transactions | Zentraler Durable-Pfad instrumentiert; direkte SDK-Pfade vorhanden | Medium | Trace-Abdeckung messen und Restpfade vereinheitlichen | Mittel |

### Cloud / Infra

| ID | Komponente / Modul | Befund / Risiko | Auswirkung | Handlungsempfehlung | TCO-Impact |
|---|---|---|---|---|---|
| INF-01 | Node baseline | GitHub/Docker/package baseline 22.23.3; GitLab korrigiert | Medium | Ein einziges Toolchain-Gate für alle CI-Systeme | Neutral |
| INF-02 | Scheduler | Storage-Purge und KYC-Reconciliation sind secrets-gesichert und singleton-beschränkt | High | Staging-Success-Run und Retry-Evidence erfassen | Positiv |
| INF-03 | Container | Immutable digest + attestation workflow vorhanden | High | Release-Workflow in geschützter Umgebung ausführen | Neutral |

### Security

| ID | Komponente / Modul | Befund / Risiko | Auswirkung | Handlungsempfehlung | TCO-Impact |
|---|---|---|---|---|---|
| SEC-01 | Auth boundary | Firebase Admin verification statisch PASS | High | Dynamic auth tests in CI | Neutral |
| SEC-02 | AI PII | Sanitizer boundary PASS | Critical | Keine direkte Provider-Route außerhalb zentraler AI-Budget-/Policy-Schicht zulassen | Positiv |
| SEC-03 | Art. 17 | Deletion audit PASS | Critical | Regelmäßig Emulator-/Restore-Evidence erneuern | Neutral |
| SEC-04 | Consent | Granulares Ledger/Purge-Pfad PASS | Critical | Staging consent revoke + cascade nachweisen | Neutral |

## 3. Priorisierter Handlungsplan

### P0 — Immediate

| Maßnahme | ICE (I/C/E) | Status |
|---|---:|---|
| CI-Workflow-Syntax reparieren und Node-Pinning vereinheitlichen | 10/10/10 = 1000 | **ERLEDIGT** |
| Legacy-Gemini-Translation entfernen und Gate hinzufügen | 9/10/9 = 810 | **ERLEDIGT** |
| Dynamische Release-Gates auf Node 22.23.3 + vollständiger Dependency-/Emulator-Stack | 10/10/6 = 600 | **OFFEN / CI erforderlich** |

### P1 — High Value

| Maßnahme | ICE | Status |
|---|---:|---|
| Chat-Read-N+1 mit realen Traces quantifizieren und reduzieren | 9/8/6 = 432 | **IMPLEMENTIERT / RUNTIME-EVIDENZ OFFEN** |
| Direkte Firestore-Transaction-Trace-Abdeckung auf 100% bringen | 8/8/6 = 384 | **OFFEN** |
| Process-local Rate-Limits nur dort ersetzen, wo Multi-Instance-Schutz erforderlich ist | 8/7/5 = 280 | **KRITISCHE PFADE ERLEDIGT / REST EVIDENZBASIERT OFFEN** |

### P2 — Enterprise Excellence

- FinOps-Dashboard aus echten Gemini-/Firestore-/Hosting-Daten ableiten.
- Restore-/Rollback-Drills mit gemessenen RTO/RPO-Werten durchführen.
- SBOM + Dependency-Audit + CodeQL als revisionssichere Release-Evidence archivieren.
- API-/Architekturdokumentation automatisch aus dem validierten Build-Artefakt erzeugen.

## Update 2026-10-08 — Chat list bulk-read mitigation

- `/api/chats` wurde von einer per-Chat-Transaktion plus individueller Profilabfrage auf eine deduplizierte Firestore-`getAll`-Ausführung umgestellt. Die autoritativen Block-, Account-Deletion- und Beispielprofil-Semantiken bleiben erhalten.
- Der Fix zielt auf RPC-/Latenz-N+1 und reduziert die Anzahl separater Firestore-Aufrufe deutlich; die tatsächliche Read-/Kostenreduktion muss mit Runtime-Traces bestätigt werden, bevor der P1-Befund geschlossen wird.
- Keine Denormalisierung oder speculative caching wurde eingeführt, um Staleness- und Datenschutzrisiken zu vermeiden.

## Update 2026-10-08 — Critical rate-limit distribution hardening

Cloud Run allows up to 10 instances in the current deployment template. Critical abuse-sensitive and cost-sensitive paths therefore cannot rely on in-process counters alone.

The following paths now use an atomic Firestore-backed rate-limit counter: account/consent writes, Klar+ checkout creation, device-token writes, launch/referral flows and Trust-&-Safety writes.

The limiter fails closed when shared state is unavailable, exposes standard remaining/reset metadata, and is guarded by a static Enterprise regression check.

Lower-risk read/anonymous rate limits remain local to avoid turning every read into a Firestore dependency; they are not considered the authoritative multi-instance abuse control.

## Update 2026-10-08 — Final P1 consolidation

The candidate now contains the critical P1 implementation set: Chat list access is collapsed into one bounded read transaction, and security-/cost-sensitive rate limits use atomic Firestore-backed counters suitable for a Cloud Run service scaled to up to 10 instances. Runtime traces and complete CI remain required before the release gates can be closed.

## 4. Dokumentations-Updates

### Release Gate Policy

```text
Statische Security-/Privacy-Gates dürfen niemals einen dynamischen Build-, Emulator- oder Browser-PASS ersetzen.
Ein nicht ausführbarer Gate-Lauf ist BLOCKED_ENVIRONMENT und kein PASS.
Produktionsfreigabe erfordert Node 22.23.3, installierte Lockfile-Abhängigkeiten,
Firebase Emulatoren, Playwright und erfolgreichen Produktions-Build.
```

### Translation Policy

```text
Der einzige produktive Live-Übersetzungspfad ist:
Chat -> /api/translate -> translationEngine -> privacySanitizer -> translationService.
Direkte Gemini-Übersetzung und Dummy-/synthetische Übersetzungsantworten sind verboten.
Bei Provider-Ausfall bleibt der sanitizierte Originaltext autoritativ.
```

### CI Toolchain Policy

```text
Node: 22.23.3
Bun: 1.4.2
Java: 21
Playwright: 1.63.0
Firebase CLI: 15.31.0

Abweichungen sind ein Release-Blocker und müssen zuerst in package/CI/runtime metadata
konsistent geändert und durch das Toolchain-Gate bestätigt werden.
```


## Update 2026-10-08 — CI Typecheck remediation: distributed rate-limit module boundaries

The exact-head Enterprise CI run #166 (37814479762) passed all Enterprise static gates but failed at Typecheck. Root causes were: missing ipKeyGenerator import in src/server/routes/account.ts, an incorrect relative import from src/server/distributedRateLimiter.test.ts, and an unused vi import.

The corrections are committed on candidate c2903822eafad3bf7a22e400cea585c70eef80a5. The IPv6-safe key-generator policy is unchanged and the deterministic cross-instance test remains intact. Documentation was updated in the same candidate lineage.

The candidate remains NO-GO / NOT CONFIRMED until a new exact-head CI run is successful across all dynamic gates. Older run outcomes must not be substituted for current-head evidence.


## Update 2026-10-08 — Server TypeScript declaration boundary repaired

Enterprise CI #170 (`37815141084`) reached Typecheck after all static gates passed and failed because the dedicated `tsconfig.server.json` excluded `src/types/express.d.ts`. The fix explicitly includes declaration files in that server project so Express request augmentation remains authoritative across server compilation.

Candidate: `deb5722030a6974caf97ae592e29bf6229174036`. Strict compiler settings remain unchanged. Production is **NO-GO / NOT CONFIRMED** until the new exact-head CI run completes all dynamic gates successfully.
