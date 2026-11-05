import { getMaintenanceDb } from './runtime';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import { info } from 'firebase-functions/logger';

/**
 * Backwards-compatible deployed function name only.
 *
 * P0 #202: the legacy GCS timeCreated purge had no verification-decision
 * authority and could delete still-pending photos. This scheduler must never
 * enumerate or delete verification objects. The independently configured
 * purgeVerificationStorageCron is the decision-aware integration path.
 *
 * Keep the export until SRE verifies deployed Scheduler/function/IAM state and
 * authorizes retirement. Removing an export does not safely disable an already
 * deployed Cloud Function or its Cloud Scheduler job.
 */
export const deleteExpiredPhotosCron = onSchedule({
  region: 'europe-west3', schedule: 'every 24 hours', timeZone: 'UTC',
  timeoutSeconds: 300, memory: '256MiB', maxInstances: 1, retryCount: 3,
}, async () => {
  info('legacy_verification_photo_purge_disabled', {
    reason: 'requires_authoritative_moderation_decision',
    replacement: 'purgeVerificationStorageCron',
  });

  // Unrelated, existing bounded funnel-event expiry remains active.
  const db = getMaintenanceDb();
  const expiredEvents = await db.collection('funnel_events')
    .where('expiresAt', '<=', Timestamp.now()).limit(400).get();
  if (expiredEvents.empty) {
    info('funnel_event_cleanup', { deleted: 0 });
    return;
  }
  const batch = db.batch();
  expiredEvents.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  info('funnel_event_cleanup', { deleted: expiredEvents.size });
});
