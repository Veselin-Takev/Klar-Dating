# Klar Enterprise Target Architecture

## Core platforms

1. **Identity** — Firebase Auth, verified identity state, least-privilege claims, step-up verification.
2. **Trust & Safety** — reports, blocks, abuse throttling, scam-risk signals, human review and auditable decisions.
3. **AI Platform** — a single policy gateway for consent, PII minimisation, quotas, model routing and output validation.
4. **Compatibility** — deterministic compatibility dimensions now; evolve to a privacy-safe ranking service using outcome feedback.
5. **Date Loop** — discover → connect → talk → plan → date → reflect → learn.
6. **Experimentation** — assignment/exposure/outcome events with feature flags and guardrails.

## Production SLO baseline

- API availability: 99.95%
- Messaging availability: 99.99%
- P95 API latency: <300 ms
- P95 message send: <500 ms
- AI availability: 99.5%

These are targets, not claims about current production performance.

## Data boundaries

Keep profile, messaging, private journal, AI processing, trust/safety and billing data in separate domain boundaries with least-privilege access. Do not retain biometric source material when a provider verification result is sufficient.

## Deployment

Build immutable artifacts in CI, generate an SBOM, scan dependencies/container, sign the artifact, deploy to staging, run smoke/E2E tests, then promote with approval. Canary releases and rollback should be standard.
