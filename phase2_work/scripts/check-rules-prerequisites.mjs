import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function fail(reason) {
  console.error('Firestore rules prerequisites FAILED: ' + reason);
  process.exitCode = 1;
}
const [major, minor, patch] = process.versions.node.split('.').map(Number);
if (major !== 22 || minor < 23 || (minor === 23 && patch < 3)) {
  fail('Node >=22.23.3 on Node 22 is required; run nvm use from phase2_work.');
} else if (!existsSync(path.join(root, 'node_modules/firebase-tools/lib/bin/firebase.js'))) {
  fail('Local firebase-tools is missing; run npm ci in phase2_work.');
} else {
  const java = spawnSync('java', ['-version'], { encoding: 'utf8', timeout: 10_000 });
  const output = String(java.stdout ?? '') + '\n' + String(java.stderr ?? '');
  // Java 21+: both legacy "21.0.4" and current openjdk 21 202x formats.
  const match = output.match(/(?:openjdk|java)\s+version\s+"(\d+)|(?:openjdk|java)\s+(\d+)(?:[.\s])/i);
  const majorJava = Number(match?.[1] ?? match?.[2]);
  if (java.error || java.status !== 0 || !Number.isInteger(majorJava) || majorJava < 21) {
    fail('Java 21+ is required; check java -version and JAVA_HOME/PATH.');
  } else {
    console.log('Firestore rules prerequisites PASS: Node ' + process.versions.node + ', Java ' + majorJava + ', local Firebase CLI.');
  }
}
