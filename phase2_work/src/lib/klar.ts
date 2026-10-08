import { klarStorage } from '../lib/userScopedStorage';
// ═══════════════════════════════════════════════════════════════════════════
// Client-Seite der Kernmechanik. Alle Zustände kommen vom Server —
// nichts davon wird im klarStorage gespiegelt. Ein zwischengespeicherter
// Verifizierungsstatus oder Kontingentstand ist ein Zustand, den das Gerät
// setzen kann.
// ═══════════════════════════════════════════════════════════════════════════

import { auth } from './firebase';

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
  if (!auth.currentUser) throw new Error('Nicht angemeldet.');
  const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');

  const ext = datei.type === 'image/png' ? 'png' : datei.type === 'image/webp' ? 'webp' : 'jpg';
  const fileName = `profiles/${auth.currentUser.uid}/avatar_${Date.now()}.${ext}`;
  const storageRef = ref(getStorage(), fileName);

  await uploadBytes(storageRef, datei, { contentType: datei.type || 'image/jpeg' });
  const url = await getDownloadURL(storageRef);

  // Setze die URL im Profil
  const { getFirestore, doc, setDoc } = await import('firebase/firestore');
  await setDoc(doc(getFirestore(), 'users', auth.currentUser.uid), { photoURL: url }, { merge: true });

  return url;
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
