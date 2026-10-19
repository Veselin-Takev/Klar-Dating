# API P95 threshold reconciliation — Issue #71 (2026-10-18)

**State:** Draft fix / production **NO-GO**.

## Source of truth

`phase2_work/ops/slo.json` defines the API latency P95 objective (300 milliseconds). Previously, the in-process OpenTelemetry exporter used 1500 milliseconds for `klar_http_p95_slo_breach`. The code now imports the canonical JSON policy and rejects missing or invalid targets at startup instead of silently using an unrelated value.

## Validation and deployment boundaries

Run `node scripts/test-slo-policy.mjs` from `phase2_work`. This tests policy alignment and 299/300/301 ms boundaries, not live percentile aggregation or production alerts. Mandatory typecheck, unit, Firebase emulator, E2E, build, and SRE pager/alert delivery checks remain outstanding until executed on the exact PR head. Do not infer real production latency or monitoring correctness from this static gate.

**Known limitation:** The exporter maintains a rolling in-process duration sample and emits a gauge, while the SLO document describes a 30-day service target. Multi-instance aggregation, histogram instrumentation, exclusion rules, percentile windows, burn-rate math, remote alert rules, and alert-delivery evidence remain open under #71/#8. Review the metric naming and deployed collector/pager configuration before production use.

No cloud changes, CI runs, deployments, or branch merges are authorized by this PR.


## 2026-10-19 — Integration der SLO-Korrektur aus Draft-PR #77 (Issue #71)

Der ursprünglich auf `main` gemeldete P95-Widerspruch ist in diesem **separaten Integrationszweig** korrigiert: `src/server/observability.ts` importiert den kanonischen Zielwert `api-latency-p95-ms` aus `ops/slo.json` (aktuell **300 ms**) und setzt `klar_http_p95_slo_breach` ab `p95 > API_P95_SLO_MS`, nicht erst oberhalb von 1500 ms. Die bestehende statische Prüfung `scripts/check-observability.mjs` wurde ebenfalls von ihrer **historischen 1500-ms-Annahme** befreit; diese war im ursprünglichen Draft-PR #77 nicht korrigiert und hätte den `check:enterprise`-Pfad nach dem Import blockiert. `check:observability` führt nun zwingend zusätzlich `scripts/test-slo-policy.mjs` aus, einschließlich der tatsächlichen Metrik-Ausdrucksgrenzen 299/300/301/1500 ms. Die Korrektur verwendet die bereits in PR #77 geprüfte minimale Änderung, belässt diese Draft-PR jedoch eigenständig und ungemergt.

**Wichtige Messgrenzen:** Die exporterinterne P95-Berechnung erfolgt aus höchstens 15 Minuten lokaler Trace-Latenzen, und die ausgegebene Metrik ist ein einzelner Gauge. Daraus folgt **kein** 30-Tage-SLO für alle Serverinstanzen, keine aggregierte Prometheus-Histogramm-Verteilung, keine gültige Error-Budget-/Burn-Rate-Ableitung und kein verifizierter Pager. Solche Flotten-Quantile sollten separat aus aggregierbaren Histogramm-Buckets mit `histogram_quantile()` berechnet werden; Prometheus warnt ausdrücklich vor dem Aggregieren von quantile-Gauges. Ein SLO-GO braucht daher bestätigte SLI-Filter, Produktions-/Staging-Telemetrie, 30-Tage-Fenster, Alert-Delivery und unabhängige SRE-Freigabe. **Issue #71 bleibt offen / Produktionsfreigabe NO-GO**.

Offizielle Quelle: https://prometheus.io/docs/practices/histograms/ .
