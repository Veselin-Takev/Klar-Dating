import { useId } from 'react';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguagePreference } from '../i18n/LanguagePreference';
import { isSupportedLanguage, normalizeLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n/locale';

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fr: 'Français',
};

/**
 * Global language control. Kept as a native select deliberately: it provides
 * keyboard navigation, screen-reader semantics and mobile platform pickers
 * without introducing a custom popover interaction.
 */
export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const { change, state } = useLanguagePreference();
  const id = useId();
  const statusId = `${id}-status`;
  const currentLanguage = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);

  return (
    <div className="klar-language-switcher inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-xl border border-line-ui/60 bg-surface px-1.5 shadow-sm">
      <Globe size={18} aria-hidden="true" className="shrink-0 text-muted" />
      <label className="sr-only" htmlFor={id}>{t('settings.language')}</label>
      <select
        id={id}
        value={currentLanguage}
        aria-describedby={statusId}
        aria-busy={state === 'saving'}
        className="min-h-11 min-w-0 max-w-[8rem] cursor-pointer rounded-lg bg-transparent px-2 text-sm font-medium text-ink outline-none"
        onChange={event => {
          if (isSupportedLanguage(event.target.value)) void change(event.target.value);
        }}
      >
        {SUPPORTED_LANGUAGES.map(language => (
          <option key={language} value={language} lang={language}>
            {LANGUAGE_LABELS[language]}
          </option>
        ))}
      </select>
      <span id={statusId} role="status" aria-live="polite" className={state === 'error' ? 'sr-only text-sm text-warn' : 'sr-only'}>
        {state === 'idle' ? '' : t(`settings.language_${state}`)}
      </span>
    </div>
  );
}
