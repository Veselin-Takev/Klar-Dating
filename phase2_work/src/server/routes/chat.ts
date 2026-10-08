import { Router, type Request, type Response, type NextFunction } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import crypto from 'node:crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { getDb } from '../db';
import { currentUserId } from '../authorization';
import { ChatAccessError, readChatAccess, validDocumentId } from '../chatAccess';
import { handleSendMessage } from '../messages';
import { handleGateAnswer, handleGateStatus } from '../gate';
import { toPublicProfile } from '../platform/launchPlatform';

const CHAT_MESSAGE_RATE_LIMIT_COLLECTION = 'chat_message_rate_limits';
const CHAT_MESSAGE_RATE_LIMIT_WINDOW_MS = 60_000;
const CHAT_MESSAGE_RATE_LIMIT_MAX = 20;
const CHAT_GATE_ANSWER_RATE_LIMIT_COLLECTION = 'chat_gate_answer_rate_limits';
const CHAT_GATE_ANSWER_RATE_LIMIT_WINDOW_MS = 60_000;
const CHAT_GATE_ANSWER_RATE_LIMIT_MAX = 10;

async function distributedChatGateAnswerRateLimit(req: Request, res: Response, next: NextFunction) {
  const uid = currentUserId(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  const key = crypto.createHash('sha256').update(`klar-chat-gate-answer:${uid}`).digest('hex');
  const ref = getDb().collection(CHAT_GATE_ANSWER_RATE_LIMIT_COLLECTION).doc(key);
  const now = Date.now();
  try {
    const allowed = await getDb().runTransaction(async tx => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : undefined;
      const windowStartedAt = Number(data?.windowStartedAt) || now;
      const count = Number(data?.count) || 0;
      if (now - windowStartedAt >= CHAT_GATE_ANSWER_RATE_LIMIT_WINDOW_MS) {
        tx.set(ref, { count: 1, windowStartedAt: now, expiresAt: new Date(now + CHAT_GATE_ANSWER_RATE_LIMIT_WINDOW_MS) });
        return true;
      }
      if (count >= CHAT_GATE_ANSWER_RATE_LIMIT_MAX) return false;
      tx.update(ref, { count: count + 1, expiresAt: new Date(windowStartedAt + CHAT_GATE_ANSWER_RATE_LIMIT_WINDOW_MS) });
      return true;
    });
    if (!allowed) return res.status(429).json({ error: 'Zu viele Gate-Antworten. Bitte kurz warten.' });
    return next();
  } catch {
    return res.status(503).json({ error: 'Gate-Antwortlimit derzeit nicht verfügbar.' });
  }
}

async function distributedChatMessageRateLimit(req: Request, res: Response, next: NextFunction) {
  const uid = currentUserId(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  const key = crypto.createHash('sha256').update(`klar-chat-message:${uid}`).digest('hex');
  const ref = getDb().collection(CHAT_MESSAGE_RATE_LIMIT_COLLECTION).doc(key);
  const now = Date.now();
  try {
    const allowed = await getDb().runTransaction(async tx => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : undefined;
      const windowStartedAt = Number(data?.windowStartedAt) || now;
      const count = Number(data?.count) || 0;
      if (now - windowStartedAt >= CHAT_MESSAGE_RATE_LIMIT_WINDOW_MS) {
        tx.set(ref, { count: 1, windowStartedAt: now, expiresAt: new Date(now + CHAT_MESSAGE_RATE_LIMIT_WINDOW_MS) });
        return true;
      }
      if (count >= CHAT_MESSAGE_RATE_LIMIT_MAX) return false;
      tx.update(ref, { count: count + 1, expiresAt: new Date(windowStartedAt + CHAT_MESSAGE_RATE_LIMIT_WINDOW_MS) });
      return true;
    });
    if (!allowed) return res.status(429).json({ error: 'Zu viele Nachrichten. Bitte kurz warten.' });
    return next();
  } catch {
    return res.status(503).json({ error: 'Nachrichtenlimit derzeit nicht verfügbar.' });
  }
}

export function createChatRouter() {
  const router = Router();
  const messageSendLimiter = distributedChatMessageRateLimit;
  const gateAnswerLimiter = distributedChatGateAnswerRateLimit;
  const chatListReadLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    keyGenerator: (req) => currentUserId(req) ?? ipKeyGenerator(req.ip ?? ''),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Zu viele Gesprächsabfragen. Bitte kurz warten.' },
  });
  const chatDetailReadLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    keyGenerator: (req) => currentUserId(req) ?? ipKeyGenerator(req.ip ?? ''),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Zu viele Gesprächsabfragen. Bitte kurz warten.' },
  });
  const markReadLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    keyGenerator: (req) => currentUserId(req) ?? ipKeyGenerator(req.ip ?? ''),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Zu viele Lesebestätigungen. Bitte kurz warten.' },
  });
  router.get('/gate/status', handleGateStatus);
  router.post('/gate/answer', gateAnswerLimiter, handleGateAnswer);
  router.post('/messages/send', messageSendLimiter, handleSendMessage);
  router.post('/messages/send-audio', (_req, res) => res.status(501).json({ error: 'Sprachnachrichten sind noch nicht verfügbar. Bitte eine Textnachricht senden.' }));
  router.get('/chats', chatListReadLimiter, async (req, res) => {
    const uid = currentUserId(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const db = getDb() as Firestore;
      const snapshot = await db.collection('chats').where('participants', 'array-contains', uid).limit(50).get();
      const chats = await Promise.all(snapshot.docs.map(async doc => {
        try {
          const access = await db.runTransaction(tx => readChatAccess(db, tx, doc.id, uid));
          const profile = await db.collection('public_profiles').doc(access.recipientId).get();
          if (profile.exists && profile.data()?.isExample === true) return null;
          return { ...access.data, id: doc.id, profile: profile.exists ? toPublicProfile(access.recipientId, profile.data()!) : null };
        } catch (error) { if (error instanceof ChatAccessError) return null; throw error; }
      }));
      return res.json({ chats: chats.filter(Boolean) });
    } catch { return res.status(503).json({ error: 'Gespräche konnten nicht geladen werden.' }); }
  });
  router.get('/chats/:chatId', chatDetailReadLimiter, async (req, res) => {
    const uid = currentUserId(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const db = getDb() as Firestore;
      const access = await db.runTransaction(tx => readChatAccess(db, tx, String(req.params.chatId ?? ''), uid));
      const profile = await db.collection('public_profiles').doc(access.recipientId).get();
      if (profile.exists && profile.data()?.isExample === true) return res.status(404).json({ error: 'Beispielprofile sind nicht erreichbar.' });
      return res.json({ profile: profile.exists ? toPublicProfile(access.recipientId, profile.data()!) : null });
    } catch (error) {
      if (error instanceof ChatAccessError) return res.status(error.status).json({ error: error.message });
      return res.status(503).json({ error: 'Gespräch konnte nicht geladen werden.' });
    }
  });
  router.post('/messages/mark-read', markReadLimiter, async (req, res) => {
    const uid = currentUserId(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const { chatId, messageIds } = req.body ?? {};
    if (!validDocumentId(chatId) || !Array.isArray(messageIds) || messageIds.length > 100 || !messageIds.every(validDocumentId)) return res.status(400).json({ error: 'Ungültige Lesebestätigung.' });
    try {
      const db = getDb() as Firestore;
      await db.runTransaction(async (tx: Transaction) => {
        const access = await readChatAccess(db, tx, chatId, uid, true);
        const refs = [...new Set<string>(messageIds)].map(id => access.ref.collection('messages').doc(id));
        const messages = refs.length ? await tx.getAll(...refs) : [];
        for (const message of messages) if (message.exists && message.data()?.senderId === access.recipientId) tx.update(message.ref, { isRead: true });
      });
      return res.json({ success: true });
    } catch (error) {
      if (error instanceof ChatAccessError) return res.status(error.status).json({ error: error.message });
      return res.status(503).json({ error: 'Lesebestätigung konnte nicht gespeichert werden.' });
    }
  });
  return router;
}
