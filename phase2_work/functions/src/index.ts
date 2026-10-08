import { getApps, initializeApp } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions/v2';
import { createHmac } from 'node:crypto';
import { defineSecret, defineString } from 'firebase-functions/params';
import { onSchedule } from 'firebase-functions/v2/scheduler';

setGlobalOptions({ region: 'europe-west3', maxInstances: 1, concurrency: 1 });
if (!getApps().length) initializeApp();
export { archiveInactiveMessagesCron } from './archiveInactiveChats';
export { deleteExpiredPhotosCron } from './deleteExpiredPhotos';
export { retryComplianceJobsCron } from './complianceJobs';
export { sendDateRemindersCron } from './dateReminders';
export { purgeVerificationStorageCron } from './purgeVerificationStorage';

const kycReconciliationSecret = defineSecret('KYC_RECONCILIATION_JOB_SECRET');
const klarApiOrigin = defineString('KLAR_API_ORIGIN', { description: 'HTTPS origin of the Klar API; no path or credentials.' });

export const reconcileDiditKycCron = onSchedule({
  region: 'europe-west3', schedule: 'every 15 minutes', timeZone: 'UTC',
  memory: '256MiB', timeoutSeconds: 120, maxInstances: 1, retryCount: 2,
  secrets: [kycReconciliationSecret],
}, async () => {
  const origin = klarApiOrigin.value();
  const secret = kycReconciliationSecret.value();
  if (!origin || secret.length < 32) throw new Error('Invalid KYC reconciliation configuration');
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.origin !== origin) throw new Error('KLAR_API_ORIGIN must be an HTTPS origin without a path');
  const body = JSON.stringify({ timestamp: Date.now() });
  const signature = createHmac('sha256', secret).update(body).digest('hex');
  const response = await fetch(`${origin}/internal/kyc/reconcile`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(100_000),
    headers: { 'content-type': 'application/json', 'X-Klar-Job-Signature': signature }, body,
  });
  if (!response.ok) throw new Error('KYC reconciliation worker unavailable');
});
