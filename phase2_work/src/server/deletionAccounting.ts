import { createHash } from 'node:crypto';
import type { Firestore, Query, DocumentReference, Transaction } from 'firebase-admin/firestore';
import { FieldValue, runObservedTransaction } from './db';

export const emptyDeletionCounts = () => ({
  chats: 0, nachrichten: 0, gateAntworten: 0, verbindungen: 0,
  kontakte: 0, eigeneMeldungen: 0, pseudonymisiert: 0,
});
export type DeletionCounts = ReturnType<typeof emptyDeletionCounts>;
export type DeletionCounter = keyof DeletionCounts;

export function readDeletionCounts(data: Record<string, unknown>): DeletionCounts {
  if (data.accountingVersion !== 2 || !data.deletedCounts || typeof data.deletedCounts !== 'object') {
    throw new Error('deletion_accounting_migration_required');
  }
  const source = data.deletedCounts as Record<string, unknown>;
  const counts = emptyDeletionCounts();
  for (const key of Object.keys(counts) as DeletionCounter[]) {
    const value = source[key];
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
      throw new Error('deletion_accounting_invalid');
    }
    counts[key] = value;
  }
  return counts;
}

export const deletionReceiptId = (requestId: string) =>
  createHash('sha256').update(`deletion-receipt:${requestId}`, 'utf8').digest('hex');

export function buildDeletionAuditReceipt(bericht: DeletionCounts, completedAt = new Date()) {
  return {
    schemaVersion: 2, status: 'completed' as const, completedAt,
    expiresAt: new Date(completedAt.getTime() + 30 * 86_400_000),
    deletedChats: bericht.chats, deletedMessages: bericht.nachrichten,
    deletedGateAnswers: bericht.gateAntworten, deletedConnections: bericht.verbindungen,
    deletedContacts: bericht.kontakte, deletedOwnReports: bericht.eigeneMeldungen,
    pseudonymizedReports: bericht.pseudonymisiert,
  };
}

/** Counted mutations and their cumulative totals share one Firestore transaction. */
export function deletionAccounting(db: Firestore, uid: string, requestId: string, lease?: string) {
  const ref = db.doc(`account_deletions/${uid}`);
  async function readJob(tx: Transaction) {
    const data = (await tx.get(ref)).data();
    if (!data || data.status !== 'pending' || data.requestId !== requestId) throw new Error('deletion_job_mismatch');
    if (lease && (data.lease !== lease || typeof data.leaseUntil !== 'number' || !Number.isFinite(data.leaseUntil) || data.leaseUntil <= Date.now())) throw new Error('deletion_lease_lost');
    return readDeletionCounts(data);
  }
  function writeCount(tx: Transaction, counts: DeletionCounts, key: DeletionCounter, amount: number) {
    const total = counts[key] + amount;
    if (!Number.isSafeInteger(total)) throw new Error('deletion_accounting_overflow');
    tx.update(ref, { deletedCounts: { ...counts, [key]: total } });
  }
  return {
    verify: () => runObservedTransaction(db, 'deletionAccounting.verify', readJob),
    deleteQuery: (query: Query, key: DeletionCounter) => runObservedTransaction(db, 'deletionAccounting.deleteQuery', async tx => {
      const counts = await readJob(tx);
      const snapshot = await tx.get(query.limit(400));
      if (!snapshot.empty) {
        snapshot.docs.forEach(doc => tx.delete(doc.ref));
        writeCount(tx, counts, key, snapshot.size);
      }
      return snapshot.size;
    }),
    deleteChat: (chat: DocumentReference) => runObservedTransaction(db, 'deletionAccounting.deleteChat', async tx => {
      const counts = await readJob(tx);
      const snapshot = await tx.get(chat);
      if (!snapshot.exists) return 0;
      if (!snapshot.data()?.participants?.includes(uid)) throw new Error('deletion_chat_owner_mismatch');
      tx.delete(chat);
      writeCount(tx, counts, 'chats', 1);
      return 1;
    }),
    pseudonymizeReports: (query: Query) => runObservedTransaction(db, 'deletionAccounting.pseudonymizeReports', async tx => {
      const counts = await readJob(tx);
      const snapshot = await tx.get(query.limit(400));
      if (!snapshot.empty) {
        snapshot.docs.forEach(doc => tx.update(doc.ref, {
          reportedProfileId: FieldValue.delete(), reportedGeloeschtAm: FieldValue.serverTimestamp(),
        }));
        writeCount(tx, counts, 'pseudonymisiert', snapshot.size);
      }
      return snapshot.size;
    }),
  };
}
