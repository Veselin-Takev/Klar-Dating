// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { deleteVerificationPhotoIfUnchanged } from '../src/server/platform/verificationPhotoDelete';

describe('verification-photo Storage delete preconditions (#202)', () => {
  const path = 'verification/test-user/portrait.jpg';
  const mockBucket = (meta: Record<string, unknown>, deleteImpl?: () => Promise<void>) => {
    const deletion = vi.fn(deleteImpl ?? (async () => {}));
    const bucket = {
      file: vi.fn(() => ({
        getMetadata: vi.fn(async () => [meta]),
        delete: deletion,
      })),
    };
    return { bucket, deletion };
  };

  it('deletes only the inspected generation, preserving decimal precision', async () => {
    const { bucket, deletion } = mockBucket({ generation: '90071992547409933' });
    await deleteVerificationPhotoIfUnchanged(bucket, path);
    expect(deletion).toHaveBeenCalledOnce();
    expect(deletion).toHaveBeenCalledWith({ ifGenerationMatch: '90071992547409933' });
  });

  it.each([{ temporaryHold: true }, { eventBasedHold: true },
    { retentionExpirationTime: '2999-01-01T00:00:00Z' },
    { retention: { retainUntilTime: '2999-01-01T00:00:00Z' } },
    { retentionExpirationTime: 'invalid' },
    { generation: 'not-a-generation' },
    { generation: undefined },
  ])('rejects a held/invalid object without issuing delete (%j)', async (flag) => {
    const { bucket, deletion } = mockBucket({ generation: '10', ...flag });
    await expect(deleteVerificationPhotoIfUnchanged(bucket, path, Date.parse('2026-10-31'))).rejects.toThrow();
    expect(deletion).not.toHaveBeenCalled();
  });

  it('does not delete if metadata lookup returns 404', async () => {
    const deletion = vi.fn();
    const bucket = { file: () => ({
      getMetadata: async () => { throw Object.assign(new Error('missing'), { code: 404 }); },
      delete: deletion,
    }) };
    await expect(deleteVerificationPhotoIfUnchanged(bucket, path)).rejects.toThrow('missing');
    expect(deletion).not.toHaveBeenCalled();
  });

  it('propagates generation conflict (412), never retries without a precondition', async () => {
    const { bucket, deletion } = mockBucket({ generation: '2' }, async () => {
      throw Object.assign(new Error('generation replaced'), { code: 412 });
    });
    await expect(deleteVerificationPhotoIfUnchanged(bucket, path)).rejects.toThrow('generation replaced');
    expect(deletion).toHaveBeenCalledOnce();
  });

  it.each(['profiles/user/p.jpg', 'verification/../p.jpg', 'verification/user/nested/p.jpg'])(
    'rejects paths outside the verified object boundary (%s)', async (unsafe) => {
      const { bucket, deletion } = mockBucket({ generation: '1' });
      await expect(deleteVerificationPhotoIfUnchanged(bucket, unsafe)).rejects.toThrow('verification_photo_invalid_path');
      expect(bucket.file).not.toHaveBeenCalled();
      expect(deletion).not.toHaveBeenCalled();
    },
  );
});
