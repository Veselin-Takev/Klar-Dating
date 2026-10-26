import { logSafeFailure } from './safeErrorLog';
import { readBoundedResponse } from './boundedResponse';
/**
 * Orchestriert die Anbindung an lokale/Open-Source Übersetzungsmodelle
 * (z. B. LibreTranslate, MarianMT, NLLB-200).
 */

const TRANSLATION_TIMEOUT_MS = 1500; // P95 Latenz Requirement <= 1.5s
const TRANSLATION_RESPONSE_MAX_BYTES = 64 * 1024;
const TRANSLATION_TEXT_MAX_CHARS = 12_000;

export interface TranslationResult {
  textTranslated: string | null;
  sourceLang: string | null;
  targetLang: string | null;
  usedFallback: boolean;
}

export async function translateText(
  text: string,
  sourceLang: string = 'auto',
  targetLang: string = 'en'
): Promise<TranslationResult> {
  // Graceful degradation: Wenn Text leer ist oder Sprachen identisch
  if (!text || sourceLang === targetLang) {
    return { textTranslated: null, sourceLang, targetLang, usedFallback: true };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TRANSLATION_TIMEOUT_MS);

  try {
    const baseUrl = process.env.TRANSLATION_SERVICE_URL?.trim();
    if (!baseUrl) {
      return { textTranslated: null, sourceLang, targetLang, usedFallback: true };
    }

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, sourceLang, targetLang }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Translation service returned ${response.status}`);

    const responseText = new TextDecoder().decode(await readBoundedResponse(response, TRANSLATION_RESPONSE_MAX_BYTES, 'Translation response too large'));
    let data: { textTranslated?: unknown };
    try { data = JSON.parse(responseText) as { textTranslated?: unknown }; } catch { throw new Error('Invalid translation response'); }
    if (typeof data.textTranslated !== 'string' || !data.textTranslated.trim() || data.textTranslated.length > TRANSLATION_TEXT_MAX_CHARS) throw new Error('Invalid translation response');
    return { textTranslated: data.textTranslated, sourceLang, targetLang, usedFallback: false };
  } catch (error) {
    logSafeFailure('translation_fallback');
    return {
      textTranslated: null,
      sourceLang,
      targetLang,
      usedFallback: true
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
