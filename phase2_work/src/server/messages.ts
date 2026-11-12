import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { getServiceRepository } from './firestoreRepository/nativeDatabase';
const record = z.record(z.string(), z.unknown());
import { currentUserId } from './authorization';
import { ChatAccessError, readChatAccess, validDocumentId } from './chatAccess';
import { FieldValue } from './db';
import { recordActivation } from './platform/launchPlatform';
import { assessSafetyMessage } from './safetyService';
import { appendRepositoryAuditLog } from './platform/auditLog';

/**
 * Computes an immutable SHA-256 integrity hash for a chat message (DSA Art. 16 compliance).
 */
export function computeMessageHash(senderId: string, chatId: string, text: string, messageId: string): string {
  return crypto.createHash('sha256').update(`${senderId}:${chatId}:${text}:${messageId}`).digest('hex');
}

export async function handleSendMessage(req: Request, res: Response): Promise<void> {
  const uid = currentUserId(req);
  if (!uid) { res.status(401).json({ error: 'Bitte anmelden.' }); return; }
  const { chatId, text, clientMessageId } = req.body ?? {};
  // Derive sender identity solely from the verified Firebase token. Reject
  // conflicting legacy/offline sender claims rather than silently attributing
  // another account's queued content to the currently signed-in account.
  const body = req.body ?? {};
  if ([body.uid, body.ownerUid, body.senderId].some(claim => claim !== undefined && claim !== uid)) {
    res.status(403).json({ error: 'Absender gehört nicht zur angemeldeten Sitzung.', code: 'sender_mismatch' });
    return;
  }
  if (!validDocumentId(chatId) || typeof text !== 'string' || !text.trim() || text.length > 4000
    || (clientMessageId !== undefined && (typeof clientMessageId !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(clientMessageId)))) {
    res.status(400).json({ error: 'Ungültige Nachricht.' }); return;
  }
  try {
    const db = getServiceRepository('auth');
    const messageId = clientMessageId ? `${uid}_${clientMessageId}` : crypto.randomUUID();
    const message = `chats/${chatId}/messages/${messageId}`;

    // Verify access *before* a retry can receive any stored message receipt.
    // When the first write succeeded but its HTTP acknowledgement was lost,
    // do not depend on an external AI provider to confirm that same write.
    // New messages still undergo the full safety gate and transaction check.
    const prior = await db.transaction(async tx => {
      await readChatAccess(db, tx, chatId, uid, true);
      return clientMessageId ? tx.read(message, record) : null;
    });
    if (prior !== null) {
      if (prior?.senderId !== uid || prior?.text !== text) {
        throw new ChatAccessError(409, 'message_conflict', 'Diese Nachrichten-ID wurde bereits verwendet.');
      }
      const hash = prior?.contentHash || computeMessageHash(uid, chatId, text, messageId);
      res.json({ success: true, messageId: messageId, messageHash: hash, translated: false, isFallback: false });
      return;
    }

    const safety = await assessSafetyMessage(text);
    if (!safety.checked) {
      res.status(safety.status).json({ error: 'Die Sicherheitsprüfung ist derzeit nicht verfügbar.', code: safety.code });
      return;
    }
    if (safety.flagged) {
      void appendRepositoryAuditLog(db, { type: 'safety_message_blocked', actorUid: uid }).catch(() => {});
      res.status(422).json({
        error: 'Die Nachricht wurde aus Sicherheitsgründen nicht gesendet.',
        code: 'message_flagged',
        explanation: safety.explanation,
        suggestions: safety.suggestions,
      });
      return;
    }
    let contentHash = '';

    await db.transaction(async tx => {
      await readChatAccess(db, tx, chatId, uid, true);
      const existing = await tx.read(message, record);
      if (existing !== null) {
        if (existing?.senderId !== uid || existing?.text !== text) {
          throw new ChatAccessError(409, 'message_conflict', 'Diese Nachrichten-ID wurde bereits verwendet.');
        }
        contentHash = typeof existing?.contentHash === 'string' ? existing.contentHash : computeMessageHash(uid, chatId, text, messageId);
        return;
      }
      contentHash = computeMessageHash(uid, chatId, text, messageId);
      // Sending always preserves the original. Translation is an explicit reading action.
      // DSA Art. 16: Immutable content receipt with cryptographic SHA-256 digest
      tx.create(message, record, {
        senderId: uid,
        text,
        createdAt: FieldValue.serverTimestamp(),
        // Firestore TTL only acts on documents carrying the configured field.
        // Keep the retention deadline on the message itself so both active and
        // archived message copies inherit the same deletion boundary.
        expiresAt: new Date(Date.now() + 90 * 86400_000),
        isRead: false,
        contentHash,
        immutable: true,
      });
    });
    void recordActivation(db, uid, 'first_conversation', `first_conversation_${uid}_${chatId}`).catch(() => {});
    res.json({ success: true, messageId: messageId, messageHash: contentHash, translated: false, isFallback: false });
  } catch (error) {
    if (error instanceof ChatAccessError) {
      res.status(error.status).json({ error: error.message, code: error.code }); return;
    }
    console.error('Message persistence failed');
    res.status(503).json({ error: 'Die Nachricht konnte nicht gespeichert werden. Bitte erneut versuchen.' });
  }
}
