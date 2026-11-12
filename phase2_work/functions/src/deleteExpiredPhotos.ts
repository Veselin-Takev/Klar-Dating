import { getMaintenanceDb } from './runtime';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import { info } from 'firebase-functions/logger';

/**
 * VES-5: legacy upload-age verification-photo deletion is hard-disabled.
 * This scheduled task continues only the independent expired funnel-event
 * cleanup. Deletion of verification Storage objects requires the separately
 * reviewed and currently blocked cross-service fencing protocol.
 */
export const deleteExpiredPhotosCron = onSchedule({
  region: 'europe-west3', schedule: 'every 24 hours', timeZone: 'UTC',
  timeoutSeconds: 300, memory: '256MiB', maxInstances: 1, retryCount: 3,
}, async () => {
  const db = getMaintenanceDb();
  const expiredEvents = await db.collection('funnel_events').where('expiresAt', '<=', Timestamp.now()).limit(400).get();
  const batch = db.batch();
  expiredEvents.docs.forEach(doc => batch.delete(doc.ref));
  if (!expiredEvents.empty) await batch.commit();
  info('verification_photo_p0_fencing_unverified', { removedFunnelEvents: expiredEvents.size });
});
