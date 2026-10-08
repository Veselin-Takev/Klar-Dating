# Klar Security Model

## Authentication vs authorization

A valid Firebase ID token proves identity only. Privileged operations additionally require explicit role claims. Client-supplied `userId` values are never trusted for ownership.

## Secrets

All API keys, webhook secrets and audit encryption keys come from a deployment secret manager. Repository files contain placeholders only.

## Payments

Stripe webhook signatures are verified against the raw request body. Stripe event IDs are persisted before side effects to provide idempotent processing. Checkout return URLs are restricted to configured HTTPS origins.

## Abuse controls

Rate limits should be backed by shared state for multi-instance production. The deterministic risk engine in `src/server/platform/riskEngine.ts` is a foundation; production scoring should be fed by privacy-safe signals and reviewed for false positives and fairness.
