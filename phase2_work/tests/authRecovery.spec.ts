import { beforeEach, describe, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({ auth: { languageCode: '' }, reset: vi.fn(), send: vi.fn(), signIn: vi.fn(), isLink: vi.fn(), verify: vi.fn(), confirm: vi.fn() }));
vi.mock('firebase/auth', () => ({ getAuth: () => sdk.auth, sendPasswordResetEmail: sdk.reset, sendSignInLinkToEmail: sdk.send, isSignInWithEmailLink: sdk.isLink, signInWithEmailLink: sdk.signIn, verifyPasswordResetCode: sdk.verify, confirmPasswordReset: sdk.confirm }));
import i18n from '../src/i18n/config';
import { completeMagicLinkSignIn, sendMagicLink, sendPasswordReset } from '../src/services/authRecovery';
beforeEach(async () => { vi.resetAllMocks(); localStorage.clear(); history.replaceState(null, '', '/login?mode=signIn&oobCode=test&email=attacker@example.test'); sdk.isLink.mockReturnValue(true); await i18n.changeLanguage('en'); });
describe('email recovery boundaries', () => {
  it('requires explicit email on a new device and never trusts URL email', async () => {
    expect(await completeMagicLinkSignIn()).toEqual({ success: false, needsEmail: true });
    expect(sdk.signIn).not.toHaveBeenCalled();
    sdk.signIn.mockResolvedValue({ user: { uid: 'verified' } });
    expect((await completeMagicLinkSignIn('owner@example.test')).success).toBe(true);
    expect(sdk.signIn).toHaveBeenCalledWith(sdk.auth, 'owner@example.test', location.href);
  });
  it('deduplicates simultaneous link redemption and removes stored email only after success', async () => {
    localStorage.setItem('klar_magic_email', 'owner@example.test');
    let resolve!: (value: unknown) => void;
    sdk.signIn.mockReturnValue(new Promise(r => { resolve = r; }));
    const first = completeMagicLinkSignIn(); const second = completeMagicLinkSignIn();
    expect(sdk.signIn).toHaveBeenCalledTimes(1);
    resolve({ user: { uid: 'verified' } });
    expect((await Promise.all([first, second])).every(r => r.success)).toBe(true);
    expect(localStorage.getItem('klar_magic_email')).toBeNull();
  });
  it('handles expired links without exposing provider errors and permits retry', async () => {
    sdk.signIn.mockRejectedValueOnce(new Error('sensitive-provider-error')).mockResolvedValueOnce({ user: { uid: 'verified' } });
    expect(await completeMagicLinkSignIn('owner@example.test')).toEqual({ success: false, code: 'invalidLink' });
    expect((await completeMagicLinkSignIn('owner@example.test')).success).toBe(true);
  });
  it('uses selected email language and survives unavailable optional storage', async () => {
    sdk.send.mockResolvedValue(undefined);
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    try { expect(await sendMagicLink(' owner@example.test ')).toEqual({ ok: true, code: 'magicSent' }); }
    finally { storage.mockRestore(); }
    expect(sdk.auth.languageCode).toBe('en');
    expect(sdk.send).toHaveBeenCalledWith(sdk.auth, 'owner@example.test', { url: new URL('/login', location.origin).href, handleCodeInApp: true });
  });
  it('does not reveal whether a password account exists', async () => {
    sdk.reset.mockResolvedValueOnce(undefined).mockRejectedValueOnce({ code: 'auth/user-not-found' });
    expect(await sendPasswordReset('existing@example.test')).toEqual(await sendPasswordReset('absent@example.test'));
  });
});
