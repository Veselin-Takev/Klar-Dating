# PR #119 / P1 #71 — Canonical 300ms source versus 30-day fleet SLO evidence

**Date:** 2026-10-23. **Status: NO-GO / HARD STOP.** Read-only, cost-free, audit branch only. **Issue #71 remains OPEN.**

## Immutable original source: verified five Git objects

Target PR #119: `7fdf29010c85f16a9b38e5c93186f32e92192f3a`; tree `05f22f0ca387ae37573b1f81e85ead901dce3da9` (complete, nontruncated). All five source blob IDs were checked against the original Git tree.

| Path (under `phase2_work/`) | Git blob | Verified code-level fact |
|---|---|---|
| `ops/slo.json` | `977dc2e8ef4a6702cab787c389dbe65038d8d51c` | API P95 target **300ms**; declared window **30 days**; indicator string `p95(klar_http_latency_ms)` |
| `src/server/observability.ts` | `fe7c2940fa968c7a6b981899f8d6c29b711d85a1` | Imports SLO threshold from policy and emits `klar_http_p95_slo_breach` for `p95 > API_P95_SLO_MS` |
| `scripts/test-slo-policy.mjs` | `6a5dbe80463524479a6e44e6a2112fc3e8feeee9` | Boundary cases 299/300/301/1500ms; requires canonical expression |
| `scripts/check-observability.mjs` | `36e13b8125ef631bbe3a0de8b6bfa373186323b1` | Statically checks canonical policy wiring |
| `docs/architecture/ENTERPRISE_TARGET.md` | `efc0c5b8c31784d6cbb499098768961ea0e5d379` | States P95 target `<300 ms` |

**Result:** 8/8 *source-level threshold wiring checks* PASS in independent read-only inspection. The historical 1500ms hardcoded threshold noted in [Issue #71](https://github.com/Veselin-Takev/Klar-Dating/issues/71) is **not present in this PR119 exporter**. This does **not** close the issue.

## Open observability / reliability gaps — separate from source threshold

1. The exporter computes a **15-minute process-local P95**, with capped per-minute sample arrays; it cannot prove a 30-day fleet-wide SLO, valid error budget or multi-instance aggregated percentile.
2. The source implements `percentile([]) => 0`; combined with `0 > 300` this yields breach gauge `0` even with **zero samples**. Such an observation must be classified as **UNKNOWN / NO DATA**, not as healthy service. This is inferred directly from code; live production traffic was **not checked**.
3. The local export is `klar_http_request_duration_ms{quantile="0.95"}` of Prometheus type **gauge**, not a fleet-aggregatable histogram with `_bucket`/`_sum`/`_count`. Per-process P95 gauges may not be averaged into a fleet percentile.
4. `ops/slo.json` names `p95(klar_http_latency_ms)`, whereas the checked exporter does not emit `klar_http_latency_ms`. No authoritative production PromQL rule / label scope has been verified.
5. The architecture text `<300 ms` and the implemented test threshold `p95 > 300` differ at **exactly 300ms**. SRE/Product must explicitly choose a consistent equality definition; do not silently adjust the product threshold.
6. There is **no authenticated evidence** of deployed scrape data, 30-day SLI coverage, alert policy, burn-rate semantics, page delivery/acknowledgement, or staging incident simulation.

## Acceptance evidence required before closing P1 #71

SRE and Product must approve the scope of measured HTTP requests, inclusion/exclusion rules (health, bots, errors), percentile window, timing source, missing-data semantics, threshold-equality semantics and target service identity. SRE/Security must sign off metric cardinality, PII-safe labels, vetted fleet histogram buckets/counters, tested PromQL, and valid error-budget/burn-rate expressions. Then an **independently authorized and budget-cleared** staging run must capture immutable raw metrics/dashboard/query evidence, 299/300/301ms and no-traffic cases, a controlled over-threshold breach and actual on-call alert acknowledgement; only an authenticated reviewer may sign release evidence. Do not invent production performance or a pager test.

A potential illustrative future expression is `histogram_quantile(0.95, sum by (le) (rate(klar_http_request_duration_ms_bucket{service="klar-api"}[5m])))`. **This metric is not currently emitted by the inspected exporter; this expression is neither validated nor a 30-day SLO.** It is an unapproved design option.

## Audit-only proof and no-GO boundaries

A local read-only checker `screen-pr119-slo-evidence.mjs` plus its 19 focused regression/negative tests were developed and run under **Node.js 22.16.0**, with **19/19 PASS**; the tool and its 19 targeted tests are now integrated **only on the separate audit branch**, not approved as Enterprise release gates. It pins expected Git blob hashes and requires an explicit source directory, but **never certifies an entire host or checkout**. Its successful inspection is deliberately `exit 1 / NO-GO`. Original Git source was separately inspected through GitHub connector. No Firestore, Stripe, Cloud, CI, monitoring network request, paid runner, PR branch, main branch or production deployment was changed.

**Qualified enterprise host gates independently evidenced: 0/15. Independent final release approvals: 0/4. Gate 07 policy conflict remains unresolved. NO-GO.**


## 2026-10-23 — Read-only P95 audit screen integrated (NO-GO)

The exact locally tested `scripts/screen-pr119-slo-evidence.mjs` and `scripts/screen-pr119-slo-evidence.test.mjs` now exist **only on the isolated audit branch**. Local Node v22.16.0 tests 19/19 PASS; the supplied original PR119 five-file subset independently matched 5/5 immutable Git blobs and the CLI returned exit **1 / NO-GO** with all eight threshold patterns passing. Checker input hash checks do not attest an entire checkout, the required Node 22.23.3 host, live 30-day fleet metrics, PromQL or pager delivery. See `PR119_RELEASE_DECISION_DEPENDENCIES_2026-10-23.md` for documented PR review/merge and qualified release dependencies. The 300ms source threshold is fixed; #71 stays OPEN, 0/15 host PASS and 0/4 approvals remain. No paid CI, application, staging, cloud, merge or deployment change.
