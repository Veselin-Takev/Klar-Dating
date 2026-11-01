/**
 * Server-owned Didit KYC status is the only authority for a profile refresh.
 * The retired /api/verification/status endpoint always returns HTTP 410.
 */
export const KYC_STATUS_ENDPOINT = '/api/kyc/status' as const;

export type KycRefreshState = 'approved' | 'pending' | 'unavailable';

/** Fail closed for malformed, unknown, stale/legacy or unavailable responses. */
export function classifyKycRefreshStatus(payload: unknown): KycRefreshState {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return 'unavailable';
  const status: unknown = (payload as Record<string, unknown>)['status'];
  if (status === 'approved') return 'approved';
  if (status === 'pending' || status === 'review' || status === 'not_started') return 'pending';
  return 'unavailable';
}
