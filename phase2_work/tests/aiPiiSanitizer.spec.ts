import { describe, expect, it } from 'vitest';
import { sanitizeAiPayload, sanitizeAiText } from '../src/server/platform/aiPiiSanitizer';

describe('AI PII sanitizer', () => {
  it('redacts email, formatted phone and IBAN without mutating ordinary text', () => {
    const input = 'Mail jane.doe+klar@example.org, Tel. +49 151 23456789, IBAN DE89 3704 0044 0532 0130 00. Treffen um 19:30.';
    const output = sanitizeAiText(input);
    expect(output).toContain('[EMAIL_REDACTED]');
    expect(output).toContain('[PHONE_REDACTED]');
    expect(output).toContain('[IBAN_REDACTED]');
    expect(output).toContain('Treffen um 19:30.');
    expect(output).not.toContain('example.org');
    expect(output).not.toContain('3704 0044');
  });

  it('sanitizes nested provider text but preserves inline base64 media data and structural fields', () => {
    const payload = {
      model: 'gemini-test',
      contents: [{ role: 'user', parts: [
        { text: 'Schreib an max@example.com oder +43 660 1234567' },
        { inlineData: { mimeType: 'audio/webm', data: 'DE8912345678901234567890' } },
      ] }],
      config: { systemInstruction: 'Nie an user@example.net mailen', responseMimeType: 'application/json' },
    };
    const output = sanitizeAiPayload(payload);
    expect(output.model).toBe('gemini-test');
    const content = output.contents[0];
    expect(content).toBeDefined();
    const parts = content?.parts ?? [];
    expect(parts[0]).toEqual({ text: 'Schreib an [EMAIL_REDACTED] oder [PHONE_REDACTED]' });
    expect(parts[1]).toEqual({ inlineData: { mimeType: 'audio/webm', data: 'DE8912345678901234567890' } });
    expect(output.config.systemInstruction).toBe('Nie an [EMAIL_REDACTED] mailen');
    expect(payload.contents[0]?.parts[0]).toEqual({ text: 'Schreib an max@example.com oder +43 660 1234567' });
  });

  it('redacts ordinary data fields without corrupting encoded inline media', () => {
    const payload = {
      contents: [{ parts: [
        { data: 'Kontakt: private@example.org' },
        { metadata: { data: 'Telefon +49 151 23456789' } },
        { inlineData: { mimeType: 'image/jpeg', data: 'DE8912345678901234567890' } },
      ] }],
    };
    const output = sanitizeAiPayload(payload);
    expect(output.contents[0].parts[0]).toEqual({ data: 'Kontakt: [EMAIL_REDACTED]' });
    expect(output.contents[0].parts[1]).toEqual({ metadata: { data: 'Telefon [PHONE_REDACTED]' } });
    expect(output.contents[0].parts[2]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: 'DE8912345678901234567890' } });
    expect(payload.contents[0].parts[0]).toEqual({ data: 'Kontakt: private@example.org' });
  });

  it('does not redact unformatted ordinary numeric identifiers', () => {
    expect(sanitizeAiText('ID 123456789 und Score 1234567')).toBe('ID 123456789 und Score 1234567');
  });
});
