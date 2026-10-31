import { getMaintenanceDb } from './runtime';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import { info } from 'firebase-functions/logger';

/**
 * Legacy function export is intentionally preserved: removing a deployed
 * function requires a separately approved Scheduler / IAM migration.
 *
 * FAIL CLOSED: Do not delete verification photos on upload age alone.
 * The only authorized verification photo retention path is the
 * decision-aware purgeVerificationStorageCron and its audited API endpoint.
 * Keep the independent bounded funnel-events TTL fallback below.
 */
export const deleteExpiredPhotosCron = onSchedule({
  region: 'europe-west3', schedule: 'every 24 hours', timeZone: 'UTC',
  timeoutSeconds: 300, memory: '256MiB', maxInstances: 1, retryCount: 3,
}, async () => {
  const db = getMaintenanceDb();
  const expiredEvents = await db.collection('funnel_events')
    .where('expiresAt', '<=', Timestamp.now()).limit(400).get();
  if (!expiredEvents.empty) {
    const batch = db.batch();
    expiredEvents.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
  info('legacy_verification_photo_purge_disabled', {
    deletedVerificationPhotos: 0,
    decisionAwarePurge: 'purgeVerificationStorageCron',
    deletedExpiredFunnelEvents: expiredEvents.size,
  });
});
