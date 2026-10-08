export type LoadSloTargets = {
  availability: number;
  p95LatencyMs: number;
};

type Objective = { name?: unknown; target?: unknown };

export function deriveLoadSloTargets(config: unknown): LoadSloTargets {
  if (!config || typeof config !== 'object') throw new Error('Invalid SLO config');
  const objectives = (config as { objectives?: unknown }).objectives;
  if (!Array.isArray(objectives)) throw new Error('SLO objectives are missing');

  const findTarget = (name: string): number => {
    const objective = (objectives as Objective[]).find(item => item?.name === name);
    const target = objective?.target;
    if (typeof target !== 'number' || !Number.isFinite(target) || target <= 0) {
      throw new Error('Invalid SLO target: ' + name);
    }
    return target;
  };

  return {
    availability: findTarget('api-availability'),
    p95LatencyMs: findTarget('api-latency-p95-ms'),
  };
}

export function percentile(values: readonly number[], fraction: number): number {
  if (!values.length) return 0;
  if (!(fraction > 0 && fraction <= 1)) throw new Error('Percentile must be in (0, 1]');
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
}

const PRODUCTION_HOSTS = new Set(['klar.app', 'www.klar.app']);

export function loadTarget(value: string, allowProduction = false): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('LOAD_TEST_BASE_URL must be an absolute URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Load-test target must use HTTP(S)');
  if (url.username || url.password) throw new Error('Load-test target must not contain credentials');
  if (PRODUCTION_HOSTS.has(url.hostname.toLowerCase()) && !allowProduction) {
    throw new Error('Production load testing is blocked; set LOAD_TEST_ALLOW_PRODUCTION=true only for an approved exercise');
  }
  return url;
}

export function evaluateLoadResult(
  total: number,
  successful: number,
  p95LatencyMs: number,
  targets: LoadSloTargets,
) {
  const availability = total > 0 ? successful / total : 0;
  return {
    availability,
    availabilityPass: availability >= targets.availability,
    latencyPass: p95LatencyMs <= targets.p95LatencyMs,
    passed: availability >= targets.availability && p95LatencyMs <= targets.p95LatencyMs,
  };
}
