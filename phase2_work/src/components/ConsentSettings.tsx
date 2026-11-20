import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/AuthContext';
import { authFetch } from '../lib/authFetch';
import { zweckErlaubt } from '../server/pure';

const purposes = [
  { key: 'ki_auswertung', labelKey: 'consentCenter.purposes.aiAnalysis.label', descriptionKey: 'consentCenter.purposes.aiAnalysis.description' },
  { key: 'fehlerberichte', labelKey: 'consentCenter.purposes.errorReports.label', descriptionKey: 'consentCenter.purposes.errorReports.description' },
  { key: 'produktanalyse', labelKey: 'consentCenter.purposes.productAnalytics.label', descriptionKey: 'consentCenter.purposes.productAnalytics.description' },
] as const;

export function ConsentSettings() {
  const { t } = useTranslation();
  const { user, profileData, refreshProfile } = useAuth();
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => { setConfirmed({}); setMessage(''); }, [user?.uid]);

  const change = async (zweck: typeof purposes[number]['key'], erlaubt: boolean) => {
    setBusy(zweck);
    setMessage('');
    try {
      const response = await authFetch('/api/einwilligung/zweck', { method: 'POST', body: JSON.stringify({ zweck, erlaubt }) });
      const data: unknown = await response.json();
      const receipt = data && typeof data === 'object' ? data as Record<string, unknown> : {};
      if (!response.ok || receipt.ok !== true || typeof receipt.evidenceId !== 'string' || !receipt.evidenceId) throw new Error('decision_not_confirmed');
      const current = await refreshProfile();
      const record = current && typeof current === 'object' ? (current as Record<string, unknown>).einwilligung : null;
      const authoritative = record && typeof record === 'object' ? record as Record<string, unknown> : {};
      if (authoritative.evidenceId !== receipt.evidenceId || zweckErlaubt(record as Parameters<typeof zweckErlaubt>[0], zweck) !== erlaubt) throw new Error('consent_readback_mismatch');
      setConfirmed(previous => ({ ...previous, [zweck]: erlaubt }));
      setMessage(erlaubt ? t('consentCenter.messages.granted') : t('consentCenter.messages.revoked'));
    } catch { setMessage(t('consentCenter.messages.failed')); }
    finally { setBusy(null); }
  };

  return (
    <section aria-labelledby="consent-settings-title" className="rounded-2xl border border-line-ui bg-surface text-ink p-5">
      <h2 id="consent-settings-title" className="text-lg font-semibold">{t('consentCenter.title')}</h2>
      <p className="my-3 text-sm">{t('consentCenter.description')}</p>
      <ul className="space-y-4">
        {purposes.map(({ key, labelKey, descriptionKey }) => {
          const label = t(labelKey);
          const allowed = confirmed[key] ?? zweckErlaubt(profileData?.einwilligung, key);
          const action = allowed ? t('consentCenter.actions.withdraw') : t('consentCenter.actions.grant');
          return (
            <li key={key} className="rounded-xl border border-line-ui p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">{label}</p>
                <p className="text-xs text-ink-muted mt-1">{t(descriptionKey)}</p>
                <p className="text-xs mt-2" aria-live="polite">{label}: {t(allowed ? 'consentCenter.status.allowed' : 'consentCenter.status.notAllowed')}</p>
              </div>
              <button type="button" disabled={busy !== null} aria-pressed={allowed} aria-label={label + ' ' + action}
                onClick={() => void change(key, !allowed)} className="shrink-0 min-h-11 rounded-full border px-4 py-2 text-sm disabled:opacity-50">
                {busy === key ? t('consentCenter.saving') : action}
              </button>
            </li>
          );
        })}
      </ul>
      <p role="status" aria-live="polite" className="mt-3 text-sm">{message}</p>
    </section>
  );
}