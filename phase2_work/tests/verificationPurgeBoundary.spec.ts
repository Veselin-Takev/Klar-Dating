// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { assertCurrentVerificationPurgeCandidate, verifiedDeletionGeneration } from '../src/server/platform/verificationPurgeBoundary';
import { MS_PER_DAY, type VerificationArtifactRecord } from '../src/server/platform/storageRetentionEngine';

describe('P0 #202: decision-aware GCS verification purge preconditions', () => {
  const now = new Date('2026-11-01T12:00:00.000Z').getTime();
  const decidedAt = now - 31 * MS_PER_DAY;
  const artifact: VerificationArtifactRecord = {
    uid: 'alice', challengeId: 'challenge-a', status: 'approved', decidedAt,
    storagePath: 'verification/alice/challenge-a.jpg',
  };
  const current = {
    uid: artifact.uid,
    storagePath: artifact.storagePath,
    status: 'approved',
    entscheidung: 'bestaetigt',
    decidedAt,
    fotoLoeschenAb: new Date(decidedAt + 30 * MS_PER_DAY),
    photoPurged: false,
  };

  it('accepts a consistently decided, due and owned artifact', () => {
    expect(() => assertCurrentVerificationPurgeCandidate(current, artifact, now)).not.toThrow();
    const firestoreTimestamp = { toMillis: () => decidedAt };
    expect(() => assertCurrentVerificationPurgeCandidate({
      ...current, decidedAt: firestoreTimestamp, fotoLoeschenAb: { toMillis: () => decidedAt + 30 * MS_PER_DAY },
    }, artifact, now)).not.toThrow();
  });

  it.each([
    ['missing row', undefined],
    ['pending decision', { ...current, status: 'pending', entscheidung: undefined }],
    ['reversed decision', { ...current, entscheidung: 'abgelehnt' }],
    ['unrecognized decision', { ...current, status: 'mystery', entscheidung: undefined }],
    ['foreign UID', { ...current, uid: 'mallory' }],
    ['foreign object', { ...current, storagePath: 'verification/mallory/other.jpg' }],
    ['decision changed', { ...current, decidedAt: decidedAt + 1000 }],
    ['missing expiry marker', { ...current, fotoLoeschenAb: undefined }],
    ['later expiry marker', { ...current, fotoLoeschenAb: new Date(now + 1000) }],
    ['invalid early expiry', { ...current, fotoLoeschenAb: new Date(decidedAt + 20 * MS_PER_DAY) }],
    ['already purged', { ...current, photoPurged: true }],
    ['legal hold', { ...current, legalHold: true }],
    ['retention hold', { ...current, retentionHold: true }],
    ['record hold', { ...current, hold: true }],
  ] as const)('blocks %s before physical deletion', (_, record) => {
    expect(() => assertCurrentVerificationPurgeCandidate(record, artifact, now)).toThrow();
  });

  it('rejects a stale or foreign candidate even when the Firestore row is unchanged', () => {
    expect(() => assertCurrentVerificationPurgeCandidate(current, { ...artifact, decidedAt: now - 2 * MS_PER_DAY }, now)).toThrow();
    expect(() => assertCurrentVerificationPurgeCandidate(current, { ...artifact, uid: 'mallory' }, now)).toThrow();
  });

  it('accepts only a precise numeric GCS object generation without active holds', () => {
    expect(verifiedDeletionGeneration({ generation: '18446744073709551615' }, now)).toBe('18446744073709551615');
    expect(verifiedDeletionGeneration({ generation: 22, retentionExpirationTime: new Date(now - 1).toISOString() }, now)).toBe('22');
  });

  it.each([
    undefined,
    {},
    { generation: '0' },
    { generation: '-1' },
    { generation: 'NaN' },
    { generation: '1.5' },
    { generation: 'abc' },
    { generation: 1.2 },
    { generation: 0 },
    { generation: '8', temporaryHold: true },
    { generation: '8', eventBasedHold: true },
    { generation: '8', hold: true },
    { generation: '8', retentionExpirationTime: new Date(now + 1).toISOString() },
    { generation: '8', retentionExpirationTime: 'unparseable' },
  ])('rejects missing/invalid generations or hold states (%j)', metadata => {
    expect(() => verifiedDeletionGeneration(metadata, now)).toThrow();
  });
});
