// @vitest-environment node
/**
 * P0 #254: native Firebase Storage Rules emulator evidence.
 * Legacy profile photos intentionally remain readable to any signed-in user,
 * including a different tenant claim: NOT proof of safe tenant media cutover.
 */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { getAppBucket } from '../src/server/storage';

const host = process.env.FIREBASE_STORAGE_EMULATOR_HOST || '';
const match = /^(127\.0\.0\.1|localhost|\[::1\]):(\d{2,5})$/.exec(host);
const emulatorOnly = !!match && Number(match[2]) > 0 && Number(match[2]) < 65536 &&
  (!process.env.GCLOUD_PROJECT || process.env.GCLOUD_PROJECT === 'demo-klar') &&
  (!process.env.GOOGLE_CLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT === 'demo-klar');
const owner = 'tenant-owner-' + randomUUID().replaceAll('-', '');
const other = 'tenant-outsider-' + randomUUID().replaceAll('-', '');
const image = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
let env: RulesTestEnvironment;
const storage = (uid: string, tenantId: string) =>
  env.authenticatedContext(uid, { tenantId, firebase: { sign_in_provider: 'password' } })
    .storage('gs://demo-klar.appspot.com');

describe.skipIf(!emulatorOnly)('P0 #254 native Storage Rules tenant claims: legacy media / tenant cutover blocked', () => {
  beforeAll(async () => {
    if (!match) throw new Error('tenant_storage_loopback_required');
    env = await initializeTestEnvironment({
      projectId: 'demo-klar',
      storage: { rules: readFileSync('storage.rules', 'utf8'), host: match[1], port: Number(match[2]) },
    });
  });
  afterAll(async () => { await env?.cleanup(); });

  it('legacy public profile photo remains readable across different tenant claims (cutover gap)', async () => {
    const path = `profiles/${owner}/tenant-profile.jpg`;
    await assertSucceeds(Promise.resolve(storage(owner, 'tenant-alpha').ref(path)
      .put(image, { contentType: 'image/jpeg' })));
    try {
      await assertSucceeds(storage(other, 'tenant-beta').ref(path).getDownloadURL());
      await assertFails(env.unauthenticatedContext().storage('gs://demo-klar.appspot.com')
        .ref(path).getDownloadURL());
    } finally {
      await assertSucceeds(storage(owner, 'tenant-alpha').ref(path).delete());
    }
    // An intentional public profile image under legacy Rules, not tenant-scoped.
  }, 20_000);

  it('cross-tenant outsider cannot overwrite or delete another UID profile picture', async () => {
    const path = `profiles/${owner}/tenant-guard.jpg`;
    await assertSucceeds(Promise.resolve(storage(owner, 'tenant-alpha').ref(path)
      .put(image, { contentType: 'image/jpeg' })));
    try {
      await assertFails(Promise.resolve(storage(other, 'tenant-beta').ref(path)
        .put(image, { contentType: 'image/jpeg' })));
      await assertFails(storage(other, 'tenant-beta').ref(path).delete());
    } finally {
      await assertSucceeds(storage(owner, 'tenant-alpha').ref(path).delete());
    }
  }, 20_000);

  it('biometric verification image cannot be read by its owner or other tenant', async () => {
    const path = `verification/${owner}/tenant-verification.jpg`;
    const file = getAppBucket().file(path);
    // Seed by Admin SDK ONLY in the local Storage emulator, not client permissions.
    await file.save(image, { metadata: { contentType: 'image/jpeg' } });
    try {
      await assertFails(storage(owner, 'tenant-alpha').ref(path).getDownloadURL());
      await assertFails(storage(other, 'tenant-beta').ref(path).getDownloadURL());
      await assertFails(storage(owner, 'tenant-alpha').ref(path).delete());
    } finally {
      await file.delete();
    }
  }, 20_000);

  it('new tenant-prefixed profile object is inaccessible even to same-tenant owner (not cut over)', async () => {
    const path = `tenants/tenant-alpha/profiles/${owner}/photo.jpg`;
    const file = getAppBucket().file(path);
    await file.save(image, { metadata: { contentType: 'image/jpeg' } });
    try {
      await assertFails(storage(owner, 'tenant-alpha').ref(path).getDownloadURL());
      await assertFails(storage(other, 'tenant-beta').ref(path).getDownloadURL());
      await assertFails(Promise.resolve(storage(owner, 'tenant-alpha').ref(path)
        .put(image, { contentType: 'image/jpeg' })));
    } finally {
      await file.delete();
    }
  }, 20_000);
});
