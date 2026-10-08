// Reine Prüfung ohne Browser — läuft über `tsx --test` in `test:pure`.
//
// Geprüft wird `src/lib/gastGrenze.ts`. Anlass ist der Befund vom
// 14.08.2026: Als Gast schlug beim Start das Profil-Update fehl
// (`PERMISSION_DENIED: false for 'update' @ L181`), und die Oberfläche
// schrieb das nur in die Konsole. Die Regel war richtig — nur erfuhr
// niemand davon.
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  EREIGNIS_KONTO_ERFORDERLICH,
  istRegelAblehnung,
  istGastKonto,
  sollGateZeigen,
} from "../src/lib/gastGrenze.ts";

test("der Ereignisname ist der, auf den das Gate hoert", () => {
  // Wenn diese Zeichenkette sich aendert, muss `RegistrierungsGate.tsx`
  // mitgeaendert werden. Der Test haelt beide zusammen — ein stiller
  // Tippfehler waere sonst ein Dialog, der nie erscheint.
  assert.equal(EREIGNIS_KONTO_ERFORDERLICH, "klar_konto_erforderlich");
});

test("Regelablehnung wird an Code und Meldung erkannt", () => {
  assert.equal(istRegelAblehnung({ code: "permission-denied" }), true);
  assert.equal(istRegelAblehnung({ code: "PERMISSION-DENIED" }), true);
  assert.equal(istRegelAblehnung({ code: "firestore/permission-denied" }), true);
  assert.equal(istRegelAblehnung({ code: "storage/unauthorized" }), true);
  // Genau die Form aus der Konsole vom 14.08.2026:
  assert.equal(
    istRegelAblehnung({
      name: "FirebaseError",
      message: "PERMISSION_DENIED: false for 'update' @ L181",
    }),
    true,
  );
});

test("andere Fehler loesen das Gate NICHT aus", () => {
  // Wer gar nicht angemeldet ist, braucht die Anmeldeseite, kein
  // Registrierungs-Gate.
  assert.equal(istRegelAblehnung({ code: "unauthenticated" }), false);
  assert.equal(istRegelAblehnung({ code: "unavailable" }), false);
  assert.equal(istRegelAblehnung({ code: "deadline-exceeded" }), false);
  assert.equal(istRegelAblehnung(new Error("Netzwerk weg")), false);
  assert.equal(istRegelAblehnung("permission-denied"), false, "eine Zeichenkette ist kein Fehler");
  assert.equal(istRegelAblehnung(null), false);
  assert.equal(istRegelAblehnung(undefined), false);
  assert.equal(istRegelAblehnung({}), false);
});

test("nur ein anonymes Konto gilt als Gast", () => {
  assert.equal(istGastKonto({ isAnonymous: true }), true);
  assert.equal(istGastKonto({ isAnonymous: false }), false);
  assert.equal(istGastKonto({ uid: "abc" }), false, "ohne Angabe kein Gast");
  assert.equal(istGastKonto(null), false);
  assert.equal(istGastKonto("gast"), false);
});

test("das Gate braucht BEIDES: Gast und Regelablehnung", () => {
  const gast = { isAnonymous: true };
  const konto = { isAnonymous: false };
  const abgelehnt = { code: "permission-denied" };
  const netzfehler = { code: "unavailable" };

  assert.equal(sollGateZeigen(abgelehnt, gast), true);

  // Der wichtige Fall: Ein ANGEMELDETES Konto, das abgelehnt wird, hat ein
  // echtes Problem — entweder in der Regel oder im Aufruf. „Konto anlegen"
  // waere darauf eine irrefuehrende Antwort.
  assert.equal(sollGateZeigen(abgelehnt, konto), false);

  assert.equal(sollGateZeigen(netzfehler, gast), false);
  assert.equal(sollGateZeigen(netzfehler, konto), false);
  assert.equal(sollGateZeigen(abgelehnt, null), false);
});
