import { calculateMusicCompatibility } from '../../lib/matching';
import type { UserMusicPreferences } from '../../types/user';
export type CompatibilityProfile = {
  musicPreferences?: UserMusicPreferences;
  values?: string[];
  relationshipGoals?: string[];
  lifestyle?: string[];
  communication?: string[];
  interests?: string[];
  boundaries?: string[];
  distanceKm?: number;
  availability?: string[];
};

export type CompatibilityDimension = 'values' | 'relationshipGoals' | 'lifestyle' | 'communication' | 'interests' | 'boundaries' | 'availability' | 'music';

const overlap = (a: string[] = [], b: string[] = []) => {
  const A = new Set(a.map(x => x.trim().toLowerCase()).filter(Boolean));
  const B = new Set(b.map(x => x.trim().toLowerCase()).filter(Boolean));
  if (!A.size || !B.size) return null;
  let same = 0; for (const x of A) if (B.has(x)) same++;
  return same / Math.max(A.size, B.size);
};

export function explainCompatibility(a: CompatibilityProfile, b: CompatibilityProfile) {
  const dimensions: Array<[CompatibilityDimension, number | null, number]> = [
    ['values', overlap(a.values, b.values), 0.22],
    ['relationshipGoals', overlap(a.relationshipGoals, b.relationshipGoals), 0.20],
    ['lifestyle', overlap(a.lifestyle, b.lifestyle), 0.14],
    ['communication', overlap(a.communication, b.communication), 0.14],
    ['interests', overlap(a.interests, b.interests), 0.10],
    ['boundaries', overlap(a.boundaries, b.boundaries), 0.10],
    ['availability', overlap(a.availability, b.availability), 0.10],
  ];
  let weight = 0, score = 0;
  for (const [, value, w] of dimensions) if (value !== null) { score += value * w; weight += w; }
  const base = (weight ? score / weight : 0) * 100;
  const hasMusic = Boolean(a.musicPreferences && b.musicPreferences);
  const musicScore = hasMusic ? calculateMusicCompatibility(a, b) : null;
  const baseShare = hasMusic ? 0.7 : 1;
  return {
    algorithm: 'values-music-v2' as const,
    score: Math.round(base * baseShare + (musicScore ?? 0) * 0.3),
    // Coverage is available input weight, not a probability or prediction of relationship success.
    coverage: Math.round((weight * baseShare + (hasMusic ? 0.3 : 0)) * 100),
    dimensions: dimensions.map(([dimension, value, configuredWeight]) => ({
      dimension, overlap: value === null ? null : Math.round(value * 100),
      contribution: value === null || !weight ? 0 : value * configuredWeight / weight * 100 * baseShare,
    })).concat([{ dimension: 'music', overlap: musicScore, contribution: (musicScore ?? 0) * 0.3 }]),
  };
}


export function compatibilityScore(a: CompatibilityProfile, b: CompatibilityProfile) {
  return explainCompatibility(a, b).score;
}
