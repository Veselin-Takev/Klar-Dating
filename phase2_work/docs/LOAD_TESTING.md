# Staging load and SLO evidence

This harness creates a reproducible synthetic staging baseline. It does not replace production load, cost, provider, cold-start, soak, or failure-injection evidence.

## Safety

npm run load:staging requires an explicit LOAD_TEST_BASE_URL. The known production hosts klar.app and www.klar.app are refused unless an approved exercise explicitly sets LOAD_TEST_ALLOW_PRODUCTION=true.

The default workload is deliberately bounded: 30 seconds, 10 requests/second, concurrency 5, GET only, against /api/health and /api/ready. Raise load only in an isolated staging environment with an agreed capacity and cost envelope.

## Run

    LOAD_TEST_BASE_URL=https://staging.example.invalid npm run load:staging

Optional controls:

- LOAD_TEST_DURATION_SECONDS — default 30, maximum 600.
- LOAD_TEST_RPS — default 10, maximum 200.
- LOAD_TEST_CONCURRENCY — default 5, maximum 50.
- LOAD_TEST_TIMEOUT_MS — default 5000, maximum 30000.
- LOAD_TEST_PATHS — comma-separated GET paths; default /api/health,/api/ready.
- LOAD_TEST_OUTPUT — JSON evidence path; default load-evidence/load-report.json.

The report reads the current API availability and P95 latency thresholds directly from ops/slo.json; do not duplicate or silently relax them in the load script.

## Evidence interpretation

A passing report means only that the selected synthetic GET workload met the configured API availability and latency thresholds for that run. It does not establish authenticated journey latency, provider quotas, cold-start scaling, Firestore operation counts, or production unit cost.

Before production sign-off, correlate a controlled staging/production exercise with Cloud Run CPU/memory/concurrency, Firestore reads/writes, provider calls and billing export. Preserve the JSON report, deployment digest, test window, environment, dashboard exports and approval record together.

## Production load/cost release evidence

For a controlled production or production-like exercise, set `LOAD_TEST_BUILD_SHA` to the exact 40-character deployment commit so the generated load report can be bound to the tested build.

After the run, complete `docs/load-cost-evidence.template.json` from actual billing/provider data and an explicitly approved unit-cost envelope. Validate the record with:

    npx tsx scripts/validate-load-cost-evidence.ts path/to/evidence.json path/to/load-report.json <exact-40-char-build-sha>

The validator requires:

- the evidence and load report to reference the same exact build SHA;
- the load report to have passed its SLO verdict;
- request counts in the billing evidence to match the load report;
- unit cost to be arithmetically consistent with total measured cost and request count;
- at least one durable billing/provider evidence link;
- a named approver, approval timestamp and rationale for the maximum cost per 1,000 requests;
- measured unit cost not to exceed that approved envelope.

The repository deliberately does not define a business cost ceiling. Finance/product ownership must approve that limit before the exercise; a validator-generated default would not constitute cost governance.
