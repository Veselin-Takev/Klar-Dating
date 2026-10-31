import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workdir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const execute = () => spawnSync(process.execPath, ['scripts/inventory-tenant-access.mjs'], {
  cwd: workdir, encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024,
});
test('tenant candidate inventory is reproducible, bounded and does not expose source snippets', () => {
  const first = execute();
  assert.equal(first.status, 0, first.stderr);
  const second = execute();
  assert.equal(second.status, 0, second.stderr);
  assert.equal(first.stdout, second.stdout, 'nondeterministic inventory');
  const data = JSON.parse(first.stdout);
  assert.equal(data.schema_version, 1);
  assert.deepEqual(data.scope, ['src', 'functions/src', 'server.ts']);
  assert.ok(data.files.length > 0, 'inventory may not silently scan an empty tree');
  const paths = data.files.map(f => f.path);
  assert.equal(new Set(paths).size, paths.length);
  assert.ok(paths.includes('server.ts'), 'Express entrypoint must be included');
  for (const f of data.files) {
    assert.match(f.path, /^(?:src\/|functions\/src\/|server\.ts$)/);
    assert.doesNotMatch(f.path, /\.\.(?:\/|\\)/);
    assert.match(f.sha256, /^[0-9a-f]{64}$/);
    const raw = readFileSync(resolve(workdir, f.path));
    assert.equal(f.sha256, createHash('sha256').update(raw).digest('hex'));
    assert.ok(Array.isArray(f.hits), 'zero-hit source files must remain in inventory');
    for (const hit of f.hits) {
      assert.ok(Number.isSafeInteger(hit.line) && hit.line > 0);
      assert.equal(typeof hit.category, 'string');
      assert.deepEqual(Object.keys(hit).sort(), ['category', 'line']);
    }
    assert.deepEqual(Object.keys(f).sort(), ['categories', 'hits', 'path', 'sha256']);
  }
});
