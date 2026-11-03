import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';

// Exercise the complete verifier with controlled I/O; no network or package install.
const source = fs.readFileSync(new URL('./verify-lock-refresh.mjs', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '');
const revision = 'a'.repeat(40);
const manifest = '{"dependencies":{"fixture":"1.0.0"}}';
const lock = '{"packages":{"hono":["hono@4.13.16"],"ip-address":["ip-address@10.7.5"]}}';
function execute(overrides = {}) {
  const files = {
    'package.json': manifest, 'phase2_work/package.json': manifest,
    'bun.lock': lock, 'phase2_work/bun.lock': lock, ...overrides.files,
  };
  const outputs = new Map();
  const execFileSync = (command, args) => {
    if (command === 'bun' && args.join(' ') === '--version') return overrides.bun ?? '1.4.4';
    assert.equal(command, 'git');
    if (args[0] === 'diff') return overrides.changed ?? 'bun.lock\nphase2_work/bun.lock\n';
    if (args[0] === 'rev-parse') return overrides.checkout ?? revision;
    if (args[0] === 'show') return Buffer.from(args[1].endsWith('package.json') ? manifest : 'original lock');
    throw new Error('Unexpected subprocess');
  };
  let error;
  try {
    vm.runInNewContext(source, {
      fs: { readFileSync: file => files[file], writeFileSync: (file, data) => outputs.set(file, data) },
      crypto, assert, execFileSync,
      process: { env: { SOURCE_HEAD: revision, ...overrides.env }, version: overrides.node ?? 'v22.23.3' },
      console: { log() {} },
    }, { filename: 'verify-lock-refresh.mjs', timeout: 1000 });
  } catch (failure) { error = failure; }
  return { error, outputs };
}

test('writes source-bound evidence, exact targets and hashes for a valid candidate', () => {
  const { error, outputs } = execute();
  assert.ifError(error);
  assert.equal(outputs.size, 1);
  const evidence = JSON.parse(outputs.get('lock-refresh-evidence.json'));
  assert.equal(evidence.sourceHead, revision);
  assert.equal(evidence.checkoutCommit, revision);
  assert.deepEqual(evidence.target.packages, { hono: '4.13.16', 'ip-address': '10.7.5' });
  assert.equal(evidence.hashes['bun.lock'].candidate, crypto.createHash('sha256').update(lock).digest('hex'));
  assert.notEqual(evidence.hashes['bun.lock'].before, evidence.hashes['bun.lock'].candidate);
});

for (const [name, overrides, expected] of [
  ['missing revision', { env: { SOURCE_HEAD: undefined } }, /Missing exact PR source revision/],
  ['malformed revision', { env: { SOURCE_HEAD: 'main' } }, /Missing exact PR source revision/],
  ['different checkout', { checkout: 'b'.repeat(40) }, /must match workflow_dispatch checkout/],
  ['empty diff', { changed: '' }, /Unexpected generated change scope/],
  ['unexpected changed file', { changed: 'bun.lock\n.env\n' }, /Unexpected generated change scope/],
  ['root manifest mutation', { files: { 'package.json': '{"dependencies":{}}' } }, /must not change manifest/],
  ['app manifest mutation', { files: { 'phase2_work/package.json': '{"dependencies":{}}' } }, /must not change manifest/],
  ['missing Hono', { files: { 'bun.lock': lock.replace('hono@4.13.16', 'other@4.13.16') } }, /Reviewed hono/],
  ['older nested Hono', { files: { 'bun.lock': lock + '\n["hono@4.13.8"]' } }, /Reviewed hono/],
  ['new unreviewed Hono', { files: { 'bun.lock': lock.replace('4.13.16', '4.13.17') } }, /Reviewed hono/],
  ['older nested ip-address', { files: { 'phase2_work/bun.lock': lock + '\n["ip-address@10.7.2"]' } }, /Reviewed ip-address/],
  ['missing app target', { files: { 'phase2_work/bun.lock': '{"packages":{}}' } }, /Reviewed hono/],
  ['wrong Node version', { node: 'v24.22.1' }, /v22\.23\.3/],
  ['wrong Bun version', { bun: '1.4.5' }, /1\.4\.4/],
]) {
  test(`rejects ${name} without writing evidence`, () => {
    const { error, outputs } = execute(overrides);
    assert.ok(error, 'Invalid candidate was accepted');
    assert.match(error.message, expected);
    assert.equal(outputs.size, 0);
  });
}
