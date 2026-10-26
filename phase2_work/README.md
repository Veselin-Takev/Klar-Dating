# Klar

Klar is a conversation-first dating application. The repository contains the React client, Express API, Firebase security rules, operational tooling, tests, and production release workflows.

## Current status

Current issue evidence is tracked in the [25 October register](docs/OPEN_ISSUE_EVIDENCE_REGISTER_2026-10-25.md), with [project status](docs/PROJECT_STATUS.md) and the [production runbook](docs/PRODUCTION_RUNBOOK.md). Run the application and CI commands below from this directory (`phase2_work/`).

PR [#122](https://github.com/Veselin-Takev/Klar-Dating/pull/122) corrected selected unsupported copy; PR [#123](https://github.com/Veselin-Takev/Klar-Dating/pull/123) removed attribution tokens from own partner visits. These are engineering changes, not production approval. Open issue acceptance still requires the specified product, privacy, security, finance and operational evidence.

September reports remain dated historical assessments: [28 September audit](docs/AUDIT_2026-09-28.md), [Word report](docs/Klar_App_Audit_2026-09-28.docx) and [Firebase operations](docs/FIREBASE_OPERATIONS.md). Their test counts and prior repository PR references do not establish the current branch or release status.

## Important release limitations

The green checks do not constitute Enterprise readiness, WCAG certification, or production approval. Remaining work includes review of moderate dependency findings, two-account/product journey coverage, production platform controls, restore/rollback drills, document-hash/key-rotation/archive controls, and wiring the deterministic music icebreaker helper into a production caller. Do not treat browser storage as an authorization source, bypass consent gates for diagnostics, deploy placeholder image digests, or fail open when gate-status checks fail.

## Start here

- [Documentation index](docs/README.md)
- [Project status and release gates](docs/PROJECT_STATUS.md)
- [Developer guide](docs/DEVELOPMENT.md)
- [End-to-end audit](docs/END_TO_END_AUDIT_2026-09-20.md)
- [Production runbook](docs/PRODUCTION_RUNBOOK.md)
- [Accessibility standard](docs/ACCESSIBILITY.md)

## Architecture at a glance

- **Client:** React 19, TypeScript, Vite, Tailwind CSS
- **API:** Express with Firebase Admin and authenticated operational routes
- **Data and identity:** Firebase Auth, Firestore, and Storage
- **Runtime:** Node.js 22 container on Cloud Run
- **Delivery:** GitHub Actions, immutable GHCR image digests, SBOM, provenance, canary promotion, and rollback
- **Observability:** health and readiness endpoints, protected Prometheus metrics, request IDs, structured logs, and W3C trace context

## Requirements

- Node.js **22.23.3** or a compatible Node 22 release satisfying `package.json#engines`
- Bun 1.4.2 for the app dependency graph; npm 10.9.2 for Functions
- Java 21 for Firebase emulators
- Docker for production-image verification
- Firebase project with Auth, Firestore, and Storage
- Application Default Credentials or Workload Identity for the server

## Local development

Install the locked dependency graph:

```bash
bun ci
```

Create the local environment file from the checked-in example. Never commit the result:

```bash
cp .env.example .env.local
npm run dev:lokal
```

For an isolated Auth and Firestore emulator environment, use the same `npm run dev:lokal` path. Emulator traffic must use an isolated `demo-*` project and the default database; it must never point at production.

See [Developer guide](docs/DEVELOPMENT.md) for emulator usage, validation commands, architecture boundaries, and contribution rules.

## Quality gates

```bash
npm run check:enterprise
npm run typecheck
npm run test:pure
npm run test:launch
npm test
npm run test:rules
npx playwright test
npm run build
```

CI also verifies secret hygiene, high/critical dependency findings in the full and production graphs, emulator-backed tests, and the production container. CI and local emulator work use Java 21 with Firebase CLI 15.30.2.

## Security and secrets

Never commit credentials or personal production data. Runtime secrets belong in a cloud secret manager and should be accessed through Workload Identity where supported. `CONSENT_AUDIT_SECRET` must be at least 32 characters; a dedicated key is preferred.

## Production delivery

Production releases use protected semantic-version tags. Build once, publish an immutable image digest, deploy a no-traffic candidate, verify liveness/readiness, run the approved canary, and preserve SBOM, provenance, checksums, approvals, and rollback evidence. Never deploy a mutable tag, placeholder digest, or unverified workstation build. See [Production runbook](docs/PRODUCTION_RUNBOOK.md).

## Known release blockers

Before broad production traffic, close or formally accept every blocking item:

- independent review and manual accessibility evaluation;
- complete critical user-journey browser coverage;
- production branch protection, approvals, IAM, alerting, TTL, and backups;
- load, cold-start, scaling, and cost baselines;
- document-hash, retention, key-rotation, and protected-archive controls for signed consent evidence;
- restore, rollback, and incident drills;
- remaining moderate dependency findings and the music-coach integration gap.

The detailed rationale, ownership model, and acceptance criteria are in [Project status](docs/PROJECT_STATUS.md) and the [audit report](docs/END_TO_END_AUDIT_2026-09-20.md).

## Documentation policy

Documentation changes are part of feature completion. Update the relevant document in the same pull request when behavior, operations, security controls, data handling, accessibility, SLOs, or release requirements change.

## Release- und Versionierungsprozess

Das Repository nutzt automatisierte Releases basierend auf **Conventional Commits**.
Detaillierte Richtlinien und Releasemechanismen finden sich in [VERSIONING.md](./VERSIONING.md).

* **Features einpflegen:** `git commit -m "feat(scope): beschreibung"`
* **Bugfixes einpflegen:** `git commit -m "fix(scope): beschreibung"`


## Enterprise AI Phase 2

The repository now contains the Phase-2 AI control plane for Technical Foundations, Guardrails, Agentic Orchestration and Governance.

- [Phase-2 Solution Design](docs/architecture/SOLUTION_DESIGN.md) — C4 architecture, data flows, RAG boundary and security controls
- [AI Governance RACI](docs/governance/AI_GOVERNANCE_RACI.md) — risk classes, autonomy levels and Human-in-the-Loop thresholds
- [AI Budget & Telemetry](docs/finops/BUDGET_AND_TELEMETRY.md) — token economics, caps, alerting and telemetry
- `src/security/piiSanitizer.ts` — provider-bound PII sanitization
- `src/middleware/guardrailMiddleware.ts` — input/output guardrails
- `src/security/rbacControl.ts` — agent action authorization
- `src/agents/orchestrator.ts` — central fail-closed agent orchestration
- `prompts/registry/` — versioned deterministic prompt artifacts
- `config/ai-budget.json` — budget and rate-limit policy

The Phase-2 controls are additive to the existing server-side provider boundary. They do not create direct client-side LLM access and do not constitute production deployment approval.
