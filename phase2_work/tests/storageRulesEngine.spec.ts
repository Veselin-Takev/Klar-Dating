// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluateStorageSecurityRule } from '../src/server/platform/storageRulesEngine';

const OWNER = { uid: 'synthetic-owner', token: { firebase: { sign_in_provider: 'password' } } };
const OTHER = { uid: 'synthetic-outsider', token: { firebase: { sign_in_provider: 'password' } } };
const ACTIVE_ADULT = {
  exists: true,
  isAdult: true,
  active: true,
  isSuspended: false,
  isBlocked: false,
  deletionPending: false,
};
const IMAGE = { size: 128, contentType: 'image/jpeg' };
const PROFILE_PATH = 'profiles/synthetic-owner/avatar.jpg';

describe('active Storage Rules / policy-engine contract', () => {
  it('keeps root and phase2 active Storage Rules byte-identical and fail-closed for direct reads', () => {
    const rootRules = readFileSync('../storage.rules', 'utf8');
    const phase2Rules = readFileSync('storage.rules', 'utf8');
    expect(rootRules).toBe(phase2Rules);
    expect(phase2Rules).toContain('match /profiles/{uid}/{datei}');
    expect(phase2Rules).toMatch(/match \/profiles\/\{uid\}\/\{datei\}\s*\{\s*allow read: if false;/);
    expect(phase2Rules).toContain('owner.isAdult == true');
    expect(phase2Rules).toContain('owner.active == true');
    expect(phase2Rules).toContain('owner.deletionPending == false');
    expect(phase2Rules).toContain('account_deletions/$(uid)');
  });

  it('denies direct profile visibility to unauthenticated, authenticated and outsider readers', () => {
    for (const auth of [null, OWNER, OTHER]) {
      const decision = evaluateStorageSecurityRule({
        operation: 'read',
        path: PROFILE_PATH,
        auth,
        ownerState: ACTIVE_ADULT,
      });
      expect(decision.allowed).toBe(false);
      expect(decision.code).toBe('PERMISSION_DENIED');
    }
  });

  it.each([
    ['missing owner state', undefined],
    ['missing owner document', { ...ACTIVE_ADULT, exists: false }],
    ['underage or unknown-age owner', { ...ACTIVE_ADULT, isAdult: false }],
    ['inactive owner', { ...ACTIVE_ADULT, active: false }],
    ['suspended owner', { ...ACTIVE_ADULT, isSuspended: true }],
    ['blocked owner', { ...ACTIVE_ADULT, isBlocked: true }],
    ['missing block state', { ...ACTIVE_ADULT, isBlocked: undefined }],
    ['deletion pending', { ...ACTIVE_ADULT, deletionPending: true }],
    ['missing deletion state', { ...ACTIVE_ADULT, deletionPending: undefined }],
    ['deleted owner', { ...ACTIVE_ADULT, status: 'deleted' }],
  ])('denies profile writes when adult/visibility gate is not satisfied: %s', (_label, ownerState) => {
    const decision = evaluateStorageSecurityRule({
      operation: 'write',
      path: PROFILE_PATH,
      auth: OWNER,
      ownerState,
      resource: IMAGE,
    });
    expect(decision.allowed).toBe(false);
  });

  it('denies unauthenticated and non-owner profile writes even for a valid adult target', () => {
    for (const auth of [null, OTHER]) {
      const decision = evaluateStorageSecurityRule({
        operation: 'write',
        path: PROFILE_PATH,
        auth,
        ownerState: ACTIVE_ADULT,
        resource: IMAGE,
      });
      expect(decision.allowed).toBe(false);
    }
  });

  it.each([
    '/profiles/synthetic-owner/avatar.jpg',
    'profiles//synthetic-owner/avatar.jpg',
    'profiles/synthetic-owner//avatar.jpg',
    'profiles/synthetic-owner/avatar.jpg/',
    'profiles/synthetic-owner/nested/avatar.jpg',
    'profiles/synthetic-owner/../other/avatar.jpg',
    'profiles/synthetic-owner/%2e%2e%2favatar.jpg',
    'profiles\\synthetic-owner\\avatar.jpg',
  ])('rejects non-canonical or out-of-boundary object path %s', path => {
    const decision = evaluateStorageSecurityRule({
      operation: 'write',
      path,
      auth: OWNER,
      ownerState: ACTIVE_ADULT,
      resource: IMAGE,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('PERMISSION_DENIED');
  });

  it('allows only the exact owner path with authoritative adult state and a valid image', () => {
    expect(evaluateStorageSecurityRule({
      operation: 'write',
      path: PROFILE_PATH,
      auth: OWNER,
      ownerState: ACTIVE_ADULT,
      resource: IMAGE,
    }).allowed).toBe(true);
  });
});
