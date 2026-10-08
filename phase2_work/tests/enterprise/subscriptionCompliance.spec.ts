import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isWithdrawalEligible,
  processCancellation,
  processWithdrawal,
  type MinimalSubscriptionData,
  type SubscriptionStore,
} from '../../src/server/platform/subscriptionCompliance';

function createMockSubscriptionStore(initialData: Record<string, MinimalSubscriptionData> = {}) {
  const subs = new Map<string, MinimalSubscriptionData>(Object.entries(initialData));
  const events: any[] = [];
  const refunds: any[] = [];
  const mails: any[] = [];

  const store: SubscriptionStore = {
    getSubscription: async (uid: string) => {
      return subs.get(uid) || null;
    },
    saveCancellation: async (uid, cancelData, eventData, mailData) => {
      const current = subs.get(uid) || { plan: 'plus' };
      subs.set(uid, {
        ...current,
        cancelledAt: cancelData.cancelledAt,
        autoRenew: cancelData.autoRenew,
      });
      events.push({ uid, ...eventData });
      mails.push({ uid, ...mailData });
    },
    saveWithdrawal: async (uid, withdrawnData, eventData, refundData, mailData) => {
      const current = subs.get(uid) || { plan: 'plus' };
      subs.set(uid, {
        ...current,
        plan: withdrawnData.plan,
        withdrawnAt: withdrawnData.withdrawnAt,
        paidUntil: withdrawnData.paidUntil,
        autoRenew: withdrawnData.autoRenew,
      });
      events.push({ uid, ...eventData });
      refunds.push({ uid, ...refundData });
      mails.push({ uid, ...mailData });
    },
  };

  return { store, subs, events, refunds, mails };
}

test('§ 356a BGB: Statutory 14-day withdrawal eligibility window', () => {
  const started = new Date('2026-09-10T10:00:00Z');

  // Day 5: eligible
  const day5 = new Date('2026-09-15T10:00:00Z');
  assert.equal(isWithdrawalEligible(started, null, day5), true);

  // Day 14 (exact): eligible
  const day14 = new Date('2026-09-24T10:00:00Z');
  assert.equal(isWithdrawalEligible(started, null, day14), true);

  // Day 15: expired
  const day15 = new Date('2026-09-25T10:00:01Z');
  assert.equal(isWithdrawalEligible(started, null, day15), false);

  // Already withdrawn: not eligible
  assert.equal(isWithdrawalEligible(started, new Date(), day5), false);
});

test('§ 312k BGB: Immediate auto-renewal stop and textform mail queueing on cancellation', async () => {
  const { store, subs, events, mails } = createMockSubscriptionStore({
    user_plus: {
      plan: 'plus',
      startedAt: new Date('2026-08-01T00:00:00Z'),
      paidUntil: new Date('2026-10-01T00:00:00Z'),
      autoRenew: true,
    },
  });

  const res = await processCancellation(store, 'user_plus', 'Nicht mehr benötigt');
  assert.equal(res.ok, true);
  assert.equal(res.paidUntil, '2026-10-01T00:00:00.000Z');

  const updated = subs.get('user_plus');
  assert.equal(updated?.autoRenew, false, 'Auto-renewal must be cancelled immediately');
  assert.ok(updated?.cancelledAt, 'Cancellation timestamp must be set');

  assert.equal(events.length, 1);
  assert.equal(events[0].typ, 'kuendigung');

  assert.equal(mails.length, 1);
  assert.equal(mails[0].template, 'kuendigung_bestaetigung');
});

test('§ 312k BGB: Cancellation is strictly idempotent', async () => {
  const { store } = createMockSubscriptionStore({
    user_plus: {
      plan: 'plus',
      startedAt: new Date('2026-08-01T00:00:00Z'),
      paidUntil: new Date('2026-10-01T00:00:00Z'),
      cancelledAt: new Date('2026-09-01T00:00:00Z'),
      autoRenew: false,
    },
  });

  const res = await processCancellation(store, 'user_plus');
  assert.equal(res.ok, true);
  assert.equal(res.bereitsGekuendigt, true);
});

test('§ 356a BGB: Withdrawal within 14 days immediately resets plan and queues refund', async () => {
  const start = new Date('2026-09-20T12:00:00Z');
  const now = new Date('2026-09-24T12:00:00Z'); // 4 days later

  const { store, subs, events, refunds, mails } = createMockSubscriptionStore({
    user_withdrawer: {
      plan: 'plus',
      startedAt: start,
      paidUntil: new Date('2026-10-20T12:00:00Z'),
      autoRenew: true,
    },
  });

  const res = await processWithdrawal(store, 'user_withdrawer', 'Gefällt mir nicht', now);
  assert.equal(res.ok, true);
  assert.equal(res.endetAm, now.toISOString());

  const updated = subs.get('user_withdrawer');
  assert.equal(updated?.plan, 'frei', 'Plan must revert to free immediately');
  assert.equal(updated?.autoRenew, false);

  assert.equal(events.length, 1);
  assert.equal(events[0].typ, 'widerruf');

  assert.equal(refunds.length, 1);
  assert.equal(refunds[0].grund, 'widerruf');

  assert.equal(mails.length, 1);
  assert.equal(mails[0].template, 'widerruf_bestaetigung');
});

test('§ 356a BGB: Withdrawal past 14 days is rejected with statutory explanation', async () => {
  const start = new Date('2026-09-01T12:00:00Z');
  const now = new Date('2026-09-24T12:00:00Z'); // 23 days later

  const { store, subs, refunds } = createMockSubscriptionStore({
    user_expired: {
      plan: 'plus',
      startedAt: start,
      paidUntil: new Date('2026-10-01T12:00:00Z'),
      autoRenew: true,
    },
  });

  const res = await processWithdrawal(store, 'user_expired', 'Zu spät', now);
  assert.equal(res.ok, false);
  assert.ok(res.error?.includes('14 Tagen'));

  const current = subs.get('user_expired');
  assert.equal(current?.plan, 'plus', 'Plan must remain unchanged');
  assert.equal(refunds.length, 0, 'No refund should be queued');
});
