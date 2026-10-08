// Reine Prüfung ohne Browser — läuft über `tsx --test` in `test:pure`.
//
// Geprüft wird `src/lib/textform.ts`. Anlass ist der Befund vom 14.08.2026:
// Im KI-Coach stand die Antwort des Modells wörtlich mit Sternchen auf dem
// Bildschirm — `* **Option 1 (Werte):** „Hallo! …`.
//
// Die erste Prüfung benutzt deshalb genau diesen beobachteten Text.
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  alsZeilen,
  alsReinerText,
  stueckeAus,
  hatAuszeichnung,
} from "../src/lib/textform.ts";

/** Wörtlich der Text vom Bildschirm, gekürzt. */
const BEOBACHTET = `Hallo! Schön, dass du den Mut hast, direkt den ersten Schritt zu machen.

* **Option 1 (Werte):** „Hallo! Dein Profil hat mich direkt angesprochen."
* **Option 2 (Zukunft/Träume):** „Hi! Ich fand deinen Gedanken spannend."

Wähle die Option, die am besten passt.`;

test("der beobachtete Text vom 14.08.2026 wird zerlegt", () => {
  const zeilen = alsZeilen(BEOBACHTET);
  const punkte = zeilen.filter((z) => z.art === "punkt");
  assert.equal(punkte.length, 2, "zwei Aufzaehlungspunkte");

  // Kein Sternchen bleibt im sichtbaren Text zurueck.
  const sichtbar = zeilen.flatMap((z) => z.stuecke).map((s) => s.text).join(" ");
  assert.equal(/\*/.test(sichtbar), false, `Sternchen uebrig: ${sichtbar}`);

  // „Option 1 (Werte):" ist fett, der Rest nicht.
  const erster = punkte[0];
  assert.ok(erster);
  assert.equal(erster.stuecke[0]?.fett, true);
  assert.equal(erster.stuecke[0]?.text, "Option 1 (Werte):");
  assert.equal(erster.stuecke[1]?.fett, false);
});

test("fett wird an paarigen Doppelsternchen erkannt", () => {
  assert.deepEqual(stueckeAus("ganz **wichtig** hier"), [
    { text: "ganz ", fett: false },
    { text: "wichtig", fett: true },
    { text: " hier", fett: false },
  ]);
  assert.deepEqual(stueckeAus("**nur fett**"), [{ text: "nur fett", fett: true }]);
  assert.deepEqual(stueckeAus("ohne alles"), [{ text: "ohne alles", fett: false }]);
});

test("ein unpaariges Sternchenpaar verschluckt nichts", () => {
  // Lieber ein sichtbares Sternchen als ein verschwundener Halbsatz.
  assert.deepEqual(stueckeAus("das **bleibt so stehen"), [
    { text: "das **bleibt so stehen", fett: false },
  ]);
  assert.equal(alsReinerText("a **b"), "a **b");
});

test("Aufzaehlungen in allen ueblichen Schreibweisen", () => {
  for (const zeichen of ["*", "-", "+"]) {
    const z = alsZeilen(`${zeichen} erster\n${zeichen} zweiter`);
    assert.equal(z.length, 2, zeichen);
    assert.equal(z[0]?.art, "punkt", zeichen);
    assert.equal(z[0]?.stuecke[0]?.text, "erster", zeichen);
  }
  // Nummerierte Punkte behalten ihre Nummer — sie traegt Bedeutung.
  const nummeriert = alsZeilen("1. erster\n2. zweiter");
  assert.equal(nummeriert[0]?.art, "punkt");
  assert.equal(nummeriert[0]?.stuecke[0]?.text, "1. erster");
});

test("Ueberschriften werden zu fetten Absaetzen", () => {
  const z = alsZeilen("## Drei Vorschlaege");
  assert.equal(z.length, 1);
  assert.equal(z[0]?.art, "absatz");
  assert.deepEqual(z[0]?.stuecke, [{ text: "Drei Vorschlaege", fett: true }]);
});

test("ein Sternchen ohne Leerzeichen ist kein Aufzaehlungspunkt", () => {
  // „5*3" oder „*seufz*" sollen nicht zur Liste werden.
  assert.equal(alsZeilen("5*3 ist 15")[0]?.art, "absatz");
  assert.equal(alsZeilen("*seufz*")[0]?.art, "absatz");
});

test("Leerzeilen bleiben als Abstand, aber nicht am Ende", () => {
  const z = alsZeilen("oben\n\nunten");
  assert.equal(z.length, 3);
  assert.equal(z[1]?.stuecke.length, 0, "der Abstand in der Mitte bleibt");

  const mitLuft = alsZeilen("text\n\n\n");
  assert.equal(mitLuft.length, 1, "hinten keine Luft");
});

test("leere und ungueltige Eingaben ergeben nichts", () => {
  assert.deepEqual(alsZeilen(""), []);
  assert.deepEqual(alsZeilen("   \n  "), []);
  assert.deepEqual(alsZeilen(null), []);
  assert.deepEqual(alsZeilen(42), []);
  assert.equal(alsReinerText(null), "");
});

test("alsReinerText gibt lesbaren Text ohne Auszeichnung", () => {
  assert.equal(
    alsReinerText("Hallo\n* **eins**\n* zwei"),
    "Hallo\n• eins\n• zwei",
  );
});

test("hatAuszeichnung erkennt, ob sich die Zerlegung lohnt", () => {
  assert.equal(hatAuszeichnung("* Punkt"), true);
  assert.equal(hatAuszeichnung("**fett**"), true);
  assert.equal(hatAuszeichnung("# Titel"), true);
  assert.equal(hatAuszeichnung("Ein ganz gewoehnlicher Satz."), false);
  assert.equal(hatAuszeichnung(""), false);
  assert.equal(hatAuszeichnung(null), false);
});
