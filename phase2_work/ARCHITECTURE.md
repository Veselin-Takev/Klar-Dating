# Klar Architecture

The Klar platform consists of a React client, Express/Node API, Firebase Auth/Firestore/Storage, operational controls, and an enterprise AI control plane.

## System boundaries

```text
[Browser]
   |
   | HTTPS / authenticated API
   v
[Express API / Auth Boundary]
   |
   +--> [Firebase Auth / Firestore / Storage]
   |
   +--> [AI Orchestrator]
           |
           +--> [Risk + RBAC]
           +--> [Input Guardrails]
           +--> [PII Sanitizer]
           +--> [Prompt Registry]
           +--> [Budget / Rate Guard]
           +--> [Human Review]
           |
           v
       [Provider Boundary]
           |
           v
       [Approved LLM]
           |
           v
       [Output Guardrails + Schema Validation]
           |
           v
       [Business Workflow]
```

### Trust boundaries

1. **Client → API:** authentication, authorization, schema and rate limits.
2. **API → AI control plane:** authenticated tenant/workflow context.
3. **AI control plane → provider:** PII sanitization, prompt-security boundary, token/budget controls, structured output schema.
4. **AI output → business action:** output validation plus Human-in-the-Loop for high-risk actions.
5. **Telemetry:** operational metadata only; no raw prompts, secrets or unnecessary personal content.

## AI architecture

See [Phase-2 Solution Design](docs/architecture/SOLUTION_DESIGN.md) for the C4 model, data flows, RAG boundary and failure behavior.

## Governance

See [AI Governance RACI](docs/governance/AI_GOVERNANCE_RACI.md) for lifecycle ownership, risk classes and human approval thresholds.

## FinOps

See [Budget & Telemetry](docs/finops/BUDGET_AND_TELEMETRY.md) and `config/ai-budget.json` for cost controls.

## Existing provider gateway

The Phase-2 orchestration layer complements the existing server-side AI gateway in `src/server/aiBudget.ts` and prompt-security implementation in `src/server/platform/aiPromptSecurity.ts`. It does not authorize direct browser-to-provider access.

## Production status

This architecture document describes the approved Phase-2 implementation scope. It does **not** constitute production deployment evidence. Production release remains subject to the repository's release gates and environment-backed verification.
