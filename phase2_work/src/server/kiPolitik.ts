// ═══════════════════════════════════════════════════════════════════════════
// Klar — was gilt, wenn ein KI-Aufruf scheitert
//
// Diese Datei importiert NICHTS. Sie läuft ohne Firebase, ohne Express und
// ohne installierte Pakete — und ist genau deshalb prüfbar
// (tests/pure.spec.ts). Dieselbe Regel wie in `pure.ts`.
//
// ── WOZU ───────────────────────────────────────────────────────────────────
// Am 10.08.2026 zeigte eine systematische Suche: 29 `catch`-Blöcke in
// server.ts antworteten mit HTTP 200 und erfundenen Inhalten. Darunter:
//
//   /api/mood-monitor      "harmonisch", Score 70, "Alles bestens."
//   /api/check-safety      isFlagged: false — eine Freigabe ohne Prüfung
//   /api/competence-radar  Grenzsetzung 70
//   /api/profile-check     80/75/85, "Dein Profil wirkt sympathisch."
//
// Keine dieser Antworten war von einer echten zu unterscheiden. Das ist der
// Kern des Problems — nicht der Ausfall.
//
// ── DIE REGEL ÜBER ALLEM ───────────────────────────────────────────────────
// Eine erfundene personenbezogene Auswertung ist niemals zulässig. Sagt ein
// Endpunkt etwas über die nutzende Person oder ihr Gegenüber aus — Stimmung,
// Kompatibilität, Fortschritt, Persönlichkeit, Risiko —, dann gibt es keinen
// kuratierten Ersatz. Nur ehrlich scheitern, veraltet mit Datum, oder
// ausblenden.
//
// ── WARUM EINE TABELLE STATT CODE JE ENDPUNKT ──────────────────────────────
// Der Vorgängerzustand war „jeder Endpunkt regelt es selbst" — 53 Stellen,
// 53 Gelegenheiten, es zu vergessen. Genau daraus sind die 29 Befunde
// entstanden. Hier steht je Endpunkt nur, WAS gilt; das WIE steht einmal.
// Ein neuer Endpunkt ohne Eintrag fällt in `scripts/check-ki-ersatz.mjs` auf.
// ═══════════════════════════════════════════════════════════════════════════

/** Was gilt, wenn der KI-Aufruf nicht liefert. */
export type Ersatzstrategie =
  /** Ehrlich scheitern. Ein Ersatz wäre eine Aussage, die niemand geprüft
   *  hat — Sicherheitsurteile, Bewertungen über Personen, Texte, die als
   *  eigene gespeichert werden. */
  | 'kein_ersatz'
  /** Die letzte gültige Antwort, MIT ausgewiesenem Alter. Für Auswertungen,
   *  die sich langsam ändern und deren veraltete Fassung nicht schadet. */
  | 'zwischenspeicher'
  /** Feste, von Menschen geschriebene Inhalte, gekennzeichnet als „nicht auf
   *  dich zugeschnitten". Nur für allgemeine Inhalte ohne Personenbezug. */
  | 'kuratiert'
  /** Das Widget blendet sich aus. Besser als ein Platzhalter, wenn ohne KI
   *  nichts Ehrliches an die Stelle treten kann. */
  | 'leer';

/** Warum es scheiterte. Wird an den Client durchgereicht, damit die
 *  Oberfläche „ausgelastet" von „kaputt" unterscheiden kann. */
export type KiFehlerCode =
  | 'ki_kein_schluessel'
  | 'ki_kontingent'
  | 'ki_zeitueberschreitung'
  | 'ki_leer'
  | 'ki_ungueltig'
  | 'ki_fehler';

/** Woher die ausgelieferten Daten stammen. Steht in JEDER Antwort — auch der
 *  erfolgreichen. Ohne dieses Feld ist eine zwischengespeicherte Antwort
 *  nicht von einer frischen zu unterscheiden, und genau das war der Befund. */
export type Herkunft = 'ki' | 'zwischenspeicher' | 'kuratiert' | 'keine';

/** Älter als das darf ein zwischengespeicherter Stand nicht ausgeliefert
 *  werden. 36 Stunden, damit „Stand von gestern" wörtlich stimmt und der
 *  Übergang über Nacht nicht in „Stand von vorgestern" kippt. */
export const ZWISCHENSPEICHER_HOECHSTALTER_STUNDEN = 36;

/** Standardgrenze für einen einzelnen KI-Aufruf. Darüber ist die Person
 *  längst weitergescrollt; eine späte Antwort nützt niemandem mehr. */
export const ZEITGRENZE_MS = 20_000;

/** Wie oft wiederholt wird — nur bei Fehlern, die vorübergehend sein können
 *  (Kontingent, Zeitüberschreitung, Serverfehler der Gegenstelle).
 *  Ein fehlender Schlüssel wird NICHT wiederholt; er wird nicht besser. */
export const VERSUCHE = 2;

// ═══════════════════════════════════════════════════════════════════════════
// Die Zuordnung. Grundlage: KI-ERSATZ-MATRIX.md
// ═══════════════════════════════════════════════════════════════════════════

export const STRATEGIE: Record<string, Ersatzstrategie> = {
  // ── kein_ersatz: Ein Ersatz wäre eine ungeprüfte Aussage ────────────────
  '/api/check-safety': 'kein_ersatz',
  '/api/messages/send-audio': 'kein_ersatz',
  '/api/chat': 'kein_ersatz',
  '/api/dating-journal': 'kein_ersatz',
  '/api/ai-passgenauigkeit': 'kein_ersatz',
  '/api/profile-check': 'kein_ersatz',
  '/api/parse-profile-import': 'kein_ersatz',
  '/api/optimize-profile': 'kein_ersatz',
  '/api/translate': 'kein_ersatz',
  '/api/generate-reflection-from-emojis': 'kein_ersatz',
  '/api/dating-journal-analysis': 'kein_ersatz',
  '/api/reply-suggestions': 'kein_ersatz',
  '/api/smart-audit': 'kein_ersatz',

  // ── zwischenspeicher: veraltet ist ehrlich, erfunden nicht ──────────────
  '/api/compatibility-radar': 'zwischenspeicher',
  '/api/dating-success-score': 'zwischenspeicher',
  '/api/klar-compass': 'zwischenspeicher',
  '/api/smart-vibe-map': 'zwischenspeicher',
  '/api/verbindung-context-analysis': 'zwischenspeicher',
  '/api/date-archive-analysis': 'zwischenspeicher',
  '/api/analyze-relationship': 'zwischenspeicher',
  '/api/mood-insight': 'zwischenspeicher',
  '/api/reflection-insight': 'zwischenspeicher',
  '/api/competence-radar': 'zwischenspeicher',
  '/api/timeline-summary': 'zwischenspeicher',

  // ── kuratiert: allgemeiner Inhalt, kein Personenbezug ───────────────────
  '/api/daily-coach-insight': 'kuratiert',
  '/api/dating-readiness': 'kuratiert',
  '/api/daily-icebreakers': 'kuratiert',
  '/api/stats/klar-insights': 'kuratiert',
  '/api/smart-date-planner': 'kuratiert',
  '/api/icebreaker': 'kuratiert',
  '/api/date-checklist': 'kuratiert',
  '/api/date-inspiration': 'kuratiert',
  '/api/date-ideas': 'kuratiert',
  '/api/feeling-question': 'kuratiert',
  '/api/generate-date-plan': 'kuratiert',
  '/api/ai-list': 'kuratiert',
  '/api/date-locations': 'kuratiert',
  '/api/conversation-tuning': 'kuratiert',
  '/api/icebreakers': 'kuratiert',
  '/api/verbindung-optimizer': 'kuratiert',
  '/api/reflection-questions': 'kuratiert',
  '/api/date-planner': 'kuratiert',
  '/api/nogo-suggestions': 'kuratiert',
  '/api/optimize-bio-values': 'kuratiert',
  '/api/ai-coach': 'kuratiert',

  // ── leer: ohne KI tritt nichts Ehrliches an die Stelle ──────────────────
  '/api/city-trend-radar': 'leer',
  '/api/profile-summary': 'leer',
  '/api/quick-insight': 'leer',
  '/api/mood-monitor': 'leer',
  '/api/date-summary': 'leer',
  '/api/summarize-voice': 'leer',
  '/api/city-insider': 'leer',
  '/api/analyze-reflection': 'kein_ersatz',
  '/api/weekly-review': 'leer',
  '/api/journal-audio-dump': 'leer',
};

/** Alle Endpunkte, für die eine Strategie festgelegt ist. */
export function bekannteEndpunkte(): string[] {
  return Object.keys(STRATEGIE).sort();
}

// ═══════════════════════════════════════════════════════════════════════════
// Einordnung des Fehlers
// ═══════════════════════════════════════════════════════════════════════════

/** Ordnet einen beliebigen Fehler einem Code zu.
 *
 *  ABSICHTLICH DULDSAM bei der Eingabe: Was das SDK wirft, ist nicht
 *  garantiert ein `Error`. Ein `unknown` hier ist ehrlicher als ein Typ, der
 *  eine Zusicherung vortäuscht, die niemand einhält. */
export function klassifiziereKiFehler(e: unknown): KiFehlerCode {
  if (e === null || e === undefined) return 'ki_fehler';

  const alsText = (
    typeof e === 'string'
      ? e
      : typeof (e as { message?: unknown }).message === 'string'
        ? (e as { message: string }).message
        : String(e)
  ).toLowerCase();

  const status =
    typeof (e as { status?: unknown }).status === 'number'
      ? (e as { status: number }).status
      : typeof (e as { code?: unknown }).code === 'number'
        ? (e as { code: number }).code
        : undefined;

  if (status === 429) return 'ki_kontingent';
  if (alsText.includes('quota') || alsText.includes('rate limit') || alsText.includes('resource_exhausted')) {
    return 'ki_kontingent';
  }
  if (alsText.includes('abort') || alsText.includes('timeout') || alsText.includes('zeitüberschreitung')) {
    return 'ki_zeitueberschreitung';
  }
  if (alsText.includes('api key') || alsText.includes('api_key') || alsText.includes('unauthenticated')) {
    return 'ki_kein_schluessel';
  }
  if (alsText.includes('leere antwort') || alsText.includes('empty response')) return 'ki_leer';
  if (alsText.includes('json') || alsText.includes('unexpected token')) return 'ki_ungueltig';
  return 'ki_fehler';
}

/** Lohnt ein zweiter Versuch? Nur bei Fehlern, die vorübergehend sein können.
 *  Ein fehlender oder ungültiger Schlüssel wird beim zweiten Mal nicht
 *  richtig — ihn zu wiederholen kostet nur Zeit und Geld. */
export function lohntWiederholung(code: KiFehlerCode): boolean {
  return code === 'ki_kontingent' || code === 'ki_zeitueberschreitung' || code === 'ki_fehler';
}

/** Wartezeit vor dem nächsten Versuch, in Millisekunden.
 *  Verdoppelnd, damit ein ausgelasteter Dienst nicht zusätzlich belastet
 *  wird. Ohne Zufallsanteil — der gehört in den Aufrufer, nicht in eine
 *  Funktion, die getestet werden soll. */
export function wartezeitMs(versuch: number): number {
  if (versuch < 1) return 0;
  return Math.min(500 * 2 ** (versuch - 1), 4000);
}

// ═══════════════════════════════════════════════════════════════════════════
// Die Entscheidung
// ═══════════════════════════════════════════════════════════════════════════

export interface Antwort {
  /** HTTP-Status. 200 NUR, wenn tatsächlich verwertbarer Inhalt mitkommt.
   *  Ein 200 auf einen gescheiterten Aufruf war der Kern der 29 Befunde. */
  status: number;
  koerper: Record<string, unknown>;
}

/** Menschenlesbarer Satz je Fehlercode. Steht in der Antwort, damit die
 *  Oberfläche nicht selbst formulieren muss — und damit überall dasselbe
 *  steht. */
export function fehlertext(code: KiFehlerCode): string {
  switch (code) {
    case 'ki_kontingent':
      return 'Gerade sind sehr viele Anfragen unterwegs. Bitte in ein paar Minuten erneut.';
    case 'ki_zeitueberschreitung':
      return 'Die Auswertung hat zu lange gedauert.';
    case 'ki_kein_schluessel':
      return 'Diese Funktion steht derzeit nicht zur Verfügung.';
    case 'ki_leer':
      return 'Es kam kein Ergebnis zurück.';
    case 'ki_ungueltig':
      return 'Das Ergebnis war unbrauchbar.';
    default:
      return 'Die Auswertung ist fehlgeschlagen.';
  }
}

/** HTTP-Status je Fehlercode.
 *  503 heisst „vorübergehend, versuch es später" — das trifft auf alles zu,
 *  was mit dem KI-Dienst zu tun hat. 502 für eine Gegenstelle, die geantwortet
 *  hat, aber unbrauchbar. */
export function fehlerStatus(code: KiFehlerCode): number {
  if (code === 'ki_leer' || code === 'ki_ungueltig') return 502;
  return 503;
}

/**
 * Entscheidet, was ausgeliefert wird.
 *
 * @param strategie   Was für diesen Endpunkt gilt (aus STRATEGIE).
 * @param code        Warum der Aufruf scheiterte.
 * @param zwischenspeicher  Letzter gültiger Stand, falls vorhanden.
 * @param kuratiert   Feste Inhalte, falls für diesen Endpunkt hinterlegt.
 * @param jetzt       Zeitpunkt — als Parameter, damit die Prüfung testbar
 *                    ist, ohne auf die Uhr zu warten.
 */
export function entscheideAntwort(
  strategie: Ersatzstrategie,
  code: KiFehlerCode,
  zwischenspeicher: { daten: Record<string, unknown>; zeit: string } | null,
  kuratiert: Record<string, unknown> | null,
  jetzt: Date = new Date(),
): Antwort {
  const scheitern = (): Antwort => ({
    status: fehlerStatus(code),
    koerper: { herkunft: 'keine', code, error: fehlertext(code) },
  });

  if (strategie === 'kein_ersatz') return scheitern();

  if (strategie === 'leer') {
    return {
      status: fehlerStatus(code),
      koerper: {
        herkunft: 'keine',
        code,
        error: fehlertext(code),
        // Sagt der Oberfläche ausdrücklich: nicht als Fehler anzeigen,
        // sondern den Bereich weglassen. Ohne dieses Feld müsste jedes
        // Widget selbst raten, und das ginge wieder 53-mal schief.
        ausblenden: true,
      },
    };
  }

  if (strategie === 'zwischenspeicher') {
    if (!zwischenspeicher) return scheitern();
    const alterStunden =
      (jetzt.getTime() - new Date(zwischenspeicher.zeit).getTime()) / 3_600_000;
    if (!Number.isFinite(alterStunden) || alterStunden < 0) return scheitern();
    if (alterStunden > ZWISCHENSPEICHER_HOECHSTALTER_STUNDEN) return scheitern();
    return {
      status: 200,
      koerper: {
        ...zwischenspeicher.daten,
        herkunft: 'zwischenspeicher',
        standVom: zwischenspeicher.zeit,
        // Der Satz gehört in die Antwort, nicht in 11 Widgets.
        hinweis: 'Gespeicherter Stand — die Auswertung ist gerade nicht erreichbar.',
      },
    };
  }

  // kuratiert
  if (!kuratiert) return scheitern();
  return {
    status: 200,
    koerper: {
      ...kuratiert,
      herkunft: 'kuratiert',
      hinweis: 'Allgemeine Vorschläge — nicht auf dich zugeschnitten.',
    },
  };
}

/** Antwort für den Erfolgsfall. Auch sie trägt `herkunft` — sonst wäre eine
 *  frische Antwort nicht von einer zwischengespeicherten zu unterscheiden,
 *  und die Kennzeichnung wäre nur halb so viel wert. */
export function erfolg(daten: Record<string, unknown>): Antwort {
  return { status: 200, koerper: { ...daten, herkunft: 'ki' } };
}
