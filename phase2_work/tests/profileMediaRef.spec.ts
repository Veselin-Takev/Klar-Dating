import { describe, expect, it } from 'vitest';
import { createCanonicalProfileMediaRef, isCanonicalProfileMediaRef } from '../src/lib/profileMediaRef';

describe('canonical profile media references', () => {
  it('matches the server base64url representation for an owner-scoped path', () => {
    const path = 'profiles/viewer/avatar_1700000000000.jpg';
    const expected = 'klar-media:v1:' + Buffer.from(path, 'utf8').toString('base64url');
    const value = createCanonicalProfileMediaRef('viewer', path);
    expect(value).toBe(expected);
    expect(isCanonicalProfileMediaRef(value)).toBe(true);
  });

  it.each([
    ['', 'profiles/viewer/avatar.jpg'],
    ['viewer', 'profiles/another/avatar.jpg'],
    ['viewer', 'profiles/viewer/../private.jpg'],
    ['viewer', 'profiles/viewer//avatar.jpg'],
    ['viewer', 'profiles/viewer/avatar.jpg?token=secret'],
  ])('rejects invalid owner/path pairs', (uid, path) => {
    expect(() => createCanonicalProfileMediaRef(uid, path)).toThrow('Invalid profile media path.');
  });

  it('does not accept a bearer download URL as an opaque media reference', () => {
    expect(isCanonicalProfileMediaRef('https://firebasestorage.googleapis.com/photo?token=secret')).toBe(false);
  });
});
