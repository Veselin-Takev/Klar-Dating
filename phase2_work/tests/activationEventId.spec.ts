import { describe, expect, it } from 'vitest';
import { resolveActivationEventId } from '../src/server/routes/activationEventId';

describe('activation id fallback', () => {
  it.each([
    ['onboarding_started', 'onboarding_v2_started_user-a'],
    ['onboarding_completed', 'onboarding_v2_completed_user-a'],
  ])('derives UID-scoped id for %s when omitted', (eventName, expected) => {
    expect(resolveActivationEventId(eventName, 'user-a', undefined)).toBe(expected);
    expect(resolveActivationEventId(eventName, 'user-a', null)).toBe(expected);
    expect(resolveActivationEventId(eventName, 'user-b', undefined)).not.toBe(expected);
  });
  it('preserves IDs provided by current clients', () => {
    expect(resolveActivationEventId('onboarding_started', 'user-a', 'onboarding_v2_started')).toBe('onboarding_v2_started');
  });
  it('does not synthesize IDs for unrelated or malformed event names', () => {
    for (const eventName of ['onboarding_v2_started', 'onboarding_skipped', 'other', '']) {
      expect(resolveActivationEventId(eventName, 'user-a', undefined)).toBeUndefined();
    }
  });
  it('does not forward a non-string client ID', () => {
    expect(resolveActivationEventId('onboarding_started', 'user-a', 100)).toBeUndefined();
  });
});
