import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dualP0GateFailures } from './check-dual-p0-gates.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baseline = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const cloned = () => structuredClone(baseline);

test('combined source-only tenant and retention enterprise gates pass', () => {
  assert.deepEqual(dualP0GateFailures(baseline), []);
});
for (const [label, mutate] of [
  ['tenant inventory command missing', p => { delete p.scripts['check:tenant-inventory']; }],
  ['storage review marker check missing', p => { delete p.scripts['check:storage-tenant-risk']; }],
  ['storage marker review omitted from enterprise', p => { p.scripts['check:enterprise']=p.scripts['check:enterprise'].replace('npm run check:storage-tenant-risk && ', ''); }],
  ['tenant Firestore/Storage rules evidence missing', p => { delete p.scripts['check:tenant-rules-surfaces']; }],
  ['tenant rules evidence skipped by enterprise', p => { p.scripts['check:enterprise'] = p.scripts['check:enterprise'].replace('npm run check:tenant-rules-surfaces && ', ''); }],
  ['retention generation/decision gate missing', p => { delete p.scripts['check:compliance-storage-purge']; }],
  ['legacy photo cron gate missing', p => { delete p.scripts['check:legacy-photo-purge']; }],
  ['bounded backlog gate missing', p => { delete p.scripts['check:retention-census-safety']; }],
  ['lease prototype inert gate missing', p => { delete p.scripts['check:purge-work-inert']; }],
  ['tenant enterprise invocation removed', p => { p.scripts['check:enterprise'] =
    p.scripts['check:enterprise'].replace('npm run check:tenant-inventory && ', ''); }],
  ['retention enterprise invocation removed', p => { p.scripts['check:enterprise'] =
    p.scripts['check:enterprise'].replace('npm run check:purge-work-inert && ', ''); }],
  ['tenant invocation disguised by a prefix', p => { p.scripts['check:enterprise'] =
    p.scripts['check:enterprise'].replace('npm run check:tenant-inventory', 'npm run check:tenant-inventory-ignored'); }],
  ['duplicate tenant checks', p => { p.scripts['check:enterprise'] =
    p.scripts['check:enterprise'].replace('npm run check:tenant-inventory && ',
      'npm run check:tenant-inventory && npm run check:tenant-inventory && '); }],
  ['missing integration regression gate itself', p => { p.scripts['check:enterprise'] =
    p.scripts['check:enterprise'].replace('npm run check:dual-p0-integration && ', ''); }],
  ['tenant inventory moved after retention', p => { p.scripts['check:enterprise'] =
    p.scripts['check:enterprise'].replace('npm run check:tenant-inventory && ', '')
      + ' && npm run check:tenant-inventory'; }],
  ['tenant classifier regression omitted', p => { p.scripts['check:tenant-inventory'] =
    'node --test scripts/inventory-tenant-access.test.mjs'; }],
]) {
  test('rejects silent P0 gate regression: ' + label, () => {
    const pkg = cloned();
    mutate(pkg);
    assert.notDeepEqual(dualP0GateFailures(pkg), []);
  });
}
