// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { deleteAccountPhotos } from '../functions/src/retention';

describe('account erasure photo boundary (independent of verification upload age)', () => {
  it('deletes only UID-scoped Storage prefixes with generation preconditions', async () => {
    const deleted: string[] = [];
    const requests: string[] = [];
    const bucket = {
      getFiles: async ({ prefix }: { prefix: string }) => {
        requests.push(prefix);
        return [[{
          getMetadata: async () => [{ generation: '15', temporaryHold: false }],
          delete: async ({ ifGenerationMatch }: { ifGenerationMatch: string | number }) => {
            expect(ifGenerationMatch).toBe('15');
            deleted.push(prefix);
          },
        }], {}] as const;
      },
    };
    // One pass makes progress; the caller must relist to prove erasure complete.
    expect(await deleteAccountPhotos(bucket as any, 'unit-user')).toBe(false);
    expect(requests).toEqual(['verification/unit-user/', 'profiles/unit-user/']);
    expect(deleted).toEqual(requests);
  });

  it('rejects temporary holds instead of treating them as erased', async () => {
    const deletion = vi.fn();
    const bucket = { getFiles: async () => [[{
      getMetadata: async () => [{ generation: '17', temporaryHold: true }],
      delete: deletion,
    }], {}] };
    await expect(deleteAccountPhotos(bucket as any, 'unit-user')).rejects.toThrow('storage_object_held');
    expect(deletion).not.toHaveBeenCalled();
  });

  it('fails closed when a missing object produces no acknowledged progress', async () => {
    const bucket = { getFiles: async () => [[{
      getMetadata: async () => [{ generation: '19' }],
      delete: async () => { throw { code: 404 }; },
    }], {}] };
    await expect(deleteAccountPhotos(bucket as any, 'unit-user')).rejects.toThrow('storage_erasure_no_progress');
  });

  it.each(['', '/', '..', 'user/other'])('rejects unsafe account storage identity %j', async uid => {
    await expect(deleteAccountPhotos({ getFiles: vi.fn() } as any, uid)).rejects.toThrow('Invalid storage owner');
  });
});
