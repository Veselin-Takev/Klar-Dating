// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  assertVerificationPurgeDeletePermit,
  changeVerificationPurgeDecision,
  completeVerificationPurgeFence,
  initialVerificationPurgeFence,
  placeVerificationPurgeLegalHold,
  releaseVerificationPurgeLegalHold,
  startVerificationPurgeFence,
  type VerificationPurgeFence,
} from '../src/server/platform/verificationPurgeFence';

describe('VES-5 design contract: durable all-writer purge fence (not production-wired)', () => {
  const goodDigest = 'a'.repeat(64);

  it('blocks a decision revocation that arrives AFTER final authorization but BEFORE physical deletion', async () => {
    // This models a protocol in which every decision writer uses one
    // transactionally persisted state. It is not an emulator/live proof.
    let state: VerificationPurgeFence = initialVerificationPurgeFence('approved');
    const permitId = randomUUID();
    state = startVerificationPurgeFence(state, permitId, '112');
    const fenceEpoch = state.epoch;
    assertVerificationPurgeDeletePermit(state, permitId, '112');

    let unblock!: () => void;
    const inFlight = new Promise<void>(resolve => { unblock = resolve; });
    let ready!: () => void;
    const started = new Promise<void>(resolve => { ready = resolve; });
    let deleted = false;
    const worker = (async () => {
      ready(); // barrier: the worker has checked its permit
      await inFlight; // simulated asynchronous Storage request delay
      assertVerificationPurgeDeletePermit(state, permitId, '112');
      deleted = true;
      state = completeVerificationPurgeFence(state, permitId, '112', goodDigest);
    })();

    await started;
    // The moderation writer must NOT acknowledge a pending decision while
    // its deletion permit is in-flight. Otherwise GCS generation CAS is not
    // a protection against the Firestore change.
    expect(() => changeVerificationPurgeDecision(state, 'pending'))
      .toThrow('verification_purge_fence_busy');
    expect(state).toMatchObject({
      phase: 'deleting', epoch: fenceEpoch, decision: 'approved',
    });
    unblock();
    await worker;
    expect(deleted).toBe(true);
    expect(state).toMatchObject({ phase: 'deleted', decision: 'approved' });
    // This model cannot permit a post-delete decision mutation which would
    // misrepresent an already removed object as a pending verification.
    expect(() => changeVerificationPurgeDecision(state, 'pending'))
      .toThrow('verification_purge_fence_already_deleted');
  });

  it('never accepts a new physical delete when an effective legal hold is present', () => {
    const held = placeVerificationPurgeLegalHold(initialVerificationPurgeFence('approved'));
    expect(held).toMatchObject({ phase: 'open', legalHold: true, epoch: 1 });
    expect(() => startVerificationPurgeFence(held, randomUUID(), '8'))
      .toThrow('verification_purge_fence_legal_hold');
  });

  it('rejects an in-flight legal-hold acknowledgement until Storage coordination exists', () => {
    const deleting = startVerificationPurgeFence(
      initialVerificationPurgeFence('rejected'), randomUUID(), '203',
    );
    expect(() => placeVerificationPurgeLegalHold(deleting))
      .toThrow('verification_purge_hold_requires_storage_interlock');
    expect(deleting.legalHold).toBe(false);
  });

  it('requires a nonpending eligibility decision', () => {
    const pending = initialVerificationPurgeFence('pending');
    expect(() => startVerificationPurgeFence(pending, randomUUID(), '123'))
      .toThrow('verification_purge_fence_decision_pending');
  });

  it('invalidates old permits and generations and does not allow duplicate claims', () => {
    const token = randomUUID();
    const deleting = startVerificationPurgeFence(
      initialVerificationPurgeFence('approved'), token, '223',
    );
    expect(() => startVerificationPurgeFence(deleting, randomUUID(), '224'))
      .toThrow('verification_purge_fence_already_claimed');
    expect(() => assertVerificationPurgeDeletePermit(deleting, randomUUID(), '223'))
      .toThrow('verification_purge_fence_token_mismatch');
    expect(() => assertVerificationPurgeDeletePermit(deleting, token, '224'))
      .toThrow('verification_purge_fence_token_mismatch');
    const done = completeVerificationPurgeFence(deleting, token, '223', goodDigest);
    expect(done.epoch).toBe(deleting.epoch + 1);
    expect(() => assertVerificationPurgeDeletePermit(done, token, '223'))
      .toThrow('verification_purge_fence_token_mismatch');
  });

  it('keeps the persistent fence active after a simulated worker crash, even if time passes', () => {
    const token = randomUUID();
    const persisted = startVerificationPurgeFence(
      initialVerificationPurgeFence('approved'), token, '10',
    );
    // No lease-based automatic expiry or self-release exists in this API.
    // Such a release could race an in-flight, delayed GCS request.
    const laterSnapshot = { ...persisted };
    expect(() => changeVerificationPurgeDecision(laterSnapshot, 'pending'))
      .toThrow('verification_purge_fence_busy');
    expect(() => startVerificationPurgeFence(laterSnapshot, randomUUID(), '10'))
      .toThrow('verification_purge_fence_already_claimed');
  });

  it('requires valid GCS generation, token and evidence digest', () => {
    const open = initialVerificationPurgeFence('approved');
    expect(() => startVerificationPurgeFence(open, 'not-a-token', '10'))
      .toThrow('verification_purge_invalid_fence_permit');
    expect(() => startVerificationPurgeFence(open, randomUUID(), '0'))
      .toThrow('verification_purge_invalid_fence_generation');
    const token = randomUUID();
    const deleting = startVerificationPurgeFence(open, token, '10');
    expect(() => completeVerificationPurgeFence(deleting, token, '10', 'unverified'))
      .toThrow('verification_purge_invalid_receipt_digest');
  });

  it('increments a monotonic version for decision and hold changes before any permit', () => {
    const initial = initialVerificationPurgeFence('pending');
    const eligible = changeVerificationPurgeDecision(initial, 'approved');
    const held = placeVerificationPurgeLegalHold(eligible);
    const released = releaseVerificationPurgeLegalHold(held);
    expect([initial.epoch, eligible.epoch, held.epoch, released.epoch])
      .toEqual([0, 1, 2, 3]);
    expect(released).toMatchObject({ phase: 'open', decision: 'approved', legalHold: false });
    expect(startVerificationPurgeFence(released, randomUUID(), '21').epoch).toBe(4);
  });

  it('rejects version overflow before creating the next claim', () => {
    const maxEpoch = {
      phase: 'open' as const, epoch: Number.MAX_SAFE_INTEGER,
      decision: 'approved' as const, legalHold: false,
    };
    expect(() => startVerificationPurgeFence(maxEpoch, randomUUID(), '30'))
      .toThrow('verification_purge_invalid_fence_epoch');
  });
});
