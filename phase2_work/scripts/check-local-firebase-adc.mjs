#!/usr/bin/env node
// Local-only Firebase Admin preflight. Never read or print credential file contents.
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, isAbsolute } from 'node:path';

export function inspectFirebaseCredentials(env, options = {}) {
  const exists = options.exists ?? existsSync;
  const home = options.home ?? homedir();
  const emulatorKeys = ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST'];
  const configured = emulatorKeys.filter(key => Boolean(env[key]?.trim()));
  const projectId = env.GCLOUD_PROJECT || env.GOOGLE_CLOUD_PROJECT;
  const issues = [];
  if (configured.length) {
    if (!configured.every(key => /^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(env[key]))) {
      issues.push('Emulator hosts must be local loopback host:port values.');
    }
    if (projectId && !projectId.startsWith('demo-')) {
      issues.push('Emulator mode must use a demo- project ID.');
    }
    if (configured.length !== emulatorKeys.length) {
      issues.push('Both Firestore and Auth emulators must be configured for local app development.');
    }
    return { mode: 'emulator', ok: issues.length === 0, issues };
  }

  const explicit = env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (explicit) {
    if (!isAbsolute(explicit) || !exists(explicit)) {
      issues.push('GOOGLE_APPLICATION_CREDENTIALS must point to an existing absolute local file path.');
    }
    return { mode: 'google-cloud', ok: issues.length === 0, issues };
  }

  const adcPath = process.platform === 'win32'
    ? join(env.APPDATA || join(home, 'AppData', 'Roaming'), 'gcloud', 'application_default_credentials.json')
    : join(env.CLOUDSDK_CONFIG || join(home, '.config', 'gcloud'), 'application_default_credentials.json');
  if (!exists(adcPath)) {
    issues.push('No local Application Default Credentials file found. For development, use Firebase emulators. For authorized cloud access, run gcloud auth application-default login.');
  }
  // In managed GCP runtimes ADC can be supplied by metadata without a local file.
  if (env.K_SERVICE || env.GAE_SERVICE || env.FUNCTION_TARGET) {
    return { mode: 'managed-google-cloud', ok: true, issues: [] };
  }
  return { mode: 'google-cloud', ok: issues.length === 0, issues };
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1].replace(/\\/g, '/')).href) {
  const result = inspectFirebaseCredentials(process.env);
  console.log('Firebase credential preflight:', result.mode, result.ok ? 'PASS' : 'FAIL');
  for (const issue of result.issues) console.error('-', issue);
  if (!result.ok) process.exitCode = 1;
}
