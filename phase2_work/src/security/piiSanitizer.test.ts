import { describe, expect, it } from 'vitest';
import { sanitizeProviderText, sanitizeProviderPayload } from './piiSanitizer';

describe('Phase 2 PII sanitizer', () => {
  it('redacts provider-bound contact and financial identifiers', () => {
    const result = sanitizeProviderText('mail me at person@example.com, IBAN DE89370400440532013000');
    expect(result.value).not.toContain('person@example.com');
    expect(result.value).not.toContain('DE89370400440532013000');
    expect(result.redactions).toBeGreaterThanOrEqual(2);
  });
  it('sanitizes recursively while preserving explicitly marked media fields', () => {
    const result = sanitizeProviderPayload({ text: 'x@example.com', data: 'x@example.com' }, new Set(['data']));
    expect(result.value.text).toContain('REDACTED');
    expect(result.value.data).toBe('x@example.com');
  });
});
