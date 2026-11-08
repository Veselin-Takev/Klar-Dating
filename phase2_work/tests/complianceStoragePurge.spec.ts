// @vitest-environment node
import { describe, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { complianceSignature, validComplianceRequest, deleteVerificationStorageFile, readConsistentVerificationDecision, isVerificationPhotoPurgeEnabled, validatedVerificationPurgeBucketName, assertVerificationPurgeRecordNotHeld, createVerificationStoragePurgeRouter } from '../src/server/routes/complianceStorage';

describe('verification photo purge deployment interlock', () => {
  it.each([undefined, '', '0', 'false', 'TRUE', '1', ' true '])(
    'fails closed without the exact enabled flag: %s',
    setting => {
      expect(isVerificationPhotoPurgeEnabled(setting)).toBe(false);
    },
  );
  it('allows explicit opt-in only with exact lowercase true', () => {
    expect(isVerificationPhotoPurgeEnabled('true')).toBe(true);
  });
});

describe('destructive purge requires explicit Storage bucket selection', () => {
  it.each([
    undefined, '', ' ', '  klar-admin.firebasestorage.app',
    'klar-admin.firebasestorage.app ', 'gs://klar-admin.firebasestorage.app',
    'https://storage.googleapis.com/other-bucket',
    'OTHER-BUCKET', 'bad..bucket', 'bucket.-name',
    'bucket-.name', 'path/name', 'bucket\\name',
  ])('rejects missing or malformed bucket name: %s', name => {
    expect(validatedVerificationPurgeBucketName(name)).toBeNull();
  });

  it.each([
    'klar-admin.firebasestorage.app',
    'klar-admin.appspot.com',
    'synthetic-test-bucket-1',
  ])('accepts a deliberately supplied bucket name: %s', name => {
    expect(validatedVerificationPurgeBucketName(name)).toBe(name);
  });
});

describe('P0 hard stop for real verification-photo deletion (no Cloud resources)', () => {
  it('rejects valid HMAC, explicit bucket and activation flag before any DB or GCS', async () => {
    const previous = {
      bucket: process.env.FIREBASE_STORAGE_BUCKET,
      secret: process.env.COMPLIANCE_JOB_SECRET,
      enabled: process.env.KLAR_VERIFICATION_PHOTO_PURGE_ENABLED,
    };
    let dbCalled = false;
    let server: Server | undefined;
    try {
      process.env.FIREBASE_STORAGE_BUCKET = 'reviewed-test-bucket.firebasestorage.app';
      process.env.COMPLIANCE_JOB_SECRET = 'p0-synthetic-secret'.padEnd(64, 'z');
      process.env.KLAR_VERIFICATION_PHOTO_PURGE_ENABLED = 'true';
      const app = express();
      // Production server only supplies getDb, never test-only getBucket.
      app.use('/api/admin', createVerificationStoragePurgeRouter({
        getDb: () => {
          dbCalled = true;
          throw new Error('unexpected_firestore_access');
        },
      }));
      server = await new Promise<Server>(resolve => {
        const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
      });
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('missing_http_test_listener');
      const body = '{}';
      const timestamp = String(Date.now());
      const signature = complianceSignature(
        timestamp + '.' + body, process.env.COMPLIANCE_JOB_SECRET,
      );
      const result = await fetch(
        'http://127.0.0.1:' + address.port + '/api/admin/purge-verification-storage',
        { method: 'POST', headers: {
          'content-type': 'application/json',
          'X-Klar-Compliance-Timestamp': timestamp,
          'X-Klar-Compliance-Signature': signature,
        }, body },
      );
      expect(result.status).toBe(503);
      expect(await result.json()).toMatchObject({
        code: 'verification_storage_purge_p0_fencing_unverified',
      });
      expect(dbCalled).toBe(false);
    } finally {
      if (server) await new Promise<void>((resolve, reject) => {
        server!.close(error => error ? reject(error) : resolve());
      });
      if (previous.bucket === undefined) delete process.env.FIREBASE_STORAGE_BUCKET;
      else process.env.FIREBASE_STORAGE_BUCKET = previous.bucket;
      if (previous.secret === undefined) delete process.env.COMPLIANCE_JOB_SECRET;
      else process.env.COMPLIANCE_JOB_SECRET = previous.secret;
      if (previous.enabled === undefined) delete process.env.KLAR_VERIFICATION_PHOTO_PURGE_ENABLED;
      else process.env.KLAR_VERIFICATION_PHOTO_PURGE_ENABLED = previous.enabled;
    }
  });
});

describe('production cannot bypass P0 hard stop using a test bucket injector', () => {
  it('still returns 503 and touches no DB with valid HMAC in production mode', async () => {
    const previous = {
      nodeEnv: process.env.NODE_ENV,
      secret: process.env.COMPLIANCE_JOB_SECRET,
      enabled: process.env.KLAR_VERIFICATION_PHOTO_PURGE_ENABLED,
    };
    const secret = 'test-only-not-a-live-key'.padEnd(64, 'z');
    let touchedDb = false;
    let touchedBucket = false;
    let server: Server | undefined;
    try {
      process.env.NODE_ENV = 'production';
      process.env.COMPLIANCE_JOB_SECRET = secret;
      process.env.KLAR_VERIFICATION_PHOTO_PURGE_ENABLED = 'true';
      const app = express();
      app.use('/api/admin', createVerificationStoragePurgeRouter({
        getDb: () => { touchedDb = true; throw new Error('unexpected_db_access'); },
        getBucket: () => { touchedBucket = true; throw new Error('unexpected_bucket_access'); },
      }));
      server = await new Promise<Server>(resolve => {
        const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
      });
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('missing_test_listener');
      const timestamp = String(Date.now());
      const body = '{}';
      const result = await fetch(
        'http://127.0.0.1:' + address.port + '/api/admin/purge-verification-storage',
        { method: 'POST', headers: {
          'content-type': 'application/json',
          'X-Klar-Compliance-Timestamp': timestamp,
          'X-Klar-Compliance-Signature': complianceSignature(timestamp + '.' + body, secret),
        }, body },
      );
      expect(result.status).toBe(503);
      expect(await result.json()).toMatchObject({
        code: 'verification_storage_purge_p0_fencing_unverified',
      });
      expect(touchedDb).toBe(false);
      expect(touchedBucket).toBe(false);
    } finally {
      if (server) await new Promise<void>((resolve, reject) => {
        server!.close(err => err ? reject(err) : resolve());
      });
      if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous.nodeEnv;
      if (previous.secret === undefined) delete process.env.COMPLIANCE_JOB_SECRET;
      else process.env.COMPLIANCE_JOB_SECRET = previous.secret;
      if (previous.enabled === undefined) delete process.env.KLAR_VERIFICATION_PHOTO_PURGE_ENABLED;
      else process.env.KLAR_VERIFICATION_PHOTO_PURGE_ENABLED = previous.enabled;
    }
  });
});

describe('destructive purge HTTP bucket gate (no Cloud resources)', () => {
  it('returns 503 on a valid HMAC before Firestore when explicit bucket is absent', async () => {
    const previous = {
      bucket: process.env.FIREBASE_STORAGE_BUCKET,
      secret: process.env.COMPLIANCE_JOB_SECRET,
      enabled: process.env.KLAR_VERIFICATION_PHOTO_PURGE_ENABLED,
    };
    const secret = 'unit-test-only-'.padEnd(64, 'x');
    let firestoreTouched = false;
    let server: Server | undefined;
    try {
      delete process.env.FIREBASE_STORAGE_BUCKET;
      process.env.COMPLIANCE_JOB_SECRET = secret;
      process.env.KLAR_VERIFICATION_PHOTO_PURGE_ENABLED = 'true';
      const app = express();
      app.use('/api/admin', createVerificationStoragePurgeRouter({
        getDb: () => {
          firestoreTouched = true;
          throw new Error('unauthorized_test_firestore_access');
        },
      }));
      server = await new Promise<Server>(resolve => {
        const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
      });
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('missing_test_listener');
      const timestamp = String(Date.now());
      const body = '{}';
      const res = await fetch('http://127.0.0.1:' + address.port
        + '/api/admin/purge-verification-storage', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-Klar-Compliance-Timestamp': timestamp,
          'X-Klar-Compliance-Signature': complianceSignature(timestamp + '.' + body, secret),
        },
        body,
      });
      expect(res.status).toBe(503);
      expect(await res.json()).toMatchObject({
        code: 'verification_storage_purge_bucket_unconfigured',
      });
      expect(firestoreTouched).toBe(false);
    } finally {
      if (server) await new Promise<void>((resolve, reject) => {
        server!.close(error => error ? reject(error) : resolve());
      });
      if (previous.bucket === undefined) delete process.env.FIREBASE_STORAGE_BUCKET;
      else process.env.FIREBASE_STORAGE_BUCKET = previous.bucket;
      if (previous.secret === undefined) delete process.env.COMPLIANCE_JOB_SECRET;
      else process.env.COMPLIANCE_JOB_SECRET = previous.secret;
      if (previous.enabled === undefined) delete process.env.KLAR_VERIFICATION_PHOTO_PURGE_ENABLED;
      else process.env.KLAR_VERIFICATION_PHOTO_PURGE_ENABLED = previous.enabled;
    }
  });
});

describe('verification storage compliance job authentication', () => {
  const secret = 'x'.repeat(64);
  const timestamp = String(Date.now());
  const body = Buffer.from('{}');

  it('accepts only a fresh HMAC proof', () => {
    const signature = complianceSignature(`${timestamp}.${body.toString('utf8')}`, secret);
    expect(validComplianceRequest(body, timestamp, signature, secret, Number(timestamp))).toBe(true);
  });

  it.each([NaN, Infinity, -Infinity, 0, -1, 1.5])(
    'rejects an invalid verifier clock even with a correct HMAC: %s', now => {
      const valid = complianceSignature(`${timestamp}.${body.toString('utf8')}`, secret);
      expect(validComplianceRequest(body, timestamp, valid, secret, now)).toBe(false);
    },
  );

  it('rejects replay, wrong secret and malformed signatures', () => {
    const signature = complianceSignature(`${timestamp}.{} `, secret);
    expect(validComplianceRequest(body, timestamp, signature, secret, Number(timestamp))).toBe(false);
    const valid = complianceSignature(`${timestamp}.${body.toString('utf8')}`, secret);
    expect(validComplianceRequest(body, timestamp, valid, 'short', Number(timestamp))).toBe(false);
    expect(validComplianceRequest(body, String(Number(timestamp) - 301_000), valid, secret, Number(timestamp))).toBe(false);
  });
});

describe('Firestore verification-photo legal and preservation hold contract', () => {
  it.each([
    [{}, 'legacy absent hold'],
    [{ legalHold: false }, 'released legal hold'],
    [{ photoPurgeHold: false }, 'released photo hold'],
    [{ legalHold: false, photoPurgeHold: false }, 'both explicit false'],
  ] as const)('allows unheld record %#', (data, _label) => {
    expect(() => assertVerificationPurgeRecordNotHeld({ ...data })).not.toThrow();
  });
  it.each([
    { legalHold: true }, { photoPurgeHold: true },
    { legalHold: null }, { photoPurgeHold: 0 },
    { legalHold: 'false' }, { photoPurgeHold: 'true' },
    { legalHold: { active: false } }, { legalHold: true, photoPurgeHold: false },
  ])('blocks active or malformed record-level holds %#', data => {
    expect(() => assertVerificationPurgeRecordNotHeld(data))
      .toThrow('verification_photo_record_hold_or_invalid');
  });
});

describe('fail-closed verification decision reconciliation', () => {
  it.each([
    [{ entscheidung: 'bestaetigt' }, 'approved'],
    [{ status: 'approved' }, 'approved'],
    [{ entscheidung: 'abgelehnt', status: 'rejected' }, 'rejected'],
    [{ entscheidung: 'bestaetigt', status: 'approved' }, 'approved'],
    [{ status: 'in_pruefung' }, 'pending'],
    [{ entscheidung: null, status: 'approved' }, 'approved'],
    [{}, 'pending'],
  ] as const)('accepts consistent or unambiguous decision data %#', (record, expected) => {
    expect(readConsistentVerificationDecision({ ...record })).toBe(expected);
  });

  it.each([
    { entscheidung: 'bestaetigt', status: 'in_pruefung' },
    { entscheidung: 'abgelehnt', status: 'approved' },
    { entscheidung: 'bestaetigt', status: 'rejected' },
    { entscheidung: 'approved', status: 'unexpected' },
  ])('blocks contradictory or unknown concurrent decision state %#', record => {
    expect(() => readConsistentVerificationDecision(record)).toThrow('verification_photo_decision_conflict');
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
    { label: 'string temporary hold', metadata: { generation: '12', temporaryHold: 'true' } },
    { label: 'string event hold', metadata: { generation: '12', eventBasedHold: 'false' } },
    { label: 'null temporary hold', metadata: { generation: '12', temporaryHold: null } },
    { label: 'null event hold', metadata: { generation: '12', eventBasedHold: null } },
    { label: 'numeric temporary hold', metadata: { generation: '12', temporaryHold: 0 } },
    { label: 'object event hold', metadata: { generation: '12', eventBasedHold: { active: false } } },
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

  // P0 #202: adversarial TOCTOU characterization. This test deliberately demonstrates
  // a residual cross-service race; it is not a claim that the safety gate passes.
  it('exposes the cross-service authorization-to-delete race for review', async () => {
    let authorizeChecked!: () => void;
    const checked = new Promise<void>(resolve => { authorizeChecked = resolve; });
    let releaseDelete!: () => void;
    const release = new Promise<void>(resolve => { releaseDelete = resolve; });
    let decision: 'approved' | 'pending' = 'approved';
    let deleted = false;
    const operation = deleteVerificationStorageFile({
      getMetadata: async () => [{ generation: '77', temporaryHold: false, eventBasedHold: false }],
      delete: async ({ ifGenerationMatch }) => {
        await release;
        expect(ifGenerationMatch).toBe('77');
        deleted = true;
      },
    }, '77', async () => {
      expect(decision).toBe('approved');
      authorizeChecked();
    });
    await checked;
    decision = 'pending'; // concurrent Firestore state update; GCS generation unchanged
    releaseDelete();
    await operation;
    // Existing implementation deletes despite a revoked decision. This test
    // documents the gap; a future fenced implementation must invert this assertion.
    expect(decision).toBe('pending');
    expect(deleted).toBe(true);
  });

  it('prevents deletion when authorization is revoked before the delete call', async () => {
    let decision: 'approved' | 'pending' = 'approved';
    const calls: string[] = [];
    await expect(deleteVerificationStorageFile({
      getMetadata: async () => {
        calls.push('metadata');
        decision = 'pending'; // concurrent revocation before the final authorization callback
        return [{ generation: '81', temporaryHold: false, eventBasedHold: false }];
      },
      delete: async () => { calls.push('delete'); },
    }, '81', async () => {
      calls.push('authorization');
      if (decision !== 'approved') throw new Error('decision_revoked');
    })).rejects.toThrow('decision_revoked');
    expect(calls).toEqual(['metadata', 'authorization']);
  });

});
