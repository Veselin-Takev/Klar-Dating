# Klar Security Policy

## Reporting
Report vulnerabilities privately to the security contact configured for the deployment. Do not publish credentials, personal data, exploit payloads, or user records.

## Secrets
Secrets must be supplied by the deployment secret manager. Never commit `.env`, API keys, service-account JSON, private keys, or production credentials.

## Release gates
Production releases require dependency installation from the lockfile, secret scanning, type checking, unit tests, Firebase Rules tests, production build, and browser E2E tests.

## Authorization
Server-side authorization is mandatory. Client-supplied user IDs are never trusted for ownership decisions.
