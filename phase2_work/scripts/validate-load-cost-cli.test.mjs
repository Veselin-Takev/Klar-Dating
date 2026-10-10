import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'validate-load-cost-evidence.ts'), 'utf8');

test('CLI requires independently trusted environment, hosts, dates and budget', () => {
  for (const name of [
    'KLAR_EVIDENCE_ENVIRONMENT',
    'KLAR_APPROVED_EVIDENCE_HOSTS',
    'KLAR_EVIDENCE_NOT_BEFORE',
    'KLAR_EVIDENCE_NOT_AFTER',
    'KLAR_APPROVED_MAX_COST_PER_1000_REQUESTS_USD',
  ]) {
    assert.ok(source.includes(`required('${name}')`), `${name} must come from explicit operator environment`);
  }
  assert.match(source, /environment !== 'production' && environment !== 'staging'/);
  assert.match(source, /!Number\.isFinite\(budget\) \|\| budget <= 0/);
});

test('CLI forwards all eight validator arguments in order', () => {
  assert.match(source, /validateProductionLoadCostEvidence\(\s*evidence,\s*JSON\.parse\(loadRaw\),\s*expectedBuildSha,\s*policy\.environment,\s*policy\.hosts,\s*policy\.notBefore,\s*policy\.notAfter,\s*policy\.budget,?\s*\)/);
});

test('CLI binds the evaluated load report to the exact evidence record', () => {
  assert.match(source, /resolve\(\(evidence as \{ loadReportPath: string \}\)\.loadReportPath\) !== resolve\(loadReportPath\)/);
  assert.match(source, /\^\[0-9a-f\]\{40\}\$/);
});
