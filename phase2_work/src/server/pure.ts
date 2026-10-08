// ═══════════════════════════════════════════════════════════════════════════
// Klar — abhängigkeitsfreie Serverlogik
//
// Diese Datei importiert NICHTS. Sie läuft ohne Firebase, ohne Express und
// ohne installierte Pakete — und ist genau deshalb prüfbar
// (tests/pure.spec.ts, Aufruf: npm run test:pure).
//
// Hier liegen die Entscheidungen, bei denen ein Fehler teuer ist:
// Kontingenttag, Eingabegrenzen, Widerrufsfrist, Verifizierungs-Challenge.
// ═══════════════════════════════════════════════════════════════════════════

/** 8 KONTAKTE pro Tag — erste Nachrichten an neue Menschen.
 *  Nicht oberflächliches Wischen, nicht Nachrichten im laufenden Gespräch. */
export const DAILY_CONTACTS = 8;

// ── ENTFERNT 14.08.2026: DAILY_CONTACTS_PLUS ───────────────────────────────
// Hier stand `export const DAILY_CONTACTS_PLUS = Number.POSITIVE_INFINITY;`
// — Klar+ hatte serverseitig unbegrenzt viele Kontakte am Tag.
//
// Das widersprach der Entscheidung vom 14.08.2026 (klar/27, Abschnitt 9c):
// Acht Kontakte am Tag gelten fuer ALLE, auch fuer Klar+. Das Kontingent ist
// bei Klar kein Mangel, den man wegkaufen kann, sondern der Grund, warum die
// App anders funktioniert. Wer es gegen Geld aufhebt, verkauft die
// Eigenschaft weg, fuer die Menschen gekommen sind.
//
// Die Vergleichstabelle war zu diesem Zeitpunkt bereits berichtigt
// (src/lib/klarPlus.ts). Die Zusage stimmte also, die Durchsetzung nicht —
// die unangenehmere Reihenfolge von beiden.

/** Der Tag wechselt um 4 Uhr, nicht um Mitternacht — dieselbe Uhrzeit, die
 *  die Oberfläche nennt. Wer um 1 Uhr nachts schreibt, ist noch im Vortag. */
export const RESET_HOUR = 4;

export function contactDay(now: Date = new Date()): string {
  const shifted = new Date(now.getTime());
  if (shifted.getUTCHours() < RESET_HOUR) shifted.setUTCDate(shifted.getUTCDate() - 1);
  return shifted.toISOString().slice(0, 10);
}

export class InputError extends Error {}

export function requireString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') throw new InputError(`${field} muss ein Text sein.`);
  const t = value.trim();
  if (!t) throw new InputError(`${field} darf nicht leer sein.`);
  if (t.length > maxLength) throw new InputError(`${field} überschreitet ${maxLength} Zeichen.`);
  return t;
}

export function optionalString(value: unknown, field: string, maxLength: number): string {
  if (value === undefined || value === null || value === '') return '';
  return requireString(value, field, maxLength);
}

// ── Kontingent ─────────────────────────────────────────────────────────────

export interface QuotaStand {
  tag: string;
  verbraucht: number;
  /** Wird fuer die Grenze NICHT mehr ausgewertet — acht gelten fuer alle.
   *  Das Feld bleibt, weil der Plan an anderer Stelle zaehlt (Widerruf,
   *  Anzeige) und die Aufrufer ihn ohnehin zur Hand haben. */
  plan: 'frei' | 'plus';
}

export type QuotaEntscheidung =
  | { erlaubt: true; neuVerbraucht: number; uebrig: number }
  | { erlaubt: false; grund: 'limit'; uebrig: 0 };

/**
 * Reine Entscheidung: Darf ein weiterer Kontakt begonnen werden?
 * Der Tageswechsel wird hier mitentschieden — ein neuer Tag setzt den
 * Zähler auf 1, nicht auf 0+1 des Vortags.
 */
export function entscheideKontakt(stand: QuotaStand, heute: string): QuotaEntscheidung {
  // ── EINE GRENZE, FUER ALLE ───────────────────────────────────────────────
  // Weder der Plan noch eine Belohnung hebt sie an.
  //
  // Bis zum 14.08.2026 stand hier:
  //   const extra = stand.extraTag === heute ? Math.max(0, stand.extraContacts ?? 0) : 0;
  //   const grenze = stand.plan === 'plus' ? DAILY_CONTACTS_PLUS : DAILY_CONTACTS + extra;
  //
  // Zwei Wege, das Limit zu ueberschreiten — Geld und Werbung. Beide sind
  // weg, und zwar aus demselben Grund: Das Limit IST das Produkt.
  //
  //   · Der Plan: Entscheidung vom 14.08.2026 (klar/27, 9c). Acht fuer alle.
  //   · Die Belohnung (DAT-05): Sie kam aus `/api/admob-ssv`. Diesen
  //     Endpunkt gibt es seit dem 14.08.2026 nicht mehr — Entscheidung des
  //     Auftraggebers, „fuer das MVP gilt: Streichen. Besser eine schlanke,
  //     voll funktionsfaehige und ehrliche User Journey als unfertige
  //     Monetarisierungs-Features." Damit kann `extraContacts` nicht mehr
  //     entstehen; ein Feld zu lesen, das niemand mehr schreibt, waere
  //     genau die Sorte toter Weg, die schwer zu finden ist.
  //
  // WAS DAS FUER ALTE DATEN HEISST: Ein `extraContacts` aus der Zeit davor
  // liegt vielleicht noch in Firestore. Es wird nicht mehr gelesen und hat
  // damit keine Wirkung. Aufraeumen ist nicht noetig.
  const grenze = DAILY_CONTACTS;
  const verbraucht = stand.tag === heute ? stand.verbraucht : 0;
  if (verbraucht >= grenze) return { erlaubt: false, grund: 'limit', uebrig: 0 };
  const neu = verbraucht + 1;
  return { erlaubt: true, neuVerbraucht: neu, uebrig: grenze - neu };
}

// ── Widerrufsfrist (§ 355 Abs. 2 BGB) ──────────────────────────────────────

export const WITHDRAWAL_DAYS = 14;

export function withdrawalPossible(
  input: { plan: string; startedAt: Date | null; withdrawnAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (input.plan !== 'plus' || !input.startedAt || input.withdrawnAt) return false;
  return now.getTime() < input.startedAt.getTime() + WITHDRAWAL_DAYS * 86_400_000;
}

// ── Verifizierung ──────────────────────────────────────────────────────────
//
// Die Geste kommt vom SERVER und verfällt. Ohne diese beiden Eigenschaften
// ist eine Foto-Verifizierung wirkungslos: Wer die Geste vorher kennt oder
// beliebig lange Zeit hat, reicht ein vorbereitetes Bild ein.
//
// Das ist KEIN Lebendigkeitsnachweis. Es erhöht den Aufwand einer Fälschung,
// es verhindert sie nicht. Alles Weitere entscheidet die Sichtprüfung.

export const GESTEN = [
  'rechte Hand offen neben das Gesicht',
  'linke Hand offen neben das Gesicht',
  'Daumen nach oben vor die Schulter',
  'Zeige- und Mittelfinger nach oben',
  'flache Hand auf die Stirn',
] as const;

export type Geste = (typeof GESTEN)[number];

export const CHALLENGE_TTL_MS = 5 * 60_000;

/** Zufallsquelle wird übergeben, damit dieselbe Zahl dieselbe Geste ergibt —
 *  sonst wäre die Auswahl nicht prüfbar. */
export function waehleGeste(zufall: number): Geste {
  const i = Math.min(GESTEN.length - 1, Math.max(0, Math.floor(zufall * GESTEN.length)));
  return GESTEN[i]!;
}

export type ChallengePruefung =
  | { gueltig: true }
  | { gueltig: false; grund: 'keine_challenge' | 'abgelaufen' | 'bereits_benutzt' };

export function pruefeChallenge(
  c: { ausgegebenAm: Date | null; benutztAm: Date | null } | null,
  now: Date = new Date(),
): ChallengePruefung {
  if (!c || !c.ausgegebenAm) return { gueltig: false, grund: 'keine_challenge' };
  if (c.benutztAm) return { gueltig: false, grund: 'bereits_benutzt' };
  if (now.getTime() >= c.ausgegebenAm.getTime() + CHALLENGE_TTL_MS) {
    return { gueltig: false, grund: 'abgelaufen' };
  }
  return { gueltig: true };
}

export type VerifizierungsStatus = 'nicht_begonnen' | 'in_pruefung' | 'bestaetigt' | 'abgelehnt';

/** `isVerified` ist die einzige Quelle für „bestätigt". Ein Statusfeld, das
 *  „bestaetigt" sagt, ohne dass das Flag gesetzt ist, wäre ein Widerspruch —
 *  und im Zweifel gilt das Flag. */
export function verifizierungsStatus(u: { isVerified?: boolean; verificationStatus?: string }): VerifizierungsStatus {
  if (u.isVerified === true) return 'bestaetigt';
  if (u.verificationStatus === 'in_pruefung') return 'in_pruefung';
  if (u.verificationStatus === 'abgelehnt') return 'abgelehnt';
  return 'nicht_begonnen';
}

// ── Icebreaker-Gate ────────────────────────────────────────────────────────
//
// Beide beantworten zwei Fragen, danach ist der Chat offen. Der Mechanismus,
// der „Mehr echte Gespräche" trägt.

export const GATE_FRAGEN = 2;

// ═══════════════════════════════════════════════════════════════════════════
// SEC-03 — Welche Bild-URL der Server abrufen darf
//
// BEFUND (Final Audit 08.08.2026, server.ts:2428): `fetch(profileImageUrl)`
// mit einer URL, die der Client frei bestimmt. Damit ruft der Server jede
// Adresse ab, die er erreicht — auch solche, die von aussen unerreichbar
// sind: 169.254.169.254 (Metadaten-Dienst der Cloud, liefert Zugangsdaten),
// 127.0.0.1, das interne Netz. Das Ergebnis geht an Gemini und teilweise
// zurueck an die aufrufende Person. Kein Groessen-, kein Zeitlimit.
//
// Die Pruefung steht hier und nicht in server.ts, weil sie damit ohne
// Firebase und ohne Express testbar ist. Genau das war bei den bisherigen
// Sicherheitsbefunden das Problem: Sie liessen sich nicht nachrechnen.
//
// GRUNDSATZ: Erlaubnisliste, keine Verbotsliste. Eine Verbotsliste ist
// unvollstaendig, sobald jemand eine Schreibweise findet, an die niemand
// gedacht hat (oktale IP, IPv6-Mapping, Weiterleitung).
// ═══════════════════════════════════════════════════════════════════════════

/** Hosts, von denen Profilbilder stammen duerfen. Alles andere wird
 *  abgelehnt — auch dann, wenn es harmlos aussieht. */
export const BILD_HOSTS = [
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
  'lh3.googleusercontent.com',   // Profilbild aus der Google-Anmeldung
];

/** Grenze fuer das heruntergeladene Bild. Ohne sie genuegt eine grosse
 *  Datei, um den Server-Speicher zu fuellen. */
export const BILD_MAX_BYTES = 5 * 1024 * 1024;
export const BILD_TIMEOUT_MS = 5000;

export type BildPruefung =
  | { erlaubt: true; url: string }
  | { erlaubt: false; grund: string };

export function pruefeBildUrl(eingabe: unknown): BildPruefung {
  if (typeof eingabe !== 'string' || eingabe.trim() === '') {
    return { erlaubt: false, grund: 'Keine Adresse angegeben.' };
  }
  let u: URL;
  try {
    u = new URL(eingabe);
  } catch {
    return { erlaubt: false, grund: 'Keine gueltige Adresse.' };
  }
  // Nur https. http waere im Netz mitlesbar, und die Schemata file:, data:
  // und gopher: sind die klassischen Wege an einer Pruefung vorbei.
  if (u.protocol !== 'https:') {
    return { erlaubt: false, grund: 'Nur https ist zulaessig.' };
  }
  // Zugangsdaten in der URL (https://user:pass@host) koennen Parser
  // unterschiedlich auslegen und den Host verschleiern.
  if (u.username !== '' || u.password !== '') {
    return { erlaubt: false, grund: 'Adressen mit Zugangsdaten sind nicht zulaessig.' };
  }
  const host = u.hostname.toLowerCase();
  // Exakter Treffer oder echte Subdomain. Ein blosses endsWith() wuerde
  // "boesestorage.googleapis.com.angreifer.de" durchlassen.
  const erlaubt = BILD_HOSTS.some((h) => host === h || host.endsWith('.' + h));
  if (!erlaubt) {
    return { erlaubt: false, grund: 'Diese Herkunft ist nicht freigegeben.' };
  }
  return { erlaubt: true, url: u.toString() };
}

export interface GateStand {
  antwortenA: number;
  antwortenB: number;
}

export type GateZustand = 'offen' | 'wartet_auf_andere' | 'du_bist_dran';

/** `ichBinA` sagt, welche Seite fragt. Beide Seiten müssen GATE_FRAGEN
 *  beantwortet haben — einseitig geöffnet wäre kein Gate. */
export function gateZustand(stand: GateStand, ichBinA: boolean): GateZustand {
  const meine = ichBinA ? stand.antwortenA : stand.antwortenB;
  const andere = ichBinA ? stand.antwortenB : stand.antwortenA;
  if (meine >= GATE_FRAGEN && andere >= GATE_FRAGEN) return 'offen';
  if (meine >= GATE_FRAGEN) return 'wartet_auf_andere';
  return 'du_bist_dran';
}

// ═══════════════════════════════════════════════════════════════════════════
// DSG-02 — Alter und Einwilligung
//
// BEFUND (Final Audit 08.08.2026): `AuthContext.tsx:145` schrieb beim Anlegen
// des Profils `isAdult: true`. Nichts wurde geprueft — das Feld war eine
// Behauptung der App ueber sich selbst. In einer Dating-App ist das der
// Befund mit den groessten Folgen: Minderjaehrige koennen sich anmelden, und
// es gibt keinen Vorgang, der das je bemerkt.
//
// Dazu: keine Einwilligung, kein Nachweis welcher Fassung wann zugestimmt
// wurde (Art. 7 Abs. 1 DSGVO verlangt, dass der Verantwortliche das
// nachweisen kann), kein Widerruf.
//
// Beides steht hier, weil es ohne Firebase und ohne Express nachrechenbar
// sein muss. Eine Altersgrenze, die niemand nachrechnen kann, ist wieder
// nur eine Behauptung.
// ═══════════════════════════════════════════════════════════════════════════

export const MINDESTALTER = 18;

/** Obergrenze gegen Tippfehler und Unsinn (1900-01-01 o. ae.). */
export const HOECHSTALTER = 120;

export type Alterspruefung =
  | { ok: true; alter: number; geburtsdatum: string }
  | { ok: false; grund: 'fehlt' | 'ungueltig' | 'zukunft' | 'zu_jung' | 'unplausibel'; alter?: number };

/**
 * Alter in vollendeten Jahren am Stichtag.
 * Getrennt von der Pruefung, weil die Rechnung selbst die fehleranfaellige
 * Stelle ist: Wer nur die Jahre abzieht, macht aus einem 17-Jaehrigen einen
 * 18-Jaehrigen, sobald das Kalenderjahr passt.
 */
export function alterInJahren(geburt: Date, stichtag: Date): number {
  const [gj, gm, gt] = [geburt.getUTCFullYear(), geburt.getUTCMonth() + 1, geburt.getUTCDate()];
  const [sj, sm, st] = kalendertagBerlin(stichtag);
  const [bm, bt] = geburtstagImJahr(gm, gt, sj);
  let jahre = sj - gj;
  if (sm < bm || (sm === bm && st < bt)) jahre -= 1;
  return jahre;
}

/**
 * GEGENPRÜFUNG 09.08.2026, Befund 1: `alterInJahren` rechnete den Stichtag in
 * UTC. Der Server läuft in UTC, die Zielgruppe lebt in MEZ/MESZ. Zwischen
 * 00:00 und 02:00 Ortszeit am eigenen 18. Geburtstag wurde eine Person mit
 * „Klar ist ab 18 Jahren" abgewiesen — der Fehler ging zulasten der Person
 * und wäre in einer Nachtstunde reproduzierbar, aber tagsüber nie sichtbar.
 *
 * Ein Geburtsdatum ist ein Kalendertag ohne Uhrzeit. Verglichen wird deshalb
 * mit dem Kalendertag in der Zeitzone der Zielgruppe, nicht mit UTC.
 */
export function kalendertagBerlin(d: Date): [number, number, number] {
  // `en-CA` liefert JJJJ-MM-TT — die einzige Sprachkennung, die das ohne
  // Nachformatieren tut.
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
  const [j, m, t] = s.split('-').map(Number);
  return [j as number, m as number, t as number];
}

/**
 * GEGENPRÜFUNG 09.08.2026, Befund 2: Am 29. Februar Geborene wurden in
 * Nicht-Schaltjahren erst am 1. März volljährig. § 188 Abs. 3 BGB stellt
 * für Fristen, die in einem Monat ohne entsprechenden Tag enden, auf den
 * LETZTEN TAG DES MONATS ab — also auf den 28. Februar.
 */
export function geburtstagImJahr(monat: number, tag: number, jahr: number): [number, number] {
  if (monat === 2 && tag === 29 && !istSchaltjahr(jahr)) return [2, 28];
  return [monat, tag];
}

export function istSchaltjahr(j: number): boolean {
  return (j % 4 === 0 && j % 100 !== 0) || j % 400 === 0;
}

/**
 * Prueft ein Geburtsdatum im Format JJJJ-MM-TT.
 *
 * BEWUSST KEIN NACHWEIS: Das ist eine Selbstauskunft. Sie erzeugt keine
 * Gewissheit ueber das Alter — sie erzeugt eine dokumentierte, datierte
 * Angabe statt eines fest verdrahteten `true`. Wer luegt, kommt weiterhin
 * durch. Der Unterschied ist, dass es dann eine Angabe gibt, die falsch
 * war, statt gar keiner.
 */
export function pruefeGeburtsdatum(eingabe: unknown, stichtag: Date = new Date()): Alterspruefung {
  if (typeof eingabe !== 'string' || eingabe.trim() === '') {
    return { ok: false, grund: 'fehlt' };
  }
  const roh = eingabe.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(roh)) {
    return { ok: false, grund: 'ungueltig' };
  }
  const geburt = new Date(roh + 'T00:00:00Z');
  if (Number.isNaN(geburt.getTime())) {
    return { ok: false, grund: 'ungueltig' };
  }
  // Rueckprobe: Der 31.02. wird von Date stillschweigend zum 03.03.
  if (geburt.toISOString().slice(0, 10) !== roh) {
    return { ok: false, grund: 'ungueltig' };
  }
  if (geburt.getTime() > stichtag.getTime()) {
    return { ok: false, grund: 'zukunft' };
  }
  const alter = alterInJahren(geburt, stichtag);
  if (alter > HOECHSTALTER) {
    return { ok: false, grund: 'unplausibel', alter };
  }
  if (alter < MINDESTALTER) {
    return { ok: false, grund: 'zu_jung', alter };
  }
  return { ok: true, alter, geburtsdatum: roh };
}

// ── Einwilligung ───────────────────────────────────────────────────────────

/**
 * Fassung der Rechtstexte. Aendert sich der Inhalt, wird diese Zahl erhoeht —
 * dann gilt eine frueher erteilte Einwilligung nicht mehr fuer den neuen
 * Text, und es wird erneut gefragt. Ohne Versionierung laesst sich Art. 7
 * Abs. 1 DSGVO nicht erfuellen: Man kann nicht nachweisen, WOZU jemand
 * zugestimmt hat.
 */
export const EINWILLIGUNG_VERSION = 1;

/**
 * Getrennte Zwecke, getrennt zustimmbar. Eine Sammelzustimmung waere nicht
 * freiwillig im Sinne des Art. 7 Abs. 2 DSGVO.
 *
 * `notwendig` steht hier nur zur Vollstaendigkeit: Fuer den Betrieb des
 * Dienstes braucht es keine Einwilligung (Art. 6 Abs. 1 lit. b) — das Feld
 * ist deshalb nicht abwaehlbar und wird nicht als Einwilligung gewertet.
 */
export const ZWECKE = ['notwendig', 'ki_auswertung', 'fehlerberichte', 'produktanalyse'] as const;
export type Zweck = (typeof ZWECKE)[number];

export const ZWECK_PFLICHT: Record<Zweck, boolean> = {
  notwendig: true,
  ki_auswertung: false,
  fehlerberichte: false,
  produktanalyse: false,
};

export type Einwilligung = {
  version: number;
  erteiltAm: string;
  zwecke: Partial<Record<Zweck, boolean>>;
  widerrufenAm?: string | null;
};

export type EinwilligungPruefung =
  | { ok: true; zwecke: Record<Zweck, boolean> }
  | { ok: false; grund: string };

/** Normalisiert und prueft, was der Client schickt. */
export function pruefeEinwilligung(eingabe: unknown): EinwilligungPruefung {
  if (typeof eingabe !== 'object' || eingabe === null) {
    return { ok: false, grund: 'Keine Angaben zur Einwilligung.' };
  }
  const roh = eingabe as Record<string, unknown>;
  const zwecke = {} as Record<Zweck, boolean>;
  for (const z of ZWECKE) {
    const wert = roh[z];
    if (wert !== undefined && typeof wert !== 'boolean') {
      return { ok: false, grund: `Zweck „${z}" muss ja oder nein sein.` };
    }
    zwecke[z] = ZWECK_PFLICHT[z] ? true : wert === true;
  }
  return { ok: true, zwecke };
}

/**
 * Gilt eine gespeicherte Einwilligung noch?
 * Nein, wenn sie widerrufen wurde oder zu einer aelteren Fassung gehoert.
 */
export function einwilligungGueltig(
  e: Einwilligung | null | undefined,
  version: number = EINWILLIGUNG_VERSION,
): boolean {
  if (!e) return false;
  if (e.widerrufenAm) return false;
  return e.version === version;
}

/** Darf fuer diesen Zweck verarbeitet werden? */
export function zweckErlaubt(
  e: Einwilligung | null | undefined,
  zweck: Zweck,
  version: number = EINWILLIGUNG_VERSION,
): boolean {
  if (ZWECK_PFLICHT[zweck]) return true;
  if (!einwilligungGueltig(e, version)) return false;
  return e!.zwecke?.[zweck] === true;
}

