import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { currentUserId } from './authorization';
import { ChatAccessError, readChatAccess, validDocumentId } from './chatAccess';
import { getDb, FieldValue } from './db';
import { recordActivation } from './platform/launchPlatform';
import { assessSafetyMessage } from './safetyService';
import { appendAuditLog } from './platform/auditLog';

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
  if (!validDocumentId(chatId) || typeof text !== 'string' || !text.trim() || text.length > 4000
    || (clientMessageId !== undefined && (typeof clientMessageId !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(clientMessageId)))) {
    res.status(400).json({ error: 'Ungültige Nachricht.' }); return;
  }
  try {
    const db = getDb() as Firestore;
    // Authorize before spending AI quota, then re-check inside the write transaction
    // so a block/gate change during the external safety call cannot race persistence.
    await db.runTransaction(tx => readChatAccess(db, tx, chatId, uid, true));

    const safety = await assessSafetyMessage(text);
    if (!safety.checked) {
      res.status(safety.status).json({ error: 'Die Sicherheitsprüfung ist derzeit nicht verfügbar.', code: safety.code });
      return;
    }
    if (safety.flagged) {
      void appendAuditLog(db, { type: 'safety_message_blocked', actorUid: uid }).catch(() => {});
      res.status(422).json({
        error: 'Die Nachricht wurde aus Sicherheitsgründen nicht gesendet.',
        code: 'message_flagged',
        explanation: safety.explanation,
        suggestions: safety.suggestions,
      });
      return;
    }
    const messages = db.collection('chats').doc(chatId).collection('messages');
    const message = clientMessageId ? messages.doc(`${uid}_${clientMessageId}`) : messages.doc();
    let contentHash = '';

    await db.runTransaction(async (tx: Transaction) => {
      await readChatAccess(db, tx, chatId, uid, true);
      const existing = await tx.get(message);
      if (existing.exists) {
        if (existing.data()?.senderId !== uid || existing.data()?.text !== text) {
          throw new ChatAccessError(409, 'message_conflict', 'Diese Nachrichten-ID wurde bereits verwendet.');
        }
        contentHash = existing.data()?.contentHash || computeMessageHash(uid, chatId, text, message.id);
        return;
      }
      contentHash = computeMessageHash(uid, chatId, text, message.id);
      // Sending always preserves the original. Translation is an explicit reading action.
      // DSA Art. 16: Immutable content receipt with cryptographic SHA-256 digest
      tx.create(message, {
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
    res.json({ success: true, messageId: message.id, messageHash: contentHash, translated: false, isFallback: false });
  } catch (error) {
    if (error instanceof ChatAccessError) {
      res.status(error.status).json({ error: error.message, code: error.code }); return;
    }
    console.error('Message persistence failed');
    res.status(503).json({ error: 'Die Nachricht konnte nicht gespeichert werden. Bitte erneut versuchen.' });
  }
}
