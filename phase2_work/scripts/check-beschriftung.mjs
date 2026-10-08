#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Prüft, ob jede Schaltfläche eine zugängliche Beschriftung hat.
//
// ── BEFUND 12.08.2026, UND ZWEI KORREKTUREN ───────────────────────────────
// `klar/20-enterprise-reife.md` nennt 103 Schaltflächen ohne zugängliche
// Beschriftung. Diese Zahl war falsch — sie stammte aus einem groben `grep`,
// der Dateien zählte statt Schaltflächen.
//
// Die erste Fassung DIESES Skripts war ebenfalls falsch, aus einem anderen
// Grund. Sie suchte mit
//
//     /<button\b([\s\S]*?)>([\s\S]*?)<\/button>/g
//
// nach dem ersten `>`. In JSX steht aber fast in jeder Schaltfläche ein
// Pfeil:
//
//     <button onClick={() => entfernen(id)}>
//                        ↑ hier endete die Suche
//
// Alles danach — auch die `className` mit ihren vielen Buchstaben — galt
// damit als INHALT der Schaltfläche. Und Inhalt mit Buchstaben heisst
// „beschriftet". Jede Schaltfläche mit einer Pfeilfunktion in den
// Eigenschaften wurde also durchgewinkt, egal was in ihr stand.
//
// Das ist zum zweiten Mal dieselbe Regel, die uns einholt:
//   „Eine Prüfung, die einen Bereich nicht ansieht, meldet dort nichts —
//    und sieht dabei aus wie ‚alles grün'."
//
// Diese Fassung sucht das Ende der Eigenschaften mit einem kleinen Leser,
// der Anführungszeichen und geschweifte Klammern mitzählt. `=>` innerhalb
// von `{…}` beendet nichts mehr.
//
// Wozu überhaupt: Eine Schaltfläche, die nur aus einem Symbol besteht, liest
// sich mit einer Vorlesehilfe als „Schaltfläche" und sonst nichts.
//
// ── WIE GEPRÜFT WIRD ──────────────────────────────────────────────────────
// Eine Schaltfläche gilt als beschriftet, wenn eines zutrifft:
//   · sie hat `aria-label`
//   · sie hat `aria-labelledby`
//   · sie hat `title`
//   · zwischen `<button …>` und `</button>` stehen Buchstaben, nachdem alle
//     Tags entfernt wurden
//
// ── WAS DIESE REGEL NICHT SIEHT ───────────────────────────────────────────
// `<button>{anzahl}</button>` gilt als beschriftet, weil „anzahl" Buchstaben
// enthält — obwohl vorgelesen nur eine Zahl herauskommt. Bewusste
// Untertreibung: Lieber eine Schaltfläche zu wenig melden als eine zu viel.
// Eine Prüfung, die falsch anschlägt, wird abgeschaltet, und dann fehlt auch
// der Teil, der stimmte.
//
// ── DIE OBERGRENZE ────────────────────────────────────────────────────────
// Der zweite Aufrufwert ist die höchste erlaubte Zahl. In `package.json`
// steht sie so, dass sie dem heutigen Stand entspricht. Jede neue
// Schaltfläche ohne Namen lässt `verify` fehlschlagen.
//
// Aufruf:  node scripts/check-beschriftung.mjs src [Obergrenze]
// ═══════════════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const WURZEL = process.argv[2] || 'src';
const GRENZE = Number(process.argv[3] ?? Infinity);

function dateien(verzeichnis, gesammelt = []) {
  for (const name of readdirSync(verzeichnis)) {
    const pfad = join(verzeichnis, name);
    if (statSync(pfad).isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      dateien(pfad, gesammelt);
    } else if (/\.tsx$/.test(pfad)) {
      gesammelt.push(pfad);
    }
  }
  return gesammelt;
}

/**
 * Findet das Ende des Eigenschaftenteils eines Tags.
 *
 * `start` zeigt hinter `<button`. Zurück kommt der Index des schliessenden
 * `>` — oder -1, wenn keines gefunden wird. Anführungszeichen und
 * geschweifte Klammern werden mitgezählt, damit `=>` und `>` in
 * Zeichenketten nichts beenden.
 */
function endeDerAttribute(text, start) {
  let i = start;
  let klammern = 0;
  let anfuehrung = null; // ' " `
  while (i < text.length) {
    const z = text[i];
    if (anfuehrung) {
      if (z === '\\') {
        i += 2;
        continue;
      }
      if (z === anfuehrung) anfuehrung = null;
      i++;
      continue;
    }
    if (z === '"' || z === "'" || z === '`') {
      anfuehrung = z;
      i++;
      continue;
    }
    if (z === '{') {
      klammern++;
      i++;
      continue;
    }
    if (z === '}') {
      klammern--;
      i++;
      continue;
    }
    if (z === '>' && klammern === 0) return i;
    i++;
  }
  return -1;
}

/** Sichtbarer Text: Tags entfernen, dann nach Buchstaben suchen. */
function hatText(inhalt) {
  return /[A-Za-zÄÖÜäöüß]/.test(inhalt.replace(/<[^>]*>/g, ' '));
}

const befunde = [];

for (const pfad of dateien(WURZEL)) {
  const text = readFileSync(pfad, 'utf8');
  const start = /<button\b/g;
  let treffer;
  while ((treffer = start.exec(text)) !== null) {
    const attributAnfang = treffer.index + treffer[0].length;
    const ende = endeDerAttribute(text, attributAnfang);
    if (ende === -1) continue;

    const attribute = text.slice(attributAnfang, ende);
    // Selbstschliessend (`<button … />`) hat keinen Inhalt.
    const selbstschliessend = attribute.trimEnd().endsWith('/');

    let inhalt = '';
    if (!selbstschliessend) {
      const schluss = text.indexOf('</button>', ende);
      if (schluss === -1) continue;
      inhalt = text.slice(ende + 1, schluss);
    }

    const beschriftet =
      /\baria-label\b/.test(attribute) ||
      /\baria-labelledby\b/.test(attribute) ||
      /\btitle\b\s*=/.test(attribute) ||
      hatText(inhalt);

    if (!beschriftet) {
      const zeile = text.slice(0, treffer.index).split('\n').length;
      befunde.push({ pfad, zeile });
    }
  }
}

const anzahl = befunde.length;

if (anzahl > GRENZE) {
  console.error(
    `\nSchaltflaechen ohne zugaengliche Beschriftung: ${anzahl} — erlaubt sind ${GRENZE}.\n`,
  );
  const proDatei = new Map();
  for (const b of befunde) proDatei.set(b.pfad, [...(proDatei.get(b.pfad) ?? []), b.zeile]);
  for (const [datei, zeilen] of [...proDatei].sort((a, b) => b[1].length - a[1].length)) {
    console.error(
      `  ${datei}: ${zeilen.length}  (Zeilen ${zeilen.slice(0, 8).join(', ')}${zeilen.length > 8 ? ' …' : ''})`,
    );
  }
  console.error(
    '\nEine Schaltflaeche braucht `aria-label`, `aria-labelledby`, `title`\n' +
      'oder sichtbaren Text. Ein Symbol allein hat keinen Namen, den eine\n' +
      'Vorlesehilfe kennt.\n' +
      '\nIst die Zahl gesunken, bitte die Obergrenze in package.json senken —\n' +
      'sonst faellt der naechste Ruecksschritt nicht auf.\n',
  );
  process.exit(1);
}

console.log(
  `Beschriftung: ${anzahl} Schaltflaeche(n) ohne zugaengliche Beschriftung` +
    (Number.isFinite(GRENZE) ? ` (Obergrenze ${GRENZE}).` : '.'),
);
