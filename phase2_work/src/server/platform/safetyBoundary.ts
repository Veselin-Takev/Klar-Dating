export const SAFETY_MESSAGE_MAX_CHARS = 4000;

export function parseSafetyMessage(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text.length > SAFETY_MESSAGE_MAX_CHARS) return null;
  return text;
}

export function serializeSafetyAuditOutput(body: Record<string, unknown>): string {
  const payload = {
    isFlagged: body.isFlagged === true,
    explanation: typeof body.explanation === 'string' ? body.explanation.slice(0, 2000) : '',
    suggestions: Array.isArray(body.suggestions)
      ? body.suggestions.filter((item): item is string => typeof item === 'string').slice(0, 3).map(item => item.slice(0, 1000))
      : [],
    herkunft: typeof body.herkunft === 'string' ? body.herkunft : 'unknown',
  };
  return JSON.stringify(payload);
}
