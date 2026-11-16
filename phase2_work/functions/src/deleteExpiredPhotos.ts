import { getMaintenanceDb } from './runtime';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import { info } from 'firebase-functions/logger';

// Keep the scheduled function identity/export stable so deploying this source
// does not implicitly delete or rename an existing Cloud Function. The legacy
// upload-age photo deletion is intentionally disabled: it is not authorized
// by the verification decision/retention record and can erase pending KYC data.
export const deleteExpiredPhotosCron = onSchedule({
  region: 'europe-west3', schedule: 'every 24 hours', timeZone: 'UTC',
  timeoutSeconds: 300, memory: '256MiB', maxInstances: 1, retryCount: 3,
}, async () => {
  const db = getMaintenanceDb();

  // P0 VES-5 containment: never list or delete verification Storage objects
  // from this legacy upload-age scheduler. The decision-aware purge endpoint
  // remains independently hard-stopped until all-writer Firestore/GCS fencing
  // and DPO/Legal-approved Art. 17 handling are proven.
  info('verification_photo_retention_disabled', {
    reason: 'decision_aware_all_writer_fencing_unverified',
    photoDeletionAttempted: false,
  });

  // Preserve the unrelated, bounded funnel-event expiry cleanup.
  const expiredEvents = await db.collection('funnel_events')
    .where('expiresAt', '<=', Timestamp.now()).limit(400).get();
  const batch = db.batch();
  expiredEvents.docs.forEach(doc => batch.delete(doc.ref));
  if (!expiredEvents.empty) await batch.commit();
  info('funnel_event_retention', { deleted: expiredEvents.size });
});
