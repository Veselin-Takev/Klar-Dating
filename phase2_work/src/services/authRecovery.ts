import { klarStorage } from '../lib/userScopedStorage';
import { getAuth, sendPasswordResetEmail, sendSignInLinkToEmail, isSignInWithEmailLink,
  signInWithEmailLink, confirmPasswordReset, verifyPasswordResetCode, type User } from 'firebase/auth';
import i18n from '../i18n/config';
import { normalizeLanguage } from '../i18n/locale';

export type RecoveryCode = 'emailRequired' | 'emailSent' | 'magicSent' | 'sendFailed' | 'invalidLink' | 'passwordUpdated';
export interface RecoveryResult { ok: boolean; code: RecoveryCode }
type Completion = { success: boolean; user?: User; needsEmail?: boolean; code?: RecoveryCode };
const MAGIC_EMAIL = 'klar_magic_email';
let pending: { url: string; email: string; result: Promise<Completion> } | null = null;
function callbackUrl() {
  const url = new URL('/login', window.location.origin);
  if (url.protocol !== 'https:' && !(import.meta.env.DEV && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('HTTPS required');
  return url.href;
}
export async function sendPasswordReset(email: string): Promise<RecoveryResult> {
  try {
    const auth = getAuth(); auth.languageCode = normalizeLanguage(i18n.language);
    await sendPasswordResetEmail(auth, email.trim(), { url: callbackUrl(), handleCodeInApp: true });
    return { ok: true, code: 'emailSent' };
  } catch (error) {
    // Same response for existing/non-existing accounts; never expose SDK details.
    if ((error as { code?: string }).code === 'auth/user-not-found') return { ok: true, code: 'emailSent' };
    return { ok: false, code: 'sendFailed' };
  }
}
export async function sendMagicLink(email: string): Promise<RecoveryResult> {
  try {
    const auth = getAuth(); auth.languageCode = normalizeLanguage(i18n.language);
    await sendSignInLinkToEmail(auth, email.trim(), { url: callbackUrl(), handleCodeInApp: true });
    try { klarStorage.setItem(MAGIC_EMAIL, email.trim()); } catch { /* Cross-device form also works without storage. */ }
    return { ok: true, code: 'magicSent' };
  } catch { return { ok: false, code: 'sendFailed' }; }
}
export function hasMagicLink(): boolean {
  return typeof window !== 'undefined' && isSignInWithEmailLink(getAuth(), window.location.href);
}
/** Never read an email from URL parameters: require local state or explicit user input. */
export async function completeMagicLinkSignIn(providedEmail?: string): Promise<Completion> {
  if (!hasMagicLink()) return { success: false };
  const url = window.location.href; let email = providedEmail?.trim();
  if (!email) { try { email = klarStorage.getItem(MAGIC_EMAIL) || undefined; } catch { /* Optional storage. */ } }
  if (!email) return { success: false, needsEmail: true };
  if (pending?.url === url && pending.email === email) return pending.result;
  const result = (async (): Promise<Completion> => {
    try {
      const credential = await signInWithEmailLink(getAuth(), email, url);
      try { klarStorage.removeItem(MAGIC_EMAIL); } catch { /* Optional storage. */ }
      return { success: true, user: credential.user };
    } catch { return { success: false, code: 'invalidLink' }; }
  })();
  pending = { url, email, result };
  try { return await result; } finally { if (pending?.result === result) pending = null; }
}
export async function resetPasswordWithCode(oobCode: string, newPassword: string): Promise<RecoveryResult> {
  try {
    const auth = getAuth(); await verifyPasswordResetCode(auth, oobCode); await confirmPasswordReset(auth, oobCode, newPassword);
    return { ok: true, code: 'passwordUpdated' };
  } catch { return { ok: false, code: 'invalidLink' }; }
}
