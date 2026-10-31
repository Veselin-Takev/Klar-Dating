// Offline mutation regression for retired biometric routes and Storage Rules.
// Only fixture strings are modified; no cloud/emulator data is accessed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyLegacyVerificationWriterFence } from './check-legacy-verification-writer-fence.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baseline = {
  routes: readFileSync(resolve(root, 'src/server/verification-routes.ts'), 'utf8'),
  server: readFileSync(resolve(root, 'server.ts'), 'utf8'),
  rules: readFileSync(resolve(root, 'storage.rules'), 'utf8'),
};

test('legacy manual verification stays retired and biometric client Storage stays inaccessible', () => {
  assert.doesNotThrow(() => verifyLegacyVerificationWriterFence(baseline));
});

for (const [caseName, mutation] of [
  ['re-enable a retired submit path', { routes: baseline.routes.replace("'/submit'", "'/not-submit'") }],
  ['only reject POST but not all HTTP methods', { routes: baseline.routes.replace('verificationRouter.all(path', 'verificationRouter.post(path') }],
  ['return HTTP 200 from retired endpoints', { routes: baseline.routes.replace('res.status(410)', 'res.status(200)') }],
  ['remove router mount', { server: baseline.server.replace('app.use("/api/verification", verificationRouter)', 'app.use("/api/verification", Router())') }],
  ['reactivate legacy manual upload handler', { server: baseline.server + '\\nhandleVerificationSubmit(req, res);' }],
  ['allow client verification uploads', { rules: baseline.rules.replace('allow create, update: if false;', 'allow create, update: if request.auth != null;') }],
  ['allow client biometric reads', { rules: baseline.rules.replace('allow read: if false;', 'allow read: if request.auth != null;') }],
  ['allow client biometric deletes', { rules: baseline.rules.replace('allow delete: if false;', 'allow delete: if request.auth != null;') }],
]) {
  test('fail closed on mutation: ' + caseName, () => {
    const changed = { ...baseline, ...mutation };
    assert.notDeepEqual(changed, baseline, 'fixture mutation must change its source');
    assert.throws(() => verifyLegacyVerificationWriterFence(changed));
  });
}
