import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFatigueScore,
  evaluateSessionMindfulness,
} from '../../src/server/platform/mindfulGuard';
import { leererPlan } from '../../src/lib/pausenplan';

test('calculateFatigueScore combines time and rapid rejection indicators', () => {
  const zeroScore = calculateFatigueScore(0, 0);
  assert.equal(zeroScore, 0);

  const moderateScore = calculateFatigueScore(20, 5);
  assert.ok(moderateScore > 30 && moderateScore < 60);

  const highTimeScore = calculateFatigueScore(50, 0);
  assert.ok(highTimeScore >= 60);

  const cappedScore = calculateFatigueScore(120, 30);
  assert.equal(cappedScore, 100);
});

test('evaluateSessionMindfulness flags rapid swipe fatigue with warning and prompt', () => {
  const res = evaluateSessionMindfulness({
    sessionDurationMinutes: 10,
    rapidRejectionsInWindow: 16,
    currentDate: new Date('2026-09-24T14:00:00Z'),
  });

  assert.equal(res.state, 'fatigue_warning');
  assert.equal(res.isBreakRecommended, true);
  assert.equal(res.recommendedBreakMinutes, 15);
  assert.ok(res.message?.includes('Achtsamkeits-Hinweis'));
  assert.ok(res.reflectionPrompt?.includes('Werte und Eigenschaften'));
});

test('evaluateSessionMindfulness triggers break recommendation on long continuous session', () => {
  const res = evaluateSessionMindfulness({
    sessionDurationMinutes: 50,
    rapidRejectionsInWindow: 2,
    currentDate: new Date('2026-09-24T14:00:00Z'),
  });

  assert.equal(res.state, 'break_recommended');
  assert.equal(res.isBreakRecommended, true);
  assert.equal(res.recommendedBreakMinutes, 30);
  assert.ok(res.message?.includes('Schon über 45 Minuten aktiv'));
});

test('evaluateSessionMindfulness enforces scheduled digital pause when plan hour matches', () => {
  const plan = leererPlan();
  // Set Thursday 14:00 to paused (now is 2026-09-24 which is Thursday, day index 3)
  const thursdayHours = plan[3];
  if (thursdayHours) {
    thursdayHours[14] = true;
  }

  const res = evaluateSessionMindfulness({
    sessionDurationMinutes: 5,
    rapidRejectionsInWindow: 0,
    pauseSchedule: plan,
    currentDate: new Date('2026-09-24T14:30:00'), // Thursday 14:30 local time
  });

  assert.equal(res.state, 'scheduled_pause');
  assert.equal(res.fatigueScore, 100);
  assert.equal(res.isBreakRecommended, true);
  assert.ok(res.message?.includes('Geplante Auszeit aktiv'));
});

test('evaluateSessionMindfulness confirms healthy state for mindful sessions', () => {
  const res = evaluateSessionMindfulness({
    sessionDurationMinutes: 12,
    rapidRejectionsInWindow: 3,
    currentDate: new Date('2026-09-24T10:00:00Z'),
  });

  assert.equal(res.state, 'healthy');
  assert.equal(res.isBreakRecommended, false);
  assert.ok(res.fatigueScore < 50);
});
