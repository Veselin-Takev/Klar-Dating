#!/usr/bin/env node
// Compatibility entrypoint: delegate to the maintained fail-closed source gates.
// No Cloud API calls, gcloud mutation or Firebase deployment.
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const script of [
  'check-retention-matrix.mjs',
  'check-retention-expiry-writers.mjs',
  'check-legacy-photo-purge.mjs',
]) {
  const result = spawnSync(process.execPath, [resolve(root, 'scripts', script)], {
    cwd: root, encoding: 'utf8', timeout: 30_000,
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || 'retention guard failed\n');
    process.exit(result.status || 1);
  }
}
console.log('PASS: retention matrix, expiry writers and disabled legacy photo purge');
