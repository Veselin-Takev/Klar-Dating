import { describe, it } from "vitest";
import assert from 'node:assert/strict';
import {
  STRATEGIE, klassifiziereKiFehler, lohntWiederholung, wartezeitMs,
  entscheideAntwort, erfolg,
} from '../src/server/kiPolitik.ts';

// Prueft, was gilt, wenn ein KI-Aufruf scheitert.
// Laeuft ohne Firebase, ohne Express, ohne Registry:  npm run test:pure

// ═══════════════════════════════════════════════════════════════════════════
// Ersatzstrategien bei KI-Ausfall (kiPolitik.ts)
//
// Die Tests hier bewachen genau die Regel, an der die App am 10.08.2026 an
// 29 Stellen gescheitert ist: Eine erfundene personenbezogene Auswertung ist
// niemals zulässig. Ein 200 darf es nur geben, wenn tatsächlich verwertbarer
// Inhalt mitkommt — und dann muss dranstehen, woher er stammt.
// ═══════════════════════════════════════════════════════════════════════════

describe('KI-Ersatz: Einordnung des Fehlers', () => {
  it('erkennt erschöpftes Kontingent am Status', () => {
    assert.equal(klassifiziereKiFehler({ status: 429 }), 'ki_kontingent');
  });
  it('erkennt es auch am Text', () => {
    assert.equal(klassifiziereKiFehler(new Error('Quota exceeded')), 'ki_kontingent');
    assert.equal(klassifiziereKiFehler('RESOURCE_EXHAUSTED'), 'ki_kontingent');
  });
  it('erkennt Zeitüberschreitung und Abbruch', () => {
    assert.equal(klassifiziereKiFehler(new Error('The operation was aborted')), 'ki_zeitueberschreitung');
  });
  it('erkennt einen ungültigen Schlüssel', () => {
    assert.equal(klassifiziereKiFehler(new Error('API key not valid')), 'ki_kein_schluessel');
  });
  it('faellt auf ki_fehler zurueck statt zu raten', () => {
    assert.equal(klassifiziereKiFehler(new Error('irgendwas')), 'ki_fehler');
    assert.equal(klassifiziereKiFehler(null), 'ki_fehler');
    assert.equal(klassifiziereKiFehler(undefined), 'ki_fehler');
  });
});

describe('KI-Ersatz: Wiederholung', () => {
  it('wiederholt nur, was voruebergehend sein kann', () => {
    assert.equal(lohntWiederholung('ki_kontingent'), true);
    assert.equal(lohntWiederholung('ki_zeitueberschreitung'), true);
  });
  // Ein fehlender Schluessel wird beim zweiten Mal nicht richtig.
  it('wiederholt einen fehlenden Schluessel NICHT', () => {
    assert.equal(lohntWiederholung('ki_kein_schluessel'), false);
  });
  it('wartet zunehmend laenger, aber gedeckelt', () => {
    assert.equal(wartezeitMs(1), 500);
    assert.equal(wartezeitMs(2), 1000);
    assert.equal(wartezeitMs(9), 4000);
    assert.equal(wartezeitMs(0), 0);
  });
});

describe('KI-Ersatz: kein_ersatz scheitert ehrlich', () => {
  // Das ist der Kern. /api/check-safety gab ohne Schluessel isFlagged:false
  // zurueck -- eine Freigabe ohne Pruefung.
  it('liefert niemals 200, auch nicht mit Zwischenspeicher', () => {
    const a = entscheideAntwort('kein_ersatz', 'ki_kontingent',
      { daten: { isFlagged: false }, zeit: new Date().toISOString() }, { isFlagged: false });
    assert.notEqual(a.status, 200);
    assert.equal(a.koerper.herkunft, 'keine');
    assert.equal(a.koerper.isFlagged, undefined);
  });
});

describe('KI-Ersatz: zwischenspeicher', () => {
  const jetzt = new Date('2026-08-10T12:00:00Z');

  it('liefert einen frischen Stand mit Datum und Herkunft', () => {
    const a = entscheideAntwort('zwischenspeicher', 'ki_kontingent',
      { daten: { score: 72 }, zeit: '2026-08-10T08:00:00Z' }, null, jetzt);
    assert.equal(a.status, 200);
    assert.equal(a.koerper.score, 72);
    assert.equal(a.koerper.herkunft, 'zwischenspeicher');
    assert.equal(a.koerper.standVom, '2026-08-10T08:00:00Z');
  });

  // Ohne Altersgrenze wuerde irgendwann ein Stand von letzter Woche als
  // aktuelle Auswertung erscheinen.
  it('lehnt einen zu alten Stand ab statt ihn zu zeigen', () => {
    const a = entscheideAntwort('zwischenspeicher', 'ki_kontingent',
      { daten: { score: 72 }, zeit: '2026-08-08T08:00:00Z' }, null, jetzt);
    assert.notEqual(a.status, 200);
    assert.equal(a.koerper.herkunft, 'keine');
  });

  it('scheitert ehrlich, wenn gar nichts gespeichert ist', () => {
    const a = entscheideAntwort('zwischenspeicher', 'ki_fehler', null, null, jetzt);
    assert.notEqual(a.status, 200);
  });

  // Eine Uhr, die falsch geht, darf keinen Stand aus der Zukunft durchlassen.
  it('lehnt einen Zeitstempel aus der Zukunft ab', () => {
    const a = entscheideAntwort('zwischenspeicher', 'ki_fehler',
      { daten: { score: 1 }, zeit: '2026-08-11T12:00:00Z' }, null, jetzt);
    assert.notEqual(a.status, 200);
  });

  it('lehnt einen unlesbaren Zeitstempel ab', () => {
    const a = entscheideAntwort('zwischenspeicher', 'ki_fehler',
      { daten: { score: 1 }, zeit: 'kein Datum' }, null, jetzt);
    assert.notEqual(a.status, 200);
  });
});

describe('KI-Ersatz: kuratiert und leer', () => {
  it('kuratiert liefert Inhalt MIT Kennzeichnung', () => {
    const a = entscheideAntwort('kuratiert', 'ki_fehler', null, { ideen: ['Spaziergang'] });
    assert.equal(a.status, 200);
    assert.equal(a.koerper.herkunft, 'kuratiert');
    assert.match(String(a.koerper.hinweis), /nicht auf dich zugeschnitten/);
  });

  it('kuratiert ohne hinterlegte Inhalte scheitert, statt etwas zu erfinden', () => {
    const a = entscheideAntwort('kuratiert', 'ki_fehler', null, null);
    assert.notEqual(a.status, 200);
  });

  it('leer sagt der Oberflaeche, den Bereich wegzulassen', () => {
    const a = entscheideAntwort('leer', 'ki_fehler', null, null);
    assert.notEqual(a.status, 200);
    assert.equal(a.koerper.ausblenden, true);
  });
});

describe('KI-Ersatz: die Matrix selbst', () => {
  // Diese beiden Tests sind die eigentliche Absicherung gegen einen
  // Rueckfall. Sie pruefen nicht Code, sondern eine Entscheidung.
  it('kein Endpunkt mit Personenbezug steht auf kuratiert', () => {
    const mitPersonenbezug = [
      '/api/check-safety', '/api/profile-check', '/api/competence-radar',
      '/api/mood-monitor', '/api/date-check', '/api/ai-passgenauigkeit',
      '/api/parse-profile-import', '/api/optimize-profile',
      '/api/dating-journal-analysis', '/api/analyze-relationship',
    ];
    for (const e of mitPersonenbezug) {
      assert.notEqual(STRATEGIE[e], 'kuratiert', `${e} darf nicht kuratiert sein`);
    }
  });

  it('jede Strategie kommt vor -- keine ist tot', () => {
    const vorhanden = new Set(Object.values(STRATEGIE));
    // `as const` statt eines Felds aus einfachen Zeichenketten: Ohne das
    // ist `s` vom Typ `string` und passt nicht zu `Set<Ersatzstrategie>`
    // (TS2345). Aufgefallen erst im Editor, weil tests/ bis heute in
    // keiner tsconfig stand -- genau die Luecke, die tsconfig.tests.json
    // schliesst.
    const alle = ['kein_ersatz', 'zwischenspeicher', 'kuratiert', 'leer'] as const;
    for (const s of alle) {
      assert.equal(vorhanden.has(s), true, `${s} wird nirgends benutzt`);
    }
  });

  it('erfolg traegt herkunft: ki', () => {
    assert.equal(erfolg({ a: 1 }).koerper.herkunft, 'ki');
    assert.equal(erfolg({ a: 1 }).status, 200);
  });
});
