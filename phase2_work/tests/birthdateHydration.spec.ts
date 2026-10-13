// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { validateUserProfile } from '../src/lib/authSessionSchema';
import { readFileSync } from 'node:fs';

describe('age-gate birthdate hydration', () => {
  it('keeps the canonical date written by the transactional age gate', () => {
    const profile = validateUserProfile({
      uid: 'example-user', isAdult: true, geburtsdatum: '1991-04-23',
      name: 'Alex', interests: [], bio: '', goal: 'undecided',
    });
    expect(profile?.geburtsdatum).toBe('1991-04-23');
    expect(profile?.isAdult).toBe(true);
  });
  it('retains explicit null for an underage-locked profile without manufacturing a date', () => {
    const profile = validateUserProfile({ uid: 'blocked-user', geburtsdatum: null, isAdult: false });
    expect(profile?.geburtsdatum).toBeNull();
    expect(profile?.isAdult).toBe(false);
  });
  it('requires a confirmed server readback before advancing to consent', () => {
    const source = readFileSync('src/components/EinwilligungUndAlter.tsx', 'utf8');
    expect(source).toContain('profile.geburtsdatum !== geburtsdatum');
    expect(source).toContain('profile.isAdult !== true');
  });
});
