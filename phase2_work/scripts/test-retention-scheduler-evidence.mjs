#!/usr/bin/env node
// Fully offline fixture tests. No gcloud calls, cloud mutations or customer data.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const script = fileURLToPath(new URL('./check-retention-scheduler-evidence.mjs', import.meta.url));
const project = 'klar-staging-test';
const region = 'europe-west3';
const functionNames = ['deleteExpiredPhotosCron', 'purgeVerificationStorageCron'];
const functions = functionNames.map(name => ({
  name: `projects/${project}/locations/${region}/functions/${name}`,
  state: 'ACTIVE',
}));
const jobs = functionNames.map((name, i) => ({
  name: `projects/${project}/locations/${region}/jobs/firebase-schedule-${name}-${region}`,
  state: 'ENABLED',
  schedule: i === 0 ? 'every 24 hours' : '0 3 * * *',
  timeZone: 'UTC',
}));
const run = (functionRecords, jobRecords, extra = []) => {
  const dir = mkdtempSync(join(tmpdir(), 'klar-scheduler-evidence-'));
  try {
    const functionFile = join(dir, 'functions.json');
    const jobFile = join(dir, 'jobs.json');
    writeFileSync(functionFile, JSON.stringify(functionRecords));
    writeFileSync(jobFile, JSON.stringify(jobRecords));
    return spawnSync(process.execPath, [script, '--functions', functionFile, '--jobs', jobFile,
      '--project', project, '--region', region, ...extra], {
      encoding: 'utf8', timeout: 10000,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
const okay = run(functions, jobs);
assert.equal(okay.status, 0, okay.stderr);
const summary = JSON.parse(okay.stdout);
assert.equal(summary.result, 'PASS_OFFLINE_METADATA_ONLY');
assert.equal(summary.checkedFunctions, 2);
assert.match(summary.functionsEvidenceSha256, /^[a-f0-9]{64}$/);
const cases = [
  ['missing legacy function', functions.slice(1), jobs],
  ['inactive purge function', functions.map((f, i) => i === 1 ? {...f, state: 'DEPLOYING'} : f), jobs],
  ['duplicate deployed function', [...functions, functions[0]], jobs],
  ['foreign project function', functions.map((f, i) => i === 0
    ? {...f, name: f.name.replace(project, 'wrong-staging')}
    : f), jobs],
  ['missing scheduled job', functions, jobs.slice(0, 1)],
  ['disabled legacy schedule', functions, jobs.map((j, i) => i === 0 ? {...j, state: 'PAUSED'} : j)],
  ['wrong purge schedule', functions, jobs.map((j, i) => i === 1 ? {...j, schedule: '* * * * *'} : j)],
  ['wrong timezone', functions, jobs.map((j, i) => i === 1 ? {...j, timeZone: 'Europe/Berlin'} : j)],
  ['duplicate scheduler', functions, [...jobs, jobs[0]]],
];
for (const [label, f, j] of cases) {
  const result = run(f, j);
  assert.notEqual(result.status, 0, 'Unsafe evidence accepted: ' + label);
  assert.equal(result.stdout, '', 'Unsafe evidence printed PASS: ' + label);
}
assert.notEqual(run(functions, jobs, ['--extra', 'unsafe']).status, 0);
assert.notEqual(run({wrong: true}, jobs).status, 0);
console.log('PASS: offline retention scheduler evidence verifier accepts approved metadata and rejects 11 unsafe fixtures.');
