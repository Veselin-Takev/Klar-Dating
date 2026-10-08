// ═══════════════════════════════════════════════════════════════════════════
// Wann ein Gast an eine Grenze stösst — und wie er es erfährt
//
// Diese Datei importiert NICHTS. Kein React, kein Firebase. Sie ist damit
// prüfbar (tests/gastGrenze.spec.ts) — dieselbe Regel wie in `pure.ts`,
// `gastrechte.ts`, `meilensteine.ts`, `stimmung.ts`.
//
// ── DER BEFUND VOM 14.08.2026 (im Browser beobachtet) ─────────────────────
// Beim Start als Gast standen zweimal in der Konsole:
//
//   Profil konnte nicht gespeichert werden
//   FirebaseError: PERMISSION_DENIED: false for 'update' @ L181
//
// Zeile 181 in `firestore.rules` ist die `allow update`-Regel für
// `users/{userId}`, und sie verlangt `!istGast()`. Die Regel hat also
// GENAU DAS GETAN, was sie soll (GAST-01: anlegen ja, ändern nein).
//
// Falsch war die andere Seite: Die Oberfläche versucht den Schreibvorgang,
// bekommt eine Ablehnung — und schreibt sie in die Konsole. Für den
// Menschen davor heisst das: Er ändert etwas, es passiert nichts, und
// niemand sagt ihm warum.
//
// ── DIE LÜCKE, DIE DAS AUFDECKT ───────────────────────────────────────────
// Gastrechte werden auf DREI Ebenen durchgesetzt (klar/28): Server-API,
// `firestore.rules`, `storage.rules`. In der Oberfläche kam bisher nur die
// ERSTE davon an: `authFetch` erkennt HTTP 403 mit dem Code
// `konto_erforderlich` und löst das Registrierungs-Gate aus.
//
// Eine Ablehnung durch die Firestore-Regeln nimmt diesen Weg nicht — sie
// kommt nicht über `/api`. Sie brauchte also einen zweiten Erkennungspunkt,
// der in dasselbe Ereignis mündet. Nicht in einen zweiten Dialog: Zwei
// Dialoge für dieselbe Aussage laufen auseinander.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Das Ereignis, auf das `RegistrierungsGate` hört.
 *
 * Es steht hier und nicht mehr als Zeichenkette in `authFetch.ts`, weil es
 * jetzt ZWEI Absender hat. Ein Name an zwei Stellen ist ein Tippfehler, der
 * niemandem auffällt: Der Dialog bleibt einfach stumm.
 */
export const EREIGNIS_KONTO_ERFORDERLICH = 'klar_konto_erforderlich';

/** Woher die Grenze kam — nur für die Diagnose, nicht für den Text. */
export type Herkunft = 'api' | 'firestore' | 'storage';

export interface GrenzMeldung {
  herkunft: Herkunft;
  /** Was versucht wurde, in Worten. Erscheint NICHT in der Oberfläche. */
  vorgang: string;
}

/**
 * Ist das eine Ablehnung durch die Sicherheitsregeln?
 *
 * Firebase liefert `code: 'permission-denied'`; die Meldung enthält
 * zusätzlich `PERMISSION_DENIED`. Geprüft wird beides, weil der Fehler je
 * nach Aufrufweg (Firestore-SDK, Storage-SDK, oder durchgereicht) in
 * unterschiedlicher Form ankommt.
 *
 * Bewusst NICHT erfasst: `unauthenticated`. Wer gar nicht angemeldet ist,
 * braucht kein Registrierungs-Gate, sondern die Anmeldeseite.
 */
export function istRegelAblehnung(fehler: unknown): boolean {
  if (fehler === null || typeof fehler !== 'object') return false;
  const f = fehler as Record<string, unknown>;
  const code = f['code'];
  if (typeof code === 'string') {
    const c = code.toLowerCase();
    if (c === 'permission-denied' || c === 'storage/unauthorized') return true;
    if (c.endsWith('/permission-denied')) return true;
  }
  const meldung = f['message'];
  return typeof meldung === 'string' && (/PERMISSION_DENIED/i.test(meldung) || /Missing or insufficient permissions/i.test(meldung));
}

/**
 * Ist dieses Konto ein Gast?
 *
 * Firebase setzt `isAnonymous` bei anonymer Anmeldung. Das ist die
 * Client-Entsprechung zu `istGast()` in `src/server/gastrechte.ts`, das
 * serverseitig `token.firebase.sign_in_provider === 'anonymous'` liest —
 * dieselbe Aussage, zwei Quellen.
 */
export function istGastKonto(nutzer: unknown): boolean {
  if (nutzer === null || typeof nutzer !== 'object') return false;
  return (nutzer as Record<string, unknown>)['isAnonymous'] === true;
}

/**
 * Gehört zu diesem Fehler das Registrierungs-Gate?
 *
 * BEIDES muss zutreffen. Eine Regelablehnung bei einem ANGEMELDETEN Konto
 * ist etwas anderes — dort ist entweder die Regel oder der Aufruf falsch,
 * und ein Dialog „Konto anlegen" wäre eine irreführende Antwort auf einen
 * echten Fehler.
 */
export function sollGateZeigen(fehler: unknown, nutzer: unknown): boolean {
  return istGastKonto(nutzer) && istRegelAblehnung(fehler);
}

/**
 * Löst das Registrierungs-Gate aus.
 *
 * Ausserhalb eines Browsers passiert nichts — ohne `window` gibt es kein
 * Ereignis und keinen Dialog. Das ist kein Fehlerfall, sondern der
 * Serverfall.
 */
export function meldeKontoErforderlich(meldung: GrenzMeldung): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(EREIGNIS_KONTO_ERFORDERLICH, { detail: meldung }),
  );
}
