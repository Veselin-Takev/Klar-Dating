import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REQUIRED_STEPS = [
  'Scope regression tests', 'Runtime policy preflight', 'Release policy regression tests',
  'Dependency lock preflight', 'Install dependencies', 'Enterprise static gates',
  'Typecheck', 'Functions build', 'Tests', 'Build', 'Production smoke', 'Browser acceptance',
];
const positiveId = value => Number.isSafeInteger(value) && value > 0;

export function validateRun(run, repository, sha) {
  if (!positiveId(run?.id) || !positiveId(run.run_attempt) ||
      run.head_sha !== sha || run.head_branch !== 'main' || run.event !== 'push' ||
      run.path !== '.github/workflows/ci.yml' ||
      run.repository?.full_name?.toLowerCase() !== repository.toLowerCase() ||
      run.head_repository?.full_name?.toLowerCase() !== repository.toLowerCase() ||
      run.status !== 'completed' || run.conclusion !== 'success') {
    throw new Error('Exact-commit main CI is missing, incomplete, unsuccessful or has invalid identity');
  }
}

export function validateJobs(jobs, run) {
  const validation = jobs.filter(job => job.name === 'validate');
  if (validation.length !== 1) throw new Error('Expected exactly one validate job');
  const job = validation[0];
  if (!positiveId(job.id) || job.run_id !== run.id || job.run_attempt !== run.run_attempt ||
      job.head_sha !== run.head_sha || job.status !== 'completed' || job.conclusion !== 'success') {
    throw new Error('Validation job identity or conclusion is invalid');
  }
  for (const name of REQUIRED_STEPS) {
    const steps = (job.steps ?? []).filter(step => step.name === name);
    if (steps.length !== 1 || steps[0].status !== 'completed' || steps[0].conclusion !== 'success') {
      throw new Error(`Required CI step did not pass: ${name}`);
    }
  }
  return job;
}

// Only GitHub's fixed API origin receives the workflow token; redirects are rejected.
export async function verifyReleaseCi({ repository, sha, token, fetcher = fetch }) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? '') ||
      !/^[a-f0-9]{40}$/.test(sha ?? '') || !token) throw new Error('Missing or invalid release CI inputs');
  const base = `https://api.github.com/repos/${repository}/actions`;
  async function get(path) {
    const response = await fetcher(`${base}/${path}`, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2026-03-10' },
      redirect: 'error', signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`GitHub CI evidence unavailable (HTTP ${response.status})`);
    return response.json();
  }
  async function list(path, key) {
    const items = [];
    for (let page = 1; page <= 10; page++) {
      const result = await get(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
      if (!Array.isArray(result[key]) || !Number.isSafeInteger(result.total_count) || result.total_count < 0) {
        throw new Error('Malformed GitHub evidence list');
      }
      items.push(...result[key]);
      if (items.length === result.total_count) return items;
      if (items.length > result.total_count || result[key].length === 0) throw new Error('Inconsistent GitHub evidence pagination');
    }
    throw new Error('GitHub evidence exceeds bounded pagination');
  }
  // Do not filter by success: an older success must never hide a newer failed/in-progress run.
  const runs = await list(`workflows/ci.yml/runs?head_sha=${sha}&event=push&branch=main`, 'workflow_runs');
  if (!runs.length || runs.some(run => !positiveId(run.id))) throw new Error('No valid exact-commit CI run');
  const latest = [...runs].sort((a, b) => b.id - a.id)[0];
  const run = await get(`runs/${latest.id}`);
  if (run.id !== latest.id) throw new Error('CI run changed identity');
  validateRun(run, repository, sha);
  const jobs = await list(`runs/${run.id}/attempts/${run.run_attempt}/jobs`, 'jobs');
  const job = validateJobs(jobs, run);
  // Catch a rerun starting while job evidence is being read.
  const confirmed = await get(`runs/${run.id}`);
  validateRun(confirmed, repository, sha);
  if (confirmed.id !== run.id || confirmed.run_attempt !== run.run_attempt) throw new Error('CI attempt changed during verification');
  return { schemaVersion: 1, buildSha: sha, repository, runId: run.id, runAttempt: run.run_attempt,
    jobId: job.id, verifiedAt: new Date().toISOString(),
    evidenceUrl: `https://github.com/${repository}/actions/runs/${run.id}`, requiredSteps: REQUIRED_STEPS };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { GITHUB_SHA: sha, GITHUB_REF: ref, GITHUB_REPOSITORY: repository, GITHUB_TOKEN: token } = process.env;
    if (!/^refs\/tags\/v\d+\.\d+\.\d+$/.test(ref ?? '')) throw new Error('A version tag is required');
    const rev = name => execFileSync('git', ['rev-parse', '--verify', name], { encoding: 'utf8' }).trim();
    if (rev('HEAD') !== sha || rev(`${ref}^{commit}`) !== sha) throw new Error('Checkout, tag and release SHA must agree');
    const evidence = await verifyReleaseCi({ repository, sha, token });
    mkdirSync('release', { recursive: true });
    writeFileSync('release/ci-validation.json', JSON.stringify(evidence, null, 2) + '\n');
    console.log(`Release CI verification PASS: run ${evidence.runId}, attempt ${evidence.runAttempt}`);
  } catch {
    // Never echo tokens, provider bodies or arbitrary fetch errors.
    console.error('Release CI verification FAILED: require a valid tag/checkout and complete successful exact-commit main CI evidence. Inspect the CI run and Actions read permission.');
    process.exitCode = 1;
  }
}
