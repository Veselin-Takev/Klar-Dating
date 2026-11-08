// Test orchestration only: do not let fast native HTTP suites race API startup.
import { get } from 'node:http';
for (const key of ['FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST']) {
  if (!/^(?:127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(process.env[key] || '')) {
    throw new Error('API test readiness requires isolated loopback emulators');
  }
}
const deadline = Date.now() + 45_000;
let ready = false;
while (Date.now() < deadline) {
  try {
    // Intentional public health probe to literal loopback, without credentials.
    // Use Node's transport; this is not a browser/application network request.
    ready = await new Promise(resolve => {
      const request = get({hostname:'127.0.0.1',port:3000,path:'/api/ready'}, response => {
        response.resume(); resolve(response.statusCode === 200);
      });
      request.setTimeout(2_000, () => request.destroy());
      request.once('error', () => resolve(false));
    });
  } catch {}
  if (ready) break;
  await new Promise(resolve => setTimeout(resolve, 100));
}
if (!ready) throw new Error('Local test API did not become ready within 45 seconds');
console.log('Local test API readiness confirmed.');
