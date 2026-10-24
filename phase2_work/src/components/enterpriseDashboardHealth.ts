/** Validates observed results; admin authorization occurs on the server, not here. */
export type HealthFlag = 'healthy' | 'unhealthy';
export interface EnterpriseObservation {
  firestore: HealthFlag;
  auth: HealthFlag;
  requestLatencyMs: number | null;
  observedAt: number;
}
export function parseEnterpriseObservation(value: unknown, observedAt: number): EnterpriseObservation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('ADMIN_HEALTH_INVALID_RESPONSE');
  const data = value as Record<string, unknown>;
  if (typeof data.firestore !== 'boolean' || typeof data.auth !== 'boolean') throw new Error('ADMIN_HEALTH_INVALID_RESPONSE');
  if (!Number.isSafeInteger(observedAt) || observedAt < 0) throw new Error('ADMIN_HEALTH_INVALID_TIMESTAMP');
  const latency = data.latency;
  return {
    firestore: data.firestore ? 'healthy' : 'unhealthy',
    auth: data.auth ? 'healthy' : 'unhealthy',
    requestLatencyMs: typeof latency === 'number' && Number.isFinite(latency) && latency >= 0 && latency <= 60000 ? latency : null,
    observedAt,
  };
}
export function isFresh(observation: EnterpriseObservation | null, now: number, maxAgeMs = 180000): boolean {
  return observation !== null && Number.isFinite(now) && Number.isFinite(maxAgeMs) &&
    maxAgeMs >= 0 && maxAgeMs <= 180000 && now >= observation.observedAt &&
    now - observation.observedAt <= maxAgeMs;
}
