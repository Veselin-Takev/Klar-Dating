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
  it('normalizes supported storage path aliases, never bearer download URLs', () => {
    expect(normalizeProfileMedia('user-1', { photoStoragePath: 'profiles/user-1/a.jpg' })).toBe(createCanonicalMediaRef('user-1', 'profiles/user-1/a.jpg'));
    expect(normalizeProfileMedia('user-1', { photos: ['profiles/user-1/b.jpg'] })).toBe(createCanonicalMediaRef('user-1', 'profiles/user-1/b.jpg'));
    expect(normalizeProfileMedia('user-1', { photoURL: 'https://firebasestorage.googleapis.com/token' })).toBeNull();
  });
});
