export const FEATURE_FLAGS = [
  'AI_COACH_V2',
  'MATCHING_V8',
  'SCAM_PROTECTION_V1',
  'NEW_ONBOARDING',
  'LIVE_TRANSLATION_V2',
] as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

export interface FeatureDecision {
  flag: FeatureFlag;
  enabled: boolean;
  bucket: number | null;
  reason: 'kill-switch' | 'forced-on' | 'rollout' | 'disabled';
}

function parseList(value: string | undefined): Set<string> {
  return new Set((value ?? '').split(',').map(v => v.trim()).filter(Boolean));
}


const FEATURE_FLAG_SET = new Set<string>(FEATURE_FLAGS);

function unknownFlags(value: string | undefined): string[] {
  return [...parseList(value)].filter(flag => !FEATURE_FLAG_SET.has(flag));
}

export function validateFeatureFlagConfiguration(env: NodeJS.ProcessEnv = process.env): void {
  const errors: string[] = [];

  for (const variable of ['KLAR_FEATURE_FLAGS', 'KLAR_KILL_SWITCHES'] as const) {
    const unknown = unknownFlags(env[variable]);
    if (unknown.length) errors.push(variable + ': unknown flag(s): ' + unknown.join(', '));
  }

  for (const [key, raw] of Object.entries(env)) {
    if (!key.startsWith('KLAR_ROLLOUT_') || raw == null || raw.trim() === '') continue;
    const flag = key.slice('KLAR_ROLLOUT_'.length);
    if (!FEATURE_FLAG_SET.has(flag)) {
      errors.push(key + ': unknown feature flag');
      continue;
    }
    const percentage = Number(raw);
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      errors.push(key + ': rollout must be a number between 0 and 100');
    }
  }

  if (errors.length) {
    throw new Error('Invalid feature flag configuration: ' + errors.join('; '));
  }
}

function rolloutBucket(flag: FeatureFlag, userId: string): number {
  // Include the flag so assignments for unrelated experiments are independent.
  let hash = 2166136261;
  for (const ch of `${flag}:${userId}`) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash % 100;
}

export function getFeatureDecision(flag: FeatureFlag, userId?: string): FeatureDecision {
  if (parseList(process.env.KLAR_KILL_SWITCHES).has(flag)) {
    return { flag, enabled: false, bucket: null, reason: 'kill-switch' };
  }

  if (parseList(process.env.KLAR_FEATURE_FLAGS).has(flag)) {
    return { flag, enabled: true, bucket: null, reason: 'forced-on' };
  }

  const rawRollout = process.env[`KLAR_ROLLOUT_${flag}`] ?? '0';
  const rollout = Number(rawRollout);
  if (!Number.isFinite(rollout) || rollout <= 0 || !userId) {
    return { flag, enabled: false, bucket: null, reason: 'disabled' };
  }

  const bucket = rolloutBucket(flag, userId);
  return {
    flag,
    enabled: rollout >= 100 || bucket < Math.min(100, Math.floor(rollout)),
    bucket,
    reason: 'rollout',
  };
}

export function isFeatureEnabled(flag: FeatureFlag, userId?: string): boolean {
  return getFeatureDecision(flag, userId).enabled;
}
