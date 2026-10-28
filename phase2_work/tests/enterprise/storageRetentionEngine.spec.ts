import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateVerificationRetentionExpiry,
  isVerificationArtifactExpired,
  generatePurgeAuditDigest,
  purgeSingleVerificationArtifact,
  executeVerificationRetentionBatch,
  DEFAULT_VERIFICATION_RETENTION_DAYS,
  MS_PER_DAY,
  type VerificationArtifactRecord,
} from '../../src/server/platform/storageRetentionEngine.js';

describe('StorageRetentionEngine — Biometric Verification Artifacts (Art. 9 DSGVO)', () => {
  const BASE_TIME = 1700000000000;

  it('calculateVerificationRetentionExpiry correctly calculates 30-day cutoff', () => {
    // Arrange
    const decidedAt = BASE_TIME;

    // Act
    const expiry = calculateVerificationRetentionExpiry(decidedAt, DEFAULT_VERIFICATION_RETENTION_DAYS);

    // Assert
    assert.equal(expiry, BASE_TIME + 30 * MS_PER_DAY);
  });

  it('calculateVerificationRetentionExpiry rejects invalid timestamps', () => {
    // Arrange / Act / Assert
    assert.throws(() => calculateVerificationRetentionExpiry(0), /Ungültiger/);
    assert.throws(() => calculateVerificationRetentionExpiry(-500), /Ungültiger/);
    assert.throws(() => calculateVerificationRetentionExpiry(NaN), /Ungültiger/);
  });

  it('isVerificationArtifactExpired evaluates time boundaries deterministically', () => {
    // Arrange
    const decidedAt = BASE_TIME;
    const expiry = BASE_TIME + 30 * MS_PER_DAY;

    // Act & Assert
    assert.equal(isVerificationArtifactExpired(decidedAt, expiry - 1000), false);
    assert.equal(isVerificationArtifactExpired(decidedAt, expiry), true);
    assert.equal(isVerificationArtifactExpired(decidedAt, expiry + 1000), true);
  });

  it('generatePurgeAuditDigest produces reproducible SHA-256 hexadecimal hash', () => {
    // Arrange
    const uid = 'user-test-123';
    const challengeId = 'ch-456';
    const storagePath = '/verification/user-test-123/gesture.jpg';
    const purgedAt = BASE_TIME + 35 * MS_PER_DAY;

    // Act
    const hash1 = generatePurgeAuditDigest(uid, challengeId, storagePath, purgedAt);
    const hash2 = generatePurgeAuditDigest(uid, challengeId, storagePath, purgedAt);

    // Assert
    assert.match(hash1, /^[a-f0-9]{64}$/);
    assert.equal(hash1, hash2);
  });

  it('purgeSingleVerificationArtifact purges expired records and logs audit digest', async () => {
    // Arrange
    const decidedAt = BASE_TIME;
    const now = BASE_TIME + 31 * MS_PER_DAY; // 31 days later -> expired!
    const artifact: VerificationArtifactRecord = {
      uid: 'user-expired-1',
      challengeId: 'ch-exp-1',
      status: 'approved',
      decidedAt,
      storagePath: '/verification/user-expired-1/gesture.jpg',
      storageGeneration: '123456',
    };

    let storageDeleted = false;
    let dbUpdated = false;
    let recordedAuditDigest = '';

    const mockDeleteStorage = async (path: string, generation: string) => {
      assert.equal(path, artifact.storagePath);
      assert.equal(generation, '123456');
      storageDeleted = true;
    };

    const mockUpdateDb = async (uid: string, challengeId: string, data: any) => {
      assert.equal(uid, artifact.uid);
      assert.equal(challengeId, artifact.challengeId);
      assert.equal(data.photoPurged, true);
      assert.equal(data.photoPurgedAt, now);
      assert.match(data.auditDigest, /^[a-f0-9]{64}$/);
      dbUpdated = true;
      recordedAuditDigest = data.auditDigest;
    };

    // Act
    const result = await purgeSingleVerificationArtifact(
      artifact,
      mockDeleteStorage,
      mockUpdateDb,
      now
    );

    // Assert
    assert.equal(result.purged, true);
    assert.equal(result.reason, 'expired');
    assert.equal(storageDeleted, true);
    assert.equal(dbUpdated, true);
    assert.equal(result.auditDigest, recordedAuditDigest);
  });

  it('purgeSingleVerificationArtifact skips active/unexpired artifacts', async () => {
    // Arrange
    const decidedAt = BASE_TIME;
    const now = BASE_TIME + 15 * MS_PER_DAY; // 15 days later -> still within 30-day retention
    const artifact: VerificationArtifactRecord = {
      uid: 'user-active-1',
      challengeId: 'ch-act-1',
      status: 'approved',
      decidedAt,
      storagePath: '/verification/user-active-1/gesture.jpg',
      storageGeneration: '123456',
    };

    let storageDeleted = false;

    // Act
    const result = await purgeSingleVerificationArtifact(
      artifact,
      async () => { storageDeleted = true; },
      async () => {},
      now
    );

    // Assert
    assert.equal(result.purged, false);
    assert.equal(result.reason, 'not_expired');
    assert.equal(storageDeleted, false);
  });

  it('does not delete legacy records without pinned generation', async () => {
    let deleted = false;
    const result = await purgeSingleVerificationArtifact({
      uid: 'legacy', challengeId: 'legacy-id', status: 'approved',
      storagePath: 'verification/legacy/photo.jpg', decidedAt: BASE_TIME,
    }, async () => { deleted = true; }, async () => {}, BASE_TIME + 31 * MS_PER_DAY);
    assert.equal(result.purged, false); assert.equal(deleted, false);
    assert.equal(result.error, 'MISSING_DECISION_STORAGE_GENERATION');
  });

  it('does not audit a GCS 412 generation conflict as a successful deletion', async () => {
    let audited = false;
    const result = await purgeSingleVerificationArtifact({
      uid: 'test', challengeId: 'id', status: 'approved', decidedAt: BASE_TIME,
      storagePath: 'verification/test/photo.jpg', storageGeneration: '123456',
    }, async (_path, gen) => { assert.equal(gen, '123456'); throw new Error('GCS 412'); },
    async () => { audited = true; }, BASE_TIME + 31 * MS_PER_DAY);
    assert.equal(result.purged, false); assert.equal(audited, false);
  });

  it('executeVerificationRetentionBatch processes heterogeneous artifacts atomically', async () => {
    // Arrange
    const now = BASE_TIME + 35 * MS_PER_DAY;
    const artifacts: VerificationArtifactRecord[] = [
      {
        uid: 'user-1',
        challengeId: 'ch-1',
        status: 'approved',
        decidedAt: BASE_TIME, // 35 days -> expired
        storagePath: '/verification/user-1/gesture.jpg',
      storageGeneration: '123456',
      },
      {
        uid: 'user-2',
        challengeId: 'ch-2',
        status: 'approved',
        decidedAt: BASE_TIME + 10 * MS_PER_DAY, // 25 days -> NOT expired
        storagePath: '/verification/user-2/gesture.jpg',
      storageGeneration: '123456',
      },
      {
        uid: 'user-3',
        challengeId: 'ch-3',
        status: 'rejected',
        decidedAt: BASE_TIME, // 35 days -> expired
        storagePath: '/verification/user-3/gesture.jpg',
      storageGeneration: '123456',
        photoPurged: true, // already purged!
      },
    ];

    const deletedPaths: string[] = [];

    // Act
    const summary = await executeVerificationRetentionBatch(
      artifacts,
      async (path) => { deletedPaths.push(path); },
      async () => {},
      now
    );

    // Assert
    assert.equal(summary.processed, 3);
    assert.equal(summary.purgedCount, 1); // Only user-1 was newly purged
    assert.equal(summary.skippedCount, 2); // user-2 not expired, user-3 already purged
    assert.deepEqual(deletedPaths, ['/verification/user-1/gesture.jpg']);
  });
});
