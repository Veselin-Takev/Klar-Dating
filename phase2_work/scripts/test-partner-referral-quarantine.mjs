#!/usr/bin/env node
// Run with: node --import=tsx --test scripts/test-partner-referral-quarantine.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { quarantineOwnedPartnerReferral } from '../src/server/partnerReferralDeletion.ts';

function fakeFirestore(initial) {
  let record = initial === null ? null : { ...initial };
  let writes = 0;
  const ref = { id: 'ref-test', path: 'partner_referrals/ref-test', parent: { id: 'partner_referrals' } };
  const db = {
    async runTransaction(work) {
      const pending = [];
      const tx = {
        async get() {
          return { exists: record !== null, data: () => record ? { ...record } : undefined };
        },
        update(_ref, patch) { pending.push(patch); },
      };
      const result = await work(tx);
      for (const patch of pending) { record = { ...record, ...patch }; writes++; }
      return result;
    },
  };
  return { db, ref, getRecord: () => record, getWrites: () => writes };
}

test('quarantines an active owned referral before buyer-claim cleanup', async () => {
  const { db, ref, getRecord, getWrites } = fakeFirestore({ ownerUid: 'owner', status: 'active' });
  assert.equal(await quarantineOwnedPartnerReferral(db, ref, 'owner'), 'updated');
  assert.equal(getRecord().status, 'deleting');
  assert.equal(getWrites(), 1);
  // The conversion transaction in partnerReferralService requires status=active.
  assert.equal(getRecord().status === 'active', false);
});

test('resuming a deletion does not mutate or resurrect the tombstone', async () => {
  const state = fakeFirestore({ ownerUid: 'owner', status: 'active' });
  await quarantineOwnedPartnerReferral(state.db, state.ref, 'owner');
  assert.equal(await quarantineOwnedPartnerReferral(state.db, state.ref, 'owner'), 'already_deleting');
  assert.equal(state.getWrites(), 1);
});

test('missing referral cannot be recreated by quarantine', async () => {
  const state = fakeFirestore(null);
  assert.equal(await quarantineOwnedPartnerReferral(state.db, state.ref, 'owner'), 'missing');
  assert.equal(state.getWrites(), 0);
});

test('owner disagreement fails closed without modifying referral', async () => {
  const state = fakeFirestore({ ownerUid: 'another', status: 'active' });
  await assert.rejects(quarantineOwnedPartnerReferral(state.db, state.ref, 'owner'), /partner_referral_owner_changed/);
  assert.equal(state.getRecord().status, 'active');
  assert.equal(state.getWrites(), 0);
});

test('invalid paths fail before opening Firestore transaction', async () => {
  const state = fakeFirestore({ ownerUid: 'owner', status: 'active' });
  await assert.rejects(quarantineOwnedPartnerReferral(state.db, { parent: { id: 'users' } }, 'owner'),
    /partner_referral_quarantine_invalid_target/);
  await assert.rejects(quarantineOwnedPartnerReferral(state.db, state.ref, ''),
    /partner_referral_quarantine_invalid_target/);
  assert.equal(state.getWrites(), 0);
});

test('nested collection with a forged parent ID cannot be quarantined', async () => {
  const state = fakeFirestore({ ownerUid: 'owner', status: 'active' });
  const nestedRef = {
    id: 'ref-test',
    path: 'users/owner/partner_referrals/ref-test',
    parent: { id: 'partner_referrals' },
  };
  await assert.rejects(quarantineOwnedPartnerReferral(state.db, nestedRef, 'owner'),
    /partner_referral_quarantine_invalid_target/);
  assert.equal(state.getWrites(), 0);
  assert.equal(state.getRecord().status, 'active');
});

test('transaction failures propagate and cannot acknowledge a tombstone', async () => {
  const state = fakeFirestore({ ownerUid: 'owner', status: 'active' });
  const failing = { runTransaction: async () => { throw new Error('firestore_unavailable'); } };
  await assert.rejects(quarantineOwnedPartnerReferral(failing, state.ref, 'owner'), /firestore_unavailable/);
  assert.equal(state.getRecord().status, 'active');
});
