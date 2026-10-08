import type { VerificationProvider, VerificationSessionRequest, VerificationSessionResponse, VerificationResult } from './types';

export class VerificationService {
  private provider: VerificationProvider;

  constructor(provider: VerificationProvider) {
    this.provider = provider;
  }

  async createSession(req: VerificationSessionRequest): Promise<VerificationSessionResponse> {
    return this.provider.createSession(req);
  }

  async handleWebhook(payload: unknown, signature?: string): Promise<VerificationResult | null> {
    return this.provider.handleWebhook(payload, signature);
  }
}
