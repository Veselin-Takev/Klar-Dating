import type { Request, Response } from 'express';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { currentUserId } from './authorization';
import { ChatAccessError, readChatAccess } from './chatAccess';
import { FieldValue, getDb } from './db';
import { GATE_FRAGEN, InputError, gateZustand, requireString } from './pure';

import type { JsonObject } from '../types/strict';
type GateData = JsonObject & { participants: string[] };

function gateResponse(data: GateData, actor: string) {
  const ichBinA = data.participants[0] === actor;
  const antwortenA = typeof data.gateAntwortenA === 'number' && Number.isSafeInteger(data.gateAntwortenA) ? Math.max(0, data.gateAntwortenA) : 0;
  const antwortenB = typeof data.gateAntwortenB === 'number' && Number.isSafeInteger(data.gateAntwortenB) ? Math.max(0, data.gateAntwortenB) : 0;
  return {
    zustand: gateZustand({ antwortenA, antwortenB }, ichBinA),
    benoetigt: GATE_FRAGEN,
    meine: ichBinA ? antwortenA : antwortenB,
    fragen: data.gateFragen ?? null,
  };
}

function gateError(res: Response, error: unknown, path: string) {
  if (error instanceof ChatAccessError) {
    res.status(error.status).json({ error: error.message, code: error.code });
    return;
  }
  if (error instanceof InputError) {
    res.status(400).json({ error: error.message });
    return;
  }
  console.error(path, error);
  res.status(500).json({ error: 'Das hat gerade nicht geklappt. Bitte erneut versuchen.' });
}

function actorId(req: Request): string {
  const actor = currentUserId(req);
  if (!actor) throw new ChatAccessError(401, 'unauthorized', 'Bitte anmelden.');
  return actor;
}

export async function handleGateStatus(req: Request, res: Response): Promise<void> {
  try {
    const chatId = requireString(req.query?.chatId, 'chatId', 128);
    const actor = actorId(req);
    const firestore = getDb();
    const result = await firestore.runTransaction(async (tx: Transaction) => {
      const { data } = await readChatAccess(firestore, tx, chatId, actor);
      return gateResponse(data as GateData, actor);
    });
    res.json(result);
  } catch (error) {
    gateError(res, error, '/api/gate/status');
  }
}

/** Counters and answers remain server-owned and commit atomically. */
export async function handleGateAnswer(req: Request, res: Response): Promise<void> {
  try {
    const actor = actorId(req);
    const chatId = requireString(req.body?.chatId, 'chatId', 128);
    const antwort = requireString(req.body?.antwort, 'antwort', 1000);
    const firestore = getDb() as Firestore;
    const result = await firestore.runTransaction(async (tx: Transaction) => {
      const { ref, data } = await readChatAccess(firestore, tx, chatId, actor);
      const gateData = data as GateData;
      const current = gateResponse(gateData, actor);
      if (current.meine >= GATE_FRAGEN) return current;
      const field = gateData.participants[0] === actor ? 'gateAntwortenA' : 'gateAntwortenB';
      const next = current.meine + 1;
      tx.update(ref, { [field]: next });
      tx.create(ref.collection('gate_answers').doc(actor + '_' + next), {
        uid: actor, nummer: next, antwort, at: FieldValue.serverTimestamp(),
      });
      return gateResponse({ ...gateData, [field]: next }, actor);
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    gateError(res, error, '/api/gate/answer');
  }
}
