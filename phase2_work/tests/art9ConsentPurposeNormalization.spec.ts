import { describe, expect, it } from 'vitest';
import { ART9_PURPOSES, normalizeArt9Purposes } from '../src/server/platform/consentEngine';

describe('Art. 9 revocation purpose normalization', () => {
  it.each([undefined, null, {}, [], 'invalid', 42])(
    'treats absent or invalid persisted consent as entirely denied (%j)',
    stored => {
      const result = normalizeArt9Purposes(stored);
      expect(Object.keys(result).sort()).toEqual([...ART9_PURPOSES].sort());
      expect(Object.values(result).every(value => value === false)).toBe(true);
    }
  );

  it('only accepts literal true for each known purpose', () => {
    const result = normalizeArt9Purposes({
      art9_sexual_orientation: true,
      art9_religious_philosophical: 'true',
      art9_health_dietary: 1,
      ai_personality_insights: false,
      unexpected: true,
    });
    expect(result).toEqual({
      art9_sexual_orientation: true,
      art9_religious_philosophical: false,
      art9_health_dietary: false,
      ai_personality_insights: false,
    });
  });

  it('creates a new snapshot without mutating persisted purpose data', () => {
    const persisted = { art9_sexual_orientation: true };
    const result = normalizeArt9Purposes(persisted);
    result.art9_sexual_orientation = false;
    expect(persisted.art9_sexual_orientation).toBe(true);
  });
});
