// Reine Prüfung ohne Browser, ohne Netz, ohne Firebase — läuft über
// `tsx --test` im Skript `test:pure`.
//
// Geprüft wird die Entscheidung aus `src/lib/wiederholung.ts`: Welche
// gescheiterte Antwort darf der Client noch einmal senden? Die Fälle sind
// aus dem Betriebsprotokoll vom 13.08.2026 abgeleitet, nicht ausgedacht.
import { test } from "vitest";
import assert from "node:assert/strict";
import { sollWiederholen, hatFehlercode } from "../src/lib/wiederholung.ts";

test("429 wird nie wiederholt — die eigene Stundengrenze", () => {
  assert.equal(
    sollWiederholen(429, { error: "Zu viele KI-Anfragen in kurzer Zeit." }),
    false,
  );
});

test("503 mit Fehlercode wird nicht wiederholt — der Server hat schon", () => {
  // So sieht die Antwort aus `kiPolitik.ts` aus, wenn Gemini das Kontingent
  // meldet. Genau diese Antwort wurde am 13.08. dreimal angefragt.
  assert.equal(
    sollWiederholen(503, {
      code: "ki_kontingent",
      error: "Gerade sind sehr viele Anfragen unterwegs. Bitte in ein paar Minuten erneut.",
      herkunft: "kein_ersatz",
    }),
    false,
  );
});

test("502 mit Fehlercode wird nicht wiederholt", () => {
  assert.equal(sollWiederholen(502, { code: "ki_leer" }), false);
});

test("503 OHNE Fehlercode wird wiederholt — ein echter Serverausfall", () => {
  // Ein neu startender Prozess, ein vorgelagerter Dienst: Hier hilft ein
  // zweiter Versuch tatsächlich.
  assert.equal(sollWiederholen(503, { error: "Bad Gateway" }), true);
});

test("500 ohne lesbaren Koerper wird wiederholt", () => {
  assert.equal(sollWiederholen(500, null), true);
});

test("400 und 401 werden nie wiederholt", () => {
  assert.equal(sollWiederholen(400, null), false);
  assert.equal(sollWiederholen(401, { error: "Unauthorized" }), false);
});

test("hatFehlercode erkennt nur eine nicht leere Zeichenkette", () => {
  assert.equal(hatFehlercode({ code: "ki_fehler" }), true);
  assert.equal(hatFehlercode({ code: "" }), false);
  assert.equal(hatFehlercode({ code: 500 }), false);
  assert.equal(hatFehlercode({}), false);
  assert.equal(hatFehlercode(null), false);
  assert.equal(hatFehlercode("code"), false);
});
