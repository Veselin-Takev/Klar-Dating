import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const files = readdirSync('tests/enterprise').filter(name => name.endsWith('.spec.ts')).sort();
const nodeFiles = files.filter(name => {
  const source = readFileSync('tests/enterprise/' + name, 'utf8');
  if (source.includes("from 'node:test'")) return true;
  if (name === 'securityGuardrails.spec.ts' && source.includes("from 'vitest'")) return false;
  throw new Error('Unclassified Enterprise test runner: ' + name);
});
if (!nodeFiles.length) throw new Error('No Enterprise Node tests found');
const result = spawnSync(process.execPath, ['--import=tsx', '--test', ...nodeFiles.map(name => 'tests/enterprise/' + name)], {
  stdio: 'inherit', env: { ...process.env, CONSENT_AUDIT_SECRET: 'enterprise-test-only-consent-secret-not-production' },
});
process.exitCode = result.status ?? 1;
