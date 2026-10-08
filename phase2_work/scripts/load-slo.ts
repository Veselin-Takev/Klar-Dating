import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { deriveLoadSloTargets, evaluateLoadResult, loadTarget, percentile } from '../src/server/platform/loadSlo';

function positiveInteger(name: string, fallback: number, maximum: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(name + ' must be an integer between 1 and ' + maximum);
  }
  return value;
}

function pathsFromEnv(): string[] {
  const raw = process.env.LOAD_TEST_PATHS ?? '/api/health,/api/ready';
  const paths = raw.split(',').map(value => value.trim()).filter(Boolean);
  if (!paths.length || paths.some(path => !path.startsWith('/') || path.startsWith('//'))) {
    throw new Error('LOAD_TEST_PATHS must contain comma-separated absolute paths');
  }
  return paths;
}

const sleep = (ms: number) => new Promise(resolveSleep => setTimeout(resolveSleep, ms));

async function main() {
  const rawTarget = process.env.LOAD_TEST_BASE_URL;
  if (!rawTarget) throw new Error('LOAD_TEST_BASE_URL is required');

  const target = loadTarget(rawTarget, process.env.LOAD_TEST_ALLOW_PRODUCTION === 'true');
  const durationSeconds = positiveInteger('LOAD_TEST_DURATION_SECONDS', 30, 600);
  const requestsPerSecond = positiveInteger('LOAD_TEST_RPS', 10, 200);
  const concurrency = positiveInteger('LOAD_TEST_CONCURRENCY', 5, 50);
  const timeoutMs = positiveInteger('LOAD_TEST_TIMEOUT_MS', 5000, 30000);
  const paths = pathsFromEnv();
  const output = resolve(process.env.LOAD_TEST_OUTPUT ?? 'load-evidence/load-report.json');
  const buildSha = process.env.LOAD_TEST_BUILD_SHA?.trim() ?? null;
  if (buildSha && !/^[0-9a-f]{40}$/.test(buildSha)) {
    throw new Error('LOAD_TEST_BUILD_SHA must be a full 40-character lowercase Git SHA');
  }

  const slo = JSON.parse(await readFile(resolve('ops/slo.json'), 'utf8'));
  const targets = deriveLoadSloTargets(slo);
  const totalPlanned = durationSeconds * requestsPerSecond;
  const intervalMs = 1000 / requestsPerSecond;
  const startedAt = Date.now();
  const active = new Set<Promise<void>>();
  const latencies: number[] = [];
  const statuses: Record<string, number> = {};
  let successful = 0;
  let transportErrors = 0;

  async function request(index: number) {
    const path = paths[index % paths.length]!;
    const url = new URL(path, target);
    const started = performance.now();
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'user-agent': 'klar-staging-load-slo/1.0' },
      });
      latencies.push(performance.now() - started);
      statuses[String(response.status)] = (statuses[String(response.status)] ?? 0) + 1;
      if (response.ok) successful += 1;
      await response.body?.cancel();
    } catch {
      latencies.push(performance.now() - started);
      transportErrors += 1;
      statuses.transport_error = (statuses.transport_error ?? 0) + 1;
    }
  }

  for (let index = 0; index < totalPlanned; index += 1) {
    const scheduledAt = startedAt + index * intervalMs;
    const delay = scheduledAt - Date.now();
    if (delay > 0) await sleep(delay);
    while (active.size >= concurrency) await Promise.race(active);
    let promise: Promise<void>;
    promise = request(index).finally(() => active.delete(promise));
    active.add(promise);
  }
  await Promise.all(active);

  const total = latencies.length;
  const p50LatencyMs = percentile(latencies, 0.50);
  const p95LatencyMs = percentile(latencies, 0.95);
  const p99LatencyMs = percentile(latencies, 0.99);
  const evaluation = evaluateLoadResult(total, successful, p95LatencyMs, targets);
  const finishedAt = Date.now();
  const report = {
    schemaVersion: 1,
    generatedAt: new Date(finishedAt).toISOString(),
    buildSha,
    target: { origin: target.origin, paths },
    workload: { durationSeconds, requestsPerSecond, concurrency, timeoutMs, totalPlanned },
    measurements: {
      total, successful, transportErrors, statuses,
      availability: evaluation.availability,
      p50LatencyMs: Math.round(p50LatencyMs * 100) / 100,
      p95LatencyMs: Math.round(p95LatencyMs * 100) / 100,
      p99LatencyMs: Math.round(p99LatencyMs * 100) / 100,
      elapsedMs: finishedAt - startedAt,
    },
    thresholds: { source: 'ops/slo.json', availability: targets.availability, p95LatencyMs: targets.p95LatencyMs },
    verdict: { availabilityPass: evaluation.availabilityPass, latencyPass: evaluation.latencyPass, passed: evaluation.passed },
    limitations: [
      'Synthetic GET baseline only; it does not prove authenticated journey latency or provider latency.',
      'This report does not establish production unit cost; correlate with Cloud Run, Firestore and provider billing metrics.',
      'A production target requires explicit LOAD_TEST_ALLOW_PRODUCTION=true and an approved exercise.',
    ],
  };

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 2));
  if (!evaluation.passed) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
});
