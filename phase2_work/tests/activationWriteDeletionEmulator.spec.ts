// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDb } from '../src/server/db';
import { recordActivation } from '../src/server/platform/launchPlatform';

// Fail closed before any Admin SDK client can be constructed. A local demo
// project and the exact repository emulator port are mandatory.
const host = process.env.FIRESTORE_EMULATOR_HOST ?? '';
if (host || process.env.KLAR_REQUIRE_FIRESTORE_EMULATOR === '1') {
  const configName = process.env.KLAR_REQUIRE_FIRESTORE_EMULATOR === '1'
    ? 'firebase.pruefung.json' : 'firebase.json';
  const config = JSON.parse(readFileSync(resolve(process.cwd(), configName), 'utf8'));
  const local = /^(localhost|127\\.0\\.0\\.1|\\[::1\\]):([0-9]{1,5})$/.exec(host);
  const ids = [process.env.GCLOUD_PROJECT, process.env.GOOGLE_CLOUD_PROJECT, process.env.FIREBASE_PROJECT_ID].filter(Boolean);
  if (!local || Number(local[2]) !== config?.emulators?.firestore?.port
    || ids.some(id => id !== 'demo-klar')
    || process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK === 'true'
    || process.env.NODE_ENV === 'production') {
    throw new Error('activation_write_firestore_emulator_unsafe_target');
  }
}

describe.skipIf(!host)('activation write / account deletion (real Firestore emulator)', () => {
  const created: string[] = [];
  afterEach(async () => {
    const db = getDb();
    await Promise.all(created.splice(0).map(path => db.doc(path).delete()));
  });

  it('denies new events for an existing deletion marker without a partial write', async () => {
    const db = getDb();
    const uid = 'activation-delete-' + randomUUID();
    const eventId = 'activation-' + randomUUID();
    const deletion = db.collection('account_deletions').doc(uid);
    const event = db.collection('activation_events').doc(eventId);
    created.push(deletion.path, event.path);
    await deletion.create({ status: 'pending' });
    await expect(recordActivation(db, uid, 'first_contact', eventId))
      .rejects.toThrow('Account deletion pending');
    expect((await event.get()).exists).toBe(false);
  }, 90_000);

  it('permits creation for active accounts, but rejects replay of the same event ID', async () => {
    const db = getDb();
    const uid = 'activation-active-' + randomUUID();
    const eventId = 'activation-' + randomUUID();
    const event = db.collection('activation_events').doc(eventId);
    created.push(event.path);
    const result = await recordActivation(db, uid, 'first_contact', eventId, { step: 'launch' });
    expect(result.eventId).toBe(eventId);
    expect((await event.get()).data()).toMatchObject({
      uid, eventName: 'first_contact', metadata: { step: 'launch' },
    });
    await expect(recordActivation(db, uid, 'first_contact', eventId)).rejects.toThrow();
    expect((await event.get()).data()?.eventName).toBe('first_contact');
  }, 90_000);

  it('refuses an event after a previously active account enters deletion', async () => {
    const db = getDb();
    const uid = 'activation-transition-' + randomUUID();
    const firstId = 'activation-' + randomUUID();
    const lateId = 'activation-' + randomUUID();
    const first = db.collection('activation_events').doc(firstId);
    const late = db.collection('activation_events').doc(lateId);
    const deletion = db.collection('account_deletions').doc(uid);
    created.push(first.path, late.path, deletion.path);
    await recordActivation(db, uid, 'first_contact', firstId);
    await deletion.create({ status: 'pending' });
    await expect(recordActivation(db, uid, 'first_conversation', lateId))
      .rejects.toThrow('Account deletion pending');
    expect((await first.get()).exists).toBe(true);
    expect((await late.get()).exists).toBe(false);
  }, 90_000);
});
