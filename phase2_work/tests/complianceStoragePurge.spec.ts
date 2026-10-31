// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { generatePurgeAuditDigest } from '../src/server/platform/storageRetentionEngine';
import { complianceSignature, validComplianceRequest, deleteVerificationStorageFile, assertStillEligibleForPurge, requireVerifiedPhotoUploadGeneration, hasVerifiedPhotoPurgeReceipt, reconciledVerificationDecision } from '../src/server/routes/complianceStorage';

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

  it.each([
    [{ entscheidung: 'bestaetigt', status: 'approved' }, 'approved'],
    [{ entscheidung: 'abgelehnt', status: 'rejected' }, 'rejected'],
    [{ entscheidung: null, status: 'approved' }, 'approved'],
    [{ entscheidung: 'bestaetigt' }, 'approved'],
    [{ status: 'approved' }, 'approved'],
    [{ entscheidung: 'bestaetigt', status: 'pending' }, 'pending'],
    [{ entscheidung: 'bestaetigt', status: 'rejected' }, 'pending'],
    [{ entscheidung: 'abgelehnt', status: 'approved' }, 'pending'],
    [{ entscheidung: 'unknown', status: 'approved' }, 'pending'],
    [{ entscheidung: 'bestaetigt', status: 'unknown' }, 'pending'],
  ] as const)('reconciles dual-language moderation fields %o to %s', (data, expected) => {
    expect(reconciledVerificationDecision(data)).toBe(expected);
  });

  it.each([
    { entscheidung: 'bestaetigt', status: 'pending' },
    { entscheidung: 'bestaetigt', status: 'rejected' },
    { entscheidung: 'abgelehnt', status: 'approved' },
    { entscheidung: 'unknown', status: 'approved' },
  ])('quarantines conflicting decision/status instead of authorizing a DELETE: %o', data => {
    expect(() => assertStillEligibleForPurge({ ...eligible, ...data }, artifact, now))
      .toThrow('verification_photo_eligibility_changed');
  });

  it('accepts equivalent German/English final decisions without changing legacy contracts', () => {
    expect(() => assertStillEligibleForPurge({
      ...eligible, entscheidung: 'bestaetigt', status: 'approved',
    }, artifact, now)).not.toThrow();
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

describe('verified generation-bound purge completion receipt (#202)', () => {
  const uid = 'verified-receipt-user';
  const path = 'verification/verified-receipt-user/original.jpg';
  const challengeId = 'decision-receipt-1';
  const now = Date.parse('2026-10-31T12:00:00Z');
  const decidedAt = now - 32 * 86_400_000;
  const generation = '90071992547409931';
  const artifact = {
    uid, challengeId, status: 'approved' as const, decidedAt, storagePath: path,
    photoPurged: true,
  };
  const makeReceipt = (method: 'delete_acknowledged' | 'absence_reconciled' = 'delete_acknowledged') => {
    const auditDigest = generatePurgeAuditDigest(uid, challengeId, path, now);
    const evidenceDigest = createHash('sha256')
      .update([auditDigest, method, generation].join(':')).digest('hex');
    return {
      uid, storagePath: path, entscheidung: 'bestaetigt',
      decidedAt: { toMillis: () => decidedAt },
      photoPurged: true, photoPurgedAt: now,
      photoUploadGeneration: generation,
      photoPurgeIntent: { generation, storagePath: path, decidedAt, status: 'approved' },
      auditDigest,
      photoPurgeProof: {
        generation, method, evidenceDigest, verifiedAt: { toMillis: () => now + 1_000 },
      },
    };
  };

  it.each(['delete_acknowledged', 'absence_reconciled'] as const)(
    'accepts an internally consistent %s receipt without re-deleting', method => {
      expect(hasVerifiedPhotoPurgeReceipt(makeReceipt(method), artifact, now + 1_000)).toBe(true);
    },
  );

  it('refuses a fully self-consistent receipt claiming a deletion later than the observing clock', () => {
    const futureAt = now + 60_000;
    const auditDigest = generatePurgeAuditDigest(uid, challengeId, path, futureAt);
    const receipt = makeReceipt();
    const forged = {
      ...receipt,
      photoPurgedAt: futureAt,
      auditDigest,
      photoPurgeProof: {
        ...receipt.photoPurgeProof,
        verifiedAt: { toMillis: () => futureAt + 1 },
        evidenceDigest: createHash('sha256')
          .update([auditDigest, receipt.photoPurgeProof.method, generation].join(':'))
          .digest('hex'),
      },
    };
    expect(hasVerifiedPhotoPurgeReceipt(forged, artifact, now)).toBe(false);
    expect(hasVerifiedPhotoPurgeReceipt(forged, artifact, futureAt)).toBe(false);
    expect(hasVerifiedPhotoPurgeReceipt(forged, artifact, futureAt + 1)).toBe(true);
  });

  it('refuses future-dated verification even when deletion timestamp and digests are valid', () => {
    expect(hasVerifiedPhotoPurgeReceipt(makeReceipt(), artifact, now)).toBe(false);
    expect(hasVerifiedPhotoPurgeReceipt(makeReceipt(), artifact, now + 1_000)).toBe(true);
  });

  it('refuses fractional proof timestamps or invalid observation clocks', () => {
    const receipt = makeReceipt();
    const fractional = {
      ...receipt, photoPurgeProof: {
        ...receipt.photoPurgeProof, verifiedAt: { toMillis: () => now + 500.5 },
      },
    };
    expect(hasVerifiedPhotoPurgeReceipt(fractional, artifact, now + 1_000)).toBe(false);
    for (const clock of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, now + 1_000.5]) {
      expect(hasVerifiedPhotoPurgeReceipt(receipt, artifact, clock)).toBe(false);
    }
  });

  it('refuses a coherent generation-bound receipt when current moderation fields contradict', () => {
    const receipt = makeReceipt();
    for (const status of ['pending', 'rejected', 'unrecognized']) {
      expect(hasVerifiedPhotoPurgeReceipt({
        ...receipt, status,
      }, artifact, now + 1_000)).toBe(false);
    }
    expect(hasVerifiedPhotoPurgeReceipt({
      ...receipt, status: 'approved',
    }, artifact, now + 1_000)).toBe(true);
  });

  it('does not treat a bare legacy photoPurged:true as a verified deletion', () => {
    expect(hasVerifiedPhotoPurgeReceipt({ photoPurged: true }, artifact, now + 1_000)).toBe(false);
  });

  it('quarantines inconsistent original-generation and receipt proofs', () => {
    const valid = makeReceipt();
    const corrupt = [
      { ...valid, photoUploadGeneration: undefined },
      { ...valid, photoUploadGeneration: '90071992547409932' },
      { ...valid, photoPurgeIntent: null },
      { ...valid, photoPurgeIntent: { ...valid.photoPurgeIntent, generation: '90071992547409932' } },
      { ...valid, photoPurgeProof: { ...valid.photoPurgeProof, generation: '90071992547409932' } },
      { ...valid, photoPurgeProof: { ...valid.photoPurgeProof, evidenceDigest: '0'.repeat(64) } },
      { ...valid, photoPurgeProof: null },
      { ...valid, auditDigest: '0'.repeat(64) },
      { ...valid, photoPurgedAt: now + 1 },
      { ...valid, photoPurgedAt: 'invalid' },
      { ...valid, photoPurgeProof: { ...valid.photoPurgeProof, verifiedAt: undefined } },
      { ...valid, photoPurgeProof: { ...valid.photoPurgeProof, verifiedAt: { toMillis: () => now - 1 } } },
      { ...valid, photoPurgeProof: { ...valid.photoPurgeProof, method: 'unverified' } },
    ];
    for (const state of corrupt) {
      expect(hasVerifiedPhotoPurgeReceipt(state, artifact, now + 1_000)).toBe(false);
    }
  });

  it('fails closed for an event associated with a different account, path or decision', () => {
    const valid = makeReceipt();
    expect(hasVerifiedPhotoPurgeReceipt(valid, { ...artifact, uid: 'another-user' }, now + 1_000)).toBe(false);
    expect(hasVerifiedPhotoPurgeReceipt(valid, { ...artifact, storagePath: 'verification/other/photo.jpg' }, now + 1_000)).toBe(false);
    expect(hasVerifiedPhotoPurgeReceipt(valid, { ...artifact, decidedAt: decidedAt + 1 }, now + 1_000)).toBe(false);
    expect(hasVerifiedPhotoPurgeReceipt(valid, { ...artifact, status: 'pending' }, now + 1_000)).toBe(false);
  });
});
