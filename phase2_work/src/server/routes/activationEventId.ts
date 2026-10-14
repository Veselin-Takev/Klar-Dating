/** Deterministic per-account fallback when older clients omit activation eventId. */
export function resolveActivationEventId(eventName: string, uid: string, suppliedId: unknown): string | undefined {
  if (typeof suppliedId === 'string') return suppliedId;
  if (suppliedId !== undefined && suppliedId !== null) return undefined;
  const step = /^onboarding_(started|completed)$/.exec(eventName)?.[1];
  return step ? `onboarding_v2_${step}_${uid}` : undefined;
}
