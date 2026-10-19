#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const script = 'scripts/run-art17-partner-emulator.mjs';
const environment = {
  ...process.env,
  FIRESTORE_EMULATOR_HOST: '',
  GCLOUD_PROJECT: 'demo-klar',
  GOOGLE_CLOUD_PROJECT: 'demo-klar',
};
for (const [label, variables] of [
  ['absent emulator host', {}],
  ['remote host', { FIRESTORE_EMULATOR_HOST: 'example.com:8085' }],
  ['production-like host', { FIRESTORE_EMULATOR_HOST: 'firestore.googleapis.com:8085' }],
  ['wrong emulator port', { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' }],
  ['invalid emulator project', { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085', GCLOUD_PROJECT: 'production-app' }],
  ['invalid second project', { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085', GOOGLE_CLOUD_PROJECT: 'production-app' }],
  ['firebase project disagreement', { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085', FIREBASE_PROJECT_ID: 'production-app' }],
  ['enabled durable fallback', { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085', KLAR_ALLOW_DURABLE_DB_FALLBACK: 'true' }],
  ['production runtime', { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085', NODE_ENV: 'production' }],
]) {
  test(`refuses ${label} before Vitest or Firestore runs`, () => {
    const result = spawnSync(process.execPath, [script], {
      cwd: process.cwd(),
      env: { ...environment, ...variables },
      encoding: 'utf8',
      timeout: 10_000,
    });
    assert.equal(result.status, 2, `${label}: ${result.stdout} ${result.stderr}`);
    assert.match(result.stderr, /Firestore Emulator required/);
  });
}
