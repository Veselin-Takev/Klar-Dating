const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}\b/gi;
const IBAN_CANDIDATE = /\b[A-Z]{2}\d{2}(?:[\s-]?[A-Z0-9]){11,30}\b/gi;
const PHONE_CANDIDATE = /(?:\+|00)\d(?:[\d\s()./-]{6,}\d)|(?:^|[^\d])(?:0(?:1[5-7]\d{8,9}|[2-9]\d{6,10})|49(?:1[5-7]\d{8,9}|[2-9]\d{6,10}))(?!\d)/g;

export function sanitizeAiText(value: string): string {
  let sanitized = value.replace(EMAIL, '[EMAIL_REDACTED]');
  sanitized = sanitized.replace(IBAN_CANDIDATE, candidate => {
    const compact = candidate.replace(/[\s-]/g, '').toUpperCase();
    return compact.length >= 15 && compact.length <= 34 ? '[IBAN_REDACTED]' : candidate;
  });
  sanitized = sanitized.replace(PHONE_CANDIDATE, candidate => {
    const digits = candidate.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) return candidate;
    const hasPhonePrefix = /^(?:\+|00)/.test(candidate);
    const normalized = candidate.replace(/\D/g, '');
    const germanDomestic = /^(?:0(?:1[5-7]\d{8,9}|[2-9]\d{6,10}))$/.test(normalized);
    const germanInternational = /^(?:49(?:1[5-7]\d{8,9}|[2-9]\d{6,10}))$/.test(normalized);
    return hasPhonePrefix || germanDomestic || germanInternational ? '[PHONE_REDACTED]' : candidate;
  });
  return sanitized;
}

export function sanitizeAiPayload<T>(value: T, key?: string, parentKey?: string): T {
  if (typeof value === 'string') {
    // Only inlineData.data is encoded media; arbitrary fields named "data"
    // can contain human text and must not bypass the provider PII boundary.
    if (key === 'data' && parentKey === 'inlineData') return value;
    return sanitizeAiText(value) as T;
  }
  if (Array.isArray(value)) return value.map(item => sanitizeAiPayload(item, key, parentKey)) as T;
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      output[childKey] = sanitizeAiPayload(childValue, childKey, key);
    }
    return output as T;
  }
  return value;
}
