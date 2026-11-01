import { useId, useState } from 'react';
import { authFetch } from '../lib/authFetch';
import { KYC_STATUS_ENDPOINT, classifyKycRefreshStatus } from '../lib/kycStatusRefresh';
import { useModalAccessibility } from '../lib/useModalAccessibility';
import { useTranslation } from 'react-i18next';

type Props = { isOpen: boolean; onSuccess: () => void; onCancel: () => void };
/** A status dialog must never simulate a successful identity check. */
export function BiometricsVerificationModal({ isOpen, onSuccess, onCancel }: Props) {
  const title = useId();
  const { t } = useTranslation();
  const { dialogRef, onKeyDown } = useModalAccessibility<HTMLDivElement>(onCancel, isOpen);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (!isOpen) return null;
  const check = async () => {
    setBusy(true); setMessage('');
    try {
      const response = await authFetch(KYC_STATUS_ENDPOINT, { method: 'GET', cache: 'no-store' });
      if (!response.ok) throw new Error('status unavailable');
      const result = classifyKycRefreshStatus((await response.json()) as unknown);
      if (result === 'approved') onSuccess();
      else setMessage(t(result === 'pending' ? 'kyc.photoPending' : 'kyc.statusUnavailable'));
    } catch { setMessage(t('kyc.statusUnavailable')); }
    finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
    <div ref={dialogRef} onKeyDown={onKeyDown} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={title} className="bg-surface text-ink max-w-md rounded-2xl p-6">
      <h2 id={title} className="text-xl font-bold">{t('kyc.photoTitle')}</h2>
      <p className="my-4">{t('kyc.photoDescription')}</p>
      <a href="/verifizierung" className="underline">{t('kyc.photoOpen')}</a>
      <p role="status" aria-live="polite">{message}</p>
      <div className="flex gap-4 mt-4">
        <button type="button" onClick={onCancel}>{t('actions.close')}</button>
        <button type="button" disabled={busy} onClick={check}>{busy ? t('kyc.statusChecking') : t('kyc.refresh')}</button>
      </div>
    </div>
  </div>;
}
