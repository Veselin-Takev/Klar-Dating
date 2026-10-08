import { memoizeWithPerf } from "../lib/perfMonitor";

export const interestMapping: Record<string, string> = {
  "Klettern": "fitness",
  "Architektur": "art",
  "Kaffee": "coffee",
  "Kochen": "food",
  "Wandern": "nature",
  "Tech": "career",
  "Töpfern": "art",
  "Sprachen": "travel",
  "Theater": "art"
};

export function isInterestShared(interest: string, userInterests: string[]): boolean {
  if (!userInterests) return false;
  const category = interestMapping[interest];
  return !!category && userInterests.includes(category);
}

function calculateMatchScoreRaw(userInterests: string[], profileInterests: string[]): number {
  if (!userInterests || userInterests.length === 0) return 75; // Default score if no interests provided
  let overlapCount = 0;

  for (const interest of profileInterests) {
    const category = interestMapping[interest];
    if (category && userInterests.includes(category)) {
      overlapCount++;
    }
  }

  // Base score 60% + up to 39% based on overlap.
  // Add some deterministic pseudo-randomness based on profile name length so not all non-verbindungen are 60%
  const maxOverlap = Math.max(1, profileInterests.length);
  const overlapRatio = Math.min(1, overlapCount / maxOverlap);

  const baseRandomness = (profileInterests.join("").length % 15);

  const finalScore = Math.floor(60 + baseRandomness + (overlapRatio * (39 - baseRandomness)));

  return finalScore;
}

export const calculateMatchScore = memoizeWithPerf(
  'calculateMatchScore',
  calculateMatchScoreRaw,
  (userInterests, profileInterests) => `${(userInterests || []).sort().join(',')}|${(profileInterests || []).sort().join(',')}`,
);

function calculateDeepMatchRaw(
  userValues: string[],
  userTraits: string[],
  profileValues: string[] = [],
  profileTraits: string[] = [],
  userNoGos: string[] = [],
  noGoStrictness: number = 100
): { score: number, isDeepMatch: boolean } {
  let valuesOverlap = 0;
  for (const v of profileValues) {
    if (userValues.includes(v)) valuesOverlap++;
  }

  let traitsOverlap = 0;
  for (const t of profileTraits) {
    if (userTraits.includes(t)) traitsOverlap++;
  }

  // Calculate penalties for No-Gos
  let noGoPenalty = 0;
  if (userNoGos.length > 0) {
    const lowerNoGos = userNoGos.map(n => n.toLowerCase());
    const allProfileStrings = [...profileValues, ...profileTraits].map(s => s.toLowerCase());
    for (const nogo of lowerNoGos) {
      if (allProfileStrings.some(p => p.includes(nogo) || nogo.includes(p))) {
        noGoPenalty += (30 * (noGoStrictness / 100));
      }
    }
  }

  const maxValues = Math.max(1, profileValues.length);
  const maxTraits = Math.max(1, profileTraits.length);
  let score = Math.floor(((valuesOverlap / maxValues) * 60) + ((traitsOverlap / maxTraits) * 40));
  score = Math.max(0, score - noGoPenalty);
  return { score: Math.floor(score), isDeepMatch: score > 50 && (noGoPenalty < 10) };
}

export const calculateDeepMatch = memoizeWithPerf(
  'calculateDeepMatch',
  calculateDeepMatchRaw,
  (userValues, userTraits, profileValues = [], profileTraits = [], userNoGos = [], noGoStrictness = 100) =>
    `${userValues.join(',')}|${userTraits.join(',')}|${profileValues.join(',')}|${profileTraits.join(',')}|${userNoGos.join(',')}|${noGoStrictness}`,
);
