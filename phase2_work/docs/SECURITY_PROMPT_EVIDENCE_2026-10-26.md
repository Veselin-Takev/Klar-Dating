# Security checkpoint: deterministic prompt evidence — 2026-10-26

Status: 11 focused local tests passed; full exact-head CI pending. Production: **NO-GO**.

## SEC-06 prompt-suite correction

The excluded `tests/enterprise/securityGuardrails.spec.ts` previously required a
control tag to be removed and simultaneously retained in escaped form. Its assertions
now distinguish control-tag redaction from ordinary markup escaping. Runtime prompt
protection is unchanged; no tag is permitted to satisfy the test.

Eleven deterministic cases cover control/injection redaction inside one untrusted
envelope, ordinary markup escaping, all five recognized control-tag families with
mixed case/attributes, system-task escaping and output rejection. These are local
string/control-boundary tests, not proof that a live model resists every injection.

`vitest.security.config.ts` explicitly includes only this deterministic suite in Node.
`test:prompt-security` runs it and is invoked by the existing `check:enterprise` CI
gate. The standard exclusion of other legacy enterprise/stochastic tests remains;
this change does not claim all enterprise suites are executed. No provider calls,
credentials or live model evaluation are involved.

Local execution: **11/11 passed** using isolated Vitest 5.0.5 / Node 24.22.1. The pinned
repository CI must execute the repository config and full integration checks before merge.

## Honest authentication evidence

The API test formerly labeled an IDOR check used an invalid token and literal
`:chatId` placeholder. It is now labeled as an invalid-token authentication check,
uses a concrete synthetic path and requires HTTP 401. It is explicitly not evidence
of owner-versus-foreign-user authorization. Valid emulator A/B accounts, authorized
positive cases and foreign-account resource denial remain required for SEC-06 closure.

## Current release/audit status

PR #134 passed complete CI 40379168480 on head
cfd9ed4920a64cc37069e2a6c3208373e90da101 and merged as
ba9adcb4c76014f0eb207828fa33d495f5f2491c. The slow Ubuntu runner package download
completed without waiving browser acceptance. Docker pin consistency is corrected;
actual container build/scan evidence is separate.

SEC-06 remains partially open. SEC-01 named-database-compatible media authorization,
remaining dependencies and other raw logging/real sink controls are also open.
Independent acceptance and actual isolated live staging/rollback evidence remain
unverified; no separate staging project exists. Production remains **NO-GO** until
the separate protected official approval process is satisfied.
