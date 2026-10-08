// Reine Prüfung ohne Server — läuft über `tsx --test` in `test:pure`.
//
// Geprüft wird `src/server/kontingente.ts`. Anlass ist der Befund vom
// 14.08.2026: `/api/translate` lag im selben Stundentopf wie der KI-Coach,
// obwohl `ChatView` je angezeigter Nachricht einen Aufruf auslöst.
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  UEBERSETZUNGS_ENDPUNKT,
  UEBERSETZUNG_GRENZE,
  UEBERSETZUNG_GRENZE_GAST,
  grenzeFuer,
  topfFuer,
} from "../src/server/kontingente.ts";

/** Die Zahlen aus server.ts bzw. gastrechte.ts, wie sie hineingereicht werden. */
const KI = 60;
const KI_GAST = 15;

test("der Uebersetzungstopf geht dem KI-Topf vor", () => {
  // `/api/translate` steht auch in KI_ENDPUNKTE — zu Recht, wegen der
  // Einwilligung. Beim Kontingent muss es trotzdem im eigenen Topf landen.
  // Dreht jemand die Abfrage um, faellt genau diese Pruefung.
  assert.equal(topfFuer(UEBERSETZUNGS_ENDPUNKT, true), "uebersetzung");
  assert.equal(topfFuer(UEBERSETZUNGS_ENDPUNKT, false), "uebersetzung");
});

test("andere KI-Endpunkte bleiben im KI-Topf", () => {
  assert.equal(topfFuer("/api/chat", true), "ki");
  assert.equal(topfFuer("/api/icebreaker", true), "ki");
});

test("was kein KI-Endpunkt ist, zahlt aus keinem Topf", () => {
  assert.equal(topfFuer("/api/account/export", false), "keiner");
  assert.equal(grenzeFuer("keiner", false, KI, KI_GAST), null);
});

test("ungueltige Pfade fallen nicht versehentlich in den Uebersetzungstopf", () => {
  assert.equal(topfFuer(null, false), "keiner");
  assert.equal(topfFuer(42, false), "keiner");
  assert.equal(topfFuer("/api/translate/x", true), "ki", "kein Praefix-Treffer");
});

test("die vier Grenzen, jede genau einmal", () => {
  assert.equal(grenzeFuer("uebersetzung", false, KI, KI_GAST), UEBERSETZUNG_GRENZE);
  assert.equal(grenzeFuer("uebersetzung", true, KI, KI_GAST), UEBERSETZUNG_GRENZE_GAST);
  assert.equal(grenzeFuer("ki", false, KI, KI_GAST), KI);
  assert.equal(grenzeFuer("ki", true, KI, KI_GAST), KI_GAST);
});

test("die KI-Zahlen kommen von aussen, nicht aus dieser Datei", () => {
  // Zwei Stellen fuer dieselbe Zahl laufen auseinander. Deshalb gibt die
  // Funktion zurueck, was hineingereicht wurde — auch etwas anderes.
  assert.equal(grenzeFuer("ki", false, 99, 7), 99);
  assert.equal(grenzeFuer("ki", true, 99, 7), 7);
});

test("der Uebersetzungstopf ist groesser als der KI-Topf, aber nicht offen", () => {
  // Ein Aufruf je Nachricht heisst: Die Zahl muss ein ganzes Gespraech
  // tragen. Sie darf trotzdem nicht so hoch sein, dass sie nichts mehr
  // bremst — jeder Aufruf geht an Gemini und kostet.
  assert.equal(UEBERSETZUNG_GRENZE > KI, true);
  assert.equal(UEBERSETZUNG_GRENZE_GAST > KI_GAST, true);
  assert.equal(UEBERSETZUNG_GRENZE <= 1000, true, "keine Grenze, die keine ist");
  assert.equal(UEBERSETZUNG_GRENZE_GAST < UEBERSETZUNG_GRENZE, true);
});
