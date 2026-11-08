import { logSafeFailure } from '../safeErrorLog';
import type { IVerificationProvider, VerificationRequest, VerificationResult } from './types.js';

export class VerificationManager {
  constructor(
    private primary: IVerificationProvider,
    private secondary: IVerificationProvider
  ) {}

  async verifyUser(request: VerificationRequest): Promise<VerificationResult> {
    try {
      if (await this.primary.isHealthy()) {
        return await this.primary.verifyIdentity(request);
      }
    } catch (error) {
      console.warn('verification_primary_unavailable');
    }

    try {
      if (await this.secondary.isHealthy()) {
        logSafeFailure('unclassified_failure');
        return await this.secondary.verifyIdentity(request);
      }
    } catch (error) {
      console.error('verification_secondary_unavailable');
    }

    return {
      success: false,
      providerUsed: 'IDNOW',
      verificationId: '',
      confidenceScore: 0,
      timestamp: new Date().toISOString(),
      error: 'Verification Service Offline (SPOF Prevention triggered)'
    };
  }
}
