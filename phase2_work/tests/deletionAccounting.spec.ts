// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { getDb } from '../src/server/db';
import { deletionAccounting, emptyDeletionCounts, buildDeletionAuditReceipt } from '../src/server/deletionAccounting';

const cleanup: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const path of cleanup.splice(0)) await getDb().recursiveDelete(getDb().doc(path));
});
async function fixture() {
  const db = getDb(); const uid = `count-${randomUUID()}`; const requestId = randomUUID();
  const job = db.doc(`account_deletions/${uid}`); const chat = db.doc(`chats/${uid}`);
  cleanup.push(job.path, chat.path);
  await job.set({ requestId, status: 'pending', accountingVersion: 2, deletedCounts: emptyDeletionCounts() });
  await chat.set({ participants: [uid] });
  await chat.collection('messages').doc('one').set({ text: 'synthetic' });
  return { db, uid, requestId, job, chat, accounting: deletionAccounting(db, uid, requestId) };
}
describe('atomic cumulative deletion accounting', () => {
  it('counts existing documents once across overlapping transactions and replay', async () => {
    const { accounting, chat, job } = await fixture();
    await Promise.all([accounting.deleteQuery(chat.collection('messages'), 'nachrichten'), accounting.deleteQuery(chat.collection('messages'), 'nachrichten')]);
    expect(await accounting.deleteQuery(chat.collection('messages'), 'nachrichten')).toBe(0);
    expect((await job.get()).data()?.deletedCounts.nachrichten).toBe(1);
    expect((await chat.collection('messages').get()).empty).toBe(true);
  });
  it('rolls back deletions and counters together if the transaction callback fails', async () => {
    const { db, accounting, chat, job } = await fixture();
    const original = db.runTransaction.bind(db);
    vi.spyOn(db, 'runTransaction').mockImplementationOnce(fn => original(async tx => {
      await fn(tx); throw new Error('injected before commit');
    }));
    await expect(accounting.deleteQuery(chat.collection('messages'), 'nachrichten')).rejects.toThrow('injected before commit');
    expect((await chat.collection('messages').doc('one').get()).exists).toBe(true);
    expect((await job.get()).data()?.deletedCounts.nachrichten).toBe(0);
    await accounting.deleteQuery(chat.collection('messages'), 'nachrichten');
    expect((await job.get()).data()?.deletedCounts.nachrichten).toBe(1);
  });
  it('does not double-count when a committed transaction response is lost', async () => {
    const { db, accounting, chat, job } = await fixture();
    const original = db.runTransaction.bind(db);
    vi.spyOn(db, 'runTransaction').mockImplementationOnce(async fn => {
      await original(fn); throw new Error('response lost after commit');
    });
    await expect(accounting.deleteQuery(chat.collection('messages'), 'nachrichten')).rejects.toThrow('response lost after commit');
    expect((await job.get()).data()?.deletedCounts.nachrichten).toBe(1);
    expect(await accounting.deleteQuery(chat.collection('messages'), 'nachrichten')).toBe(0);
    expect((await job.get()).data()?.deletedCounts.nachrichten).toBe(1);
  });

  it('rejects legacy or mismatched jobs before any destructive mutation', async () => {
    const { db, uid, accounting, chat, job } = await fixture();
    await expect(deletionAccounting(db, uid, 'other-request').deleteChat(chat)).rejects.toThrow('deletion_job_mismatch');
    await job.update({ accountingVersion: 1 });
    await expect(accounting.deleteQuery(chat.collection('messages'), 'nachrichten')).rejects.toThrow('deletion_accounting_migration_required');
    expect((await chat.collection('messages').doc('one').get()).exists).toBe(true);
  });
  it('rejects replaced, expired and malformed leases without deleting data', async () => {
    const { db, uid, requestId, chat, job } = await fixture();
    const accounting = deletionAccounting(db, uid, requestId, 'owned');
    for (const lease of [
      { lease: 'replacement', leaseUntil: Date.now() + 60_000 },
      { lease: 'owned', leaseUntil: Date.now() - 1 },
      { lease: 'owned', leaseUntil: 'invalid' },
    ]) {
      await job.update(lease);
      await expect(accounting.deleteQuery(chat.collection('messages'), 'nachrichten')).rejects.toThrow('deletion_lease_lost');
      expect((await chat.collection('messages').doc('one').get()).exists).toBe(true);
      expect((await job.get()).data()?.deletedCounts.nachrichten).toBe(0);
    }
  });

  it('keeps the final receipt restricted to counters and expiry metadata', () => {
    const receipt = buildDeletionAuditReceipt({ ...emptyDeletionCounts(), chats: 51, nachrichten: 102 });
    expect(receipt).toMatchObject({ schemaVersion: 2, status: 'completed', deletedChats: 51, deletedMessages: 102 });
    expect(Object.keys(receipt).sort()).toEqual(['schemaVersion','status','completedAt','expiresAt','deletedChats','deletedMessages','deletedGateAnswers','deletedConnections','deletedContacts','deletedOwnReports','pseudonymizedReports'].sort());
  });
});
