// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  readdirSync,
  mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { InMemoryTenantStore } from '../src/server/inMemoryStore';
import { createDurableTenantRepository } from '../src/server/durableStore';
const schema = z.object({ value: z.number() });
const directories: string[] = [];
const directory = () => {
  const path = mkdtempSync(join(tmpdir(), 'klar-local-'));
  directories.push(path);
  return path;
};
afterEach(() => {
  vi.unstubAllEnvs();
  for (const path of directories.splice(0))
    rmSync(path, { recursive: true, force: true });
});
describe('explicit tenant-only local repositories', () => {
  it('starts empty, never fabricates identity/age/consent and separates equal user IDs', async () => {
    const store = new InMemoryTenantStore(),
      a = store.repository('a'),
      b = store.repository('b');
    expect(
      await a.read('users/owner', z.record(z.string(), z.unknown())),
    ).toBeNull();
    await a.write('users/owner', schema, { value: 1 });
    await b.write('users/owner', schema, { value: 2 });
    expect(await a.read('users/owner', schema)).toEqual({ value: 1 });
    expect(await b.read('users/owner', schema)).toEqual({ value: 2 });
    await expect(a.read('tenants/b/users/owner', schema)).rejects.toThrow();
  });
  it.each(['production', 'staging'])(
    'denies local stores in %s even with opt-in',
    (mode) => {
      vi.stubEnv('NODE_ENV', mode);
      vi.stubEnv('KLAR_ALLOW_LOCAL_REPOSITORY', 'true');
      expect(() => new InMemoryTenantStore()).toThrow();
      expect(() => createDurableTenantRepository('a', directory())).toThrow();
    },
  );
  it('denies local stores in managed cloud environments', () => {
    vi.stubEnv('K_SERVICE', 'service');
    expect(() => new InMemoryTenantStore()).toThrow(
      'local_repository_forbidden_in_cloud',
    );
  });
  it('serializes concurrent transactions and rolls back failures', async () => {
    const repo = new InMemoryTenantStore().repository('a');
    await repo.write('users/owner', schema, { value: 0 });
    await Promise.all(
      Array.from({ length: 10 }, () =>
        repo.transaction(async (tx) => {
          const row = await tx.read('users/owner', schema);
          tx.write('users/owner', schema, { value: row!.value + 1 });
        }),
      ),
    );
    expect(await repo.read('users/owner', schema)).toEqual({ value: 10 });
    await expect(
      repo.transaction(async (tx) => {
        tx.write('users/owner', schema, { value: 20 });
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');
    expect(await repo.read('users/owner', schema)).toEqual({ value: 10 });
  });
  it('rejects read-after-write and duplicate create without committing', async () => {
    const repo = new InMemoryTenantStore().repository('a');
    await repo.create('users/owner', schema, { value: 1 });
    await expect(
      repo.create('users/owner', schema, { value: 2 }),
    ).rejects.toMatchObject({ code: 6 });
    await expect(
      repo.transaction(async (tx) => {
        tx.write('users/owner', schema, { value: 3 });
        await tx.read('users/owner', schema);
      }),
    ).rejects.toThrow('transaction_reads_must_precede_writes');
    expect(await repo.read('users/owner', schema)).toEqual({ value: 1 });
  });
  it('validates schemas before writes and returns detached copies', async () => {
    const repo = new InMemoryTenantStore().repository('a');
    await expect(
      repo.write('users/owner', schema, { value: 'bad' }),
    ).rejects.toThrow();
    await repo.write('users/owner', schema, { value: 1 });
    const value = await repo.read('users/owner', schema);
    value!.value = 9;
    expect(await repo.read('users/owner', schema)).toEqual({ value: 1 });
  });
  it('bounds scans, paginates and recursively deletes inside one tenant', async () => {
    const store = new InMemoryTenantStore(),
      a = store.repository('a'),
      b = store.repository('b');
    for (let i = 0; i < 205; i++)
      await a.write(`users/u${String(i).padStart(3, '0')}`, schema, {
        value: i,
      });
    expect(await a.listAll('users', schema)).toHaveLength(205);
    await expect(a.listAll('users', schema, {}, 200)).rejects.toThrow(
      'tenant_scan_limit_exceeded',
    );
    await a.write('users/u000/private/one', schema, { value: 1 });
    await b.write('users/u000', schema, { value: 2 });
    await a.deleteTree('users/u000');
    expect(await a.read('users/u000/private/one', schema)).toBeNull();
    expect(await b.read('users/u000', schema)).toEqual({ value: 2 });
  });
  it('closes transaction capabilities after commit and abort', async () => {
    const repo = new InMemoryTenantStore().repository('a');
    let escaped:
      | import('../functions/src/firestoreRepository/TenantAwareFirestoreRepository').TenantTransaction
      | undefined;
    await repo.transaction(async (tx) => {
      escaped = tx;
      tx.write('users/owner', schema, { value: 1 });
    });
    expect(() => escaped!.write('users/owner', schema, { value: 2 })).toThrow(
      'transaction_already_closed',
    );
    await expect(escaped!.read('users/owner', schema)).rejects.toThrow(
      'transaction_already_closed',
    );
    await expect(
      repo.transaction(async (tx) => {
        escaped = tx;
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');
    expect(() => escaped!.delete('users/owner')).toThrow(
      'transaction_already_closed',
    );
    expect(await repo.read('users/owner', schema)).toEqual({ value: 1 });
  });
  it('persists separate tenant files and leaves legacy root snapshots untouched', async () => {
    const dir = directory(),
      legacy = join(dir, 'durable-firestore.json');
    writeFileSync(legacy, 'legacy-state');
    await createDurableTenantRepository('a', dir).write('users/owner', schema, {
      value: 1,
    });
    await createDurableTenantRepository('b', dir).write('users/owner', schema, {
      value: 2,
    });
    expect(
      await createDurableTenantRepository('a', dir).read('users/owner', schema),
    ).toEqual({ value: 1 });
    expect(
      await createDurableTenantRepository('b', dir).read('users/owner', schema),
    ).toEqual({ value: 2 });
    expect(readFileSync(legacy, 'utf8')).toBe('legacy-state');
  });
  it('rejects corrupt and foreign durable snapshots', async () => {
    const dir = directory();
    await createDurableTenantRepository('a', dir).write('users/owner', schema, {
      value: 1,
    });
    const file = join(dir, readdirSync(dir)[0]!);
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    saved.documents['tenants/b/users/owner'] = { value: 2 };
    writeFileSync(file, JSON.stringify(saved));
    expect(() => createDurableTenantRepository('a', dir)).toThrow(
      'durable_repository_foreign_snapshot',
    );
    writeFileSync(file, 'broken');
    expect(() => createDurableTenantRepository('a', dir)).toThrow();
  });
  it('rejects stale writers without losing newer committed data', async () => {
    const dir = directory(),
      first = createDurableTenantRepository('a', dir),
      stale = createDurableTenantRepository('a', dir);
    await first.write('users/owner', schema, { value: 1 });
    await expect(
      stale.write('users/owner', schema, { value: 2 }),
    ).rejects.toThrow('durable_repository_stale_snapshot');
    expect(
      await createDurableTenantRepository('a', dir).read('users/owner', schema),
    ).toEqual({ value: 1 });
    expect(await stale.read('users/owner', schema)).toBeNull();
  });
  it('propagates persistence failure and rejects lossy Date serialization', async () => {
    const dir = directory(),
      blocked = join(dir, 'blocked');
    writeFileSync(blocked, 'file');
    const failed = createDurableTenantRepository('a', blocked);
    await expect(
      failed.write('users/owner', schema, { value: 1 }),
    ).rejects.toThrow();
    expect(await failed.read('users/owner', schema)).toBeNull();
    mkdirSync(join(dir, 'dates'));
    const repo = createDurableTenantRepository('a', join(dir, 'dates'));
    await expect(
      repo.write('users/owner', z.object({ date: z.date() }), {
        date: new Date(),
      }),
    ).rejects.toThrow();
    expect(await repo.read('users/owner', schema)).toBeNull();
  });
});
