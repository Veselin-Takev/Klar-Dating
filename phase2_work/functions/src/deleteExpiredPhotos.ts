import { getMaintenanceDb } from './runtime';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import { info } from 'firebase-functions/logger';

/**
 * Legacy scheduler retained under its existing export name to avoid an
 * unplanned function deletion during deployment. Its upload-age-based photo
 * deletion is intentionally disabled: retention must be driven by a verified
 * moderation decision and the separately reviewed, fenced purge workflow.
 *
 * This function continues the unrelated funnel-event cleanup only.
 */
export const deleteExpiredPhotosCron = onSchedule({
  region: 'europe-west3', schedule: 'every 24 hours', timeZone: 'UTC',
  timeoutSeconds: 300, memory: '256MiB', maxInstances: 1, retryCount: 3,
}, async () => {
  const db = getMaintenanceDb();

  // Do not list or delete verification/ objects here. Storage object age is
  // not evidence that moderation is complete or that the retention deadline
  // has elapsed. Keep this scheduler export stable until an approved,
  // separately planned Scheduler migration removes it.
  info('verification_photo_retention_disabled_legacy_worker', {
    deleted: 0,
    scanned: 0,
    reason: 'decision_aware_fenced_purge_required',
  });

  // Preserve the independent, non-photo funnel-event cleanup.
  const expiredEvents = await db.collection('funnel_events')
    .where('expiresAt', '<=', Timestamp.now())
    .limit(400)
    .get();
  const batch = db.batch();
  expiredEvents.docs.forEach(doc => batch.delete(doc.ref));
  if (!expiredEvents.empty) await batch.commit();
  info('funnel_event_retention', { deleted: expiredEvents.size });
});
