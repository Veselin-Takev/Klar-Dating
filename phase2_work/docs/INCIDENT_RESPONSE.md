# Incident Response

## Severity

- **SEV-1:** safety, privacy, authentication, payment, or widespread availability incident.
- **SEV-2:** major degradation without confirmed sensitive-data exposure.
- **SEV-3:** contained defect with an available workaround.

## First 15 minutes

1. Assign incident commander, communications lead, and operations lead.
2. Open a timestamped incident record and preserve relevant audit evidence.
3. Stop unsafe behavior with `KLAR_KILL_SWITCHES`, traffic rollback, or credential revocation.
4. For suspected exposure, restrict access before investigating convenience issues.
5. Do not place personal data, credentials, tokens, or raw chat content in the incident channel.

## Containment and recovery

- Roll back to the last verified image digest.
- Rotate affected credentials through the secret manager.
- Validate `/api/health`, `/api/ready`, error rate, latency, message delivery, and payment webhooks.
- Restore data only from a verified export and only through the guarded restore procedure.
- Keep deletion/legal holds and evidence-preservation requirements explicit.

## Communications

- Update stakeholders at least every 30 minutes for SEV-1 and hourly for SEV-2.
- Notify the privacy/security owner immediately for suspected personal-data exposure.
- Legal notification deadlines are tracked from the first confirmed awareness timestamp.

## Closure

An incident closes only after service restoration, evidence preservation, customer-impact assessment, and ownership of every follow-up. Complete a blameless review within five working days and verify corrective actions in CI or infrastructure policy.
