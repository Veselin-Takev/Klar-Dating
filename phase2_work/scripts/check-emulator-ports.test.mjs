import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { portsFromEmulatorConfiguration, assertPortsAvailable } from './check-emulator-ports.mjs';

const standard = JSON.parse(readFileSync('firebase.json', 'utf8'));
const rules = JSON.parse(readFileSync('firebase.pruefung.json', 'utf8'));

test('main emulator profile includes actual Firestore/Auth/Storage and UI ports', () => {
  assert.deepEqual(portsFromEmulatorConfiguration(standard), [4000, 8080, 9099, 9199]);
});

test('rules/Art17 profile detects configured Firestore, hub and logging ports', () => {
  assert.deepEqual(portsFromEmulatorConfiguration(rules), [4405, 4505, 8085]);
  assert.equal(rules.emulators.ui.enabled, false);
});

test('invalid, ambiguous or unspecified Firestore ports fail closed', () => {
  assert.throws(() => portsFromEmulatorConfiguration({ emulators: {} }), /Firestore Emulator/);
  assert.throws(() => portsFromEmulatorConfiguration({ emulators: { firestore: { port: 0 } } }), /Invalid emulator port/);
  assert.throws(() => portsFromEmulatorConfiguration({ emulators: { firestore: { port: 8085 }, hub: { port: 8085 } } }), /configured twice/);
  assert.throws(() => portsFromEmulatorConfiguration({ emulators: { firestore: {} } }), /Firestore Emulator port/);
});

test('actively listening local ports are rejected without terminating their owner', async () => {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    await assert.rejects(assertPortsAvailable([port]), /occupied/);
    assert.equal(server.listening, true);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
  await assertPortsAvailable([port]);
});

test('an unapproved emulator configuration path is never opened', () => {
  const result = spawnSync(process.execPath, ['scripts/check-emulator-ports.mjs', '--config', '../firebase.json'], { encoding: 'utf8', timeout: 10_000 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unapproved Firebase emulator configuration/);
});
