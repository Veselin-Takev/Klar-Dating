import { getMaintenanceDb } from './runtime';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import { info } from 'firebase-functions/logger';

// Audit A-01: Storage deletion based on creation time is forbidden.
// The separately signed decision-bound purgeVerificationStorageCron is the only
// scheduled verification photo purge; retain this export for funnel event cleanup.
export const deleteExpiredPhotosCron = onSchedule({
  region: 'europe-west3', schedule: 'every 24 hours', timeZone: 'UTC',
  timeoutSeconds: 300, memory: '256MiB', maxInstances: 1, retryCount: 3,
}, async () => {
  const db = getMaintenanceDb();
  const expiredEvents = await db.collection('funnel_events').where('expiresAt', '<=', Timestamp.now()).limit(400).get();
  const batch = db.batch();
  expiredEvents.docs.forEach(doc => batch.delete(doc.ref));
  if (!expiredEvents.empty) await batch.commit();
  info('funnel_event_retention', { deleted: expiredEvents.size, backlogPossible: expiredEvents.size === 400 });
});
