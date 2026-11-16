import { getMaintenanceDb } from './runtime';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import { info } from 'firebase-functions/logger';

export const deleteExpiredPhotosCron = onSchedule({
  region: 'europe-west3', schedule: 'every 24 hours', timeZone: 'UTC',
  timeoutSeconds: 300, memory: '256MiB', maxInstances: 1, retryCount: 3,
}, async () => {
  const db = getMaintenanceDb();
  const expiredEvents = await db.collection('funnel_events').where('expiresAt', '<=', Timestamp.now()).limit(400).get();
  const batch = db.batch();
  expiredEvents.docs.forEach(doc => batch.delete(doc.ref));
  if (!expiredEvents.empty) await batch.commit();
  // P0 fail-closed: this legacy schedule must never delete verification photos
  // by upload age. Decision-aware deletion is owned exclusively by
  // purgeVerificationStorageCron -> /api/admin/purge-verification-storage.
  info('legacy_verification_photo_sweep_disabled', { reason: 'decision_aware_worker_only' });
  info('funnel_event_retention', { deleted: expiredEvents.size });
});
