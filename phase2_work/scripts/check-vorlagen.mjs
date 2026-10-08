#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Prüft auf maskierte Platzhalter in Vorlagenzeichenketten:  \${…}
//
// ── BEFUND 11.08.2026 ─────────────────────────────────────────────────────
// 17 Stellen in 7 Widgets schrieben `\${…}` statt `${…}` innerhalb eines
// Template-Literals. In JavaScript ist `\$` ein maskiertes Dollarzeichen —
// der Ausdruck wird NICHT ausgewertet, sondern woertlich als Text eingesetzt.
//
// Sichtbare Folgen, alle im Browser bestaetigt:
//   · ProfileCardThemeSelector — fuenf Farbfelder ohne Farbe. Die
//     Hintergrundklasse landete als Text im class-Attribut.
//   · ValuesQuizWidget — `style={{ width: "${(step/…)*100}%" }}`, also ein
//     ungueltiger CSS-Wert. Der Fortschrittsbalken bewegte sich nie.
//   · UserAchievementsWidget, DatingGoalRoadmapWidget,
//     RelationshipJourneyWidget, SmartDatingJournalWidget — erreichte und
//     nicht erreichte Zustaende sahen identisch aus.
//   · DateRatingChartWidget — alle Tortensegmente bekamen denselben
//     React-Schluessel, und im Tooltip stand woertlich "${value} Dates".
//
// WARUM KEINE VORHANDENE PRUEFUNG DAS FINDET: Ein Template-Literal mit
// maskiertem Dollarzeichen ist gueltiges TypeScript. `tsc` sieht eine
// Zeichenkette, ESLint sieht eine Zeichenkette, die Tests rendern diese
// Widgets nicht. Erst das Auge im Browser sieht es — und auch nur, wenn
// man weiss, wie es aussehen sollte.
//
// Deshalb diese Prüfung. Sie ist Teil von `npm run verify`.
// ═══════════════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const WURZEL = process.argv[2] || 'src';

function dateien(verzeichnis, gesammelt = []) {
  for (const name of readdirSync(verzeichnis)) {
    const pfad = join(verzeichnis, name);
    if (statSync(pfad).isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      dateien(pfad, gesammelt);
    } else if (/\.tsx?$/.test(pfad)) {
      gesammelt.push(pfad);
    }
  }
  return gesammelt;
}

const befunde = [];

for (const pfad of dateien(WURZEL)) {
  const zeilen = readFileSync(pfad, 'utf8').split('\n');
  zeilen.forEach((zeile, i) => {
    // Kommentare überspringen: Diese Datei selbst und die Fundstellen-
    // Dokumentation im Code enthalten das Muster absichtlich.
    const roh = zeile.trimStart();
    if (roh.startsWith('//') || roh.startsWith('*') || roh.startsWith('/*')) return;
    if (zeile.includes('\\${')) {
      befunde.push({ pfad, zeile: i + 1, text: zeile.trim().slice(0, 100) });
    }
  });
}

if (befunde.length === 0) {
  console.log('Vorlagen: keine maskierten Platzhalter (\\${…}) gefunden.');
  process.exit(0);
}

console.error(`\nMaskierte Platzhalter gefunden — ${befunde.length} Stelle(n):\n`);
for (const b of befunde) {
  console.error(`  ${b.pfad}:${b.zeile}`);
  console.error(`    ${b.text}`);
}
console.error(
  '\n`\\${…}` in einem Template-Literal wird NICHT ausgewertet, sondern als\n' +
    'Text eingesetzt. Gemeint ist fast sicher `${…}` ohne Rueckstrich.\n' +
    'Soll das Dollarzeichen wirklich woertlich erscheinen, schreiben Sie es\n' +
    'in eine gewoehnliche Zeichenkette statt in ein Template-Literal.\n',
);
process.exit(1);
