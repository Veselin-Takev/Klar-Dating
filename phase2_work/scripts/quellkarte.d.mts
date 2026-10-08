// ═══════════════════════════════════════════════════════════════════════════
// Typen zu `scripts/quellkarte.mjs`
//
// ── WARUM ES DIESE DATEI GIBT ─────────────────────────────────────────────
// `tests/quellkarte.spec.ts` importiert aus einer `.mjs`-Datei. Ohne
// Typangaben meldet `npm run typecheck`:
//
//   TS7016: Could not find a declaration file for module
//           '../scripts/quellkarte.mjs' … implicitly has an 'any' type.
//
// Der naheliegende Ausweg waere `// @ts-ignore` oder ein `any` im Test
// gewesen. Beides haette die Meldung beseitigt und die Pruefung entwertet:
// Ein Test, dessen Gegenstand `any` ist, prueft die Form nicht mit.
//
// Die Skripte bleiben `.mjs`, weil `node` sie direkt ausfuehren koennen muss
// — `npm run groesse` laeuft ohne tsx. Die Typen stehen deshalb daneben.
//
// PFLICHT BEI AENDERUNGEN: Wer eine Funktion in `quellkarte.mjs` aendert,
// aendert sie hier mit. Eine Typangabe, die von der Umsetzung abweicht, ist
// schlimmer als keine — sie behauptet etwas.
// ═══════════════════════════════════════════════════════════════════════════

/** Eine VLQ-Gruppe in Zahlen zerlegen. `null` bei Formfehlern. */
export function entschluesselVlq(text: unknown): number[] | null;

/**
 * Die Bytes des Ergebnisses auf die Quellen verteilen.
 *
 * Der Schlüssel `null` steht für Bytes, die zu keiner Quelle gehören.
 */
export function verteileBytes(
  mappings: unknown,
  zeilenlaengen: readonly number[],
  quellen: readonly string[],
): Map<string | null, number>;

/** Quellnamen zu Gruppen zusammenfassen (Paketname bzw. Pfad). */
export function gruppe(quelle: string | null | undefined): string;

/** Aus der Verteilung eine nach Bytes absteigend sortierte Liste machen. */
export function nachGruppen(
  verteilung: Map<string | null, number>,
): { name: string; bytes: number }[];
