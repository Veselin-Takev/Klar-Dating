/**
 * Enterprise Resilience Service
 * Handhabt Latenzspitzen, Timeouts und LLM-API-Ausfälle (z.B. Gemini) deterministisch und unterbrechungsfrei.
 */

export interface ResilienceOptions {
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
}

export async function executeWithResilience<T>(
  primaryAction: () => Promise<T>,
  fallbackAction: () => T | Promise<T>,
  serviceName: string,
  options: ResilienceOptions = {}
): Promise<T> {
  const { timeoutMs = 7000, retries = 1, backoffMs = 400 } = options;

  let attempt = 0;
  while (attempt <= retries) {
    let timer: unknown = null;
    try {
      const result = await Promise.race([
        primaryAction(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`[Resilience] Timeout (${timeoutMs}ms) for service: ${serviceName}`));
          }, timeoutMs);
        }),
      ]);
      if (timer) clearTimeout(timer);
      return result;
    } catch (error) {
      if (timer) clearTimeout(timer);
      attempt++;
      if (attempt <= retries) {
        // Exponential backoff before next try
        await new Promise((resolve) => setTimeout(resolve, backoffMs * Math.pow(2, attempt - 1)));
      } else {
        console.warn(`[Resilience] Service ${serviceName} failed after ${retries + 1} attempt(s). Triggering safe fallback.`, error);
        return await fallbackAction();
      }
    }
  }

  return await fallbackAction();
}
