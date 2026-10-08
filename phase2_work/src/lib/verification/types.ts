export interface VerificationSessionRequest {
  userId: string;
  callbackUrl?: string;
}

export interface VerificationSessionResponse {
  sessionId: string;
  url: string;
}

export interface VerificationResult {
  userId: string;
  status: 'approved' | 'rejected' | 'pending';
  provider: string;
  timestamp: Date;
}

export interface VerificationProvider {
  createSession(req: VerificationSessionRequest): Promise<VerificationSessionResponse>;
  handleWebhook(payload: unknown, signature?: string): Promise<VerificationResult | null>;
  getProviderName(): string;
}
