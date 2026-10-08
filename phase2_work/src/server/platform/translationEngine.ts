import type { Request, Response } from 'express';
import { currentUserId } from '../authorization';
import { InputError, requireString, optionalString } from '../pure';
import { sanitizePromptInput } from './privacySanitizer';
import { translateText as callTranslationService } from '../translationService';

export interface TranslationEngineResult {
  success: boolean;
  textTranslated: string;
  sourceLang: string;
  targetLang: string;
  usedFallback: boolean;
  redacted: boolean;
  redactedTypes: string[];
}

const LANGUAGE_CODE_MAP: Record<string, string> = {
  de: 'Deutsch',
  en: 'Englisch',
  fr: 'Französisch',
  es: 'Spanisch',
  it: 'Italienisch',
  nl: 'Niederländisch',
  pl: 'Polnisch',
  pt: 'Portugiesisch',
  tr: 'Türkisch',
  uk: 'Ukrainisch',
  ru: 'Russisch',
  ar: 'Arabisch',
};

export function normalizeLanguage(lang: string): { code: string; name: string } {
  const trimmed = lang.trim().toLowerCase();
  for (const [code, name] of Object.entries(LANGUAGE_CODE_MAP)) {
    if (trimmed === code || trimmed === name.toLowerCase()) {
      return { code, name };
    }
  }
  return { code: trimmed, name: lang.trim() };
}

export async function processTranslation(
  rawText: unknown,
  targetLangRaw: unknown,
  sourceLangRaw: unknown = 'auto'
): Promise<TranslationEngineResult> {
  const text = requireString(rawText, 'text', 4000);
  const targetLangInput = requireString(targetLangRaw, 'targetLang', 50);
  const sourceLangInput = optionalString(sourceLangRaw, 'sourceLang', 50) || 'auto';

  // 1. Zero-Tolerance Privacy Sanitization (GDPR Art. 9 & OWASP LLM06)
  const sanitization = sanitizePromptInput(text);
  const sanitizedText = sanitization.sanitized;
  const isRedacted = !sanitization.clean;

  const targetLangNorm = normalizeLanguage(targetLangInput);
  const sourceLangNorm = sourceLangInput === 'auto' ? { code: 'auto', name: 'Auto' } : normalizeLanguage(sourceLangInput);

  // If source and target are the same, return without network hop
  if (sourceLangNorm.code !== 'auto' && sourceLangNorm.code === targetLangNorm.code) {
    return {
      success: true,
      textTranslated: sanitizedText,
      sourceLang: sourceLangNorm.code,
      targetLang: targetLangNorm.code,
      usedFallback: false,
      redacted: isRedacted,
      redactedTypes: sanitization.redactedTypes,
    };
  }

  // 2. Try primary translation service (LibreTranslate/OpenSource microservice)
  try {
    const serviceResult = await callTranslationService(sanitizedText, sourceLangNorm.code, targetLangNorm.code);
    if (!serviceResult.usedFallback && typeof serviceResult.textTranslated === 'string' && serviceResult.textTranslated.trim()) {
      return {
        success: true,
        textTranslated: serviceResult.textTranslated,
        sourceLang: serviceResult.sourceLang || sourceLangNorm.code,
        targetLang: serviceResult.targetLang || targetLangNorm.code,
        usedFallback: false,
        redacted: isRedacted,
        redactedTypes: sanitization.redactedTypes,
      };
    }
  } catch (err) {
    console.warn('[TranslationEngine] Primary translation service error:', err);
  }

  // 3. No paid-provider fallback by design. Live translation stays cost-free
  // from the application perspective and never silently routes chat content
  // to a second commercial AI provider. If the self-hosted/open-source
  // translator is unavailable, the sanitized original remains authoritative.

  // 3. Resilient Fallback (Zero crash, preserve sanitized original)
  return {
    success: true,
    textTranslated: sanitizedText,
    sourceLang: sourceLangNorm.code,
    targetLang: targetLangNorm.code,
    usedFallback: true,
    redacted: isRedacted,
    redactedTypes: sanitization.redactedTypes,
  };
}

export async function handleTranslation(req: Request, res: Response): Promise<void> {
  const uid = currentUserId(req);
  if (!uid) {
    res.status(401).json({ error: 'Bitte anmelden.' });
    return;
  }

  try {
    const { text, targetLang, sourceLang } = req.body ?? {};
    const result = await processTranslation(text, targetLang, sourceLang);
    res.json(result);
  } catch (error) {
    if (error instanceof InputError) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error('[TranslationEngine] Internal error:', error);
    res.status(500).json({ error: 'Die Übersetzung ist derzeit nicht verfügbar.' });
  }
}
