export const AI_SHORT_TEXT_MAX_CHARS = 4000;
export const AI_CONTEXT_MAX_CHARS = 8000;

export function parseBoundedText(
  value: unknown,
  maxChars: number = AI_SHORT_TEXT_MAX_CHARS,
): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text.length > maxChars) return null;
  return text;
}

export function parseOptionalBoundedText(
  value: unknown,
  maxChars: number = AI_CONTEXT_MAX_CHARS,
): string | null {
  if (value === undefined || value === null || value === '') return '';
  return parseBoundedText(value, maxChars);
}
