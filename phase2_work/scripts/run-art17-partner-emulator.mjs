#!/usr/bin/env node
/**
 * Fail closed unless firebase emulators:exec has provided an actual local
 * Firestore Emulator endpoint. This dedicated command must NEVER report PASS
 * simply because Vitest skipped every Emulator scenario.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const configuration = JSON.parse(readFileSync('firebase.pruefung.json', 'utf8'));
const requiredPort = configuration?.emulators?.firestore?.port;
const host = process.env.FIRESTORE_EMULATOR_HOST ?? '';
const parsedHost = /^(localhost|127\.0\.0\.1|\[::1\]):([0-9]{1,5})$/.exec(host);
const project = 'demo-klar';
const projects = [process.env.GCLOUD_PROJECT, process.env.GOOGLE_CLOUD_PROJECT, process.env.FIREBASE_PROJECT_ID].filter(Boolean);

if (!Number.isSafeInteger(requiredPort) || requiredPort < 1 || requiredPort > 65535
  || !parsedHost || Number(parsedHost[2]) !== requiredPort
  || projects.some(value => value !== project)
  || process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK === 'true'
  || process.env.NODE_ENV === 'production') {
  console.error('Art. 17 Firestore Emulator required: local host at configured port and project demo-klar; refusing to skip or contact production.');
  process.exitCode = 2;
} else {
  const result = spawnSync(process.execPath, [
    resolve('node_modules/vitest/vitest.mjs'),
    'run',
    'tests/partnerReferralDeletionEmulator.spec.ts',
    '--maxWorkers=1',
    '--minWorkers=1',
  ], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: { ...process.env, GCLOUD_PROJECT: project, GOOGLE_CLOUD_PROJECT: project, KLAR_REQUIRE_FIRESTORE_EMULATOR: '1' },
    timeout: 180000,
  });
  process.exitCode = result.status ?? 1;
  if (result.error) console.error('Art. 17 Firestore Emulator command failed:', result.error.message);
}
