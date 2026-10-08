export const BIO_VALUES_MAX_BIO_CHARS = 4000;
export const BIO_VALUES_MAX_ITEMS = 12;
export const BIO_VALUES_SUBJECT_MAX_CHARS = 80;
export const BIO_VALUES_SUGGESTION_MAX_CHARS = 600;

export type BioValueInput = {
  subject: string;
  A: number;
};

export type OptimizeBioValuesInput = {
  bio: string;
  values: BioValueInput[];
};

export function parseOptimizeBioValuesInput(value: unknown): OptimizeBioValuesInput | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as { bio?: unknown; values?: unknown };

  if (typeof body.bio !== 'string') return null;
  const bio = body.bio.trim();
  if (!bio || bio.length > BIO_VALUES_MAX_BIO_CHARS) return null;

  if (!Array.isArray(body.values) || body.values.length === 0 || body.values.length > BIO_VALUES_MAX_ITEMS) {
    return null;
  }

  const seen = new Set<string>();
  const values: BioValueInput[] = [];
  for (const raw of body.values) {
    if (!raw || typeof raw !== 'object') return null;
    const item = raw as Record<string, unknown>;
    if (typeof item.subject !== 'string') return null;
    const subject = item.subject.trim();
    if (!subject || subject.length > BIO_VALUES_SUBJECT_MAX_CHARS || seen.has(subject)) return null;
    if (typeof item.A !== 'number' || !Number.isFinite(item.A) || item.A < 0 || item.A > 100) return null;
    seen.add(subject);
    values.push({ subject, A: Math.round(item.A * 10) / 10 });
  }

  return { bio, values };
}

export function parseOptimizeBioValuesOutput(value: unknown): { suggestions: string[] } | null {
  if (!value || typeof value !== 'object') return null;
  const raw = (value as Record<string, unknown>).suggestions;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 4) return null;

  const suggestions: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') return null;
    const text = item.trim();
    if (!text || text.length > BIO_VALUES_SUGGESTION_MAX_CHARS) return null;
    suggestions.push(text);
  }

  return { suggestions };
}
