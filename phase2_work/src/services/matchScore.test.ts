import { describe, it, expect } from 'vitest';
import { calculateMatchScore } from './matchScore';

describe('Production MatchScore Service', () => {
  it('berechnet den Score korrekt anhand der echten Modul-Logik', () => {
    const userInterests = ['fitness', 'art'];
    const profileInterests = ['Klettern', 'Architektur'];
    
    const score = calculateMatchScore(userInterests, profileInterests);
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThanOrEqual(60);
    expect(score).toBeLessThanOrEqual(100);
  });
});
