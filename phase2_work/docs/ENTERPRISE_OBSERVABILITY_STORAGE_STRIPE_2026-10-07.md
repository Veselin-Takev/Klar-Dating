# Enterprise Hardening: Observability, Verification Storage Retention, Stripe Idempotency

## Scope

This release hardens three cross-cutting controls in the consolidated Klar master codebase:

1. OpenTelemetry-compatible W3C tracing and operational metrics.
2. Daily compliance purge of verification photos after the 30-day retention period.
3. Persistent Stripe event deduplication and terminal subscription tombstones.

## 1. Observability

- Express requests create OpenTelemetry spans with `HTTP <METHOD>` names.
- Incoming W3C `traceparent` is validated and continued; response `traceparent` carries the new server span.
- All transactions executed through the central durable Firestore proxy create `firestore.transaction` spans.
- Gemini calls through `createBudgetedAI()` create `gemini.generateContent` spans.
- Gemini usage metadata is recorded as `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, and `gen_ai.usage.total_tokens`.
- `/api/metrics` exposes Prometheus-compatible P95 latency and minute-level Gemini token counters behind `METRICS_TOKEN`.
- `klar_http_p95_slo_breach` is `1` when the rolling P95 exceeds 1500 ms.
- Telemetry contains no request bodies, authorization headers, user text, or raw AI prompts.

The OpenTelemetry Node SDK currently documents `NodeTracerProvider` registration and span processors for Node.js tracing; the repository pins compatible SDK packages explicitly.

## 2. Verification storage purge

Endpoint:

`POST /api/admin/purge-verification-storage`

The endpoint is deliberately outside user authentication because Cloud Scheduler has no Firebase user session. It remains behind the global API rate limiter and requires a fresh HMAC proof using `COMPLIANCE_JOB_SECRET`:

- `X-Klar-Compliance-Timestamp`
- `X-Klar-Compliance-Signature = HMAC-SHA256(timestamp + "." + body, secret)`
- maximum clock skew: 5 minutes
- minimum secret length: 32 bytes
- constant-time signature comparison

The endpoint reads due `verification_events`, validates that every path is under `verification/{uid}/`, and delegates deletion decisions to `StorageRetentionEngine` with its fixed 30-day default. Missing storage objects are idempotently tolerated.

The Frankfurt Cloud Function `purgeVerificationStorageCron` runs daily at 03:00 UTC, with one instance and retry protection.

## 3. Stripe idempotency

Verified Stripe events are committed in a Firestore transaction to `processed_stripe_events/{eventId}`. Concurrent deliveries therefore collapse to one application; a failed transaction does not create a false completion marker.

Subscription deletion additionally creates a terminal `processed_stripe_events/subscription_{subscriptionId}` tombstone even when no local user currently references that subscription. Late checkout completion, invoice failure, and subscription-update events check this tombstone before changing entitlements.

The existing checkout reservation remains transactionally leased and Stripe checkout creation uses an idempotency key derived from the durable checkout request ID.

## Verification status

Static enterprise boundary checks added for all three areas are executable without external services. Full runtime gates still depend on the repository's installed Node/Bun/Firebase/Playwright toolchain and emulator availability.
