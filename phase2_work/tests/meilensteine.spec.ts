// Reine Prüfung ohne Browser — läuft über `tsx --test` in `test:pure`.
//
// Geprüft wird `src/lib/meilensteine.ts`. Der Kern der Prüfung ist der
// Befund vom 14.08.2026: Ein frisch angelegtes Konto bekam in
// `DatingMilestones.tsx` einen Meilenstein geschenkt („For demo purposes,
// we will mock some progress"), samt Konfetti und Benachrichtigung.
//
// Deshalb steht die erste Prüfung hier ganz oben und heisst, was sie ist:
// leerer Speicher, null Meilensteine.
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  MEILENSTEINE,
  ENTFALLEN,
  SCHLUESSEL,
  ALLE_SCHLUESSEL,
  zahl,
  laenge,
  istErreicht,
  anteil,
  erreichte,
  offene,
  naechste,
  zusammenfassung,
  type Rohdaten,
} from "../src/lib/meilensteine.ts";

const LEER: Rohdaten = {};

test("ein frisches Konto hat null Meilensteine", () => {
  assert.equal(erreichte(LEER).length, 0);
  assert.equal(offene(LEER).length, MEILENSTEINE.length);
  assert.equal(zusammenfassung(LEER), `0 von ${MEILENSTEINE.length}`);
  for (const m of MEILENSTEINE) {
    assert.equal(m.stand(LEER), 0, `${m.id} steht bei 0`);
    assert.equal(anteil(m, LEER), 0, `${m.id} hat Anteil 0`);
  }
});

test("die Liste ist widerspruchsfrei", () => {
  const ids = MEILENSTEINE.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length, "keine id doppelt");
  const namen = MEILENSTEINE.map((m) => m.name);
  assert.equal(new Set(namen).size, namen.length, "kein Name doppelt");
  for (const m of MEILENSTEINE) {
    assert.ok(m.ziel >= 1, `${m.id} hat ein Ziel von mindestens 1`);
    assert.ok(m.schluessel.length > 0, `${m.id} nennt mindestens einen Schluessel`);
    assert.ok(m.beschreibung.trim().length > 10, `${m.id} erklaert, was zaehlt`);
    for (const s of m.schluessel) {
      assert.ok(
        ALLE_SCHLUESSEL.includes(s),
        `${m.id} liest „${s}" — der Schluessel steht nicht in SCHLUESSEL`,
      );
    }
  }
});

test("entfallene Auszeichnungen sind nicht zurueckgekommen", () => {
  for (const e of ENTFALLEN) {
    assert.ok(e.grund.trim().length > 15, `„${e.name}" hat einen Grund`);
    assert.equal(
      MEILENSTEINE.some((m) => m.name === e.name),
      false,
      `„${e.name}" steht wieder in der Liste`,
    );
  }
});

test("zahl liest nur echte Zahlen, ohne Vorgabewert", () => {
  assert.equal(zahl({ a: "3" }, "a"), 3);
  assert.equal(zahl({ a: "0" }, "a"), 0);
  assert.equal(zahl({ a: "-4" }, "a"), 0);
  assert.equal(zahl({ a: "keine Zahl" }, "a"), 0);
  assert.equal(zahl({ a: null }, "a"), 0);
  assert.equal(zahl({}, "a"), 0);
});

test("laenge liest JSON-Felder, Unlesbares zaehlt als 0", () => {
  assert.equal(laenge({ a: '["x","y"]' }, "a"), 2);
  assert.equal(laenge({ a: "[]" }, "a"), 0);
  assert.equal(laenge({ a: "{kaputt" }, "a"), 0);
  assert.equal(laenge({ a: '{"nicht":"array"}' }, "a"), 0);
  assert.equal(laenge({}, "a"), 0);
});

test("Profil steht verlangt Text UND Interessen", () => {
  const m = MEILENSTEINE.find((x) => x.id === "profil-vollstaendig");
  assert.ok(m);
  const langerText = "Ich koche gern und gehe sonntags lange spazieren.";
  assert.equal(m.stand({ [SCHLUESSEL.bio]: langerText }), 0, "ohne Interessen nicht erreicht");
  assert.equal(
    m.stand({ [SCHLUESSEL.interessen]: '["a","b","c"]' }),
    0,
    "ohne Text nicht erreicht",
  );
  assert.equal(
    m.stand({ [SCHLUESSEL.bio]: "kurz", [SCHLUESSEL.interessen]: '["a","b","c"]' }),
    0,
    "20 Zeichen sind die Grenze",
  );
  assert.equal(
    m.stand({ [SCHLUESSEL.bio]: langerText, [SCHLUESSEL.interessen]: '["a","b","c"]' }),
    1,
  );
});

test("anteil bleibt zwischen 0 und 1", () => {
  const m = MEILENSTEINE.find((x) => x.id === "verbindungen");
  assert.ok(m);
  assert.equal(anteil(m, { [SCHLUESSEL.verbindungen]: "0" }), 0);
  assert.equal(anteil(m, { [SCHLUESSEL.verbindungen]: "1" }), 0.2);
  assert.equal(anteil(m, { [SCHLUESSEL.verbindungen]: "5" }), 1);
  assert.equal(anteil(m, { [SCHLUESSEL.verbindungen]: "99" }), 1, "nie ueber 1");
  assert.equal(istErreicht(m, { [SCHLUESSEL.verbindungen]: "5" }), true);
  assert.equal(istErreicht(m, { [SCHLUESSEL.verbindungen]: "4" }), false);
});

test("naechste liefert die drei erreichbarsten offenen", () => {
  const r: Rohdaten = {
    [SCHLUESSEL.verbindungen]: "4", // 4/5 = 0,8
    [SCHLUESSEL.duelleGewonnen]: "1", // 1/3 ≈ 0,33
    [SCHLUESSEL.verabredungenGeplant]: "1", // 1/2 = 0,5
    [SCHLUESSEL.profilGeprueft]: "1", // erreicht → nicht dabei
  };
  const drei = naechste(r, 3);
  assert.equal(drei.length, 3);
  assert.deepEqual(
    drei.map((m) => m.id),
    ["verbindungen", "verabredungen-vorbereitet", "duelle"],
  );
  assert.equal(
    drei.some((m) => m.id === "profil-geprueft"),
    false,
    "Erreichtes steht nicht bei den naechsten",
  );
});

test("naechste liefert bei leerem Speicher die Listenreihenfolge", () => {
  // Alle bei Anteil 0 — dann entscheidet die Reihenfolge in MEILENSTEINE,
  // und die ist nach Aufwand sortiert: das Profil zuerst.
  assert.deepEqual(
    naechste(LEER, 3).map((m) => m.id),
    MEILENSTEINE.slice(0, 3).map((m) => m.id),
  );
});

test("naechste verkraftet Randwerte", () => {
  assert.equal(naechste(LEER, 0).length, 0);
  assert.equal(naechste(LEER, -1).length, 0);
  assert.equal(naechste(LEER, 99).length, MEILENSTEINE.length);
  const alles: Rohdaten = {
    [SCHLUESSEL.bio]: "Ein Satz, der deutlich laenger als zwanzig Zeichen ist.",
    [SCHLUESSEL.interessen]: '["a","b","c"]',
    [SCHLUESSEL.profilGeprueft]: "1",
    [SCHLUESSEL.geplanteDates]: '["date"]',
    [SCHLUESSEL.verabredungenGeplant]: "2",
    [SCHLUESSEL.duelleGewonnen]: "3",
    [SCHLUESSEL.verbindungen]: "5",
  };
  assert.equal(erreichte(alles).length, MEILENSTEINE.length, "alle erreichbar");
  assert.equal(naechste(alles, 3).length, 0, "nichts mehr offen");
  assert.equal(zusammenfassung(alles), `${MEILENSTEINE.length} von ${MEILENSTEINE.length}`);
});
