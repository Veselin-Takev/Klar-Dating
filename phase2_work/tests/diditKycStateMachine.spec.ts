// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { KycError, transitionKycAccountStatus } from '../src/server/verification/diditKyc';

describe('Didit KYC state machine', () => {
  it('rejects unknown provider statuses', () => {
    expect(() => transitionKycAccountStatus('pending', 'Unknown', false)).toThrow(KycError);
    expect(() => transitionKycAccountStatus('pending', 'Unknown', false)).toThrow('invalid_provider_status');
  });
  it('does not grant approval from an incomplete provider decision', () => {
    expect(() => transitionKycAccountStatus('pending', 'Approved', false)).toThrow('incomplete_approval');
  });
  it('rejects an approval flag on a non-approved provider status', () => {
    expect(() => transitionKycAccountStatus('pending', 'Declined', true)).toThrow('invalid_approval_state');
  });
  it('does not allow an approved account to regress to ordinary progress', () => {
    expect(() => transitionKycAccountStatus('approved', 'Declined', false)).toThrow('invalid_kyc_transition');
  });
  it('allows explicit provider expiry to return an account to pending', () => {
    expect(transitionKycAccountStatus('approved', 'Kyc Expired', false)).toBe('pending');
  });
});
