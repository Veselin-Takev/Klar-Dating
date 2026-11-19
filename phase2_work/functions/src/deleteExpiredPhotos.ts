import { getMaintenanceDb } from './runtime';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import { info } from 'firebase-functions/logger';

/**
 * Legacy deployed entry-point retained to avoid an accidental Scheduler deletion
 * during a release. This job now only clears expired, non-biometric funnel events.
 *
 * NEVER use Storage upload time (`timeCreated`) to delete verification photos:
 * pending moderation decisions may be older than the 30-day upload timestamp.
 * Decision-based photo erasure is owned by purgeVerificationStorageCron through
 * the signed compliance API and verification_events.fotoLoeschenAb (#202).
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
  info('legacy_funnel_retention', {
    expiredEventsDeleted: expiredEvents.size,
    verificationPhotoDeletion: 'disabled_in_legacy_cron',
  });
});
