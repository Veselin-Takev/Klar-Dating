export const RADAR_INTEREST_MAX_ITEMS = 30;
export const RADAR_INTEREST_MAX_CHARS = 80;
export const RADAR_CONNECTION_MAX_ITEMS = 30;
export const RADAR_CONNECTION_JSON_MAX_CHARS = 20_000;

export type CompatibilityRadarInput = {
  userInterests: string[];
  verbindungen: unknown[];
};

function isJsonValue(value: unknown, ancestors = new Set<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;

  if (ancestors.has(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return false;
  if (Object.getOwnPropertySymbols(value).length > 0) return false;

  ancestors.add(value);
  try {
    const children = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
    return children.every(child => isJsonValue(child, ancestors));
  } catch {
    return false;
  } finally {
    ancestors.delete(value);
  }
}

export function parseCompatibilityRadarInput(body: unknown): CompatibilityRadarInput | null {
  if (!body || typeof body !== 'object') return null;
  const value = body as { userInterests?: unknown; verbindungen?: unknown };

  if (!Array.isArray(value.userInterests) || !Array.isArray(value.verbindungen)) return null;
  if (value.userInterests.length > RADAR_INTEREST_MAX_ITEMS) return null;
  if (value.verbindungen.length > RADAR_CONNECTION_MAX_ITEMS) return null;

  const userInterests = value.userInterests.map(item => {
    if (typeof item !== 'string') return null;
    const text = item.trim();
    if (!text || text.length > RADAR_INTEREST_MAX_CHARS) return null;
    return text;
  });
  if (userInterests.some(item => item === null)) return null;

  if (!value.verbindungen.every(item => isJsonValue(item))) return null;

  let serialized: string;
  try {
    serialized = JSON.stringify(value.verbindungen);
  } catch {
    return null;
  }
  if (typeof serialized !== 'string' || serialized.length > RADAR_CONNECTION_JSON_MAX_CHARS) return null;

  return {
    userInterests: userInterests as string[],
    verbindungen: value.verbindungen,
  };
}
