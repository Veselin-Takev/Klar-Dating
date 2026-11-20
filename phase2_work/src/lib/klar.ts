// ═══════════════════════════════════════════════════════════════════════════
// Client-Seite der Kernmechanik. Alle Zustände kommen vom Server —
// nichts davon wird im klarStorage gespiegelt. Ein zwischengespeicherter
// Verifizierungsstatus oder Kontingentstand ist ein Zustand, den das Gerät
// setzen kann.
// ═══════════════════════════════════════════════════════════════════════════

import { auth } from './firebase';
import { createCanonicalProfileMediaRef } from './profileMediaRef';

// ═══════════════════════════════════════════════════════════════════════════
// `firebase/storage` wird NICHT hier oben importiert.
//
// ── DER BEFUND VOM 14.08.2026 ─────────────────────────────────────────────
// `npm run groesse` hat ausgerechnet, woraus das Startstueck besteht.
// `@firebase/storage` stand darin mit 31,7 kB (2,4 %) — obwohl es an genau
// EINER Stelle gebraucht wird: beim Hochladen des Verifizierungsfotos in
// `reicheVerifizierungEin()` weiter unten.
//
// Ein Import am Dateikopf laedt das Paket, sobald irgendeine Funktion aus
// dieser Datei gebraucht wird. `klar.ts` haengt am Startgraph, also lud
// jeder Anmeldebildschirm die Datei-Ablage mit — fuer ein Foto, das die
// wenigsten je hochladen.
//
// Der Import steht deshalb IN der Funktion. Sie ist ohnehin `async`; der
// zusaetzliche `await` kostet nichts, was neben einem Datei-Upload ins
// Gewicht faellt.
// ═══════════════════════════════════════════════════════════════════════════

async function json<T>(res: Response): Promise<T> {
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((d as { error?: string }).error || `Server-Antwort ${res.status}`);
  return d as T;
}

// ── Kontingent ─────────────────────────────────────────────────────────────

export interface KontaktErgebnis { ok: true; uebrig: number | null; gesamt: number }

/** Beginnt einen Kontakt. Wirft mit der Servermeldung, wenn das Kontingent
 *  aufgebraucht, die Verifizierung offen oder die Person schon
 *  angeschrieben ist. */
export async function beginneKontakt(targetUid: string): Promise<KontaktErgebnis> {
  return json<KontaktErgebnis>(
    await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUid }),
    }),
  );
}

/** Rücknahme innerhalb von 5 Sekunden. Die Frist prüft der Server. */
export async function nimmKontaktZurueck(targetUid: string): Promise<void> {
  await json(
    await fetch('/api/contact/undo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUid }),
    }),
  );
}

// ── Verifizierung ──────────────────────────────────────────────────────────
// Legacy gesture/photo verification was retired. Use /api/kyc via DiditVerification.

// ── Profilfoto ─────────────────────────────────────────────────────────────

export async function ladeProfilfotoHoch(datei: Blob): Promise<string> {
  const uploader = auth.currentUser;
  if (!uploader || uploader.isAnonymous) throw new Error('Nicht angemeldet.');
  const contentType = datei.type;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)
    || datei.size <= 0 || datei.size >= 8 * 1024 * 1024) {
    throw new Error('Ungültiges Profilbild.');
  }

  // Firebase Storage reads are denied to clients. Persist an opaque owner-scoped
  // reference instead of minting a permanent bearer download URL.
  const { getStorage, ref, uploadBytes } = await import('firebase/storage');
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  // A collision-resistant path prevents concurrent uploads from overwriting
  // each other's objects and makes compensation specific to this upload.
  const uploadId = globalThis.crypto.randomUUID();
  const objectPath = `profiles/${uploader.uid}/avatar_${uploadId}.${ext}`;
  const storageRef = ref(getStorage(), objectPath);

  await uploadBytes(storageRef, datei, { contentType });
  const mediaRef = createCanonicalProfileMediaRef(uploader.uid, objectPath);

  // Compensation is deliberately fail-closed. Delete only when a server read
  // proves that no supported profile field references this exact object.
  // A changed session, failed read, or failed delete retains the object.
  const compensateIfUnreferenced = async (): Promise<void> => {
    const currentSession = auth.currentUser;
    if (!currentSession || currentSession.uid !== uploader.uid || currentSession.isAnonymous) return;

    try {
      const { getFirestore, doc, getDocFromServer } = await import('firebase/firestore');
      const snapshot = await getDocFromServer(doc(getFirestore(), 'users', uploader.uid));
      const profile: Record<string, unknown> = snapshot.exists()
        ? (snapshot.data() ?? {}) as Record<string, unknown>
        : {};
      const references = [
        profile.photoURL,
        profile.photoUrl,
        profile.photoPath,
        profile.photoStoragePath,
        ...(Array.isArray(profile.photos) ? profile.photos : []),
      ];
      const isReferenced = references.some(value => {
        if (value === mediaRef || value === objectPath) return true;
        if (typeof value !== 'string') return false;
        try {
          const parsed = new URL(value);
          const marker = parsed.pathname.indexOf('/o/');
          return marker >= 0
            && decodeURIComponent(parsed.pathname.slice(marker + 3)) === objectPath;
        } catch {
          return false;
        }
      });
      if (isReferenced) return;

      const { deleteObject } = await import('firebase/storage');
      await deleteObject(storageRef);
    } catch {
      // Uncertainty is not proof of non-reference: retain the uploaded object.
    }
  };

  const currentSession = auth.currentUser;
  if (!currentSession || currentSession.uid !== uploader.uid || currentSession.isAnonymous) {
    await compensateIfUnreferenced();
    throw new Error('Die Sitzung hat sich während des Uploads geändert.');
  }

  try {
    const { getFirestore, doc, setDoc } = await import('firebase/firestore');
    await setDoc(doc(getFirestore(), 'users', uploader.uid), { photoURL: mediaRef }, { merge: true });
  } catch (error) {
    await compensateIfUnreferenced();
    throw error;
  }

  return mediaRef;
}

// ── Icebreaker-Gate ────────────────────────────────────────────────────────

export type GateZustand = 'offen' | 'wartet_auf_andere' | 'du_bist_dran';

export interface GateAntwort { zustand: GateZustand; benoetigt: number; meine: number; fragen?: string[] | null }

function validatedGate(value: GateAntwort): GateAntwort {
  if (!value || !['offen', 'wartet_auf_andere', 'du_bist_dran'].includes(value.zustand)
    || !Number.isSafeInteger(value.benoetigt) || value.benoetigt < 1
    || !Number.isSafeInteger(value.meine) || value.meine < 0
    || (value.fragen != null && (!Array.isArray(value.fragen) || !value.fragen.every(question => typeof question === 'string')))) {
    throw new Error('Ungültiger Gesprächsstatus.');
  }
  return value;
}

export async function gateStatus(chatId: string, signal?: AbortSignal): Promise<GateAntwort> {
  return validatedGate(await json<GateAntwort>(await fetch(`/api/gate/status?chatId=${encodeURIComponent(chatId)}`, { signal })));
}

export async function beantworteGate(chatId: string, antwort: string): Promise<GateAntwort> {
  return validatedGate(await json<GateAntwort>(
    await fetch('/api/gate/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, antwort }),
    }),
  ));
}

// ── Abo: Kündigung (§ 312k) und Widerruf (§ 356a) ──────────────────────────

export interface AboStatus {
  plan: 'frei' | 'plus';
  paidUntil: string | null;
  cancelledAt: string | null;
  cancellationStatus: 'pending' | 'completed' | null;
  widerrufMoeglich: boolean;
}

export async function aboStatus(): Promise<AboStatus> {
  return json<AboStatus>(await fetch('/api/subscription/status'));
}

export async function kuendige(grund?: string): Promise<{ ok: boolean; status: 'pending'; receipt: { id: string; receivedAt: string; text: string } }> {
  return json(await fetch('/api/subscription/cancel', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grund }),
  }));
}

export async function widerrufe(grund?: string): Promise<{ endetAm: string }> {
  return json(await fetch('/api/subscription/withdraw', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grund }),
  }));
}
