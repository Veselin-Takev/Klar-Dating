import { describe, it } from "vitest";
import assert from 'node:assert/strict';
import { schluessel, istVerwertbar, pfad } from '../src/server/zwischenspeicher.ts';

// ═══════════════════════════════════════════════════════════════════════════
// Tests für den Zwischenspeicher — den Teil, der ohne Firestore auskommt.
//
// Die Firestore-Anbindung selbst (`lies`, `schreibe`) wird nicht hier
// geprüft, sondern über die Regeltests: Dort steht, dass kein Client an
// diese Unterkollektion herankommt. Was hier geprüft wird, sind die beiden
// Entscheidungen, die falsch sein könnten, ohne dass es jemand merkt:
// der Dokumentname und die Frage, wann ein Eintrag zu alt ist.
// ═══════════════════════════════════════════════════════════════════════════

describe('schluessel — aus einem Endpunkt einen Dokumentnamen machen', () => {
  it('entfernt den fuehrenden Schraegstrich', () => {
    assert.equal(schluessel('/api/mood-monitor'), 'api_mood-monitor');
  });

  it('ersetzt innere Schraegstriche — sonst waere es ein Pfad, kein Name', () => {
    // `/api/gemini/dating-readiness` als Dokumentname wuerde in Firestore
    // drei Ebenen aufmachen statt ein Dokument zu benennen.
    assert.equal(schluessel('/api/gemini/dating-readiness'), 'api_gemini_dating-readiness');
  });

  it('laesst Bindestriche und Unterstriche stehen', () => {
    assert.equal(schluessel('/api/dating-success-score'), 'api_dating-success-score');
    assert.equal(schluessel('/api/a_b'), 'api_a_b');
  });

  it('ersetzt Punkte — `.` und `..` sind in Firestore unzulaessig', () => {
    assert.equal(schluessel('/api/a.b'), 'api_a_b');
    assert.equal(schluessel('/api/../etc'), 'api_etc');
  });

  it('erzeugt nie einen leeren Namen', () => {
    assert.equal(schluessel('/'), 'unbenannt');
    assert.equal(schluessel(''), 'unbenannt');
    assert.equal(schluessel('///'), 'unbenannt');
  });

  it('ist stabil — derselbe Endpunkt ergibt denselben Namen', () => {
    assert.equal(schluessel('/api/mood-monitor'), schluessel('/api/mood-monitor'));
  });
});

describe('istVerwertbar — wann ein Eintrag zu alt ist', () => {
  const jetzt = new Date('2026-08-12T12:00:00.000Z');

  it('frisch: eine Stunde alt', () => {
    assert.equal(istVerwertbar('2026-08-12T11:00:00.000Z', jetzt), true);
  });

  it('genau an der Grenze von 36 Stunden gilt noch', () => {
    assert.equal(istVerwertbar('2026-08-11T00:00:00.000Z', jetzt), true);
  });

  it('eine Minute darueber gilt nicht mehr', () => {
    assert.equal(istVerwertbar('2026-08-10T23:59:00.000Z', jetzt), false);
  });

  it('eine unlesbare Zeitangabe gilt als nicht verwertbar', () => {
    // ENTSCHEIDUNG: Ein Eintrag, dessen Alter man nicht kennt, darf nicht
    // als „Stand vom …" ausgeliefert werden. Im Zweifel scheitern.
    assert.equal(istVerwertbar('gestern', jetzt), false);
    assert.equal(istVerwertbar('', jetzt), false);
  });

  it('eine Zeitangabe in der Zukunft gilt als nicht verwertbar', () => {
    // Kann durch eine falsch gestellte Uhr entstehen. Dann stimmt die
    // Altersangabe nicht, und eine falsche Altersangabe ist schlimmer als
    // keine Antwort.
    assert.equal(istVerwertbar('2026-08-12T12:00:01.000Z', jetzt), false);
  });

  it('die Frist ist einstellbar, damit sie pruefbar bleibt', () => {
    assert.equal(istVerwertbar('2026-08-12T10:00:00.000Z', jetzt, 1), false);
    assert.equal(istVerwertbar('2026-08-12T11:30:00.000Z', jetzt, 1), true);
  });
});

describe('pfad', () => {
  it('haengt den Speicher unter das Nutzerdokument', () => {
    // Der Bezug zur Person steht damit im Pfad. Auskunft und Loeschung
    // finden ihn ohne Abfrage ueber ein Feld.
    assert.equal(pfad('abc'), 'users/abc/ki_zwischenspeicher');
  });
});
