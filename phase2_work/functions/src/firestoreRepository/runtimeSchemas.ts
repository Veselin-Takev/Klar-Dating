import type { RuntimeSchema } from './TenantAwareFirestoreRepository';

/** Firestore maps remain unknown until a consumer validates its own fields. */
export const recordSchema: RuntimeSchema<Record<string, unknown>> = {
  parse(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || value instanceof Date) throw new Error('firestore_record_invalid');
    return value as Record<string, unknown>;
  },
};
export function timestampMillis(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    const millis: unknown = value.toMillis();
    return typeof millis === 'number' && Number.isFinite(millis) ? millis : NaN;
  }
  return typeof value === 'number' && Number.isFinite(value) ? value : NaN;
}
