// Test orchestration only: do not let fast native HTTP suites race API startup.
for (const key of ['FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST']) {
  if (!/^(?:127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(process.env[key] || '')) {
    throw new Error('API test readiness requires isolated loopback emulators');
  }
}
const deadline = Date.now() + 45_000;
let ready = false;
while (Date.now() < deadline) {
  try {
    ready = (await fetch('http://127.0.0.1:3000/api/ready', {signal:AbortSignal.timeout(2_000)})).status === 200;
  } catch {}
  if (ready) break;
  await new Promise(resolve => setTimeout(resolve, 100));
}
if (!ready) throw new Error('Local test API did not become ready within 45 seconds');
console.log('Local test API readiness confirmed.');
