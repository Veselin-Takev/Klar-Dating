// @vitest-environment node
// Runs ONLY against the local demo-klar Firestore emulator. Real Firestore
// pagination proof: no Storage deletes and no production connections.
import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { FieldPath, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { readPurgeCursor, scanPurgePages, type PurgeCursor } from '../src/server/platform/verificationPurgeScan';

const endpoint = process.env.FIRESTORE_EMULATOR_HOST ?? '';
const active = Boolean(endpoint);
if (active || process.env.KLAR_REQUIRE_FIRESTORE_EMULATOR === '1') {
  const profile = process.env.KLAR_REQUIRE_FIRESTORE_EMULATOR === '1'
    ? 'firebase.pruefung.json' : 'firebase.json';
  const config = JSON.parse(readFileSync(profile, 'utf8'));
  const address = /^(localhost|127\.0\.0\.1|\[::1\]):([0-9]{1,5})$/.exec(endpoint);
  const ids = [process.env.GCLOUD_PROJECT, process.env.GOOGLE_CLOUD_PROJECT, process.env.FIREBASE_PROJECT_ID].filter(Boolean);
  if (!address || Number(address[2]) !== config?.emulators?.firestore?.port
    || ids.some(id => id !== 'demo-klar')
    || process.env.NODE_ENV === 'production'
    || process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK === 'true') {
    throw Error('verification_purge_emulator_unsafe_target');
  }
}

describe.skipIf(!active)('verification photo purge cursor: real Firestore Emulator', () => {
  it('reads 127 due events past 100 stale records and resumes after a checkpoint', async () => {
    const suffix = randomUUID().replace(/-/g, '');
    const app = initializeApp({ projectId: 'demo-klar' }, 'purge-cursor-' + suffix);
    const db = getFirestore(app, 'verification-purge-integration');
    const prefix = 'cursor-' + suffix + '-';
    const docs = Array.from({ length: 127 }, (_, i) => ({
      ref: db.collection('verification_events').doc(prefix + String(i).padStart(3, '0')),
      due: Timestamp.fromMillis(Date.now() - (128 - i) * 60_000),
      old: i < 100,
    }));
    const checkpointRef = db.collection('system').doc('checkpoint-' + suffix);
    try {
      const batch = db.batch();
      for (const item of docs) {
        batch.set(item.ref, {
          fotoLoeschenAb: item.due, photoPurged: item.old,
          // No photo path: this test never invokes any Storage deletion.
          uid: 'emulator-fixture', status: 'approved',
        });
      }
      await batch.commit();
      const seen: string[] = [];
      async function scan(initial: PurgeCursor | null) {
        return scanPurgePages({
          initial, pageSize: 25, maxPages: 4,
          fetch: async (after, pageSize) => {
            let query = db.collection('verification_events')
              .where('fotoLoeschenAb', '<=', new Date())
              .orderBy('fotoLoeschenAb')
              .orderBy(FieldPath.documentId());
            if (after) query = query.startAfter(new Timestamp(after.seconds, after.nanos), after.id);
            const page = await query.limit(pageSize).get();
            return page.docs.map(doc => {
              const due = doc.get('fotoLoeschenAb') as Timestamp;
              const cursor = readPurgeCursor({
                seconds: due.seconds, nanos: due.nanoseconds, id: doc.id,
              });
              if (!cursor) throw Error('emulator_due_cursor_invalid');
              return { cursor, value: doc };
            });
          },
          handle: async page => {
            seen.push(...page.map(doc => doc.id));
            // The first 100 are marked already purged; an unsafe first-page
            // scanner would starve the remaining 27 forever. Read only.
            return { purged: 0, skipped: page.length, failed: 0 };
          },
          checkpoint: async cursor => { await checkpointRef.set({ cursor }); },
        });
      }
      const first = await scan(null);
      expect(first).toMatchObject({ scanned: 100, pages: 4, hasMore: true });
      const saved = (await checkpointRef.get()).data()?.cursor;
      const cursor = readPurgeCursor(saved);
      expect(cursor?.id).toBe(docs[99]!.ref.id);

      // Simulate a process restart: resume from the persisted Firestore
      // checkpoint, not from an in-memory continuation variable.
      const second = await scan(cursor);
      expect(second).toMatchObject({ scanned: 27, pages: 2, hasMore: false });
      expect((await checkpointRef.get()).data()?.cursor).toBeNull();
      expect(seen).toHaveLength(127);
      expect(new Set(seen).size).toBe(127);
      expect(seen).toEqual(docs.map(item => item.ref.id));
      expect((await docs[126]!.ref.get()).exists).toBe(true);
    } finally {
      // Only test-owned documents in an isolated named emulator database.
      const cleanup = db.batch();
      for (const item of docs) cleanup.delete(item.ref);
      cleanup.delete(checkpointRef);
      try { await cleanup.commit(); } finally { await deleteApp(app); }
    }
  }, 120_000);
});
