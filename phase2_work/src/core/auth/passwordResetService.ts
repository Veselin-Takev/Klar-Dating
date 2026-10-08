import { klarStorage } from '../../lib/userScopedStorage';
import { getAuth, sendPasswordResetEmail, sendSignInLinkToEmail, confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';

export interface PasswordResetResult {
  success: boolean;
  message?: string;
  error?: string;
  code?: string;
}

export interface PasswordCriteria {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumberOrSpecial: boolean;
}

export interface PasswordStrength {
  score: number; // 0 - 100
  tier: 'weak' | 'medium' | 'strong';
  label: string;
  criteria: PasswordCriteria;
}

/** Check email formal syntax */
export function isValidEmailFormat(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  // Standard RFC 5322 compatible regex
  const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return regex.test(trimmed);
}

/** Evaluate password strength against security best-practices */
export function calculatePasswordStrength(password: string): PasswordStrength {
  const criteria: PasswordCriteria = {
    minLength: password.length >= 12,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumberOrSpecial: /[0-9!@#$%^&*(),.?":{}|<>_\-=+~`[\]\\/]/.test(password),
  };

  let score = 0;
  if (password.length >= 8) score += 15;
  if (criteria.minLength) score += 25;
  if (password.length >= 16) score += 15;
  if (criteria.hasUpper) score += 15;
  if (criteria.hasLower) score += 15;
  if (criteria.hasNumberOrSpecial) score += 15;

  let tier: 'weak' | 'medium' | 'strong' = 'weak';
  let label = 'Schwach';

  if (criteria.minLength && criteria.hasUpper && criteria.hasLower && criteria.hasNumberOrSpecial) {
    if (score >= 80) {
      tier = 'strong';
      label = 'Stark';
    } else {
      tier = 'medium';
      label = 'Mittel';
    }
  } else if (score >= 40) {
    tier = 'medium';
    label = 'Mittel';
  }

  return { score: Math.min(score, 100), tier, label, criteria };
}

/**
 * Request password reset or magic link with Account Enumeration Protection.
 */
export async function requestPasswordReset(
  email: string,
  method: 'password' | 'magic' = 'password'
): Promise<PasswordResetResult> {
  const trimmed = email?.trim() || '';

  if (!trimmed) {
    return { success: false, error: 'Bitte gib deine E-Mail-Adresse ein.' };
  }

  if (!isValidEmailFormat(trimmed)) {
    return { success: false, error: 'Bitte gib eine gültige E-Mail-Adresse ein.' };
  }

  if (method === 'password') {
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, method }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return { success: true, message: data.message || 'Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde ein Link zum Zurücksetzen gesendet.' };
      return { success: false, error: data.error || 'Der Wiederherstellungsdienst ist derzeit nicht verfügbar.' };
    } catch {
      return { success: false, error: 'Der Wiederherstellungsdienst ist derzeit nicht verfügbar.' };
    }
  }

  // Magic-link sign-in remains a direct Firebase Auth flow.
  try {
    const auth = getAuth();
    if (method === 'magic') {
      const actionCodeSettings = {
        url: `${window.location.origin}/login`,
        handleCodeInApp: true,
      };
      await sendSignInLinkToEmail(auth, trimmed, actionCodeSettings);
      try {
        klarStorage.setItem('klar_magic_email', trimmed);
      } catch {
        /* ignore */
      }
    } else {
      await sendPasswordResetEmail(auth, trimmed);
    }
    return {
      success: true,
      message: 'Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde ein Link zum Zurücksetzen gesendet.',
    };
  } catch (err: unknown) {
    // Suppress auth/user-not-found to prevent Account Enumeration!
    if (err?.code === 'auth/user-not-found') {
      return {
        success: true,
        message: 'Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde ein Link zum Zurücksetzen gesendet.',
      };
    }
    return {
      success: false,
      error: 'Ein Fehler ist aufgetreten. Bitte versuche es später erneut.',
    };
  }
}

/** Verify if a reset token / action code is valid */
/** Verify a Firebase Auth OOB action code. */
export async function verifyResetToken(token: string): Promise<{ valid: boolean; email?: string; error?: string }> {
  if (!token) return { valid: false, error: 'Kein Token vorhanden.' };
  try {
    const auth = getAuth();
    const email = await verifyPasswordResetCode(auth, token);
    return { valid: true, email };
  } catch {
    return { valid: false, error: 'Dieser Wiederherstellungslink ist abgelaufen oder wurde bereits verwendet.' };
  }
}

/** Confirm a Firebase Auth password reset; the server never receives the OOB code. */
export async function confirmPasswordResetWithToken(token: string, newPassword: string): Promise<PasswordResetResult> {
  const validation = calculatePasswordStrength(newPassword);
  if (!validation.criteria.minLength || !validation.criteria.hasUpper || !validation.criteria.hasLower || !validation.criteria.hasNumberOrSpecial) {
    return { success: false, error: 'Das Passwort erfüllt die erforderlichen Sicherheitskriterien.', code: 'PASSWORD_WEAK' };
  }
  try {
    await confirmPasswordReset(getAuth(), token, newPassword);
    return { success: true, message: 'Passwort erfolgreich geändert. Alle bestehenden Sitzungen werden von Firebase ungültig gemacht.' };
  } catch {
    return { success: false, error: 'Passwort konnte nicht aktualisiert werden. Bitte versuche es erneut.' };
  }
}
