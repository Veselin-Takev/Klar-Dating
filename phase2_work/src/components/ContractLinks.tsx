import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeLanguage } from '../i18n/locale';
export function ContractLinks({ global = false }: { global?: boolean }) {
  const container = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!global || !container.current) return;
    const update = () => document.documentElement.style.setProperty('--contract-links-height', `${container.current?.getBoundingClientRect().height ?? 0}px`);
    const observer = new ResizeObserver(update); observer.observe(container.current); update();
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--contract-links-height'); };
  }, [global]);
  const { t, i18n } = useTranslation(); const lang = normalizeLanguage(i18n.language);
  return <nav ref={container} className="flex flex-wrap gap-4 p-3 text-sm bg-white text-stone-900" aria-label={t('contracts.contract')}>
    <a className="underline min-h-11 inline-flex items-center" href={`/vertraege/kuendigen?lang=${lang}`}>{t('contracts.cancelLink')}</a>
    <a className="underline min-h-11 inline-flex items-center" href={`/vertraege/widerrufen?lang=${lang}`}>{t('contracts.withdrawLink')}</a>
  </nav>;
}
