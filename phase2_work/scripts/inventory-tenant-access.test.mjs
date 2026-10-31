import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const workdir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const omitted = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.firebase', 'test-results', 'playwright-report']);
const sourceTypes = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);
function expectedFiles(dir) {
  const files = [];
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (item.isSymbolicLink()) continue;
    const full = join(dir, item.name);
    if (item.isDirectory() && !omitted.has(item.name)) files.push(...expectedFiles(full));
    else if (item.isFile() && sourceTypes.has(extname(item.name))) files.push(relative(workdir, full).replaceAll('\\\\', '/'));
  }
  return files;
}
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
  assert.deepEqual(data.scope, ['src', 'functions/src', 'scripts', 'server.ts']);
  assert.ok(data.files.length > 0, 'inventory may not silently scan an empty tree');
  const paths = data.files.map(f => f.path);
  assert.equal(new Set(paths).size, paths.length);
  for (const required of ['server.ts', 'functions/src/retention.ts', 'scripts/loeschkaskade.mjs', 'scripts/inventory-tenant-access.mjs']) {
    assert.ok(paths.includes(required), `existing critical source omitted: ${required}`);
  }
  // Stacked tenant foundation modules are absent from main-based PRs until upstream is integrated.
  // When a module exists, it MUST be inventoried; absence is not a security PASS.
  for (const pending of ['src/server/multitenant/tenantAuth.ts', 'src/server/multitenant/tenantData.ts']) {
    const present = existsSync(resolve(workdir, pending));
    assert.equal(paths.includes(pending), present, `upstream integration scope drift: ${pending}`);
  }
  assert.deepEqual(paths, [...paths].sort((a, b) => a.localeCompare(b, 'en')), 'noncanonical path order');
  const expected = ['src', 'functions/src', 'scripts']
    .flatMap(dir => expectedFiles(resolve(workdir, dir)));
  expected.push('server.ts');
  expected.sort((a, b) => a.localeCompare(b, 'en'));
  assert.deepEqual(paths, expected, 'every scanned source file, including zero-hit maintenance scripts, must be accounted for');
  for (const f of data.files) {
    assert.match(f.path, /^(?:src\/|functions\/src\/|scripts\/|server\.ts$)/);
    assert.doesNotMatch(f.path, /\.\.(?:\/|\\)/);
    assert.match(f.sha256, /^[0-9a-f]{64}$/);
    const raw = readFileSync(resolve(workdir, f.path));
    assert.equal(f.sha256, createHash('sha256').update(raw).digest('hex'));
    assert.ok(Array.isArray(f.hits), 'zero-hit source files must remain in inventory');
    const lines = raw.toString('utf8').split(/\r?\n/);
    const allowed = new Set(['admin_firestore', 'firestore_client', 'storage_access', 'user_sensitive_path', 'database_mutation']);
    assert.deepEqual(f.categories, [...f.categories].sort());
    for (const hit of f.hits) {
      assert.ok(Number.isSafeInteger(hit.line) && hit.line > 0);
      assert.ok(hit.line <= lines.length, 'hit beyond source line count');
      assert.ok(allowed.has(hit.category), 'unrecognized inventory category');
      assert.ok(f.categories.includes(hit.category));
      assert.deepEqual(Object.keys(hit).sort(), ['category', 'line']);
    }
    assert.deepEqual(Object.keys(f).sort(), ['categories', 'hits', 'path', 'sha256']);
  }
});
