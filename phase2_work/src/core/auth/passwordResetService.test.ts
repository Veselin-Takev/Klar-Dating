import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  requestPasswordReset,
  calculatePasswordStrength,
  isValidEmailFormat,
  verifyResetToken,
  confirmNewPassword,
} from './passwordResetService';
import { sendPasswordResetEmail } from 'firebase/auth';

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  sendPasswordResetEmail: vi.fn(),
  sendSignInLinkToEmail: vi.fn(),
  verifyPasswordResetCode: vi.fn(),
  confirmPasswordReset: vi.fn(),
}));

describe('passwordResetService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isValidEmailFormat', () => {
    it('validates correct email formats', () => {
      expect(isValidEmailFormat('user@example.com')).toBe(true);
      expect(isValidEmailFormat('test.name+tag@sub.domain.de')).toBe(true);
    });

    it('rejects invalid email formats', () => {
      expect(isValidEmailFormat('')).toBe(false);
      expect(isValidEmailFormat('not-an-email')).toBe(false);
      expect(isValidEmailFormat('user@')).toBe(false);
      expect(isValidEmailFormat('@domain.com')).toBe(false);
    });
  });

  describe('calculatePasswordStrength', () => {
    it('rates short passwords as weak', () => {
      const res = calculatePasswordStrength('short1!');
      expect(res.tier).toBe('weak');
      expect(res.criteria.minLength).toBe(false);
    });

    it('rates 12+ chars with upper, lower, numbers/symbols as strong', () => {
      const res = calculatePasswordStrength('SicheresPasswort2026!');
      expect(res.tier).toBe('strong');
      expect(res.criteria.minLength).toBe(true);
      expect(res.criteria.hasUpper).toBe(true);
      expect(res.criteria.hasLower).toBe(true);
      expect(res.criteria.hasNumberOrSpecial).toBe(true);
    });
  });

  describe('requestPasswordReset', () => {
    it('returns error for empty or invalid email', async () => {
      const emptyResult = await requestPasswordReset('');
      expect(emptyResult.success).toBe(false);
      expect(emptyResult.error).toBe('Bitte gib deine E-Mail-Adresse ein.');

      const invalidResult = await requestPasswordReset('invalid-email-format');
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error).toBe('Bitte gib eine gültige E-Mail-Adresse ein.');
    });

    it('calls fetch endpoint and returns neutral message on success', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          message: 'Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde ein Link zum Zurücksetzen gesendet.',
        }),
      });
      globalThis.fetch = mockFetch;

      const result = await requestPasswordReset('user@klar.app');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Falls ein Konto mit dieser E-Mail-Adresse existiert');
    });

    it('falls back to Firebase SDK when server fetch fails, suppressing user-not-found', async () => {
      globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));
      vi.mocked(sendPasswordResetEmail).mockRejectedValueOnce({ code: 'auth/user-not-found' } as never);

      const result = await requestPasswordReset('unknown@klar.app');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Falls ein Konto mit dieser E-Mail-Adresse existiert');
    });
  });

  describe('verifyResetToken', () => {
    it('returns false for empty token', async () => {
      const res = await verifyResetToken('');
      expect(res.valid).toBe(false);
    });

    it('calls server endpoint to verify token', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true, emailMasked: 'us****@klar.app' }),
      });

      const res = await verifyResetToken('valid-token-123');
      expect(res.valid).toBe(true);
      expect(res.email).toBe('us****@klar.app');
    });
  });

  describe('confirmNewPassword', () => {
    it('rejects passwords under 12 characters', async () => {
      const res = await confirmNewPassword('token', 'Kurz1!');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Das Passwort muss mindestens 12 Zeichen lang sein.');
    });

    it('successfully confirms password through backend or Firebase SDK', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, message: 'Passwort erfolgreich geändert.' }),
      });

      const res = await confirmNewPassword('token-123', 'SicheresPasswort2026!');
      expect(res.success).toBe(true);
    });
  });
});
