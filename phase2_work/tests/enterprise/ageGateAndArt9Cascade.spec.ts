import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBirthdate,
  computeAgeAttemptDigest,
  processAgeVerification,
} from '../../src/server/platform/ageGateEngine';
import {
  recordExplicitConsent,
  revokeExplicitConsent,
} from '../../src/server/platform/consentEngine';

function createMockFirestore(initialDocs: Record<string, any> = {}) {
  const store = new Map<string, any>(Object.entries(initialDocs));

  const firestore = {
    collection: (col: string) => ({
      doc: (id?: string) => {
        const path = id ? `${col}/${id}` : `${col}/generated_${Math.random().toString(36).substring(2, 9)}`;
        return {
          path,
          get: async () => {
            const val = store.get(path);
            return {
              exists: val !== undefined && val !== null,
              data: () => (val ? JSON.parse(JSON.stringify(val)) : undefined),
            };
          },
        };
      },
    }),
    runTransaction: async <T>(updateFn: (t: any) => Promise<T>): Promise<T> => {
      const writes: { type: 'set' | 'delete'; path: string; data?: any; options?: any }[] = [];

      const tx = {
        get: async (ref: any) => {
          const val = store.get(ref.path);
          return {
            exists: val !== undefined && val !== null,
            data: () => (val ? JSON.parse(JSON.stringify(val)) : undefined),
          };
        },
        set: (ref: any, data: any, options?: any) => {
          writes.push({ type: 'set', path: ref.path, data, options });
        },
        delete: (ref: any) => {
          writes.push({ type: 'delete', path: ref.path });
        },
      };

      const result = await updateFn(tx);

      for (const w of writes) {
        if (w.type === 'delete') {
          store.delete(w.path);
        } else if (w.options?.merge) {
          const prev = store.get(w.path) || {};
          store.set(w.path, { ...prev, ...w.data });
        } else {
          store.set(w.path, w.data);
        }
      }

      return result;
    },
  };

  return { firestore, store };
}

test('Age Gate: validateBirthdate enforces calendar validity, future checks and statutory minimum age', () => {
  const fixedNow = new Date('2026-09-25T12:00:00Z');

  // Arrange & Act: Underage user (17 years old)
  const underageResult = validateBirthdate('2009-09-26', fixedNow);
  // Assert
  assert.equal(underageResult.ok, false);
  assert.equal(underageResult.reason, 'zu_jung');
  assert.equal(underageResult.age, 16);

  // Exactly 18th birthday today
  const exactAdultResult = validateBirthdate('2008-09-25', fixedNow);
  assert.equal(exactAdultResult.ok, true);
  assert.equal(exactAdultResult.age, 18);
  assert.equal(exactAdultResult.birthdateClean, '2008-09-25');

  // Adult user (25 years old)
  const adultResult = validateBirthdate('2001-05-15', fixedNow);
  assert.equal(adultResult.ok, true);
  assert.equal(adultResult.age, 25);

  // Future date rejection
  const futureResult = validateBirthdate('2028-01-01', fixedNow);
  assert.equal(futureResult.ok, false);
  assert.equal(futureResult.reason, 'zukunft');

  // Invalid calendar date (Feb 30th)
  const invalidDateResult = validateBirthdate('2000-02-30', fixedNow);
  assert.equal(invalidDateResult.ok, false);
  assert.equal(invalidDateResult.reason, 'ungueltig');

  // Unplausible age (>120 years)
  const unplausibleResult = validateBirthdate('1850-01-01', fixedNow);
  assert.equal(unplausibleResult.ok, false);
  assert.equal(unplausibleResult.reason, 'unplausibel');
});

test('Age Gate: computeAgeAttemptDigest generates deterministic SHA-256 evidence digests', () => {
  const digest1 = computeAgeAttemptDigest({
    userId: 'usr_test_1',
    birthdateSubmitted: '2009-05-01',
    timestamp: '2026-09-25T12:00:00Z',
    outcome: 'rejected_underage',
    ipHash: 'hash_ip_abc',
  });

  const digest2 = computeAgeAttemptDigest({
    userId: 'usr_test_1',
    birthdateSubmitted: '2009-05-01',
    timestamp: '2026-09-25T12:00:00Z',
    outcome: 'rejected_underage',
    ipHash: 'hash_ip_abc',
  });

  assert.equal(digest1, digest2);
  assert.equal(digest1.length, 64);
});

test('Age Gate Zero-Tolerance: processAgeVerification locks underage account, purges minor draft data and logs attempt', async () => {
  const fixedNow = new Date('2026-09-25T12:00:00Z');
  const userId = 'usr_minor_target';

  const { firestore, store } = createMockFirestore({
    [`users/${userId}`]: {
      name: 'Robin',
      bio: 'Draft personal bio that must not be retained',
      photos: ['https://storage.klar.de/photo1.jpg'],
      sexualOrientation: 'queer',
      isAdult: false,
    },
    [`public_profiles/${userId}`]: {
      name: 'Robin',
      bio: 'Public profile draft',
    },
  });

  // Act: Submit 16-year-old birthdate
  const outcome = await processAgeVerification(firestore, userId, '2010-03-15', {
    now: fixedNow,
    ipHash: 'ip_hash_minor',
  });

  // Assert: Immediate lockdown
  assert.equal(outcome.ok, false);
  assert.equal(outcome.status, 'locked_underage');
  assert.equal(outcome.code, 'underage_locked');
  assert.ok(outcome.evidenceDigest);

  // Assert: User state locked and minor draft data completely purged
  const updatedUser = store.get(`users/${userId}`);
  assert.equal(updatedUser.isAdult, false);
  assert.equal(updatedUser.isUnderage, true);
  assert.equal(updatedUser.accountStatus, 'locked_underage');
  assert.equal(updatedUser.bio, null);
  assert.deepEqual(updatedUser.photos, []);
  assert.equal(updatedUser.sexualOrientation, null);

  // Assert: Public profile completely deleted
  assert.equal(store.has(`public_profiles/${userId}`), false);

  // Assert: Immutable attempt log was created
  const attemptKeys = Array.from(store.keys()).filter((k) => k.startsWith('age_verification_attempts/'));
  assert.equal(attemptKeys.length, 1);
  const attempt = store.get(attemptKeys[0]!);
  assert.equal(attempt.userId, userId);
  assert.equal(attempt.outcome, 'rejected_underage');
});

test('Age Gate Zero-Tolerance: processAgeVerification rejects subsequent attempts if account was locked as underage', async () => {
  const userId = 'usr_locked_attempt_tampering';

  const { firestore } = createMockFirestore({
    [`users/${userId}`]: {
      name: 'Alex',
      accountStatus: 'locked_underage',
      isUnderage: true,
      isAdult: false,
    },
  });

  // Act: Tampering attempt to submit adult birthdate on locked account
  const outcome = await processAgeVerification(firestore, userId, '1995-04-20');

  // Assert: Strict rejection without modifying state
  assert.equal(outcome.ok, false);
  assert.equal(outcome.status, 'locked_underage');
  assert.equal(outcome.code, 'account_locked_underage');
});

test('Age Gate: processAgeVerification successfully verifies adult and records active status', async () => {
  const fixedNow = new Date('2026-09-25T12:00:00Z');
  const userId = 'usr_verified_adult_1';

  const { firestore, store } = createMockFirestore({
    [`users/${userId}`]: {
      name: 'Maya',
      accountStatus: 'pending_age',
    },
  });

  // Act: Submit 26-year-old birthdate
  const outcome = await processAgeVerification(firestore, userId, '2000-01-10', {
    now: fixedNow,
    ipHash: 'ip_hash_maya',
  });

  // Assert
  assert.equal(outcome.ok, true);
  assert.equal(outcome.status, 'verified_adult');
  assert.equal(outcome.age, 26);
  assert.ok(outcome.evidenceDigest);

  const updatedUser = store.get(`users/${userId}`);
  assert.equal(updatedUser.isAdult, true);
  assert.equal(updatedUser.isUnderage, false);
  assert.equal(updatedUser.geburtsdatum, '2000-01-10');
  assert.equal(updatedUser.accountStatus, 'active');
});

test('GDPR Art. 9: revokeExplicitConsent cascades purge of sensitive data from user and public_profiles', async () => {
  const fixedNow = new Date('2026-09-25T14:00:00Z');
  const userId = 'usr_cascade_purge_1';

  const { firestore, store } = createMockFirestore({
    [`users/${userId}`]: {
      name: 'Kim',
      sexualOrientation: 'bisexual',
      seekingGender: 'all',
      religion: 'keine',
      dietary: 'vegetarisch',
      aiBioSummary: 'Kreativ, reflektiert und empathisch.',
      personalityRadar: { openness: 85, warmth: 90 },
      city: 'Hamburg',
    },
    [`public_profiles/${userId}`]: {
      name: 'Kim',
      sexualOrientation: 'bisexual',
      seekingGender: 'all',
      city: 'Hamburg',
    },
  });

  // 1. Grant initial consent
  await recordExplicitConsent(
    firestore,
    userId,
    {
      art9_sexual_orientation: true,
      art9_religious_philosophical: true,
      ai_personality_insights: true,
    },
    new Date('2026-09-25T10:00:00Z')
  );

  // 2. Revoke selective purpose (sexual orientation)
  const selectiveRevoke = await revokeExplicitConsent(firestore, userId, 'art9_sexual_orientation', fixedNow);
  assert.equal(selectiveRevoke.ok, true);
  assert.deepEqual(selectiveRevoke.purgedFields, ['sexualOrientation', 'seekingGender']);

  // Assert: Fields purged from user and public_profiles
  const userAfterSelective = store.get(`users/${userId}`);
  assert.equal(userAfterSelective.sexualOrientation, null);
  assert.equal(userAfterSelective.seekingGender, null);
  assert.equal(userAfterSelective.city, 'Hamburg'); // Non-sensitive remains intact

  const publicProfileAfterSelective = store.get(`public_profiles/${userId}`);
  assert.equal(publicProfileAfterSelective.sexualOrientation, null);
  assert.equal(publicProfileAfterSelective.seekingGender, null);
  assert.equal(publicProfileAfterSelective.city, 'Hamburg');

  // 3. Revoke all remaining Art. 9 consent
  const fullRevoke = await revokeExplicitConsent(firestore, userId, 'all', new Date('2026-09-25T16:00:00Z'));
  assert.equal(fullRevoke.ok, true);
  assert.equal(fullRevoke.updatedState.purposes.art9_religious_philosophical, false);
  assert.equal(fullRevoke.updatedState.purposes.ai_personality_insights, false);

  const userAfterFull = store.get(`users/${userId}`);
  assert.equal(userAfterFull.religion, null);
  assert.equal(userAfterFull.aiBioSummary, null);
  assert.equal(userAfterFull.personalityRadar, null);
  assert.equal(userAfterFull.city, 'Hamburg');
});
