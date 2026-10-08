import type { UserProfile } from '../types/user';

const normalize = (value: string) => value.trim().toLocaleLowerCase('de-DE');

export function calculateMusicCompatibility(userA: Pick<UserProfile, 'musicPreferences'>, userB: Pick<UserProfile, 'musicPreferences'>): number {
  const musicA = userA.musicPreferences;
  const musicB = userB.musicPreferences;

  if (!musicA || !musicB) return 0;

  let score = 0;
  let maxScore = 5;

  const setA = new Set(musicA.genres.map(normalize).filter(Boolean));
  const setB = new Set(musicB.genres.map(normalize).filter(Boolean));
  const union = new Set([...setA, ...setB]);

  if (union.size > 0) {
    maxScore += 10;
    const intersection = [...setA].filter(genre => setB.has(genre)).length;
    score += (intersection / union.size) * 10;
  }

  if (musicA.concertGoer === musicB.concertGoer) score += 3;
  if (musicA.playingInstrument === musicB.playingInstrument) score += 2;

  return Math.round((score / maxScore) * 100);
}

function calculateInterestCompatibility(userA: UserProfile, userB: UserProfile): number {
  const interestsA = new Set(userA.interests || []);
  const interestsB = new Set(userB.interests || []);
  const union = new Set([...interestsA, ...interestsB]);

  if (union.size === 0) return 0;
  const intersection = [...interestsA].filter(interest => interestsB.has(interest)).length;
  return (intersection / union.size) * 100;
}

export function calculateTotalCompatibility(userA: UserProfile, userB: UserProfile): number {
  const interestScore = calculateInterestCompatibility(userA, userB);
  const hasMusicData = Boolean(userA.musicPreferences && userB.musicPreferences);

  const total = hasMusicData
    ? interestScore * 0.7 + calculateMusicCompatibility(userA, userB) * 0.3
    : interestScore;

  return Math.min(100, Math.max(0, Math.round(total)));
}

