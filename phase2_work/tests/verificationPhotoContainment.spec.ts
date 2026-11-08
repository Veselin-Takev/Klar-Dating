// @vitest-environment node
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { complianceSignature, createVerificationStoragePurgeRouter } from '../src/server/routes/complianceStorage';
import { deleteAccountPhotos, deleteExpiredPhotoPage } from '../functions/src/retention';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('VES-5 production deletion containment — test-first contract', () => {
  it.each(['production', 'development'])('keeps the signed purge hard-disabled in %s, even when explicitly opted in', async environment => {
    vi.stubEnv('NODE_ENV', environment);
    vi.stubEnv('KLAR_VERIFICATION_PHOTO_PURGE_ENABLED', 'true');
    vi.stubEnv('FIREBASE_STORAGE_BUCKET', 'klar-verification-reviewed');
    const secret = 'p'.repeat(64);
    vi.stubEnv('COMPLIANCE_JOB_SECRET', secret);
    const getDb = vi.fn(() => { throw new Error('Firestore must not be touched'); });
    const getBucket = vi.fn(() => { throw new Error('GCS must not be touched'); });
    const app = express();
    app.use('/api/admin', createVerificationStoragePurgeRouter({ getDb: getDb as any, getBucket: getBucket as any }));
    const server = app.listen(0, '127.0.0.1');
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('listen_failed');
      const body = '{}';
      const timestamp = String(Date.now());
      const signature = complianceSignature(`${timestamp}.${body}`, secret);
      const res = await fetch(`http://127.0.0.1:${address.port}/api/admin/purge-verification-storage`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-Klar-Compliance-Timestamp': timestamp,
          'X-Klar-Compliance-Signature': signature,
        },
        body,
      });
      expect(res.status).toBe(503);
      expect(await res.json()).toMatchObject({ code: 'verification_storage_purge_p0_fencing_unverified' });
      expect(getDb).not.toHaveBeenCalled();
      expect(getBucket).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it('leaves account erasure pending when verification photos exist, without touching physical files', async () => {
    const verification = { getMetadata: vi.fn(), delete: vi.fn() };
    const profile = { getMetadata: vi.fn(), delete: vi.fn() };
    const requests: string[] = [];
    const bucket = { getFiles: vi.fn(async ({ prefix }: { prefix: string }) => {
      requests.push(prefix);
      return [prefix === 'verification/owner/' ? [verification] : [profile], null] as const;
    }) };
    await expect(deleteAccountPhotos(bucket as any, 'owner')).rejects.toThrow('verification_photo_p0_fencing_unverified');
    expect(requests).toEqual(['verification/owner/']);
    expect(verification.getMetadata).not.toHaveBeenCalled();
    expect(verification.delete).not.toHaveBeenCalled();
    expect(profile.delete).not.toHaveBeenCalled();
  });

  it('deletes only normal profile photos and refuses to silently certify a new verification object', async () => {
    const profile = {
      getMetadata: vi.fn(async () => [{ generation: '7', temporaryHold: false, eventBasedHold: false }]),
      delete: vi.fn(async () => undefined),
    };
    let verificationReads = 0;
    const bucket = { getFiles: vi.fn(async ({ prefix }: { prefix: string }) => {
      if (prefix === 'verification/owner/') {
        verificationReads++;
        return [verificationReads === 1 ? [] : [{ getMetadata: vi.fn(), delete: vi.fn() }], null] as const;
      }
      return [[profile], null] as const;
    }) };
    await expect(deleteAccountPhotos(bucket as any, 'owner')).rejects.toThrow('verification_photo_p0_fencing_unverified');
    expect(profile.delete).toHaveBeenCalledWith({ ifGenerationMatch: '7' });
    expect(verificationReads).toBe(2);
  });

  it.each([
    { temporaryHold: true },
    { temporaryHold: null },
    { temporaryHold: 'false' },
    { eventBasedHold: true },
    { eventBasedHold: null },
    { generation: undefined },
    { generation: '0' },
    { generation: 'unsafe' },
  ])('refuses malformed or held profile-photo metadata: %j', async metadata => {
    const profile = {
      getMetadata: vi.fn(async () => [{ generation: '7', ...metadata }]),
      delete: vi.fn(),
    };
    const bucket = { getFiles: vi.fn(async ({ prefix }: { prefix: string }) =>
      [prefix === 'profiles/owner/' ? [profile] : [], null] as const) };
    await expect(deleteAccountPhotos(bucket as any, 'owner')).rejects.toThrow(/storage_object_held|storage_object_metadata_invalid|Photo generation missing/);
    expect(profile.delete).not.toHaveBeenCalled();
  });

  it('prevents the legacy upload-age worker from deleting verification objects at any age', async () => {
    const getFiles = vi.fn();
    await expect(deleteExpiredPhotoPage({ getFiles } as any, new Date('2026-11-08'))).rejects.toThrow('verification_photo_p0_fencing_unverified');
    expect(getFiles).not.toHaveBeenCalled();
  });
});
