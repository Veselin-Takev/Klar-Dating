/**
 * Klar Platform - Privacy & GDPR Art. 9 Prompt Sanitizer
 * 
 * Enforces Zero-Tolerance data protection prior to transmitting user-generated
 * content to external LLMs (OWASP LLM06: Sensitive Information Disclosure,
 * GDPR Art. 9: Special Categories of Personal Data).
 */

export interface SanitizationResult {
  sanitized: string;
  redactedTypes: ('art9_health' | 'art9_religion_politics' | 'contact_info' | 'financial')[];
  clean: boolean;
}

// Regex patterns for PII, financial, and contact identifiers
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,5}\)?[-.\s]?)?\d{3,5}[-.\s]?\d{3,6}/g;
const IBAN_REGEX = /[A-Z]{2}\d{2}[A-Z0-9]{12,30}/gi;
const SOCIAL_HANDLE_REGEX = /(?:telegram|insta(?:gram)?|snap(?:chat)?|whatsapp|paypal|kik|wechat)\s*[:@=]\s*@?[a-zA-Z0-9_.-]{3,30}/gi;

// GDPR Art. 9: Sensitive categories
const ART9_HEALTH_REGEX = /\b(hiv|aids|krebs|depression(?:en)?|bipolar|schizophrenie|adhs|autismus|diagnose[n]?|therapie[n]?|psychiatrie|krankenakte[n]?)\b/gi;
const ART9_RELIGION_POLITICS_REGEX = /\b(moslem(?:s)?|muslim(?:e|in|en)?|christ(?:lich|en|in)?|jude|jüd(?:e|in|isch|en)?|hindu(?:s)?|buddhist(?:en|in)?|evangelisch(?:e|er|en)?|katholisch(?:e|er|en)?|synagoge|moschee|afd|cdu|csu|spd|grüne[nr]?|die\s*grünen|fdp|die\s*linke|linkspartei|kommunist(?:isch|en|in)?)\b/gi;

export function sanitizePromptInput(input: string): SanitizationResult {
  if (!input || typeof input !== 'string') {
    return { sanitized: '', redactedTypes: [], clean: true };
  }

  const redactedTypes: ('art9_health' | 'art9_religion_politics' | 'contact_info' | 'financial')[] = [];
  let result = input;

  // 1. Financial (IBAN / Cards)
  if (IBAN_REGEX.test(result)) {
    result = result.replace(IBAN_REGEX, '[REDACTED_FINANCIAL]');
    if (!redactedTypes.includes('financial')) redactedTypes.push('financial');
  }

  // 2. Contact details (Emails & Social Handles)
  if (EMAIL_REGEX.test(result)) {
    result = result.replace(EMAIL_REGEX, '[REDACTED_CONTACT]');
    if (!redactedTypes.includes('contact_info')) redactedTypes.push('contact_info');
  }

  if (SOCIAL_HANDLE_REGEX.test(result)) {
    result = result.replace(SOCIAL_HANDLE_REGEX, '[REDACTED_CONTACT]');
    if (!redactedTypes.includes('contact_info')) redactedTypes.push('contact_info');
  }

  // Check phone numbers (filtering out simple small numbers)
  result = result.replace(PHONE_REGEX, (match) => {
    const digitsOnly = match.replace(/\D/g, '');
    if (digitsOnly.length >= 8 && digitsOnly.length <= 15) {
      if (!redactedTypes.includes('contact_info')) redactedTypes.push('contact_info');
      return '[REDACTED_CONTACT]';
    }
    return match;
  });

  // 3. GDPR Art. 9: Health & Medical data
  if (ART9_HEALTH_REGEX.test(result)) {
    result = result.replace(ART9_HEALTH_REGEX, '[REDACTED_ART9]');
    if (!redactedTypes.includes('art9_health')) redactedTypes.push('art9_health');
  }

  // 4. GDPR Art. 9: Religious & Political affiliations
  if (ART9_RELIGION_POLITICS_REGEX.test(result)) {
    result = result.replace(ART9_RELIGION_POLITICS_REGEX, '[REDACTED_ART9]');
    if (!redactedTypes.includes('art9_religion_politics')) redactedTypes.push('art9_religion_politics');
  }

  return {
    sanitized: result,
    redactedTypes,
    clean: redactedTypes.length === 0,
  };
}
