import { describe, expect, it } from 'vitest';
import {
  ART9_PURPOSES,
  CURRENT_ART9_CONSENT_VERSION,
  filterProfileSensitiveFields,
  getArt9FieldsToPurge,
  type Art9ConsentState,
} from '../src/server/platform/consentEngine';

const fields = {
  id: 'synthetic-user',
  displayName: 'Test',
  sexualOrientation: 'synthetic',
  seekingGender: 'synthetic',
  religion: 'synthetic',
  beliefs: 'synthetic',
  dietary: 'synthetic',
  healthNotes: 'synthetic',
  aiPersonalitySummary: 'synthetic',
  aiBioSummary: 'synthetic',
  personalityRadar: { axes: ['synthetic'] },
};

function state(enabled: boolean): Art9ConsentState {
  return {
    version: CURRENT_ART9_CONSENT_VERSION,
    updatedAt: '2026-10-13T00:00:00.000Z',
    evidenceHash: 'synthetic',
    purposes: Object.fromEntries(ART9_PURPOSES.map(p => [p, enabled])) as Record<(typeof ART9_PURPOSES)[number], boolean>,
    withdrawnAt: null,
  };
}

describe('Art. 9 profile disclosure filter', () => {
  it.each([null, undefined, { ...state(true), withdrawnAt: '2026-10-13T01:00:00.000Z' }, { ...state(true), version: 0 }])(
    'removes all sensitive and AI-derived attributes without valid active consent',
    consent => {
      const result = filterProfileSensitiveFields(fields, consent);
      expect(result).toEqual({ id: 'synthetic-user', displayName: 'Test' });
      expect(fields.aiPersonalitySummary).toBe('synthetic');
    },
  );

  it('retains approved purposes but strips AI derived fields when only AI consent is denied', () => {
    const consent = state(true);
    consent.purposes.ai_personality_insights = false;
    const result = filterProfileSensitiveFields(fields, consent);
    expect(result.sexualOrientation).toBe('synthetic');
    expect(result).not.toHaveProperty('aiPersonalitySummary');
    expect(result).not.toHaveProperty('aiBioSummary');
    expect(result).not.toHaveProperty('personalityRadar');
  });

  it('allows explicitly approved AI-derived fields', () => {
    expect(filterProfileSensitiveFields(fields, state(true))).toEqual(fields);
  });

  it('keeps disclosure suppression consistent with persistent purge inventory', () => {
    const consent = state(true);
    consent.purposes.ai_personality_insights = false;
    const filtered = filterProfileSensitiveFields(fields, consent);
    for (const key of getArt9FieldsToPurge('ai_personality_insights')) {
      expect(filtered).not.toHaveProperty(key);
    }
  });
});
