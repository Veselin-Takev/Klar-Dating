// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { getDb } from '../src/server/db';
import { TenantAwareFirestoreRepository } from '../functions/src/firestoreRepository/TenantAwareFirestoreRepository';
import { archiveTenantMessages } from '../functions/src/archiveInactiveChats';
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (process.env.CI === 'true' && !host) throw new Error('tenant_batch_emulator_required');
if (host && !/^(localhost|127\.0\.0\.1|\[::1\]):[0-9]+$/.test(host)) throw new Error('tenant_batch_unsafe_target');
describe.runIf(Boolean(host))('Batch A native tenant archival', () => {
  it.each([false, true])('isolates job query/transaction/cursor with deletion pending=%s', async pending => {
    const db = getDb(), suffix = randomUUID();
    const a = 'batch-a-' + suffix, b = 'batch-b-' + suffix, chat = 'chat-' + suffix;
    const root = db.doc(`chats/${chat}`);
    for (const prefix of [`tenants/${a}/`, `tenants/${b}/`, '']) {
      await db.doc(`${prefix}chats/${chat}`).set({participants:['alice','bob']});
      await db.doc(`${prefix}chats/${chat}/messages/old`).set({createdAt:new Date('2000-01-01'), text:'synthetic'});
    }
    if (pending) await db.doc(`tenants/${a}/account_deletions/alice`).set({status:'pending'});
    try {
      const archived = await archiveTenantMessages(new TenantAwareFirestoreRepository(db, a));
      expect(archived).toBe(pending ? 0 : 1);
      expect((await db.doc(`tenants/${a}/chats/${chat}/messages/old`).get()).exists).toBe(pending);
      expect((await db.doc(`tenants/${a}/chats/${chat}/archived_messages/old`).get()).exists).toBe(!pending);
      expect((await db.doc(`tenants/${b}/chats/${chat}/messages/old`).get()).exists).toBe(true);
      expect((await root.collection('messages').doc('old').get()).exists).toBe(true);
      expect((await db.doc(`tenants/${a}/system/chat_archival`).get()).data()?.cursor).toBeNull();
      expect((await db.doc(`tenants/${b}/system/chat_archival`).get()).exists).toBe(false);
    } finally {
      await Promise.all([db.recursiveDelete(db.doc(`tenants/${a}`)),db.recursiveDelete(db.doc(`tenants/${b}`)),db.recursiveDelete(root)]);
    }
  });
});
