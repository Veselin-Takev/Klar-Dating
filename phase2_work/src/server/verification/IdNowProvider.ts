import type { IVerificationProvider, VerificationRequest, VerificationResult } from './types.js';

/** Adapter intentionally unavailable until a real, approved integration is configured. */
export class IdNowProvider implements IVerificationProvider {
  readonly name = 'IDNOW';
  async isHealthy(): Promise<boolean> { return false; }
  async verifyIdentity(_request: VerificationRequest): Promise<VerificationResult> {
    throw new Error('Verification provider not configured');
  }
}
