/**
 * Phase 2 provider-boundary PII sanitizer.
 *
 * This module is intentionally deterministic and fail-closed. It sanitizes
 * textual values recursively and never logs the original value. Binary/media
 * payloads are not guessed at: callers must explicitly mark a field as media.
 */
export type RedactionType = 'email' | 'phone' | 'iban' | 'credit_card' | 'ip_address' | 'contact_handle';

export interface PiiSanitizationResult<T> {
  value: T;
  redactedTypes: RedactionType[];
  redactions: number;
}

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}\b/gi;
const IBAN = /\b[A-Z]{2}\d{2}(?:[ -]?[A-Z0-9]){11,30}\b/gi;
const CARD = /\b(?:\d[ -]?){13,19}\b/g;
const PHONE = /(?:\+|00)\d[\d\s()./-]{6,}\d|\b0(?:1[5-7]\d{8,9}|[2-9]\d{6,10})\b/g;
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const HANDLE = /\b(?:telegram|instagram|whatsapp|signal|paypal)\s*[:=@]\s*@?[a-z0-9_.-]{3,64}\b/gi;

function redactText(input: string): { value: string; types: RedactionType[]; count: number } {
  const types = new Set<RedactionType>();
  let count = 0;
  let value = input;
  const replace = (pattern: RegExp, replacement: string, type: RedactionType, predicate?: (match: string) => boolean) => {
    value = value.replace(pattern, (match) => {
      if (predicate && !predicate(match)) return match;
      types.add(type);
      count += 1;
      return replacement;
    });
  };
  replace(EMAIL, '[PII_EMAIL_REDACTED]', 'email');
  replace(IBAN, '[PII_IBAN_REDACTED]', 'iban', (match) => match.replace(/[ -]/g, '').length >= 15);
  replace(CARD, '[PII_CARD_REDACTED]', 'credit_card', (match) => {
    const digits = match.replace(/\D/g, '');
    return digits.length >= 13 && digits.length <= 19;
  });
  replace(PHONE, '[PII_PHONE_REDACTED]', 'phone', (match) => {
    const digits = match.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15;
  });
  replace(IPV4, '[PII_IP_REDACTED]', 'ip_address', (match) => match.split('.').every((part) => Number(part) >= 0 && Number(part) <= 255));
  replace(HANDLE, '[PII_HANDLE_REDACTED]', 'contact_handle');
  return { value, types: [...types], count };
}

export function sanitizeProviderText(input: string): PiiSanitizationResult<string> {
  if (typeof input !== 'string') throw new TypeError('PII_SANITIZER_EXPECTED_STRING');
  const result = redactText(input);
  return { value: result.value, redactedTypes: result.types, redactions: result.count };
}

export function sanitizeProviderPayload<T>(input: T, mediaKeys: ReadonlySet<string> = new Set()): PiiSanitizationResult<T> {
  const types = new Set<RedactionType>();
  let redactions = 0;
  const visit = (value: unknown, key?: string): unknown => {
    if (typeof value === 'string') {
      if (key && mediaKeys.has(key)) return value;
      const result = redactText(value);
      result.types.forEach((type) => types.add(type));
      redactions += result.count;
      return result.value;
    }
    if (Array.isArray(value)) return value.map((item) => visit(item, key));
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
        out[childKey] = visit(childValue, childKey);
      }
      return out;
    }
    return value;
  };
  return { value: visit(input) as T, redactedTypes: [...types], redactions };
}
