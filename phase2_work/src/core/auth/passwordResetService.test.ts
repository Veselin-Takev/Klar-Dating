import { vi, describe, it, expect, beforeEach } from 'vitest';
import { requestPasswordReset, calculatePasswordStrength, isValidEmailFormat, verifyResetToken, confirmNewPassword } from './passwordResetService';
import { confirmPasswordReset, sendPasswordResetEmail, verifyPasswordResetCode } from 'firebase/auth';

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  sendPasswordResetEmail: vi.fn(),
  sendSignInLinkToEmail: vi.fn(),
  verifyPasswordResetCode: vi.fn(),
  confirmPasswordReset: vi.fn(),
}));

describe('passwordResetService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('validates email syntax', () => {
    expect(isValidEmailFormat('user@example.com')).toBe(true);
    expect(isValidEmailFormat('user@')).toBe(false);
  });

  it('rates passwords against the complete strength policy', () => {
    expect(calculatePasswordStrength('short1!').tier).toBe('weak');
    expect(calculatePasswordStrength('SicheresPasswort2026!').tier).toBe('strong');
  });

  it('uses the server recovery boundary and returns a neutral success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      message: 'Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde ein Link zum Zurücksetzen gesendet.',
    }) });
    const result = await requestPasswordReset('user@klar.app');
    expect(result.success).toBe(true);
    expect(result.message).toContain('Falls ein Konto');
  });

  it('fails closed on server outage and does not fall back to client reset', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network'));
    const result = await requestPasswordReset('user@klar.app');
    expect(result).toEqual({ success: false, error: 'Der Wiederherstellungsdienst ist derzeit nicht verfügbar.' });
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('verifies Firebase OOB codes without server token transport', async () => {
    vi.mocked(verifyPasswordResetCode).mockResolvedValue('owner@example.test');
    await expect(verifyResetToken('code')).resolves.toEqual({ valid: true, email: 'owner@example.test' });
  });

  it('maps invalid OOB codes to a neutral error', async () => {
    vi.mocked(verifyPasswordResetCode).mockRejectedValue(new Error('provider detail'));
    const result = await verifyResetToken('expired');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('abgelaufen');
  });

  it('rejects weak passwords with a generic security message', async () => {
    await expect(confirmNewPassword('code', 'Kurz1!')).resolves.toEqual({
      success: false,
      error: 'Das Passwort erfüllt die erforderlichen Sicherheitskriterien.',
      code: 'PASSWORD_WEAK',
    });
  });

  it('confirms strong passwords directly through Firebase Auth', async () => {
    vi.mocked(confirmPasswordReset).mockResolvedValue(undefined);
    const result = await confirmNewPassword('code', 'SicheresPasswort2026!');
    expect(result.success).toBe(true);
    expect(confirmPasswordReset).toHaveBeenCalledWith(expect.anything(), 'code', 'SicheresPasswort2026!');
  });
});