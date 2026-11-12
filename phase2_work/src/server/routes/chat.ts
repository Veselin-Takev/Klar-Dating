import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { distributedRateLimit } from '../distributedRateLimiter';
import type { TenantAwareFirestoreRepository, TenantRow } from '../../../functions/src/firestoreRepository/TenantAwareFirestoreRepository';
import { z } from 'zod';
const record = z.record(z.string(), z.unknown());
import { getServiceRepository } from '../firestoreRepository/nativeDatabase';
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

async function loadChatListAccess(db: TenantAwareFirestoreRepository, snapshot: TenantRow<Record<string,unknown>>[], uid: string) {
  // Read each distinct access document once in the same closed transaction.
  return db.transaction(async tx => {
    const paths = new Set<string>([`account_deletions/${uid}`]);
    for (const row of snapshot) {
      paths.add(`chats/${row.id}`);
      const participants = row.data.participants;
      if (!Array.isArray(participants) || participants.length !== 2 || !participants.every(validDocumentId) || !participants.includes(uid)) continue;
      const other = participants.find(value => value !== uid)!;
      for (const path of [`blocks/${uid}_${other}`, `blocks/${other}_${uid}`, `account_deletions/${other}`, `public_profiles/${other}`]) paths.add(path);
    }
    const entries = await Promise.all([...paths].map(async path => [path, await tx.read(path, record)] as const));
    const data = new Map(entries);
    if (data.get(`account_deletions/${uid}`)) return [];
    return snapshot.flatMap(row => {
      const chat = data.get(`chats/${row.id}`), participants = chat?.participants;
      if (!Array.isArray(participants) || participants.length !== 2 || participants[0] === participants[1] || !participants.every(validDocumentId) || !participants.includes(uid)) return [];
      const other = participants.find(value => value !== uid)!;
      // A changed participant must be retried, not read outside the original access set.
      if (!paths.has(`public_profiles/${other}`)) return [];
      if (data.get(`blocks/${uid}_${other}`) || data.get(`blocks/${other}_${uid}`) || data.get(`account_deletions/${other}`)) return [];
      const profile = data.get(`public_profiles/${other}`);
      if (profile?.isExample === true) return [];
      return [{...chat, id:row.id, profile:profile ? toPublicProfile(other,profile) : null}];
    });
  });
}

export function createChatRouter() {
  const router = Router();
  const messageSendLimiter = distributedRateLimit({
    collection: CHAT_MESSAGE_RATE_LIMIT_COLLECTION,
    windowMs: CHAT_MESSAGE_RATE_LIMIT_WINDOW_MS,
    limit: CHAT_MESSAGE_RATE_LIMIT_MAX,
    keyGenerator: req => currentUserId(req) ?? '',
    message: { error: 'Zu viele Nachrichten. Bitte kurz warten.' },
  });
  const gateAnswerLimiter = distributedRateLimit({
    collection: CHAT_GATE_ANSWER_RATE_LIMIT_COLLECTION,
    windowMs: CHAT_GATE_ANSWER_RATE_LIMIT_WINDOW_MS,
    limit: CHAT_GATE_ANSWER_RATE_LIMIT_MAX,
    keyGenerator: req => currentUserId(req) ?? '',
    message: { error: 'Zu viele Gate-Antworten. Bitte kurz warten.' },
  });
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
      const db = getServiceRepository('auth');
      const snapshot = await db.list('chats', record, {where:['participants','array-contains',uid], limit:50});
      const chats = await loadChatListAccess(db, snapshot, uid);
      return res.json({ chats });
    } catch { return res.status(503).json({ error: 'Gespräche konnten nicht geladen werden.' }); }
  });
  router.get('/chats/:chatId', chatDetailReadLimiter, async (req, res) => {
    const uid = currentUserId(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const db = getServiceRepository('auth');
      const access = await db.transaction(tx => readChatAccess(db, tx, String(req.params.chatId ?? ''), uid));
      const profile = await db.read(`public_profiles/${access.recipientId}`, record);
      if (profile && profile.isExample === true) return res.status(404).json({ error: 'Beispielprofile sind nicht erreichbar.' });
      return res.json({ profile: profile ? toPublicProfile(access.recipientId, profile) : null });
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
      const db = getServiceRepository('auth');
      await db.transaction(async tx => {
        const access = await readChatAccess(db, tx, chatId, uid, true);
        const refs = [...new Set<string>(messageIds)].map(id => `${access.ref}/messages/${id}`);
        const messages = await Promise.all(refs.map(path => tx.read(path, record)));
        messages.forEach((message,index) => {if (message?.senderId === access.recipientId) tx.write(refs[index]!, record, {isRead:true}, {merge:true});});
      });
      return res.json({ success: true });
    } catch (error) {
      if (error instanceof ChatAccessError) return res.status(error.status).json({ error: error.message });
      return res.status(503).json({ error: 'Lesebestätigung konnte nicht gespeichert werden.' });
    }
  });
  return router;
}
