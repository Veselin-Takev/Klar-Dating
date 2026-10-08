import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { completeMagicLinkSignIn, hasMagicLink, type RecoveryCode } from '../services/authRecovery';
import { LanguageSwitcher } from './LanguageSwitcher';
export function MagicLinkGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation(); const [pending, setPending] = useState(hasMagicLink);
  const [busy, setBusy] = useState(pending); const [email, setEmail] = useState('');
  const [error, setError] = useState<RecoveryCode | null>(null);
  function finish() { window.history.replaceState(null, '', '/'); setPending(false); }
  useEffect(() => {
    if (!pending) return;
    let active = true;
    completeMagicLinkSignIn().then(result => {
      if (!active) return;
      if (result.success) finish(); else if (result.code) setError(result.code);
    }).catch(() => { if (active) setError('invalidLink'); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [pending]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try { const result = await completeMagicLinkSignIn(email); if (result.success) finish(); else setError(result.code ?? 'emailRequired'); }
    catch { setError('invalidLink'); } finally { setBusy(false); }
  }
  if (!pending) return children;
  return <main className="max-w-md mx-auto p-6 space-y-4">
    <LanguageSwitcher />
    <h1 className="text-2xl">{t('recovery.completeTitle')}</h1>
    <p>{t('recovery.completeHint')}</p>
    {busy && <p role="status">{t('status.loading')}</p>}
    {error && <p role="alert">{t(`recovery.${error}`)}</p>}
    <form onSubmit={submit} className="space-y-4">
      <label htmlFor="magic-link-email" className="block">{t('login.email')}</label>
      <input id="magic-link-email" type="email" autoComplete="email" required disabled={busy} value={email} onChange={event => setEmail(event.target.value)} className="w-full min-h-11 border border-line-ui rounded-lg p-2 bg-surface" />
      <button type="submit" disabled={busy} className="min-h-11 px-4 rounded-lg bg-accent text-on-accent">{t('login.signIn')}</button>
    </form>
    <button type="button" disabled={busy} onClick={finish} className="min-h-11 underline">{t('actions.cancel')}</button>
  </main>;
}
