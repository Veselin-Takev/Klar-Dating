// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { TenantAwareFirestoreRepository } from '../src/server/TenantAwareFirestoreRepository';

const schema = z.object({name: z.string()}).strict();
function fixture() {
  const get = vi.fn(async () => ({exists: true, data: () => ({name: 'owner'})}));
  const set = vi.fn(async () => undefined), remove = vi.fn(async () => undefined);
  const doc = vi.fn((_path: string) => ({get, set, delete: remove}));
  // Restricted SDK double, not a production adapter.
  const db = {doc} as unknown as Firestore;
  return {doc, get, set, remove, repo: new TenantAwareFirestoreRepository(db, {uid: 'owner'})};
}
describe('TenantAwareFirestoreRepository closed Admin SDK capability', () => {
  it('prefixes read/write/delete and validates stored and incoming data', async () => {
    const f = fixture();
    expect(await f.repo.read('users/owner', schema)).toEqual({name: 'owner'});
    await f.repo.write('users/owner', schema, {name: 'updated'});
    await f.repo.delete('users/owner');
    expect(f.doc.mock.calls).toEqual([['tenants/default/users/owner'], ['tenants/default/users/owner'], ['tenants/default/users/owner']]);
  });
  it.each(['tenants/other/users/owner', '/users/owner', '../owner', 'users/../users/other', 'users/%2fother', 'users/owner/', 'users', 'users/a\\b', 'users//other'])('rejects ambiguous or foreign path %s before SDK access', async path => {
    const f = fixture();
    await expect(f.repo.read(path, schema)).rejects.toThrow('tenant_document_path_invalid');
    await expect(f.repo.write(path, schema, {name:'x'})).rejects.toThrow('tenant_document_path_invalid');
    await expect(f.repo.delete(path)).rejects.toThrow('tenant_document_path_invalid');
    expect(f.doc).not.toHaveBeenCalled();
  });
  it('blocks invalid writes before SDK invocation', async () => {
    const f = fixture();
    await expect(f.repo.write('users/owner', schema, {name: 1})).rejects.toThrow();
    expect(f.doc).not.toHaveBeenCalled();
  });
  it('does not expose an unscoped database or native-reference API', () => {
    const f = fixture();
    expect(Object.keys(f.repo)).toEqual([]);
    expect('db' in f.repo).toBe(false);
    expect('collection' in f.repo).toBe(false);
    expect('collectionGroup' in f.repo).toBe(false);
  });
});
