// ═══════════════════════════════════════════════════════════════════════════
// Was sagen wir, wenn die Spracheingabe nicht klappt?
//
// ── DER BEFUND VOM 14.08.2026 ─────────────────────────────────────────────
// Gemeldet: „Mikrofonaufnahme im Chat funktioniert nicht." Der Aufbau in
// `ChatView.tsx` war in Ordnung — nur die Fehlerbehandlung:
//
//     recognition.onerror = (e) => { console.warn('…', e.error); … };
//     if (!voiceRecognition) { console.warn('…'); return; }
//
// `console.warn` ist keine Rueckmeldung. Der Knopf blinkt und tut nichts.
// Genau das Muster, das `check:knopf-ohne-wirkung` erfassen soll.
//
// Die Ursache war am Ende banal: Die Berechtigungsabfrage des Browsers stand
// offen und unbeantwortet. Nach dem Erlauben lief die Aufnahme. Nur wusste
// das niemand — die App hat es nicht gesagt.
//
// ── DIE REGEL ─────────────────────────────────────────────────────────────
// Jeder Fehlschlag bekommt einen Satz, den die Person versteht und aus dem
// hervorgeht, was SIE tun kann. Eine Ausnahme: `aborted` — das ist der
// eigene Abbruch, und darauf etwas zu antworten waere Nachfassen gegen eine
// Absage (siehe src/lib/anmeldefehler.ts, derselbe Gedanke).
// ═══════════════════════════════════════════════════════════════════════════

/** Der Browser kennt die Spracherkennung ueberhaupt nicht (z. B. Firefox). */
export const NICHT_VERFUEGBAR =
  'Dieser Browser kann keine Spracheingabe. Tippen geht weiterhin.';

const TEXTE: Record<string, string> = {
  'not-allowed':
    'Kein Zugriff aufs Mikrofon. Erlaube ihn im Browser — links in der Adresszeile.',
  'service-not-allowed':
    'Kein Zugriff aufs Mikrofon. Erlaube ihn im Browser — links in der Adresszeile.',
  'audio-capture':
    'Kein Mikrofon gefunden. Prüfe, ob eines angeschlossen und ausgewählt ist.',
  'no-speech':
    'Nichts gehört. Sprich noch einmal, etwas näher am Mikrofon.',
  'network':
    'Die Spracherkennung ist gerade nicht erreichbar. Tippen geht weiterhin.',
  'language-not-supported':
    'Diese Sprache wird für die Spracheingabe nicht unterstützt.',
};

/** Eigener Abbruch — dazu wird nichts gesagt. */
const STILL = ['aborted'];

const UNBEKANNT = 'Die Spracheingabe hat nicht funktioniert. Tippen geht weiterhin.';

/**
 * @param fehlerkennung  SpeechRecognitionErrorEvent.error
 * @returns der anzuzeigende Satz, oder '' wenn nichts gesagt werden soll
 */
export function spracherkennungHinweis(fehlerkennung?: string | null): string {
  if (!fehlerkennung) return UNBEKANNT;
  if (STILL.includes(fehlerkennung)) return '';
  return TEXTE[fehlerkennung] ?? UNBEKANNT;
}
