// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import {
  handleVerificationStatus, handleVerificationChallenge,
  handleVerificationSubmit, handleVerificationDecide,
} from '../src/server/klarCore';

// Compatibility exports must fail closed even if an old API route incorrectly
// remounts the handlers. No Firestore client, GCS bucket or auth required.
describe('retired legacy biometric handler implementation boundary', () => {
  const handlers = {
    status: handleVerificationStatus,
    challenge: handleVerificationChallenge,
    submit: handleVerificationSubmit,
    decide: handleVerificationDecide,
  };
  for (const [name, handler] of Object.entries(handlers)) {
    it('returns 410 without accessing identity, GCS or Firestore: ' + name, async () => {
      const json = vi.fn();
      const status = vi.fn(() => ({ json }));
      const request = {
        user: undefined, // no identity token: must not reach any legacy auth path
        body: { pfad: 'verification/other/unsafe.jpg', bildBase64: 'AA==', entscheidung: 'bestaetigt' },
      } as unknown as Request;
      await handler(request, { status } as unknown as Response);
      expect(status).toHaveBeenCalledOnce();
      expect(status).toHaveBeenCalledWith(410);
      expect(json).toHaveBeenCalledOnce();
      expect(json).toHaveBeenCalledWith({
        code: 'verification_retired',
        error: 'Use the Didit identity verification flow.',
      });
    });
  }
});
