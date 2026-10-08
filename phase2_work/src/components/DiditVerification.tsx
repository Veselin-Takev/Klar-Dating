import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authFetch } from '../lib/authFetch';
import { normalizeLanguage } from '../i18n/locale';

/** Hosted flow: raw ID documents and camera frames never transit the app. */
export function DiditVerification() {
  const { t, i18n } = useTranslation(); const heading = useId(); const consentId = useId();
  const [consent, setConsent] = useState(false); const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('loading');
  const [notice, setNotice] = useState<{ privacyUrl: string; consentVersion: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    authFetch('/api/kyc/status', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error();
      const result = await response.json(); if (!controller.signal.aborted) { setStatus(result.status); setNotice(result); }
    }).catch(() => { if (!controller.signal.aborted) setStatus('unavailable'); });
    return () => controller.abort();
  }, []);
  async function refresh() {
    setBusy(true);
    try {
      const response = await authFetch('/api/kyc/status', { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(); const result = await response.json(); setStatus(result.status); setNotice(result); setConsent(false);
    } catch { setStatus('unavailable'); } finally { setBusy(false); }
  }
  async function start() {
    setBusy(true);
    try {
      const response = await authFetch('/api/kyc/start', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ consent, consentVersion: notice?.consentVersion, language: normalizeLanguage(i18n.language) }), signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error();
      const url = new URL((await response.json()).url);
      if (url.origin !== 'https://verify.didit.me' || url.username || url.password) throw new Error();
      window.location.assign(url.href);
    } catch { setStatus('unavailable'); } finally { setBusy(false); }
  }
  return <section aria-labelledby={heading} className="rounded-2xl border p-5 mb-6 space-y-4">
    <h2 id={heading} className="text-lg font-medium">{t('kyc.title')}</h2>
    <p>{t('kyc.description')}</p>
    <p role="status" aria-live="polite">{status === 'approved' ? t('kyc.approved') : status === 'loading' ? t('status.loading') : status === 'unavailable' ? t('kyc.unavailable') : t('kyc.pending')}</p>
    {status !== 'approved' && notice && <>
      <label htmlFor={consentId} className="flex gap-3 items-start">
        <input id={consentId} type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} className="mt-1" />
        <span>{t('kyc.consent')}</span>
      </label>
      <a href={notice.privacyUrl} target="_blank" rel="noopener noreferrer" className="underline">{t('kyc.privacy')}</a>
      <button type="button" className="block min-h-11 underline" disabled={busy || !consent} onClick={start}>{t('kyc.start')}</button>
    </>}
    <button type="button" className="min-h-11 underline" disabled={busy} onClick={refresh}>{t('kyc.refresh')}</button>
  </section>;
}
