#!/usr/bin/env node
// Offline-only validator for saved Cloud Functions v2 and Cloud Scheduler JSON.
// It never invokes gcloud or reaches a cloud service; it does not verify code revisions.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

function argumentsMap(args) {
  assert.equal(args.length, 8, 'Required: --functions FILE --jobs FILE --project ID --region REGION');
  const allowed = new Set(['--functions', '--jobs', '--project', '--region']);
  const values = new Map();
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    assert(allowed.has(key) && !values.has(key), 'Unknown/duplicate argument: ' + key);
    assert(args[i + 1] && !args[i + 1].startsWith('--'), 'Missing value for ' + key);
    values.set(key, args[i + 1]);
  }
  assert.equal(values.size, 4, 'All four required flags must be supplied');
  return values;
}
const opts = argumentsMap(process.argv.slice(2));
const project = opts.get('--project');
const region = opts.get('--region');
assert(/^[a-z][a-z0-9-]{4,62}$/.test(project), 'Invalid project ID');
assert(/^[a-z]+-[a-z]+[0-9]+$/.test(region), 'Invalid GCP region');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const readEvidence = key => {
  const bytes = readFileSync(opts.get(key));
  assert(bytes.length < 2_000_000, 'Unbounded evidence input rejected');
  const parsed = JSON.parse(bytes.toString('utf8'));
  assert(Array.isArray(parsed), 'Expected a JSON array in ' + key);
  return { data: parsed, sha256: digest(bytes) };
};
const funcs = readEvidence('--functions');
const jobs = readEvidence('--jobs');
const expected = ['deleteExpiredPhotosCron', 'purgeVerificationStorageCron'];
const expectedFunction = name => `projects/${project}/locations/${region}/functions/${name}`;
const expectedJob = name => `projects/${project}/locations/${region}/jobs/firebase-schedule-${name}-${region}`;
const byName = (records, label) => {
  const result = new Map();
  for (const item of records) {
    assert(item && typeof item === 'object' && !Array.isArray(item)
      && typeof item.name === 'string', 'Malformed ' + label + ' entry');
    assert(!result.has(item.name), 'Duplicate ' + label + ': ' + item.name);
    result.set(item.name, item);
  }
  return result;
};
const functions = byName(funcs.data, 'function');
const schedulers = byName(jobs.data, 'scheduler');
for (const name of expected) {
  const fn = functions.get(expectedFunction(name));
  const job = schedulers.get(expectedJob(name));
  assert(fn, 'Missing deployed function: ' + name);
  assert.equal(fn.state, 'ACTIVE', 'Function is not ACTIVE: ' + name);
  assert(job, 'Missing scheduler job for function: ' + name);
  assert.equal(job.state, 'ENABLED', 'Scheduler job is not ENABLED: ' + name);
  assert(typeof job.schedule === 'string' && job.schedule.length > 0, 'Missing job schedule: ' + name);
  assert.equal(job.timeZone, 'UTC', 'Unexpected scheduler timezone: ' + name);
  // Names alone are not execution evidence: compare actual HTTPS target with
  // the deployed Cloud Functions v2 service URI, reject unauthenticated jobs.
  const normalizeTarget = (raw, field) => {
    assert(typeof raw === 'string' && raw.length < 2048, 'Missing/invalid ' + field);
    const parsed = new URL(raw);
    assert(parsed.protocol === 'https:' && !parsed.username && !parsed.password
      && !parsed.port && !parsed.search && !parsed.hash, 'Unsafe ' + field);
    return parsed.origin + parsed.pathname.replace(/\\/$/, '');
  };
  assert.equal(
    normalizeTarget(job.httpTarget?.uri, 'Scheduler target URI'),
    normalizeTarget(fn.serviceConfig?.uri, 'deployed function URI'),
    'Scheduler target does not match deployed function: ' + name,
  );
  assert.equal(job.httpTarget?.httpMethod, 'POST', 'Scheduler HTTP method is not POST: ' + name);
  const identity = job.httpTarget?.oidcToken?.serviceAccountEmail;
  assert(typeof identity === 'string'
    && /^[a-z0-9][a-z0-9._-]*@[a-z0-9.-]+\\.gserviceaccount\\.com$/.test(identity),
    'Missing/invalid Scheduler OIDC identity: ' + name);
  const audience = job.httpTarget.oidcToken.audience;
  if (audience !== undefined && audience !== '') {
    assert.equal(normalizeTarget(audience, 'OIDC audience'),
      normalizeTarget(job.httpTarget.uri, 'Scheduler target URI'),
      'Scheduler OIDC audience mismatch: ' + name);
  }
}
const purge = schedulers.get(expectedJob('purgeVerificationStorageCron'));
assert.equal(purge.schedule, '0 3 * * *', 'Decision-based purge schedule drift');
const summary = {
  result: 'PASS_OFFLINE_METADATA_ONLY',
  project, region,
  checkedFunctions: expected.length,
  otherSchedulerJobs: jobs.data.length - expected.length,
  functionsEvidenceSha256: funcs.sha256,
  schedulerEvidenceSha256: jobs.sha256,
  limits: 'No proof of deployed source SHA, Scheduler target/identity, IAM, live behavior, TTL ACTIVE, or Security/DPO approval',
};
process.stdout.write(JSON.stringify(summary) + '\n');
