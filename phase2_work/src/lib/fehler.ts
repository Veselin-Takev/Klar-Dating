import { reportClientError } from './diagnostics';

// ═══════════════════════════════════════════════════════════════════════════
// P2 — stille Fehler
//
// BEFUND: 58 × `console.warn(e)` bzw. `console.error(e)` in leeren
// catch-Blöcken. Ein Ausfall war für die bedienende Person nicht von
// „nichts passiert" zu unterscheiden — und für die Entwicklung nicht von
// „kommt nicht vor", weil `console.warn` in der Produktion niemand sieht.
//
// `melde()` ersetzt beides an einer Stelle: Es geht an Sentry (dort ist es
// zählbar) und in die Konsole (dort ist es beim Entwickeln lesbar), immer
// mit der Stelle, an der es passiert ist.
//
// WAS ES NICHT TUT: Es zeigt der bedienenden Person nichts an. Ein
// Fehlerzustand je Ansicht ist damit NICHT erledigt — er bleibt offen
// (siehe `useOnline` und die States-Bausteine). Diese Datei macht Ausfälle
// sichtbar für uns, noch nicht für die Nutzerin.
// ═══════════════════════════════════════════════════════════════════════════

export function melde(stelle: string, fehler: unknown, zusatz?: Record<string, unknown>): void {
  const e = fehler instanceof Error ? fehler : new Error(String(fehler));
  reportClientError(e);
  if (import.meta.env.DEV) console.error(`[${stelle}]`, e, zusatz ?? '');
}
