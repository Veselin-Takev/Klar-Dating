// ═══════════════════════════════════════════════════════════════════════════
// Klar+ — was das Abo enthält, als Daten
//
// Diese Datei importiert NICHTS. Kein React, kein Firebase. Sie ist damit
// prüfbar (tests/klarPlus.spec.ts) — dieselbe Regel wie in `pure.ts`,
// `kiPolitik.ts`, `wiederholung.ts`, `sprache.ts`, `gastrechte.ts` und
// `pausenplan.ts`.
//
// ── WARUM DIE LISTE NICHT IM BILDSCHIRM STEHT ─────────────────────────────
// Bis zum 14.08.2026 stand die Vergleichstabelle als 80 Zeilen JSX mitten in
// `Profile.tsx`. Ein Versprechen, das nur als Markup existiert, lässt sich
// nicht prüfen. Zwei Zusagen darin widersprachen inzwischen ausdrücklichen
// Entscheidungen — und niemand hätte es gemerkt:
//
//   1. „Kuratierte Profile / Tag: 8 → Unbegrenzt"
//      Widerspricht der Entscheidung vom 14.08.2026 (klar/27, Abschnitt 9c):
//      Acht Kontakte am Tag gelten für ALLE, auch für Klar+. `DAILY_CONTACTS`
//      in `src/server/pure.ts` bleibt die einzige Zahl. Das Kontingent ist
//      bei Klar kein Mangel, sondern das Produkt.
//
//   2. „Werbefreiheit" — und, in derselben Tabelle, „1x / Tag (mit Ad)"
//      Widerspricht der Entscheidung für das Transparenz-Modell: Wo keine
//      Werbung ausgeliefert wird, lässt sich keine Werbefreiheit verkaufen.
//      Ein Abo, das die Abwesenheit einer Belästigung verkauft, die es nicht
//      gibt, ist ein leeres Versprechen.
//
// Als Daten fallen beide Fälle in `tests/klarPlus.spec.ts` auf, bevor sie
// jemand sieht. Das ist der ganze Zweck dieser Datei.
//
// ── WAS DIESE DATEI NICHT LEISTET ─────────────────────────────────────────
// Sie beschreibt, was das Abo enthalten SOLL. Sie schaltet nichts frei. Der
// Zugang darf ausschliesslich aus einem bestätigten Zahlungsvorgang folgen;
// bis dahin erzwingt der Billing-Router `/api/subscribe-klar-plus` mit HTTP 501.
// Deshalb steht unten `BUCHBAR = false` und deshalb gibt es auf der Seite
// keinen Kaufknopf, sondern einen Satz, der den Stand nennt.
// ═══════════════════════════════════════════════════════════════════════════

/** Ein Feld der Vergleichstabelle. `text` für alles, was mehr als ja/nein ist. */
export type Wert =
  | { art: 'ja' }
  | { art: 'nein' }
  | { art: 'text'; text: string };

export const JA: Wert = { art: 'ja' };
export const NEIN: Wert = { art: 'nein' };
export const text = (t: string): Wert => ({ art: 'text', text: t });

/**
 * Die vier Achsen aus klar/27, Abschnitt 9c — wonach Klar+ seinen Preis
 * rechtfertigt, seit Menge und Werbefreiheit ausscheiden.
 */
export const ACHSEN = {
  1: 'Die acht werden besser',
  2: 'Zeit',
  3: 'Gedächtnis',
  4: 'Werkzeuge',
} as const;

export type AchsenNummer = keyof typeof ACHSEN;

/** Die Achsen in der Reihenfolge, in der sie angezeigt werden.
 *  Ausgeschrieben statt `Object.keys(ACHSEN)`, weil `Object.keys` bei
 *  numerischen Schlüsseln Zeichenketten liefert und die Umwandlung zurück
 *  genau die Art Kleinarbeit ist, bei der ein Tippfehler still bleibt. */
export const ACHSEN_REIHENFOLGE: readonly AchsenNummer[] = [1, 2, 3, 4];

export interface Leistung {
  id: string;
  name: string;
  /** Kurze Erläuterung. Leer lassen ist erlaubt; erfinden ist es nicht. */
  erklaerung?: string;
  frei: Wert;
  plus: Wert;
  /** `null` heisst: gehört zum Grundumfang, verkauft also nichts. */
  achse: AchsenNummer | null;
}

/**
 * Sechs Zeilen. Nicht acht.
 *
 * Die Reihenfolge folgt den Achsen: erst was die acht besser macht, dann
 * Zeit, dann Gedächtnis — und zuletzt, was ohnehin allen zusteht. Wer die
 * Seite von oben liest, sieht zuerst das Argument und nicht die Selbstver-
 * ständlichkeit.
 */
export const LEISTUNGEN: readonly Leistung[] = [
  {
    id: 'filter',
    name: 'Erweiterte Filter',
    erklaerung: 'Kinderwunsch, Rauchen, Entfernung',
    frei: NEIN,
    plus: JA,
    achse: 1,
  },
  {
    id: 'eingang-sofort',
    name: 'Eingehende Nachrichten sofort sehen',
    erklaerung: 'Ohne Klar+ einmal am Tag gesammelt',
    frei: text('1× am Tag'),
    plus: text('Sofort'),
    achse: 2,
  },
  {
    id: 'verlauf',
    name: 'Unbegrenzter Gesprächsverlauf',
    frei: NEIN,
    plus: JA,
    achse: 3,
  },
  {
    id: 'incognito',
    name: 'Zurückhaltender Modus',
    erklaerung: 'Das eigene Profil vorübergehend nicht in Vorschlägen zeigen',
    frei: NEIN,
    plus: JA,
    achse: 1,
  },
  {
    id: 'sprachnachricht',
    name: 'Text und eine Sprachnachricht je Gespräch',
    frei: JA,
    plus: JA,
    achse: null,
  },
  {
    id: 'date-planer',
    name: 'Date-Planer',
    frei: JA,
    plus: JA,
    achse: null,
  },
];

/**
 * Was aus der Tabelle vom 12.08.2026 gestrichen wurde — mit dem Grund.
 *
 * Das steht hier und nicht nur im Fliesstext eines Berichts, weil eine
 * gestrichene Zusage sonst beim nächsten Umbau unbemerkt zurückkommt. Der
 * Test hält beide Namen gegen `LEISTUNGEN`.
 */
export const GESTRICHEN: readonly { name: string; grund: string }[] = [
  {
    name: 'Kuratierte Profile / Tag: 8 → Unbegrenzt',
    grund:
      'Acht Kontakte am Tag gelten für alle, auch für Klar+ (Entscheidung 14.08.2026). ' +
      'Das Kontingent ist das Produkt, nicht der Mangel.',
  },
  {
    name: 'Werbefreiheit',
    grund:
      'Klar liefert keine Werbung aus. Die Abwesenheit einer Belästigung, die es nicht gibt, ' +
      'lässt sich nicht verkaufen.',
  },
];

/** Zeigt diese Zeile einen Unterschied — oder steht sie nur da? */
export function unterscheidetSich(l: Leistung): boolean {
  if (l.frei.art !== l.plus.art) return true;
  if (l.frei.art === 'text' && l.plus.art === 'text') return l.frei.text !== l.plus.text;
  return false;
}

/** Wie viele der Zeilen überhaupt einen Unterschied zeigen. */
export function unterschiede(leistungen: readonly Leistung[] = LEISTUNGEN): number {
  return leistungen.filter(unterscheidetSich).length;
}

/**
 * Ist Klar+ buchbar?
 *
 * Fest `false`, solange Klar+ nicht freigegeben ist. Der Server verwendet
 * dieselbe Konstante als verbindliches Checkout-Gate; UI und API koennen
 * dadurch nicht auseinanderlaufen.
 */
export const BUCHBAR = false;

// WIEDERVORLAGE: `BUCHBAR` geht erst auf `true`, wenn ein bestaetigter
// Zahlungsvorgang dahintersteht (Store-Beleg bzw. RevenueCat-Webhook, HMAC
// ueber "{timestamp}.{raw_body}") und `/api/subscribe-klar-plus` nicht mehr
// mit HTTP 501 antwortet. Vorher waere der Kaufknopf eine Sackgasse.

/** Der Satz, der statt des Kaufknopfs steht. Einer, nicht drei verschiedene. */
export const HINWEIS_NICHT_BUCHBAR =
  'Klar+ ist noch nicht buchbar. Sobald die Zahlungsabwicklung steht, findest du es hier.';

export async function prüfeKlarPlusStatus(userId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/account/entitlements?userId=${userId}`);
    if (!response.ok) return false;
    const data: unknown = await response.json();
    return typeof data === 'object'
      && data !== null
      && 'hasActiveKlarPlus' in data
      && (data as { hasActiveKlarPlus?: unknown }).hasActiveKlarPlus === true;
  } catch {
    return false;
  }
}
