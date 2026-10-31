// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { deleteVerificationPhotoIfUnchanged, matchesActiveRetentionDecision, type VerificationPhotoMetadata } from '../src/server/platform/verificationPhotoDelete';

describe('verification-photo Storage delete preconditions (#202)', () => {
  const path = 'verification/test-user/portrait.jpg';
  const mockBucket = (meta: Record<string, unknown>, deleteImpl?: () => Promise<void>) => {
    const deletion = vi.fn(deleteImpl ?? (async () => {}));
    const bucket = {
      file: vi.fn(() => ({
        getMetadata: vi.fn(async (): Promise<[VerificationPhotoMetadata]> => [meta as VerificationPhotoMetadata]),
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

describe('verification-photo decision revalidation (#202)', () => {
  const now = Date.parse('2026-10-31T12:00:00Z');
  const artifact = {
    uid: 'test-user', challengeId: 'approved-challenge', status: 'approved' as const,
    decidedAt: now - 31 * 86_400_000, storagePath: 'verification/test-user/p.jpg',
  };
  const record = {
    uid: artifact.uid, storagePath: artifact.storagePath,
    entscheidung: 'bestaetigt', decidedAt: new Date(artifact.decidedAt),
    fotoLoeschenAb: new Date(now - 1),
    photoPurged: false,
  };

  it('accepts an unchanged decided, due, non-held artifact', () => {
    expect(matchesActiveRetentionDecision(record, artifact, now)).toBe(true);
  });
  it.each([
    ['missing record', undefined],
    ['pending decision', { ...record, entscheidung: 'pending' }],
    ['different owner', { ...record, uid: 'other' }],
    ['different path', { ...record, storagePath: 'verification/test-user/new.jpg' }],
    ['new decision timestamp', { ...record, decidedAt: new Date(now - 1) }],
    ['extended retention', { ...record, fotoLoeschenAb: new Date(now + 1) }],
    ['missing deadline', { ...record, fotoLoeschenAb: null }],
    ['marked already purged', { ...record, photoPurged: true }],
    ['legal hold', { ...record, legalHold: true }],
    ['retention hold', { ...record, retentionHold: true }],
  ])('rejects changed/invalid state before and after deletion: %s', (_label, changed) => {
    expect(matchesActiveRetentionDecision(changed, artifact, now)).toBe(false);
  });
});
