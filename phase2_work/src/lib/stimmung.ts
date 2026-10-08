// ═══════════════════════════════════════════════════════════════════════════
// Stimmungsverlauf — der Zeitraum und die Reihe, ohne Erfindung
//
// Diese Datei importiert NICHTS. Kein React, kein recharts. Sie ist damit
// prüfbar (tests/stimmung.spec.ts) — dieselbe Regel wie in `pure.ts`,
// `sprache.ts`, `gastrechte.ts`, `pausenplan.ts`, `klarPlus.ts` und
// `meilensteine.ts`.
//
// ── DER BEFUND VOM 14.08.2026 ─────────────────────────────────────────────
// `DatingVibeChartWidget.tsx` baute eine Reihe über 14 Tage und füllte
// anschliessend jeden Tag ohne Eintrag auf:
//
//     // Fill nulls with previous values or 3 (neutral) if no previous
//     let lastVal = 3;
//     for (…) {
//       if (chartData[i].value !== null) lastVal = chartData[i].value;
//       else chartData[i].value = lastVal;          // ← erfundener Wert
//     }
//
// Wer nie eine Stimmung eingetragen hat, sah damit eine durchgehende Linie
// auf „Neutral" über zwei Wochen — als hätte er jeden Tag etwas gesagt.
//
// Dazu kam ein zweiter Fehler, der den ersten verdeckte:
//
//     if (data.length === 0) return null;   // sollte „leer heisst unsichtbar"
//
// `chartData` hatte IMMER 14 Einträge, unabhängig davon, ob einer davon aus
// echten Daten stammte. Die Bedingung konnte nie zutreffen. Genau dieselbe
// Stelle ist in `MoodCalendarGridWidget` schon einmal aufgefallen und dort
// richtig gelöst worden — mit einer eigenen Angabe aus der QUELLE, nicht
// aus dem Ergebnis.
//
// ── DIE REGEL, DIE HIER GILT ──────────────────────────────────────────────
// Ein Tag ohne Eintrag ist `null` und bleibt `null`. Die Linie bekommt eine
// Lücke (`connectNulls={false}`). Eine Lücke ist die ehrliche Darstellung
// von „dazu liegt nichts vor" — eine waagerechte Linie ist es nicht.
// ═══════════════════════════════════════════════════════════════════════════

/** Die fünf Stufen, wie sie der Stimmungs-Eintrag kennt. */
export type Stimmung = 'excited' | 'relaxed' | 'neutral' | 'nervous' | 'frustrated';

export const STUFEN: Record<Stimmung, number> = {
  excited: 5,
  relaxed: 4,
  neutral: 3,
  nervous: 2,
  frustrated: 1,
};

export const STUFEN_NAMEN: Record<number, string> = {
  5: 'Begeistert',
  4: 'Entspannt',
  3: 'Neutral',
  2: 'Nervös',
  1: 'Frustriert',
};

export function istStimmung(wert: unknown): wert is Stimmung {
  return typeof wert === 'string' && wert in STUFEN;
}

/** Ein gespeicherter Eintrag. `date` in der Form `YYYY-MM-DD`. */
export interface Eintrag {
  date: string;
  mood: Stimmung;
}

/**
 * Die wählbaren Zeiträume.
 *
 * Warum diese vier: 7 ist die Woche, 14 der bisherige Stand, 28 vier volle
 * Wochen (nicht 30 — ein Monat hat keine feste Länge, und ein Raster aus
 * vier Wochen ist vergleichbar), 60 der längste, bei dem ein Tagespunkt auf
 * einem Telefon noch unterscheidbar bleibt.
 */
export const ZEITRAEUME = [7, 14, 28, 60] as const;
export type Zeitraum = (typeof ZEITRAEUME)[number];

export const VORGABE_ZEITRAUM: Zeitraum = 14;

export function istZeitraum(wert: unknown): wert is Zeitraum {
  return typeof wert === 'number' && (ZEITRAEUME as readonly number[]).includes(wert);
}

/** Aus einer beliebigen Eingabe einen gültigen Zeitraum machen. */
export function zeitraumAus(wert: unknown): Zeitraum {
  if (istZeitraum(wert)) return wert;
  const n = typeof wert === 'string' ? Number.parseInt(wert, 10) : NaN;
  return istZeitraum(n) ? n : VORGABE_ZEITRAUM;
}

/** Nimmt an, was die Form eines Eintrags hat. Verwirft den Rest, statt ihn
 *  zurechtzubiegen — ein halb gelesener Eintrag wäre schlimmer als keiner. */
export function eintraegeAus(wert: unknown): Eintrag[] {
  if (!Array.isArray(wert)) return [];
  const aus: Eintrag[] = [];
  for (const e of wert) {
    if (e === null || typeof e !== 'object') continue;
    const o = e as Record<string, unknown>;
    const datum = o['date'];
    if (typeof datum !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) continue;
    if (!istStimmung(o['mood'])) continue;
    aus.push({ date: datum, mood: o['mood'] });
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

export interface Punkt {
  /** `YYYY-MM-DD` — der volle Tag, für die Sprechblase. */
  tag: string;
  /** `TT.MM.` — die Beschriftung an der Achse. */
  beschriftung: string;
  /** 1 bis 5, oder `null` für „an diesem Tag liegt nichts vor". */
  wert: number | null;
}

/** `YYYY-MM-DD` für einen Tag, `versatz` Tage vor `bezug`. Ortszeit, weil
 *  auch die Einträge in Ortszeit entstehen. */
export function tagesschluessel(bezug: Date, versatz = 0): string {
  const d = new Date(bezug.getFullYear(), bezug.getMonth(), bezug.getDate() - versatz);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const t = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${t}`;
}

/**
 * Die Reihe für das Diagramm — ein Punkt je Tag, älteste zuerst.
 *
 * Tage ohne Eintrag bekommen `null`. NICHT den letzten bekannten Wert, nicht
 * „neutral", nicht 0. Siehe den Kopf dieser Datei.
 *
 * Gibt es zu einem Tag mehrere Einträge, gilt der LETZTE in der Liste —
 * dieselbe Regel, die der Eintragsdialog benutzt, wenn man denselben Tag
 * zweimal beantwortet.
 */
export function reihe(eintraege: readonly Eintrag[], zeitraum: Zeitraum, heute: Date): Punkt[] {
  const nachTag = new Map<string, number>();
  for (const e of eintraege) nachTag.set(e.date, STUFEN[e.mood]);

  const punkte: Punkt[] = [];
  for (let i = zeitraum - 1; i >= 0; i--) {
    const tag = tagesschluessel(heute, i);
    const teile = tag.split('-');
    punkte.push({
      tag,
      beschriftung: `${teile[2]}.${teile[1]}.`,
      wert: nachTag.get(tag) ?? null,
    });
  }
  return punkte;
}

/** Wie viele Tage des Zeitraums einen Eintrag tragen. */
export function belegteTage(punkte: readonly Punkt[]): number {
  return punkte.filter((p) => p.wert !== null).length;
}

/**
 * Der Durchschnitt über die belegten Tage — oder `null`, wenn keiner belegt
 * ist. `null` statt 0: Eine Null wäre eine Aussage, und es liegt keine vor.
 */
export function durchschnitt(punkte: readonly Punkt[]): number | null {
  const werte = punkte.map((p) => p.wert).filter((w): w is number => w !== null);
  if (werte.length === 0) return null;
  return werte.reduce((a, b) => a + b, 0) / werte.length;
}

/**
 * Ein Satz über den Zeitraum — für die Kopfzeile.
 *
 * Er nennt IMMER, auf wie vielen Tagen er beruht. Ein Durchschnitt aus zwei
 * Einträgen über 60 Tage ist etwas anderes als einer aus 55, und der
 * Unterschied gehört dahin, wo die Zahl steht.
 */
export function zusammenfassung(punkte: readonly Punkt[], zeitraum: Zeitraum): string {
  const belegt = belegteTage(punkte);
  if (belegt === 0) return `In den letzten ${zeitraum} Tagen hast du nichts eingetragen.`;
  const mittel = durchschnitt(punkte);
  const name = mittel === null ? '' : (STUFEN_NAMEN[Math.round(mittel)] ?? '');
  const tage = belegt === 1 ? '1 Tag' : `${belegt} Tagen`;
  return `Im Mittel „${name}" — aus ${tage} von ${zeitraum}.`;
}
