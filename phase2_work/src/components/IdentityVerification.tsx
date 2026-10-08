import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

export const IdentityVerification = ({ isVerified }: { isVerified?: boolean }) => {
  const { t } = useTranslation();
  return (
    <section aria-label={t('kyc.photoTitle')} className="rounded-2xl border border-line-ui p-5">
      <h4 className="font-medium">{isVerified ? t('kyc.approved') : t('profileSafety.verifyNow')}</h4>
      <p className="my-3">{isVerified ? t('profileSafety.verifiedDescription') : t('profileSafety.basicDescription')}</p>
      {!isVerified && <Link className="underline" to="/verifizierung">{t('profileSafety.viewVerification')}</Link>}
    </section>
  );
};
