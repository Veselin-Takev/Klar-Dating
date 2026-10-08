#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Das Endpunkt-Inventar — was gibt es, und was davon ist geprüft?
//
// ── WOZU ──────────────────────────────────────────────────────────────────
// Schritt 2 der Teststrategie, offen seit dem 12.08.2026. Die Lage bis
// heute: Es gab keine Liste der Endpunkte. Weder wusste jemand, wie viele es
// sind, noch welche eine Prüfung haben. Ein Bericht, der „116 Endpunkte ohne
// Tests" behauptet, ist ohne diese Liste eine Schätzung.
//
// Am 10.08.2026 ist genau daran etwas Teures aufgefallen: 23 Endpunkte
// waren nicht erreichbar, weil sie UNTERHALB der Auslieferung der
// Oberflaeche registriert waren. Kein Test hat das gemerkt, weil es keine
// gab. Dieses Skript macht die Liste — und die Reihenfolge — sichtbar.
//
// ── WAS ES ERHEBT ─────────────────────────────────────────────────────────
// Für jeden Endpunkt in `server.ts`:
//   · Verfahren und Pfad
//   · Zeilennummer (und damit die Reihenfolge der Registrierung)
//   · ob er VOR oder NACH der Auslieferung der Oberflaeche steht
//   · ob er oeffentlich ist (Liste OEFFENTLICH in server.ts)
//   · ob er fuer Gaeste gesperrt ist (GAST_GESPERRT in gastrechte.ts)
//   · ob irgendein Test seinen Pfad erwaehnt
//
// ── WIE „GEPRUEFT" HIER GEMEINT IST ───────────────────────────────────────
// Erwaehnt eine Datei unter `tests/` die Pfad-Zeichenkette, gilt der
// Endpunkt als beruehrt. Das ist eine SCHWACHE Aussage: Sie sagt nicht, dass
// die Pruefung etwas Sinnvolles tut. Sie sagt nur, dass der Pfad ueberhaupt
// vorkommt. Eine schwache, ehrliche Aussage ist einer starken, erfundenen
// vorzuziehen — und sie faellt sofort auf, wenn ein NEUER Endpunkt
// dazukommt, den niemand erwaehnt.
//
// ── WAS DIESE PRUEFUNG NICHT SIEHT ────────────────────────────────────────
// Ein Endpunkt, der die KI nicht selbst aufruft, sondern die Anfrage in eine
// Warteschlange legt. Genau so ist `/api/reply-suggestions` durchgerutscht:
// Die Route legt die Anfrage in `chatSuggestionQueue` (server.ts:1962),
// gerufen wird Gemini erst beim Abarbeiten (server.ts:1912). Sie stand
// deshalb nicht in `KI_ENDPUNKTE` und hatte WEDER die Kontogrenze
// (60/Stunde) NOCH die Gastgrenze (15) — seit dem 14.08.2026 nachgetragen.
//
// Wer kuenftig ueber eine Warteschlange arbeitet, muss den Pfad von Hand in
// `KI_ENDPUNKTE` eintragen. Diese Pruefung faengt nur den geraden Weg.
//
// ── DIE OBERGRENZE ────────────────────────────────────────────────────────
// Der zweite Aufrufwert ist die hoechste erlaubte Zahl unberuehrter
// Endpunkte. Sie steht in `package.json` auf dem heutigen Stand. Jeder NEUE
// Endpunkt ohne Erwaehnung in den Tests laesst `verify` fehlschlagen — der
// Altbestand blockiert nicht, waechst aber auch nicht.
//
// Aufruf:  node scripts/routen-inventar.mjs [Obergrenze] [--liste]
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const obergrenze = Number(process.argv[2] ?? 0);
const zeigeListe = process.argv.includes('--liste');

const QUELLE = 'server.ts';
if (!existsSync(QUELLE)) {
  console.error(`Nicht gefunden: ${QUELLE}`);
  process.exit(1);
}

/**
 * Entfernt Kommentare — mit einem echten kleinen Leser, nicht mit einem
 * Ausdruck.
 *
 * WARUM: Die uebliche Kurzform
 *
 *     s.replace(/\/\*[\s\S]*?\*\//g, …)
 *
 * hat bei `server.ts` einen ganzen Block verschluckt. Irgendwo weiter oben
 * steht ein `/*` INNERHALB einer Zeichenkette (etwa in einem Muster oder
 * einem Text), und der nicht-gierige Ausdruck laeuft von dort bis zum
 * naechsten `*` mit Schraegstrich — quer ueber hunderte echter Zeilen.
 *
 * Aufgefallen ist es daran, dass die Liste der oeffentlichen Pfade
 * ploetzlich LEER war, obwohl `/api/health` darin steht. Eine Pruefung, die
 * ihren Gegenstand nicht findet, meldet „nichts gefunden" — und das sieht
 * aus wie „alles in Ordnung". Dieselbe Falle wie am 12.08.2026 bei
 * `check-beschriftung`.
 */
function ohneKommentare(quelle) {
  let aus = '';
  let i = 0;
  let anfuehrung = null;
  while (i < quelle.length) {
    const z = quelle[i];
    const zwei = quelle.slice(i, i + 2);

    if (anfuehrung) {
      aus += z;
      if (z === '\\') { aus += quelle[i + 1] ?? ''; i += 2; continue; }
      if (z === anfuehrung) anfuehrung = null;
      i++;
      continue;
    }
    if (z === '"' || z === "'" || z === '`') { anfuehrung = z; aus += z; i++; continue; }

    if (zwei === '//') {
      while (i < quelle.length && quelle[i] !== '\n') { aus += ' '; i++; }
      continue;
    }
    if (zwei === '/*') {
      while (i < quelle.length && quelle.slice(i, i + 2) !== '*/') {
        aus += quelle[i] === '\n' ? '\n' : ' ';
        i++;
      }
      aus += '  ';
      i += 2;
      continue;
    }
    aus += z;
    i++;
  }
  return aus;
}

const rohText = readFileSync(QUELLE, 'utf8');
const text = ohneKommentare(rohText);
const zeilenAnfang = [0];
for (let i = 0; i < text.length; i++) if (text[i] === '\n') zeilenAnfang.push(i + 1);
const zeileVon = (pos) => {
  let lo = 0, hi = zeilenAnfang.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (zeilenAnfang[m] <= pos) lo = m; else hi = m - 1; }
  return lo + 1;
};

// ── Die Grenze: ab wo faengt die Auslieferung der Oberflaeche alles ab? ────
// `app.use(vite.middlewares)` bzw. `app.use(express.static(...))`. Alles
// danach ist im Entwicklungsbetrieb nicht mehr erreichbar — der Befund vom
// 10.08.2026.
const grenzeTreffer = /app\.use\(\s*vite\.middlewares\s*\)|app\.use\(\s*express\.static\(/.exec(text);
const grenzeZeile = grenzeTreffer ? zeileVon(grenzeTreffer.index) : Number.POSITIVE_INFINITY;

// ── Oeffentliche Pfade (kein Anmeldenachweis noetig) ──────────────────────
function mengeAus(name) {
  const anfang = text.indexOf(`const ${name} = new Set([`);
  if (anfang === -1) return new Set();
  const ende = text.indexOf(']);', anfang);
  if (ende === -1) return new Set();
  const block = text.slice(anfang, ende);
  return new Set([...block.matchAll(/["'`](\/api\/[^"'`]*)["'`]/g)].map((m) => m[1]));
}
const OEFFENTLICH = mengeAus('OEFFENTLICH');
const OHNE_ALTERSPRUEFUNG = mengeAus('OHNE_ALTERSPRUEFUNG');

// ── Fuer Gaeste gesperrt ──────────────────────────────────────────────────
let GAST_GESPERRT = new Set();
const gastDatei = 'src/server/gastrechte.ts';
if (existsSync(gastDatei)) {
  const g = ohneKommentare(readFileSync(gastDatei, 'utf8'));
  const anfang = g.indexOf('GAST_GESPERRT');
  const ende = anfang === -1 ? -1 : g.indexOf(']', anfang);
  if (anfang !== -1 && ende !== -1) {
    GAST_GESPERRT = new Set([...g.slice(anfang, ende).matchAll(/["'`](\/api\/[^"'`]*)["'`]/g)].map((m) => m[1]));
  }
}

// ── Die Liste der KI-Endpunkte, wie server.ts sie fuehrt ──────────────────
const KI_ENDPUNKTE = mengeAus('KI_ENDPUNKTE');

// ── Die Endpunkte ─────────────────────────────────────────────────────────
const roheTreffer = [...text.matchAll(/\bapp\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g)];
const endpunkte = [];
for (let k = 0; k < roheTreffer.length; k++) {
  const m = roheTreffer[k];
  const pfad = m[2];
  if (!pfad.startsWith('/api/')) continue; // `app.get('*')` u. a. sind keine Endpunkte

  // Der Rumpf reicht bis zur naechsten Registrierung. Das ist grob, genuegt
  // aber fuer die Frage „ruft dieser Endpunkt die KI auf?" — ein `ai.models`
  // zwischen zwei Registrierungen gehoert zur ersten.
  const bisNaechste = roheTreffer[k + 1]?.index ?? text.length;
  const rumpf = text.slice(m.index, bisNaechste);

  endpunkte.push({
    verfahren: m[1].toUpperCase(),
    pfad,
    zeile: zeileVon(m.index),
    ruftKiAuf: /\bai\.models\b|\bbeantworte\s*\(/.test(rumpf),
  });
}

// ── Was erwaehnen die Tests? ──────────────────────────────────────────────
function testdateien(w, aus = []) {
  if (!existsSync(w)) return aus;
  for (const e of readdirSync(w)) {
    const p = join(w, e);
    if (statSync(p).isDirectory()) testdateien(p, aus);
    else if (/\.(spec|test)\.(ts|tsx)$/.test(p)) aus.push(p);
  }
  return aus;
}
const alleTests = testdateien('tests').map((p) => [p, readFileSync(p, 'utf8')]);
const testText = alleTests.map(([, t]) => t).join('\n');

// ── ZWEI STUFEN VON „GEPRUEFT" ────────────────────────────────────────────
// ERWAEHNT: Der Pfad kommt in irgendeinem Test vor. Das trifft heute auf
//   viele zu — `gastrechte.spec.ts` etwa listet 26 Pfade, um die REGEL zu
//   pruefen, welche Pfade fuer Gaeste gesperrt sind. Das ist eine echte
//   Pruefung, aber sie ruft den Endpunkt nie auf.
// AUFGERUFEN: Der Test schickt tatsaechlich eine Anfrage — erkennbar an
//   `baueApp(`, `supertest` oder `request(`. Das ist die Stufe, die sagt,
//   ob der Endpunkt antwortet, und mit was.
//
// Die zweite Zahl ist die, auf die es ankommt. Sie getrennt auszuweisen
// verhindert, dass „43 von 81 erwaehnt" wie Abdeckung aussieht.
const AUFRUF = /\bbaueApp\s*\(|supertest|\brequest\s*\(/;
const aufrufTests = alleTests.filter(([, t]) => AUFRUF.test(t));
const aufrufText = aufrufTests.map(([, t]) => t).join('\n');

for (const e of endpunkte) {
  e.beruehrt = testText.includes(e.pfad);
  e.aufgerufen = aufrufText.includes(e.pfad);
  e.oeffentlich = OEFFENTLICH.has(e.pfad);
  e.ohneAlter = OHNE_ALTERSPRUEFUNG.has(e.pfad);
  e.gastGesperrt = GAST_GESPERRT.has(e.pfad);
  e.hinterDerGrenze = e.zeile > grenzeZeile;
  e.alsKiGefuehrt = KI_ENDPUNKTE.has(e.pfad);
}

// ── KI-Einstufung gegen die Wirklichkeit ──────────────────────────────────
// Ein Endpunkt, der Gemini aufruft, aber nicht in `KI_ENDPUNKTE` steht, hat
// WEDER die Kontogrenze (60/Stunde) NOCH die Gastgrenze (15). Jeder Aufruf
// geht auf die Rechnung des Betreibers — das ist keine Formsache.
const kiOhneEinstufung = endpunkte.filter((e) => e.ruftKiAuf && !e.alsKiGefuehrt);
const pfadeImCode = new Set(endpunkte.map((e) => e.pfad));
const einstufungOhneEndpunkt = [...KI_ENDPUNKTE].filter((p) => !pfadeImCode.has(p));

const ohneTest = endpunkte.filter((e) => !e.beruehrt);
const ohneAufruf = endpunkte.filter((e) => !e.aufgerufen);
const dahinter = endpunkte.filter((e) => e.hinterDerGrenze);
const doppelt = new Map();
for (const e of endpunkte) {
  const schluessel = `${e.verfahren} ${e.pfad}`;
  doppelt.set(schluessel, (doppelt.get(schluessel) ?? 0) + 1);
}
const mehrfach = [...doppelt.entries()].filter(([, n]) => n > 1);

console.log(`
── ENDPUNKT-INVENTAR ─────────────────────────────────────────────────────
  Endpunkte in ${QUELLE}          ${String(endpunkte.length).padStart(4)}
  davon in Tests erwaehnt         ${String(endpunkte.length - ohneTest.length).padStart(4)}
  davon NICHT erwaehnt            ${String(ohneTest.length).padStart(4)}   (erlaubt: ${obergrenze})
  davon durch einen Aufruf
    tatsaechlich geprueft         ${String(endpunkte.length - ohneAufruf.length).padStart(4)}   (${aufrufTests.length} Testdatei(en) mit Aufruf)
  oeffentlich (ohne Anmeldung)    ${String(endpunkte.filter((e) => e.oeffentlich).length).padStart(4)}
  fuer Gaeste gesperrt            ${String(endpunkte.filter((e) => e.gastGesperrt).length).padStart(4)}
  als KI-Endpunkt gefuehrt        ${String(endpunkte.filter((e) => e.alsKiGefuehrt).length).padStart(4)}   (Liste: ${KI_ENDPUNKTE.size})
  ruft die KI tatsaechlich auf    ${String(endpunkte.filter((e) => e.ruftKiAuf).length).padStart(4)}
  hinter der Oberflaechen-Grenze  ${String(dahinter.length).padStart(4)}   (Zeile ${grenzeZeile === Infinity ? '—' : grenzeZeile})
`);

if (mehrfach.length > 0) {
  console.log('  MEHRFACH REGISTRIERT — die zweite Registrierung ist wirkungslos:');
  for (const [s, n] of mehrfach) console.log(`    ${n}×  ${s}`);
  console.log('');
}

if (dahinter.length > 0) {
  console.log('  HINTER DER AUSLIEFERUNG DER OBERFLAECHE — im Entwicklungsbetrieb nicht');
  console.log('  erreichbar (der Befund vom 10.08.2026, damals 23 Endpunkte):');
  for (const e of dahinter) console.log(`    ${e.verfahren.padEnd(6)} ${e.pfad}  (Zeile ${e.zeile})`);
  console.log('');
}

if (zeigeListe) {
  console.log('  Alle Endpunkte:\n');
  const breite = Math.max(...endpunkte.map((e) => e.pfad.length));
  for (const e of [...endpunkte].sort((a, b) => a.pfad.localeCompare(b.pfad))) {
    const merkmale = [
      e.aufgerufen ? 'AUFRUF' : e.beruehrt ? 'erw.  ' : '      ',
      e.oeffentlich ? 'oeff' : '    ',
      e.gastGesperrt ? 'Gast-' : '     ',
    ].join(' ');
    console.log(`    ${e.verfahren.padEnd(6)} ${e.pfad.padEnd(breite)}  ${merkmale}  Zeile ${e.zeile}`);
  }
  console.log('');
}

if (kiOhneEinstufung.length > 0) {
  console.log('  RUFT DIE KI AUF, STEHT ABER NICHT IN KI_ENDPUNKTE — ohne Kontogrenze');
  console.log('  (60/Stunde) und ohne Gastgrenze (15):');
  for (const e of kiOhneEinstufung) console.log(`    ${e.verfahren.padEnd(6)} ${e.pfad}  (Zeile ${e.zeile})`);
  console.log('');
}

if (einstufungOhneEndpunkt.length > 0) {
  console.log('  STEHT IN KI_ENDPUNKTE, ES GIBT DEN ENDPUNKT ABER NICHT:');
  for (const p of einstufungOhneEndpunkt) console.log(`    ${p}`);
  console.log('  (Harmlos in der Wirkung, aber die Liste ist damit nicht mehr belastbar.)');
  console.log('');
}

if (mehrfach.length > 0 || dahinter.length > 0 || kiOhneEinstufung.length > 0) {
  console.log(`
Beides sind Fehler, keine Schulden: Eine zweite Registrierung wirkt nie, und
ein Endpunkt hinter der Oberflaechen-Auslieferung antwortet im Entwicklungs-
betrieb mit 404 und in der Produktion je nach Verfahren unterschiedlich.
`);
  process.exit(1);
}

if (ohneTest.length > obergrenze) {
  console.log(`  ${ohneTest.length} Endpunkte werden in keinem Test erwaehnt, erlaubt sind ${obergrenze}.\n`);
  for (const e of ohneTest.slice(0, 20)) console.log(`    ${e.verfahren.padEnd(6)} ${e.pfad}`);
  if (ohneTest.length > 20) console.log(`    … und ${ohneTest.length - 20} weitere`);
  console.log(`
„Erwaehnt" ist die schwaechste denkbare Aussage — sie sagt nicht, dass die
Pruefung etwas Sinnvolles tut. Sie zu unterschreiten heisst aber, dass ein
NEUER Endpunkt gebaut wurde, den kein Test auch nur kennt.
`);
  process.exit(1);
}

console.log('');
