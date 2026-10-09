// ═══════════════════════════════════════════════════════════════════════════
// Der Pausenplan — 7 Tage × 24 Stunden
//
// Diese Datei importiert NICHTS. Kein Firebase, kein React. Sie ist damit
// prüfbar (tests/pausenplan.spec.ts) — dieselbe Regel wie in `pure.ts`,
// `kiPolitik.ts`, `wiederholung.ts` und `sprache.ts`.
//
// ── DER BEFUND VOM 14.08.2026 ─────────────────────────────────────────────
// Smart-Pause gab es ZWEIMAL, und die beiden hielten VERSCHIEDENE Daten an
// VERSCHIEDENEN Orten:
//
//   SmartPauseWidget    klarStorage: `klar_smart_pause_config`
//                       { days: number[], startHour, endHour }
//                       — nur auf diesem Gerät
//   SmartPausePlanner   Firestore: users/{uid}.userSettings.smartPauseSchedule
//                       boolean[7][24] — geräteübergreifend
//
// „Aktiv: 5 Tage, 18:00 – 22:00 Uhr" im Widget musste also nicht dem
// entsprechen, was der Planer zeigte. Beim Gerätewechsel war die eine Hälfte
// weg, die andere nicht.
//
// ── DIE ENTSCHEIDUNG (14.08.2026) ─────────────────────────────────────────
// Firestore ist die führende Quelle. Begründung: geräteübergreifend,
// EINE Wahrheit, und `isValidUserUpdate` in `firestore.rules` führt
// `userSettings` ausdrücklich als erlaubtes Feld.
//
// ── DIE STOLPERSTELLE: ZWEI TAGESZÄHLUNGEN ────────────────────────────────
// `Date.getDay()` zählt ab SONNTAG (0 = So, 1 = Mo, … 6 = Sa).
// Der Plan zählt ab MONTAG (0 = Mo, … 6 = So) — so steht es in der
// Beschriftung des Planers: ['Mo','Di','Mi','Do','Fr','Sa','So'].
//
// Wer das verwechselt, verschiebt den ganzen Plan um einen Tag, und es fällt
// niemandem auf: Die Oberfläche sieht richtig aus, nur die Pause kommt am
// falschen Tag. Deshalb steht die Umrechnung hier als eigene Funktion mit
// eigenen Prüfungen — und nicht als `+ 6 % 7` irgendwo in einem Effekt.
// ═══════════════════════════════════════════════════════════════════════════

/** 7 Tage (0 = Montag) × 24 Stunden. `true` heisst: in dieser Stunde pausiert. */
export type Pausenplan = boolean[][];

export const TAGE = 7;
export const STUNDEN = 24;

/** Ein Plan, in dem nichts pausiert ist. */
export function leererPlan(): Pausenplan {
  return Array.from({ length: TAGE }, () => Array.from({ length: STUNDEN }, () => false));
}

/** Hat der Wert die Form eines Plans? Alles andere wird verworfen, statt es
 *  zurechtzubiegen — ein halb gelesener Plan wäre schlimmer als keiner. */
export function istGueltigerPlan(wert: unknown): wert is Pausenplan {
  if (!Array.isArray(wert) || wert.length !== TAGE) return false;
  return wert.every(
    (tag) => Array.isArray(tag) && tag.length === STUNDEN && tag.every((h) => typeof h === 'boolean'),
  );
}

/**
 * Rechnet `Date.getDay()` (0 = Sonntag) auf den Planindex um (0 = Montag).
 *
 * So -> 6, Mo -> 0, Di -> 1, … Sa -> 5
 */
export function planIndexAusWochentag(jsTag: number): number {
  if (!Number.isInteger(jsTag) || jsTag < 0 || jsTag > 6) return 0;
  return (jsTag + 6) % 7;
}

/** Ist laut Plan gerade Pause? `jsTag` ist der Wert von `Date.getDay()`. */
export function istPauseLautPlan(plan: unknown, jsTag: number, stunde: number): boolean {
  if (!istGueltigerPlan(plan)) return false;
  if (!Number.isInteger(stunde) || stunde < 0 || stunde > 23) return false;
  const zeile = plan[planIndexAusWochentag(jsTag)];
  return zeile !== undefined && zeile[stunde] === true;
}

/** Die alte, nur lokal gespeicherte Form aus `klar_smart_pause_config`. */
export interface AlteKonfiguration {
  /** Wochentage in der Zählung von `Date.getDay()` — 0 = Sonntag. */
  days: number[];
  /** Erste pausierte Stunde, einschliesslich. */
  startHour: number;
  /** Erste Stunde OHNE Pause. `18`–`22` heisst 18, 19, 20, 21. */
  endHour: number;
}

/** Hat der Wert die Form der alten Konfiguration? */
export function istAlteKonfiguration(wert: unknown): wert is AlteKonfiguration {
  if (wert === null || typeof wert !== 'object') return false;
  const k = wert as Record<string, unknown>;
  return (
    Array.isArray(k['days']) &&
    k['days'].every((d) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6) &&
    Number.isInteger(k['startHour']) &&
    Number.isInteger(k['endHour'])
  );
}

/**
 * Übernimmt die alte lokale Konfiguration in einen Plan.
 *
 * WARUM DAS GEBRAUCHT WIRD: Wer heute im Widget „Mo–Fr, 18–22 Uhr" gesetzt
 * hat, hat das NUR im klarStorage. Ohne diese Übernahme wäre der Stand nach
 * der Umstellung auf Firestore weg — ohne Meldung, ohne dass jemand es
 * bemerkt, bis die Pause ausbleibt.
 *
 * `endHour <= startHour` ergibt einen leeren Plan: Ein über Mitternacht
 * laufender Bereich war in der alten Form nicht darstellbar, und ihn hier zu
 * erfinden hiesse, etwas zu übernehmen, was nie eingestellt wurde.
 */
export function planAusAlterKonfiguration(wert: unknown): Pausenplan {
  const plan = leererPlan();
  if (!istAlteKonfiguration(wert)) return plan;
  const { days, startHour, endHour } = wert;
  if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 24) return plan;
  for (const jsTag of days) {
    const zeile = plan[planIndexAusWochentag(jsTag)];
    if (!zeile) continue;
    for (let h = startHour; h < endHour && h < STUNDEN; h++) zeile[h] = true;
  }
  return plan;
}

/** Wie viele Stunden pro Woche pausiert sind — für die Zusammenfassung in
 *  der Oberfläche, damit dort keine Zahl steht, die niemand nachrechnen kann. */
export function pausierteStunden(plan: unknown): number {
  if (!istGueltigerPlan(plan)) return 0;
  return plan.reduce((summe, tag) => summe + tag.filter(Boolean).length, 0);
}

/** Enthält der Plan überhaupt eine Pause? */
export function hatPause(plan: unknown): boolean {
  return pausierteStunden(plan) > 0;
}
