// ═══════════════════════════════════════════════════════════════════════════
// Antworttext lesbar machen — die Auszeichnungen, die das Modell schickt
//
// Diese Datei importiert NICHTS. Kein React. Sie ist damit prüfbar
// (tests/textform.spec.ts) — dieselbe Regel wie in `pure.ts`, `sprache.ts`,
// `meilensteine.ts`, `stimmung.ts`, `gastGrenze.ts`.
//
// ── DER BEFUND VOM 14.08.2026 (im Browser beobachtet) ─────────────────────
// Der KI-Coach antwortete, und auf dem Bildschirm stand wörtlich:
//
//   * **Option 1 (Werte):** „Hallo! Dein Profil hat mich direkt …
//   * **Option 2 (Zukunft/Träume):** „Hi! Ich fand deinen Gedanken …
//
// Sternchen und Doppelsternchen mitten im Text. Das Modell antwortet in
// Markdown; die Oberfläche gibt den Text unverändert aus (`{msg.text}` mit
// `whitespace-pre-wrap`). Ein Markdown-Darsteller existiert im Projekt
// nicht — geprüft: kein `react-markdown`, kein `marked`, kein
// `dangerouslySetInnerHTML`.
//
// ── WARUM KEINE NEUE ABHÄNGIGKEIT ─────────────────────────────────────────
// `react-markdown` samt Unterbau wiegt mehr als das Problem. Gebraucht wird
// genau der Ausschnitt, den ein Chatmodell tatsächlich benutzt: fetter Text,
// Aufzählungspunkte, Absätze. Der lässt sich in fünfzig Zeilen lesen und in
// zwanzig prüfen — und er kann kein HTML einschleusen, weil er keines
// erzeugt.
//
// ── DIE SICHERHEITSSEITE, AUSDRÜCKLICH ────────────────────────────────────
// Diese Datei erzeugt DATEN, kein Markup. Der Aufrufer rendert daraus
// React-Elemente. Damit gibt es keinen Weg, über eine Modellantwort HTML
// oder ein Skript in die Seite zu bekommen — anders als bei jeder Lösung
// mit `dangerouslySetInnerHTML`. Bei einem Text, der aus einem
// Sprachmodell kommt und fremde Profilangaben enthalten kann, ist das kein
// theoretischer Punkt.
// ═══════════════════════════════════════════════════════════════════════════

/** Ein Stück Text innerhalb einer Zeile. */
export interface Stueck {
  text: string;
  fett: boolean;
}

/** Eine Zeile: entweder ein Absatz oder ein Aufzählungspunkt. */
export interface Zeile {
  art: 'absatz' | 'punkt';
  stuecke: Stueck[];
}

/**
 * Zerlegt eine Zeile an `**…**`.
 *
 * Ein einzelnes, unpaariges `**` bleibt stehen, statt den Rest der Zeile zu
 * verschlucken — lieber ein sichtbares Sternchen als ein verschwundener
 * Halbsatz.
 */
export function stueckeAus(zeile: string): Stueck[] {
  const aus: Stueck[] = [];
  let rest = zeile;

  while (rest.length > 0) {
    const auf = rest.indexOf('**');
    if (auf === -1) {
      aus.push({ text: rest, fett: false });
      break;
    }
    const zu = rest.indexOf('**', auf + 2);
    if (zu === -1) {
      // Unpaarig: alles bleibt gewöhnlicher Text, Sternchen inbegriffen.
      aus.push({ text: rest, fett: false });
      break;
    }
    if (auf > 0) aus.push({ text: rest.slice(0, auf), fett: false });
    const inhalt = rest.slice(auf + 2, zu);
    if (inhalt.length > 0) aus.push({ text: inhalt, fett: true });
    rest = rest.slice(zu + 2);
  }

  return aus.filter((s) => s.text.length > 0);
}

/**
 * Zerlegt einen Antworttext in Zeilen.
 *
 * Erkannt werden:
 *   · `* ` und `- ` am Zeilenanfang als Aufzählungspunkt
 *   · `1. `, `2. ` … ebenfalls als Punkt (die Nummer bleibt im Text)
 *   · `#`, `##`, `###` als Überschrift — dargestellt als fetter Absatz,
 *     nicht als eigene Ebene. In einer Sprechblase sind Überschriften
 *     ohnehin fehl am Platz.
 *   · `**fett**` innerhalb jeder Zeile
 *
 * NICHT erkannt: Verweise, Bilder, Tabellen, Zitate, Quelltextblöcke. Ein
 * Chatmodell benutzt sie in einer Dating-Beratung praktisch nie, und jede
 * zusätzliche Form ist eine weitere Stelle, an der etwas falsch aussehen
 * kann.
 */
export function alsZeilen(text: unknown): Zeile[] {
  if (typeof text !== 'string' || text.trim() === '') return [];

  const aus: Zeile[] = [];
  for (const roh of text.split('\n')) {
    const getrimmt = roh.trim();
    if (getrimmt === '') {
      // Leerzeilen bleiben als leerer Absatz erhalten — sie sind der
      // Abstand, den der Verfasser gemeint hat.
      if (aus.length > 0 && aus[aus.length - 1]?.stuecke.length !== 0) {
        aus.push({ art: 'absatz', stuecke: [] });
      }
      continue;
    }

    const punkt = /^([*\-+]|\d+\.)\s+(.*)$/.exec(getrimmt);
    if (punkt) {
      const inhalt = punkt[1]?.endsWith('.') ? `${punkt[1]} ${punkt[2]}` : (punkt[2] ?? '');
      aus.push({ art: 'punkt', stuecke: stueckeAus(inhalt) });
      continue;
    }

    const ueberschrift = /^#{1,6}\s+(.*)$/.exec(getrimmt);
    if (ueberschrift) {
      aus.push({ art: 'absatz', stuecke: [{ text: ueberschrift[1] ?? '', fett: true }] });
      continue;
    }

    aus.push({ art: 'absatz', stuecke: stueckeAus(getrimmt) });
  }

  // Ein nachlaufender leerer Absatz ist nur Luft am Ende.
  while (aus.length > 0 && aus[aus.length - 1]?.stuecke.length === 0) aus.pop();
  return aus;
}

/**
 * Der Text ohne jede Auszeichnung — für Stellen, an denen nur eine
 * Zeichenkette gebraucht wird (Suche, Zwischenablage, Vorlesehilfe).
 */
export function alsReinerText(text: unknown): string {
  return alsZeilen(text)
    .map((z) => {
      const inhalt = z.stuecke.map((s) => s.text).join('');
      return z.art === 'punkt' && inhalt !== '' ? `• ${inhalt}` : inhalt;
    })
    .join('\n');
}

/**
 * Enthält der Text überhaupt Auszeichnungen?
 *
 * Für die Frage, ob sich die Zerlegung lohnt — und für eine Prüfung, die
 * feststellen soll, ob das Modell sich an „bitte ohne Markdown" hält.
 */
export function hatAuszeichnung(text: unknown): boolean {
  if (typeof text !== 'string') return false;
  return /(^|\n)\s*([*\-+]|\d+\.)\s+/.test(text) || /\*\*[^*]+\*\*/.test(text) || /(^|\n)#{1,6}\s+/.test(text);
}
