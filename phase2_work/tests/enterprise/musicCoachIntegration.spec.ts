import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateMusicPreferences,
  evaluateMusicCoachContract,
  generateMusicIcebreaker,
} from '../../src/lib/aiCoachService';
import type { UserProfile } from '../../src/types/user';

test('validateMusicPreferences strictly enforces Firestore rules contract', () => {
  // Valid preference payload
  assert.equal(validateMusicPreferences({
    genres: ['Indie', 'Electro', 'Jazz'],
    concertGoer: true,
    playingInstrument: false,
  }), true);

  // Invalid: more than 20 genres (bound in firestore.rules)
  const tooManyGenres = Array.from({ length: 21 }, (_, i) => `Genre ${i}`);
  assert.equal(validateMusicPreferences({
    genres: tooManyGenres,
    concertGoer: true,
    playingInstrument: false,
  }), false);

  // Invalid: non-boolean fields
  assert.equal(validateMusicPreferences({
    genres: ['Rock'],
    concertGoer: 'yes',
    playingInstrument: false,
  }), false);

  // Invalid: missing keys
  assert.equal(validateMusicPreferences({
    genres: ['Pop'],
  }), false);

  // Invalid: null or non-object
  assert.equal(validateMusicPreferences(null), false);
  assert.equal(validateMusicPreferences('string'), false);
});

test('evaluateMusicCoachContract calculates accurate resonance score and shared genres', () => {
  const userA: UserProfile = {
    uid: 'user_a',
    name: 'Sophie',
    interests: ['Musik', 'Kultur'],
    musicPreferences: {
      genres: ['Indie Rock', 'Electronic', 'Jazz'],
      concertGoer: true,
      playingInstrument: true,
    },
  };

  const userB: UserProfile = {
    uid: 'user_b',
    name: 'Maximilian',
    interests: ['Musik', 'Sport'],
    musicPreferences: {
      genres: ['electronic', 'techno', 'indie rock'],
      concertGoer: true,
      playingInstrument: false,
    },
  };

  const report = evaluateMusicCoachContract(userA, userB);

  // Shared genres: 'Indie Rock' and 'Electronic'
  assert.equal(report.sharedGenres.length, 2);
  assert.ok(report.sharedGenres.includes('Indie Rock'));
  assert.ok(report.sharedGenres.includes('Electronic'));

  // Concert affinity: both are true
  assert.equal(report.concertAffinity, true);
  // Jam potential: userB is false
  assert.equal(report.jamPotential, false);

  // Score verification: 2 shared / 4 total = 50% * 50 = 25 + 30 (concerts) = 55
  assert.ok(report.resonanceScore >= 50 && report.resonanceScore <= 60);

  // Coach recommendations & starters
  assert.ok(report.coachInsight.includes('Indie Rock') || report.coachInsight.includes('Electronic'));
  assert.ok(report.recommendedDate.includes('Muffatwerk') || report.recommendedDate.includes('München'));
  assert.ok(report.conversationStarters.length > 0);
});

test('evaluateMusicCoachContract provides graceful fallback when preferences are missing', () => {
  const userA: UserProfile = {
    uid: 'user_a',
    name: 'Elena',
    interests: ['Reisen'],
  };

  const userB: UserProfile = {
    uid: 'user_b',
    name: 'Felix',
    interests: ['Kochen'],
  };

  const report = evaluateMusicCoachContract(userA, userB);
  assert.equal(report.resonanceScore, 0);
  assert.equal(report.sharedGenres.length, 0);
  assert.equal(report.concertAffinity, false);
  assert.equal(report.jamPotential, false);
  assert.ok(report.conversationStarters.length > 0);

  const fallbackIcebreaker = generateMusicIcebreaker(userA, userB);
  assert.ok(typeof fallbackIcebreaker === 'string' && fallbackIcebreaker.length > 10);
});

test('Jam session and instrument potential triggers specialized recommendations', () => {
  const musicianA: UserProfile = {
    uid: 'musician_a',
    name: 'David',
    interests: ['Musik'],
    musicPreferences: {
      genres: ['Blues', 'Funk'],
      concertGoer: false,
      playingInstrument: true,
    },
  };

  const musicianB: UserProfile = {
    uid: 'musician_b',
    name: 'Sarah',
    interests: ['Musik'],
    musicPreferences: {
      genres: ['Jazz', 'Blues'],
      concertGoer: false,
      playingInstrument: true,
    },
  };

  const report = evaluateMusicCoachContract(musicianA, musicianB);
  assert.equal(report.jamPotential, true);
  assert.equal(report.concertAffinity, false);
  assert.ok(report.recommendedDate.includes('Jam Session'));
  assert.ok(report.conversationStarters.some(s => s.includes('Instrument')));
});
