// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { boundedGeneration, createBudgetedAI } from './aiBudget';
const responseSchema = { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] };
const jsonConfig = { responseMimeType: 'application/json' as const, responseSchema };

describe('AI provider cost boundary', () => {
  it('caps output and disables hidden SDK retries even if callers request more', () => {
    const signal = new AbortController().signal;
    const result = boundedGeneration({ model: 'test', contents: 'hello', config: { ...jsonConfig, maxOutputTokens: 5000, httpOptions: { timeout: 90000, retryOptions: { attempts: 5 } } } }, '/api/icebreakers', signal);
    expect(result.parameters.config).toMatchObject({ maxOutputTokens: 256, abortSignal: signal, httpOptions: { timeout: 15000, retryOptions: { attempts: 1 } } });
    expect(result.units).toBeGreaterThan(256 + 1024);
  });
  it('keeps smaller caller limits and refuses oversized input before billing', () => {
    const signal = new AbortController().signal;
    expect(boundedGeneration({ model: 'test', contents: 'hello', config: { ...jsonConfig, maxOutputTokens: 32 } }, '/api/chat', signal).parameters.config?.maxOutputTokens).toBe(32);
    expect(() => boundedGeneration({ model: 'test', contents: 'x'.repeat(65537), config: jsonConfig }, '/api/chat', signal)).toThrow('AI_INPUT_TOO_LARGE');
  });
  it('refuses calls outside an authenticated request context', async () => {
    await expect(createBudgetedAI({ apiKey: 'not-a-real-key' }).models.generateContent({ model: 'test', contents: 'hello' })).rejects.toThrow('authenticated budget context');
  });
});

describe('budget exhaustion retry policy', () => {
  it('does not retry a locally exhausted daily budget', async () => {
    const { rufeKi } = await import('./kiAufruf');
    const { AiBudgetError } = await import('./aiBudget');
    let attempts = 0;
    expect(await rufeKi(async () => { attempts++; throw new AiBudgetError(); })).toEqual({ ok: false, code: 'ki_kontingent' });
    expect(attempts).toBe(1);
  });
});
