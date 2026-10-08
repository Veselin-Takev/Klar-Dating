// ═══════════════════════════════════════════════════════════════════════════
// Welcher Topf zahlt welchen Aufruf
//
// Diese Datei importiert NICHTS. Sie ist damit prüfbar
// (tests/kontingente.spec.ts) — dieselbe Regel wie in `pure.ts`,
// `gastrechte.ts`, `kiPolitik.ts` und den übrigen reinen Modulen.
//
// ── DER BEFUND VOM 14.08.2026 ─────────────────────────────────────────────
// `/api/translate` lag im selben Topf wie der KI-Coach: 60 Aufrufe je Stunde
// und Konto, 15 für Gäste. Gemessen wurde, was das in der Anwendung heisst:
//
//   · `ChatView` rendert `messages.map(...)` — JEDE Nachricht des Gesprächs.
//   · Jede `MessageBubble` ruft bei eingeschalteter Live-Übersetzung genau
//     einmal `uebersetze()`, und das ist ein Aufruf von `/api/translate`.
//
// Ein Gespräch mit 40 Nachrichten löst damit 40 Aufrufe auf einmal aus. Wer
// die Übersetzung einschaltet, hat danach zwei Drittel seines Stundentopfes
// verbraucht — und der KI-Coach antwortet „Zu viele KI-Anfragen in kurzer
// Zeit".
//
// Bei einem Gast ist es schärfer: Ab der 16. Nachricht erscheint das
// Registrierungs-Gate mit dem Satz „Als Gast kannst du die KI-Werkzeuge
// ausprobieren." — beim LESEN eines Gesprächs. Übersetzen ist aus Sicht der
// Person kein Werkzeug, das sie benutzt, sondern die Bedingung dafür, das
// Gespräch überhaupt zu verstehen.
//
// ── WAS DIESE DATEI ENTSCHEIDET, UND WAS NICHT ────────────────────────────
// Sie gibt der Übersetzung einen EIGENEN Topf. Sie behebt NICHT, dass ein
// Gespräch einen Schwall Aufrufe auslöst — siehe die Wiedervorlage unten.
//
// WIEDERVORLAGE: Der eigene Topf ist die Linderung, nicht die Heilung. Die
//   Ursache ist, dass je Nachricht ein Netzaufruf entsteht. Drei Wege, in
//   der Reihenfolge, in der sie sich lohnen: (1) nur übersetzen, was
//   tatsächlich auf dem Bildschirm steht, statt aller Nachrichten des
//   Gesprächs; (2) mehrere Nachrichten in einem Aufruf bündeln; (3)
//   Übersetzung im Gerät, die ohnehin gebraucht wird, sobald die
//   Ende-zu-Ende-Verschlüsselung steht (Entscheidung vom 14.08.2026, siehe
//   `src/services/translationService.ts`). Ein dauerhafter Zwischenspeicher
//   ist bewusst KEIN Weg — er steht derselben Verschlüsselung im Weg.
// ═══════════════════════════════════════════════════════════════════════════

/** Der einzige Endpunkt, der aus dem Übersetzungstopf zahlt. */
export const UEBERSETZUNGS_ENDPUNKT = '/api/translate';

/**
 * Übersetzungen je Stunde und Konto.
 *
 * WOHER DIE ZAHL: Ein Aufruf je angezeigter Nachricht. Angenommen sind
 * Gespräche bis etwa 75 Nachrichten; 300 deckt damit rund vier Gespräche je
 * Stunde ab, einschliesslich einmal neu laden. Das ist eine ANNAHME über die
 * Länge von Gesprächen, keine Messung an echten Daten — es gibt noch keine.
 * Sobald es sie gibt, gehört die Zahl überprüft.
 *
 * Sie ist bewusst nicht sehr hoch: Jeder Aufruf geht an Gemini und kostet.
 */
export const UEBERSETZUNG_GRENZE = 300;

/**
 * Dieselbe Grenze für Gäste.
 *
 * WARUM NICHT 15 wie beim KI-Topf: Die 15 sollen verhindern, dass der
 * Gastmodus zur dauerhaft kostenlosen Nutzung wird. Beim Übersetzen träfe
 * die Zahl etwas anderes — sie hinderte einen Gast daran, ein Gespräch zu
 * LESEN, das er führen darf.
 *
 * WARUM NICHT 300: Ein Gastkonto entsteht in Sekunden. 60 reicht für ein
 * langes Gespräch samt Nachladen und bleibt für Missbrauch unattraktiv.
 */
export const UEBERSETZUNG_GRENZE_GAST = 60;

/** Aus welchem Topf ein Aufruf bezahlt wird. */
export type Topf = 'uebersetzung' | 'ki' | 'keiner';

/**
 * Die Zuordnung — hier, damit sie geprüft werden kann.
 *
 * WICHTIG ist die Reihenfolge: `/api/translate` steht auch in `KI_ENDPUNKTE`
 * (server.ts), und zwar zu Recht — die Einwilligung zur KI-Auswertung wird
 * darüber geprüft, und der Text geht tatsächlich an Gemini. Nur beim
 * KONTINGENT gilt etwas anderes. Wer die Abfrage umdreht, landet wieder im
 * alten Zustand, ohne dass es auffällt. Genau dafür gibt es die Prüfung
 * `der Uebersetzungstopf geht dem KI-Topf vor` in tests/kontingente.spec.ts.
 */
export function topfFuer(pfad: unknown, istKiEndpunkt: boolean): Topf {
  if (pfad === UEBERSETZUNGS_ENDPUNKT) return 'uebersetzung';
  if (istKiEndpunkt) return 'ki';
  return 'keiner';
}

/**
 * Die Stundengrenze eines Topfes.
 *
 * `kiGrenze` und `kiGrenzeGast` werden hineingereicht, statt sie hier noch
 * einmal hinzuschreiben: Sie stehen in `server.ts` und `gastrechte.ts`, und
 * zwei Stellen für dieselbe Zahl laufen auseinander. Genau dieser Fehler
 * steckte im entfernten zweiten Löschweg.
 */
export function grenzeFuer(
  topf: Topf,
  istGast: boolean,
  kiGrenze: number,
  kiGrenzeGast: number,
): number | null {
  if (topf === 'uebersetzung') return istGast ? UEBERSETZUNG_GRENZE_GAST : UEBERSETZUNG_GRENZE;
  if (topf === 'ki') return istGast ? kiGrenzeGast : kiGrenze;
  return null;
}
