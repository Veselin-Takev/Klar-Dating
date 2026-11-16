import { getMaintenanceDb } from './runtime';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import { info } from 'firebase-functions/logger';

// Keep the scheduled export during the controlled migration window so an
// already-deployed scheduler does not become an orphan. The legacy
// upload-age-based photo deletion is intentionally disabled: age since upload
// is not proof that the verification decision's retention period has elapsed.
export const deleteExpiredPhotosCron = onSchedule({
  region: 'europe-west3', schedule: 'every 24 hours', timeZone: 'UTC',
  timeoutSeconds: 300, memory: '256MiB', maxInstances: 1, retryCount: 3,
}, async () => {
  const db = getMaintenanceDb();
  const now = new Date();

  // P0 fail-closed interlock: do not list or delete verification/ objects.
  // The decision-aware purge remains separately blocked until the
  // Firestore/GCS all-writer fence has independent staging proof.
  info('verification_photo_retention_disabled', {
    reason: 'legacy_upload_age_worker_not_authorized',
    deleted: 0,
    scanned: 0,
  });

  // Preserve the unrelated, bounded analytics-event cleanup behavior.
  const expiredEvents = await db.collection('funnel_events').where('expiresAt', '<=', Timestamp.now()).limit(400).get();
  const batch = db.batch();
  expiredEvents.docs.forEach(doc => batch.delete(doc.ref));
  if (!expiredEvents.empty) await batch.commit();
  info('funnel_event_retention', { deleted: expiredEvents.size, checkedAt: now.toISOString() });
});
