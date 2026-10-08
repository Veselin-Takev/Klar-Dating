import { test } from "vitest";
import assert from 'node:assert/strict';
import { anmeldeschritt } from '../src/lib/anmeldefehler.ts';

test('vom Browser verhindert: zweiter Weg ueber die Weiterleitung', () => {
  assert.equal(anmeldeschritt('auth/popup-blocked'), 'weiterleiten');
});

test('von der Person geschlossen: stillschweigend beenden', () => {
  assert.equal(anmeldeschritt('auth/popup-closed-by-user'), 'abbrechen');
});

test('Doppelklick loest den ersten Versuch ab: kein Fehler', () => {
  assert.equal(anmeldeschritt('auth/cancelled-popup-request'), 'abbrechen');
});

test('von der Person am Anmeldedienst abgebrochen: kein Fehler', () => {
  assert.equal(anmeldeschritt('auth/user-cancelled'), 'abbrechen');
});

test('unbekannte Kennung wird gemeldet, nicht verschluckt', () => {
  assert.equal(anmeldeschritt('auth/network-request-failed'), 'melden');
  assert.equal(anmeldeschritt('auth/internal-error'), 'melden');
});

test('fehlende Kennung wird gemeldet', () => {
  assert.equal(anmeldeschritt(undefined), 'melden');
  assert.equal(anmeldeschritt(null), 'melden');
  assert.equal(anmeldeschritt(''), 'melden');
});

test('Schliessen fuehrt NICHT zur Weiterleitung', () => {
  // Der eigentliche Befund vom 14.08.2026: Genau diese Gleichsetzung hat
  // den Haupt-Tab zum Anmeldedienst geschickt und damit "No matching frame"
  // erzeugt. Faellt dieser Fall, ist der Fehler zurueck.
  assert.notEqual(anmeldeschritt('auth/popup-closed-by-user'), 'weiterleiten');
});
