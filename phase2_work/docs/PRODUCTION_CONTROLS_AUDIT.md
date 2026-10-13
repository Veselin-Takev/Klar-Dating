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
4. The runtime principal has `roles/secretmanager.secretAccessor` on the **actual Secret Manager resource resolved from each required environment variable**, not on a secret guessed from the environment-variable name. In Cloud Run v1, `valueFrom.secretKeyRef.name` may be a lookup alias defined by the template's `run.googleapis.com/secrets` annotation (`alias:projects/PROJECT_NUMBER/secrets/ACTUAL_SECRET`). The collector reads the alias mapping first, then invokes the IAM lookup on the resolved resource. Direct same-project secret references remain supported. Malformed/duplicate alias entries, unsafe reference names and duplicate required environment variables (including across containers) cause audit failure.
5. Every required Monitoring alert policy is explicitly enabled, has no API-reported `validity` error, and is **linked via `notificationChannels`** to a named, non-disabled channel whose `verificationStatus` is explicitly `VERIFIED`. An unrelated verified channel does not satisfy a required policy. Missing status, `UNVERIFIED`, or unspecified/exempt status does not constitute *explicit verification evidence* for this automated release check; operator-led delivery evidence is still required.

By default the audit creates a private, write-once JSON report in the operating system's temporary directory (`klar-production-controls-<pid>.json`). Set `KLAR_PRODUCTION_CONTROLS_OUTPUT` to an approved external evidence path when durable archiving is required. **Repository-internal output paths are rejected**, and existing output files are never overwritten. Do not commit audit evidence or credentials to Git. Save the file in the approved evidence vault and record its exact build SHA, creation time, reviewer and controlled link in the release checklist.

## Limits

This is configuration evidence, not operational proof. **[ANNAHME]** For multiple Cloud Run containers, a required secret variable must be defined unambiguously exactly once across the inspected revision; otherwise the collector fails closed pending explicit review of which container consumes it. Cross-project secret references are supported only insofar as `gcloud secrets get-iam-policy` can read their IAM policy with the caller's credentials; missing permissions stop the audit. The collector does not prove the secret's current payload, that Cloud Run has successfully read it, or that its version has been rotated. Production readiness still requires a documented secret-rotation exercise and an alert-delivery test that reaches the responsible on-call destination. Non-primitive IAM roles also require human least-privilege review; the audit deliberately does not invent an application-specific allowlist.

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

## 2026-10-13 — Cloud Run container presence audit hardening

The production controls checker previously allowed a syntactically valid service account to pass the Cloud Run service check if the service template contained **no containers**, when `KLAR_REQUIRED_SECRETS` was empty. This is not sufficient evidence of a runnable service. `auditCloudRunService` now rejects an empty or missing `spec.template.spec.containers` array regardless of required secret configuration. A targeted regression checks both missing and explicitly empty containers. This is a fail-closed static evidence-validation improvement; it is **not** evidence of real production Cloud Run deployment, alert delivery, IAM access, secret rotation, rollback or accountable human release approval. Keep Issue #8 open and production **NO-GO** until verified operational evidence is available. Exact PR-head CI remains pending; no manual GitHub Actions runs were dispatched.

## 2026-10-13 — Require explicit enabled state for alert channels

Additional fail-closed hardening: `auditMonitoring` formerly accepted a channel with `verificationStatus: VERIFIED` and no `enabled` value because it only rejected `enabled: false`. This was inconsistent with the rule requiring **explicitly enabled** monitoring notification channels, and could treat incomplete API evidence as an operative notification path. Only `enabled === true` is accepted now. `tests/productionControls.spec.ts` includes a negative regression for missing `enabled`. This validates input semantics only; it does not show that alerts were delivered or acknowledged by on-call staff. Revalidate CI on the updated exact SHA. Issue #8 and production **NO-GO** remain unchanged.

## 2026-10-13 — Reject ambiguous inline secret fields

The Cloud Run service audit previously rejected a required secret's inline `value` only if it was non-null. A payload could therefore specify `value: null` alongside `valueFrom.secretKeyRef` without being rejected, even though the audit should only accept an unambiguous Secret Manager reference. The validator now fails closed whenever a `value` property exists for a required secret, including null and empty strings. Regression tests cover both cases. This hardens evidence parsing; it does **not** prove Secret Manager access, actual runtime injection, rotation or deployment controls. GitHub PR-head CI must be rerun automatically for this new commit; production remains NO-GO pending Issue #8 and authorized operational signoff.
