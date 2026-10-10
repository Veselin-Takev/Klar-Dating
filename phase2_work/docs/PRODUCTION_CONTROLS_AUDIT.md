# Production controls audit

`npm run audit:production-controls` is a read-only evidence collector for the production Cloud Run service.

Required environment variables:

- `KLAR_PROJECT_ID`
- `KLAR_REGION`
- `KLAR_SERVICE`
- `KLAR_EXPECTED_SERVICE_ACCOUNT`
- `KLAR_REQUIRED_SECRETS` — comma-separated environment-variable names that must be backed by Secret Manager references in Cloud Run
- `KLAR_REQUIRED_ALERT_POLICIES` — comma-separated exact Monitoring policy display names that must be enabled
- `KLAR_EXPECTED_SHA` — exact full Git commit SHA of the local audited checkout, mandatory to prevent cross-build evidence
- `KLAR_PRODUCTION_CONTROLS_OUTPUT` — optional absolute path **outside** the repository for private, write-once audit evidence

The audit checks:

1. Cloud Run uses the expected non-default runtime service account.
2. Required secret environment variables use Secret Manager references rather than plaintext values.
3. The runtime principal does not hold primitive project Owner/Editor roles.
4. The runtime principal has `roles/secretmanager.secretAccessor` on every declared secret.
5. Every required Monitoring alert policy is explicitly enabled, has no API-reported `validity` error, and is **linked via `notificationChannels`** to a named, non-disabled channel whose `verificationStatus` is explicitly `VERIFIED`. An unrelated verified channel does not satisfy a required policy. Missing status, `UNVERIFIED`, or unspecified/exempt status does not constitute *explicit verification evidence* for this automated release check; operator-led delivery evidence is still required.

By default the audit creates a private, write-once JSON report in the operating system's temporary directory (`klar-production-controls-<pid>.json`). Set `KLAR_PRODUCTION_CONTROLS_OUTPUT` to an approved external evidence path when durable archiving is required. **Repository-internal output paths are rejected**, and existing output files are never overwritten. Do not commit audit evidence or credentials to Git. Save the file in the approved evidence vault and record its exact build SHA, creation time, reviewer and controlled link in the release checklist.

## Limits

This is configuration evidence, not operational proof. Production readiness still requires a documented secret-rotation exercise and an alert-delivery test that reaches the responsible on-call destination. Non-primitive IAM roles also require human least-privilege review; the audit deliberately does not invent an application-specific allowlist.

## Operational exercise evidence

The read-only audit above proves configuration only. For production release evidence, complete `docs/operational-control-evidence.template.json` from an actual secret-rotation exercise and an actual alert-delivery exercise, then validate it with:

    npx tsx scripts/validate-operational-control-evidence.ts path/to/evidence.json <exact-40-char-build-sha>

The validator requires:

- an exact build SHA and declared environment;
- a real secret name, a new version creation time, proof that the workload observed the new version, a passing post-rotation smoke test, and the previous version disabled;
- durable evidence links for the rotation;
- the exercised alert policy, exercise start time, notification receipt time, acknowledgement time, recipient/on-call target, channel type, and durable evidence links;
- timestamps in a valid chronological order.

This validator does not rotate secrets or trigger production alerts. Those exercises require an approved maintenance/test window and must be performed against the real configured systems.
