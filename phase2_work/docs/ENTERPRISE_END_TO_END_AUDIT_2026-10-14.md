# Klar Enterprise End-to-End Audit — 2026-10-14

**Review target:** `main` commit `bee87aea09a8d10b2e2c3fb74e38e5ecb12be008`.
**Method:** static source/document/workflow inspection via repository API, open-issue inventory and historical pull-request CI snapshots. **Not performed:** local dependency install, live Firestore/Cloud Run/Stripe/Didit/SendGrid/Gemini inspection, current infrastructure/billing export, penetration test, reproducible stage load test, real restore drill, E2E suite executed by this reviewer. Historic green CI must not be equated to production approval.

## 1. Executive Summary

**Release/Compliance: ROT / NO-GO / NOT CONFIRMED.** Stronger CI and modular services exist, but critical trust/retention evidence is outstanding and there is a verified mismatch between declared TTL policy and checked-in provisioning automation. **Architecture/source quality: GELB (limited audit scope); “zero critical bugs” is not proven.**

**Top findings:**
1. **P0 #55/#56:** Partner HMAC webhook proves partner-key possession, not purchase authenticity; verified service currently persists `pending_verification` rather than an automatically earned reward (good containment). `trackedDestination` still sends consent-version-scoped `klar_referral` to partner URL; onward retention, controller roles, withdrawal propagation, Art.-17 deletion remain unresolved.
2. **P0 #70:** `scripts/configure-retention.sh` provisions **only four collection groups**; `docs/DATA_RETENTION.md` lists nine baseline groups + four partner rate-limit groups. This is a provable provisioning gap, **not proof that live TTL is absent**. Do not blindly activate legal-hold/financial deletions.
3. **P1 #71:** `ops/slo.json` establishes **P95 API ≤300 ms** while `src/server/observability.ts` computes breach with `p95 > 1500`; alerting/operational interpretation may disagree.
4. **P1:** `BudgetGuard` and `CostTracker` use in-process Maps; the orchestrator's `assertBudgetAllowed(request.budget)` validates provided budget state but no durable/atomic cross-instance reservation is demonstrated by these files. The docs call budgets hard caps: reconcile the *real API execution path* before treating this as an enforceable global spend control.
5. **P1:** `src/lib/api.ts` retries eligible failures using `sollWiederholen` without an HTTP method/idempotency gate in the shown retry loop. Also `fetchWithCache` caches POST JSON responses in memory for 15 min; usage and semantics must be audited before mutations could be passed through it. Source has mitigating idempotent chat-send logic in separate modules; do not generalize a demonstrated live duplicate-payment bug.

**TCO:** No measured invoice-based savings estimate is defensible. Conditional scenarios: if 10% of metered AI calls are redundant and 80% are safely prevented, modeled *AI-provider variable spend* reduction = 8%; if 20% of Firestore reads are safely cacheable and 25% of those are saved, modeled *Firestore-read charges* reduction = 5%. **[ANNAHME]** Those are scenario inputs, **not observed efficiencies, total TCO savings or approved quotas**.

## 2. Detaillierter Audit-Befund nach Domänen

| ID | Domäne / Code oder Artefakt | Quellbefund / Risiko | Schwere | Konkrete Maßnahme | TCO-Effekt |
|---|---|---|---|---|---|
| FE-01 | `src/lib/api.ts` | Retry-Prüfung betrachtet Fehlerstatus/-körper, aber nicht explizit HTTP-Methode oder Idempotency-Key; mutationsfähige Aufrufe müssen klassifiziert werden | High (conditional) | GET/HEAD bzw. eindeutig idempotente Operationen bevorzugen; für POST nur serverbestätigten Idempotency-Key retryen, Tests für Timeout nach erfolgreichem Commit | Vermeidet Doppelarbeit/API-Kosten |
| FE-02 | `src/lib/api.ts` | In-Memory-POST-JSON-Cache mit 15-min TTL und UID-Schlüssel; kein Persistenzcache (positiv), aber kein im Helper erzwungener Read-only-Endpunkt | Med | Explizites Cache-Allowlisting für lesende Endpunkte und Cache-Clear bei Einwilligungs-/Kontowechsel; Messung von Hit-Rate/Staleness | Nur gemessene sichere Cache-Hits anrechnen |
| FE-03 | `src/App.tsx` | Lazy-Loaded Routen, ErrorBoundary und Reduced-Motion-Handling sichtbar; vollständige A11y-/Web-Vitals-Journey-Nachweise nicht im Source-Review belegt | Med (evidence) | Lighthouse/Web Vitals und keyboard/screenreader flows im staging mit kohortenfähiger Evidenz | Kein ungemessener Wert |
| BE-01 | `src/server/partnerReferralService.ts` | Partner-asserted conversion bleibt `pending_verification`; unabhängiger Kaufnachweis / Settlement und Reversal fehlen, #55/#57 offen | High | Auftrag/Purchase serverseitig autoritativ validieren, signierte Settlement-State-Machine und refund/reversal Tests | Verhindert unberechtigte Rewards |
| BE-02 | `src/server/routes/chat.ts` | Chat-Liste begrenzt auf 50, dedupliziert Referenzen und nutzt tx.getAll (positiv); Verarbeitung benötigt mehrere Dokumente pro Gespräch | Med | Firestore read/request und tx contention pro 50er-Seite messen; Datenprojektion/Materialisierung erst nach Security Review | Potenzial nur über reale read counts |
| BE-03 | `server.ts` / Modularisierung | ~102 KB API-Bootstrap, noch gemischte Middleware-/Routen-Orchestrierung; Stripe-Raw-Body-Reihenfolge explizit sicherheitskritisch | Med | Stufenweises move-only Routing mit Signatur- und Auth-Golden-Tests, keine Big-Bang-Migration | Wartung/Fehlerrisiko |
| DB-01 | `scripts/configure-retention.sh` + `docs/DATA_RETENTION.md` | Vier provisionierte vs neun deklarierte Basis-TTL-Collections, plus vier separat dokumentierte Partner-Rate-Limits | High/P0 | Policy-Matrix genehmigen, Dry-Run und exact-project/database guard, fehlende TTL nur nach Legal-Hold-Prüfung ergänzen, ACTIVE-Evidenz für jede Zielumgebung | Storage-/Compliance- und incident-Risiko |
| DB-02 | `partnerReferralService.ts` | Tokenversion stoppt spätere Attribution, entfernt jedoch keine bereits an Partner ausgespielten Kopien aus Browser/CDN/Partner-Logs | High/P0 | Zeitlich begrenzter, zweckgebundener Exchange-Code + Partnerverträge und Löschprotokolle; Pseudonymität nicht als Anonymität bewerten | Vermeidet Compliance/Incident-Kosten |
| DB-03 | `src/server/routes/chat.ts` / Firestore | Transaktionslast und per-request Referenzanzahl sind lastabhängig; aktuelle Produktionsreads und Index-Latenzen sind nicht belegt | Med | Last-/Abfrageprofile, Transaction-Retry-Zahlen, Index- und Hot-Document-Prüfung im staging | Nur nach Messung optimieren |
| CL-01 | `ops/slo.json` vs `src/server/observability.ts` | 300-ms-SLI-Ziel versus 1500-ms-Hardcode für P95-Breach | High/P1 | Ein kanonisches SLO + route-/window-definierten Prometheus/OTel-SLI; Grenzwert- und Pager-Regression | Früherkennung, keine bezifferte Einsparung |
| CL-02 | `src/server/observability.ts` | In-Prozess-Spans (max. 5000) und Latenzarray-Buckets (max. 2000 pro Minute), 15-min-Fenster; lokaler Workerzustand ≠ globales SLO | Med | Zentrales OTel mit kontrollierter Cardinality, bestätigter Ingestion/Alertzustellung und Lastprofil | Signalqualität/Storagekosten |
| CL-03 | `docs/LOAD_TESTING.md` | Default-Stagingload 30 Sekunden, 10 RPS, nur GET health/ready; keine repräsentativen Provider- oder Auth-Journeys | High (evidence) | 2-account, chat/KYC/billing, burst/soak/provider faults, CPU/memory and billing export, build SHA capture | Voraussetzung valider Kapazitätsplanung |
| SEC-01 | `src/telemetry/budgetGuard.ts` / orchestrator | In-process accounting ohne nachgewiesene atomare Multi-Instance-Abrechnung; BudgetState ist Request-Eingang des Orchestrators | High (scope review) | Produktionsaufrufkette tracen; Firestore-Transaktion/zentralen Budgetledger + reservation/settlement/refund implementieren, Race-/multi-instance-Tests | Begrenzung variabler KI-Kosten |
| SEC-02 | `.github/workflows/ci.yml`, `release.yml` | SHA-pinned Actions, Node 22.23.3, Bun 1.4.2, full scope and provenance flow vorhanden (positiv). Reviewer-/Deployment-/Secret-Monitoring-Evidenz fehlt in dieser Prüfung | High (release evidence) | Branch protection, CODEOWNERS und unabhängiges Review, live IAM/Secret rotation, DAST/SCA artifacts, pinned exact-head SHA und rollback record | Reduziert Supply-Chain-/Incident-Risiko |
| SEC-03 | `README.md` / `docs/SERVER_MODULARISIERUNG.md` | README nennt historischen PR #52 als aktuellen Stand; Modulstatus enthält historisches PR #29. Widerspruch zu aktuellem main | Med | README-Status zu zeitgestempeltem Linksnapshot, eindeutige canonical source/working directory | Senkt Onboarding-/Fehlbedienungskosten |

### Scope und positive Kontrollen

- Firebase Auth, RBAC, Firestore/Storage-Rules, HMAC-signierte Einwilligungs-/Webhook-Flows, OTel, Secrets-, Lockfile- und CI-Gates sind **im Source vorhanden**; ihre produktive Wirksamkeit braucht Umgebungsnachweis.
- `src/server/routes/webhooks.ts` nutzt für Stripe den path-spezifischen Raw-Body-Parser vor JSON; nicht bei refactoren entfernen.
- `docs/BACKUP_RESTORE.md` fordert eine isolierte quartalsweise Restore-Übung mit gemessenen RPO/RTO; eine tatsächlich erfolgreich absolvierte Übung wurde hier **nicht** nachgewiesen.
- Cloud Run / Firestore / Stripe / Didit / Gemini / SendGrid sind Integrationsziele der Quellarchitektur, **nicht** live inventarisierte Kostenstellen.

## 3. Priorisierter Action Plan (ICE, 1–10 je Dimension, Produkt; Modellbewertung, kein empirischer ROI)

**ICE** = Impact × Confidence × Ease. Reihenfolge **innerhalb** einer Priorität nach ICE; P0 wird unabhängig vom niedrigeren ICE zuerst bearbeitet. Confidence = Quellenbeleg für Befund, **nicht** Testabdeckung/Business-Gewissheit.

| Priorität | ID | I | C | E | ICE | Owner / Done Definition |
|---|---|---:|---:|---:|---:|---|
| P0 | DB-01 #70 | 10 | 10 | 6 | 600 | Privacy + SRE: genehmigte TTL-Policy, Script-Matrix + Staging/Live-Status, Legal-Hold-Tests |
| P0 | DB-02 #56 | 10 | 9 | 3 | 270 | DPO + Partner + Backend: External token lifecycle, Data Agreement, revocation/Art17 end-to-end |
| P0 | BE-01 #55 | 10 | 9 | 3 | 270 | Finance + Backend: unabhängiger Purchase-Proof, idempotent settlement/reversal, migration |
| P0 | Release #8 | 10 | 9 | 2 | 180 | Security/SRE/Legal: exact deployment SHA, keys, IAM, restore/canary/rollback and signed approvals |
| P1 | CL-01 #71 | 8 | 10 | 8 | 640 | SRE: unify 300-ms policy/alert, automated threshold and alert delivery tests |
| P1 | FE-01 | 8 | 8 | 6 | 384 | Frontend/Backend: idempotent retry matrix and duplicate-side-effect prevention |
| P1 | SEC-01 | 9 | 8 | 4 | 288 | AI/FinOps: cross-instance atomic reservation/settlement, adversarial concurrency |
| P1 | CL-03 #58 | 8 | 9 | 4 | 288 | SRE: sustained journey load + measured billing and P95 |
| P1 | BE-02 / DB-03 | 6 | 8 | 5 | 240 | Database/SRE: explain/read count/latency benchmark before altering query |
| P2 | SEC-03 | 5 | 10 | 9 | 450 | Docs: canonical current-state links; no historical “current” assertions |
| P2 | FE-02 | 5 | 8 | 6 | 240 | Frontend: read-only cache policy + staleness/consent boundary tests |
| P2 | CL-02 | 5 | 8 | 5 | 200 | Observability: bounded cardinality, central OTel, invoice visibility |

### TCO sensitivity — not an actual savings forecast

| Lever | [ANNAHME] Baseline and controllable share | Scenario calculation | Risk gate |
|---|---|---|---|
| Gemini/provider duplication | 10% of calls redundant; eliminate 80% of that share | 10% × 80% = **8% of variable AI provider charges** | Only after idempotency, quality and outcome metrics |
| Firestore reads | 20% safely cacheable; reduce 25% of those reads | 20% × 25% = **5% of Firestore read charges** | No sensitive/cross-account cache, consistency and invalidation tests |
| CI runner minutes | 10% redundant candidate CI, prevent 50% of that subset | 10% × 50% = **5% CI minutes** | Never skip required exact-head/security tests |
| Total cloud TCO | No cost breakdown, request volume, autoscaling/concurrency or invoices | **Not computable**; do not add above percentages | Billing export + service-level unit costs + Finance-approved envelope |

Prioritize safety-gated provider call deduplication, storage lifecycle confirmation, and evidence-based query planning **before** downgrading redundancy or retention. No quality/SLO trade-offs without explicit approval.

## 4. Direkt einsetzbare Dokumentations-Updates

### Retention runbook addendum

```bash
# READ ONLY: Use the exact reviewed project context.
: "${KLAR_PROJECT_ID:?Explicit project required}"
gcloud firestore fields ttls list --project "${KLAR_PROJECT_ID}"
# Compare ACTIVE entries against the DPO-approved policy matrix.
# Do NOT run a bulk --enable-ttl command before legal-hold/retention review.
```

Required control: versioned policy matrix: `collectionGroup`, `timestampField`, `retentionDays`, `legalBasis`, `legalHoldRule`, `approvedBy`, `liveStatusEvidenceURI`. CI checks scripts ↔ matrix coverage. Live evidence is attached to issue #70 and Go-Live #8.

### Canonical SLO rule

```ts
// Schematic, not an already installed module:
import slo from '../../../ops/slo.json';
const apiP95LimitMs = slo.objectives.find(x => x.name === 'api-latency-p95-ms')?.target;
if (typeof apiP95LimitMs !== 'number') throw new Error('SLO_POLICY_INVALID');
const breach = observedP95Ms > apiP95LimitMs;
```

Require route-eligible request definitions, histogram validation and receiver test, not only an in-process gauge. Follow #71.

### Secure retry contract

```ts
// Schematic: server idempotency receipt is mandatory before retrying any mutation.
const mayRetry = ['GET', 'HEAD'].includes(method) ||
  (serverSupportsIdempotency && Boolean(idempotencyKey) && operationIsReplaySafe);
if (!mayRetry) return response; // do not automatically replay uncertain POST commits
```

Validate duplicate payment/consent/chat after response loss and test timeout budgets before rollout.

### Required production evidence (not yet supplied)

1. Immutable exact deployment digest/SHA, green CI/DAST/SCA and independent approver IDs.
2. IAM/Secrets/rotation and external recipient/data processing inventory, regional location and encrypted transport/storage proof.
3. Real TTL policies, retention/exceptions, KYC/photo cleanup and Art.-17 deletion receipts including partners.
4. Multi-user end-to-end KYC, Stripe, messaging, Gemini degradation, accessibility and failure injection; measured P95, read/write counts, provider/billing exports.
5. Pager burn-rate alerts, on-call delivery test, backup/restore RPO/RTO, canary and rollback drill.
6. Formal approver signatures and ticket link under issue #8.

**Release decision: NO-GO / NOT CONFIRMED** until proof is reviewed. This document proposes no auto-merge, secret change, destructive retention command or live deployment.

## Traceable source references

- [Retention policy](https://github.com/Veselin-Takev/Klar-Dating/blob/bee87aea09a8d10b2e2c3fb74e38e5ecb12be008/phase2_work/docs/DATA_RETENTION.md), [TTL provisioning](https://github.com/Veselin-Takev/Klar-Dating/blob/bee87aea09a8d10b2e2c3fb74e38e5ecb12be008/phase2_work/scripts/configure-retention.sh), [Backup/restore](https://github.com/Veselin-Takev/Klar-Dating/blob/bee87aea09a8d10b2e2c3fb74e38e5ecb12be008/phase2_work/docs/BACKUP_RESTORE.md)
- [Partner attribution](https://github.com/Veselin-Takev/Klar-Dating/blob/bee87aea09a8d10b2e2c3fb74e38e5ecb12be008/phase2_work/src/server/partnerReferralService.ts), [Partner routes](https://github.com/Veselin-Takev/Klar-Dating/blob/bee87aea09a8d10b2e2c3fb74e38e5ecb12be008/phase2_work/src/server/routes/partnerReferrals.ts)
- [SLO policy](https://github.com/Veselin-Takev/Klar-Dating/blob/bee87aea09a8d10b2e2c3fb74e38e5ecb12be008/phase2_work/ops/slo.json), [OTel](https://github.com/Veselin-Takev/Klar-Dating/blob/bee87aea09a8d10b2e2c3fb74e38e5ecb12be008/phase2_work/src/server/observability.ts), [Load evidence requirements](https://github.com/Veselin-Takev/Klar-Dating/blob/bee87aea09a8d10b2e2c3fb74e38e5ecb12be008/phase2_work/docs/LOAD_TESTING.md)
- [AI budget](https://github.com/Veselin-Takev/Klar-Dating/blob/bee87aea09a8d10b2e2c3fb74e38e5ecb12be008/phase2_work/src/telemetry/budgetGuard.ts), [Orchestrator](https://github.com/Veselin-Takev/Klar-Dating/blob/bee87aea09a8d10b2e2c3fb74e38e5ecb12be008/phase2_work/src/agents/orchestrator.ts), [FinOps policy](https://github.com/Veselin-Takev/Klar-Dating/blob/bee87aea09a8d10b2e2c3fb74e38e5ecb12be008/phase2_work/docs/finops/BUDGET_AND_TELEMETRY.md)
- [Client retry/cache](https://github.com/Veselin-Takev/Klar-Dating/blob/bee87aea09a8d10b2e2c3fb74e38e5ecb12be008/phase2_work/src/lib/api.ts), [Chat reads](https://github.com/Veselin-Takev/Klar-Dating/blob/bee87aea09a8d10b2e2c3fb74e38e5ecb12be008/phase2_work/src/server/routes/chat.ts), [React shell](https://github.com/Veselin-Takev/Klar-Dating/blob/bee87aea09a8d10b2e2c3fb74e38e5ecb12be008/phase2_work/src/App.tsx)
- [CI](https://github.com/Veselin-Takev/Klar-Dating/blob/bee87aea09a8d10b2e2c3fb74e38e5ecb12be008/.github/workflows/ci.yml), [Release](https://github.com/Veselin-Takev/Klar-Dating/blob/bee87aea09a8d10b2e2c3fb74e38e5ecb12be008/.github/workflows/release.yml), [Root README](https://github.com/Veselin-Takev/Klar-Dating/blob/bee87aea09a8d10b2e2c3fb74e38e5ecb12be008/README.md)
