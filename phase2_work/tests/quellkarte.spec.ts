// Reine Prüfung ohne Dateien — läuft über `tsx --test` in `test:pure`.
//
// Geprüft wird `scripts/quellkarte.mjs`. Anlass: Das Startstück
// `dist/assets/index-*.js` wiegt 1.339,65 kB, und woraus es besteht, war
// eine Vermutung. Diese Rechnung soll die Vermutung ersetzen — dann muss
// sie selbst geprüft sein.
//
// Die Zuordnungen sind von Hand gebaut, damit das erwartete Ergebnis
// nachrechenbar ist und nicht aus dem Skript selbst stammt.
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  entschluesselVlq,
  gruppe,
  nachGruppen,
  verteileBytes,
} from "../scripts/quellkarte.mjs";

test("VLQ: die Zahlen, die in jeder Quellkarte vorkommen", () => {
  // 'A' = 0, 'C' = 1, 'E' = 2, 'D' = -1, 'K' = 5.
  assert.deepEqual(entschluesselVlq("A"), [0]);
  assert.deepEqual(entschluesselVlq("C"), [1]);
  assert.deepEqual(entschluesselVlq("E"), [2]);
  assert.deepEqual(entschluesselVlq("D"), [-1]);
  assert.deepEqual(entschluesselVlq("K"), [5]);
  assert.deepEqual(entschluesselVlq("AAAA"), [0, 0, 0, 0]);
  assert.deepEqual(entschluesselVlq("KCAA"), [5, 1, 0, 0]);
});

test("VLQ: mehrstellige Zahlen ueber die Fortsetzungsmarke", () => {
  // 32 wird zu 64 (Vorzeichen im untersten Bit). Erstes Zeichen: 64 & 31 = 0,
  // dazu die Fortsetzungsmarke 32 -> Zeichen 32 = 'g'. Zweites: 64 >> 5 = 2
  // -> 'C'. Also "gC". Mit Vorzeichen: 65 & 31 = 1, +32 = 33 = 'h' -> "hC".
  assert.deepEqual(entschluesselVlq("gC"), [32]);
  assert.deepEqual(entschluesselVlq("hC"), [-32]);
  assert.deepEqual(entschluesselVlq("gE"), [64], "eine Marke weiter");
  assert.deepEqual(entschluesselVlq("+B"), [31], "letztes Zeichen ohne Marke");
});

test("VLQ: unbrauchbare Eingaben ergeben null statt einer falschen Zahl", () => {
  assert.equal(entschluesselVlq("A!"), null, "unbekanntes Zeichen");
  assert.equal(entschluesselVlq("g"), null, "angefangen, nie beendet");
  assert.equal(entschluesselVlq(null), null);
  assert.equal(entschluesselVlq(42), null);
  assert.deepEqual(entschluesselVlq(""), []);
});

test("die Bytes werden auf die richtigen Quellen verteilt", () => {
  // Erzeugte Zeile 1 ist 12 Zeichen lang, Zeile 2 ist 3 Zeichen lang.
  //
  //   Zeile 1: "AAAA"  -> Spalte 0, Quelle 0 (a.js)
  //            "KCAA"  -> Spalte 5, Quelle 1 (b.js)
  //   Zeile 2: "AAAA"  -> Spalte 0, Quelle bleibt 1 (b.js)
  //
  // Erwartet: a.js  = 5 - 0  = 5
  //           b.js  = (12 - 5) + 3 = 10
  const verteilung = verteileBytes("AAAA,KCAA;AAAA", [12, 3], ["a.js", "b.js"]);
  assert.equal(verteilung.get("a.js"), 5);
  assert.equal(verteilung.get("b.js"), 10);
  assert.equal(verteilung.get(null), undefined, "hier bleibt nichts uebrig");
});

test("was vor der ersten Zuordnung steht, gehoert keiner Quelle", () => {
  // "KAAA" beginnt erst bei Spalte 5; die ersten 5 Zeichen sind
  // Einbindungscode des Bundlers.
  const verteilung = verteileBytes("KAAA", [20], ["a.js"]);
  assert.equal(verteilung.get(null), 5);
  assert.equal(verteilung.get("a.js"), 15);
});

test("eine Zeile ganz ohne Zuordnung faellt nicht unter den Tisch", () => {
  const verteilung = verteileBytes("AAAA;;AAAA", [4, 7, 4], ["a.js"]);
  assert.equal(verteilung.get("a.js"), 8);
  assert.equal(verteilung.get(null), 7, "die leere Zeile ist ausgewiesen");
});

test("ein Abschnitt der Breite null bekommt nichts", () => {
  // Beide Abschnitte der ersten Zeile stehen auf Spalte 0: "AAAA" (a.js) und
  // "ACAA" (Spalte +0, Quelle +1 -> b.js). a.js belegt damit 0 Zeichen.
  // Die zweite Zeile nennt keinen Quellwechsel, es bleibt b.js.
  //
  //   a.js  = 0 - 0            = 0   -> taucht gar nicht auf
  //   b.js  = (8 - 0) + (5 - 0) = 13
  const verteilung = verteileBytes("AAAA,ACAA;AAAA", [8, 5], ["a.js", "b.js"]);
  assert.equal(verteilung.has("a.js"), false, "0 Bytes heisst kein Eintrag");
  assert.equal(verteilung.get("b.js"), 13);
});

test("Pakete werden zusammengefasst, eigener Quelltext nicht", () => {
  assert.equal(gruppe("../node_modules/firebase/firestore/dist/index.esm.js"), "firebase");
  assert.equal(gruppe("../node_modules/@sentry/react/build/esm/index.js"), "@sentry/react");
  assert.equal(gruppe("../../src/lib/AuthContext.tsx"), "src/lib/AuthContext.tsx");
  assert.equal(gruppe(null), "(Bundler-Einbindung)");
});

test("nachGruppen sortiert absteigend und summiert je Gruppe", () => {
  const verteilung = new Map<string | null, number>([
    ["../node_modules/firebase/a.js", 100],
    ["../node_modules/firebase/b.js", 50],
    ["../../src/App.tsx", 80],
    [null, 10],
  ]);
  const liste = nachGruppen(verteilung);
  assert.deepEqual(liste.map((g) => g.name), [
    "firebase",
    "src/App.tsx",
    "(Bundler-Einbindung)",
  ]);
  assert.equal(liste[0]?.bytes, 150, "beide firebase-Dateien zusammen");
});
