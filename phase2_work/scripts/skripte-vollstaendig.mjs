#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Jede Datei, die ein `package.json`-Skript aufruft, muss es geben.
//
// ── DER BEFUND VOM 14.08.2026 ─────────────────────────────────────────────
// `npm run build` brach ab:
//
//   Error: Cannot find module '/workspaces/Klar-CL/optimize-images.cjs'
//
// Gemessen: `git log -S "optimize-images" -- package.json` nennt genau einen
// Commit (10c8633), `git log --all -- optimize-images.cjs` ist LEER. Die
// Datei war nie eingecheckt, in keinem Zweig. `npm run build` war also seit
// dem Tag gebrochen, an dem der Aufruf hineingeschrieben wurde.
//
// ── WARUM DAS NIEMAND GEMERKT HAT ─────────────────────────────────────────
// `npm run verify` baut nicht. Zwanzig Pruefskripte meldeten gruen, waehrend
// der Befehl, der die Anwendung tatsaechlich ausliefert, nicht einmal
// startete.
//
// Das ist die unangenehmste Sorte Luecke: nicht eine Pruefung, die etwas
// uebersieht, sondern eine Kette, die gar nicht dorthin schaut.
//
// ── WAS DIESES SKRIPT PRUEFT ──────────────────────────────────────────────
// Es liest die `scripts` aus `package.json` und sammelt jede Datei, die
// darin AUSGEFUEHRT oder ALS EINSTELLUNG gelesen wird:
//
//   node X.cjs        tsx X.ts        esbuild X.ts
//   tsc -p X.json     --config X.json
//
// Ausgabepfade (`--outfile=dist/…`) werden bewusst NICHT geprueft — sie
// entstehen ja erst beim Lauf.
//
// Es dauert Millisekunden und haette diesen Fehler am Tag seiner Entstehung
// gefunden. Ein vollstaendiger `npm run build` in `verify` waere die
// gruendlichere, aber deutlich langsamere Antwort; er gehoert vor das
// Ausrollen, nicht in jeden Prueflauf.
//
// Aufruf:  node scripts/skripte-vollstaendig.mjs [Obergrenze]
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs';

const obergrenze = Number(process.argv[2] ?? 0);

const paket = JSON.parse(readFileSync('package.json', 'utf8'));
const skripte = paket.scripts ?? {};

/** Endungen, die auf eine Datei im Projekt hindeuten. */
const ENDUNGEN = /\.(cjs|mjs|jsx?|tsx?|json)$/;

/** Befehle, deren naechster Wert eine Datei ist. */
const FUEHRT_AUS = new Set(['node', 'tsx', 'esbuild', 'vite-node']);

/** Schalter, deren naechster Wert eine Datei ist. */
const SCHALTER = new Set(['-p', '--project', '--config', '-c']);

const fehlend = [];
const geprueft = new Set();

for (const [name, befehl] of Object.entries(skripte)) {
  // `npm run x && npm run y` enthaelt keine Dateien — die Teile werden
  // ohnehin einzeln geprueft, wenn sie eigene Eintraege sind.
  const wörter = String(befehl).split(/\s+/);
  for (let i = 0; i < wörter.length; i++) {
    const w = wörter[i] ?? '';

    // Ausgabepfade ueberspringen: sie entstehen erst beim Lauf.
    if (w.startsWith('--outfile') || w.startsWith('--out') || w.startsWith('--outdir')) continue;

    let kandidat = null;
    if (FUEHRT_AUS.has(w) || SCHALTER.has(w)) {
      // Den naechsten Wert nehmen, der keine Option ist.
      for (let j = i + 1; j < wörter.length; j++) {
        const n = wörter[j] ?? '';
        if (n.startsWith('-')) continue;
        kandidat = n;
        break;
      }
    } else if (ENDUNGEN.test(w) && !w.startsWith('-') && !w.includes('=')) {
      // Freistehende Dateinamen, z. B. `tsx --test a.spec.ts b.spec.ts`.
      kandidat = w;
    }

    if (!kandidat) continue;
    kandidat = kandidat.replace(/^["']|["']$/g, '');
    if (!ENDUNGEN.test(kandidat)) continue;
    if (kandidat.includes('*')) continue;          // Muster, nicht Pfad
    if (kandidat.startsWith('dist/')) continue;    // Ergebnis, nicht Quelle

    const schluessel = `${name}::${kandidat}`;
    if (geprueft.has(schluessel)) continue;
    geprueft.add(schluessel);

    if (!existsSync(kandidat)) fehlend.push({ skript: name, datei: kandidat });
  }
}

console.log(`\nAufgerufene Dateien, die es nicht gibt: ${fehlend.length} — erlaubt sind ${obergrenze}.`);
console.log(`(${geprueft.size} Aufrufe in ${Object.keys(skripte).length} Skripten geprueft.)\n`);

for (const f of fehlend) {
  console.log(`  npm run ${f.skript}`);
  console.log(`      ruft auf: ${f.datei}`);
}

if (fehlend.length > obergrenze) {
  console.log([
    '',
    'Ein Skript, das eine Datei aufruft, die es nicht gibt, bricht beim ersten',
    'Versuch ab — und faellt so lange nicht auf, wie niemand es ausfuehrt.',
    'Genau das ist `npm run build` passiert.',
    '',
    'Entweder die Datei einchecken oder den Aufruf aus package.json nehmen.',
    '',
  ].join('\n'));
  process.exit(1);
}
console.log('');
