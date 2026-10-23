# P1 #71 — API P95, 30-day SLI, histogram and on-call audit

**Review date:** 2026-10-23 | **Release: BLOCKED / NO-GO**  
**Source:** Draft [PR #119](https://github.com/Veselin-Takev/Klar-Dating/pull/119), exact HEAD 7fdf29010c85f16a9b38e5c93186f32e92192f3a, open and unmerged.  
**Issue:** [#71 — API P95 policy consistency](https://github.com/Veselin-Takev/Klar-Dating/issues/71), remains OPEN.  
**Change scope:** Documentation only on branch docs/ci-governance-audit-2026-10-23; no app, CI workflow, Cloud alert, release artifact, PR #119 or main change.

**Evidence boundary:** Direct read-only GitHub source inspection and published Prometheus / Google SRE guidance. **No tests, commands, deployment, GitHub Actions, metric scraping, load generation, live monitoring or pager delivery were executed.** Historic local PASS reports or the mere presence of source tests do not attest current SHA or production latency.

## 1. Exact source facts and remaining SLI blockers

| Control | Source observation | Qualification |
| --- | --- | --- |
| Canonical policy | [ops/slo.json](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/ops/slo.json) defines API P95 target **300 ms**, window **30 days**, textual indicator p95(klar_http_latency_ms), and 1h/6h/3d burn rates of **14.4 / 6 / 1**. | Policy configuration is not an operational SLI or active alert. |
| Target in source | [observability.ts](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/observability.ts) imports slo.json and emits breach when p95 **>300 ms**. | Prior **1500-ms source hardcode is fixed in this Draft HEAD**, but not proven deployed. |
| Boundary semantics | [ENTERPRISE_TARGET.md](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/docs/architecture/ENTERPRISE_TARGET.md) says P95 **less than 300 ms**; actual breach comparator accepts equality at 300 ms. | Product/SRE must approve strict versus inclusive threshold; do not change a commitment unilaterally. |
| Local percentile | Observability exporter retains at most **15 minutes** of local HTTP span durations, prunes to **2,000 latency samples per minute bucket**, computes nearest-rank P95 and emits process-local quantile gauge **klar_http_request_duration_ms**. | No complete 30-day, fleet-level, per-route population; high-volume trimming may bias the result; independent process p95 gauges cannot be averaged to obtain fleet p95. |
| Second local percentile | [health.ts](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/routes/health.ts) independently exposes gauge **klar_http_latency_ms** at P50/P95/P99 from healthStats.apiLatencies. /api/metrics uses a METRICS_TOKEN guard. | Dual metric families, different sample sources, no histogram for correct replica aggregation. The policy expression p95(klar_http_latency_ms) describes a percentile of an *already quantile-labeled gauge* and is not itself a complete executable histogram-based PromQL SLI. |
| No-traffic state | The percentile function returns **0** for an empty input; breach gauge then emits **0**. | No data cannot mean latency is healthy. Missing scrape/traffic/coverage needs distinct UNKNOWN/no-data policy. |
| Tests present, not executed here | [test-slo-policy.mjs](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/scripts/test-slo-policy.mjs) evaluates the **299, 300, 301 and 1500 ms** comparison in a sandbox VM; [check-observability.mjs](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/scripts/check-observability.mjs) checks static source patterns; [loadSlo.spec.ts](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/tests/loadSlo.spec.ts) tests a pure load evaluator. | No cross-instance histogram, 30-day SLI, missing-samples, deployed metrics, real traffic mix or pager delivery integration PASS demonstrated. |
| Operational issue #8 | [Go-Live Issue #8](https://github.com/Veselin-Takev/Klar-Dating/issues/8) still names a **P95 >1500 ms alarm**; inspected SLO policy says **300 ms**. | Confirm actual alert policy and one canonical approved severity/window specification. Text conflict is **not proof** that any deployed alert is misconfigured. |
| Alert rules | slo.json lists burn rate numbers but no measured good/eligible event timeseries or deployed recording/paging rule. | Threshold numbers alone are not proof of a valid error budget or actual on-call notification. |

**Finding SLO-01:** Historical 1500-ms hardcode is corrected **in the current source**. Do not describe the current HEAD as still using that numeric literal for the breach.

**Finding SLO-02:** Process-local, time-bounded **quantile gauges** cannot establish a globally aggregated 30-day fleet SLI.

**Finding SLO-03:** The existence of two independently calculated quantile gauges and the policy pseudo-indicator need an explicit, versioned service-wide metrics contract.

**Finding SLO-04:** Zero samples lead to numeric p95=0 and breach=0. A complete SLO must show insufficient-coverage/no-data state separately from PASS.

**Finding SLO-05:** The architectural strict less-than threshold versus inclusive code equality, plus obsolete Issue #8 1500-ms wording, need a signed Product/SRE decision.

**Finding SLO-06:** No independently captured Cloud Monitoring configuration, actual collector ingestion, long-window retention, burn-rate rule or pager-delivery/on-call ACK is available in this audit.

## 2. Proposed future histogram / SLI contract (not deployed)

**[PROPOSAL — Product and SRE decision required]** For an **inclusive 300-ms target**, measure the proportion of *eligible completed API requests* whose end-to-end approved server duration is **at most 0.300 seconds**, over a rolling **30-day** approved window. A P95 at-or-below 300 ms corresponds to **at least 95%** of eligible requests at-or-below 300 ms under this definition. If the product contract is **strictly under 300 ms**, choose the correct boundary implementation explicitly before production; do not silently treat equality as approved.

- Emit one real classic Prometheus request-duration **histogram in seconds**, with cumulative boundary at **0.3**, monotonically increasing bucket, count and sum counters. **PROPOSED** metric family: klar_api_request_duration_seconds (not yet implemented). Define stable low-cardinality labels for service / route class / response class / eligibility; **no UID, email, tokens, raw URL, path IDs or other identifying labels**.
- Approve denominator, route inclusion and exclusions for auth, health, readiness, metrics, streaming, 429, 5xx, cold starts, upstream timeouts and client aborts. Review low-traffic behavior; do not change exclusions to conceal slow operations.
- Metrics must observe approved **unsampled eligible requests** rather than only sampled traces and truncated process arrays. Persist sufficient long-term metrics, aggregate across instances, handle restarts, scrape gaps and metric freshness.
- Preserve current in-process gauges only as **diagnostics**, not release-decision evidence. Migration must be backward-compatible and versioned.

**EXAMPLE PROMQL — documentation proposal only. It will not work against current metrics:**

    # Bad eligible request ratio over the last 5 minutes, inclusive 300-ms target
    1 - (
      sum(rate(klar_api_request_duration_seconds_bucket{slo_eligible="true",le="0.3"}[5m]))
      /
      sum(rate(klar_api_request_duration_seconds_count{slo_eligible="true"}[5m]))
    )

    # Approximate fleet P95 diagnostic, classic histogram with deployed buckets
    histogram_quantile(
      0.95,
      sum by (le) (rate(klar_api_request_duration_seconds_bucket{slo_eligible="true"}[5m]))
    )

The ratio is UNKNOWN when the denominator is zero/absent, not green. Avoid claiming that the 5-minute histogram query itself establishes a 30-day GO. For a 95%-good SLO, the **30-day latency bad-event budget** is 5% of eligible requests (subject to approved scope). Candidate burn rate = observed bad-event fraction divided by 0.05, with approved short/long alert windows. The 14.4, 6 and 1 values in the policy are **not complete alert rules**. Google SRE guidance describes pairing **1h+5m**, **6h+30m** and **3d+6h** for multiwindow alerts; choose appropriate SRE escalation, deduplication and minimum traffic checks.

References: [Prometheus metric types](https://prometheus.io/docs/concepts/metric_types/), [Prometheus histogram_quantile](https://prometheus.io/docs/prometheus/latest/querying/functions/#histogram_quantile), [Prometheus histograms](https://prometheus.io/docs/practices/histograms/), [Google SRE multiwindow burn rates](https://sre.google/workbook/alerting-on-slos/).

## 3. Future exact-SHA acceptance tests — NOT RUN

| Acceptance case | Required evidence | Proposed reviewer |
| --- | --- | --- |
| 299 / 300 / 301 ms boundary | P95 threshold and bucket edge agree with signed strict-or-inclusive specification | Product + QA + SRE |
| Missing metrics / no traffic | UNKNOWN / separate scrape-missing alert; neither computed p95=0 nor skipped response is falsely PASS | SRE + QA |
| Histogram and counters | Cumulative buckets, explicit 300-ms edge, request-count consistency and bounded cardinality | Engineering + Security |
| Two replicas with different traffic volumes | Correct aggregated histogram; average of per-pod P95s must be rejected | SRE + QA |
| High load and sampling | Valid complete eligible population independent of trace sampling and 2,000/min local cap | Performance QA |
| Scope / exclusions and cold starts | Documented reproducible behavior for failures, 429, readiness, proxy overhead and stream duration | Product + QA |
| 30-day retention and budget | Verified query, recording rules, denominator, full-window policy and source labeling | SRE |
| Multiwindow latency burn rates | Deterministic good/bad events, 1h+5m / 6h+30m / 3d+6h alerts, route mix and severity | SRE |
| Real alert delivery | Cloud policy ID, effective expression, notification channel, actual delivered page and on-call ACK | SRE / Release Owner |
| /api/metrics and OTLP privacy | Authenticated scrape, secret rotation, collector delivery, low-cardinality no-PII telemetry | Security + DPO |
| Release impact / rollback | Exact SHA, signed performance and cost evidence, controlled canary and rollback demonstration | SRE + Release Owner |

**Dependency:** Issue #8 still requires production controls, operational monitoring, protected environment, legitimate Security/DPO/Legal/SRE independent signatures and final Release Owner approval. A completed P1 #71 code patch or staging graph never authorizes production on its own.

## 4. Audit trail and release status

Source: GitHub direct file reads at 7fdf29010c85f16a9b38e5c93186f32e92192f3a and Issue #71/#8. Existing [P0 Release Evidence Register](P0_RELEASE_EVIDENCE_TRACEABILITY_2026-10-23.md) and [Issue #8 GO/NO-GO Ledger](ISSUE_8_PRODUCTION_GO_LIVE_GATE_RECONCILIATION_2026-10-23.md) remain governing. No authorized live operational output or evidence signatures were supplied. **Issue #71 OPEN, release NO-GO.**

This report is a documentation-only audit; no test commands, Cloud Monitoring API mutations, SLO deployment, source fixes, CI workflows, merges or Production GO were initiated.
