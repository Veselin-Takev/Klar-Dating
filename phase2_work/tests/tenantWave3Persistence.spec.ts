// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getDb } from '../src/server/db';
import { TenantAwareFirestoreRepository } from '../functions/src/firestoreRepository/TenantAwareFirestoreRepository';
import { lies, schreibe, schluessel } from '../src/server/zwischenspeicher';
import { reserveAiBudget } from '../src/server/aiBudget';
const record = z.record(z.string(), z.unknown());
const cleanup: string[] = [];
const now = new Date('2092-01-01T12:00:00Z');
async function fixture() {
  const tenant = 'wave3-' + randomUUID(),
    uid = 'owner',
    repo = new TenantAwareFirestoreRepository(getDb(), tenant),
    foreign = new TenantAwareFirestoreRepository(getDb(), 'foreign-' + tenant);
  const root = `users/${tenant}`;
  cleanup.push(`tenants/${tenant}`, `tenants/foreign-${tenant}`, root);
  await repo.write(`users/${uid}`, record, { name: 'owner' });
  await foreign.write(`users/${uid}`, record, { name: 'foreign' });
  await getDb().doc(root).set({ untouched: true });
  return { repo, foreign, uid, root };
}
afterEach(async () => {
  for (const path of cleanup.splice(0))
    await getDb().recursiveDelete(getDb().doc(path));
});
describe(
  'Wave 3 native emulator tenant persistence',
  { timeout: 20000 },
  () => {
    it('keeps AI cache data scoped and strips response provenance', async () => {
      const { repo, foreign, uid, root } = await fixture();
      await schreibe(
        uid,
        '/api/insights',
        { score: 3, herkunft: 'ki', hinweis: 'old', standVom: 'old' },
        repo,
      );
      expect((await lies(uid, '/api/insights', repo))?.daten).toEqual({
        score: 3,
      });
      expect(await lies(uid, '/api/insights', foreign)).toBeNull();
      expect((await getDb().doc(root).get()).data()).toEqual({
        untouched: true,
      });
    });
    it('denies cache reads/writes after account deletion and never recreates an account', async () => {
      const { repo, uid } = await fixture();
      await schreibe(uid, '/api/insights', { score: 1 }, repo);
      await repo.write(`account_deletions/${uid}`, record, {
        state: 'pending',
      });
      expect(await lies(uid, '/api/insights', repo)).toBeNull();
      await schreibe(uid, '/api/insights', { score: 2 }, repo);
      expect(
        (
          await repo.read(
            `users/${uid}/ki_zwischenspeicher/${schluessel('/api/insights')}`,
            record,
          )
        )?.daten,
      ).toEqual({ score: 1 });
      await repo.delete(`users/${uid}`);
      await schreibe(uid, '/api/other', { score: 2 }, repo);
      expect(await repo.read(`users/${uid}`, record)).toBeNull();
    });
    it('deletes malformed and expired entries only in the selected tenant', async () => {
      const { repo, foreign, uid } = await fixture(),
        path = `users/${uid}/ki_zwischenspeicher/${schluessel('/api/insights')}`;
      await repo.write(path, record, { daten: { score: 1 }, zeit: 'bad' });
      await foreign.write(path, record, {
        daten: { score: 9 },
        zeit: new Date().toISOString(),
      });
      expect(await lies(uid, '/api/insights', repo)).toBeNull();
      expect(await repo.read(path, record)).toBeNull();
      expect((await foreign.read(path, record))?.daten).toEqual({ score: 9 });
      await repo.write(path, record, {
        daten: { score: 1 },
        zeit: '2000-01-01T00:00:00.000Z',
      });
      expect(await lies(uid, '/api/insights', repo)).toBeNull();
      expect(await repo.read(path, record)).toBeNull();
    });
    it('does not read, reset or reserve another tenant budget', async () => {
      const { repo, foreign, uid } = await fixture();
      await reserveAiBudget(repo, uid, 10, { user: 10, global: 10 }, now);
      await expect(
        reserveAiBudget(repo, uid, 1, { user: 10, global: 10 }, now),
      ).rejects.toThrow('AI_BUDGET_EXHAUSTED');
      await reserveAiBudget(foreign, uid, 2, { user: 10, global: 10 }, now);
      expect(
        (await repo.read('system/ai_budget_2092-01-01', record))?.reservedUnits,
      ).toBe(10);
      expect(
        (await foreign.read('system/ai_budget_2092-01-01', record))
          ?.reservedUnits,
      ).toBe(2);
      expect(
        (await getDb().doc('system/ai_budget_2092-01-01').get()).exists,
      ).toBe(false);
    });
    it('does not reserve against deletion tombstones or persist partial corrupt-budget transactions', async () => {
      const { repo, uid } = await fixture();
      await repo.write(`account_deletions/${uid}`, record, {
        state: 'pending',
      });
      await expect(
        reserveAiBudget(repo, uid, 1, { user: 10, global: 10 }, now),
      ).rejects.toThrow('pending deletion');
      expect(await repo.read('system/ai_budget_2092-01-01', record)).toBeNull();
      await repo.delete(`account_deletions/${uid}`);
      await repo.write('system/ai_budget_2092-01-01', record, {
        reservedUnits: -1,
      });
      await expect(
        reserveAiBudget(repo, uid, 1, { user: 10, global: 10 }, now),
      ).rejects.toThrow();
      expect(
        await repo.read(`users/${uid}/ai_budget/2092-01-01`, record),
      ).toBeNull();
    });
    it('rejects tenant path injection before native writes', async () => {
      const { repo } = await fixture();
      await expect(
        schreibe('../foreign', '/api/insights', { score: 1 }, repo),
      ).resolves.toBeUndefined();
      await expect(
        repo.transaction(async (tx) => {
          tx.write('tenants/foreign/users/owner', record, { escaped: true });
        }),
      ).rejects.toThrow('tenant_document_path_invalid');
    });
  },
);
