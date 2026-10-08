// Reine Prüfung ohne Browser, ohne Firebase — läuft über `tsx --test` in
// `test:pure`.
//
// Der Grund für diese Datei ist eine einzige Stolperstelle: Zwei
// Tageszählungen, die sich um einen Tag unterscheiden. `Date.getDay()` zählt
// ab Sonntag, der Plan ab Montag. Wer das verwechselt, verschiebt die Pause
// um einen Tag — und die Oberfläche sieht dabei völlig richtig aus.
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import {
  TAGE,
  STUNDEN,
  leererPlan,
  istGueltigerPlan,
  planIndexAusWochentag,
  istPauseLautPlan,
  istAlteKonfiguration,
  planAusAlterKonfiguration,
  pausierteStunden,
  hatPause,
} from "../src/lib/pausenplan.ts";

describe("Die Umrechnung der Wochentage", () => {
  it("Montag ist im Plan die Null, im Browser die Eins", () => {
    assert.equal(planIndexAusWochentag(1), 0);
  });

  it("Sonntag ist im Plan die Sechs, im Browser die Null", () => {
    assert.equal(planIndexAusWochentag(0), 6);
  });

  it("die ganze Woche stimmt", () => {
    // getDay():   So Mo Di Mi Do Fr Sa
    // Planindex:   6  0  1  2  3  4  5
    const erwartet = [6, 0, 1, 2, 3, 4, 5];
    for (let jsTag = 0; jsTag < 7; jsTag++) {
      assert.equal(planIndexAusWochentag(jsTag), erwartet[jsTag], `getDay()=${jsTag}`);
    }
  });

  it("Unsinn ergibt Montag, nicht einen Absturz", () => {
    assert.equal(planIndexAusWochentag(7), 0);
    assert.equal(planIndexAusWochentag(-1), 0);
    assert.equal(planIndexAusWochentag(1.5), 0);
    assert.equal(planIndexAusWochentag(NaN), 0);
  });
});

describe("Die Form eines Plans", () => {
  it("der leere Plan hat 7 mal 24 Felder, alle falsch", () => {
    const p = leererPlan();
    assert.equal(p.length, TAGE);
    assert.ok(p.every((t) => t.length === STUNDEN));
    assert.equal(pausierteStunden(p), 0);
    assert.equal(hatPause(p), false);
  });

  it("die Prüfung nimmt nur die richtige Form an", () => {
    assert.equal(istGueltigerPlan(leererPlan()), true);
    assert.equal(istGueltigerPlan([]), false);
    assert.equal(istGueltigerPlan(null), false);
    assert.equal(istGueltigerPlan("Plan"), false);
    // sechs Tage statt sieben
    assert.equal(istGueltigerPlan(Array.from({ length: 6 }, () => Array(24).fill(false))), false);
    // 23 Stunden statt 24
    assert.equal(istGueltigerPlan(Array.from({ length: 7 }, () => Array(23).fill(false))), false);
    // Zahlen statt Wahrheitswerten
    assert.equal(istGueltigerPlan(Array.from({ length: 7 }, () => Array(24).fill(0))), false);
  });
});

describe("Ist gerade Pause?", () => {
  it("findet die eingetragene Stunde am richtigen Tag", () => {
    const p = leererPlan();
    p[0]![20] = true; // Montag, 20 Uhr
    // getDay() = 1 ist Montag
    assert.equal(istPauseLautPlan(p, 1, 20), true);
    assert.equal(istPauseLautPlan(p, 1, 19), false);
    // Dienstag, 20 Uhr — derselbe Eintrag darf NICHT gelten
    assert.equal(istPauseLautPlan(p, 2, 20), false);
    // Sonntag, 20 Uhr — der Fall, der bei falscher Umrechnung anschlaegt
    assert.equal(istPauseLautPlan(p, 0, 20), false);
  });

  it("Sonntag wird richtig getroffen", () => {
    const p = leererPlan();
    p[6]![9] = true; // Sonntag, 9 Uhr
    assert.equal(istPauseLautPlan(p, 0, 9), true);
    assert.equal(istPauseLautPlan(p, 1, 9), false);
  });

  it("kaputte Eingaben ergeben KEINE Pause", () => {
    // Im Zweifel nicht pausieren: Eine Pause, die niemand eingestellt hat,
    // laesst Nachrichten unbeantwortet und sieht fuer das Gegenueber aus wie
    // Desinteresse.
    assert.equal(istPauseLautPlan(null, 1, 20), false);
    assert.equal(istPauseLautPlan(leererPlan(), 1, 24), false);
    assert.equal(istPauseLautPlan(leererPlan(), 1, -1), false);
  });
});

describe("Übernahme der alten lokalen Konfiguration", () => {
  it("Mo–Fr, 18 bis 22 Uhr ergibt 20 Stunden", () => {
    // Genau der Vorgabewert des alten Widgets: days [1,2,3,4,5] in der
    // getDay()-Zaehlung, also Mo bis Fr.
    const plan = planAusAlterKonfiguration({ days: [1, 2, 3, 4, 5], startHour: 18, endHour: 22 });
    assert.equal(pausierteStunden(plan), 5 * 4);
    // Montag 18 bis 21 Uhr, NICHT 22
    assert.equal(plan[0]![17], false);
    assert.equal(plan[0]![18], true);
    assert.equal(plan[0]![21], true);
    assert.equal(plan[0]![22], false);
    // Samstag und Sonntag bleiben frei
    assert.equal(plan[5]!.some(Boolean), false);
    assert.equal(plan[6]!.some(Boolean), false);
  });

  it("Sonntag aus der alten Zaehlung landet auf Planindex 6", () => {
    const plan = planAusAlterKonfiguration({ days: [0], startHour: 10, endHour: 12 });
    assert.equal(plan[6]![10], true);
    assert.equal(plan[6]![11], true);
    assert.equal(plan[0]!.some(Boolean), false, "Montag muss leer bleiben");
  });

  it("endHour <= startHour ergibt einen leeren Plan", () => {
    // Ein ueber Mitternacht laufender Bereich war in der alten Form nicht
    // darstellbar. Ihn hier zu erfinden hiesse, etwas zu uebernehmen, was nie
    // eingestellt wurde.
    assert.equal(pausierteStunden(planAusAlterKonfiguration({ days: [1], startHour: 22, endHour: 6 })), 0);
    assert.equal(pausierteStunden(planAusAlterKonfiguration({ days: [1], startHour: 8, endHour: 8 })), 0);
  });

  it("Unsinn ergibt einen leeren Plan, keinen Absturz", () => {
    assert.equal(pausierteStunden(planAusAlterKonfiguration(null)), 0);
    assert.equal(pausierteStunden(planAusAlterKonfiguration({})), 0);
    assert.equal(pausierteStunden(planAusAlterKonfiguration({ days: [9], startHour: 1, endHour: 2 })), 0);
    assert.equal(pausierteStunden(planAusAlterKonfiguration({ days: [1], startHour: 30, endHour: 40 })), 0);
    assert.equal(pausierteStunden(planAusAlterKonfiguration("Mo-Fr")), 0);
  });

  it("die Formprüfung der alten Konfiguration ist streng", () => {
    assert.equal(istAlteKonfiguration({ days: [1], startHour: 1, endHour: 2 }), true);
    assert.equal(istAlteKonfiguration({ days: [1], startHour: "1", endHour: 2 }), false);
    assert.equal(istAlteKonfiguration({ days: "1,2", startHour: 1, endHour: 2 }), false);
    assert.equal(istAlteKonfiguration({ startHour: 1, endHour: 2 }), false);
    assert.equal(istAlteKonfiguration(null), false);
  });
});
