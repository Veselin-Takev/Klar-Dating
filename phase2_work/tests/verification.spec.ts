import { describe, it, expect, vi } from 'vitest';
import { VerificationManager } from '../src/server/verification/VerificationManager.js';
import { IdNowProvider } from '../src/server/verification/IdNowProvider.js';
import { DiditProvider } from '../src/server/verification/DiditProvider.js';
const request = { userId: 'u1', documentType: 'ID_CARD' as const, frontImageUrl: 'front.jpg' };
describe('verification cannot manufacture success', () => {
  it('both unconfigured vendors fail closed', async () => {
    for (const provider of [new IdNowProvider(), new DiditProvider()]) {
      expect(await provider.isHealthy()).toBe(false);
      await expect(provider.verifyIdentity(request)).rejects.toThrow('not configured');
    }
    expect((await new VerificationManager(new IdNowProvider(), new DiditProvider()).verifyUser(request)).success).toBe(false);
  });
  it('uses a healthy fallback only when it supplies an actual result', async () => {
    const primary = new IdNowProvider(); const secondary = new DiditProvider();
    vi.spyOn(secondary, 'isHealthy').mockResolvedValue(true);
    vi.spyOn(secondary, 'verifyIdentity').mockResolvedValue({ success: true, providerUsed: 'DIDIT', verificationId: 'test-proof', confidenceScore: 1, timestamp: '2026-09-27' });
    expect((await new VerificationManager(primary, secondary).verifyUser(request)).verificationId).toBe('test-proof');
  });
});
