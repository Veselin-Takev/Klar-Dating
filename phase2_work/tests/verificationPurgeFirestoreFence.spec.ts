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
    const now = Date.now();
    await ref.set({
      uid, storagePath: 'verification/' + uid + '/capture.jpg',
      // Deliberately due: 30 days elapsed and scheduled expiry in the past.
      decidedAt: new Date(now - 31 * 86_400_000),
      fotoLoeschenAb: new Date(now - 86_400_000),
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
      expect(data?.photoPurgeIntent).toMatchObject({
        generation: '733', storagePath: data?.storagePath, status: 'approved',
        decidedAt: expect.any(Number), permitId: permit, fenceEpoch: 1,
      });
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

  it('refuses an early, not-yet-expired decision even if a due-date field is forged', async () => {
    await withEvent(async (ref) => {
      await ref.update({ decidedAt: new Date(Date.now() - 86_400_000) });
      await expect(reserveVerificationPurgeEvent(db, ref, randomUUID(), '701'))
        .rejects.toThrow('verification_purge_fence_retention_not_due');
      const snap = (await ref.get()).data();
      expect(snap?.photoPurgeFence).toMatchObject({ phase: 'open', epoch: 0 });
      expect(snap?.photoPurgeIntent).toBeUndefined();
    });
  });

  it('rejects future decision time even when due schedule is in the past', async () => {
    await withEvent(async (ref) => {
      const now = Date.now();
      await ref.update({
        decidedAt: new Date(now + 86_400_000),
        fotoLoeschenAb: new Date(now - 86_400_000),
      });
      await expect(reserveVerificationPurgeEvent(db, ref, randomUUID(), '720'))
        .rejects.toThrow('verification_purge_fence_retention_not_due');
      const data = (await ref.get()).data();
      expect(data?.photoPurgeFence).toMatchObject({ phase: 'open', epoch: 0 });
      expect(data?.photoPurgeIntent).toBeUndefined();
    });
  });

  it('refuses a future scheduled retention date even when 30 days have elapsed', async () => {
    await withEvent(async (ref) => {
      await ref.update({ fotoLoeschenAb: new Date(Date.now() + 86_400_000) });
      await expect(reserveVerificationPurgeEvent(db, ref, randomUUID(), '702'))
        .rejects.toThrow('verification_purge_fence_retention_not_due');
      expect((await ref.get()).data()?.photoPurgeIntent).toBeUndefined();
    });
  });

  it('refuses invalid or absent retention dates rather than trusting a caller clock', async () => {
    await withEvent(async (ref) => {
      await ref.update({ fotoLoeschenAb: FieldValue.delete() });
      await expect(reserveVerificationPurgeEvent(db, ref, randomUUID(), '703'))
        .rejects.toThrow('verification_purge_fence_retention_not_due');
    });
    await withEvent(async (ref) => {
      await ref.update({ decidedAt: 'not-a-date' });
      await expect(reserveVerificationPurgeEvent(db, ref, randomUUID(), '704'))
        .rejects.toThrow('verification_purge_fence_retention_not_due');
    });
  });

  it('does not reserve a purge for a previously purged or ambiguously recorded object', async () => {
    await withEvent(async (ref) => {
      await ref.update({ photoPurged: true });
      await expect(reserveVerificationPurgeEvent(db, ref, randomUUID(), '705'))
        .rejects.toThrow('verification_purge_already_completed_or_ambiguous');
    });
    await withEvent(async (ref) => {
      await ref.update({ photoPurgeProof: { generation: '100' } });
      await expect(reserveVerificationPurgeEvent(db, ref, randomUUID(), '706'))
        .rejects.toThrow('verification_purge_already_completed_or_ambiguous');
    });
  });

  it('never replaces a conflicting durable intent with a new GCS generation', async () => {
    await withEvent(async (ref) => {
      const data = (await ref.get()).data()!;
      await ref.update({
        photoPurgeIntent: {
          generation: '801', storagePath: data.storagePath,
          decidedAt: data.decidedAt.toMillis(), status: 'approved',
          preparedAt: new Date(),
        },
      });
      await expect(reserveVerificationPurgeEvent(db, ref, randomUUID(), '802'))
        .rejects.toThrow('verification_purge_fence_prior_intent_requires_reconciliation');
      expect((await ref.get()).data()?.photoPurgeFence)
        .toMatchObject({ phase: 'open', epoch: 0 });
      expect((await ref.get()).data()?.photoPurgeIntent.generation).toBe('801');
    });
  });

  it('refuses to silently reuse a matching legacy intent with a new token', async () => {
    await withEvent(async (ref) => {
      const data = (await ref.get()).data()!;
      const preparedAt = new Date(Date.now() - 20_000);
      await ref.update({
        photoPurgeIntent: {
          generation: '810', storagePath: data.storagePath,
          decidedAt: data.decidedAt.toMillis(), status: 'approved', preparedAt,
        },
      });
      const token = randomUUID();
      await expect(reserveVerificationPurgeEvent(db, ref, token, '810'))
        .rejects.toThrow('verification_purge_fence_prior_intent_requires_reconciliation');
      const final = (await ref.get()).data()!;
      expect(final.photoPurgeFence).toMatchObject({ phase: 'open', epoch: 0 });
      expect(final.photoPurgeIntent).toMatchObject({ generation: '810', status: 'approved' });
      expect(final.photoPurgeIntent.preparedAt.toMillis()).toBe(preparedAt.getTime());
      expect(final.photoPurgeIntent.permitId).toBeUndefined();
    });
  });

  it('refuses any prior intent even when its metadata is empty or a null marker', async () => {
    await withEvent(async (ref) => {
      await ref.update({ photoPurgeIntent: null });
      await expect(reserveVerificationPurgeEvent(db, ref, randomUUID(), '820'))
        .rejects.toThrow('verification_purge_fence_prior_intent_requires_reconciliation');
      expect((await ref.get()).data()?.photoPurgeFence)
        .toMatchObject({ phase: 'open', epoch: 0 });
    });
  });

  it('a worker retry never issues a different permit for an unresolved deleting state', async () => {
    await withEvent(async (ref) => {
      const first = randomUUID();
      await reserveVerificationPurgeEvent(db, ref, first, '830');
      await expect(reserveVerificationPurgeEvent(db, ref, randomUUID(), '830'))
        .rejects.toThrow('verification_purge_fence_already_claimed');
      const state = (await ref.get()).data()!;
      expect(state.photoPurgeFence).toMatchObject({
        phase: 'deleting', permitId: first, epoch: 1,
      });
      expect(state.photoPurgeIntent).toMatchObject({
        generation: '830', permitId: first, fenceEpoch: 1,
      });
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
