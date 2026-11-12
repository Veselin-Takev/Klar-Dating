import type { TenantAwareFirestoreRepository } from './firestoreRepository/TenantAwareFirestoreRepository';
import { getMaintenanceRepository } from './runtime';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { info } from 'firebase-functions/logger';

const record = {parse(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('archive_record_invalid');
  return value as Record<string, unknown>;
}};
/** Bounded tenant-local scan; no root or global collection-group fallback. */
export const archiveInactiveMessagesCron = onSchedule({
  region: 'europe-west3', schedule: '0 3 * * *', timeZone: 'UTC',
  memory: '256MiB', timeoutSeconds: 300, maxInstances: 1, retryCount: 3,
}, async () => {
  if (process.env.ENABLE_CHAT_ARCHIVAL !== 'true') return;
  await archiveTenantMessages(getMaintenanceRepository());
});


export async function archiveTenantMessages(repo: TenantAwareFirestoreRepository, cutoff = new Date(Date.now() - 30 * 86_400_000)) {
  const statePath = 'system/chat_archival';
  const state = await repo.read(statePath, record);
  const cursor = state?.cursor;
  if (cursor != null && typeof cursor !== 'string') throw new Error('archive_cursor_invalid');
  const chats = await repo.list('chats', record, {orderBy:'__name__', limit:50, ...(typeof cursor === 'string' ? {startAfter:cursor} : {})});
  let archived = 0;
  for (const chat of chats) {
    archived += await repo.transaction(async tx => {
      const path = `chats/${chat.id}`;
      const current = await tx.read(path, record);
      if (!current) return 0;
      const participants = current.participants;
      if (!Array.isArray(participants) || participants.length !== 2 || !participants.every((uid): uid is string => typeof uid === 'string')) return 0;
      const deletions = await Promise.all(participants.map(uid => tx.read(`account_deletions/${uid}`, record)));
      if (deletions.some(Boolean)) return 0;
      const old = await tx.list(`${path}/messages`, record, {where:['createdAt','<=',cutoff], limit:200});
      for (const message of old) {
        tx.write(`${path}/archived_messages/${message.id}`, record, {...message.data, archivedAt:new Date()});
        tx.delete(`${path}/messages/${message.id}`);
      }
      return old.length;
    });
    await repo.write(statePath, record, {cursor:chat.id});
  }
  if (chats.length < 50) await repo.write(statePath, record, {cursor:null});
  info('message_archival', {archived, scannedChats:chats.length});
  return archived;
}
