import { describe, expect, it } from 'vitest';
import { getPrompt, validatePromptDefinition } from './promptRegistry';

describe('prompt registry', () => {
  it('returns immutable versioned prompt metadata', () => {
    const prompt = getPrompt('default-agent', '1.0.0');
    expect(prompt.deterministic).toBe(true);
    expect(prompt.responseSchema).toHaveProperty('required');
  });
  it('rejects invalid prompt definitions', () => expect(() => validatePromptDefinition({ id: 'x', version: '1', deterministic: false, systemInstruction: '', responseSchema: {} })).toThrow('AI_PROMPT_REGISTRY_INVALID'));
  it('rejects unknown versions', () => expect(() => getPrompt('default-agent', '9.9.9')).toThrow('AI_PROMPT_NOT_REGISTERED'));
});
