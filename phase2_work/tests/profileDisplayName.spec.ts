// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resolveProfileDisplayName } from '../src/lib/profileDisplayName';

describe('authenticated profile name resolution', () => {
  it('prioritizes the authoritative stored profile name', () => {
    expect(resolveProfileDisplayName('  Alex  ', 'Firebase Name', 'test@example.com', true)).toBe('Alex');
  });
  it('ignores the legacy Neu placeholder and uses Firebase Auth displayName', () => {
    expect(resolveProfileDisplayName('Neu', 'Robin', 'user@example.com', true)).toBe('Robin');
  });
  it('derives a UI-only label from verified email when no user name exists', () => {
    expect(resolveProfileDisplayName('', null, 'jane.doe@example.com', true)).toBe('jane doe');
  });
  it('does not reveal an unverified email or fabricate a profile identity', () => {
    expect(resolveProfileDisplayName('Neu', null, 'someone@example.com', false)).toBe('Namen im Profil ergänzen');
  });
});
