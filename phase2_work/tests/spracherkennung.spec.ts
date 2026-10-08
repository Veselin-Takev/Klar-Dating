import { test } from "vitest";
import assert from 'node:assert/strict';
import { spracherkennungHinweis, NICHT_VERFUEGBAR } from '../src/lib/spracherkennung.ts';

test('fehlende Berechtigung: sagt, was zu tun ist', () => {
  const t = spracherkennungHinweis('not-allowed');
  assert.ok(t.length > 0);
  assert.ok(/erlaub/i.test(t), 'die Person muss erfahren, dass sie erlauben kann');
});

test('service-not-allowed wird wie not-allowed behandelt', () => {
  assert.equal(spracherkennungHinweis('service-not-allowed'),
               spracherkennungHinweis('not-allowed'));
});

test('kein Mikrofon, nichts gehört, kein Netz: je ein eigener Satz', () => {
  const drei = ['audio-capture', 'no-speech', 'network'].map(spracherkennungHinweis);
  for (const t of drei) assert.ok(t.length > 0);
  assert.equal(new Set(drei).size, 3, 'drei verschiedene Ursachen, drei verschiedene Saetze');
});

test('eigener Abbruch bleibt still', () => {
  assert.equal(spracherkennungHinweis('aborted'), '');
});

test('unbekannte Kennung wird nicht verschluckt', () => {
  const t = spracherkennungHinweis('irgendwas-neues');
  assert.ok(t.length > 0, 'Schweigen ist genau der Befund, der repariert wird');
});

test('fehlende Kennung wird nicht verschluckt', () => {
  assert.ok(spracherkennungHinweis(undefined).length > 0);
  assert.ok(spracherkennungHinweis(null).length > 0);
  assert.ok(spracherkennungHinweis('').length > 0);
});

test('kein Satz ist leer ausser dem Abbruch', () => {
  const kennungen = ['not-allowed', 'service-not-allowed', 'audio-capture',
                     'no-speech', 'network', 'language-not-supported'];
  for (const k of kennungen) {
    assert.ok(spracherkennungHinweis(k).length > 0, `leer bei ${k}`);
  }
  assert.ok(NICHT_VERFUEGBAR.length > 0);
});
