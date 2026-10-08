// Reine Prüfung ohne Browser — läuft über `tsx --test` in `test:pure`.
//
// Geprüft wird `src/lib/tagesstimmung.ts`. Anlass ist der Befund vom
// 14.08.2026: `DailyMoodWidget` legte sechs Tage Verlauf an, wenn noch keiner
// da war — und schrieb sie beim nächsten echten Eintrag in den Speicher.
//
// Die erste Prüfung ist deshalb die wichtigste: aus nichts entsteht nichts.
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  STUFEN,
  alsZahl,
  eintraegeAus,
  eintraegeAusText,
  eintragZu,
  letzte,
  mitEintrag,
  sortiert,
  stufeZu,
  tagesschluessel,
  zusammenfassung,
} from "../src/lib/tagesstimmung.ts";

test("aus einem leeren Speicher entsteht ein leerer Verlauf", () => {
  assert.deepEqual(eintraegeAusText(null), []);
  assert.deepEqual(eintraegeAusText(""), []);
  assert.deepEqual(eintraegeAusText("[]"), []);
  assert.deepEqual(letzte([], 7), []);
  // Und kein Satz, der einen Verlauf behauptet.
  assert.match(zusammenfassung([]), /Noch nichts eingetragen/);
});

test("der erste eigene Eintrag steht allein — nichts wird dazuerfunden", () => {
  const heute = tagesschluessel(new Date(2026, 7, 14));
  const verlauf = mitEintrag([], { date: heute, mood: 4, emoji: "😊" });
  assert.equal(verlauf.length, 1, "genau ein Eintrag");
  assert.equal(verlauf[0]?.date, "14.8.2026");
  assert.match(zusammenfassung(verlauf), /Ein Eintrag bisher/);
});

test("unlesbarer Speicherinhalt ergibt nichts statt Unsinn", () => {
  assert.deepEqual(eintraegeAusText("kein json"), []);
  assert.deepEqual(eintraegeAusText('{"a":1}'), []);
  assert.deepEqual(eintraegeAus("text"), []);
  assert.deepEqual(eintraegeAus(null), []);
});

test("einzelne unbrauchbare Eintraege fallen weg, brauchbare bleiben", () => {
  const gelesen = eintraegeAus([
    { date: "13.8.2026", mood: 4, emoji: "😊" },
    { date: "kaputt", mood: 4, emoji: "😊" },
    { date: "12.8.2026", mood: 9, emoji: "😊" },
    { date: "11.8.2026" },
    null,
    "text",
    { date: "10.8.2026", mood: 2, emoji: "😔" },
  ]);
  assert.equal(gelesen.length, 2, `unerwartet: ${JSON.stringify(gelesen)}`);
  assert.deepEqual(gelesen.map((e) => e.date), ["13.8.2026", "10.8.2026"]);
});

test("ein fehlendes Emoji wird aus der Stufe ergaenzt, nicht geraten", () => {
  const [e] = eintraegeAus([{ date: "13.8.2026", mood: 5 }]);
  assert.ok(e);
  assert.equal(e.emoji, "🤩");
  assert.equal(e.emoji, STUFEN[0].emoji);
});

test("Datumsvergleich, mit und ohne fuehrende Nullen", () => {
  assert.equal(alsZahl("3.8.2026"), 20260803);
  assert.equal(alsZahl("03.08.2026"), 20260803, "fuehrende Nullen aendern nichts");
  assert.equal(Number(alsZahl("31.12.2025")) < Number(alsZahl("1.1.2026")), true);
  assert.equal(alsZahl("kaputt"), null);
  assert.equal(alsZahl("1.13.2026"), null, "Monat 13 gibt es nicht");
  assert.equal(alsZahl("1.1"), null);
});

test("sortiert wird nach Datum, nicht nach Zeichenkette", () => {
  // Als Text sortiert stuende „10." vor „9." — deshalb diese Prüfung.
  const roh = [
    { date: "9.8.2026", mood: 3, emoji: "😐" },
    { date: "10.8.2026", mood: 4, emoji: "😊" },
    { date: "31.7.2026", mood: 5, emoji: "🤩" },
  ];
  assert.deepEqual(sortiert(roh).map((e) => e.date), ["31.7.2026", "9.8.2026", "10.8.2026"]);
});

test("derselbe Tag zweimal ersetzt, statt zu verdoppeln", () => {
  const erst = mitEintrag([], { date: "14.8.2026", mood: 2, emoji: "😔" });
  const dann = mitEintrag(erst, { date: "14.8.2026", mood: 5, emoji: "🤩" });
  assert.equal(dann.length, 1);
  assert.equal(dann[0]?.mood, 5);
});

test("mitEintrag laesst die uebergebene Liste unveraendert", () => {
  const vorher = [{ date: "13.8.2026", mood: 3, emoji: "😐" }];
  const kopie = JSON.parse(JSON.stringify(vorher)) as typeof vorher;
  mitEintrag(vorher, { date: "14.8.2026", mood: 4, emoji: "😊" });
  assert.deepEqual(vorher, kopie);
});

test("letzte gibt nie mehr zurueck, als es gibt", () => {
  const drei = [
    { date: "12.8.2026", mood: 3, emoji: "😐" },
    { date: "13.8.2026", mood: 4, emoji: "😊" },
    { date: "14.8.2026", mood: 5, emoji: "🤩" },
  ];
  assert.equal(letzte(drei, 7).length, 3, "keine Auffuellung auf sieben");
  assert.deepEqual(letzte(drei, 2).map((e) => e.date), ["13.8.2026", "14.8.2026"]);
  assert.deepEqual(letzte(drei, 0), []);
  assert.deepEqual(letzte(drei, -1), []);
});

test("tagesschluessel und eintragZu finden den heutigen Eintrag", () => {
  const tag = tagesschluessel(new Date(2026, 0, 5));
  assert.equal(tag, "5.1.2026", "keine fuehrenden Nullen, wie de-DE sie liefert");
  const verlauf = mitEintrag([], { date: tag, mood: 3, emoji: "😐" });
  assert.equal(eintragZu(verlauf, tag)?.mood, 3);
  assert.equal(eintragZu(verlauf, "6.1.2026"), null);
});

test("stufeZu kennt genau fuenf Stufen", () => {
  assert.equal(STUFEN.length, 5);
  for (const s of STUFEN) assert.equal(stufeZu(s.wert)?.name, s.name);
  assert.equal(stufeZu(0), null);
  assert.equal(stufeZu(6), null);
});
