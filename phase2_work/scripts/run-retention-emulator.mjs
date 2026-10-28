#!/usr/bin/env node
/**
 * A-15 mandatory, isolated Firestore Emulator proof.
 * Never silently skip, run against a live project, or use durable fallback.
 * CI mounts local demo-klar Firestore before this process.
 */
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const config = JSON.parse(readFileSync('firebase.pruefung.json', 'utf8'));
const requiredPort = config?.emulators?.firestore?.port;
const host = process.env.FIRESTORE_EMULATOR_HOST ?? '';
const match = /^(127\.0\.0\.1|localhost|\[::1\]):([0-9]{1,5})$/.exec(host);
const project = 'demo-klar';
const projects = ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT', 'FIREBASE_PROJECT_ID']
  .map(key => process.env[key]).filter(Boolean);

if (!Number.isSafeInteger(requiredPort) || !match
    || Number(match[2]) !== requiredPort || projects.some(value => value !== project)
    || process.env.NODE_ENV === 'production'
    || process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK === 'true') {
  console.error('A-15 retention Firestore Emulator required: loopback endpoint + demo-klar; refusing skip or production.');
  process.exitCode = 2;
} else {
  const vitest = resolve('node_modules/vitest/vitest.mjs');
  if (!existsSync(vitest)) {
    console.error('A-15 retention Firestore Emulator required: local Vitest dependencies unavailable.');
    process.exitCode = 2;
  } else {
    const result = spawnSync(process.execPath, [
      vitest, 'run', 'tests/complianceStorageCursorFirestoreEmulator.spec.ts',
      '--maxWorkers=1', '--minWorkers=1',
    ], {
      cwd: process.cwd(),
      stdio: 'inherit',
      timeout: 180_000,
      env: {
        ...process.env, GCLOUD_PROJECT: project, GOOGLE_CLOUD_PROJECT: project,
        FIREBASE_PROJECT_ID: project, KLAR_REQUIRE_FIRESTORE_EMULATOR: '1',
      },
    });
    if (result.error) console.error('A-15 Firestore Emulator invocation error:', result.error.message);
    process.exitCode = result.status ?? 1;
  }
}
