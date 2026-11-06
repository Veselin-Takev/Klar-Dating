// @vitest-environment node
// VES-5: Firestore emulator ONLY. No Storage calls, no production IAM/ADC.
import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, type DocumentReference, type Firestore } from 'firebase-admin/firestore';
import {
  initialVerificationEventFence,
  parsePersistedVerificationPurgeFence,
  reserveVerificationPurgeEvent,
  transactVerificationEventDecision,
  transactVerificationEventLegalHold,
} from '../src/server/platform/verificationPurgeFirestoreFence';

const emulator = process.env.FIRESTORE_EMULATOR_HOST ?? '';
const required = process.env.KLAR_REQUIRE_FIRESTORE_EMULATOR === '1';
if (required && !emulator) throw Error('fence_firestore_emulator_required');
if (emulator) {
  const config = JSON.parse(readFileSync(required ? 'firebase.pruefung.json' : 'firebase.json', 'utf8'));
  const local = /^(localhost|127\.0\.0\.1|\[::1\]):([0-9]{1,5})$/.exec(emulator);
  const projectIds = [process.env.GCLOUD_PROJECT, process.env.GOOGLE_CLOUD_PROJECT,
    process.env.FIREBASE_PROJECT_ID].filter(Boolean);
  if (!local || Number(local[2]) !== config?.emulators?.firestore?.port
    || projectIds.some(x => x !== 'demo-klar') || process.env.NODE_ENV === 'production'
    || process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK === 'true') {
    throw Error('fence_emulator_unsafe_target');
  }
}
const suite = emulator ? describe : describe.skip;

suite('VES-5: transaction-backed Firestore fence, staging-only integration contract', () => {
  const app = initializeApp({ projectId: 'demo-klar' }, 'fence-txn-' + randomUUID());
  const db = getFirestore(app, 'verification-purge-fence-tests');
  afterAll(async () => { await deleteApp(app); });

  async function withEvent(body: (ref: DocumentReference, db: Firestore) => Promise<void>,
    state: 'approved' | 'pending' | 'rejected' = 'approved',
  ) {
    const suffix = randomUUID().replace(/-/g, '');
    const ref = db.collection('verification_events').doc('fence-' + suffix);
    const uid = 'owner-' + suffix;
    await ref.set({
      uid, storagePath: 'verification/' + uid + '/capture.jpg',
      status: state, entscheidung: state === 'approved' ? 'bestaetigt'
        : state === 'rejected' ? 'abgelehnt' : 'in_pruefung',
      photoPurged: false, photoPurgeFence: initialVerificationEventFence(state),
    });
    try { await body(ref, db); } finally { await ref.delete(); }
  }

  it('persists a monotonic GCS-generation permit and rejects post-claim decision AND legal hold writes', async () => {
    await withEvent(async (ref) => {
      const permit = randomUUID();
      const reserved = await reserveVerificationPurgeEvent(db, ref, permit, '733');
      expect(reserved).toMatchObject({ phase: 'deleting', epoch: 1, permitId: permit, generation: '733' });
      await expect(transactVerificationEventDecision(db, ref, 'pending'))
        .rejects.toThrow('verification_purge_fence_busy');
      await expect(transactVerificationEventLegalHold(db, ref))
        .rejects.toThrow('verification_purge_hold_requires_storage_interlock');
      const data = (await ref.get()).data();
      expect(data?.status).toBe('approved');
      expect(data?.entscheidung).toBe('bestaetigt');
      expect(data?.photoPurgeFence).toMatchObject({ phase: 'deleting', permitId: permit });
      expect(data?.photoPurgeProof).toBeUndefined();
      expect(data?.photoPurged).toBe(false);
    });
  });

  it('a legal hold committed first blocks subsequent permit reservation', async () => {
    await withEvent(async (ref) => {
      const hold = await transactVerificationEventLegalHold(db, ref);
      expect(hold).toMatchObject({ phase: 'open', epoch: 1, legalHold: true });
      await expect(reserveVerificationPurgeEvent(db, ref, randomUUID(), '100'))
        .rejects.toThrow('verification_purge_fence_legal_hold');
      expect((await ref.get()).data()?.photoPurgeFence)
        .toMatchObject({ phase: 'open', legalHold: true, epoch: 1 });
    });
  });

  it('a revocation committed first blocks the delete reservation', async () => {
    await withEvent(async (ref) => {
      const updated = await transactVerificationEventDecision(db, ref, 'pending');
      expect(updated.epoch).toBe(1);
      expect(updated.decision).toBe('pending');
      const snap = (await ref.get()).data();
      expect(snap).toMatchObject({
        entscheidung: 'in_pruefung', status: 'pending',
        photoPurgeFence: { phase: 'open', epoch: 1, decision: 'pending' },
      });
      await expect(reserveVerificationPurgeEvent(db, ref, randomUUID(), '200'))
        .rejects.toThrow('verification_purge_fence_decision_pending');
    });
  });

  it('rejects duplicate concurrent reserve attempts on the exact same document', async () => {
    await withEvent(async (ref) => {
      const one = randomUUID(), two = randomUUID();
      const attempts = await Promise.allSettled([
        reserveVerificationPurgeEvent(db, ref, one, '300'),
        reserveVerificationPurgeEvent(db, ref, two, '300'),
      ]);
      expect(attempts.filter(x => x.status === 'fulfilled')).toHaveLength(1);
      expect(attempts.filter(x => x.status === 'rejected')).toHaveLength(1);
      const current = parsePersistedVerificationPurgeFence((await ref.get()).data()?.photoPurgeFence);
      expect(current).toMatchObject({ phase: 'deleting', epoch: 1, generation: '300' });
      expect((current as { permitId: string }).permitId).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  it('refuses to auto-migrate a legacy record without the fencing field', async () => {
    await withEvent(async (ref) => {
      await ref.update({ photoPurgeFence: FieldValue.delete() });
      await expect(reserveVerificationPurgeEvent(db, ref, randomUUID(), '400'))
        .rejects.toThrow('verification_purge_fence_not_initialized');
      await expect(transactVerificationEventDecision(db, ref, 'pending'))
        .rejects.toThrow('verification_purge_fence_not_initialized');
    });
  });

  it('refuses silent decision drift by an uncoordinated admin writer', async () => {
    await withEvent(async (ref) => {
      await ref.update({ entscheidung: 'abgelehnt', status: 'rejected' });
      await expect(reserveVerificationPurgeEvent(db, ref, randomUUID(), '500'))
        .rejects.toThrow('verification_purge_fence_decision_drift');
      await expect(transactVerificationEventLegalHold(db, ref))
        .rejects.toThrow('verification_purge_fence_decision_drift');
    });
  });


  it('characterizes a noncompliant Admin SDK writer bypassing the reserved fence (P0 still open)', async () => {
    await withEvent(async (ref) => {
      const permit = randomUUID();
      await reserveVerificationPurgeEvent(db, ref, permit, '733');
      // Simulates an existing privileged writer that bypasses the coordinator.
      // This is an intentional vulnerability-characterization regression:
      // Firestore's same-document fencing alone cannot stop uncoordinated writes.
      await ref.update({ entscheidung: 'abgelehnt', status: 'rejected' });
      const data = (await ref.get()).data();
      expect(data?.photoPurgeFence).toMatchObject({
        phase: 'deleting', permitId: permit, decision: 'approved', generation: '733',
      });
      expect(data?.entscheidung).toBe('abgelehnt');
      expect(data?.status).toBe('rejected');
      await expect(transactVerificationEventLegalHold(db, ref))
        .rejects.toThrow('verification_purge_fence_decision_drift');
      // No physical delete is attempted; the lesson is that ALL real writers
      // must be migrated and constrained by independently verified IAM.
    });
  });

  it('characterizes an uncoordinated legal-hold acknowledgement after deletion reservation (P0 open)', async () => {
    await withEvent(async (ref) => {
      const permit = randomUUID();
      await reserveVerificationPurgeEvent(db, ref, permit, '734');
      // A privileged external writer can bypass the transactional coordinator.
      // This deliberately demonstrates a false effective hold acknowledgement.
      await ref.update({ photoPurgeFence: {
        phase: 'open', epoch: 2, decision: 'approved', legalHold: true,
      } });
      const data = (await ref.get()).data();
      expect(data?.photoPurgeFence).toMatchObject({ phase: 'open', legalHold: true });
      expect(data?.photoPurged).toBe(false);
      // The already-issued generation-bound GCS permit is not canceled by
      // overwriting Firestore state. No physical Storage delete is attempted.
      await expect(reserveVerificationPurgeEvent(db, ref, randomUUID(), '734'))
        .rejects.toThrow('verification_purge_fence_legal_hold');
    });
  });

  it('never acknowledges a permit if owner path is inconsistent', async () => {
    await withEvent(async (ref) => {
      await ref.update({ storagePath: 'verification/other-person/private.jpg' });
      await expect(reserveVerificationPurgeEvent(db, ref, randomUUID(), '600'))
        .rejects.toThrow('verification_purge_fence_invalid_owner_path');
    });
  });

  it('rejects wrong collection, missing record and malformed state before writes', async () => {
    const wrong = db.collection('users').doc('fence-' + randomUUID());
    await expect(reserveVerificationPurgeEvent(db, wrong, randomUUID(), '700'))
      .rejects.toThrow('verification_purge_fence_wrong_collection');
    const missing = db.collection('verification_events').doc('missing-' + randomUUID());
    await expect(reserveVerificationPurgeEvent(db, missing, randomUUID(), '700'))
      .rejects.toThrow('verification_purge_fence_not_initialized');
    await withEvent(async (ref) => {
      await ref.update({ photoPurgeFence: { phase: 'deleting', epoch: -1, permitId: randomUUID() } });
      await expect(transactVerificationEventLegalHold(db, ref))
        .rejects.toThrow('verification_purge_fence_record_invalid');
    });
  });
});
