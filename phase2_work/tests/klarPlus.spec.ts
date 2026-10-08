// Reine Prüfung ohne Browser — läuft über `tsx --test` in `test:pure`.
//
// Geprüft wird die Leistungsliste aus `src/lib/klarPlus.ts` gegen die zwei
// Entscheidungen vom 14.08.2026 (klar/27, Abschnitt 9c):
//
//   · Acht Kontakte am Tag gelten für alle — auch für Klar+.
//   · Klar liefert keine Werbung aus; Werbefreiheit ist nichts zu verkaufen.
//
// Beides sind Zusagen an Nutzer, keine technischen Einzelheiten. Sie hier zu
// prüfen ist der einzige Weg, sie gegen einen späteren, gut gemeinten Umbau
// zu halten — im JSX wären sie nur Text.
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  LEISTUNGEN,
  GESTRICHEN,
  ACHSEN,
  BUCHBAR,
  HINWEIS_NICHT_BUCHBAR,
  unterscheidetSich,
  unterschiede,
  JA,
  NEIN,
  text,
  type Leistung,
} from "../src/lib/klarPlus.ts";

/** Alles, was auf der Seite als Wort erscheint — Namen, Erläuterungen, Werte. */
function woerter(leistungen: readonly Leistung[]): string {
  return leistungen
    .flatMap((l) => [
      l.name,
      l.erklaerung ?? "",
      l.frei.art === "text" ? l.frei.text : l.frei.art,
      l.plus.art === "text" ? l.plus.text : l.plus.art,
    ])
    .join(" | ");
}

test("die Liste ist widerspruchsfrei", () => {
  const ids = LEISTUNGEN.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length, "keine id doppelt");
  const namen = LEISTUNGEN.map((l) => l.name);
  assert.equal(new Set(namen).size, namen.length, "kein Name doppelt");
  for (const l of LEISTUNGEN) {
    assert.ok(l.name.trim().length > 0, `${l.id} hat einen Namen`);
    assert.ok(
      l.achse === null || l.achse in ACHSEN,
      `${l.id} verweist auf eine bekannte Achse`,
    );
  }
});

test("sechs Zeilen — nicht acht", () => {
  // Die Zahl steht in klar/27, Abschnitt 9c: acht minus die zwei
  // gestrichenen. Wer eine siebte aufnimmt, soll hier begründen, warum.
  assert.equal(LEISTUNGEN.length, 6);
});

test("keine Zeile verkauft mehr als acht Kontakte am Tag", () => {
  // Der Kern der Entscheidung. Eine Zeile, die für Klar+ „unbegrenzt"
  // verspricht UND von Profilen, Kontakten oder Vorschlaegen handelt, hebt
  // das Kontingent auf — genau das, was nicht passieren darf.
  const mengenwort = /unbegrenzt|unlimited|beliebig viele|mehr profile/i;
  const gegenstand = /profil|kontakt|vorschlag|vorschlaeg|vorschläg|match/i;
  for (const l of LEISTUNGEN) {
    const zusage = l.plus.art === "text" ? l.plus.text : "";
    const betreff = `${l.name} ${l.erklaerung ?? ""}`;
    const hebtAuf = mengenwort.test(`${zusage} ${betreff}`) && gegenstand.test(betreff);
    assert.equal(
      hebtAuf,
      false,
      `„${l.name}" verspricht mehr Kontakte, als das Kontingent zulaesst`,
    );
  }
});

test("keine Zeile handelt von Werbung", () => {
  // Zweite Entscheidung: Klar liefert keine Werbung aus. Weder darf
  // „Werbefreiheit" verkauft werden, noch darf beim freien Zugang „mit
  // Werbung" stehen — beides behauptet Werbung, die es nicht gibt.
  const werbung = /werbe|werbung|anzeige|\bads?\b|ad-lite|adlite/i;
  const gefunden = woerter(LEISTUNGEN).match(werbung);
  assert.equal(gefunden, null, `Werbung erwaehnt: ${gefunden?.[0] ?? ""}`);
});

test("die gestrichenen Zeilen sind nicht zurueckgekommen", () => {
  // Verglichen wird der Teil VOR dem Doppelpunkt: in `GESTRICHEN` steht
  // „Kuratierte Profile / Tag: 8 → Unbegrenzt", in einer Tabellenzeile
  // stuende nur „Kuratierte Profile / Tag". Ein Vergleich auf Gleichheit
  // haette den Fall durchgelassen — in der Gegenprobe vom 14.08.2026 tat er
  // das auch. Nicht erfasst bleibt, wer die Zeile umbenennt; dagegen halten
  // die beiden Pruefungen darueber.
  const kern = (s: string) => s.split(":")[0]!.trim().toLowerCase();
  assert.equal(GESTRICHEN.length, 2);
  for (const g of GESTRICHEN) {
    assert.ok(g.grund.trim().length > 20, `„${g.name}" hat einen Grund, keine Floskel`);
    const wieder = LEISTUNGEN.some((l) => kern(l.name) === kern(g.name));
    assert.equal(wieder, false, `„${g.name}" steht wieder in der Tabelle`);
  }
});

test("die Tabelle zeigt ueberwiegend Unterschiede", () => {
  // Eine Vergleichstabelle, in der beide Spalten dasselbe sagen, vergleicht
  // nichts. Zwei Zeilen mit „in beiden enthalten" sind vertretbar — sie
  // zeigen, was man NICHT verliert. Mehr waere Fuellung.
  assert.ok(unterschiede() >= 4, `nur ${unterschiede()} von ${LEISTUNGEN.length} Zeilen unterscheiden sich`);
});

test("unterscheidetSich vergleicht Art und Text", () => {
  assert.equal(unterscheidetSich({ id: "a", name: "a", frei: NEIN, plus: JA, achse: null }), true);
  assert.equal(unterscheidetSich({ id: "a", name: "a", frei: JA, plus: JA, achse: null }), false);
  assert.equal(unterscheidetSich({ id: "a", name: "a", frei: NEIN, plus: NEIN, achse: null }), false);
  assert.equal(
    unterscheidetSich({ id: "a", name: "a", frei: text("1×"), plus: text("Sofort"), achse: null }),
    true,
  );
  assert.equal(
    unterscheidetSich({ id: "a", name: "a", frei: text("gleich"), plus: text("gleich"), achse: null }),
    false,
  );
});

test("Klar+ ist nicht buchbar, solange die Zahlung fehlt", () => {
  // `/api/subscribe-klar-plus` antwortet mit HTTP 501 (server.ts). Ein
  // Kaufknopf davor waere eine Sackgasse; die Konstante haelt beides
  // zusammen.
  assert.equal(BUCHBAR, false);
  assert.ok(HINWEIS_NICHT_BUCHBAR.length > 20);
  assert.ok(!/jetzt kaufen|jetzt buchen|abschliessen/i.test(HINWEIS_NICHT_BUCHBAR));
});
