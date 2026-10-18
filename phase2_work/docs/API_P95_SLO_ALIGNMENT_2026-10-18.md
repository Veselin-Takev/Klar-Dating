# API P95 threshold reconciliation — Issue #71 (2026-10-18)

**State:** Draft fix / production **NO-GO**.

## Source of truth

`phase2_work/ops/slo.json` defines the API latency P95 objective (300 milliseconds). Previously, the in-process OpenTelemetry exporter used 1500 milliseconds for `klar_http_p95_slo_breach`. The code now imports the canonical JSON policy and rejects missing or invalid targets at startup instead of silently using an unrelated value.

## Validation and deployment boundaries

Run `node scripts/test-slo-policy.mjs` from `phase2_work`. This tests policy alignment and 299/300/301 ms boundaries, not live percentile aggregation or production alerts. Mandatory typecheck, unit, Firebase emulator, E2E, build, and SRE pager/alert delivery checks remain outstanding until executed on the exact PR head. Do not infer real production latency or monitoring correctness from this static gate.

**Known limitation:** The exporter maintains a rolling in-process duration sample and emits a gauge, while the SLO document describes a 30-day service target. Multi-instance aggregation, histogram instrumentation, exclusion rules, percentile windows, burn-rate math, remote alert rules, and alert-delivery evidence remain open under #71/#8. Review the metric naming and deployed collector/pager configuration before production use.

No cloud changes, CI runs, deployments, or branch merges are authorized by this PR.
