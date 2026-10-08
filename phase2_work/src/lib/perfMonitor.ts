import { reportClientError } from './diagnostics';
import type { OperationType } from './firebaseUtils';

// Browser metrics/traces are disabled. Server metrics own latency monitoring;
// optional error reporting never records document paths or request details.
export async function monitorFirestoreOp<T>(
  _operationType: OperationType,
  _path: string,
  op: () => Promise<T>,
): Promise<T> {
  try { return await op(); }
  catch (error) { reportClientError(error); throw error; }
}

export async function monitoredFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  try {
    const response = await fetcher(input, init);
    if (!response.ok) reportClientError(new Error('API request failed'));
    return response;
  } catch (error) {
    reportClientError(new Error('Network request failed'));
    throw error;
  }
}

export interface MemoStats {
  hits: number;
  misses: number;
  totalTimeMs: number;
}

const algorithmMetrics: Record<string, MemoStats> = {};

export function getAlgorithmMetrics(): Record<string, MemoStats> {
  return { ...algorithmMetrics };
}

export function memoizeWithPerf<Args extends unknown[], Return>(
  algorithmName: string,
  fn: (...args: Args) => Return,
  keyGenerator?: (...args: Args) => string,
): (...args: Args) => Return {
  const cache = new Map<string, Return>();
  if (!algorithmMetrics[algorithmName]) {
    algorithmMetrics[algorithmName] = { hits: 0, misses: 0, totalTimeMs: 0 };
  }

  return (...args: Args): Return => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
    let stats = algorithmMetrics[algorithmName];
    if (!stats) {
      stats = { hits: 0, misses: 0, totalTimeMs: 0 };
      algorithmMetrics[algorithmName] = stats;
    }

    if (cache.has(key)) {
      stats.hits++;
      return cache.get(key)!;
    }

    stats.misses++;
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const result = fn(...args);
    const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
    stats.totalTimeMs += end - start;

    if (cache.size > 500) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
    cache.set(key, result);
    return result;
  };
}
