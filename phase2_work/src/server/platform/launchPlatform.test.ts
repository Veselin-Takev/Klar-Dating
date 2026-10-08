import { test } from "vitest";
import assert from 'node:assert/strict';
import { activationScore, densityBand, evaluateCityLaunchReadiness, normalizeLaunchCity, referralCodeFor, toPublicProfile } from './launchPlatform';
process.env.REFERRAL_CODE_SECRET = ['test-only', 'referral', 'secret', '01234567890123456789'].join('-');

test('normalizes supported launch cities', () => {
  assert.equal(normalizeLaunchCity('Muenchen'), 'München');
  assert.equal(normalizeLaunchCity('Berlin'), 'Berlin');
  assert.equal(normalizeLaunchCity('unknown'), null);
});

test('density uses meaningful local thresholds', () => {
  assert.equal(densityBand(0), 'building');
  assert.equal(densityBand(5), 'emerging');
  assert.equal(densityBand(20), 'active');
  assert.equal(densityBand(50), 'strong');
});

test('evaluates city launch readiness and recommendations accurately', () => {
  const lowDensity = evaluateCityLaunchReadiness(3, 1, 'München');
  assert.equal(lowDensity.readyForMatching, false);
  assert.equal(lowDensity.band, 'building');
  assert.equal(lowDensity.recommendation, 'invite_more');

  const unverifiedDensity = evaluateCityLaunchReadiness(25, 5, 'Berlin');
  assert.equal(unverifiedDensity.readyForMatching, true);
  assert.equal(unverifiedDensity.band, 'active');
  assert.equal(unverifiedDensity.recommendation, 'boost_verification');

  const readyDensity = evaluateCityLaunchReadiness(30, 20, 'Hamburg');
  assert.equal(readyDensity.readyForMatching, true);
  assert.equal(readyDensity.band, 'active');
  assert.equal(readyDensity.recommendation, 'ready');
});

test('public profile contains only launch-safe fields', () => {
  const p = toPublicProfile('u1', { name: 'Anna', age: 29, location: 'München', bio: 'x', interests: ['Hiking'], plan: 'plus', moodHistory: ['secret'] });
  assert.equal(p?.id, 'u1');
  assert.equal('plan' in (p ?? {}), false);
  assert.equal('moodHistory' in (p ?? {}), false);
});

test('referral code is deterministic and bounded', () => {
  const a = referralCodeFor('user-1');
  assert.equal(a, referralCodeFor('user-1'));
  assert.match(a, /^[A-Z0-9]{10}$/);
});

test('activation score rewards the meaningful connection funnel', () => {
  const result = activationScore(['profile_completed', 'first_recommendations', 'first_contact', 'first_conversation', 'date_planned', 'date_reflected']);
  assert.equal(result.activated, true);
  assert.ok(result.score >= 70);
});
