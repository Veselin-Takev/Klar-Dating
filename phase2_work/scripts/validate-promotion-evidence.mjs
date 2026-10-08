import { readFile } from 'node:fs/promises';

const [path, expectedImage, expectedRevision, expectedBuildSha] = process.argv.slice(2);
const expectedEnvironment = process.env.KLAR_EVIDENCE_ENVIRONMENT;
const evidenceNotBefore = process.env.KLAR_EVIDENCE_NOT_BEFORE;
const evidenceNotAfter = process.env.KLAR_EVIDENCE_NOT_AFTER;
const approvedHosts = new Set((process.env.KLAR_EVIDENCE_HOSTS ?? '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean));
if (!path || !expectedImage || !expectedRevision || !expectedBuildSha) {
  console.error('Usage: node scripts/validate-promotion-evidence.mjs <evidence.json> <image> <revision> <build-sha>');
  process.exit(2);
}
const evidence = JSON.parse(await readFile(path, 'utf8'));
const errors = [];
if (evidence?.schemaVersion !== 2) errors.push('schemaVersion must be 2');
if (expectedEnvironment !== 'production') errors.push('KLAR_EVIDENCE_ENVIRONMENT must be production');
if (evidence?.environment !== 'production') errors.push('evidence environment must be production');
const notBeforeMs = Date.parse(String(evidenceNotBefore ?? ''));
const notAfterMs = Date.parse(String(evidenceNotAfter ?? ''));
if (!Number.isFinite(notBeforeMs)) errors.push('KLAR_EVIDENCE_NOT_BEFORE must be a valid ISO date/time');
if (!Number.isFinite(notAfterMs)) errors.push('KLAR_EVIDENCE_NOT_AFTER must be a valid ISO date/time');
if (approvedHosts.size === 0) errors.push('KLAR_EVIDENCE_HOSTS must contain at least one approved host');
if (!/^[0-9a-f]{40}$/.test(expectedBuildSha)) errors.push('expected build SHA must be a full 40-character lowercase Git SHA');
if (evidence?.buildSha !== expectedBuildSha) errors.push('evidence buildSha must match the exact release build');
if (evidence?.candidateRevision !== expectedRevision) errors.push('candidateRevision does not match the promotion target');
if (evidence?.candidateImage !== expectedImage) errors.push('candidateImage does not match the immutable promotion image');
if (Number(evidence?.trafficPercent) !== 10) errors.push('candidate traffic must have been exactly 10%');
if (evidence?.health !== 'passed') errors.push('health check must have passed');
if (evidence?.readiness !== 'passed') errors.push('readiness check must have passed');
const started = Date.parse(String(evidence?.observedFrom ?? ''));
const ended = Date.parse(String(evidence?.observedUntil ?? ''));
if (Number.isFinite(started) && Number.isFinite(notBeforeMs) && started < notBeforeMs) errors.push('observedFrom must not predate the trusted evidence window');
if (Number.isFinite(ended) && Number.isFinite(notAfterMs) && ended > notAfterMs) errors.push('observedUntil must not exceed the trusted evidence window');
if (!Number.isFinite(started) || !Number.isFinite(ended) || ended < started) errors.push('observedFrom/observedUntil must be ordered ISO timestamps');
const durationSeconds = Number(evidence?.observationSeconds);
if (!Number.isInteger(durationSeconds) || durationSeconds < 300) errors.push('observationSeconds must be at least 300 seconds');
if (Number.isFinite(started) && Number.isFinite(ended) && Number.isInteger(durationSeconds) && Math.abs((ended - started) / 1000 - durationSeconds) > 5) errors.push('observationSeconds must match observedFrom/observedUntil within 5 seconds');
const metrics = evidence?.metrics;
if (!Number.isFinite(Number(metrics?.availability)) || Number(metrics.availability) < 0.9995) errors.push('availability must meet the production SLO');
if (!Number.isFinite(Number(metrics?.p95LatencyMs)) || Number(metrics.p95LatencyMs) > 300) errors.push('p95 latency must meet the production SLO');
if (!Number.isFinite(Number(metrics?.errorRate5xx)) || Number(metrics.errorRate5xx) > 0.001) errors.push('5xx error rate must be at or below 0.1%');
if (!Array.isArray(evidence?.evidenceLinks) || evidence.evidenceLinks.length === 0) errors.push('at least one observation evidence link is required');
for (const link of evidence?.evidenceLinks ?? []) {
  try {
    const url = new URL(link);
    if (!['https:', 'gs:'].includes(url.protocol)) errors.push('evidence links must use https or gs');
    else if (!approvedHosts.has(url.hostname.toLowerCase())) errors.push('evidence link host is not an approved evidence source: ' + url.hostname);
  } catch { errors.push('invalid evidence link: ' + link); }
}
if (errors.length) {
  console.error('Promotion evidence validation FAILED:');
  for (const error of errors) console.error('- ' + error);
  process.exit(1);
}
console.log('Promotion evidence validation PASS.');
