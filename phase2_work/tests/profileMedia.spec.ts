import { describe, expect, it } from 'vitest';
import { createCanonicalMediaRef, normalizeProfileMedia, parseCanonicalMediaRef } from '../src/server/platform/profileMedia';
describe('canonical profile media references', () => {
  it('round-trips an owner-scoped opaque reference', () => {
    const ref = createCanonicalMediaRef('user-1', 'profiles/user-1/avatar.webp');
    expect(ref).not.toContain('avatar.webp');
    expect(parseCanonicalMediaRef('user-1', ref)).toBe('profiles/user-1/avatar.webp');
  });
  it('rejects cross-account and traversal paths', () => {
    expect(() => createCanonicalMediaRef('user-1', 'profiles/user-2/avatar.webp')).toThrow();
    expect(parseCanonicalMediaRef('user-1', 'klar-media:v1:Li4v')).toBeNull();
  });
  it('rejects non-canonical base64url references and cross-host URL aliases', () => {
    expect(parseCanonicalMediaRef('user-1', 'klar-media:v1:Li4v')).toBeNull();
    expect(parseCanonicalMediaRef('user-1', 'klar-media:v1:YWJj=')).toBeNull();
    expect(normalizeProfileMedia('user-1', { photoURL: 'https://evil.example/o/profiles%2Fuser-1%2Fa.jpg?token=x' })).toBeNull();
    expect(normalizeProfileMedia('user-1', { photoURL: 'https://firebasestorage.googleapis.com/v0/b/bucket/o/profiles%2Fuser-2%2Fa.jpg?token=x' })).toBeNull();
  });
  it('normalizes supported storage path aliases, never bearer download URLs', () => {
    expect(normalizeProfileMedia('user-1', { photoStoragePath: 'profiles/user-1/a.jpg' })).toBe(createCanonicalMediaRef('user-1', 'profiles/user-1/a.jpg'));
    expect(normalizeProfileMedia('user-1', { photos: ['profiles/user-1/b.jpg'] })).toBe(createCanonicalMediaRef('user-1', 'profiles/user-1/b.jpg'));
    expect(normalizeProfileMedia('user-1', { photoURL: 'https://firebasestorage.googleapis.com/token' })).toBeNull();
  });
});
