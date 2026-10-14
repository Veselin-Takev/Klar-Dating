# Klar v150 — Trust & Safety Engine implementation roadmap

**Status:** PLANNED / NOT IMPLEMENTED. **Target:** v150 after successful v149 production release and stabilization. **ADR:** [001-harassment-detection-roadmap](docs/adr/001-harassment-detection-roadmap.md).

This is an actionable backlog for future implementation agents, **not** authorization to scan user messages. The v149 release must not contain additional message-classification triggers or enforcement. All assumptions about vendor residency, Firestore schema, data retention, moderation staffing and legal basis must be explicitly marked **[ANNAHME]** until confirmed.

## Required implementation order and blocking criteria

- [ ] **V150-00 — Release prerequisite** (Owner: Release Manager). Obtain documented v149 production approval, stabilization SLO evidence and operational signoff (Issue #8). Acceptance: dated approval tied to immutable deployed SHA. **STOP if missing.**
- [ ] **V150-01 — Product policies and legal assessment** (Product + Legal + DPO). Specify prohibited-conduct taxonomy, severity thresholds, age-sensitive safeguards, whether each processing purpose relies on a lawful basis or granular consent, DSA and applicable EU AI Act classification, Article 22 evaluation. Acceptance: signed policy matrix and DPIA decision, transparent notices, processing records and vendor legal assessment. **STOP without approval.**
- [ ] **V150-02 — Data and threat model** (Security + Privacy). Document message data flow, minimization before Gemini, service-account permissions, regional endpoints, provider retention/training controls, injection threats, adversarial evidence and abuse of reporting. Acceptance: approved diagrams, control matrix, retention schedule, deletion/appeal exceptions and no raw content in telemetry.
- [ ] **V150-03 — Contract and schema ADR** (Backend + Security). Propose versioned *server-owned* `message_safety_events` and `moderation_cases` data contracts, idempotency key `messageId + policyVersion + classifierVersion`, queue states and expiry, encryption and per-field RBAC. **[ANNAHME]** collection names are provisional. Acceptance: reviewed schema, Firestore Rules, indexes and data lifecycle; authorization negative tests; zero client ability to create/modify verdicts.
- [ ] **V150-04 — TDD infrastructure** (Backend + SRE). Build asynchronous trusted outbox-to-Cloud-Function workflow with at-least-once delivery, deduplication, bounded retries, DLQ, replay controls, cancellation and backpressure. Acceptance: emulator tests for duplicates, out-of-order delivery, poison events, backlog, blocked user, deleted message and unavailable vendor. No synchronous dependency for normal chat delivery.
- [ ] **V150-05 — Privacy/consent enforcement** (DPO + Backend). Gate optional analysis using authoritative HMAC-SHA256 ledger decisions, with valid purpose and version checked at execution time and withdrawal race resolution. Keep mandatory safety justification separate if legally approved; no covert purpose expansion. Acceptance: consent denied/revoked/unavailable and deletion tests all fail closed for optional analysis; immutable minimal audits contain no message bodies.
- [ ] **V150-06 — Detection service** (AI Engineering). Introduce server-side Gemini adapter behind feature flag (OFF). Context window minimization, PII sanitation, input/output schema validation, explicit system/user content boundaries, max token/time budget, circuit breaker and model/policy version pinning. Acceptance: test for prompt injection, malformed output, service 429/5xx, timeout, high latency, mixed-language and false allegations; graceful human-report fallback without fabricated decisions.
- [ ] **V150-07 — Calibrated model evaluation** (Trust & Safety + Independent reviewers). Curate legally usable representative multilingual datasets, label disagreement process, harm severity/precision/recall targets, subgroup/fairness checks, confidence calibration and drift plan. No acceptance thresholds invented in advance. Acceptance: dated evaluation protocol with statistically justified thresholds, signed fairness and privacy review, documented human override.
- [ ] **V150-08 — Proportionate UX** (Frontend + Accessibility). Implement private pre-send educational warning where feasible; post-send safety notice where necessary; accessible report/block/mute paths; staffed human-review queue and appeals. No unreviewed automatic bans. Acceptance: WCAG AA keyboard/screen-reader tests, clear recourse, no reporter disclosure, no confusing silent punishment.
- [ ] **V150-09 — Moderation operations** (T&S Ops + Security). Enforce least-privilege review roles, evidence minimization, case TTL, dual review for severe outcomes, audited access, escalation SLAs, incident response and correction/appeal procedures. Acceptance: tabletop drills, moderator training, demonstrated restore/deletion controls.
- [ ] **V150-10 — Observability and cost gates** (SRE + FinOps). Define P95 and queue-age SLOs, error/false-positive metrics, Gemini token spend ceilings, consent-safe alerting, no raw text in logs, tested kill switch and DLQ draining. Acceptance: dashboards, alert delivery and on-call acknowledgement with real operational evidence.
- [ ] **V150-11 — Security and quality verification** (QA + Security). Run `npm run typecheck`, `npm run test:pure`, `npm run test:rules`, `npx playwright test`, `npm run build`; add real emulator integration for message lifecycle, consent withdrawal, incident replay, authorization and account deletion; pen test and dependency audits. Acceptance: all gates PASS on immutable candidate SHA, no critical vulnerabilities, red-team signoff.
- [ ] **V150-12 — Canary and formal approval** (Release Manager + DPO + SRE). Independent product/security/privacy/legal signoff, feature flag OFF baseline, restricted canary, drift and false-positive monitoring, tested immediate disable/rollback and consumer transparency. Acceptance: signed go/no-go, exact image provenance and successful rollback exercise. No rollout before all previous items are complete.

## Dependency path

`V150-00 → V150-01 → V150-02 → V150-03 → V150-04 → V150-05 → V150-06 → V150-07 → V150-08 → V150-09 → V150-10 → V150-11 → V150-12`.

Parallel research may run after V150-01, but no production scanning or user impact before authorization. Every item must be independently reviewed and delivered through a focused PR with tests, ADR update and explicit acceptance evidence. Never fake consent evidence, moderation outcomes, CI passes or Cloud evidence.

## Non-goals for v149

No new Gemini moderation calls, chat scanning, enforcement collection, automated warning UI, new permissions, deployable Cloud Functions or default-enabled feature flag. Existing user reporting/blocking and mandated privacy/security fixes remain in scope.

## Definition of done for v150

- Approved policy/DPIA, EU AI Act and GDPR/DSA evaluation appropriate to actual use.
- Proven separation of user-facing educational warnings, human-review workflows and punitive action.
- Deterministic, privacy-safe, replay-resistant delivery; verified consent and retention semantics.
- Evidence-based accuracy/fairness evaluation, accessibility, security and latency/cost measurements.
- Successful exact-SHA automated gates, human ops exercises and signed staged rollout decision.
