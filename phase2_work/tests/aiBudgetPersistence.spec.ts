// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { getDb } from '../src/server/db';
import { reserveAiBudget } from '../src/server/aiBudget';

const users: string[] = [];
const now = new Date('2091-01-01T12:00:00Z');
async function account() {
  const uid = 'ai-budget-' + randomUUID(); users.push(uid);
  await getDb().collection('users').doc(uid).set({}); return uid;
}
afterEach(async () => {
  for (const uid of users.splice(0)) await getDb().recursiveDelete(getDb().collection('users').doc(uid));
  await getDb().collection('system').doc('ai_budget_2091-01-01').delete();
});
describe('distributed AI budget with real Firestore transactions', { timeout: 20000 }, () => {
  it('admits exactly two of three concurrent reservations at the user limit', async () => {
    const uid = await account();
    const results = await Promise.allSettled(Array.from({ length: 3 }, () => reserveAiBudget(getDb(), uid, 10, { user: 20, global: 100 }, now)));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(2);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
    const budget = (await getDb().collection('system').doc('ai_budget_2091-01-01').get()).data();
    if (!budget) throw new Error('Expected persisted AI budget.');
    expect(budget.reservedUnits).toBe(20);
  });
  it('enforces the global cap across accounts and fails closed on corrupt counters', async () => {
    const first = await account(); const second = await account();
    await reserveAiBudget(getDb(), first, 10, { user: 100, global: 10 }, now);
    await expect(reserveAiBudget(getDb(), second, 1, { user: 100, global: 10 }, now)).rejects.toThrow('AI_BUDGET_EXHAUSTED');
    await getDb().collection('system').doc('ai_budget_2091-01-01').set({ reservedUnits: -1 });
    await expect(reserveAiBudget(getDb(), first, 1, { user: 100, global: 10 }, now)).rejects.toThrow('Invalid budget state');
  });
  it('never recreates budget data for a deleted account', async () => {
    const uid = await account(); await getDb().collection('users').doc(uid).delete();
    await expect(reserveAiBudget(getDb(), uid, 1, { user: 100, global: 100 }, now)).rejects.toThrow('no longer exists');
    expect((await getDb().collection('users').doc(uid).collection('ai_budget').get()).empty).toBe(true);
  });
});
