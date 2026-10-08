import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { sendPasswordReset, sendMagicLink, type RecoveryResult } from '../services/authRecovery';
import { useModalAccessibility } from '../lib/useModalAccessibility';
interface Props { isOpen: boolean; onClose: () => void; defaultEmail?: string }
export function AuthRecoveryModal({ isOpen, onClose, defaultEmail = '' }: Props) {
  const { t } = useTranslation(); const title = useId(); const field = useId();
  const { dialogRef, onKeyDown } = useModalAccessibility<HTMLDivElement>(onClose, isOpen);
  const [tab, setTab] = useState<'magic' | 'password'>('magic'); const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false); const [feedback, setFeedback] = useState<RecoveryResult | null>(null);
  if (!isOpen) return null;
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setFeedback(null);
    try { setFeedback(await (tab === 'magic' ? sendMagicLink(email) : sendPasswordReset(email))); }
    catch { setFeedback({ ok: false, code: 'sendFailed' }); } finally { setLoading(false); }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
    <div ref={dialogRef} tabIndex={-1} onKeyDown={onKeyDown} role="dialog" aria-modal="true" aria-labelledby={title}
      className="w-full max-w-md rounded-2xl bg-surface border border-line-ui p-6 text-ink shadow-2xl max-h-full overflow-y-auto">
      <div className="flex justify-between gap-4 items-center mb-5">
        <h2 id={title} className="text-xl font-bold">{t('recovery.title')}</h2>
        <button type="button" onClick={onClose} className="min-h-11 min-w-11" aria-label={t('recovery.close')}>×</button>
      </div>
      <div role="group" aria-label={t('recovery.method')} className="flex gap-4 mb-4">
        <button type="button" aria-pressed={tab === 'magic'} disabled={loading} className="min-h-11 underline" onClick={() => { setTab('magic'); setFeedback(null); }}>{t('recovery.magic')}</button>
        <button type="button" aria-pressed={tab === 'password'} disabled={loading} className="min-h-11 underline" onClick={() => { setTab('password'); setFeedback(null); }}>{t('recovery.password')}</button>
      </div>
      <p className="text-muted mb-4">{t(tab === 'magic' ? 'recovery.magicHint' : 'recovery.passwordHint')}</p>
      {feedback && <p role={feedback.ok ? 'status' : 'alert'} className="mb-4">{t(`recovery.${feedback.code}`)}</p>}
      <form onSubmit={submit} className="space-y-4">
        <label htmlFor={field} className="block">{t('login.email')}</label>
        <input id={field} name="email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} className="w-full min-h-11 rounded-lg border border-line-ui p-2 bg-canvas" />
        <div className="flex justify-end gap-4">
          <button type="button" onClick={onClose} className="min-h-11">{t('actions.cancel')}</button>
          <button type="submit" disabled={loading} className="min-h-11 px-4 rounded-lg bg-accent text-on-accent">{t(loading ? 'recovery.sending' : tab === 'magic' ? 'recovery.requestMagic' : 'recovery.requestReset')}</button>
        </div>
      </form>
    </div>
  </div>;
}
