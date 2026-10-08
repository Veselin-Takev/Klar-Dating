// ═══════════════════════════════════════════════════════════════════════════
// Quellkarte lesen — welcher Quelltext wie viele Bytes im Ergebnis belegt
//
// Diese Datei macht KEINE Ein- oder Ausgabe. Sie ist damit prüfbar
// (tests/quellkarte.spec.ts) — dieselbe Regel wie bei den reinen Modulen in
// `src/lib` und `src/server`.
//
// ── WOZU ──────────────────────────────────────────────────────────────────
// Nach der `lazy`-Umstellung (ebd803c) wiegt das Startstück
// `dist/assets/index-*.js` 1.339,65 kB (378,61 kB gzip). Woraus es besteht,
// war eine VERMUTUNG — „vermutlich firebase/firestore". Eine Vermutung ist
// keine Grundlage für einen Umbau am AuthContext.
//
// Eine Quellkarte (`.map`) weiß es genau: Sie ordnet jeder Stelle im
// Ergebnis eine Stelle im Quelltext zu. Wer die Zuordnungen abläuft, kann
// die Bytes des Ergebnisses auf die Quellen verteilen.
//
// ── WIE GERECHNET WIRD, UND WAS DAS HEISST ────────────────────────────────
// Die Zuordnungen nennen je erzeugter Zeile Spaltenpositionen. Alles von
// einer Position bis zur nächsten gehört zur Quelle der ersten. Der Rest der
// Zeile gehört zur letzten Position.
//
// GENAUIGKEIT: Das sind Bytes im UNKOMPRIMIERTEN Ergebnis. Nach gzip
// verschieben sich die Anteile — wiederholte Zeichenketten sind dort
// billiger. Die Reihenfolge der Verursacher bleibt aber aussagekräftig, und
// darum geht es.
//
// Zeilenumbrüche werden NICHT mitgezählt. Bei minifiziertem Code gibt es
// kaum welche; die Verzerrung ist damit unter einem Promille.
// ═══════════════════════════════════════════════════════════════════════════

const ZEICHEN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Zeichen -> Wert, einmal aufgebaut statt bei jedem Aufruf gesucht. */
const WERT = new Map([...ZEICHEN].map((z, i) => [z, i]));

/**
 * Eine VLQ-Gruppe in Zahlen zerlegen.
 *
 * Base64-VLQ: je Zeichen 5 Nutzbits, das sechste Bit sagt „es geht weiter".
 * Im ersten Zeichen einer Zahl steht das Vorzeichen im untersten Bit.
 *
 * Unbekannte Zeichen brechen ab und geben `null` — lieber keine Zahl als
 * eine falsche.
 */
export function entschluesselVlq(text) {
  if (typeof text !== 'string') return null;
  const raus = [];
  let wert = 0;
  let verschiebung = 0;
  let angefangen = false;
  for (const z of text) {
    const roh = WERT.get(z);
    if (roh === undefined) return null;
    angefangen = true;
    wert += (roh & 31) << verschiebung;
    if (roh & 32) {
      verschiebung += 5;
      continue;
    }
    const negativ = (wert & 1) === 1;
    const betrag = wert >> 1;
    raus.push(negativ ? -betrag : betrag);
    wert = 0;
    verschiebung = 0;
    angefangen = false;
  }
  // Eine angefangene, nie beendete Zahl ist ein Formfehler.
  if (angefangen) return null;
  return raus;
}

/**
 * Die Bytes des Ergebnisses auf die Quellen verteilen.
 *
 * @param mappings      Das Feld `mappings` der Quellkarte.
 * @param zeilenlaengen Länge jeder erzeugten Zeile, in Zeichen.
 * @param quellen       Das Feld `sources` der Quellkarte.
 * @returns Map von Quellname auf Byteanzahl. Nicht zugeordnete Bytes stehen
 *          unter dem Schlüssel `null` — sie gehören zu keiner Quelle
 *          (Einbindungscode des Bundlers) und werden ausgewiesen, statt
 *          stillschweigend unter den Tisch zu fallen.
 */
export function verteileBytes(mappings, zeilenlaengen, quellen) {
  const summe = new Map();
  const dazu = (name, bytes) => {
    if (bytes <= 0) return;
    summe.set(name, (summe.get(name) ?? 0) + bytes);
  };

  if (typeof mappings !== 'string') return summe;

  let quelleIdx = 0;
  const zeilen = mappings.split(';');

  for (let z = 0; z < zeilen.length; z++) {
    const laenge = zeilenlaengen[z] ?? 0;
    const stuecke = zeilen[z] === '' ? [] : (zeilen[z] ?? '').split(',');

    // Position und Quelle je Abschnitt dieser Zeile.
    const abschnitte = [];
    let spalte = 0;
    for (const stueck of stuecke) {
      const zahlen = entschluesselVlq(stueck);
      if (zahlen === null || zahlen.length === 0) continue;
      spalte += zahlen[0] ?? 0;
      if (zahlen.length >= 4) quelleIdx += zahlen[1] ?? 0;
      abschnitte.push({
        spalte,
        // Ein Abschnitt mit nur einer Zahl nennt keine Quelle.
        quelle: zahlen.length >= 4 ? (quellen[quelleIdx] ?? null) : null,
      });
    }

    if (abschnitte.length === 0) {
      dazu(null, laenge);
      continue;
    }

    // Was vor dem ersten Abschnitt steht, gehoert zu keiner Quelle.
    dazu(null, abschnitte[0].spalte);

    for (let i = 0; i < abschnitte.length; i++) {
      const von = abschnitte[i].spalte;
      const bis = i + 1 < abschnitte.length ? abschnitte[i + 1].spalte : laenge;
      dazu(abschnitte[i].quelle, bis - von);
    }
  }

  return summe;
}

/**
 * Quellnamen zu Gruppen zusammenfassen.
 *
 * Ein Paket aus `node_modules` wird auf seinen Namen gekürzt — `firebase`
 * statt vierzig Einzeldateien. Eigener Quelltext behält seinen Pfad, aber
 * ohne führende `../`.
 */
export function gruppe(quelle) {
  if (quelle === null || quelle === undefined) return '(Bundler-Einbindung)';
  const s = String(quelle);
  const i = s.lastIndexOf('node_modules/');
  if (i !== -1) {
    const rest = s.slice(i + 'node_modules/'.length);
    const teile = rest.split('/');
    return rest.startsWith('@') ? `${teile[0]}/${teile[1]}` : (teile[0] ?? rest);
  }
  return s.replace(/^(\.\.\/)+/, '');
}

/** Aus der Verteilung eine sortierte Liste je Gruppe machen. */
export function nachGruppen(verteilung) {
  const summe = new Map();
  for (const [quelle, bytes] of verteilung) {
    const g = gruppe(quelle);
    summe.set(g, (summe.get(g) ?? 0) + bytes);
  }
  return [...summe.entries()]
    .map(([name, bytes]) => ({ name, bytes }))
    .sort((a, b) => b.bytes - a.bytes);
}
