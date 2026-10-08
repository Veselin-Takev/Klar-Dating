// ═══════════════════════════════════════════════════════════════════════════
// Rechnet die Kontraste aus src/index.css nach WCAG 2.1 nach.
//
// WARUM ALS SKRIPT: In der Fassung vom 03.08. stand im Dunkelmodus
// `--color-line-ui: #4a5147`. Das ergibt auf der Fläche #1f221e nur
// 1,96 : 1 — WCAG 1.4.11 verlangt 3 : 1. Der Fehler ist beim Nachrechnen
// aufgefallen, nicht beim Ansehen: Eine zu schwache Linie im Dunkelmodus
// wirkt „dezent" statt falsch.
//
// Ein Kommentar mit einer Zahl ist eine Behauptung. Dieses Skript ist eine
// Prüfung.  Aufruf:  npm run check:kontrast
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

/** Liest die Tokenwerte aus dem @theme-Block bzw. aus .dark. */
function tokens(bereich) {
  const start = bereich === 'hell' ? css.indexOf('@theme {') : css.indexOf('.dark {');
  const block = css.slice(start, css.indexOf('\n}', start));
  const werte = {};
  for (const m of block.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    werte[m[1]] = m[2];
  }
  return werte;
}

const kanal = (v) => {
  const x = parseInt(v, 16) / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const luminanz = (hex) => {
  const h = hex.slice(1);
  return 0.2126 * kanal(h.slice(0, 2)) + 0.7152 * kanal(h.slice(2, 4)) + 0.0722 * kanal(h.slice(4, 6));
};
const kontrast = (a, b) => {
  const [hi, lo] = [luminanz(a), luminanz(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// Schwelle 4.5 = Fließtext (1.4.3) · 3.0 = Bedienelement-Umriss (1.4.11)
const PAARE = [
  ['ink', 'canvas', 4.5],
  ['ink', 'surface', 4.5],
  ['muted', 'canvas', 4.5],
  ['muted', 'surface', 4.5],
  ['accent', 'canvas', 4.5],
  ['accent', 'surface', 4.5],
  ['stone-400', 'canvas', 4.5],
  ['stone-400', 'surface', 4.5],
  ['stone-500', 'canvas', 4.5],
  ['stone-500', 'surface', 4.5],
  ['warn', 'canvas', 4.5],
  ['warn', 'surface', 4.5],
  ['line-ui', 'surface', 3.0],
  ['line-ui', 'canvas', 3.0],
];

let fehler = 0;
for (const bereich of ['hell', 'dunkel']) {
  const hell = tokens('hell');
  const t = bereich === 'hell' ? hell : { ...hell, ...tokens('dunkel') };
  console.log(`\n── ${bereich} ${'─'.repeat(52)}`);
  for (const [vorn, hinten, schwelle] of PAARE) {
    const fg = t[vorn], bg = t[hinten];
    if (!fg || !bg) {
      console.log(`  ${vorn} auf ${hinten}: Token fehlt (${vorn}=${fg} ${hinten}=${bg})`);
      fehler++;
      continue;
    }
    const wert = kontrast(fg, bg);
    const ok = wert >= schwelle;
    if (!ok) fehler++;
    console.log(
      `  ${(vorn + ' auf ' + hinten).padEnd(26)} ${wert.toFixed(2).padStart(6)} : 1` +
        `   (mind. ${schwelle})  ${ok ? 'ok' : 'ZU WENIG'}`,
    );
  }
}

// Weiß auf Akzent bzw. dunkler Text auf hellem Akzent — der Fall, in dem ein
// falscher Wert einen Button unlesbar macht.
const h = tokens('hell'), d = { ...h, ...tokens('dunkel') };
console.log(`\n── Text auf der Akzentfläche ${'─'.repeat(37)}`);
for (const [name, fg, bg] of [
  ['hell:   weiß auf accent', '#ffffff', h.accent],
  ['dunkel: canvas auf accent', d.canvas, d.accent],
]) {
  const wert = kontrast(fg, bg);
  if (wert < 4.5) fehler++;
  console.log(`  ${name.padEnd(26)} ${wert.toFixed(2).padStart(6)} : 1   (mind. 4.5)  ${wert >= 4.5 ? 'ok' : 'ZU WENIG'}`);
}

console.log(`\n${fehler === 0 ? 'Alle Paare erfüllen die Schwelle.' : `${fehler} Verstoß/Verstöße.`}`);
process.exit(fehler === 0 ? 0 : 1);
