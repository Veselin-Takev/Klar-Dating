import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function analyzeJobs(input) {
  const jobs = Array.isArray(input) ? input : input?.jobs;
  if (!Array.isArray(jobs) || jobs.length === 0) throw new Error('Expected a non-empty GitHub jobs array.');
  const results = [];
  for (const job of jobs) {
    if (!Array.isArray(job.steps)) throw new Error('Each job requires a steps array.');
    for (const step of job.steps) {
      if (!step.started_at && !step.completed_at) {
        if (step.conclusion === 'skipped') continue;
        throw new Error('Missing step timestamps.');
      }
      if (!step.started_at || !step.completed_at) throw new Error('Incomplete step timestamps.');
      const start = Date.parse(step.started_at);
      const end = Date.parse(step.completed_at);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
        throw new Error(`Invalid timestamps for ${String(step.name)}`);
      }
      results.push({ job: String(job.name ?? 'unknown'), step: String(step.name ?? 'unknown'), seconds: Math.round((end - start) / 1000), status: String(step.conclusion ?? 'unknown') });
    }
  }
  if (results.length === 0) throw new Error('No completed steps available for duration analysis.');
  results.sort((a, b) => b.seconds - a.seconds || a.step.localeCompare(b.step));
  return { measuredSteps: results.length, totalStepSeconds: results.reduce((sum, x) => sum + x.seconds, 0), slowest: results.slice(0, 12) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node scripts/analyze-ci-duration.mjs path/to/github-jobs.json');
    const output = analyzeJobs(JSON.parse(readFileSync(resolve(process.argv[2]), 'utf8')));
    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
