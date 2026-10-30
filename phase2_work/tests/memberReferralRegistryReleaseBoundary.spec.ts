// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// P0 #48 staged change: prevent accidental production activation before the
// registration/claim migration and privacy signoffs are independently approved.
describe('member referral registry release boundary (static source contract)', () => {
  it('keeps the atomic registry unconnected to issuance/claim routes', () => {
    const launch = readFileSync('src/server/routes/launch.ts', 'utf8');
    expect(launch).not.toMatch(/\breserveMemberReferralCode\s*\(/);
    expect(launch).not.toContain('member_referral_code_registry');
  });

  it('denies all client access and explicitly classifies registry for erasure', () => {
    const rules = readFileSync('firestore.rules', 'utf8');
    const deletion = readFileSync('src/server/trustAndSafety.ts', 'utf8');
    const inventory = readFileSync('scripts/loeschkaskade.mjs', 'utf8');
    expect(rules).toMatch(/match \/member_referral_code_registry\/\{code\} \{ allow read, write: if false; \}/);
    expect(deletion).toContain("db.collection('member_referral_code_registry').where('ownerUid', '==', meineUid)");
    expect(inventory).toMatch(/member_referral_code_registry:\s*\{\s*art:\s*'geloescht'/);
  });
});
