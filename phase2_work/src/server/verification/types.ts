export interface VerificationRequest {
  userId: string;
  documentType: 'ID_CARD' | 'PASSPORT' | 'DRIVERS_LICENSE';
  frontImageUrl: string;
  backImageUrl?: string;
  faceVideoUrl?: string;
}

export interface VerificationResult {
  success: boolean;
  providerUsed: 'IDNOW' | 'DIDIT';
  verificationId: string;
  confidenceScore: number;
  timestamp: string;
  error?: string;
}

export interface IVerificationProvider {
  readonly name: 'IDNOW' | 'DIDIT';
  verifyIdentity(request: VerificationRequest): Promise<VerificationResult>;
  isHealthy(): Promise<boolean>;
}
