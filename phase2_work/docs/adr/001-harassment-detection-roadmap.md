# ADR-001: Harassment Detection and Preventive User Warnings (v150)

- **Status:** Accepted for roadmap, **not approved for implementation or deployment**
- **Decision date:** 2026-10-13
- **Scope:** Klar v150 only, after v149 production Go-Live and stabilization
- **Owners:** Product / Trust & Safety / Security / Privacy / Legal / SRE
- **Related:** `ROADMAP_V150_TODO.md`, `GO_LIVE_CHECKLIST.md`, Issue #8

## Context and objective

Klar plans automated detection of possible harassment, threats and toxic messaging in user conversations, with proportionate preventive warnings and access to human reporting. A future Gemini-based classifier may help identify contextual risks, but LLM output is fallible and is **never independently sufficient evidence for punitive action**. The feature processes sensitive private communications; abuse prevention, GDPR, German/EU law, security, fairness and user control are core design constraints.

## Decision

**Defer implementation entirely to v150.** During v149 stabilization do not add message scanning, automated moderation decisions, new data processing, Firebase triggers, permission expansions, instrumentation, UI warnings or background jobs for this purpose. v150 may begin implementation **only after** verified v149 Go-Live, observed stabilization and formal product/security/privacy/legal authorization. Prevent scope creep and avoid mistaking roadmap documentation for deployed functionality.

## Planned architecture (subject to DPIA and threat model)

1. **Entry boundary:** A server-trusted, idempotent outbox event, written with the accepted message, triggers an asynchronous Cloud Function / managed worker. Never scan uncommitted drafts or allow clients to write verdicts. Replays use event ID and policy/model version to deduplicate. Assess ordering, retries, dead letters, poison events and backpressure, without extending chat-send latency.
2. **Consent / legal basis:** Perform a documented GDPR purpose and legal-basis analysis; consent must not be assumed merely because users accepted terms. Integrate the current HMAC-SHA256 Consent-Ledger for any **consent-dependent processing**, validating purpose, version and withdrawal at execution time. A separate, documented lawful basis may govern narrowly necessary safety processing, subject to legal/DPO assessment. Fail closed on unauthorized secondary analysis, not silently reclassifying safety as optional analytics.
3. **Privacy boundary:** Redact or minimize personal identifiers **before** any Gemini request; encrypt transport and storage, keep raw text out of traces/logs, define EU data residency and international-transfer rules with counsel. Explicit model-provider retention/training settings, data-processing agreement and vendor assessment are required. Do not record original messages or verbatim classifier prompts in the HMAC ledger; store only minimal pseudonymous event and decision metadata with bounded retention.
4. **Detection pipeline:** Deterministic abuse signals and rate limits before optional context-aware Gemini classification. Validate strict output schema (`riskLevel`, `policyCodes`, `confidence`, `modelVersion`), impose timeouts/budgets, defend against prompt injection inside message text, and separate content from instructions. Model uncertainty results in no automated penalty.
5. **Enforcement / UX:** Tier 0: no warning; Tier 1: private, educational pre-send nudge; Tier 2: contextual post-send caution and friction for repeat behavior; Tier 3: reporting and trained human moderation. No account suspension or adverse decision solely from Gemini output. Ensure appeal, error correction, human review, proportionality and avoidance of abusive counter-notifications. Do not expose reporter identities.
6. **Data access:** RBAC service identities and least-privilege Firestore Rules/Cloud IAM; server-only immutable audit append, separate safety event storage with TTL, access logging, encryption key policy, and deletion/retention exceptions reviewed under GDPR Articles 5, 6, 9, 17, 22 and 35 as applicable.
7. **Observability:** Aggregate false-positive/false-negative rates, latency P95, queue age, spend, review backlog, appeal outcomes and drift without message content; opt-in debug logs stay behind consent. Define kill switch for automated detection and safe queue draining/rollback.
8. **Human and legal governance:** Before launch, classify actual use against the **EU AI Act** by assessed use case and role; document transparency, fundamental-rights, oversight, testing and incident obligations where applicable. Do not declare blanket AI-Act compliance by design. DSA notice-and-action and national platform obligations need separate legal review.

## Alternatives considered

- **Deploy during v149:** rejected (release risk, unproven legal and privacy boundaries).
- **Client-only keyword filtering:** insufficient context and easy circumvention; may be evaluated as a privacy-preserving supplemental nudge in v150.
- **Fully automated enforcement:** rejected due to false positives, fairness and review requirements.
- **Human reports only:** remains the v149 safety baseline; continue to maintain and improve its reliability without silently introducing AI scanning.

## Acceptance gates before rollout

Approved DPIA/legal-basis decision; data mapping and retention; documented threat model; model evaluation with demographic/fairness, dialect and adversarial test sets; security review of IAM, audit and prompt injection; consent and withdrawal race tests; end-to-end emulator and browser tests; accessibility (WCAG AA); provider residency/contract checks; tested review-and-appeal operations; SLO/FinOps budgets; gradual feature-flag canary and proven rollback; explicit authorized go/no-go. **No v149 production-release blocker is cleared by this ADR.**

## Consequences

The v149 feature scope remains frozen. v150 implementation proceeds only in separately reviewed work items from `ROADMAP_V150_TODO.md`. Default feature flag OFF in all environments until v150 approval. The initial ADR may be superseded after formal privacy/legal review; retain the decision history.
