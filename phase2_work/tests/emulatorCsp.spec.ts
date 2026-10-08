import { test } from "vitest";
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { emulatorCsp } from '../src/server/emulatorCsp.ts';

test('ohne Variablen bleibt die CSP unveraendert', () => {
  const { verbindung, rahmen } = emulatorCsp(undefined, undefined);
  assert.deepEqual(verbindung, []);
  assert.deepEqual(rahmen, []);
});

test('leere Zeichenkette zaehlt wie nicht gesetzt', () => {
  const { verbindung, rahmen } = emulatorCsp('', '');
  assert.deepEqual(verbindung, []);
  assert.deepEqual(rahmen, []);
});

test('beide Wirte: vier Verbindungsquellen', () => {
  const { verbindung } = emulatorCsp('127.0.0.1:8080', '127.0.0.1:9099');
  assert.deepEqual(verbindung, [
    'http://127.0.0.1:8080', 'ws://127.0.0.1:8080',
    'http://127.0.0.1:9099', 'ws://127.0.0.1:9099',
  ]);
});

test('der Anmelde-Rahmen ist der Auth-Wirt', () => {
  const { rahmen } = emulatorCsp('127.0.0.1:8080', '127.0.0.1:9099');
  assert.deepEqual(rahmen, ['http://127.0.0.1:9099']);
});

test('Firestore allein oeffnet keinen Rahmen', () => {
  const { verbindung, rahmen } = emulatorCsp('127.0.0.1:8080', undefined);
  assert.deepEqual(verbindung, ['http://127.0.0.1:8080', 'ws://127.0.0.1:8080']);
  assert.deepEqual(rahmen, []);
});

test('Auth allein oeffnet den Rahmen', () => {
  const { verbindung, rahmen } = emulatorCsp(undefined, '127.0.0.1:9099');
  assert.deepEqual(verbindung, ['http://127.0.0.1:9099', 'ws://127.0.0.1:9099']);
  assert.deepEqual(rahmen, ['http://127.0.0.1:9099']);
});

test('ein anderer Wirt wird uebernommen, nicht fest verdrahtet', () => {
  const { verbindung, rahmen } = emulatorCsp('emu:9080', 'emu:9098');
  assert.deepEqual(verbindung, [
    'http://emu:9080', 'ws://emu:9080',
    'http://emu:9098', 'ws://emu:9098',
  ]);
  assert.deepEqual(rahmen, ['http://emu:9098']);
});

test('index.html does not override the server CSP with a second policy', () => {
  assert.doesNotMatch(readFileSync('index.html', 'utf8'), /http-equiv=["']Content-Security-Policy["']/i);
});
