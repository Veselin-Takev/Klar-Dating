import 'i18next';
import de from './locales/de.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    strictKeyChecks: true;
    resources: {
      translation: typeof de;
    };
  }
}
