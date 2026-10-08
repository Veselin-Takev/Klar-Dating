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
      console.warn(`[Verification] Primary provider (${this.primary.name}) failed.`, error);
    }

    try {
      if (await this.secondary.isHealthy()) {
        console.info(`[Verification] Falling back to Secondary provider (${this.secondary.name})`);
        return await this.secondary.verifyIdentity(request);
      }
    } catch (error) {
      console.error(`[Verification] Secondary provider (${this.secondary.name}) failed.`, error);
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
