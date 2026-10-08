import type { VerificationProvider, VerificationSessionRequest, VerificationSessionResponse, VerificationResult } from './types';

export class DiditProvider implements VerificationProvider {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, apiSecret: string, baseUrl = 'https://api.didit.me/v1') {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = baseUrl;
  }

  getProviderName(): string { return 'didit'; }

  async createSession(_req: VerificationSessionRequest): Promise<VerificationSessionResponse> {
    if (!this.apiKey || !this.apiSecret) throw new Error('Didit credentials not configured');
    if (this.baseUrl === 'mock') throw new Error('Mock verification is disabled in production');
    throw new Error('Didit session API integration is not configured');
  }

  async handleWebhook(_payload: unknown, _signature?: string): Promise<VerificationResult | null> {
    throw new Error('Didit webhook verification is not configured');
  }
}
