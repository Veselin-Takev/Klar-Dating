#!/usr/bin/env node
/**
 * Dedicated fail-closed real Firestore Emulator runner. This is for the
 * native transaction/replay spec only, not a production/staging assertion.
 * npm test:ci also runs the same spec under its standard local emulator.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const configuredPort = JSON.parse(readFileSync('firebase.pruefung.json', 'utf8'))?.emulators?.firestore?.port;
const host = process.env.FIRESTORE_EMULATOR_HOST ?? '';
const match = /^(?:localhost|127\.0\.0\.1|\[::1\]):(\d{1,5})$/.exec(host);
const projectIds = [
  process.env.GCLOUD_PROJECT,
  process.env.GOOGLE_CLOUD_PROJECT,
  process.env.FIREBASE_PROJECT_ID,
].filter(Boolean);
if (!match || Number(match[1]) !== configuredPort ||
    projectIds.some(project => project !== 'demo-klar') ||
    process.env.NODE_ENV === 'production' ||
    process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK === 'true') {
  console.error('Refusing partner conversion tests without local approved Firestore emulator and demo-klar project.');
  process.exitCode = 2;
} else {
  const result = spawnSync(process.execPath, [
    resolve('node_modules/vitest/vitest.mjs'), 'run',
    'tests/partnerConversionFirestoreEmulator.spec.ts',
    '--maxWorkers=1', '--minWorkers=1',
  ], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      GCLOUD_PROJECT: 'demo-klar',
      GOOGLE_CLOUD_PROJECT: 'demo-klar',
      KLAR_REQUIRE_FIRESTORE_EMULATOR: '1',
    },
    timeout: 240000,
  });
  if (result.error) console.error('Partner conversion emulator runner failed:', result.error.message);
  process.exitCode = result.status ?? 1;
}
