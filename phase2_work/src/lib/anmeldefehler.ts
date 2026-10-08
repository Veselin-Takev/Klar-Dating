// ═══════════════════════════════════════════════════════════════════════════
// Was tun, wenn das Anmeldefenster nicht durchlaeuft?
//
// ── DER BEFUND VOM 14.08.2026 ─────────────────────────────────────────────
// Nach dem Ausfuellen des Anmeldeformulars im Popup:
//
//   Error: Auth Emulator Internal Error: No matching frame
//     at assert
//     at sendAuthEventViaIframeRelay
//     at saveAuthEvent
//     at finishWithUser
//     at HTMLFormElement.<anonymous>
//
// `sendAuthEventViaIframeRelay` sucht im OEFFNENDEN Fenster den versteckten
// Rahmen, den das Firebase-SDK dort anlegt, und schickt das Ergebnis dorthin.
// Er war nicht da — weil das oeffnende Fenster nicht mehr die App war.
//
// Dahin gekommen ist es so:
//
//   1. Klick auf "Mit Google anmelden"  -> signInWithPopup, Popup oeffnet
//   2. Popup geschlossen                -> auth/popup-closed-by-user
//   3. Der bisherige Code rief daraufhin signInWithRedirect
//   4. Damit navigierte der HAUPT-TAB selbst zum Anmeldedienst
//   5. Ab jetzt hat jedes weitere Popup einen Oeffner, der nicht die App ist
//      -> "No matching frame", und zwar dauerhaft
//
// Der Zustand haelt sich selbst am Leben: Der Tab steht auf dem
// Anmeldedienst, also scheitert jeder Versuch, also bleibt er dort.
//
// ── DIE UNTERSCHEIDUNG, DIE GEFEHLT HAT ───────────────────────────────────
// Der bisherige Code behandelte zwei Faelle gleich:
//
//   auth/popup-blocked          Der BROWSER hat das Fenster verhindert.
//                               Die Person wollte sich anmelden und kam nicht
//                               dazu. Ein zweiter Weg ist hier richtig.
//
//   auth/popup-closed-by-user   Die PERSON hat zugemacht. Das ist eine
//                               Antwort, keine Stoerung. Danach den ganzen
//                               Tab zum Anmeldedienst zu schicken, ist
//                               Nachfassen gegen eine Absage.
//
// Das zweite passt weder zur Zusage der App noch zur Technik: Es erzeugt
// genau den Zustand, der die Anmeldung anschliessend unmoeglich macht.
//
// ── WOZU EIN EIGENES MODUL ────────────────────────────────────────────────
// `AuthContext.tsx` braucht React, Firebase und einen Browser. Diese
// Entscheidung nicht: eine Fehlerkennung hinein, ein Wort hinaus.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * `weiterleiten` — zweiter Anlauf ueber die Weiterleitung des Tabs.
 * `abbrechen`    — stillschweigend beenden; die Person hat abgelehnt.
 * `melden`       — unerwartet; weiterreichen, damit die Ansicht es anzeigt.
 */
export type Anmeldeschritt = 'weiterleiten' | 'abbrechen' | 'melden';

/** Vom Browser verhindert — hier ist ein zweiter Weg angebracht. */
const VERHINDERT = ['auth/popup-blocked'];

/**
 * Von der Person oder vom SDK abgebrochen.
 *
 * `cancelled-popup-request` entsteht, wenn ein zweiter Versuch den ersten
 * abloest — etwa bei einem Doppelklick. Auch das ist kein Fehler, den man
 * anzeigen muesste.
 */
const ABGEBROCHEN = [
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/user-cancelled',
];

export function anmeldeschritt(fehlerkennung?: string | null): Anmeldeschritt {
  if (!fehlerkennung) return 'melden';
  if (VERHINDERT.includes(fehlerkennung)) return 'weiterleiten';
  if (ABGEBROCHEN.includes(fehlerkennung)) return 'abbrechen';
  return 'melden';
}
