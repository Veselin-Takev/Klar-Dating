// Reine Prüfung ohne Firebase, ohne Express — läuft über `tsx --test` in
// `test:pure`.
//
// Geprüft wird die Linie aus `src/server/gastrechte.ts`: Wer ist ein Gast,
// und was darf er. Die Fälle sind aus der Produktentscheidung vom 14.08.2026
// abgeleitet, nicht ausgedacht.
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import {
  GAST_GESPERRT,
  GAST_KI_GRENZE,
  istGast,
  gastDarf,
  CODE_KONTO_ERFORDERLICH,
} from "../src/server/gastrechte.ts";

describe("Wer gilt als Gast", () => {
  it("erkennt ein anonymes Firebase-Token", () => {
    assert.equal(istGast({ uid: "x", firebase: { sign_in_provider: "anonymous" } }), true);
  });

  it("erkennt Google und E-Mail NICHT als Gast", () => {
    assert.equal(istGast({ uid: "x", firebase: { sign_in_provider: "google.com" } }), false);
    assert.equal(istGast({ uid: "x", firebase: { sign_in_provider: "password" } }), false);
  });

  it("gilt im Zweifel NICHT als Gast", () => {
    // Begruendung steht in gastrechte.ts: Ein zu weit geoeffnetes Gasttor ist
    // durch die Firestore-Regeln gedeckt, ein faelschlich gesperrtes Konto
    // durch nichts.
    assert.equal(istGast({ uid: "x" }), false);
    assert.equal(istGast({ uid: "x", firebase: {} }), false);
    assert.equal(istGast({ uid: "x", firebase: null }), false);
    assert.equal(istGast({ firebase: { sign_in_provider: 42 } }), false);
    assert.equal(istGast(null), false);
    assert.equal(istGast(undefined), false);
    assert.equal(istGast("anonymous"), false);
  });
});

describe("Was ein Gast NICHT darf — Interaktion mit anderen Menschen", () => {
  it("kein Kontakt", () => {
    assert.equal(gastDarf("/api/contact"), false);
    assert.equal(gastDarf("/api/contact/undo"), false);
  });

  it("kein Icebreaker-Gate", () => {
    assert.equal(gastDarf("/api/gate/answer"), false);
  });

  it("keine Verifizierung", () => {
    assert.equal(gastDarf("/api/verification/challenge"), false);
    assert.equal(gastDarf("/api/verification/submit"), false);
    assert.equal(gastDarf("/api/verification/decide"), false);
  });

  it("kein Abo-Vorgang", () => {
    assert.equal(gastDarf("/api/subscription/cancel"), false);
    assert.equal(gastDarf("/api/subscription/withdraw"), false);
  });
});

describe("Was ein Gast darf — Vorschau und Werkzeuge", () => {
  it("Profile ansehen und Kontingent lesen", () => {
    assert.equal(gastDarf("/api/quota"), true);
    assert.equal(gastDarf("/api/gate/status"), true);
    assert.equal(gastDarf("/api/verification/status"), true);
    assert.equal(gastDarf("/api/subscription/status"), true);
  });

  it("KI-Werkzeuge ausprobieren", () => {
    assert.equal(gastDarf("/api/profile-summary"), true);
    assert.equal(gastDarf("/api/competence-radar"), true);
    assert.equal(gastDarf("/api/icebreaker"), true);
    assert.equal(gastDarf("/api/chat"), true);
  });

  it("melden und blockieren — Schutzfunktionen bleiben offen", () => {
    // Wer gerade belaestigt wird, soll sich nicht erst registrieren muessen.
    assert.equal(gastDarf("/api/report"), true);
    assert.equal(gastDarf("/api/block"), true);
  });

  it("Altersabfrage und Einwilligung — sonst kommt ein Gast nirgendwohin", () => {
    assert.equal(gastDarf("/api/account/alter"), true);
    assert.equal(gastDarf("/api/einwilligung"), true);
    assert.equal(gastDarf("/api/einwilligung/widerruf"), true);
  });

  it("die eigene Loeschung — Art. 17 DSGVO gilt auch fuer Gaeste", () => {
    assert.equal(gastDarf("/api/account/delete"), true);
    assert.equal(gastDarf("/api/account/export"), true);
  });
});

describe("Die Sperre laesst sich nicht mit einer anderen Schreibweise umgehen", () => {
  it("Abfrageteil zaehlt nicht", () => {
    assert.equal(gastDarf("/api/contact?x=1"), false);
  });

  it("Schraegstrich am Ende zaehlt nicht", () => {
    assert.equal(gastDarf("/api/contact/"), false);
  });

  it("aber ein echter Unterpfad ist ein anderer Endpunkt", () => {
    // `/api/contacts` ist NICHT `/api/contact`. Waere die Pruefung ein
    // Praefixvergleich, wuerde hier faelschlich gesperrt.
    assert.equal(gastDarf("/api/contacts"), true);
  });

  it("Unsinn wird gesperrt, nicht durchgelassen", () => {
    assert.equal(gastDarf(""), false);
    assert.equal(gastDarf(null), false);
    assert.equal(gastDarf(undefined), false);
    assert.equal(gastDarf(42), false);
  });
});

describe("Die Festlegungen selbst", () => {
  it("die Sperrliste ist klein genug, um sie zu lesen", () => {
    // Begruendung fuer eine Sperr- statt Erlaubnisliste steht in
    // gastrechte.ts. Sie traegt nur, solange die Liste ueberschaubar ist.
    assert.ok(GAST_GESPERRT.size <= 12, `Sperrliste hat ${GAST_GESPERRT.size} Eintraege`);
  });

  it("jeder Eintrag beginnt mit /api/", () => {
    for (const pfad of GAST_GESPERRT) {
      assert.ok(pfad.startsWith("/api/"), `${pfad} ohne /api/`);
      assert.ok(!pfad.endsWith("/"), `${pfad} mit Schraegstrich am Ende`);
    }
  });

  it("die Gastgrenze liegt unter der Kontogrenze von 60", () => {
    assert.ok(GAST_KI_GRENZE > 0);
    assert.ok(GAST_KI_GRENZE < 60, "sonst waere sie keine Grenze");
  });

  it("der Fehlercode ist der, den der Client erwartet", () => {
    assert.equal(CODE_KONTO_ERFORDERLICH, "konto_erforderlich");
  });
});
