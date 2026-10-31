// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { complianceSignature, validComplianceRequest, deleteVerificationStorageFile, assertStillEligibleForPurge, requireVerifiedPhotoUploadGeneration } from '../src/server/routes/complianceStorage';

describe('verification storage compliance job authentication', () => {
  const secret = 'x'.repeat(64);
  const timestamp = String(Date.now());
  const body = Buffer.from('{}');

  it('accepts only a fresh HMAC proof', () => {
    const signature = complianceSignature(`${timestamp}.${body.toString('utf8')}`, secret);
    expect(validComplianceRequest(body, timestamp, signature, secret, Number(timestamp))).toBe(true);
  });

  it('rejects replay, wrong secret and malformed signatures', () => {
    const signature = complianceSignature(`${timestamp}.{} `, secret);
    expect(validComplianceRequest(body, timestamp, signature, secret, Number(timestamp))).toBe(false);
    const valid = complianceSignature(`${timestamp}.${body.toString('utf8')}`, secret);
    expect(validComplianceRequest(body, timestamp, valid, 'short', Number(timestamp))).toBe(false);
    expect(validComplianceRequest(body, String(Number(timestamp) - 301_000), valid, secret, Number(timestamp))).toBe(false);
  });
});

describe('decision-based verification object deletion safety', () => {
  it('deletes only the inspected Storage generation', async () => {
    const deletes: Array<{ ifGenerationMatch: string | number }> = [];
    await deleteVerificationStorageFile({
      getMetadata: async () => [{ generation: '1234567890', temporaryHold: false, eventBasedHold: false }],
      delete: async options => { deletes.push(options); },
    });
    expect(deletes).toEqual([{ ifGenerationMatch: '1234567890' }]);
  });

  it.each([
    { label: 'temporary legal hold', metadata: { generation: '12', temporaryHold: true } },
    { label: 'event-based hold', metadata: { generation: '12', eventBasedHold: true } },
    { label: 'missing generation', metadata: { temporaryHold: false } },
    { label: 'non-decimal generation', metadata: { generation: 'other' } },
    { label: 'invalid numeric generation', metadata: { generation: -1 } },
    { label: 'unsafe integer generation', metadata: { generation: Number.MAX_SAFE_INTEGER + 1 } },
  ])('does not delete on $label', async ({ metadata }) => {
    let deleted = false;
    await expect(deleteVerificationStorageFile({
      getMetadata: async () => [metadata],
      delete: async () => { deleted = true; },
    })).rejects.toThrow();
    expect(deleted).toBe(false);
  });

  it('does not convert generation-precondition conflict into success', async () => {
    await expect(deleteVerificationStorageFile({
      getMetadata: async () => [{ generation: '100' }],
      delete: async () => { throw Object.assign(new Error('generation conflict'), { code: 412 }); },
    })).rejects.toMatchObject({ code: 412 });
  });

  it('does not consider a missing object a verified successful deletion', async () => {
    await expect(deleteVerificationStorageFile({
      getMetadata: async () => { throw Object.assign(new Error('not found'), { code: 404 }); },
      delete: async () => { throw new Error('must not execute'); },
    })).rejects.toMatchObject({ code: 404 });
  });
  it('rechecks Storage generation before applying the conditional delete', async () => {
    const { deleteVerificationStorageFile } = await import('../src/server/routes/complianceStorage');
    const deletes: Array<{ ifGenerationMatch: string | number }> = [];
    await expect(deleteVerificationStorageFile({
      getMetadata: async () => [{ generation: '9001' }],
      delete: async opts => { deletes.push(opts); },
    }, '9000')).rejects.toThrow('verification_photo_generation_changed');
    expect(deletes).toHaveLength(0);
  });

  it('never calls Storage delete if the final authorization callback fails', async () => {
    const calls: string[] = [];
    await expect(deleteVerificationStorageFile({
      getMetadata: async () => { calls.push('metadata'); return [{ generation: '55' }]; },
      delete: async () => { calls.push('deleted'); },
    }, '55', async () => {
      calls.push('authorization');
      throw new Error('decision_revoked');
    })).rejects.toThrow('decision_revoked');
    expect(calls).toEqual(['metadata', 'authorization']);
  });

  it('checks final authorization immediately before generation-conditional delete', async () => {
    const calls: string[] = [];
    await deleteVerificationStorageFile({
      getMetadata: async () => { calls.push('metadata'); return [{ generation: '99' }]; },
      delete: async options => {
        calls.push('delete');
        expect(options).toEqual({ ifGenerationMatch: '99' });
      },
    }, '99', async () => { calls.push('authorization'); });
    expect(calls).toEqual(['metadata', 'authorization', 'delete']);
  });

  it('reconciles only when Storage confirms object absence', async () => {
    const { confirmVerificationStorageAbsence } = await import('../src/server/routes/complianceStorage');
    await expect(confirmVerificationStorageAbsence({
      getMetadata: async () => { throw Object.assign(new Error('not found'), { code: 404 }); },
    })).resolves.toBeUndefined();
  });

  it('never treats an object that reappeared as absent', async () => {
    const { confirmVerificationStorageAbsence } = await import('../src/server/routes/complianceStorage');
    await expect(confirmVerificationStorageAbsence({
      getMetadata: async () => [{ generation: '774' }],
    })).rejects.toThrow('verification_photo_absence_no_longer_confirmed');
  });

  it('does not turn metadata service failures into absence proofs', async () => {
    const { confirmVerificationStorageAbsence } = await import('../src/server/routes/complianceStorage');
    await expect(confirmVerificationStorageAbsence({
      getMetadata: async () => { throw Object.assign(new Error('service unavailable'), { code: 503 }); },
    })).rejects.toMatchObject({ code: 503 });
  });

});

describe('retention lock and decision safety (#202 integration)', () => {
  const now = Date.parse('2026-10-31T12:00:00Z');
  const decidedAt = now - 31 * 86_400_000;
  const artifact = {
    uid: 'adult-test', challengeId: 'decision-1', status: 'approved' as const,
    decidedAt, storagePath: 'verification/adult-test/photo.jpg',
  };
  const eligible = {
    uid: artifact.uid, storagePath: artifact.storagePath,
    entscheidung: 'bestaetigt', decidedAt: { toMillis: () => decidedAt },
    fotoLoeschenAb: { toMillis: () => now - 1000 },
    photoUploadGeneration: '90071992547409931',
    photoPurged: false,
  };

  it('allows an explicit final decision only if due and no Firestore hold', () => {
    expect(() => assertStillEligibleForPurge(eligible, artifact, now)).not.toThrow();
  });

  it('requires the original decision-bound generation, not a fresh metadata generation', () => {
    expect(requireVerifiedPhotoUploadGeneration(eligible, '90071992547409931')).toBe('90071992547409931');
    expect(() => requireVerifiedPhotoUploadGeneration(eligible, '90071992547409932'))
      .toThrow('verification_photo_upload_generation_changed');
    expect(() => requireVerifiedPhotoUploadGeneration(eligible, 90071992547409932))
      .toThrow('verification_photo_upload_generation_changed');
  });

  it.each([
    ['legacy missing original generation', { photoUploadGeneration: undefined }],
    ['null generation', { photoUploadGeneration: null }],
    ['numeric generation', { photoUploadGeneration: 12345 }],
    ['unsafe numeric generation', { photoUploadGeneration: Number.MAX_SAFE_INTEGER + 1 }],
    ['zero generation', { photoUploadGeneration: '0' }],
    ['non-decimal generation', { photoUploadGeneration: 'abc' }],
    ['negative generation', { photoUploadGeneration: '-1' }],
    ['fractional generation', { photoUploadGeneration: '1.0' }],
  ])('quarantines %s instead of deleting a possibly replaced object', (_label, mutation) => {
    const data: Record<string, unknown> = { ...eligible, ...mutation };
    expect(() => assertStillEligibleForPurge(data, artifact, now))
      .toThrow('verification_photo_upload_generation_unproven');
  });

  it('does not authorize deletion for an original generation bound to another object', () => {
    const currentMetadataGeneration = '90071992547409932';
    expect(() => requireVerifiedPhotoUploadGeneration(eligible, currentMetadataGeneration))
      .toThrow('verification_photo_upload_generation_changed');
  });

  it.each([
    ['legal hold', { legalHold: true }],
    ['retention hold', { retentionHold: true }],
    ['string-valued legal hold', { legalHold: 'false' }],
    ['null legal hold', { legalHold: null }],
    ['numeric retention hold', { retentionHold: 0 }],
    ['null retention hold', { retentionHold: null }],
    ['already purged', { photoPurged: true }],
    ['malformed completion marker', { photoPurged: 'false' }],
    ['null completion marker', { photoPurged: null }],
    ['numeric completion marker', { photoPurged: 0 }],
    ['orphaned audit proof', { photoPurgeProof: { generation: '11', method: 'delete_acknowledged' } }],
    ['malformed audit proof', { photoPurgeProof: 'purged' }],
    ['not yet due', { fotoLoeschenAb: { toMillis: () => now + 1000 } }],
    ['pending moderation', { entscheidung: 'pending' }],
    ['rejected moderation', { entscheidung: 'abgelehnt' }],
    ['changed object path', { storagePath: 'verification/adult-test/new.jpg' }],
    ['changed decision time', { decidedAt: { toMillis: () => decidedAt + 1 } }],
  ])('rejects %s during every eligibility revalidation', (_case, mutation) => {
    expect(() => assertStillEligibleForPurge({ ...eligible, ...mutation }, artifact, now))
      .toThrow('verification_photo_eligibility_changed');
  });

  it.each([
    ['temporary hold', { temporaryHold: true }],
    ['event-based hold', { eventBasedHold: true }],
    ['legacy retention lock', { retentionExpirationTime: '2999-01-01T00:00:00Z' }],
    ['object-level retention lock', { retention: { retainUntilTime: '2999-01-01T00:00:00Z' } }],
    ['malformed retention expiry', { retentionExpirationTime: 'not-a-date' }],
    ['malformed object-level retention', { retention: { retainUntilTime: 'invalid' } }],
    ['object retention without expiry', { retention: { mode: 'Locked' } }],
    ['string-valued temporary hold', { temporaryHold: 'false' }],
    ['numeric event hold', { eventBasedHold: 0 }],
    ['blank retention timestamp', { retentionExpirationTime: '' }],
  ])('does not delete Storage generation with %s', async (_case, mutation) => {
    let deleteCalls = 0;
    await expect(deleteVerificationStorageFile({
      getMetadata: async () => [{ generation: '90071992547409931', ...mutation } as any],
      delete: async () => { deleteCalls++; },
    })).rejects.toThrow();
    expect(deleteCalls).toBe(0);
  });

  it('retains generation preconditions after verifying a non-held object', async () => {
    const calls: Array<{ ifGenerationMatch: string | number }> = [];
    await deleteVerificationStorageFile({
      getMetadata: async () => [{
        generation: '90071992547409931',
        temporaryHold: false, eventBasedHold: false,
        retentionExpirationTime: '2020-01-01T00:00:00Z',
        retention: { retainUntilTime: '2020-01-01T00:00:00Z' },
      }],
      delete: async options => { calls.push(options); },
    });
    expect(calls).toEqual([{ ifGenerationMatch: '90071992547409931' }]);
  });
});
