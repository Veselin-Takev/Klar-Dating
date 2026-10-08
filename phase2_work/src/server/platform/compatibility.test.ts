import { describe, expect, it } from 'vitest';
import { explainCompatibility } from './compatibility';
describe('deterministic matching explanations', () => {
  it('does not imply evidence when both profiles are empty', () => {
    expect(explainCompatibility({}, {})).toMatchObject({ score: 0, coverage: 0 });
  });
  it('normalizes case and duplicates and exposes sparse input coverage', () => {
    const result = explainCompatibility({ values: ['Honesty', ' honesty '] }, { values: ['honesty'] });
    expect(result).toMatchObject({ score: 100, coverage: 22 });
    expect(result.dimensions.find(d => d.dimension === 'values')).toMatchObject({ overlap: 100, contribution: 100 });
    expect(result.dimensions.find(d => d.dimension === 'communication')?.overlap).toBeNull();
  });
  it('reconstructs the score from contributions and is symmetric', () => {
    const a = { values: ['honesty'], interests: ['hiking', 'reading'], musicPreferences: { genres: ['Jazz'], concertGoer: true, playingInstrument: false } };
    const b = { values: ['honesty'], interests: ['hiking'], musicPreferences: { genres: ['Rock'], concertGoer: false, playingInstrument: true } };
    const result = explainCompatibility(a, b);
    expect(Math.round(result.dimensions.reduce((sum, d) => sum + d.contribution, 0))).toBe(result.score);
    expect(explainCompatibility(b, a)).toEqual(result);
    expect(result.dimensions.find(d => d.dimension === 'music')?.contribution).toBe(0);
  });
  it('does not infer pair distance from two unrelated radial distances', () => {
    expect(explainCompatibility({ distanceKm: 5 }, { distanceKm: 5 }).score).toBe(0);
  });
});
