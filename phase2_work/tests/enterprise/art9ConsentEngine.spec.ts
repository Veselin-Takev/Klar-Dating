import test from 'node:test';
import assert from 'node:assert/strict';
import type { Firestore } from 'firebase-admin/firestore';
import {
  computeConsentEvidenceHash,
  evaluateArt9Consent,
  filterProfileSensitiveFields,
  recordExplicitConsent,
  revokeExplicitConsent,
  type Art9ConsentState,
} from '../../src/server/platform/consentEngine';

function createMockFirestore(initialDocs: Record<string, any> = {}) {
  const store = new Map<string, any>(Object.entries(initialDocs));

  const firestore = {
    collection: (col: string) => ({
      doc: (id?: string) => {
        const path = id ? `${col}/${id}` : `${col}/generated_${Math.random().toString(36).substring(2, 9)}`;
        return { path };
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
      };

      const result = await updateFn(tx);

      for (const w of writes) {
        const prev = store.get(w.path) || {};
        if (w.options?.merge) {
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

test('GDPR Art. 9: Deterministic evidence hash computation', () => {
  const hash1 = computeConsentEvidenceHash('user_1', { art9_sexual_orientation: true }, '2026-09-24T12:00:00Z');
  const hash2 = computeConsentEvidenceHash('user_1', { art9_sexual_orientation: true }, '2026-09-24T12:00:00Z');
  assert.equal(hash1, hash2, 'Evidence hash must be strictly reproducible');
  assert.equal(typeof hash1, 'string');
  assert.equal(hash1.length, 64, 'SHA-256 hex digest length must be 64 characters');

  // Modified timestamp produces different hash
  const hash3 = computeConsentEvidenceHash('user_1', { art9_sexual_orientation: true }, '2026-09-24T12:00:01Z');
  assert.notEqual(hash1, hash3);
});

test('GDPR Art. 9: evaluateArt9Consent verifies active version and withdrawal states', () => {
  const activeConsent: Art9ConsentState = {
    version: 1,
    updatedAt: '2026-09-24T10:00:00Z',
    purposes: {
      art9_sexual_orientation: true,
      art9_religious_philosophical: false,
      art9_health_dietary: false,
      ai_personality_insights: true,
    },
    evidenceHash: 'hash_abc',
    withdrawnAt: null,
  };

  assert.equal(evaluateArt9Consent(activeConsent, 'art9_sexual_orientation'), true);
  assert.equal(evaluateArt9Consent(activeConsent, 'art9_religious_philosophical'), false);

  // Withdrawn consent is invalid
  const withdrawnConsent: Art9ConsentState = { ...activeConsent, withdrawnAt: '2026-09-24T11:00:00Z' };
  assert.equal(evaluateArt9Consent(withdrawnConsent, 'art9_sexual_orientation'), false);

  // Outdated version is invalid
  const oldVersionConsent: Art9ConsentState = { ...activeConsent, version: 0 };
  assert.equal(evaluateArt9Consent(oldVersionConsent, 'art9_sexual_orientation'), false);
});

test('GDPR Art. 9: Profile sensitive fields are stripped when consent is absent or denied', () => {
  const rawProfile = {
    id: 'user_123',
    name: 'Alex',
    age: 28,
    bio: 'Naturliebhaber',
    sexualOrientation: 'queer',
    religion: 'buddhistisch',
    dietary: 'vegan',
    city: 'Berlin',
  };

  // 1. Without consent, sensitive fields are completely stripped
  const sanitizedNoConsent = filterProfileSensitiveFields(rawProfile, null);
  assert.equal(sanitizedNoConsent.name, 'Alex');
  assert.equal(sanitizedNoConsent.city, 'Berlin');
  assert.equal((sanitizedNoConsent as any).sexualOrientation, undefined);
  assert.equal((sanitizedNoConsent as any).religion, undefined);
  assert.equal((sanitizedNoConsent as any).dietary, undefined);

  // 2. With partial consent (only sexual orientation)
  const partialConsent: Art9ConsentState = {
    version: 1,
    updatedAt: '2026-09-24T10:00:00Z',
    purposes: {
      art9_sexual_orientation: true,
      art9_religious_philosophical: false,
      art9_health_dietary: false,
      ai_personality_insights: false,
    },
    evidenceHash: 'h',
  };
  const sanitizedPartial = filterProfileSensitiveFields(rawProfile, partialConsent);
  assert.equal(sanitizedPartial.sexualOrientation, 'queer');
  assert.equal((sanitizedPartial as any).religion, undefined);
});

test('GDPR Art. 9: recordExplicitConsent & revokeExplicitConsent maintain tamper-evident audit log', async () => {
  const fixedNow = new Date('2026-09-24T12:00:00Z');
  const { firestore, store } = createMockFirestore({
    'users/usr_carol': { isVerified: true },
  });

  // 1. Grant consent
  const state = await recordExplicitConsent(
    firestore as unknown as Firestore,
    'usr_carol',
    { art9_sexual_orientation: true, art9_religious_philosophical: true },
    fixedNow,
    'hash_ip_123'
  );

  assert.equal(state.purposes.art9_sexual_orientation, true);
  assert.equal(state.purposes.art9_religious_philosophical, true);
  assert.equal(state.purposes.art9_health_dietary, false);
  assert.ok(state.evidenceHash);

  const carolDoc = store.get('users/usr_carol');
  assert.ok(carolDoc.art9Consent);
  assert.equal(carolDoc.art9Consent.purposes.art9_sexual_orientation, true);

  // Verify audit log has at least 1 entry
  const auditEntries = Array.from(store.keys()).filter((k) => k.startsWith('consent_audit_log/'));
  assert.equal(auditEntries.length, 1);

  // 2. Revoke consent
  const revokeTime = new Date('2026-09-24T14:00:00Z');
  const { ok, updatedState } = await revokeExplicitConsent(firestore as unknown as Firestore, 'usr_carol', 'all', revokeTime);
  assert.equal(ok, true);
  assert.equal(updatedState.purposes.art9_sexual_orientation, false);
  assert.equal(updatedState.withdrawnAt, '2026-09-24T14:00:00.000Z');

  // Verify second audit log entry created
  const auditEntriesAfterRevocation = Array.from(store.keys()).filter((k) => k.startsWith('consent_audit_log/'));
  assert.equal(auditEntriesAfterRevocation.length, 2);
});
