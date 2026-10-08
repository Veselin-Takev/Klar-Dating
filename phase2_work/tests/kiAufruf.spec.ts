import { describe, it } from "vitest";
import assert from 'node:assert/strict';
import { rufeKi, schaeleJson, beantworte, schluesselFehlt, ausfall } from '../src/server/kiAufruf.ts';

// ═══════════════════════════════════════════════════════════════════════════
// Tests für den KI-Aufrufweg.
//
// Diese Datei prüft ABLAUF, nicht Inhalt: Zeitgrenze, Wiederholung,
// JSON-Behandlung und die Weitergabe an die Ersatzregel. Der Aufruf selbst
// wird eingesetzt (ein Doppel), es geht nie ein Netzaufruf hinaus.
//
// Bewusst dabei: zwei Tests, die eine ENTSCHEIDUNG bewachen, keine
// Funktion — genauso wie in kiPolitik.spec.ts. Sie brechen, wenn jemand
// später anders entscheidet:
//   · „ein leerer Text ist kein Erfolg"
//   · „ohne kuratierten Inhalt wird ehrlich gescheitert"
// ═══════════════════════════════════════════════════════════════════════════

/** Ein Aufruf, der zählt, wie oft er benutzt wurde. */
function doppel(verhalten: Array<(() => Promise<{ text?: string | null }>)>) {
  let i = 0;
  const zaehler = { aufrufe: 0 };
  const aufruf = async (_signal: AbortSignal) => {
    zaehler.aufrufe++;
    const naechstes = verhalten[Math.min(i, verhalten.length - 1)]!;
    i++;
    return naechstes();
  };
  return { aufruf, zaehler };
}

describe('rufeKi — Ablauf', () => {
  it('gibt den Text zurueck, wenn der erste Versuch gelingt', async () => {
    const { aufruf, zaehler } = doppel([async () => ({ text: '{"a":1}' })]);
    const e = await rufeKi(aufruf);
    assert.equal(e.ok, true);
    assert.equal(e.ok && e.text, '{"a":1}');
    assert.equal(zaehler.aufrufe, 1, 'kein zweiter Versuch bei Erfolg');
  });

  it('ein leerer Text ist KEIN Erfolg', async () => {
    // ENTSCHEIDUNG: Aus einer leeren Antwort wurde vorher an mehreren
    // Stellen ein leeres Objekt und damit eine „Auswertung".
    const { aufruf } = doppel([async () => ({ text: '   ' })]);
    const e = await rufeKi(aufruf);
    assert.equal(e.ok, false);
    assert.equal(!e.ok && e.code, 'ki_leer');
  });

  it('wiederholt bei Kontingentfehler und gelingt beim zweiten Versuch', async () => {
    const { aufruf, zaehler } = doppel([
      async () => { throw Object.assign(new Error('quota exceeded'), { status: 429 }); },
      async () => ({ text: '{"b":2}' }),
    ]);
    const e = await rufeKi(aufruf);
    assert.equal(e.ok, true);
    assert.equal(zaehler.aufrufe, 2);
  });

  it('wiederholt NICHT, wenn der Schluessel fehlt', async () => {
    // Ein fehlender Schluessel wird beim zweiten Versuch nicht besser.
    const { aufruf, zaehler } = doppel([
      async () => { throw new Error('API key not valid'); },
    ]);
    const e = await rufeKi(aufruf);
    assert.equal(e.ok, false);
    assert.equal(!e.ok && e.code, 'ki_kein_schluessel');
    assert.equal(zaehler.aufrufe, 1, 'kein zweiter Versuch ohne Schluessel');
  });

  it('bricht nach der Zeitgrenze ab und meldet Zeitueberschreitung', async () => {
    const aufruf = (signal: AbortSignal) =>
      new Promise<{ text?: string }>((_erfuellen, ablehnen) => {
        signal.addEventListener('abort', () => ablehnen(new Error('aborted')));
        // erfuellt nie von selbst
      });
    const e = await rufeKi(aufruf, 30);
    assert.equal(e.ok, false);
    assert.equal(!e.ok && e.code, 'ki_zeitueberschreitung');
  });

  it('bricht auch ab, wenn der Aufruf das Signal IGNORIERT', async () => {
    // ENTSCHEIDUNG: Eine Zeitgrenze, die von der Mitarbeit des Aufgerufenen
    // abhaengt, ist keine. Ob `@google/genai` `config.abortSignal`
    // auswertet, ist nicht belegt — also darf sich nichts darauf verlassen.
    const aufruf = () => new Promise<{ text?: string }>(() => { /* nie */ });
    const e = await rufeKi(aufruf, 30);
    assert.equal(e.ok, false);
    assert.equal(!e.ok && e.code, 'ki_zeitueberschreitung');
  });

  it('reicht das Signal an den Aufruf durch', async () => {
    let bekommen: AbortSignal | null = null;
    await rufeKi(async (signal) => { bekommen = signal; return { text: '{}' }; });
    assert.ok(bekommen, 'der Aufruf hat ein AbortSignal erhalten');
  });
});

describe('schaeleJson', () => {
  it('entfernt einen Zaun mit Sprachangabe', () => {
    assert.equal(schaeleJson('```json\n{"a":1}\n```'), '{"a":1}');
  });

  it('entfernt einen Zaun ohne Sprachangabe', () => {
    assert.equal(schaeleJson('```\n{"a":1}\n```'), '{"a":1}');
  });

  it('schneidet einen vorangestellten Satz weg', () => {
    assert.equal(schaeleJson('Hier ist das Ergebnis: {"a":1}'), '{"a":1}');
  });

  it('laesst sauberes JSON unveraendert', () => {
    assert.equal(schaeleJson('{"a":1}'), '{"a":1}');
  });

  it('laesst Text ohne Klammern unveraendert — dann scheitert JSON.parse regulaer', () => {
    assert.equal(schaeleJson('Das kann ich nicht beantworten.'), 'Das kann ich nicht beantworten.');
  });

  it('kommt mit einem Array zurecht', () => {
    assert.equal(schaeleJson('```json\n[1,2]\n```'), '[1,2]');
  });
});

describe('beantworte — Zusammenspiel mit der Ersatzregel', () => {
  it('Erfolg traegt herkunft ki', async () => {
    const a = await beantworte('/api/daily-icebreakers', async () => ({ text: '{"tipp":"x"}' }));
    assert.equal(a.status, 200);
    assert.equal(a.koerper.herkunft, 'ki');
    assert.equal(a.koerper.tipp, 'x');
  });

  it('unbrauchbares JSON fuehrt zur Ersatzregel, nicht zu einem Absturz', async () => {
    const a = await beantworte('/api/check-safety', async () => ({ text: 'kein json' }));
    assert.notEqual(a.status, 200);
    assert.equal(a.koerper.code, 'ki_ungueltig');
  });

  it('eine blosse Zahl ist keine Auswertung', async () => {
    // Gueltiges JSON, aber kein Objekt. Das durchzulassen hiesse, eine
    // Antwort zu behaupten, die es nicht gibt.
    const a = await beantworte('/api/check-safety', async () => ({ text: '42' }));
    assert.notEqual(a.status, 200);
    assert.equal(a.koerper.code, 'ki_ungueltig');
  });

  it('kein_ersatz liefert bei Ausfall niemals 200', async () => {
    // Dieselbe Entscheidung wie in kiPolitik.spec.ts, hier auf dem echten
    // Aufrufweg statt am Modul allein.
    const a = await beantworte('/api/check-safety', async () => { throw new Error('quota'); });
    assert.notEqual(a.status, 200);
    assert.equal(a.koerper.herkunft, 'keine');
  });

  it('ohne kuratierten Inhalt wird ehrlich gescheitert', async () => {
    // ENTSCHEIDUNG: Dieses Modul erfindet nichts. Steht ein Endpunkt auf
    // `kuratiert`, ohne dass die Aufrufstelle Inhalt mitgibt, wird
    // gescheitert — nicht ersatzweise etwas erzeugt.
    const a = await beantworte('/api/daily-coach-insight', async () => { throw new Error('quota'); });
    assert.notEqual(a.status, 200);
    assert.equal(a.koerper.herkunft, 'keine');
  });

  it('mit kuratiertem Inhalt wird dieser ausgeliefert, gekennzeichnet', async () => {
    const a = await beantworte(
      '/api/daily-coach-insight',
      async () => { throw new Error('quota'); },
      { kuratiert: { tipp: 'Stell eine offene Frage.' } },
    );
    assert.equal(a.status, 200);
    assert.equal(a.koerper.herkunft, 'kuratiert');
    assert.equal(typeof a.koerper.hinweis, 'string');
  });

  it('json:false mit `feld` legt den Text unter dem gewuenschten Namen ab', async () => {
    // ENTSCHEIDUNG: Der Feldname gehoert zum Vertrag mit der Oberflaeche.
    // Ein stiller Wechsel von `insight` auf `text` erzeugt dort eine leere
    // Anzeige — ohne Fehler, ohne Meldung.
    const a = await beantworte(
      '/api/quick-insight',
      async () => ({ text: 'Kurzer Satz' }),
      { json: false, feld: 'insight' },
    );
    assert.equal(a.status, 200);
    assert.equal(a.koerper.insight, 'Kurzer Satz');
    assert.equal(a.koerper.text, undefined);
  });

  it('json:false liefert den Rohtext', async () => {
    const a = await beantworte('/api/daily-icebreakers', async () => ({ text: 'Hallo' }), { json: false });
    assert.equal(a.status, 200);
    assert.equal(a.koerper.text, 'Hallo');
  });
});

describe('schluesselFehlt', () => {
  it('erkennt einen fehlenden und einen leeren Schluessel', () => {
    const vorher = process.env.GEMINI_API_KEY;
    try {
      delete process.env.GEMINI_API_KEY;
      assert.equal(schluesselFehlt(), true);
      process.env.GEMINI_API_KEY = '   ';
      assert.equal(schluesselFehlt(), true);
      process.env.GEMINI_API_KEY = 'abc';
      assert.equal(schluesselFehlt(), false);
    } finally {
      if (vorher === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = vorher;
    }
  });
});

describe('ausfall — die Zwischenstufe fuer noch nicht umgestellte Endpunkte', () => {
  it('kein_ersatz liefert niemals 200', () => {
    const a = ausfall('/api/chat', new Error('quota exceeded'));
    assert.notEqual(a.status, 200);
    assert.equal(a.koerper.herkunft, 'keine');
  });

  it('zwischenspeicher ohne Zwischenspeicher scheitert ehrlich', () => {
    // ENTSCHEIDUNG: Solange es keinen Zwischenspeicher gibt, wird nichts
    // erfunden. Ein leerer Speicher ist kein Grund fuer eine Antwort.
    const a = ausfall('/api/dating-success-score', new Error('quota'));
    assert.notEqual(a.status, 200);
  });

  it('leer setzt ausblenden', () => {
    const a = ausfall('/api/city-trend-radar', new Error('quota'));
    assert.equal(a.koerper.ausblenden, true);
  });

  it('kuratiert liefert den mitgegebenen Text, gekennzeichnet', () => {
    const a = ausfall('/api/conversation-tuning', new Error('quota'), {
      kuratiert: { hinweise: ['Stell eine offene Frage.'] },
    });
    assert.equal(a.status, 200);
    assert.equal(a.koerper.herkunft, 'kuratiert');
  });

  it('ein unbekannter Endpunkt faellt auf die strengste Regel', () => {
    const a = ausfall('/api/gibt-es-nicht', new Error('quota'));
    assert.notEqual(a.status, 200);
    assert.equal(a.koerper.herkunft, 'keine');
  });

  it('unterscheidet Kontingent von sonstigem Fehler', () => {
    assert.equal(ausfall('/api/chat', Object.assign(new Error('x'), { status: 429 })).koerper.code, 'ki_kontingent');
    assert.equal(ausfall('/api/chat', new Error('irgendwas')).koerper.code, 'ki_fehler');
  });
});
