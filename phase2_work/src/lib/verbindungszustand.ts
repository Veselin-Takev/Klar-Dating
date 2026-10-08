// ═══════════════════════════════════════════════════════════════════════════
// Ist die Verbindung verschluesselt — und was sagen wir darueber?
//
// ── DER BEFUND VOM 14.08.2026 ─────────────────────────────────────────────
// In `Login.tsx` stand am Fuss der Anmeldeseite:
//
//     <ShieldCheck className="text-green-600" />
//     <span>Verschlüsselte Verbindung.</span>
//
// Gruenes Schild, klare Aussage — und an NICHTS geknuepft. Weder
// `location.protocol` noch `isSecureContext` kamen in der Datei vor. Ueber
// `http://` stand der Satz genauso da wie ueber `https://`.
//
// ── WARUM DAS SCHWERER WIEGT ALS EINE FALSCHE ZAHL ────────────────────────
// Es ist genau die Aussage, auf die sich Menschen stuetzen, bevor sie
// persoenliche Daten eingeben. Bei einer App, die Stimmungsaufzeichnungen
// verarbeitet — besondere Kategorie nach Art. 9 DSGVO — ist das keine
// Kleinigkeit. Eine Sicherheitszusage, die nie geprueft wird, ist keine
// Zusage, sondern Dekoration.
//
// ── WARUM NICHT EINFACH AUSBLENDEN ────────────────────────────────────────
// Naheliegend waere: bei `http` nichts anzeigen. Das waere ehrlicher als
// vorher, aber immer noch stumm. Wer auf einer unverschluesselten Seite ein
// Passwort eingibt, sollte es ERFAHREN — nicht bloss nicht angelogen werden.
// Deshalb gibt diese Funktion in beiden Faellen einen Text zurueck.
// ═══════════════════════════════════════════════════════════════════════════

export type Verbindungshinweis = {
  /** true nur, wenn der Browser den Zusammenhang als sicher einstuft. */
  sicher: boolean;
  /** Was der Person angezeigt wird. */
  text: string;
};

const SICHER = 'Verschlüsselte Verbindung.';
const UNSICHER = 'Unverschlüsselte Verbindung — gib hier keine Passwörter ein.';

/**
 * @param istSichererZusammenhang  window.isSecureContext
 *
 * `isSecureContext` statt `location.protocol === 'https:'`: Der Browser
 * zaehlt auch `http://localhost` als sicheren Zusammenhang, weil dort kein
 * Netz dazwischenliegt. Ein eigener Vergleich auf `https:` wuerde die
 * Entwicklung faelschlich als unsicher melden — und eine Warnung, die immer
 * kommt, liest bald niemand mehr.
 */
export function verbindungshinweis(istSichererZusammenhang: boolean): Verbindungshinweis {
  return istSichererZusammenhang
    ? { sicher: true, text: SICHER }
    : { sicher: false, text: UNSICHER };
}
