// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { getDb } from '../src/server/db';
import { handleSendMessage } from '../src/server/messages';
import { assessSafetyMessage } from '../src/server/safetyService';
import { handleGateAnswer, handleGateStatus } from '../src/server/gate';

// Use real emulator transactions in a separate database: rule suites clear the
// default database and must not race these persistence assertions.
vi.mock('../src/server/safetyService', () => ({
  assessSafetyMessage: vi.fn(async () => ({ checked: true, flagged: false })),
}));

vi.mock('../src/server/db', async importOriginal => {
  const real = await importOriginal<typeof import('../src/server/db')>();
  const { getFirestore } = await import('firebase-admin/firestore');
  return { ...real, getDb: () => {
    if (!process.env.FIRESTORE_EMULATOR_HOST) return real.getDb();
    return getFirestore(real.getServerFirebaseApp(), 'chat-security-tests');
  } };
});
let db: Firestore;
let chatId: string;
let alice: string;
let bob: string;
async function invoke(handler: (req: Request, res: Response) => Promise<void>, uid: string, body: Record<string, unknown> = {}) {
  let status = 200; let payload: any;
  const response = { status(code: number) { status = code; return this; }, json(value: unknown) { payload = value; return this; } };
  await handler({ user: { uid }, body: { chatId, ...body }, query: { chatId } } as unknown as Request, response as unknown as Response);
  return { status, payload };
}
beforeEach(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) return;
  db = getDb() as Firestore;
  const id = randomUUID(); chatId = 'chat-' + id; alice = 'alice-' + id; bob = 'bob-' + id;
  await db.collection('chats').doc(chatId).set({ participants: [alice, bob], gateAntwortenA: 0, gateAntwortenB: 0, gateFragen: ['Erste Frage?', 'Zweite Frage?'] });
});
afterEach(async () => {
  vi.restoreAllMocks();
  if (!db || !process.env.FIRESTORE_EMULATOR_HOST) return;
  await Promise.all([
    db.recursiveDelete(db.collection('chats').doc(chatId)),
    db.collection('blocks').doc(`${alice}_${bob}`).delete(),
    db.collection('blocks').doc(`${bob}_${alice}`).delete(),
    db.recursiveDelete(db.collection('users').doc(alice)),
    db.recursiveDelete(db.collection('users').doc(bob)),
  ]);
});

describe.runIf(!!process.env.FIRESTORE_EMULATOR_HOST)('server-enforced chat persistence', () => {
  it('rejects a third party with a valid identity before any message write', async () => {
    const result = await invoke(handleSendMessage, 'outsider', { text: 'not a participant' });
    expect(result).toMatchObject({ status: 403, payload: { code: 'chat_forbidden' } });
    expect((await db.collection('chats').doc(chatId).collection('messages').get()).empty).toBe(true);
    expect((await invoke(handleGateAnswer, 'outsider', { antwort: 'bypass' })).status).toBe(403);
  });

  it('requires both participants to complete the gate and preserves the original message', async () => {
    expect((await invoke(handleSendMessage, alice, { text: 'too early' })).payload.code).toBe('gate_closed');
    expect((await invoke(handleGateStatus, alice)).payload).toMatchObject({ zustand: 'du_bist_dran', meine: 0 });
    expect((await invoke(handleGateAnswer, alice, { antwort: 'one' })).payload).toMatchObject({ zustand: 'du_bist_dran', meine: 1 });
    expect((await invoke(handleGateAnswer, alice, { antwort: 'two' })).payload).toMatchObject({ zustand: 'wartet_auf_andere', meine: 2 });
    await invoke(handleGateAnswer, bob, { antwort: 'one' });
    expect((await invoke(handleGateAnswer, bob, { antwort: 'two' })).payload).toMatchObject({ zustand: 'offen', meine: 2 });
    const result = await invoke(handleSendMessage, alice, { text: '  Hola, wie geht es dir?  ', sourceLang: 'es' });
    expect(result).toMatchObject({ status: 200, payload: { success: true, translated: false } });
    const message = await db.collection('chats').doc(chatId).collection('messages').doc(result.payload.messageId).get();
    expect(message.data()).toMatchObject({ senderId: alice, text: '  Hola, wie geht es dir?  ', isRead: false });
  });

  it.each(['sender', 'recipient'])('enforces a block by the %s even after the gate opens', async direction => {
    await db.collection('chats').doc(chatId).update({ gateAntwortenA: 2, gateAntwortenB: 2 });
    const [from, to] = direction === 'sender' ? [alice, bob] : [bob, alice];
    await db.collection('blocks').doc(`${from}_${to}`).set({ blockerUid: from, blockedUid: to });
    expect((await invoke(handleSendMessage, alice, { text: 'blocked' })).status).toBe(403);
    expect((await invoke(handleGateStatus, alice)).status).toBe(403);
    expect((await invoke(handleGateAnswer, alice, { antwort: 'blocked' })).status).toBe(403);
  });

  it('makes a retried send idempotent and rejects a conflicting reuse', async () => {
    await db.collection('chats').doc(chatId).update({ gateAntwortenA: 2, gateAntwortenB: 2 });
    const body = { text: 'one message', clientMessageId: randomUUID() };
    const first = await invoke(handleSendMessage, alice, body);
    const retry = await invoke(handleSendMessage, alice, body);
    expect(first.status).toBe(200); expect(retry.payload.messageId).toBe(first.payload.messageId);
    expect((await invoke(handleSendMessage, alice, { ...body, text: 'different' })).status).toBe(409);
    expect((await db.collection('chats').doc(chatId).collection('messages').get()).size).toBe(1);
  });

  it('acknowledges a persisted retry even if the AI provider later becomes unavailable', async () => {
    await db.collection('chats').doc(chatId).update({ gateAntwortenA: 2, gateAntwortenB: 2 });
    const safety = vi.mocked(assessSafetyMessage);
    const original = safety.getMockImplementation();
    const body = { text: 'already committed', clientMessageId: randomUUID() };
    try {
      const first = await invoke(handleSendMessage, alice, body);
      expect(first).toMatchObject({ status: 200, payload: { success: true } });
      const callsBeforeRetry = safety.mock.calls.length;
      // This provider outage happens *after* Firestore has committed the message.
      safety.mockResolvedValue({ checked: false, status: 503, code: 'safety_unavailable' });
      const retry = await invoke(handleSendMessage, alice, body);
      expect(retry).toMatchObject({ status: 200, payload: {
        success: true, messageId: first.payload.messageId, messageHash: first.payload.messageHash,
      } });
      expect(safety.mock.calls.length).toBe(callsBeforeRetry);
      expect((await db.collection('chats').doc(chatId).collection('messages').get()).size).toBe(1);
      const fresh = await invoke(handleSendMessage, alice, {
        text: 'not yet committed', clientMessageId: randomUUID(),
      });
      expect(fresh).toMatchObject({ status: 503, payload: { code: 'safety_unavailable' } });
    } finally {
      if (original) safety.mockImplementation(original);
      safety.mockClear();
    }
  });

  it('rejects conflicting reuse of a stored message ID without another provider call', async () => {
    await db.collection('chats').doc(chatId).update({ gateAntwortenA: 2, gateAntwortenB: 2 });
    const safety = vi.mocked(assessSafetyMessage);
    const body = { text: 'immutable original', clientMessageId: randomUUID() };
    const first = await invoke(handleSendMessage, alice, body);
    expect(first.status).toBe(200);
    const callsBeforeConflict = safety.mock.calls.length;
    const conflict = await invoke(handleSendMessage, alice, { ...body, text: 'tampered retry' });
    expect(conflict).toMatchObject({ status: 409, payload: { code: 'message_conflict' } });
    expect(safety.mock.calls.length).toBe(callsBeforeConflict);
    expect((await db.collection('chats').doc(chatId).collection('messages').get()).size).toBe(1);
  });

  it('rejects conflicting client-side sender and owner claims before persistence', async () => {
    await db.collection('chats').doc(chatId).update({ gateAntwortenA: 2, gateAntwortenB: 2 });
    for (const claim of [{ senderId: alice }, { uid: alice }, { ownerUid: alice }]) {
      const response = await invoke(handleSendMessage, bob, {
        text: 'spoofed-payload', clientMessageId: randomUUID(), ...claim,
      });
      expect(response).toMatchObject({ status: 403, payload: { code: 'sender_mismatch' } });
    }
    expect((await db.collection('chats').doc(chatId).collection('messages').get()).empty).toBe(true);
  });

  it('accepts matching legacy UID but always persists the verified identity', async () => {
    await db.collection('chats').doc(chatId).update({ gateAntwortenA: 2, gateAntwortenB: 2 });
    const response = await invoke(handleSendMessage, bob, {
      text: 'auth-identity-only', clientMessageId: 'same-identity',
      senderId: bob, uid: bob, ownerUid: bob,
    });
    expect(response).toMatchObject({ status: 200, payload: { success: true } });
    const saved = await db.collection('chats').doc(chatId).collection('messages')
      .doc(response.payload.messageId).get();
    expect(saved.data()?.senderId).toBe(bob);
  });

  it('never lets a third party bypass chat membership by supplying a participant UID', async () => {
    await db.collection('chats').doc(chatId).update({ gateAntwortenA: 2, gateAntwortenB: 2 });
    const response = await invoke(handleSendMessage, 'not-a-participant', {
      text: 'impersonated-send', clientMessageId: 'spoof-owner-2',
      senderId: alice, uid: alice, ownerUid: alice,
    });
    expect(response).toMatchObject({ status: 403, payload: { code: 'sender_mismatch' } });
    expect((await db.collection('chats').doc(chatId).collection('messages').get()).empty).toBe(true);
    expect((await invoke(handleSendMessage, 'not-a-participant', {
      text: 'chat-forbidden', clientMessageId: 'spoof-owner-3',
    }))).toMatchObject({ status: 403, payload: { code: 'chat_forbidden' } });
  });

  it('isolates idempotent clientMessageId by verified server-side UID', async () => {
    await db.collection('chats').doc(chatId).update({ gateAntwortenA: 2, gateAntwortenB: 2 });
    const clientMessageId = 'shared-client-id';
    const first = await invoke(handleSendMessage, alice, {
      text: 'from-alice', clientMessageId,
    });
    const second = await invoke(handleSendMessage, bob, {
      text: 'from-bob', clientMessageId, uid: bob,
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.payload.messageId).not.toBe(second.payload.messageId);
    expect((await db.collection('chats').doc(chatId).collection('messages').get()).size).toBe(2);
  });

  it('never acknowledges a failed transaction', async () => {
    vi.spyOn(db, 'runTransaction').mockRejectedValueOnce(new Error('storage unavailable'));
    expect(await invoke(handleSendMessage, alice, { text: 'must not be acknowledged' })).toMatchObject({ status: 503 });
    expect((await db.collection('chats').doc(chatId).collection('messages').get()).empty).toBe(true);
  });
});
