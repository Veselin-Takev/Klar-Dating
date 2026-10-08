// ═══════════════════════════════════════════════════════════════════════════
// Welche Emulator-Adressen muss die Content-Security-Policy zulassen?
//
// ── DER ANLASS VOM 14.08.2026 ─────────────────────────────────────────────
// Nach zwei behobenen Ursachen (Zwischenspeicher, Service Worker) erreichte
// die Google-Anmeldung endlich den Emulator — und blieb dort stehen:
//
//   Framing 'http://127.0.0.1:9099/' violates the following Content
//   Security Policy directive: "frame-src 'self' https://*.firebaseapp.com
//   https://accounts.google.com". The request has been blocked.
//
// Firebase Auth arbeitet mit einem versteckten Rahmen (`iframe`). In der
// Produktion liegt der unter `*.firebaseapp.com` — dort stand er in der
// Liste. Gegen den Emulator liegt er unter dem Auth-Wirt, und dort stand er
// nicht: Die Emulator-Adressen wurden bisher NUR an `connect-src` angehaengt.
//
// Das ist dieselbe Fehlerklasse wie beim Service Worker: Die richtige
// Direktive war bekannt, nur nicht die, unter die der Fall tatsaechlich
// faellt.
//
// ── WARUM DAS HIER STEHT UND NICHT IN server.ts ───────────────────────────
// Damit es pruefbar ist. `server.ts` laesst sich nicht ohne Netz, Firebase
// und Port starten; diese Entscheidung schon — sie kennt nur zwei
// Zeichenketten und gibt zwei Listen zurueck.
// ═══════════════════════════════════════════════════════════════════════════

/** Was die CSP zusaetzlich zulassen muss, wenn Emulatoren im Spiel sind. */
export type EmulatorCsp = {
  /** fuer `connect-src`: Abrufe und WebSockets an Firestore und Auth */
  verbindung: string[];
  /** fuer `frame-src`: der Anmelde-Rahmen von Firebase Auth */
  rahmen: string[];
};

/**
 * Leer, wenn keine Emulator-Variable gesetzt ist.
 *
 * Das ist der Normalfall in der Produktion: `firebase emulators:exec` setzt
 * die beiden Variablen, sonst niemand. Ohne sie bleibt die CSP unveraendert
 * eng — die Erweiterung kann also nicht versehentlich ausgeliefert werden.
 *
 * @param firestoreWirt  process.env.FIRESTORE_EMULATOR_HOST
 * @param authWirt       process.env.FIREBASE_AUTH_EMULATOR_HOST
 */
export function emulatorCsp(
  firestoreWirt?: string,
  authWirt?: string,
): EmulatorCsp {
  const verbindung: string[] = [];

  for (const wirt of [firestoreWirt, authWirt]) {
    if (!wirt) continue;
    verbindung.push(`http://${wirt}`, `ws://${wirt}`);
  }

  // Nur der Auth-Wirt. Firestore wird nie in einen Rahmen geladen, und was
  // nicht gebraucht wird, gehoert nicht in eine Sicherheitsregel.
  const rahmen = authWirt ? [`http://${authWirt}`] : [];

  return { verbindung, rahmen };
}
