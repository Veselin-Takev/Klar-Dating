# ADR — P1 #71 Fleet-wide P95 SLO attestation after source threshold repair

**Status: PROPOSED, NOT AUTHORIZED** (2026-10-23). **Production NO-GO / HARD STOP.**

## Context

PR #119 imports API-P95 target **300ms** from `ops/slo.json`, and its regression script checks 299/300/301ms. The original 1500ms source conflict from issue #71 is addressed in this immutable PR candidate. It is *not* sufficient for actual production SLO compliance: code still exports a local **15-minute** P95 **gauge**, under a **30-day** declared SLO; absent observations return P95=0 and a nonbreach metric. The policy indicator is `p95(klar_http_latency_ms)`, which is not emitted by the inspected exporter. Equality for `<300` versus `>300` remains a distinct SRE definition question.

## Proposal and reject cases

- Keep the existing imported **300ms** source threshold as-is pending Product/SRE approval; **do not regress to 1500ms** or mask alarms.
- Distinguish **diagnostic local process percentile** from authoritative fleet-wide SLI. To qualify an SLO, select an aggregatable histogram-based duration metric or equally valid raw-series service-wide quantile method; document exact routes, exclusions, windows, sampling, missing traffic and error budget.
- Review/test Prometheus queries and burn-rate alerts on exact-sha, approved staging telemetry and obtain actual pager delivery evidence with SRE acknowledgement. A proposed histogram `_bucket` metric is a design target **not claimed present**.
- Missing traffic is **UNKNOWN**, not automatic SLO PASS. The exact 300ms equality case must be defined and reflected consistently across docs, tests and alerts.
- Reject claims based only on a green static checker, passing mock data, a local gauge, or a dashboard screenshot without traceable source, query, time window and on-call evidence.

## Authority and acceptance

SRE and Product define SLI/SLO; Security validates privacy-safe telemetry, bounded label cardinality, exporter/trust/alert access; Release Owner approves governed gate changes. Final Security, DPO/Legal, Operations/SRE and Release Owner signatures remain separate. New product code, telemetry schema, CI and cloud changes are **not approved** under audit-only authorization or the exhausted application correction cycle.

**Rollback:** Revert this isolated documentation-only commit. No production SLO/alert policy was changed. Companion [source-to-live-SLO report](PR119_P1_71_P95_SOURCE_TO_LIVE_SLO_GAP_2026-10-23.md) contains five immutable source hashes and remaining evidence gaps.

**P1 #71 OPEN, 0/15 qualified host PASS, 0/4 final approvals, NO-GO.**
