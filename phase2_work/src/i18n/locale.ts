export const SUPPORTED_LANGUAGES = ['de', 'en', 'es', 'fr'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];
export const LANGUAGE_STORAGE_KEY = 'klar_language';
export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === 'string' && SUPPORTED_LANGUAGES.some(language => language === value);
}
export function normalizeLanguage(value: unknown): SupportedLanguage {
  const code = typeof value === 'string' ? value.toLowerCase().split(/[-_]/)[0] : undefined;
  return isSupportedLanguage(code) ? code : 'de';
}
export function initialLanguage(storage?: { getItem: (key: string) => string | null }): SupportedLanguage {
  try { const saved = storage?.getItem(LANGUAGE_STORAGE_KEY); if (saved) return normalizeLanguage(saved); } catch { /* Optional storage. */ }
  return 'de';
}
