import { spawn } from 'child_process';
import net from 'net';

const EMULATOR_PORT = 8080;
const TEST_COMMAND = process.argv.slice(2).join(' ') || 'npx vitest run tests/rules.spec.ts';

function checkPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      resolve(false);
    });

    socket.connect(port, '127.0.0.1');
  });
}

async function run() {
  const isRunning = await checkPort(EMULATOR_PORT);
  let emulatorProcess = null;

  if (!isRunning) {
    console.log('⚡ Starte Firebase Emulator...');
    emulatorProcess = spawn('firebase', ['emulators:start', '--only', 'firestore'], {
      stdio: 'inherit',
      shell: true,
    });

    console.log('Warte auf Emulator-Bereitschaft...');
    let retries = 30;
    while (retries > 0) {
      await new Promise((r) => setTimeout(r, 1000));
      if (await checkPort(EMULATOR_PORT)) {
        console.log('✅ Emulator ist bereit!');
        break;
      }
      retries--;
    }

    if (retries === 0) {
      console.error('❌ Fehler: Firebase Emulator Timeout.');
      if (emulatorProcess) emulatorProcess.kill();
      process.exit(1);
    }
  } else {
    console.log('✅ Firebase Emulator läuft bereits.');
  }

  const env = { ...process.env, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' };

  console.log(`Führe aus: ${TEST_COMMAND}`);
  const testProcess = spawn(TEST_COMMAND, { env, stdio: 'inherit', shell: true });

  testProcess.on('close', (code) => {
    if (emulatorProcess) {
      console.log('Stoppe Emulator...');
      emulatorProcess.kill();
    }
    process.exit(code);
  });
}

run();
