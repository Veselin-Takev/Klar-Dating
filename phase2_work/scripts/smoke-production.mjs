import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Production smoke test requires isolated emulators');
const child = spawn(process.execPath, ['dist/server.cjs'], { env: { ...process.env, NODE_ENV: 'production', VITE_EMULATOR: 'false', PORT: '3100' }, stdio: 'inherit' });
try {
  const deadline = Date.now() + 20_000;
  let ready = false;
  while (Date.now() < deadline && child.exitCode === null) {
    try { ready = (await fetch('http://127.0.0.1:3100/api/ready')).status === 200; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert(ready, 'Built server must start and become ready');
  for (const path of ['/', '/profile']) {
    const res = await fetch(`http://127.0.0.1:3100${path}`);
    assert.equal(res.status, 200); assert.match(res.headers.get('content-type'), /html/);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
  }
  console.log('Production smoke passed: startup, readiness, SPA routes, CSP, no-store.');
} finally {
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
  if (child.exitCode === null) await new Promise(resolve => child.once('exit', resolve));
  clearTimeout(timer);
}
