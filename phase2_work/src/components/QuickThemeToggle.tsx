import { Sun, Moon, MonitorSmartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { hapticFeedback, HAPTIC_PATTERNS } from '../lib/haptics';
import { useTheme } from './ThemeProvider';

export function QuickThemeToggle() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const label = theme === 'light' ? t('theme.switchToDark') : theme === 'dark' ? t('theme.switchToSystem') : t('theme.switchToLight');
  const title = theme === 'light' ? t('theme.light') : theme === 'dark' ? t('theme.dark') : t('theme.system');
  const toggle = () => {
    hapticFeedback(HAPTIC_PATTERNS.LIGHT_TAP);
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };
  return (
    <button type="button" onClick={toggle}
      className="relative p-2 w-10 h-10 flex items-center justify-center rounded-full text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors"
      aria-label={label} title={title}>
      {theme === 'light' && <Moon size={20} aria-hidden="true" />}
      {theme === 'dark' && <MonitorSmartphone size={20} aria-hidden="true" />}
      {theme === 'system' && <Sun size={20} aria-hidden="true" />}
    </button>
  );
}