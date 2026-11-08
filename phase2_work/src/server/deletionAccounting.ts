import { createHash } from 'node:crypto';
import type { TenantAwareFirestoreRepository, TenantTransaction, TenantQuery } from '../../functions/src/firestoreRepository/TenantAwareFirestoreRepository';
import { z } from 'zod';
import { FieldValue } from './db';

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

export interface TenantSelection {path: string; where?: TenantQuery['where']}
const record = z.record(z.string(), z.unknown());
/** Every destructive mutation and its accounting share the same tenant/lease transaction. */
export function deletionAccounting(db: TenantAwareFirestoreRepository, uid: string, requestId: string, lease?: string) {
  const ref = `account_deletions/${uid}`;
  async function readJob(tx: TenantTransaction) {
    const data = await tx.read(ref, record);
    if (!data || data.status !== 'pending' || data.requestId !== requestId) throw new Error('deletion_job_mismatch');
    if (lease && (data.lease !== lease || typeof data.leaseUntil !== 'number' || !Number.isFinite(data.leaseUntil) || data.leaseUntil <= Date.now())) throw new Error('deletion_lease_lost');
    return readDeletionCounts(data);
  }
  function writeCount(tx: TenantTransaction, counts: DeletionCounts, key: DeletionCounter, amount: number) {
    const total = counts[key] + amount;
    if (!Number.isSafeInteger(total)) throw new Error('deletion_accounting_overflow');
    tx.write(ref, record, {deletedCounts: {...counts, [key]: total}}, {merge:true});
  }
  async function deleteQuery(query: TenantSelection, key?: DeletionCounter) {
    return db.transaction(async tx => {
      const counts = await readJob(tx);
      const rows = await tx.list(query.path, record, {limit:200, ...(query.where ? {where:query.where} : {})});
      for (const row of rows) tx.delete(`${query.path}/${row.id}`);
      if (key && rows.length) writeCount(tx, counts, key, rows.length);
      return rows.length;
    });
  }
  return {
    verify: () => db.transaction(readJob),
    deleteQuery,
    deleteDocument: (path: string) => db.transaction(async tx => {await readJob(tx); tx.delete(path);}),
    deleteChat: (chat: string) => db.transaction(async tx => {
      const counts = await readJob(tx), current = await tx.read(chat, record);
      if (!current) return 0;
      if (!Array.isArray(current.participants) || !current.participants.includes(uid)) throw new Error('deletion_chat_owner_mismatch');
      tx.delete(chat); writeCount(tx, counts, 'chats', 1); return 1;
    }),
    pseudonymizeReports: (query: TenantSelection) => db.transaction(async tx => {
      const counts = await readJob(tx);
      const rows = await tx.list(query.path, record, {limit:200, ...(query.where ? {where:query.where} : {})});
      for (const row of rows) tx.write(`${query.path}/${row.id}`, record, {reportedProfileId:FieldValue.delete(), reportedGeloeschtAm:FieldValue.serverTimestamp()}, {merge:true});
      if (rows.length) writeCount(tx, counts, 'pseudonymisiert', rows.length);
      return rows.length;
    }),
    scrubQuery: (query: TenantSelection, field: string) => db.transaction(async tx => {
      await readJob(tx);
      const rows = await tx.list(query.path, record, {limit:200, ...(query.where ? {where:query.where} : {})});
      for (const row of rows) tx.write(`${query.path}/${row.id}`, record, {[field]:FieldValue.delete()}, {merge:true});
      return rows.length;
    }),
  };
}
