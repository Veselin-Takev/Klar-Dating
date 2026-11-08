import { readFileSync } from 'node:fs';
const files = ['deploy/templates/cloud-run.json', 'deploy/templates/service.json'];
const report = [];
for (const path of files) {
  const value = JSON.parse(readFileSync(path, 'utf8'));
  if (value.kind !== 'Service') throw new Error('Unexpected deployment manifest kind');
  const identity = value.spec?.template?.spec?.serviceAccountName ?? null;
  report.push({path, serviceAccountName: identity, effectiveIamBindings: 'NOT_IN_REPOSITORY'});
}
const documentation = readFileSync('../docs/security/IAM_AND_ADMIN_BOUNDARIES.md','utf8');
if (!documentation.includes('serviceAccountName is absent from both Cloud Run source templates')) {
  throw new Error('IAM documentation must explicitly record the missing static runtime identities');
}
if (report.some(row => row.serviceAccountName !== null)) throw new Error('IAM static identity changed; review/update boundary documentation');
console.log(JSON.stringify({documentationMatchesSources: true, certification:'BLOCKED_NO_EXPLICIT_IDENTITIES_OR_BINDINGS', manifests: report},null,2));
if (process.argv.includes('--certify')) process.exitCode = 1;
