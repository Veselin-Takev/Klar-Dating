#!/usr/bin/env node
import net from 'node:net';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Real emulator profiles differ: firebase.json and firebase.pruefung.json
// require different ports. Never assume an unrelated hard-coded port list.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const allowedConfigs = new Set(['firebase.json', 'firebase.pruefung.json']);

export function portsFromEmulatorConfiguration(configuration) {
  if (!configuration || typeof configuration !== 'object' || !configuration.emulators) {
    throw new Error('Firestore emulator configuration missing');
  }
  const byPort = new Map();
  for (const [name, options] of Object.entries(configuration.emulators)) {
    if (!options || typeof options !== 'object' || options.enabled === false) continue;
    if (!('port' in options)) continue;
    const port = options.port;
    if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid emulator port configured for ${name}`);
    }
    if (byPort.has(port)) {
      throw new Error(`Emulator port ${port} is configured twice: ${byPort.get(port)}, ${name}`);
    }
    byPort.set(port, name);
  }
  if (!byPort.size || ![...byPort.values()].includes('firestore')) {
    throw new Error('No explicitly configured Firestore Emulator port');
  }
  return [...byPort.keys()].sort((a, b) => a - b);
}

export async function assertPortsAvailable(ports, host = '127.0.0.1') {
  for (const port of ports) {
    await new Promise((resolve, reject) => {
      const server = net.createServer();
      server.once('error', () => reject(new Error(
        `Emulator port ${port} is occupied. Stop the owning development/emulator process before starting an isolated test run.`,
      )));
      server.listen(port, host, () => server.close(resolve));
    });
  }
}

export async function checkEmulatorProfile(profile) {
  if (!allowedConfigs.has(profile)) throw new Error('Unapproved Firebase emulator configuration: ' + profile);
  const config = JSON.parse(readFileSync(join(root, profile), 'utf8'));
  const ports = portsFromEmulatorConfiguration(config);
  // The default test:ci job also starts the local application server.
  if (profile === 'firebase.json' && !ports.includes(3000)) ports.push(3000);
  await assertPortsAvailable(ports);
  return ports.sort((a, b) => a - b);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const profile = args.length === 0 ? 'firebase.json'
    : args.length === 2 && args[0] === '--config' ? args[1] : null;
  try {
    if (!profile) throw new Error('Expected [--config firebase.json|firebase.pruefung.json]');
    const ports = await checkEmulatorProfile(profile);
    console.log(`Emulator ports available for ${profile}: ${ports.join(', ')}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
