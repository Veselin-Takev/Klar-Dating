// Reine Prüfung ohne Browser — läuft über `tsx --test` in `test:pure`.
//
// Kern der Prüfung ist der Befund vom 14.08.2026: `DatingVibeChartWidget`
// füllte jeden Tag ohne Eintrag mit dem letzten bekannten Wert auf, ersatz-
// weise mit „neutral". Wer nie etwas eingetragen hatte, sah eine
// durchgehende Linie auf Neutral über zwei Wochen.
//
// Die erste Prüfung heisst deshalb, was sie ist: leer bleibt leer.
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  ZEITRAEUME,
  VORGABE_ZEITRAUM,
  STUFEN,
  STUFEN_NAMEN,
  istStimmung,
  istZeitraum,
  zeitraumAus,
  eintraegeAus,
  eintraegeAusText,
  tagesschluessel,
  reihe,
  belegteTage,
  durchschnitt,
  zusammenfassung,
  type Eintrag,
} from "../src/lib/stimmung.ts";

/** Fester Bezugstag, damit die Prüfungen an jedem Tag dasselbe ergeben. */
const HEUTE = new Date(2026, 7, 14); // 14.08.2026, Ortszeit

test("leer bleibt leer — kein Tag bekommt einen erfundenen Wert", () => {
  for (const z of ZEITRAEUME) {
    const p = reihe([], z, HEUTE);
    assert.equal(p.length, z, `${z} Tage`);
    assert.equal(
      p.every((x) => x.wert === null),
      true,
      `${z}: jeder Tag ohne Eintrag ist null`,
    );
    assert.equal(belegteTage(p), 0);
    assert.equal(durchschnitt(p), null, "kein Durchschnitt ohne Werte — auch nicht 0");
  }
});

test("eine Luecke bleibt eine Luecke", () => {
  // Der eigentliche Befund: Zwischen zwei Eintraegen darf NICHT
  // weitergeschrieben werden.
  const eintraege: Eintrag[] = [
    { date: "2026-08-10", mood: "excited" },
    { date: "2026-08-14", mood: "nervous" },
  ];
  const p = reihe(eintraege, 7, HEUTE);
  assert.deepEqual(
    p.map((x) => x.wert),
    [null, null, 5, null, null, null, 2],
  );
  assert.equal(belegteTage(p), 2);
});

test("die Reihe endet heute und beginnt zeitraum-1 Tage davor", () => {
  const p = reihe([], 7, HEUTE);
  assert.equal(p[0]?.tag, "2026-08-08");
  assert.equal(p[6]?.tag, "2026-08-14");
  assert.equal(p[6]?.beschriftung, "14.08.");
});

test("tagesschluessel rechnet ueber Monatsgrenzen", () => {
  assert.equal(tagesschluessel(new Date(2026, 7, 2), 5), "2026-07-28");
  assert.equal(tagesschluessel(new Date(2026, 0, 1), 1), "2025-12-31");
  // Schaltjahr: 2028 ist eines.
  assert.equal(tagesschluessel(new Date(2028, 2, 1), 1), "2028-02-29");
});

test("mehrere Eintraege am selben Tag: der letzte gilt", () => {
  const p = reihe(
    [
      { date: "2026-08-14", mood: "frustrated" },
      { date: "2026-08-14", mood: "relaxed" },
    ],
    7,
    HEUTE,
  );
  assert.equal(p[6]?.wert, 4);
});

test("eintraegeAus verwirft alles, was nicht passt", () => {
  const gemischt = [
    { date: "2026-08-14", mood: "excited" },
    { date: "14.08.2026", mood: "excited" }, // falsches Datumsformat
    { date: "2026-08-13", mood: "grossartig" }, // unbekannte Stufe
    { date: "2026-08-12" }, // ohne Stimmung
    { mood: "relaxed" }, // ohne Datum
    null,
    "kein Objekt",
    42,
  ];
  const aus = eintraegeAus(gemischt);
  assert.equal(aus.length, 1);
  assert.deepEqual(aus[0], { date: "2026-08-14", mood: "excited" });

  assert.deepEqual(eintraegeAus("kein Feld"), []);
  assert.deepEqual(eintraegeAus(null), []);
  assert.deepEqual(eintraegeAus(undefined), []);
});

test("eintraegeAusText verkraftet kaputten Speicher", () => {
  assert.deepEqual(eintraegeAusText(null), []);
  assert.deepEqual(eintraegeAusText(""), []);
  assert.deepEqual(eintraegeAusText("{kaputt"), []);
  assert.deepEqual(eintraegeAusText('{"kein":"array"}'), []);
  assert.equal(eintraegeAusText('[{"date":"2026-08-14","mood":"neutral"}]').length, 1);
});

test("Zeitraum: nur die vier erlaubten, sonst die Vorgabe", () => {
  assert.equal(istZeitraum(14), true);
  assert.equal(istZeitraum(30), false);
  assert.equal(istZeitraum("14"), false);
  assert.equal(zeitraumAus(28), 28);
  assert.equal(zeitraumAus("60"), 60);
  assert.equal(zeitraumAus("dreissig"), VORGABE_ZEITRAUM);
  assert.equal(zeitraumAus(null), VORGABE_ZEITRAUM);
  assert.equal(zeitraumAus(999), VORGABE_ZEITRAUM);
  assert.ok((ZEITRAEUME as readonly number[]).includes(VORGABE_ZEITRAUM));
});

test("die Stufen sind widerspruchsfrei", () => {
  for (const [name, zahl] of Object.entries(STUFEN)) {
    assert.equal(istStimmung(name), true, name);
    assert.ok(zahl >= 1 && zahl <= 5, `${name} liegt zwischen 1 und 5`);
    assert.ok(STUFEN_NAMEN[zahl], `zu ${zahl} gibt es einen Namen`);
  }
  assert.equal(istStimmung("gluecklich"), false);
  assert.equal(istStimmung(3), false);
  assert.equal(istStimmung(null), false);
});

test("die Zusammenfassung nennt immer, auf wie vielen Tagen sie beruht", () => {
  // Zwei Eintraege ueber 60 Tage sind etwas anderes als 55 — und das gehoert
  // dorthin, wo die Zahl steht.
  const wenige = reihe(
    [
      { date: "2026-08-14", mood: "excited" },
      { date: "2026-08-13", mood: "excited" },
    ],
    60,
    HEUTE,
  );
  const satz = zusammenfassung(wenige, 60);
  assert.match(satz, /2 Tagen von 60/);
  assert.match(satz, /Begeistert/);

  assert.equal(
    zusammenfassung(reihe([], 7, HEUTE), 7),
    "In den letzten 7 Tagen hast du nichts eingetragen.",
  );

  const einer = reihe([{ date: "2026-08-14", mood: "neutral" }], 7, HEUTE);
  assert.match(zusammenfassung(einer, 7), /aus 1 Tag von 7/);
});

test("der Durchschnitt zaehlt nur belegte Tage", () => {
  const p = reihe(
    [
      { date: "2026-08-14", mood: "excited" }, // 5
      { date: "2026-08-13", mood: "nervous" }, // 2
    ],
    28,
    HEUTE,
  );
  assert.equal(durchschnitt(p), 3.5, "nicht durch 28 geteilt");
  assert.equal(belegteTage(p), 2);
});
