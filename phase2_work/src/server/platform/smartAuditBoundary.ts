export const SMART_AUDIT_BIO_MAX_CHARS = 4000;
export const SMART_AUDIT_VALUE_MAX_ITEMS = 12;
export const SMART_AUDIT_VALUE_MAX_CHARS = 80;
export const SMART_AUDIT_TEXT_MAX_CHARS = 800;

export type SmartAuditInput = {
  bio: string;
  values: string[];
  profileImageUrl?: string;
};

export type SmartAuditOutput = {
  overallScore: number;
  strengths: string[];
  suggestions: string[];
};

function boundedStrings(value: unknown, maxItems: number, maxChars: number): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > maxItems) return null;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') return null;
    const text = item.trim();
    if (!text || text.length > maxChars || seen.has(text)) return null;
    seen.add(text);
    out.push(text);
  }
  return out;
}

export function parseSmartAuditInput(value: unknown): SmartAuditInput | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;

  if (typeof body.bio !== 'string') return null;
  const bio = body.bio.trim();
  if (!bio || bio.length > SMART_AUDIT_BIO_MAX_CHARS) return null;

  const values = boundedStrings(body.values, SMART_AUDIT_VALUE_MAX_ITEMS, SMART_AUDIT_VALUE_MAX_CHARS);
  if (!values) return null;

  if (body.profileImageUrl !== undefined && body.profileImageUrl !== null && typeof body.profileImageUrl !== 'string') {
    return null;
  }

  const profileImageUrl = typeof body.profileImageUrl === 'string' ? body.profileImageUrl.trim() : '';
  if (profileImageUrl.length > 2048) return null;

  return profileImageUrl ? { bio, values, profileImageUrl } : { bio, values };
}

function boundedOutputStrings(value: unknown, maxItems: number): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    const text = item.trim();
    if (!text || text.length > SMART_AUDIT_TEXT_MAX_CHARS) return null;
    out.push(text);
  }
  return out;
}

export function parseSmartAuditOutput(value: unknown): SmartAuditOutput | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;

  if (
    typeof body.overallScore !== 'number' ||
    !Number.isFinite(body.overallScore) ||
    body.overallScore < 1 ||
    body.overallScore > 10
  ) {
    return null;
  }

  const strengths = boundedOutputStrings(body.strengths, 8);
  const suggestions = boundedOutputStrings(body.suggestions, 8);
  if (!strengths || !suggestions) return null;

  return {
    overallScore: Math.round(body.overallScore * 10) / 10,
    strengths,
    suggestions,
  };
}
