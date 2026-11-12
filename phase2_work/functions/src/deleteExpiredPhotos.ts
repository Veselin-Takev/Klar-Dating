import { getMaintenanceRepository } from './runtime';
import type { TenantAwareFirestoreRepository } from './firestoreRepository/TenantAwareFirestoreRepository';
import { recordSchema, timestampMillis } from './firestoreRepository/runtimeSchemas';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { info } from 'firebase-functions/logger';

/** VES-5: verification Storage deletion remains hard-disabled pending fencing review. */
export const deleteExpiredPhotosCron = onSchedule({
  region: 'europe-west3', schedule: 'every 24 hours', timeZone: 'UTC',
  timeoutSeconds: 300, memory: '256MiB', maxInstances: 1, retryCount: 3,
}, async () => {
  const removedFunnelEvents = await deleteExpiredTenantEvents(getMaintenanceRepository());
  info('verification_photo_p0_fencing_unverified', { removedFunnelEvents });
});

/** Bounded cleanup rechecks expiry transactionally; concurrent retention extensions win. */
export async function deleteExpiredTenantEvents(repo: TenantAwareFirestoreRepository, cutoff = new Date()) {
  const candidates = await repo.list('funnel_events', recordSchema, { where: ['expiresAt', '<=', cutoff], limit: 200 });
  return repo.transaction(async tx => {
    const current = await Promise.all(candidates.map(row => tx.read(`funnel_events/${row.id}`, recordSchema)));
    let removed = 0;
    current.forEach((data, index) => {
      if (!data || !(timestampMillis(data.expiresAt) <= cutoff.getTime())) return;
      tx.delete(`funnel_events/${candidates[index]!.id}`);
      removed += 1;
    });
    return removed;
  });
}
