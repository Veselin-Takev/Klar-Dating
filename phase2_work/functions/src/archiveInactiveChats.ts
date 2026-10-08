import { getMaintenanceDb } from './runtime';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import { info } from 'firebase-functions/logger';

/** Bounded cursor scan, 200 messages = 400 writes per transaction. */
export const archiveInactiveMessagesCron = onSchedule({
  region: 'europe-west3', schedule: '0 3 * * *', timeZone: 'UTC',
  memory: '256MiB', timeoutSeconds: 300, maxInstances: 1, retryCount: 3,
}, async () => {
  // Archiving alters history visibility; enable only after the retention policy is approved.
  if (process.env.ENABLE_CHAT_ARCHIVAL !== 'true') return;
  const db = getMaintenanceDb();
  const state = db.collection('system').doc('chat_archival');
  const cursor = (await state.get()).data()?.cursor as string | undefined;
  let query = db.collection('chats').orderBy('__name__').limit(50);
  if (cursor) query = query.startAfter(cursor);
  const chats = await query.get();
  const cutoff = Timestamp.fromMillis(Date.now() - 30 * 86_400_000);
  let archived = 0;
  for (const chat of chats.docs) {
    const result = await db.runTransaction(async tx => {
      // Concurrent account deletion must not recreate an orphan archive.
      const current = await tx.get(chat.ref);
      if (!current.exists) return 0;
      const participants = current.data()?.participants as string[] | undefined;
      if (!participants || participants.length !== 2) return 0;
      const deletions = await tx.getAll(...participants.map(uid => db.collection('account_deletions').doc(uid)));
      if (deletions.some(deletion => deletion.exists)) return 0;
      const old = await tx.get(chat.ref.collection('messages').where('createdAt', '<=', cutoff).limit(200));
      for (const message of old.docs) {
        tx.set(chat.ref.collection('archived_messages').doc(message.id), { ...message.data(), archivedAt: Timestamp.now() });
        tx.delete(message.ref);
      }
      return old.size;
    });
    archived += result;
    await state.set({ cursor: chat.id });
  }
  if (chats.size < 50) await state.set({ cursor: null });
  info('message_archival', { archived, scannedChats: chats.size });
});
