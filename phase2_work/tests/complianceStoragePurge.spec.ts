// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { complianceSignature, validComplianceRequest, deleteVerificationStorageFile } from '../src/server/routes/complianceStorage';

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
