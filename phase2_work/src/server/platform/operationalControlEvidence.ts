export type OperationalControlEvidence = {
  schemaVersion: 1;
  buildSha: string;
  environment: 'staging' | 'production';
  secretRotation: {
    secretName: string;
    oldVersionDisabled: boolean;
    newVersionCreatedAt: string;
    workloadObservedNewVersionAt: string;
    smokeTest: 'passed' | 'failed';
    evidenceLinks: string[];
  };
  alertDelivery: {
    policyName: string;
    exerciseStartedAt: string;
    notificationReceivedAt: string;
    acknowledgedAt: string;
    recipient: string;
    channelType: string;
    evidenceLinks: string[];
  };
};

function iso(value: unknown, label: string, errors: string[]) {
  const text = typeof value === 'string' ? value : '';
  const ms = /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?(?:Z|[+-]\\d{2}:\\d{2})$/.test(text) ? Date.parse(text) : Number.NaN;
  if (!Number.isFinite(ms)) errors.push(label + ' must be an ISO date/time');
  return ms;
}

function links(values: unknown, label: string, errors: string[], approvedHosts: Set<string>) {
  if (!Array.isArray(values) || values.length === 0) { errors.push(label + ' must contain evidence links'); return; }
  for (const raw of values) {
    if (typeof raw !== 'string' || !raw.trim()) { errors.push(label + ' contains an invalid link'); continue; }
    try { const url = new URL(raw); if (!['https:','gs:'].includes(url.protocol)) errors.push(label + ' links must use https or gs');
      if (url.username || url.password || url.hash || url.search || url.port || !url.hostname) errors.push(label + ' links must not contain credentials, query strings, fragments, custom ports or empty hosts');
          const host = url.hostname.toLowerCase();
      if (approvedHosts.size > 0 && !approvedHosts.has(host)) errors.push(label + ' link host is not an approved evidence source'); }
    catch { errors.push(label + ' contains an invalid link'); }
  }
}

export function validateOperationalControlEvidence(value: unknown, expectedBuildSha: string, expectedEnvironment: OperationalControlEvidence['environment'], approvedEvidenceHosts: string[], evidenceNotBefore?: string) {
  const errors: string[] = [];
  if (!value || typeof value !== 'object') return { passed: false, errors: ['Evidence must be an object'] };
  const evidence = value as Partial<OperationalControlEvidence>;
  if (evidence.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (!/^[0-9a-f]{40}$/.test(String(evidence.buildSha ?? ''))) errors.push('buildSha must be a full 40-character lowercase Git SHA');
  if (!/^[0-9a-f]{40}$/.test(expectedBuildSha)) errors.push('expectedBuildSha must be a full 40-character lowercase Git SHA');
  else if (evidence.buildSha !== expectedBuildSha) errors.push('buildSha must match the exact evaluated build');
  if (!['staging','production'].includes(String(evidence.environment ?? ''))) errors.push('environment must be staging or production');
  if (evidence.environment !== expectedEnvironment) errors.push('environment must match the expected evidence environment');
  const approvedHosts = new Set(Array.isArray(approvedEvidenceHosts) ? approvedEvidenceHosts.filter((host): host is string => typeof host === 'string').map((host) => host.trim().toLowerCase()).filter(Boolean) : []);
  const evidenceFloor = typeof evidenceNotBefore === 'string' && /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?(?:Z|[+-]\\d{2}:\\d{2})$/.test(evidenceNotBefore) ? Date.parse(evidenceNotBefore) : Number.NaN;
  if (!Number.isFinite(evidenceFloor)) errors.push('evidenceNotBefore must be a valid ISO date/time and is required');
  if (approvedHosts.size === 0) errors.push('at least one approved evidence host is required');

  const rotation = evidence.secretRotation;
  if (typeof rotation?.secretName !== 'string' || !rotation.secretName.trim()) errors.push('secretRotation.secretName is required');
  const created = iso(rotation?.newVersionCreatedAt, 'secretRotation.newVersionCreatedAt', errors);
  const observed = iso(rotation?.workloadObservedNewVersionAt, 'secretRotation.workloadObservedNewVersionAt', errors);
  if (Number.isFinite(created) && Number.isFinite(observed) && observed < created) errors.push('workloadObservedNewVersionAt cannot precede newVersionCreatedAt');
  if (Number.isFinite(evidenceFloor) && Number.isFinite(created) && created < evidenceFloor) errors.push('secret rotation evidence must not predate evidenceNotBefore');
  if (rotation?.oldVersionDisabled !== true) errors.push('old secret version must be disabled after successful rotation');
  if (rotation?.smokeTest !== 'passed') errors.push('post-rotation smoke test must pass');
  links(rotation?.evidenceLinks, 'secretRotation.evidenceLinks', errors, approvedHosts);

  const alert = evidence.alertDelivery;
  if (typeof alert?.policyName !== 'string' || !alert.policyName.trim()) errors.push('alertDelivery.policyName is required');
  if (typeof alert?.recipient !== 'string' || !alert.recipient.trim()) errors.push('alertDelivery.recipient is required');
  if (typeof alert?.channelType !== 'string' || !alert.channelType.trim()) errors.push('alertDelivery.channelType is required');
  const started = iso(alert?.exerciseStartedAt, 'alertDelivery.exerciseStartedAt', errors);
  const received = iso(alert?.notificationReceivedAt, 'alertDelivery.notificationReceivedAt', errors);
  const ack = iso(alert?.acknowledgedAt, 'alertDelivery.acknowledgedAt', errors);
  if (Number.isFinite(started) && Number.isFinite(received) && received < started) errors.push('notificationReceivedAt cannot precede exerciseStartedAt');
  if (Number.isFinite(evidenceFloor) && Number.isFinite(started) && started < evidenceFloor) errors.push('alert exercise evidence must not predate evidenceNotBefore');
  if (Number.isFinite(received) && Number.isFinite(ack) && ack < received) errors.push('acknowledgedAt cannot precede notificationReceivedAt');
  links(alert?.evidenceLinks, 'alertDelivery.evidenceLinks', errors, approvedHosts);

  return { passed: errors.length === 0, errors };
}
