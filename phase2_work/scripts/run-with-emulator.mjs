import { spawn } from 'child_process';
import net from 'net';

const EMULATOR_PORT = 8080;
const testArgv = process.argv.length > 2 ? process.argv.slice(2) : [process.execPath, 'node_modules/vitest/vitest.mjs', 'run', 'tests/rules.spec.ts'];

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
    emulatorProcess = spawn('firebase', ['emulators:start', '--project', 'demo-klar', '--only', 'firestore'], {
      stdio: 'inherit',
      shell: false,
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

  const env = { ...process.env, GCLOUD_PROJECT: 'demo-klar', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' };

  console.log('Starte isolierten Testprozess.');
  const testProcess = spawn(testArgv[0], testArgv.slice(1), { env, stdio: 'inherit', shell: false });

  testProcess.on('error', error => { if (emulatorProcess) emulatorProcess.kill(); console.error('Testprozess nicht verfügbar:', error.code); process.exitCode = 1; });
  testProcess.on('close', (code) => {
    if (emulatorProcess) {
      console.log('Stoppe Emulator...');
      emulatorProcess.kill();
    }
    process.exit(code);
  });
}

run();
