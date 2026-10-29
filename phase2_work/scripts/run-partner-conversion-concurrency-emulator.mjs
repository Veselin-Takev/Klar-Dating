#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const config = JSON.parse(readFileSync('firebase.pruefung.json', 'utf8'));
const endpoint = process.env.FIRESTORE_EMULATOR_HOST ?? '';
const parsed = /^(localhost|127\.0\.0\.1|\[::1\]):([0-9]{1,5})$/.exec(endpoint);
const ids = [process.env.GCLOUD_PROJECT, process.env.GOOGLE_CLOUD_PROJECT, process.env.FIREBASE_PROJECT_ID].filter(Boolean);
const expectedProject = 'demo-klar';
if (!parsed || Number(parsed[2]) !== config.emulators.firestore.port
  || ids.some(id => id !== expectedProject) || process.env.NODE_ENV === 'production'
  || process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK === 'true') {
  console.error('Partner conversion concurrency requires local demo-klar Firestore emulator; fail closed.');
  process.exitCode = 2;
} else {
  const result = spawnSync(process.execPath, [
    resolve('node_modules/vitest/vitest.mjs'), 'run',
    'tests/partnerConversionConcurrencyEmulator.spec.ts', '--maxWorkers=1', '--minWorkers=1',
  ], { cwd: process.cwd(), stdio: 'inherit', timeout: 180000,
    env: { ...process.env, GCLOUD_PROJECT: 'demo-klar', GOOGLE_CLOUD_PROJECT: 'demo-klar',
      KLAR_REQUIRE_FIRESTORE_EMULATOR: '1', KLAR_RUN_PARTNER_CONVERSION_EMULATOR: '1' } });
  process.exitCode = result.status ?? 1;
  if (result.error) console.error(result.error.message);
}
