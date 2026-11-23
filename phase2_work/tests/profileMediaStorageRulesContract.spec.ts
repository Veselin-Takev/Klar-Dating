// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  evaluateProfileMediaStorageAccess,
  isCanonicalOpaqueProfileMediaPath,
  type ProfileMediaStorageOperation,
} from '../src/server/media/profileMediaStorageRulesContract';

const CANDIDATE_RULES = readFileSync('storage.p0-374-candidate.rules', 'utf8');
const ACTIVE_STORAGE_RULES_BASELINE_BLOB_SHA = '318fd66f58c6db78c69fabb9d472874d67692fef';
const OPAQUE_PATH = `profile-media/v1/${'a'.repeat(40)}`;

function gitBlobSha(content: string): string {
  const header = Buffer.from(`blob ${Buffer.byteLength(content)}\0`);
  return createHash('sha1').update(header).update(content).digest('hex');
}

describe('P0 #374 Package 3 — isolated candidate Storage Rules contract', () => {
  it('keeps the candidate default-deny with no public or authenticated allow fallback', () => {
    expect(CANDIDATE_RULES).toContain("rules_version = '2';");
    expect(CANDIDATE_RULES).toContain('match /{object=**}');
    expect(CANDIDATE_RULES).toMatch(/allow\s+read,\s*write:\s*if\s+false\s*;/);
    expect(CANDIDATE_RULES).not.toMatch(/allow\s+(read|write|read,\s*write):\s*if\s+true\s*;/);
    expect(CANDIDATE_RULES).not.toContain('request.auth');
  });

  it('explicitly denies direct profile-media/v1 reads and writes', () => {
    expect(CANDIDATE_RULES).toContain('match /profile-media/v1/{opaqueObjectId}');
    expect(CANDIDATE_RULES).toMatch(/match \/profile-media\/v1\/\{opaqueObjectId\}\s*\{\s*allow read, write: if false;/);
    for (const operation of ['read', 'write'] as const) {
      expect(evaluateProfileMediaStorageAccess({ operation, objectPath: OPAQUE_PATH })).toEqual({
        allowed: false,
        code: 'DIRECT_CLIENT_STORAGE_ACCESS_DENIED',
      });
    }
  });

  it.each([
    ['unauthenticated', 'read', OPAQUE_PATH],
    ['guest', 'read', OPAQUE_PATH],
    ['underage', 'read', OPAQUE_PATH],
    ['unverified adult', 'read', OPAQUE_PATH],
    ['cross-tenant', 'read', OPAQUE_PATH],
    ['non-owner', 'read', OPAQUE_PATH],
    ['bilaterally blocked', 'read', OPAQUE_PATH],
    ['deleted account', 'read', OPAQUE_PATH],
    ['deactivated account', 'read', OPAQUE_PATH],
    ['cross-tenant write', 'write', OPAQUE_PATH],
    ['non-owner write', 'write', OPAQUE_PATH],
  ] as const)(
    'denies direct client %s %s regardless of identity context',
    (_scenario, operation, objectPath) => {
      expect(evaluateProfileMediaStorageAccess({
        operation: operation as ProfileMediaStorageOperation,
        objectPath,
      }).allowed).toBe(false);
    },
  );

  it.each([
    '',
    'users/synthetic-user/photo.jpg',
    'profiles/synthetic-user/photo.jpg',
    'profile-media/v1/../private/object',
    'profile-media/v1/%2e%2e%2fprivate',
    'profile-media/v1/%252e%252e%252fprivate',
    'profile-media/v1/..\\private',
    'https://firebasestorage.googleapis.com/v0/b/demo/o/object?alt=media&token=SYNTHETIC_TOKEN',
    'profile-media/v1/short',
    `profile-media/v1/${'x'.repeat(129)}`,
  ])('rejects malformed, traversing, encoded or legacy path %s', path => {
    expect(isCanonicalOpaqueProfileMediaPath(path)).toBe(false);
  });

  it('accepts only the canonical opaque object-path grammar', () => {
    expect(isCanonicalOpaqueProfileMediaPath(OPAQUE_PATH)).toBe(true);
    expect(isCanonicalOpaqueProfileMediaPath(`profile-media/v1/${'Z_9-'.repeat(10)}`)).toBe(true);
  });

  it('does not treat a persistent Firebase download-token URL as a valid object path', () => {
    const legacyTokenUrl = 'https://firebasestorage.googleapis.com/v0/b/demo/o/profiles%2Fsynthetic-user%2Fphoto.jpg?alt=media&token=SYNTHETIC_TOKEN';
    expect(isCanonicalOpaqueProfileMediaPath(legacyTokenUrl)).toBe(false);
    expect(evaluateProfileMediaStorageAccess({ operation: 'read', objectPath: legacyTokenUrl }).allowed).toBe(false);
  });

  it('keeps legacy UID-based Storage path families explicitly denied', () => {
    for (const family of ['/users/', '/profiles/', '/verification/', '/verification_events/']) {
      expect(CANDIDATE_RULES).toContain(`match ${family}`);
    }
    expect(CANDIDATE_RULES).toContain('match /{object=**}');
  });

  it('proves the active phase2_work/storage.rules file is byte-identical to the authorized base', () => {
    const activeRules = readFileSync('storage.rules', 'utf8');
    expect(gitBlobSha(activeRules)).toBe(ACTIVE_STORAGE_RULES_BASELINE_BLOB_SHA);
  });

  it('keeps candidate rules separate from the active root Rules and Firebase config', () => {
    expect(CANDIDATE_RULES).not.toBe(readFileSync('storage.rules', 'utf8'));
    expect(CANDIDATE_RULES).not.toBe(readFileSync('firestore.rules', 'utf8'));
    expect(readFileSync('firebase.json', 'utf8')).not.toContain('storage.p0-374-candidate.rules');
  });
});
