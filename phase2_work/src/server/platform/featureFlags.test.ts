import { afterEach, describe, expect, it } from 'vitest';
import { getFeatureDecision, isFeatureEnabled, validateFeatureFlagConfiguration } from './featureFlags';

const variables = [
  'KLAR_FEATURE_FLAGS',
  'KLAR_KILL_SWITCHES',
  'KLAR_ROLLOUT_MATCHING_V8',
] as const;

afterEach(() => {
  for (const variable of variables) delete process.env[variable];
});

describe('feature flags', () => {
  it('keeps assignments stable for a user', () => {
    process.env.KLAR_ROLLOUT_MATCHING_V8 = '50';
    expect(getFeatureDecision('MATCHING_V8', 'user-42'))
      .toEqual(getFeatureDecision('MATCHING_V8', 'user-42'));
  });

  it('lets the kill switch override forced enablement', () => {
    process.env.KLAR_FEATURE_FLAGS = 'MATCHING_V8';
    process.env.KLAR_KILL_SWITCHES = 'MATCHING_V8';
    expect(isFeatureEnabled('MATCHING_V8', 'user-42')).toBe(false);
    expect(getFeatureDecision('MATCHING_V8', 'user-42').reason).toBe('kill-switch');
  });

  it('rejects invalid rollout values safely', () => {
    process.env.KLAR_ROLLOUT_MATCHING_V8 = 'not-a-number';
    expect(isFeatureEnabled('MATCHING_V8', 'user-42')).toBe(false);
  });
});


describe('feature flag configuration validation', () => {
  it('accepts known flags and bounded rollout percentages', () => {
    expect(() => validateFeatureFlagConfiguration({
      KLAR_FEATURE_FLAGS: 'AI_COACH_V2',
      KLAR_KILL_SWITCHES: 'MATCHING_V8',
      KLAR_ROLLOUT_NEW_ONBOARDING: '12.5',
    })).not.toThrow();
  });

  it('rejects unknown forced flags and kill switches', () => {
    expect(() => validateFeatureFlagConfiguration({ KLAR_FEATURE_FLAGS: 'MATCHING_V8,TYPO_FLAG' }))
      .toThrow(/TYPO_FLAG/);
    expect(() => validateFeatureFlagConfiguration({ KLAR_KILL_SWITCHES: 'UNKNOWN_KILL' }))
      .toThrow(/UNKNOWN_KILL/);
  });

  it('rejects unknown rollout variables and out-of-range percentages', () => {
    expect(() => validateFeatureFlagConfiguration({ KLAR_ROLLOUT_MATCHING_V9: '10' }))
      .toThrow(/unknown feature flag/);
    expect(() => validateFeatureFlagConfiguration({ KLAR_ROLLOUT_MATCHING_V8: '101' }))
      .toThrow(/between 0 and 100/);
    expect(() => validateFeatureFlagConfiguration({ KLAR_ROLLOUT_MATCHING_V8: 'not-a-number' }))
      .toThrow(/between 0 and 100/);
  });
});
