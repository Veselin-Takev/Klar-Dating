export const PROFILE_CHECK_BIO_MAX_CHARS = 4000;
export const PROFILE_CHECK_NAME_MAX_CHARS = 120;
export const PROFILE_CHECK_INTEREST_MAX_ITEMS = 30;
export const PROFILE_CHECK_INTEREST_MAX_CHARS = 80;

export const PROFILE_CHECK_TONALITIES = ['Ehrlich', 'Humorvoll', 'Professionell'] as const;
export const PROFILE_CHECK_CATEGORIES = ['Sprachstil', 'Interessenfokus', 'Icebreaker-Qualität'] as const;

export type ProfileCheckInput = {
  bio: string;
  interests: string[];
  name: string;
  aiFocus: number;
  tonality: typeof PROFILE_CHECK_TONALITIES[number];
};

export type ProfileCheckOutput = {
  authenticityScore: number;
  expressivenessScore: number;
  compatibilityScore: number;
  impression: string;
  suggestions: string[];
  factors: string[];
  optimizedBio: string;
  optimizationCategory: typeof PROFILE_CHECK_CATEGORIES[number];
};

function boundedStringArray(value: unknown, maxItems: number, maxChars: number): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    const text = item.trim();
    if (!text || text.length > maxChars) return null;
    out.push(text);
  }
  return out;
}

export function parseProfileCheckInput(value: unknown): ProfileCheckInput | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;

  if (typeof body.bio !== 'string') return null;
  const bio = body.bio.trim();
  if (bio.length > PROFILE_CHECK_BIO_MAX_CHARS) return null;

  const interests = boundedStringArray(
    body.interests,
    PROFILE_CHECK_INTEREST_MAX_ITEMS,
    PROFILE_CHECK_INTEREST_MAX_CHARS,
  );
  if (!interests || (!bio && interests.length === 0)) return null;

  if (typeof body.name !== 'string') return null;
  const name = body.name.trim();
  if (name.length > PROFILE_CHECK_NAME_MAX_CHARS) return null;

  if (typeof body.aiFocus !== 'number' || !Number.isInteger(body.aiFocus) || body.aiFocus < 0 || body.aiFocus > 100) {
    return null;
  }

  if (typeof body.tonality !== 'string' || !(PROFILE_CHECK_TONALITIES as readonly string[]).includes(body.tonality)) {
    return null;
  }

  return {
    bio,
    interests,
    name,
    aiFocus: body.aiFocus,
    tonality: body.tonality as ProfileCheckInput['tonality'],
  };
}

function score(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100 ? value : null;
}

function boundedText(value: unknown, maxChars: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && text.length <= maxChars ? text : null;
}

export function parseProfileCheckOutput(value: unknown): ProfileCheckOutput | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;

  const authenticityScore = score(body.authenticityScore);
  const expressivenessScore = score(body.expressivenessScore);
  const compatibilityScore = score(body.compatibilityScore);
  if (authenticityScore === null || expressivenessScore === null || compatibilityScore === null) return null;

  const impression = boundedText(body.impression, 1200);
  const optimizedBio = boundedText(body.optimizedBio, PROFILE_CHECK_BIO_MAX_CHARS);
  if (!impression || !optimizedBio) return null;

  const suggestions = boundedStringArray(body.suggestions, 5, 500);
  const factors = boundedStringArray(body.factors, 10, 200);
  if (!suggestions || suggestions.length === 0 || !factors) return null;

  if (
    typeof body.optimizationCategory !== 'string' ||
    !(PROFILE_CHECK_CATEGORIES as readonly string[]).includes(body.optimizationCategory)
  ) {
    return null;
  }

  return {
    authenticityScore,
    expressivenessScore,
    compatibilityScore,
    impression,
    suggestions,
    factors,
    optimizedBio,
    optimizationCategory: body.optimizationCategory as ProfileCheckOutput['optimizationCategory'],
  };
}
