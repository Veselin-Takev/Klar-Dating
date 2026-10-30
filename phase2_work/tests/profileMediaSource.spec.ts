// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { canonicalProfileMediaReference, classifyProfileMediaSource } from '../src/lib/profileMediaSource';

describe('profile photo references are capabilities-free', () => {
  const path = 'profiles/owner-1/avatar_177222111.jpg';
  const token = 'SENSITIVE-OLD-FIREBASE-CAPABILITY';
  it('accepts a canonical Storage path without introducing a token', () => {
    expect(classifyProfileMediaSource(path)).toEqual({ kind: 'storage', path });
    expect(canonicalProfileMediaReference(path)).toBe(path);
  });
  it('extracts the object path, not a legacy Firebase download token', () => {
    const value = 'https://firebasestorage.googleapis.com/v0/b/demo-klar.appspot.com/o/'
      + encodeURIComponent(path) + '?alt=media&token=' + token;
    expect(classifyProfileMediaSource(value)).toEqual({
      kind: 'storage', bucket: 'demo-klar.appspot.com', path,
    });
    expect(canonicalProfileMediaReference(value)).toBe(path);
    expect(canonicalProfileMediaReference(value)).not.toContain(token);
  });
  it.each([
    'https://evil.example/portrait.jpg?token=PRIVATE',
    'http://images.unsplash.com/a.jpg',
    'javascript:alert(1)',
    'profiles/owner-1/../another.jpg',
    'verification/owner-1/gesture.jpg',
    'https://firebasestorage.googleapis.com/v0/b/demo-klar.appspot.com/o/verification%2Fowner%2Fphoto.jpg?token=OLD',
    'https://firebasestorage.googleapis.com/v0/b/demo-klar.appspot.com/o/profiles%2Fowner-1%2F..%2Fbad.jpg?token=OLD',
    'https://storage.googleapis.com/bucket/images.png?X-Goog-Signature=SECRET',
    'https://googleusercontent.com.evil.example/p.png',
    'data:image/svg+xml,%3Csvg%3E',
  ])('fails closed for malicious or unrelated source: %s', value => {
    expect(classifyProfileMediaSource(value)).toEqual({ kind: 'blocked' });
    expect(canonicalProfileMediaReference(value)).toBe('');
  });
  it('allows an explicit public stock-photo origin without a bearer query', () => {
    expect(classifyProfileMediaSource('https://images.unsplash.com/photo-a?auto=format')).toEqual({
      kind: 'public', url: 'https://images.unsplash.com/photo-a?auto=format',
    });
  });
});
