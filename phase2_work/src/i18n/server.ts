import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from './locale';
import { createInstance } from 'i18next';

export const resources = { de: { translation: de }, en: { translation: en }, es: { translation: es }, fr: { translation: fr } };
export const options = {
  resources, supportedLngs: [...SUPPORTED_LANGUAGES], fallbackLng: 'de',
  interpolation: { escapeValue: false }, returnNull: false, saveMissing: false,
} as const;
// Every SSR request gets its own instance: no cross-request language state.
export function createRequestI18n(language: SupportedLanguage) {
  const instance = createInstance();
  void instance.init({ ...options, lng: language, initAsync: false });
  return instance;
}
