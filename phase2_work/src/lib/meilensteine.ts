// ═══════════════════════════════════════════════════════════════════════════
// Meilensteine — EINE Liste, aus echten Daten
//
// Diese Datei importiert NICHTS. Kein React, kein Firebase. Sie ist damit
// prüfbar (tests/meilensteine.spec.ts) — dieselbe Regel wie in `pure.ts`,
// `kiPolitik.ts`, `wiederholung.ts`, `sprache.ts`, `gastrechte.ts`,
// `pausenplan.ts` und `klarPlus.ts`.
//
// ── DER BEFUND VOM 14.08.2026 ─────────────────────────────────────────────
// Auszeichnungen gab es DREIMAL, mit drei verschiedenen Namenswelten und
// drei verschiedenen Wahrheiten:
//
//   DatingMilestones.tsx         7 „Badges", englische Namen
//                                (Conversation Starter, Thoughtful Planner…)
//   UserAchievementsWidget.tsx   3 „Auszeichnungen", deutsche Namen
//   DatingMilestonesWidget.tsx   7 „Dating-Meilensteine", wieder andere
//
// Auf dem Dashboard standen zwei davon gleichzeitig; auf der Profilseite
// die anderen zwei. „Eisbrecher", „Icebreaker-Experte" und „Der Eisbrecher"
// waren drei verschiedene Dinge mit fast demselben Namen.
//
// ── DREI FEHLER, DIE DABEI AUFFIELEN ──────────────────────────────────────
//
// 1. ERFUNDENER FORTSCHRITT. `DatingMilestones.tsx:102` enthielt:
//
//        // For demo purposes, we will mock some progress if none exists
//        if (…alles 0…) {
//          currentStats['stats_conversations_started'] = 1;
//          currentStats['stats_dates_planned'] = 2; // unlocked!
//          klarStorage.setItem('stats_dates_planned_date', today);
//        }
//
//    Ein frisch angelegtes Konto bekam damit einen Meilenstein geschenkt,
//    den es nicht erreicht hatte — mitsamt Konfetti und einer echten
//    Benachrichtigung („Meilenstein freigeschaltet"). Das ist genau die
//    Sorte erfundener Anzeige, die `klar/14-ki-ersatz-matrix` und `klar/17`
//    seit dem 10.08.2026 aus der App entfernen.
//
// 2. UNERREICHBARE AUSZEICHNUNGEN. Von den ursprünglich 17 Einträgen war
//    ein grosser Teil an Schlüssel gebunden, die NIRGENDS geschrieben
//    werden — `stats_conversations_started`, `stats_match_compass_activity`,
//    `stats_successful_icebreakers`, `klar_chats_started`,
//    `klar_chat_streak`, `klar_ritual_tracker`. Fünf weitere standen in
//    `DatingMilestonesWidget` mit dem Kommentar „P2: war fest verdrahtet"
//    dauerhaft auf `false`.
//
//    Eine Auszeichnung, die niemand jemals erreichen kann, ist kein Ziel,
//    sondern ein graues Kästchen, das dauerhaft Versagen anzeigt.
//    `scripts/meilensteine-erreichbar.mjs` prüft das jetzt bei jedem
//    `verify`.
//
// 3. ZIELE AN ZWEI ORTEN. `SuccessSummaryWidget.tsx` hielt eine eigene
//    Kopie der Zielwerte. Zwei Listen, die dasselbe behaupten sollen,
//    laufen auseinander — hier stand die Kopie bereits auf einem anderen
//    Stand als das Original.
//
// ── DIE REGEL, DIE HIER GILT ──────────────────────────────────────────────
// Aufgenommen wird nur, was aus echten Daten ablesbar ist. Kein Meilenstein
// ohne Schreibstelle. Wer einen neuen aufnimmt, muss zuerst die Stelle
// bauen, die den Fortschritt zählt — sonst schlägt `verify` fehl.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Die Speicherschlüssel, aus denen der Fortschritt abgelesen wird.
 *
 * ── FORM BEACHTEN ─────────────────────────────────────────────────────────
 * `scripts/meilensteine-erreichbar.mjs` liest diesen Block mit einem
 * einfachen Ausdruck: eine Zuweisung je Zeile, Wert in einfachen
 * Anführungszeichen. Wer das Format ändert, muss das Skript mitändern —
 * sonst prüft es stillschweigend nichts mehr, und das sähe aus wie „grün".
 */
export const SCHLUESSEL = {
  verabredungenGeplant: 'stats_dates_planned',
  verbindungen: 'stats_matches_collected',
  profilGeprueft: 'stats_profile_optimized',
  duelleGewonnen: 'stats_duels_won',
  bio: 'klar_user_bio',
  interessen: 'userInterests',
  geplanteDates: 'server_date_plans',
} as const;

/** Der Rohbestand aus dem Speicher: Schlüssel → Text oder `null`. */
export type Rohdaten = Record<string, string | null>;

export interface Meilenstein {
  id: string;
  /** Deutsch. Die App richtet sich an den deutschsprachigen Raum. */
  name: string;
  /** Was genau zählt — so formuliert, dass man es nachvollziehen kann. */
  beschreibung: string;
  ziel: number;
  /** Alle Schlüssel, die dieser Eintrag liest. Für die Erreichbarkeitsprüfung. */
  schluessel: readonly string[];
  /** Der Stand aus den Rohdaten. Gibt bei fehlenden Daten 0 — nie einen
   *  ausgedachten Anfangswert. */
  stand: (r: Rohdaten) => number;
}

/** Eine Zahl aus dem Speicher. Fehlt sie oder ist sie unlesbar: 0.
 *  NICHT: ein Vorgabewert wie `|| '2'`.
 *
 *  Woher das Beispiel stammt: `QualityConversationsChartWidget` las
 *  `stats_conversations_started` mit Vorgabe `'2'` — einen Schluessel, den
 *  laut ENTFALLEN (unten) niemand schreibt. Angezeigt wurden also immer
 *  zwei Gespraeche. Der Baustein ist am 14.08.2026 entfernt; die Regel
 *  bleibt, weil der Fehler jederzeit wiederkommen kann. */
export function zahl(r: Rohdaten, schluessel: string): number {
  const roh = r[schluessel];
  if (typeof roh !== 'string') return 0;
  const n = Number.parseInt(roh, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Die Länge eines gespeicherten JSON-Feldes. Unlesbares zählt als 0. */
export function laenge(r: Rohdaten, schluessel: string): number {
  const roh = r[schluessel];
  if (typeof roh !== 'string') return 0;
  try {
    const wert: unknown = JSON.parse(roh);
    return Array.isArray(wert) ? wert.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Die Liste. Sechs Einträge — alle erreichbar.
 *
 * Elf frühere Einträge sind entfallen, weil ihr Fortschritt nirgends
 * gezählt wurde. Sie stehen unten in `ENTFALLEN`, damit sie nicht beim
 * nächsten Umbau unbemerkt zurückkommen.
 */
export const MEILENSTEINE: readonly Meilenstein[] = [
  {
    id: 'profil-vollstaendig',
    name: 'Profil steht',
    beschreibung: 'Eine Kurzbeschreibung von mehr als 20 Zeichen und mindestens drei Interessen.',
    ziel: 1,
    schluessel: [SCHLUESSEL.bio, SCHLUESSEL.interessen],
    stand: (r) => {
      const bio = r[SCHLUESSEL.bio] ?? '';
      const interessen = laenge(r, SCHLUESSEL.interessen);
      return bio.trim().length > 20 && interessen >= 3 ? 1 : 0;
    },
  },
  {
    id: 'profil-geprueft',
    name: 'Profil geprüft',
    beschreibung: 'Das Profil einmal vom KI-Coach ansehen lassen.',
    ziel: 1,
    schluessel: [SCHLUESSEL.profilGeprueft],
    stand: (r) => zahl(r, SCHLUESSEL.profilGeprueft),
  },
  {
    id: 'erstes-date',
    name: 'Erste Verabredung notiert',
    beschreibung: 'Eine Verabredung im Date-Planer eingetragen.',
    ziel: 1,
    schluessel: [SCHLUESSEL.geplanteDates],
    stand: (r) => laenge(r, SCHLUESSEL.geplanteDates),
  },
  {
    id: 'verabredungen-vorbereitet',
    name: 'Zwei Verabredungen vorbereitet',
    beschreibung: 'Den Date-Planer zweimal genutzt.',
    ziel: 2,
    schluessel: [SCHLUESSEL.verabredungenGeplant],
    stand: (r) => zahl(r, SCHLUESSEL.verabredungenGeplant),
  },
  {
    id: 'duelle',
    name: 'Drei Duelle gewonnen',
    beschreibung: 'Drei Dating-Duelle für sich entschieden.',
    ziel: 3,
    schluessel: [SCHLUESSEL.duelleGewonnen],
    stand: (r) => zahl(r, SCHLUESSEL.duelleGewonnen),
  },
  {
    id: 'verbindungen',
    name: 'Fünf Verbindungen',
    beschreibung: 'Fünf Menschen, mit denen es beidseitig gepasst hat.',
    ziel: 5,
    schluessel: [SCHLUESSEL.verbindungen],
    stand: (r) => zahl(r, SCHLUESSEL.verbindungen),
  },
];

/**
 * Was entfallen ist — mit dem Grund.
 *
 * Nicht aus Ordnungsliebe: Ohne diese Liste steht in einem halben Jahr
 * wieder ein „Icebreaker-Experte" da, den niemand erreichen kann.
 */
export const ENTFALLEN: readonly { name: string; grund: string }[] = [
  { name: 'Conversation Starter', grund: '`stats_conversations_started` wird nirgends geschrieben.' },
  { name: 'Thoughtful Conversationalist', grund: '`stats_match_compass_activity` wird nirgends geschrieben.' },
  { name: 'Icebreaker-Experte', grund: '`stats_successful_icebreakers` wird nirgends geschrieben.' },
  { name: 'Eisbrecher', grund: '`klar_chats_started` wird nirgends geschrieben.' },
  { name: 'Gesprächig', grund: '`klar_chat_streak` wird nirgends geschrieben.' },
  { name: 'Zen Master', grund: '`klar_ritual_tracker` wird nirgends geschrieben.' },
  { name: 'Dating Pro', grund: 'Stand dauerhaft auf `false` („P2: war fest verdrahtet").' },
  { name: 'Klartext', grund: 'Stand dauerhaft auf `false`.' },
  { name: 'Volltreffer', grund: 'Stand dauerhaft auf `false`.' },
  { name: 'Konversations-Profi', grund: 'Stand dauerhaft auf `false`.' },
  { name: 'Profil-Meister', grund: 'Ging in „Profil steht" auf — dieselbe Bedingung, anderer Name.' },
  { name: 'Der Eisbrecher', grund: 'Ging in „Erste Verabredung notiert" auf — dieselbe Bedingung (`server_date_plans`), anderer Name.' },
];

/** Alle Schlüssel, die irgendein Meilenstein liest. */
export const ALLE_SCHLUESSEL: readonly string[] = Object.values(SCHLUESSEL);

export function istErreicht(m: Meilenstein, r: Rohdaten): boolean {
  return m.stand(r) >= m.ziel;
}

/** Anteil am Ziel, 0 bis 1. Nie über 1, nie unter 0. */
export function anteil(m: Meilenstein, r: Rohdaten): number {
  if (m.ziel <= 0) return 1;
  const a = m.stand(r) / m.ziel;
  return a < 0 ? 0 : a > 1 ? 1 : a;
}

export function erreichte(r: Rohdaten, liste: readonly Meilenstein[] = MEILENSTEINE): Meilenstein[] {
  return liste.filter((m) => istErreicht(m, r));
}

export function offene(r: Rohdaten, liste: readonly Meilenstein[] = MEILENSTEINE): Meilenstein[] {
  return liste.filter((m) => !istErreicht(m, r));
}

/**
 * Die `anzahl` Meilensteine, die am nächsten liegen — die noch offenen,
 * sortiert nach Anteil, bei Gleichstand nach der Reihenfolge in der Liste.
 *
 * WOZU: Ein Raster aus sechs Kästchen, von denen fünf grau sind, zeigt vor
 * allem, was man alles nicht geschafft hat. Drei erreichbare mit einem
 * Balken zeigen, was als Nächstes geht. Siehe klar/27, Abschnitt 7.
 */
export function naechste(
  r: Rohdaten,
  anzahl = 3,
  liste: readonly Meilenstein[] = MEILENSTEINE,
): Meilenstein[] {
  const rest = offene(r, liste).map((m, i) => ({ m, i, a: anteil(m, r) }));
  rest.sort((x, y) => (y.a - x.a) || (x.i - y.i));
  return rest.slice(0, Math.max(0, anzahl)).map((e) => e.m);
}

/** „2 von 6" — die Zusammenfassung in einer Zeile. */
export function zusammenfassung(r: Rohdaten, liste: readonly Meilenstein[] = MEILENSTEINE): string {
  return `${erreichte(r, liste).length} von ${liste.length}`;
}
