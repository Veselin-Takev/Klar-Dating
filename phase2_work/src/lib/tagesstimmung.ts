import { klarStorage } from '../lib/userScopedStorage';
// ═══════════════════════════════════════════════════════════════════════════
// Tagesstimmung — der eigene Stimmungsverlauf, ohne Erfindung
//
// Diese Datei importiert NICHTS. Kein React, kein Speicher. Sie ist damit
// prüfbar (tests/tagesstimmung.spec.ts) — dieselbe Regel wie in `pure.ts`,
// `sprache.ts`, `gastrechte.ts`, `pausenplan.ts`, `klarPlus.ts`,
// `meilensteine.ts`, `stimmung.ts`, `gastGrenze.ts` und `textform.ts`.
//
// ── DER BEFUND VOM 14.08.2026 ─────────────────────────────────────────────
// `DailyMoodWidget.tsx` legte sechs Tage Verlauf an, wenn noch keiner da war:
//
//     // Mock some history if empty for demo purposes
//     for (let i = 6; i >= 1; i--) {
//       const randomMood = MOODS[0];
//       mockHistory.push({ date: …, mood: randomMood?.value || 3, … });
//     }
//     setHistory(mockHistory);
//
// Das war nicht nur eine Anzeige. Trug die Person danach ihre HEUTIGE
// Stimmung ein, nahm `handleSelectMood` den vorhandenen Verlauf — also die
// sechs erfundenen Tage — und schrieb ihn mitsamt dem neuen Eintrag in den
// Speicher. Aus einer Anzeige wurde damit eine dauerhafte Aufzeichnung:
// sechs Tage, an denen die Person etwas gefühlt haben soll, was sie nie
// gesagt hat.
//
// ── DER ZWEITE BEFUND: UNGEPRUEFTES LESEN ─────────────────────────────────
// Gelesen wurde mit
//
//     JSON.parse(klarStorage.getItem("klar_mood_history") || "[]") as MoodEntry[]
//
// Das `as` ist eine Behauptung, keine Prüfung. Steht unter dem Schlüssel
// etwas anderes, wurde daraus gerendert. Hier liest `eintraegeAus` und
// verwirft, was nicht passt — dieselbe Linie wie in `ChatDatePlanner.tsx`.
//
// ── DIE REGEL, DIE HIER GILT ──────────────────────────────────────────────
// Ein Tag ohne Eintrag existiert nicht. Kein Ersatzwert, kein „neutral",
// keine aufgefüllte Reihe. Wer nichts eingetragen hat, sieht einen leeren
// Verlauf und einen Satz, der das benennt.
// ═══════════════════════════════════════════════════════════════════════════

/** Die fünf Stufen. `wert` ist das, was gespeichert wird. */
export const STUFEN = [
  { wert: 5, emoji: '🤩', name: 'Super' },
  { wert: 4, emoji: '😊', name: 'Gut' },
  { wert: 3, emoji: '😐', name: 'Okay' },
  { wert: 2, emoji: '😔', name: 'Naja' },
  { wert: 1, emoji: '😫', name: 'Schlecht' },
] as const;

export type Stufe = (typeof STUFEN)[number];

/** Der Schlüssel im lokalen Speicher. Hier, damit ihn niemand zweimal tippt. */
export const SPEICHERSCHLUESSEL = 'klar_mood_history';

/**
 * Ein gespeicherter Eintrag.
 *
 * `date` steht in der Form, die `toLocaleDateString('de-DE')` liefert —
 * `T.M.JJJJ`, ohne führende Nullen. Das Format ist nicht schön, aber es liegt
 * so im Speicher der Personen, die das Widget schon benutzt haben. Es zu
 * ändern hiesse, ihre Einträge zu verlieren.
 */
export interface Eintrag {
  date: string;
  mood: number;
  emoji: string;
}

export function stufeZu(wert: number): Stufe | null {
  return STUFEN.find((s) => s.wert === wert) ?? null;
}

/** `T.M.JJJJ` für einen Tag. Ortszeit, weil die Einträge in Ortszeit entstehen. */
export function tagesschluessel(bezug: Date): string {
  return `${bezug.getDate()}.${bezug.getMonth() + 1}.${bezug.getFullYear()}`;
}

/**
 * Ein Datum in eine vergleichbare Zahl umrechnen.
 *
 * Gibt `null` zurück, wenn die Zeichenkette nicht passt — der Aufrufer
 * entscheidet dann, was damit geschieht. Führende Nullen sind erlaubt
 * (`03.08.2026`), weil ältere Einträge sie tragen können.
 */
export function alsZahl(datum: string): number | null {
  if (typeof datum !== 'string') return null;
  const teile = datum.split('.');
  if (teile.length !== 3) return null;
  const [t, m, j] = teile.map((x) => Number.parseInt(x, 10));
  if (t === undefined || m === undefined || j === undefined) return null;
  if (!Number.isFinite(t) || !Number.isFinite(m) || !Number.isFinite(j)) return null;
  if (m < 1 || m > 12 || t < 1 || t > 31) return null;
  return j * 10000 + m * 100 + t;
}

/**
 * Nimmt an, was die Form eines Eintrags hat. Verwirft den Rest.
 *
 * Ein Eintrag ohne lesbares Datum oder mit einer Stufe ausserhalb 1–5 wird
 * weggelassen, nicht zurechtgebogen. Ein halb gelesener Eintrag wäre
 * schlimmer als keiner.
 */
export function eintraegeAus(wert: unknown): Eintrag[] {
  if (!Array.isArray(wert)) return [];
  const aus: Eintrag[] = [];
  for (const e of wert) {
    if (e === null || typeof e !== 'object') continue;
    const o = e as Record<string, unknown>;
    const datum = o['date'];
    const stufe = o['mood'];
    if (typeof datum !== 'string' || alsZahl(datum) === null) continue;
    if (typeof stufe !== 'number' || stufeZu(stufe) === null) continue;
    const emoji = typeof o['emoji'] === 'string' && o['emoji'] !== ''
      ? o['emoji']
      : (stufeZu(stufe)?.emoji ?? '');
    aus.push({ date: datum, mood: stufe, emoji });
  }
  return aus;
}

/** Das Gleiche aus einer gespeicherten Zeichenkette. Unlesbares ergibt []. */
export function eintraegeAusText(text: string | null): Eintrag[] {
  if (typeof text !== 'string' || text === '') return [];
  try {
    return eintraegeAus(JSON.parse(text) as unknown);
  } catch {
    return [];
  }
}

/** Älteste zuerst. Einträge mit gleichem Tag behalten ihre Reihenfolge. */
export function sortiert(eintraege: readonly Eintrag[]): Eintrag[] {
  return [...eintraege].sort((a, b) => (alsZahl(a.date) ?? 0) - (alsZahl(b.date) ?? 0));
}

/**
 * Den Eintrag für einen Tag setzen — vorhandene desselben Tages ersetzen.
 *
 * Gibt eine neue Liste zurück und verändert die übergebene nicht.
 */
export function mitEintrag(eintraege: readonly Eintrag[], neu: Eintrag): Eintrag[] {
  return sortiert([...eintraege.filter((e) => e.date !== neu.date), neu]);
}

/** Die letzten `anzahl` Einträge, älteste zuerst. Nie mehr, als es gibt. */
export function letzte(eintraege: readonly Eintrag[], anzahl: number): Eintrag[] {
  if (!Number.isFinite(anzahl) || anzahl <= 0) return [];
  return sortiert(eintraege).slice(-Math.floor(anzahl));
}

/** Der Eintrag zu einem Tag, oder `null`. */
export function eintragZu(eintraege: readonly Eintrag[], tag: string): Eintrag | null {
  return eintraege.find((e) => e.date === tag) ?? null;
}

/**
 * Ein Satz über den Verlauf — für die Kopfzeile der Trendansicht.
 *
 * Bei null Einträgen benennt er das ausdrücklich, statt eine leere Fläche
 * stehen zu lassen. Bei einem einzigen sagt er, dass es einer ist: ein
 * „Verlauf" aus einem Punkt ist keiner.
 */
export function zusammenfassung(eintraege: readonly Eintrag[]): string {
  const n = eintraege.length;
  if (n === 0) return 'Noch nichts eingetragen. Ab dem ersten Mal entsteht hier dein Verlauf.';
  if (n === 1) return 'Ein Eintrag bisher. Ein Verlauf wird daraus ab dem zweiten Tag.';
  return `${n} Einträge bisher.`;
}
