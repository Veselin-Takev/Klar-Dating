import { describe, expect, it } from 'vitest';
import { deriveLoadSloTargets, evaluateLoadResult, loadTarget, percentile } from '../src/server/platform/loadSlo';

describe('load SLO helpers', () => {
  it('derives API thresholds from the machine-readable SLO contract', () => {
    expect(deriveLoadSloTargets({ objectives: [
      { name: 'api-availability', target: 0.9995 },
      { name: 'api-latency-p95-ms', target: 300 },
    ] })).toEqual({ availability: 0.9995, p95LatencyMs: 300 });
  });

  it('uses nearest-rank percentiles without mutating input', () => {
    const values = [5, 1, 4, 2, 3];
    expect(percentile(values, 0.95)).toBe(5);
    expect(values).toEqual([5, 1, 4, 2, 3]);
  });

  it('blocks the production hostname unless the exercise is explicitly approved', () => {
    expect(() => loadTarget('https://klar.app')).toThrow(/Production load testing is blocked/);
    expect(loadTarget('https://klar.app', true).hostname).toBe('klar.app');
    expect(loadTarget('https://staging.klar.example').hostname).toBe('staging.klar.example');
  });

  it('evaluates availability and latency independently', () => {
    expect(evaluateLoadResult(10000, 9995, 299, { availability: 0.9995, p95LatencyMs: 300 }))
      .toMatchObject({ availabilityPass: true, latencyPass: true, passed: true });
    expect(evaluateLoadResult(10000, 9994, 250, { availability: 0.9995, p95LatencyMs: 300 }).passed).toBe(false);
    expect(evaluateLoadResult(10000, 10000, 301, { availability: 0.9995, p95LatencyMs: 300 }).passed).toBe(false);
  });
});
