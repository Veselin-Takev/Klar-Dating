// ═══════════════════════════════════════════════════════════════════════════
// Korrektur 11.08.2026 — Nachtrag zu einspielen11august.mjs
//
// BEFUND: Der Block `d_effekt` in `einspielen11august.mjs` hatte die Zeile
// `useEffect(() => {` im ALT-Teil aufgeführt, im NEU-Teil aber nicht wieder
// eingesetzt. Ergebnis: Der Rumpf des Effekts blieb stehen, die Öffnung
// fehlte, und die zugehörige Schlusszeile `}, []);` stand allein da.
//
//   src/screens/Dashboard.tsx:415 - error TS1128: Declaration or statement expected.
//   src/screens/Dashboard.tsx:415 - error TS1005: ';' expected.
//
// Dieses Skript setzt genau eine Zeile wieder ein. Es sucht die Stelle über
// den Text, nicht über eine Zeilennummer — die Nummer weicht zwischen
// Arbeitskopien ab.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync } from 'node:fs';

const DATEI = 'src/screens/Dashboard.tsx';
const ANKER = 'Kontingent vom Server, nicht aus dem';
const EINZUSETZEN = '  useEffect(() => {';

let text;
try {
  text = readFileSync(DATEI, 'utf8');
} catch {
  console.error('ABBRUCH: ' + DATEI + ' nicht gefunden.');
  console.error('Bitte aus dem Projektwurzelordner starten (dort, wo package.json liegt).');
  process.exit(1);
}

const zeilen = text.split('\n');
const treffer = [];
for (let i = 0; i < zeilen.length; i++) {
  if (zeilen[i].includes(ANKER)) treffer.push(i);
}

if (treffer.length === 0) {
  console.error('ABBRUCH: Ankerzeile nicht gefunden ("' + ANKER + '").');
  console.error('Lief einspielen11august.mjs wirklich durch? Bitte melden.');
  process.exit(1);
}
if (treffer.length > 1) {
  console.error('ABBRUCH: Ankerzeile ' + treffer.length + '-mal gefunden, erwartet genau 1.');
  console.error('Nichts geaendert. Bitte melden.');
  process.exit(1);
}

const i = treffer[0];

// Bereits erledigt? Dann die vorige nicht-leere Zeile ist die Oeffnung.
let v = i - 1;
while (v >= 0 && zeilen[v].trim() === '') v--;
if (v >= 0 && zeilen[v].trim() === 'useEffect(() => {') {
  console.log('schon erledigt: useEffect-Oeffnung steht bereits in Zeile ' + (v + 1) + '.');
  process.exit(0);
}

zeilen.splice(i, 0, EINZUSETZEN);
writeFileSync(DATEI, zeilen.join('\n'), 'utf8');
console.log('ersetzt: useEffect-Oeffnung in Zeile ' + (i + 1) + ' eingesetzt.');
console.log('');
console.log('Naechster Schritt: npm run verify');
