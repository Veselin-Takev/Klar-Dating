export type RecoveryDrillEvidence = {
  schemaVersion: 1;
  buildSha: string;
  environment: 'isolated_restore' | 'production';
  projectId: string;
  databaseId: string;
  backupUri: string;
  backupCreatedAt: string;
  restoreStartedAt: string;
  readyAt: string;
  approvedTargets: { rpoMinutes: number; rtoMinutes: number; approvedBy: string; approvedAt: string };
  integrity: {
    sourceDocumentCount: number;
    restoredDocumentCount: number;
    sampledChecksums: Array<{ path: string; sourceSha256: string; restoredSha256: string }>;
  };
  smokeTests: { api: 'passed' | 'failed'; rules: 'passed' | 'failed'; playwright: 'passed' | 'failed' };
  rollbackEvidence?: { trafficPercent: number; health: 'passed' | 'failed'; readiness: 'passed' | 'failed'; targetRevision: string; targetImage: string };
};

function isoMs(value: unknown, label: string, errors: string[]) {
  const ms = Date.parse(String(value ?? ''));
  if (!Number.isFinite(ms)) errors.push(label + ' must be an ISO date/time');
  return ms;
}

export function validateRecoveryDrillEvidence(value: unknown, expectedBuildSha: string, expectedBackupBucket: string, expectedProjectId: string, expectedDatabaseId: string, approvedRpoMinutes: number, approvedRtoMinutes: number) {
  const errors: string[] = [];
  if (!value || typeof value !== 'object') return { passed: false, errors: ['Evidence must be an object'] };
  const evidence = value as Partial<RecoveryDrillEvidence>;

  if (evidence.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (!/^[0-9a-f]{40}$/.test(String(evidence.buildSha ?? ''))) errors.push('buildSha must be a full 40-character lowercase Git SHA');
  if (!/^[0-9a-f]{40}$/.test(expectedBuildSha)) errors.push('expectedBuildSha must be a full 40-character lowercase Git SHA');
  else if (evidence.buildSha !== expectedBuildSha) errors.push('buildSha must match the exact evaluated build');
  if (!['isolated_restore','production'].includes(String(evidence.environment ?? ''))) errors.push('environment must be isolated_restore or production');
  if (!evidence.projectId?.trim()) errors.push('projectId is required');
  if (!evidence.databaseId?.trim()) errors.push('databaseId is required');
  const backupUri = String(evidence.backupUri ?? '');
  if (!/^gs:\/\/[a-z0-9._/-]+$/i.test(backupUri)) errors.push('backupUri must be a concrete gs:// path');
  const projectId = String(evidence.projectId ?? '').trim();
  const databaseId = String(evidence.databaseId ?? '').trim();
  const expectedProject = String(expectedProjectId ?? '').trim();
  const expectedDatabase = String(expectedDatabaseId ?? '').trim();
  if (!expectedProject) errors.push('expectedProjectId must be provided');
  else if (projectId !== expectedProject) errors.push('projectId must match the evaluated production project');
  if (!expectedDatabase) errors.push('expectedDatabaseId must be provided');
  else if (databaseId !== expectedDatabase) errors.push('databaseId must match the evaluated Firestore database');
  const expectedBucket = String(expectedBackupBucket ?? '').trim().replace(/\/$/, '');
  if (expectedBucket && !/^gs:\/\/[a-z0-9._-]+$/i.test(expectedBucket)) errors.push('expectedBackupBucket must be a concrete gs:// bucket');
  if (projectId && /^gs:\/\/[a-z0-9._-]+\/firestore\//i.test(backupUri)) {
    const expectedPrefix = `${expectedBucket || backupUri.split('/firestore/')[0]}/firestore/${projectId}/`;
    if (!backupUri.startsWith(expectedPrefix)) errors.push('backupUri must be scoped to the approved backup bucket and evaluated project');
  } else if (projectId && backupUri) {
    errors.push('backupUri must use the project-scoped firestore/<projectId>/ path');
  }

  const backupMs = isoMs(evidence.backupCreatedAt, 'backupCreatedAt', errors);
  const restoreMs = isoMs(evidence.restoreStartedAt, 'restoreStartedAt', errors);
  const readyMs = isoMs(evidence.readyAt, 'readyAt', errors);
  if (Number.isFinite(backupMs) && Number.isFinite(restoreMs) && backupMs > restoreMs) errors.push('backupCreatedAt must not be after restoreStartedAt');
  if (Number.isFinite(restoreMs) && Number.isFinite(readyMs) && restoreMs > readyMs) errors.push('readyAt must not be before restoreStartedAt');

  const targets = evidence.approvedTargets;
  if (!Number.isFinite(approvedRpoMinutes) || approvedRpoMinutes <= 0) errors.push('approvedRpoMinutes must be a positive trusted value');
  if (!Number.isFinite(approvedRtoMinutes) || approvedRtoMinutes <= 0) errors.push('approvedRtoMinutes must be a positive trusted value');
  if (!Number.isFinite(targets?.rpoMinutes) || Number(targets?.rpoMinutes) <= 0) errors.push('approvedTargets.rpoMinutes must be positive');
  else if (Number.isFinite(approvedRpoMinutes) && Number(targets.rpoMinutes) !== approvedRpoMinutes) errors.push('approvedTargets.rpoMinutes must match the trusted RPO target');
  if (!Number.isFinite(targets?.rtoMinutes) || Number(targets?.rtoMinutes) <= 0) errors.push('approvedTargets.rtoMinutes must be positive');
  else if (Number.isFinite(approvedRtoMinutes) && Number(targets.rtoMinutes) !== approvedRtoMinutes) errors.push('approvedTargets.rtoMinutes must match the trusted RTO target');
  if (!targets?.approvedBy?.trim()) errors.push('approvedTargets.approvedBy is required');
  const approvedMs = isoMs(targets?.approvedAt, 'approvedTargets.approvedAt', errors);
  if (Number.isFinite(approvedMs) && Number.isFinite(restoreMs) && approvedMs > restoreMs) errors.push('approvedTargets.approvedAt must not be after restoreStartedAt');

  if (Number.isFinite(backupMs) && Number.isFinite(restoreMs) && Number.isFinite(approvedRpoMinutes)) {
    const rpoMinutes = (restoreMs - backupMs) / 60000;
    if (rpoMinutes > approvedRpoMinutes) errors.push('measured RPO exceeds trusted approved target');
  }
  if (Number.isFinite(restoreMs) && Number.isFinite(readyMs) && Number.isFinite(approvedRtoMinutes)) {
    const rtoMinutes = (readyMs - restoreMs) / 60000;
    if (rtoMinutes > approvedRtoMinutes) errors.push('measured RTO exceeds trusted approved target');
  }

  const integrity = evidence.integrity;
  const sourceCount = Number(integrity?.sourceDocumentCount);
  const restoredCount = Number(integrity?.restoredDocumentCount);
  if (!Number.isInteger(sourceCount) || sourceCount < 0) errors.push('sourceDocumentCount must be a non-negative integer');
  if (!Number.isInteger(restoredCount) || restoredCount < 0) errors.push('restoredDocumentCount must be a non-negative integer');
  if (sourceCount !== restoredCount) errors.push('restored document count does not match source');
  if (!Array.isArray(integrity?.sampledChecksums) || integrity.sampledChecksums.length === 0) errors.push('at least one sampled checksum is required');
  for (const sample of integrity?.sampledChecksums ?? []) {
    if (!sample.path?.trim()) errors.push('checksum path is required');
    if (!/^[0-9a-f]{64}$/.test(sample.sourceSha256) || !/^[0-9a-f]{64}$/.test(sample.restoredSha256)) errors.push('checksums must be lowercase SHA-256');
    else if (sample.sourceSha256 !== sample.restoredSha256) errors.push('checksum mismatch: ' + sample.path);
  }

  if (evidence.smokeTests?.api !== 'passed') errors.push('API smoke test must pass');
  if (evidence.smokeTests?.rules !== 'passed') errors.push('Rules smoke test must pass');
  if (evidence.smokeTests?.playwright !== 'passed') errors.push('Playwright smoke test must pass');

  if (evidence.environment === 'production' && !evidence.rollbackEvidence) errors.push('production recovery evidence requires rollback evidence');
  if (evidence.rollbackEvidence) {
    if (evidence.rollbackEvidence.trafficPercent !== 100) errors.push('rollback evidence must show 100% traffic switch');
    if (evidence.rollbackEvidence.health !== 'passed') errors.push('rollback health check must pass');
    if (evidence.rollbackEvidence.readiness !== 'passed') errors.push('rollback readiness check must pass');
    if (!/^[a-z][a-z0-9-]{0,62}$/.test(evidence.rollbackEvidence.targetRevision)) errors.push('rollback targetRevision must be a valid Cloud Run revision');
    if (!/^ghcr\.io\/[a-z0-9][a-z0-9._-]*\/klar-app@sha256:[0-9a-f]{64}$/.test(evidence.rollbackEvidence.targetImage)) errors.push('rollback targetImage must be an immutable GHCR klar-app digest');
  }

  return { passed: errors.length === 0, errors };
}
