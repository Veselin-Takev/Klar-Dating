#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Was der Anmeldebildschirm mitbringt.
//
// ── DER BEFUND VOM 14.08.2026 ─────────────────────────────────────────────
// Im Netzwerk-Reiter, auf dem Anmeldebildschirm, VOR jeder Anmeldung:
//
//     recharts            1.246 kB
//     jspdf                 697 kB
//     d3                    381 kB
//     html2canvas-pro       364 kB
//     EmailSummaryWidget.tsx, PDFResumeGenerator.tsx, Confetti.tsx …
//
// Rund hundert Bausteine, die erst NACH der Anmeldung irgendeinen Zweck
// haben. Der Grund steht in `src/App.tsx`: Jeder Bildschirm wird dort fest
// importiert, und die Weiche `if (!user) return <Login />` steht IM selben
// Baum. Ein fester Import wird geladen, bevor die erste Zeile der
// Komponente laeuft — die Weiche kommt zu spaet.
//
// ── WAS DIESES SKRIPT MISST ───────────────────────────────────────────────
// Es folgt ab `src/main.tsx` NUR den festen Importen (`import x from '…'`).
// `import('…')` — der dynamische Import, den `React.lazy` benutzt — wird
// bewusst NICHT verfolgt: Genau das ist ja der Unterschied.
//
// Herausgezaehlt werden zwei Dinge:
//   · eigene Dateien, die beim ersten Laden mitkommen
//   · fremde Pakete, die dabei mitkommen (die grossen sind das Gewicht)
//
// ── WARUM NICHT AUFLOESBARE IMPORTE GEMELDET WERDEN ───────────────────────
// Ein relativer Import, den das Skript nicht findet, wurde anfangs still
// uebersprungen. Genau daran ist die erste Obergrenze gescheitert: In der
// Arbeitskopie, in der sie gesetzt wurde, fehlte `firebase-applet-config.json`
// — das Skript meldete 29 statt 30, und `verify` wurde beim ersten Lauf im
// echten Repository rot.
//
// Eine Messung, die bei fehlenden Dateien eine ZU NIEDRIGE Zahl liefert,
// ist schlimmer als eine, die abbricht: Sie sieht richtig aus.
//
// ── WAS ES NICHT LEISTET ──────────────────────────────────────────────────
// Es misst ANZAHL, nicht Bytes. Wie gross ein Paket ist, weiss nur der
// Bundler; ohne `node_modules` laesst sich das hier nicht ermitteln. Die
// Anzahl ist trotzdem die richtige Groesse fuer eine Sperrklinke: Sie steigt
// genau dann, wenn jemand einen weiteren Bildschirm fest verdrahtet.
//
// Aufruf:  node scripts/startlast.mjs [Obergrenze] [--liste]
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';

const obergrenze = Number(process.argv[2] ?? 0);
const zeigeListe = process.argv.includes('--liste');
const EINSTIEG = 'src/main.tsx';

/** Fremde Pakete, die von sich aus schwer sind. */
const SCHWER = new Set(['recharts', 'jspdf', 'jspdf-autotable', 'd3', 'html2canvas-pro', 'html-to-image', 'canvas-confetti', '@sentry/react']);

/** Schwere Pakete, die beim ersten Laden dabei sein DUERFEN, mit Grund. */
const ERLAUBT_SCHWER = {
  '@sentry/react': 'Fehlerberichte muessen ab der ersten Zeile stehen. Wer sie nachlaedt, verliert genau die Fehler, die beim Start entstehen — und das sind die schlimmsten.',
};

function ohneKommentare(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, (_m, vor) => vor);
}

/** Nur FESTE Importe. `import(` mit Klammer wird nicht getroffen. */
function festeImporte(text) {
  const raus = [];
  for (const m of text.matchAll(/^\s*import\s+(?:type\s+)?[^;'"]*from\s*['"]([^'"]+)['"]/gm)) {
    if (m[1]) raus.push(m[1]);
  }
  for (const m of text.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm)) {
    if (m[1]) raus.push(m[1]);
  }
  return raus;
}

function aufloesen(vonDatei, ziel) {
  const basis = resolve(dirname(vonDatei), ziel);
  const kandidaten = [
    basis, `${basis}.tsx`, `${basis}.ts`,
    join(basis, 'index.tsx'), join(basis, 'index.ts'),
  ];
  for (const k of kandidaten) {
    if (existsSync(k) && statSync(k).isFile()) return k;
  }
  return null;
}

const eigene = new Set();
const fremde = new Set();
/** Relative Importe, die sich nicht aufloesen lassen. Siehe unten. */
const unauffindbar = [];
const warteschlange = [resolve(EINSTIEG)];

while (warteschlange.length > 0) {
  const datei = warteschlange.pop();
  if (eigene.has(datei)) continue;
  eigene.add(datei);
  let text;
  try {
    text = ohneKommentare(readFileSync(datei, 'utf8'));
  } catch {
    continue;
  }
  for (const ziel of festeImporte(text)) {
    if (ziel.startsWith('.')) {
      const pfad = aufloesen(datei, ziel);
      if (pfad) warteschlange.push(pfad);
      else unauffindbar.push(`${relative(process.cwd(), datei)} -> ${ziel}`);
    } else {
      // `motion/react` -> `motion`, `@scope/paket/x` -> `@scope/paket`
      const teile = ziel.split('/');
      fremde.add(ziel.startsWith('@') ? teile.slice(0, 2).join('/') : (teile[0] ?? ziel));
    }
  }
}

const eigeneListe = [...eigene].map((p) => relative(process.cwd(), p)).sort();
const schwereDabei = [...fremde].filter((p) => SCHWER.has(p)).sort();
const schwereOhneGrund = schwereDabei.filter((p) => !(p in ERLAUBT_SCHWER));

console.log(`\nBeim ersten Laden fest eingebunden: ${eigeneListe.length} eigene Datei(en) — erlaubt sind ${obergrenze}.`);
console.log(`  fremde Pakete: ${fremde.size}, davon als schwer bekannt: ${schwereDabei.length}` +
            (schwereDabei.length ? `  (${schwereDabei.join(', ')})` : ''));
console.log(`  schwere ohne hinterlegten Grund: ${schwereOhneGrund.length}` +
            (schwereOhneGrund.length ? `  (${schwereOhneGrund.join(', ')})` : ''));
console.log(`  nicht aufloesbare Importe: ${unauffindbar.length}`);
for (const u of unauffindbar) console.log(`      ${u}`);
console.log('');

if (zeigeListe) {
  for (const d of eigeneListe) console.log(`  ${d}`);
  console.log('');
}

if (eigeneListe.length > obergrenze || schwereOhneGrund.length > 0 || unauffindbar.length > 0) {
  console.log([
    'Ein fester Import wird geladen, bevor die erste Zeile der Komponente',
    'laeuft. Eine Weiche wie `if (!user) return <Login />` kommt dafuer zu',
    'spaet — der Anmeldebildschirm bringt dann das ganze Dashboard mit.',
    '',
    'Bildschirme und schwere Bausteine gehoeren hinter `React.lazy(() =>',
    'import("…"))`, damit sie erst geladen werden, wenn jemand sie sieht.',
    '',
  ].join('\n'));
  process.exit(1);
}
console.log('');
