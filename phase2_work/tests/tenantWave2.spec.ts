// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { getDb } from '../src/server/db';
import { TenantAwareFirestoreRepository } from '../functions/src/firestoreRepository/TenantAwareFirestoreRepository';
import { deleteExpiredTenantEvents } from '../functions/src/deleteExpiredPhotos';
import { sendTenantDateReminders, type ReminderSender } from '../functions/src/dateReminders';
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (process.env.CI === 'true' && !host) throw new Error('wave2_emulator_required');
if (host && !/^(localhost|127\.0\.0\.1|\[::1\]):[0-9]+$/.test(host)) throw new Error('wave2_unsafe_target');
async function fixture() {
  const db = getDb(), suffix = randomUUID(), tenant = 'wave2-' + suffix, foreign = 'foreign-' + suffix, uid = 'u-' + suffix;
  const own = (path: string) => db.doc(`tenants/${tenant}/${path}`);
  const other = (path: string) => db.doc(`tenants/${foreign}/${path}`);
  const root = (path: string) => db.doc(path);
  const repo = new TenantAwareFirestoreRepository(db, tenant);
  return { db, repo, own, other, root, uid, cleanup: async () => {
    await Promise.all([db.recursiveDelete(db.doc(`tenants/${tenant}`)), db.recursiveDelete(db.doc(`tenants/${foreign}`)), db.recursiveDelete(root(`users/${uid}`)), root(`funnel_events/${uid}`).delete()]);
  } };
}
const now = new Date('2026-11-08T12:00:00Z');
async function planFixture(f: Awaited<ReturnType<typeof fixture>>) {
  const path = `users/${f.uid}/datePlans/plan`;
  for (const doc of [f.own, f.other, f.root]) {
    await doc(`users/${f.uid}`).set({ marker: 'synthetic' });
    await doc(path).set({ remindMe: true, reminderAt: '2026-11-08T11:00:00.000Z', title: 'Synthetic' });
    await doc(`users/${f.uid}/fcmTokens/token:synthetic`).set({});
  }
  return path;
}
describe.runIf(Boolean(host))('Wave 2 native async tenant boundaries', { timeout: 60_000 }, () => {
  it('deletes only expired tenant events and preserves root, foreign and future rows', async () => {
    const f = await fixture();
    try {
      for (const doc of [f.own, f.other, f.root]) await doc(`funnel_events/${f.uid}`).set({ expiresAt: new Date('2000-01-01') });
      await f.own('funnel_events/future').set({ expiresAt: new Date('2099-01-01') });
      expect(await deleteExpiredTenantEvents(f.repo, now)).toBe(1);
      expect((await f.own(`funnel_events/${f.uid}`).get()).exists).toBe(false);
      expect((await f.other(`funnel_events/${f.uid}`).get()).exists).toBe(true);
      expect((await f.root(`funnel_events/${f.uid}`).get()).exists).toBe(true);
      expect((await f.own('funnel_events/future').get()).exists).toBe(true);
    } finally { await f.cleanup(); }
  });
  it('rechecks expiry after selection so a concurrent retention extension cannot be deleted', async () => {
    const f = await fixture();
    try {
      await f.own('funnel_events/event').set({ expiresAt: new Date('2000-01-01') });
      const list = f.repo.list.bind(f.repo);
      vi.spyOn(f.repo, 'list').mockImplementationOnce(async (...args) => {
        const rows = await list(...args);
        await f.own('funnel_events/event').set({ expiresAt: new Date('2099-01-01') });
        return rows;
      });
      expect(await deleteExpiredTenantEvents(f.repo, now)).toBe(0);
      expect((await f.own('funnel_events/event').get()).exists).toBe(true);
    } finally { await f.cleanup(); }
  });
  it('claims concurrent reminder workers once, accepts FCM token IDs and preserves other namespaces', async () => {
    const f = await fixture();
    try {
      const path = await planFixture(f);
      const send = vi.fn<ReminderSender['sendEachForMulticast']>(async () => ({ successCount: 1, failureCount: 0, responses: [{ success: true, messageId: 'synthetic' }] }));
      const results = await Promise.all([sendTenantDateReminders(f.repo, { sendEachForMulticast: send }, now), sendTenantDateReminders(f.repo, { sendEachForMulticast: send }, now)]);
      expect(results.reduce((a, b) => a + b)).toBe(1); expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0]?.[0].tokens).toEqual(['token:synthetic']);
      expect((await f.own(path).get()).data()?.reminderDispatchState).toBe('sent');
      expect((await f.other(path).get()).data()?.reminderSentAt).toBeUndefined();
      expect((await f.root(path).get()).data()?.reminderSentAt).toBeUndefined();
    } finally { await f.cleanup(); }
  });
  it('never dispatches a reminder for an account pending erasure', async () => {
    const f = await fixture();
    try {
      await planFixture(f); await f.own(`account_deletions/${f.uid}`).set({ status: 'pending' });
      const send = vi.fn<ReminderSender['sendEachForMulticast']>();
      expect(await sendTenantDateReminders(f.repo, { sendEachForMulticast: send }, now)).toBe(0);
      expect(send).not.toHaveBeenCalled();
    } finally { await f.cleanup(); }
  });
  it('retains ambiguous provider dispatch for reconciliation rather than sending a duplicate', async () => {
    const f = await fixture();
    try {
      const path = await planFixture(f);
      const send = vi.fn<ReminderSender['sendEachForMulticast']>().mockRejectedValue(new Error('synthetic timeout'));
      await expect(sendTenantDateReminders(f.repo, { sendEachForMulticast: send }, now)).rejects.toThrow('synthetic timeout');
      expect(await sendTenantDateReminders(f.repo, { sendEachForMulticast: send }, now)).toBe(0);
      expect(send).toHaveBeenCalledTimes(1);
      expect((await f.own(path).get()).data()?.reminderDispatchState).toBe('dispatching');
      expect((await f.own(`users/${f.uid}/fcmTokens/token:synthetic`).get()).exists).toBe(true);
    } finally { await f.cleanup(); }
  });
});
