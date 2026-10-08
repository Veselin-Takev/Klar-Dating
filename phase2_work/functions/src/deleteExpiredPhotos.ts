import { getMaintenanceBucket, getMaintenanceDb } from './runtime';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import { info } from 'firebase-functions/logger';
import { deleteExpiredPhotoPage } from './retention';

export const deleteExpiredPhotosCron = onSchedule({
  region: 'europe-west3', schedule: 'every 24 hours', timeZone: 'UTC',
  timeoutSeconds: 300, memory: '256MiB', maxInstances: 1, retryCount: 3,
}, async () => {
  const db = getMaintenanceDb();
  const state = db.collection('system').doc('photo_retention');
  let pageToken = (await state.get()).data()?.pageToken as string | undefined;
  let deleted = 0;
  let scanned = 0;
  const now = new Date();
  // Checkpoint at each page, at most 2000 objects per invocation.
  for (let page = 0; page < 10; page++) {
    const result = await deleteExpiredPhotoPage(getMaintenanceBucket(), now, pageToken);
    deleted += result.deleted;
    scanned += result.scanned;
    pageToken = result.nextPageToken;
    await state.set({ pageToken: pageToken ?? null, checkedAt: now });
    if (!pageToken) break;
  }
  const expiredEvents = await db.collection('funnel_events').where('expiresAt', '<=', Timestamp.now()).limit(400).get();
  const batch = db.batch();
  expiredEvents.docs.forEach(doc => batch.delete(doc.ref));
  if (!expiredEvents.empty) await batch.commit();
  info('verification_photo_retention', { deleted, scanned, backlog: Boolean(pageToken) });
});
