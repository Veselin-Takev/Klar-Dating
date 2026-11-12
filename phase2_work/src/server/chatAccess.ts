import type { TenantAwareFirestoreRepository, TenantTransaction } from '../../functions/src/firestoreRepository/TenantAwareFirestoreRepository';
import { z } from 'zod';
const record = z.record(z.string(), z.unknown());
import { GATE_FRAGEN } from './pure';

export class ChatAccessError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export function validDocumentId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128
    && !/[\u0000-\u001f/]/.test(value) && value !== '.' && value !== '..';
}

/** Read access and block state in the same transaction as unknown chat mutation. */
export async function readChatAccess(_db: TenantAwareFirestoreRepository, tx: TenantTransaction, chatId: string, uid: string, requireOpen = false) {
  if (!validDocumentId(chatId) || !validDocumentId(uid)) {
    throw new ChatAccessError(400, 'invalid_chat', 'Ungültiges Gespräch.');
  }
  const ref = `chats/${chatId}`;
  const snapshot = await tx.read(ref, record);
  if (!snapshot) throw new ChatAccessError(404, 'chat_unavailable', 'Gespräch nicht verfügbar.');
  const data = snapshot;
  const participants: unknown = data.participants;
  if (!Array.isArray(participants) || participants.length !== 2 || participants[0] === participants[1]
    || !participants.every(validDocumentId) || !participants.includes(uid)) {
    throw new ChatAccessError(403, 'chat_forbidden', 'Kein Zugriff auf dieses Gespräch.');
  }
  const recipientId = participants.find(participant => participant !== uid) as string;
  const blocks = await Promise.all([
    tx.read(`blocks/${uid}_${recipientId}`, record), tx.read(`blocks/${recipientId}_${uid}`, record),
    tx.read(`account_deletions/${uid}`, record), tx.read(`account_deletions/${recipientId}`, record),
  ]);
  if (blocks.some(Boolean)) throw new ChatAccessError(403, 'chat_unavailable', 'Gespräch nicht verfügbar.');
  if (requireOpen && ![data.gateAntwortenA, data.gateAntwortenB].every(
    count => typeof count === 'number' && Number.isSafeInteger(count) && count >= GATE_FRAGEN,
  )) throw new ChatAccessError(403, 'gate_closed', 'Bitte zuerst die Gesprächsfragen abschließen.');
  return { ref, data, participants: participants as string[], recipientId };
}
