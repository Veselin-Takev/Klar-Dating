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

export interface MinimalDocSnapshot {
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
}

export interface MinimalTransaction {
  get: (ref: unknown) => Promise<MinimalDocSnapshot>;
  set: (ref: unknown, data: unknown, options?: unknown) => void;
  delete: (ref: unknown) => void;
}

export interface MinimalFirestore {
  collection: (name: string) => {
    doc: (id: string) => unknown;
  };
  runTransaction: <T>(updateFunction: (transaction: MinimalTransaction) => Promise<T>) => Promise<T>;
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
  firestore: MinimalFirestore,
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
  const nutzerRef = firestore.collection('users').doc(fromUid);
  const kontaktRef = firestore.collection('contacts').doc(`${fromUid}_${targetUid}`);
  const reverseKontaktRef = firestore.collection('contacts').doc(`${targetUid}_${fromUid}`);

  const ergebnis = await firestore.runTransaction(async (t: MinimalTransaction) => {
    const [uSnap, kSnap, rSnap] = await Promise.all([
      t.get(nutzerRef),
      t.get(kontaktRef),
      t.get(reverseKontaktRef),
    ]);
    const userData = uSnap.exists ? (uSnap.data() ?? {}) : {};

    // Verification is a strict prerequisite
    if (userData.isVerified !== true) {
      return { ok: false as const, grund: 'nicht_verifiziert' as const };
    }

    // Duplicate contact check
    if (kSnap.exists) {
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
    t.set(nutzerRef, { contactDay: heute, contactCount: e.neuVerbraucht }, { merge: true });
    t.set(kontaktRef, {
      fromUid,
      toUid: targetUid,
      at: serverTimestampVal,
      tag: heute,
    });

    const isMutual = rSnap.exists;
    let chatId: string | undefined;

    // Epic 2: If both sides have contacted each other, initialize mutual chat with Icebreaker Gate
    if (isMutual) {
      chatId = [fromUid, targetUid].sort().join('_');
      const chatRef = firestore.collection('chats').doc(chatId);
      t.set(
        chatRef,
        {
          participants: [fromUid, targetUid].sort(),
          gateAntwortenA: 0,
          gateAntwortenB: 0,
          gateFragen: ['Was bringt dich sofort zum Lachen?', 'Wie sieht dein perfekter Sonntag aus?'],
          createdAt: serverTimestampVal,
          isMutual: true,
        },
        { merge: true }
      );
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
  firestore: MinimalFirestore,
  fromUid: string,
  targetUidRaw: unknown,
  currentDate: Date = new Date()
): Promise<ContactUndoResult> {
  const targetUid = requireString(targetUidRaw, 'targetUid', 128);
  const nutzerRef = firestore.collection('users').doc(fromUid);
  const kontaktRef = firestore.collection('contacts').doc(`${fromUid}_${targetUid}`);

  const ok = await firestore.runTransaction(async (t: MinimalTransaction) => {
    const [uSnap, kSnap] = await Promise.all([t.get(nutzerRef), t.get(kontaktRef)]);
    if (!kSnap.exists) {
      return false;
    }

    const contactData = asRecord(kSnap.data());
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

    const userData = uSnap.exists ? (uSnap.data() ?? {}) : {};
    const chatId = [fromUid, targetUid].sort().join('_');
    const chatRef = firestore.collection('chats').doc(chatId);

    t.delete(kontaktRef);
    t.delete(chatRef);
    t.set(
      nutzerRef,
      { contactCount: Math.max(0, (typeof userData.contactCount === 'number' ? userData.contactCount : 1) - 1) },
      { merge: true }
    );
    return true;
  });

  if (!ok) {
    return { ok: false, error: 'Die Rücknahme ist nicht mehr möglich.' };
  }

  return { ok: true };
}
