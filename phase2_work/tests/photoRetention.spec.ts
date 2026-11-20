// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { deleteAccountPhotos } from '../functions/src/retention';

describe('account erasure photo boundary (independent of verification upload age)', () => {
  it('erases only UID-scoped profile photos, never verification photos, with generation CAS', async () => {
    const deleted: string[] = [];
    const requests: string[] = [];
    const bucket = {
      getFiles: async ({ prefix }: { prefix: string }) => {
        requests.push(prefix);
        const files = prefix === 'profiles/unit-user/' ? [{
          getMetadata: async () => [{ generation: '15', temporaryHold: false }],
          delete: async ({ ifGenerationMatch }: { ifGenerationMatch: string | number }) => {
            expect(ifGenerationMatch).toBe('15');
            deleted.push(prefix);
          },
        }] : [];
        return [files, null] as const;
      },
    };
    // The default caller must check the verification prefix before and after
    // progressing on profile objects; it must never delete a verification object.
    expect(await deleteAccountPhotos(bucket as any, 'unit-user')).toBe(false);
    expect(requests).toEqual([
      'verification/unit-user/', 'profiles/unit-user/', 'verification/unit-user/',
    ]);
    expect(deleted).toEqual(['profiles/unit-user/']);
  });

  it('blocks deletion of account photos when an unfenced verification object exists', async () => {
    const deletion = vi.fn();
    const listing = vi.fn(async ({ prefix }: { prefix: string }) => {
      if (prefix === 'verification/unit-user/') {
        return [[{ getMetadata: vi.fn(), delete: deletion }], null] as const;
      }
      return [[], null] as const;
    });
    await expect(deleteAccountPhotos({ getFiles: listing } as any, 'unit-user'))
      .rejects.toThrow('verification_photo_p0_fencing_unverified');
    expect(listing).toHaveBeenCalledTimes(1);
    expect(deletion).not.toHaveBeenCalled();
  });

  it('rejects temporary holds on profile photos instead of treating them as erased', async () => {
    const deletion = vi.fn();
    const bucket = {
      getFiles: async ({ prefix }: { prefix: string }) => [
        prefix === 'profiles/unit-user/' ? [{
          getMetadata: async () => [{ generation: '17', temporaryHold: true }],
          delete: deletion,
        }] : [],
        null,
      ] as const,
    };
    await expect(deleteAccountPhotos(bucket as any, 'unit-user')).rejects.toThrow('storage_object_held');
    expect(deletion).not.toHaveBeenCalled();
  });

  it('fails closed when a missing profile object produces no acknowledged progress', async () => {
    const bucket = {
      getFiles: async ({ prefix }: { prefix: string }) => [
        prefix === 'profiles/unit-user/' ? [{
          getMetadata: async () => [{ generation: '19' }],
          delete: async () => { throw { code: 404 }; },
        }] : [],
        null,
      ] as const,
    };
    await expect(deleteAccountPhotos(bucket as any, 'unit-user'))
      .rejects.toThrow('storage_erasure_no_progress');
  });

  it.each(['', '/', '..', 'user/other'])('rejects unsafe account storage identity %j', async uid => {
    await expect(deleteAccountPhotos({ getFiles: vi.fn() } as any, uid))
      .rejects.toThrow('Invalid storage owner');
  });
});
