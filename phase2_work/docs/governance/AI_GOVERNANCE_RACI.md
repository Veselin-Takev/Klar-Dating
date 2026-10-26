# AI Governance RACI — Phase 2

## Current operating model (2026-10-26)

Klar currently operates with one confirmed technical owner, @Veselin-Takev. The table below describes functions, not appointed employees or granted access. Low-risk functions may be combined where the policy permits; one person holding several roles is still one person. Each decision has one accountable function. Independent QA, Security, Finance and legal/privacy review remain separate where required; unassigned reviewers mean no approval, not an exemption. See [the solo pilot and evidence controls](../phase3/SOLO_PILOT_AND_EVIDENCE_CONTROLS_2026-10-26.md).

## Risk classes

| Risk | Typical examples | Required approval |
|---|---|---|
| Low | summarization, translation, internal drafting | Business owner + CoE policy check |
| Medium | internal data access, customer drafts, ticket writes | Business + Architecture + Security + CoE |
| High | financial actions, permission changes, regulated/person-impacting decisions, irreversible deletion | Business + Architecture + Security + Legal/DPO + AI Risk Council; executive approval where material |

## Human-in-the-loop thresholds

Human approval is mandatory when **any** of the following applies:

- risk class is High;
- action is irreversible or difficult to reverse;
- transaction exceeds the workflow's approved financial threshold;
- action changes identity/permissions;
- action affects a regulated or legally material decision;
- sensitive personal data is used outside an explicitly approved processing pattern;
- policy engine returns `DENY` or `REVIEW`;
- model confidence/evaluation is below the workflow threshold.

The default for unknown risk is **High**.

## Agent autonomy levels

| Level | Behavior | Default control |
|---|---|---|
| A0 | answer only | no action authority |
| A1 | draft / recommend | human decides |
| A2 | bounded reversible action | post-action monitoring |
| A3 | multi-step workflow | approval on material actions |
| A4 | high autonomy | mandatory human gates + kill switch |
| A5 | critical autonomy | not permitted for production critical decisions |

## Lifecycle RACI

| Lifecycle | CoE | Business | Engineering | Architecture | Security | Legal/DPO | Audit/Risk | Executive |
|---|---|---|---|---|---|---|---|---|
| Idea / intake | A | R | C | I | I | I | I | I |
| Business case | C | A/R | C | C | I | I | I | I |
| Risk classification | A | C | C | C | R | C | C | I |
| Architecture review | R | C | R | A | C | I | I | I |
| Data assessment | A | R | C | C | R | C | I | I |
| Prompt/workflow engineering | C | A | R | I | C | I | I | I |
| Security testing | C | C | R | C | A/R | I | C | I |
| AI evaluation | A | R | R | C | C | I | C | I |
| Compliance approval | C | R | C | C | C | A/R | C | I |
| Business acceptance | C | A/R | R | I | C | C | I | I |
| Production approval | R | C | C | C | C | C | C | A for material High Risk |
| Release | A | R | R | C | C | I | I | I |
| Monitoring | A | R | R | C | R | C | C | I |
| Incident response | C | R | R | C | A/R | C | C | I |
| Retirement | A | R | R | C | C | C | C | I |

**A = Accountable, R = Responsible, C = Consulted, I = Informed.**

## Decision rights

1. Business owns the outcome and use-case priority.
2. Architecture owns architectural fitness.
3. Security owns security control adequacy.
4. Legal/DPO owns legal/privacy approval within mandate.
5. CoE owns AI policy, reference patterns and reusable controls.
6. Executive governance owns material High-Risk acceptance.
7. No role can waive a mandatory control outside the documented exception process.

## Audit evidence

Every production agent must preserve, subject to data-minimization requirements:

- agent/workflow identifier;
- prompt registry identifier + version;
- model identifier;
- risk class;
- policy decision;
- human approval identifier where required;
- input/output schema validation result;
- token/cost telemetry;
- incident/override events.
