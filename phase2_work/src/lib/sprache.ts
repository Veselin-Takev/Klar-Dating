import { klarStorage } from '../lib/userScopedStorage';
// ═══════════════════════════════════════════════════════════════════════════
// Zielsprache für die Übersetzung von Nachrichten
//
// Diese Datei importiert NICHTS. Kein Firebase, kein React, kein Browser-API
// im rechnenden Teil — und ist deshalb prüfbar (tests/sprache.spec.ts).
// Dieselbe Regel wie in `pure.ts`, `kiPolitik.ts` und `wiederholung.ts`.
//
// ── ABGRENZUNG, DIE WICHTIG IST ───────────────────────────────────────────
// Hier geht es NUR um die Sprache, in die eingehende Nachrichten übersetzt
// werden. Das ist NICHT die Sprache der Oberfläche. Die Oberfläche ist
// heute ausschliesslich deutsch (2.013 fest verdrahtete Textstellen, siehe
// `scripts/sprachumfang.mjs`); ihre Mehrsprachigkeit ist ein eigener,
// deutlich grösserer Schritt.
//
// Beides zu vermischen wäre der bequeme Fehler: Wer die Oberfläche auf
// Englisch stellt, will damit noch lange nicht, dass sein Gegenüber
// übersetzt wird — und umgekehrt.
//
// ── DIE LISTE IST EINE PRODUKTENTSCHEIDUNG ────────────────────────────────
// Sie ist bewusst kurz gehalten. Eine Sprache in dieser Liste heisst: Klar
// zeigt Menschen Text in dieser Sprache. Ob Klar auch Meldungen in dieser
// Sprache LESEN kann — Moderation, Support —, ist eine andere Frage und
// gehört beantwortet, bevor die Liste wächst. Siehe klar/25-mehrsprachigkeit.
//
// ── WARUM DER NAME UND NICHT DER CODE AN DEN SERVER GEHT ──────────────────
// `/api/translate` erwartet `targetLanguage` als lesbaren Namen und gibt ihn
// so an Gemini weiter ("Übersetze nach Englisch"). Ein ISO-Code wäre dort
// weniger zuverlässig. Der Code dient nur der Speicherung und dem Vergleich.
// ═══════════════════════════════════════════════════════════════════════════

export interface Sprache {
  /** ISO-639-1, zum Speichern und Vergleichen. */
  code: string;
  /** Wie die Sprache in der Oberfläche heisst. */
  name: string;
}

export const SPRACHEN: readonly Sprache[] = [
  { code: 'de', name: 'Deutsch' },
  { code: 'en', name: 'Englisch' },
  { code: 'fr', name: 'Französisch' },
  { code: 'es', name: 'Spanisch' },
  { code: 'it', name: 'Italienisch' },
  { code: 'nl', name: 'Niederländisch' },
  { code: 'pl', name: 'Polnisch' },
  { code: 'pt', name: 'Portugiesisch' },
  { code: 'tr', name: 'Türkisch' },
  { code: 'uk', name: 'Ukrainisch' },
  { code: 'ru', name: 'Russisch' },
  { code: 'ar', name: 'Arabisch' },
] as const;

/** Was gilt, wenn nichts gewählt und nichts erkennbar ist. */
export const VORGABE_CODE = 'de';

/** Schlüssel im klarStorage. Einmal hier, damit er nicht an zwei Stellen
 *  getippt und an einer davon falsch geschrieben wird. */
export const SPEICHER_SCHLUESSEL = 'klar_zielsprache';

/** Name zu einem Code. Unbekannter Code -> Name der Vorgabe. */
export function nameZuCode(code: string): string {
  const treffer = SPRACHEN.find((s) => s.code === code);
  if (treffer) return treffer.name;
  const vorgabe = SPRACHEN.find((s) => s.code === VORGABE_CODE);
  return vorgabe ? vorgabe.name : 'Deutsch';
}

/** Ist der Code eine Sprache, die wir anbieten? */
export function istBekannt(code: unknown): boolean {
  return typeof code === 'string' && SPRACHEN.some((s) => s.code === code);
}

/**
 * Sprachkennzeichen des Browsers auf einen unterstützten Code abbilden.
 *
 * `navigator.language` liefert Formen wie "de", "de-DE", "de-AT", "pt-BR"
 * oder "zh-Hans-CN". Gewertet wird nur der erste Teil vor dem Bindestrich;
 * regionale Varianten sind für die Übersetzungsrichtung ohne Belang.
 *
 * Ist die Sprache nicht in `SPRACHEN`, gilt die Vorgabe. Das ist bewusst
 * kein „nimm irgendetwas Ähnliches": Eine falsch geratene Zielsprache wäre
 * schlimmer als die Vorgabe, weil sie unbemerkt bliebe.
 */
export function codeAusBrowsersprache(kennzeichen: unknown): string {
  if (typeof kennzeichen !== 'string') return VORGABE_CODE;
  const erster = kennzeichen.trim().toLowerCase().split('-')[0];
  if (!erster) return VORGABE_CODE;
  return istBekannt(erster) ? erster : VORGABE_CODE;
}

/**
 * Die gespeicherte Zielsprache, sonst die des Browsers, sonst die Vorgabe.
 *
 * `leser` und `browsersprache` werden hereingereicht statt hier gelesen —
 * damit bleibt die Funktion prüfbar. Die Anbindung an `klarStorage` und
 * `navigator` steht in `zielsprachenCode()` darunter.
 */
export function ermittleCode(gespeichert: unknown, browsersprache: unknown): string {
  if (istBekannt(gespeichert)) return gespeichert as string;
  return codeAusBrowsersprache(browsersprache);
}

// ── Anbindung an den Browser ──────────────────────────────────────────────
// Ab hier wird auf `window` zugegriffen. Alles darüber ist ohne Browser
// ausführbar; das ist Absicht.

export function zielsprachenCode(): string {
  if (typeof window === 'undefined') return VORGABE_CODE;
  let gespeichert: string | null = null;
  try {
    gespeichert = klarStorage.getItem(SPEICHER_SCHLUESSEL);
  } catch {
    // Privater Modus oder volles Kontingent: dann gilt die Browsersprache.
  }
  return ermittleCode(gespeichert, window.navigator?.language);
}

export function zielsprachenName(): string {
  return nameZuCode(zielsprachenCode());
}

export function setzeZielsprache(code: string): void {
  if (typeof window === 'undefined' || !istBekannt(code)) return;
  try {
    klarStorage.setItem(SPEICHER_SCHLUESSEL, code);
  } catch {
    // Nicht speichern zu koennen ist kein Grund, die Auswahl zu verweigern —
    // sie gilt dann nur fuer diese Sitzung.
  }
}
