import { klarStorage } from '../lib/userScopedStorage';
import type { Profile } from "../data";
import { interestMapping } from "./matchScore";
import { melde } from "../lib/fehler";

export type Interaction = "nachricht" | "pass";

const MAX_LEARNED_INTERESTS = 200;

function readStoredInterests(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(klarStorage.getItem(key) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is string => typeof value === "string")
      .map(value => value.trim())
      .filter(Boolean)
      .slice(-MAX_LEARNED_INTERESTS);
  } catch (error) {
    melde("recommendationEngine", error);
    return [];
  }
}

export function recordInteraction(profile: Profile, interaction: Interaction) {
  try {
    const key = "klar_interactions_" + interaction;
    const interests = [
      ...readStoredInterests(key),
      ...profile.interests.filter((interest): interest is string => typeof interest === "string"),
    ]
      .map(interest => interest.trim())
      .filter(Boolean)
      .slice(-MAX_LEARNED_INTERESTS);
    klarStorage.setItem(key, JSON.stringify(interests));
  } catch (error) {
    melde("recommendationEngine", error);
  }
}

export function getLearnedInterestWeights(baseInterests: string[]): Record<string, number> {
  const weights: Record<string, number> = {};

  baseInterests.forEach(interest => {
    const category = interestMapping[interest] || interest;
    weights[category] = 10;
  });

  // "nachricht" is the canonical key written by recordInteraction.
  // Keep the historical "like" key read-only during migration so older
  // clients do not silently lose previously learned preferences.
  const positive = [
    ...readStoredInterests("klar_interactions_like"),
    ...readStoredInterests("klar_interactions_nachricht"),
  ].slice(-MAX_LEARNED_INTERESTS);
  const passes = readStoredInterests("klar_interactions_pass");

  positive.forEach(interest => {
    const category = interestMapping[interest] || interest;
    weights[category] = (weights[category] || 0) + 2;
  });

  passes.forEach(interest => {
    const category = interestMapping[interest] || interest;
    weights[category] = (weights[category] || 0) - 1;
  });

  return weights;
}

export function calculateDynamicScore(profile: Profile, baseInterests: string[], mustHaveInterests: string[] = []): number {
  const weights = getLearnedInterestWeights(baseInterests);

  let score = 50;

  profile.interests.forEach(interest => {
    const category = interestMapping[interest] || interest;
    let weight = weights[category] || 0;

    if (mustHaveInterests.includes(interest)) {
      weight += 100;
    }

    score += weight;
  });

  return Math.max(10, score);
}

export function sortProfilesByRecommendation(profiles: Profile[], baseInterests: string[], mustHaveInterests: string[] = []): Profile[] {
  return [...profiles].sort((a, b) => {
    const scoreA = calculateDynamicScore(a, baseInterests, mustHaveInterests);
    const scoreB = calculateDynamicScore(b, baseInterests, mustHaveInterests);
    return scoreB - scoreA;
  });
}
