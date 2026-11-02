# Klar documentation


**Aktueller Evidenz-/Review-Stand (02.11.2026, auf diesem Draft-Branch):** [Enterprise-E2E-Audit](ENTERPRISE_E2E_AUDIT_2026-11-02.md), [offenes PR-Inventar mit SHA und Abhängigkeiten](OPEN_PR_INVENTORY_2026-11-02.json), [PR-Konsolidierungsplan](OPEN_PR_TRIAGE_2026-11-02.md), [P0 #202 Merge-Readiness](P0_202_MERGE_READINESS_2026-11-02.md), [Vercel-CI-Setup-Gates und Fehleranalyse](VERCEL_CI_SETUP_GATE_2026-11-02.md), [Vercel-Demo-Projekt: Sicherheitsbewertung und Mitigation](VERCEL_LEGACY_PROTOTYPE_RISK_2026-11-02.md). Das [Register vom 25.10.2026](OPEN_ISSUE_EVIDENCE_REGISTER_2026-10-25.md) ist historisch. Alle neuen Befunde sind Review-Kandidaten auf einem Draft-Branch, **nicht** in `main` bestätigt; Produktionsfreigabe weiterhin **BLOCKED / NO-GO**.

Start with the current status, then use the audit and runbooks to distinguish implemented behavior from remaining release evidence.

1. [Project status](PROJECT_STATUS.md)
2. [Historical audit 28 September 2026](AUDIT_2026-09-28.md) and [Word report](Klar_App_Audit_2026-09-28.docx); previous [audit 27 September 2026](AUDIT_2026-09-27.md) and [Word report](Klar_App_Audit_2026-09-27.docx)
3. [Developer guide](DEVELOPMENT.md)
4. [Firebase operations and upstream issues](FIREBASE_OPERATIONS.md)
5. [Component inventory](evidence/component-inventory.csv) and [JSON inventory](evidence/component-inventory.json)
6. [Improvement program](IMPROVEMENT_PROGRAM.md), [workflow permissions](WORKFLOW_PERMISSIONS.md), [production runbook](PRODUCTION_RUNBOOK.md), [accessibility](ACCESSIBILITY.md)

The September 20 and 21 audit reports remain historical snapshots. Their test counts and release claims do not describe the current branch or replace revision-specific evidence.

## Source-of-truth rules

- Runtime behavior is authoritative in code and tests.
- Operational procedures are authoritative in the relevant runbook.
- Machine-readable SLO values are authoritative in `ops/slo.json`.
- Audits are dated assessments, not permanently current conformance statements.
- [Project status](PROJECT_STATUS.md) must be updated when a release gate changes state.
- Never replace evidence with unsupported claims such as “enterprise-ready” or “WCAG compliant.”

## Documentation ownership

Every material pull request must update documentation when it changes critical journeys, authentication, authorization, data processing, retention, integrations, runtime configuration, SLOs, alerts, deployment, rollback, backup, recovery, accessibility behavior, release gates, known limitations, or risk acceptance.

The reviewer verifies documentation together with code and test evidence.


## Enterprise AI Phase 2

- [Solution Design — C4, RAG, data flows and security boundaries](architecture/SOLUTION_DESIGN.md)
- [AI Governance RACI — risk and Human-in-the-Loop](governance/AI_GOVERNANCE_RACI.md)
- [AI Budget & Telemetry — FinOps controls](finops/BUDGET_AND_TELEMETRY.md)

## Enterprise AI Phase 3

- [Change- und Adoption-Paket](phase3/README.md): ADKAR, Workflow-Auswirkungen, vierwöchiges Befähigungsprogramm, Kommunikationsvorlagen und Scorecard.
- [Nachweisregister](phase3/EVIDENCE_REGISTER.json): Unterlagen vorbereitet; Durchführung, organisatorische Abnahme und nachhaltige Adoption noch nicht nachgewiesen.
