import { klarStorage } from '../lib/userScopedStorage';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { options } from './server';
export { createRequestI18n, resources } from './server';
import { initialLanguage, normalizeLanguage, LANGUAGE_STORAGE_KEY, type SupportedLanguage } from './locale';
let language: SupportedLanguage = 'de';
try { language = initialLanguage(typeof window === 'undefined' ? undefined : klarStorage); } catch { /* Private browsing can reject access. */ }
void i18n.use(initReactI18next).init({ ...options, lng: language });
i18n.on('languageChanged', language => {
  if (typeof document !== 'undefined') document.documentElement.lang = normalizeLanguage(language);
  if (typeof window !== 'undefined') {
    try { klarStorage.setItem(LANGUAGE_STORAGE_KEY, normalizeLanguage(language)); } catch { /* Optional persistence. */ }
  }
});
if (typeof document !== 'undefined') document.documentElement.lang = normalizeLanguage(i18n.language);
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key === LANGUAGE_STORAGE_KEY && event.newValue) void i18n.changeLanguage(normalizeLanguage(event.newValue));
});
export default i18n;
