# Klar documentation


**Aktueller Issue-/Nachweisstand:** [Register vom 25.10.2026](OPEN_ISSUE_EVIDENCE_REGISTER_2026-10-25.md). Implementierte Kontrollen, PR-Kandidaten und ausstehende Freigaben sind getrennt; Produktionsfreigabe bleibt unbestätigt.

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
