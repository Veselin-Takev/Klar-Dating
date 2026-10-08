import defaultAgent from '../../prompts/registry/default-agent.json';

export interface RegisteredPrompt {
  id: string;
  version: string;
  deterministic: boolean;
  systemInstruction: string;
  responseSchema: Record<string, unknown>;
}

const REGISTRY: Record<string, RegisteredPrompt> = { [defaultAgent.id]: defaultAgent as RegisteredPrompt };

function validSchema(schema: unknown): schema is Record<string, unknown> {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return false;
  const node = schema as Record<string, unknown>;
  if (typeof node.type !== 'string') return false;
  if (node.type === 'object') {
    if (!node.properties || typeof node.properties !== 'object' || Array.isArray(node.properties)) return false;
    if (node.required !== undefined && !Array.isArray(node.required)) return false;
  }
  return true;
}

export function validatePromptDefinition(prompt: RegisteredPrompt): void {
  if (!prompt.id || !prompt.version || prompt.deterministic !== true || !prompt.systemInstruction.trim() || !validSchema(prompt.responseSchema)) {
    throw new Error('AI_PROMPT_REGISTRY_INVALID');
  }
}

export function getPrompt(id: string, version?: string): RegisteredPrompt {
  const prompt = REGISTRY[id];
  if (!prompt || (version && prompt.version !== version)) throw new Error('AI_PROMPT_NOT_REGISTERED');
  validatePromptDefinition(prompt);
  return { ...prompt, responseSchema: structuredClone(prompt.responseSchema) };
}
