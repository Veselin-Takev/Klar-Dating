# Security checkpoint: trace exception minimization — 2026-10-26

Status: local implementation verified; full exact-head CI pending. Production: **NO-GO**.

## Implemented boundary

The active Firestore transaction and Gemini tracing wrappers now emit only fixed
`exception.type` categories (`FirestoreOperationFailure` / `GeminiOperationFailure`).
They never inspect or forward the thrown value to the tracing SDK. Error messages,
stacks, causes, provider response bodies and arbitrary error properties are omitted.
The error span status and error counters remain; callers receive the original
rejection unchanged. Successful results and Gemini token accounting remain unchanged.

This follows the data-minimization principle: OpenTelemetry explicitly warns that
[exception messages can contain sensitive information](https://opentelemetry.io/docs/specs/semconv/registry/attributes/exception/).
The fixed category deliberately trades detailed exception diagnostics for a bounded,
non-user-controlled failure signal. There is no opt-in to export raw exceptions.

## Verification

`tests/observabilityPrivacy.spec.ts`: **13 local tests passed** with the actual
OpenTelemetry API, Node SDK and BatchSpanProcessor. Only the network exporter is
replaced with an in-memory test sink; no test data is sent to a remote service.

Both wrappers are tested with synthetic sensitive Error messages/stacks/causes,
provider-shaped objects, string/null/undefined rejections and hostile property
getters. Assertions inspect the spans received by the export sink after forceFlush,
check the complete exception-event attributes and status, preserve rejection identity,
and verify successful return values, token usage and transaction counters.

Local verification used Node 24.22.1 and isolated dependencies outside the repository.
Full repository CI with the pinned Node 22/Bun toolchain remains required before merge.

## Audit and release limits

SEC-04 is **partially remediated** at these two tracing boundaries. Other application
logging paths, real collectors, access controls, retention and historical records
remain unverified. Existing operation/model/endpoint labels are not newly sanitized
by this change; callers must continue passing static, non-sensitive identifiers.
No claim of past disclosure or complete telemetry compliance is made.

SEC-01, remaining SEC-02 dependency findings and SEC-05/06/07 remain open.
PR #131 corrected SEC-03 technically and passed full CI 40346165390 before merge
fc92b41fcebc1bfefb29a5261eeace74468dc6d1. That CI result does not constitute
independent Security/Privacy/Finance approval or an actual live staging rehearsal.
No staging project exists yet; production approval remains separate and blocked.

Next: review remaining logging sinks and bounded response consumption, then validate
real storage authorization with emulator rules tests. Keep independent acceptance,
isolated live staging and rollback evidence open until actually demonstrated.

## CI regression follow-up

Run 40349105480 passed install, static gates, typecheck and Functions build; all
13 new export-boundary tests passed. The full test step reported 1303 passed and
one failure: the existing four-way Firestore transaction contention test exceeded
its default five-second Vitest timeout. That integration case now has an explicit
30-second bound for real emulator locking/SDK backoff. All quota assertions remain
unchanged; no production timeout, retry policy, rate limit or latency SLO is altered.
A new exact-head full CI run is required; the failed run is not acceptance evidence.
