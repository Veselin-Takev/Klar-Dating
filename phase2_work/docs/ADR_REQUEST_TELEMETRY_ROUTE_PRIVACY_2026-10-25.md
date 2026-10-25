# Request route telemetry privacy — #56 (2026-10-25)

Status: engineering mitigation; production NO-GO. Base main cde8e324aba3c9cb590a56a13693f07f0b60496a.

server.ts initialized HTTP span http.route with req.path and used req.path as the finish-time fallback. Early/unmatched partner requests could therefore retain the referral token in a completed span. failedApiCalls also retained raw paths for admin diagnostics. A matched route often replaced the initial attribute, but did not protect early rejections.

All four telemetry sinks now use requestRouteForTelemetry: initial span route, finish-time attribute, structured request-log route and failed-request diagnostic path. The helper reads only the registered Express route.path string (max 256 characters, no CR/LF/NUL). Early/unmatched/unsupported routes use unmatched. It never reads path/originalUrl/query or substitutes params. A matched partner click is represented as /partner/click/:token (or its registered full template), not its raw token.

Authentication, redirects, response bodies, correlation IDs, latency sampling and exporter destinations remain unchanged. Early errors deliberately lose route detail; do not restore raw-path fallback to regain it.

Twelve local unit/loopback HTTP cases PASS (Node 24.22.1, Vitest 5.0.5), including 200/401/404/429/500 requests containing canary token/query data. Existing observability source gate passes. The HTTP tests exercise Express and the shared helper; they are not a live OTLP, CDN or Cloud Run log audit. Full exact-head CI remains required.

Already-exported traces, admin diagnostics and partner/browser/CDN copies are not erased by this patch. Receiver-side inventory, retention and approved erasure policy remain open under #56/#70/#8. Never copy actual tokens into evidence. Rollback must preserve template-only telemetry.
