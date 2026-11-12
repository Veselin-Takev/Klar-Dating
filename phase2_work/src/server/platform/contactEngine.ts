import type { Firestore } from 'firebase-admin/firestore';
import type { TenantAwareFirestoreRepository } from '../../../functions/src/firestoreRepository/TenantAwareFirestoreRepository';
import { scopeServiceDatabase } from '../firestoreRepository/nativeDatabase';
import { z } from 'zod';
const record = z.record(z.string(), z.unknown());
import { DAILY_CONTACTS, InputError, contactDay, entscheideKontakt, requireString } from '../pure';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export type ContactFailureReason = 'nicht_verifiziert' | 'bereits_kontaktiert' | 'limit' | 'self_contact';

export interface ContactDecisionResult {
  ok: boolean;
  grund?: ContactFailureReason;
  uebrig?: number;
  gesamt?: number;
  error?: string;
  isMutual?: boolean;
  chatId?: string;
}

export interface ContactUndoResult {
  ok: boolean;
  error?: string;
}


export function getContactFailureMessage(grund: ContactFailureReason): string {
  switch (grund) {
    case 'limit':
      return `Für heute sind alle ${DAILY_CONTACTS} Kontakte vergeben. Morgen um 4 Uhr gibt es neue.`;
    case 'nicht_verifiziert':
      return 'Für den ersten Kontakt ist die Verifizierung nötig.';
    case 'bereits_kontaktiert':
      return 'Diese Person hast du bereits angeschrieben.';
    case 'self_contact':
      return 'Kein Kontakt zum eigenen Konto.';
    default:
      return 'Kontaktierung derzeit nicht möglich.';
  }
}

export async function processContactRequest(
  firestore: Firestore | TenantAwareFirestoreRepository,
  fromUid: string,
  targetUidRaw: unknown,
  currentDate: Date = new Date(),
  serverTimestampVal: unknown = new Date()
): Promise<ContactDecisionResult> {
  const targetUid = requireString(targetUidRaw, 'targetUid', 128);
  if (targetUid === fromUid) {
    throw new InputError('Kein Kontakt zum eigenen Konto.');
  }

  const heute = contactDay(currentDate);
  const db = scopeServiceDatabase(firestore, 'auth');
  const nutzerRef = `users/${fromUid}`;
  const kontaktRef = `contacts/${fromUid}_${targetUid}`;
  const reverseKontaktRef = `contacts/${targetUid}_${fromUid}`;

  const ergebnis = await db.transaction(async tx => {
    const [uSnap, kSnap, rSnap] = await Promise.all([
      tx.read(nutzerRef, record),
      tx.read(kontaktRef, record),
      tx.read(reverseKontaktRef, record),
    ]);
    if (await tx.read(`account_deletions/${fromUid}`,record) || await tx.read(`account_deletions/${targetUid}`,record)) throw new Error('account_unavailable');
    const userData = uSnap ?? {};

    // Verification is a strict prerequisite
    if (userData.isVerified !== true) {
      return { ok: false as const, grund: 'nicht_verifiziert' as const };
    }

    // Duplicate contact check
    if (kSnap !== null) {
      return { ok: false as const, grund: 'bereits_kontaktiert' as const };
    }

    // Quota decision
    const contactDayValue = typeof userData.contactDay === 'string' ? userData.contactDay : '';
    const contactCountValue = typeof userData.contactCount === 'number' && Number.isFinite(userData.contactCount)
      ? userData.contactCount
      : 0;
    const e = entscheideKontakt(
      {
        tag: contactDayValue,
        verbraucht: contactCountValue,
        plan: userData.plan === 'plus' ? 'plus' : 'frei',
      },
      heute
    );

    if (!e.erlaubt) {
      return { ok: false as const, grund: 'limit' as const };
    }

    // Atomic updates
    tx.write(nutzerRef, record, { contactDay: heute, contactCount: e.neuVerbraucht }, { merge: true });
    tx.write(kontaktRef, record, {
      fromUid,
      toUid: targetUid,
      at: serverTimestampVal,
      tag: heute,
    });

    const isMutual = rSnap !== null;
    let chatId: string | undefined;

    // Epic 2: If both sides have contacted each other, initialize mutual chat with Icebreaker Gate
    if (isMutual) {
      chatId = [fromUid, targetUid].sort().join('_');
      const chatRef = `chats/${chatId}`;
      tx.write(chatRef, record, {
          participants: [fromUid, targetUid].sort(),
          gateAntwortenA: 0,
          gateAntwortenB: 0,
          gateFragen: ['Was bringt dich sofort zum Lachen?', 'Wie sieht dein perfekter Sonntag aus?'],
          createdAt: serverTimestampVal,
          isMutual: true,
        }, { merge: true });
    }

    return { ok: true as const, uebrig: e.uebrig, isMutual, chatId };
  });

  if (ergebnis.ok) {
    return {
      ok: true,
      uebrig: ergebnis.uebrig,
      gesamt: DAILY_CONTACTS,
      isMutual: ergebnis.isMutual,
      chatId: ergebnis.chatId,
    };
  }

  return {
    ok: false,
    grund: ergebnis.grund,
    error: getContactFailureMessage(ergebnis.grund),
  };
}

export async function processContactUndo(
  firestore: Firestore | TenantAwareFirestoreRepository,
  fromUid: string,
  targetUidRaw: unknown,
  currentDate: Date = new Date()
): Promise<ContactUndoResult> {
  const targetUid = requireString(targetUidRaw, 'targetUid', 128);
  const db = scopeServiceDatabase(firestore, 'auth');
  const nutzerRef = `users/${fromUid}`;
  const kontaktRef = `contacts/${fromUid}_${targetUid}`;

  const ok = await db.transaction(async tx => {
    const [uSnap, kSnap] = await Promise.all([tx.read(nutzerRef, record), tx.read(kontaktRef, record)]);
    if (kSnap === null) {
      return false;
    }

    const contactData = asRecord(kSnap);
    const rawAt = contactData.at;
    let angelegt: Date | null = null;
    if (rawAt instanceof Date) {
      angelegt = rawAt;
    } else if (rawAt && typeof rawAt === 'object' && typeof (rawAt as { toDate?: unknown }).toDate === 'function') {
      const parsedDate = (rawAt as { toDate: () => unknown }).toDate();
      if (parsedDate instanceof Date) angelegt = parsedDate;
    } else if (typeof rawAt === 'string' || typeof rawAt === 'number') {
      const parsed = new Date(rawAt);
      if (!Number.isNaN(parsed.getTime())) angelegt = parsed;
    }

    // 5-second server-enforced window
    if (angelegt && currentDate.getTime() - angelegt.getTime() > 5_000) {
      return false;
    }

    const userData = uSnap ?? {};
    const chatId = [fromUid, targetUid].sort().join('_');
    const chatRef = `chats/${chatId}`;

    tx.delete(kontaktRef);
    tx.delete(chatRef);
    tx.write(nutzerRef, record, { contactCount: Math.max(0, (typeof userData.contactCount === 'number' ? userData.contactCount : 1) - 1) }, { merge: true });
    return true;
  });

  if (!ok) {
    return { ok: false, error: 'Die Rücknahme ist nicht mehr möglich.' };
  }

  return { ok: true };
}
