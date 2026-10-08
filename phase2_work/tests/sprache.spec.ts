// Reine Prüfung ohne Browser — läuft über `tsx --test` in `test:pure`.
//
// Geprüft wird die Ermittlung der Zielsprache aus `src/lib/sprache.ts`.
// Die Fälle stammen aus dem, was `navigator.language` tatsächlich liefert,
// nicht aus einer ausgedachten Liste.
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  SPRACHEN,
  VORGABE_CODE,
  nameZuCode,
  istBekannt,
  codeAusBrowsersprache,
  ermittleCode,
} from "../src/lib/sprache.ts";

test("die Liste ist widerspruchsfrei", () => {
  const codes = SPRACHEN.map((s) => s.code);
  assert.equal(new Set(codes).size, codes.length, "kein Code doppelt");
  const namen = SPRACHEN.map((s) => s.name);
  assert.equal(new Set(namen).size, namen.length, "kein Name doppelt");
  assert.ok(codes.includes(VORGABE_CODE), "die Vorgabe steht in der Liste");
});

test("nameZuCode liefert den Namen, bei Unbekanntem die Vorgabe", () => {
  assert.equal(nameZuCode("en"), "Englisch");
  assert.equal(nameZuCode("de"), "Deutsch");
  assert.equal(nameZuCode("kl"), "Deutsch"); // Klingonisch bieten wir nicht an
  assert.equal(nameZuCode(""), "Deutsch");
});

test("istBekannt prueft streng", () => {
  assert.equal(istBekannt("pl"), true);
  assert.equal(istBekannt("PL"), false); // Grossschreibung ist ein anderer Wert
  assert.equal(istBekannt(42), false);
  assert.equal(istBekannt(null), false);
  assert.equal(istBekannt(undefined), false);
});

test("regionale Varianten fallen auf die Sprache zurueck", () => {
  // Das sind reale Werte von navigator.language.
  assert.equal(codeAusBrowsersprache("de-DE"), "de");
  assert.equal(codeAusBrowsersprache("de-AT"), "de");
  assert.equal(codeAusBrowsersprache("de-CH"), "de");
  assert.equal(codeAusBrowsersprache("pt-BR"), "pt");
  assert.equal(codeAusBrowsersprache("en-GB"), "en");
});

test("unbekannte Browsersprache ergibt die Vorgabe, nicht etwas Aehnliches", () => {
  // Bewusst KEIN Raten: Eine falsch geratene Zielsprache bliebe unbemerkt.
  assert.equal(codeAusBrowsersprache("zh-Hans-CN"), VORGABE_CODE);
  assert.equal(codeAusBrowsersprache("ja"), VORGABE_CODE);
  assert.equal(codeAusBrowsersprache(""), VORGABE_CODE);
  assert.equal(codeAusBrowsersprache(null), VORGABE_CODE);
  assert.equal(codeAusBrowsersprache(undefined), VORGABE_CODE);
  assert.equal(codeAusBrowsersprache(123), VORGABE_CODE);
});

test("die gespeicherte Wahl schlaegt die Browsersprache", () => {
  assert.equal(ermittleCode("pl", "de-DE"), "pl");
  assert.equal(ermittleCode("en", "de-DE"), "en");
});

test("ohne gueltige Speicherung zaehlt der Browser", () => {
  assert.equal(ermittleCode(null, "fr-FR"), "fr");
  assert.equal(ermittleCode("", "it-IT"), "it");
  assert.equal(ermittleCode("kl", "es-ES"), "es"); // ungueltig gespeichert
  assert.equal(ermittleCode(undefined, "nl"), "nl");
});

test("ist beides unbrauchbar, gilt die Vorgabe", () => {
  assert.equal(ermittleCode(null, null), VORGABE_CODE);
  assert.equal(ermittleCode("kl", "ja-JP"), VORGABE_CODE);
});
