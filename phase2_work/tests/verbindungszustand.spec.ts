import { test } from "vitest";
import assert from 'node:assert/strict';
import { verbindungshinweis } from '../src/lib/verbindungszustand.ts';

test('sicherer Zusammenhang: die Zusage darf stehen', () => {
  const h = verbindungshinweis(true);
  assert.equal(h.sicher, true);
  assert.equal(h.text, 'Verschlüsselte Verbindung.');
});

test('unsicher: NICHT die Zusage — das ist der Befund vom 14.08.2026', () => {
  const h = verbindungshinweis(false);
  assert.equal(h.sicher, false);
  assert.notEqual(h.text, 'Verschlüsselte Verbindung.');
});

test('unsicher: es wird nicht geschwiegen, sondern gewarnt', () => {
  const h = verbindungshinweis(false);
  assert.ok(h.text.length > 0, 'ein leerer Text waere blosses Verschweigen');
  assert.ok(/Passw/i.test(h.text), 'die Warnung muss sagen, worauf zu verzichten ist');
});

test('der Wahrheitswert und der Text widersprechen sich nie', () => {
  for (const sicher of [true, false]) {
    const h = verbindungshinweis(sicher);
    assert.equal(h.sicher, sicher);
    assert.equal(h.text === 'Verschlüsselte Verbindung.', sicher);
  }
});
