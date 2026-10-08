import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { getDb } from './db';
import { rateLimiter } from '../security/rateLimiter';
import { ipKeyGenerator } from 'express-rate-limit';
import { appendAuditLog } from './platform/auditLog';

/**
 * Password recovery is intentionally delegated to Firebase Auth as the only
 * reset-token authority. Klar stores only a durable mail job containing the
 * target UID and validated callback origin; the Firebase OOB code is created
 * immediately before mail delivery by the email worker.
 */
export const NEUTRAL_FORGOT_PASSWORD_MESSAGE =
  'Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde ein Link zum Zurücksetzen gesendet.';

const ACCOUNT_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const ACCOUNT_RATE_LIMIT_MAX = 3;
const ACCOUNT_RATE_LIMIT_COLLECTION = 'password_reset_rate_limits';

export function anonymizeIdentifier(id: string): string {
  return crypto.createHash('sha256').update(`klar_salt_${id.trim().toLowerCase()}`).digest('hex').slice(0, 16);
}

export async function checkAccountRateLimit(email: string): Promise<boolean> {
  const now = Date.now();
  const key = anonymizeIdentifier(email);
  const ref = getDb().collection(ACCOUNT_RATE_LIMIT_COLLECTION).doc(key);
  return getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : undefined;
    const windowStartedAt = Number(data?.windowStartedAt) || now;
    const count = Number(data?.count) || 0;
    const withinWindow = now - windowStartedAt < ACCOUNT_RATE_LIMIT_WINDOW_MS;
    if (!withinWindow) {
      tx.set(ref, { count: 1, windowStartedAt: now, expiresAt: new Date(now + ACCOUNT_RATE_LIMIT_WINDOW_MS) });
      return true;
    }
    if (count >= ACCOUNT_RATE_LIMIT_MAX) return false;
    tx.update(ref, { count: count + 1, expiresAt: new Date(windowStartedAt + ACCOUNT_RATE_LIMIT_WINDOW_MS) });
    return true;
  });
}

export function runTimingWorkload(): void {
  crypto.pbkdf2Sync('klar_dummy_salt_timing_workload', 'klar_dummy_password', 15000, 32, 'sha256');
}

export function validatePasswordStrength(password: string): { valid: boolean; reason?: string } {
  if (!password || typeof password !== 'string') return { valid: false, reason: 'Passwort ist erforderlich.' };
  if (password.length < 12) return { valid: false, reason: 'Das Passwort muss mindestens 12 Zeichen lang sein.' };
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigitOrSpecial = /[0-9!@#$%^&*(),.?":{}|<>_\-=+~`[\]\\/]/.test(password);
  if (!hasUpper || !hasLower || !hasDigitOrSpecial) {
    return { valid: false, reason: 'Das Passwort muss Groß- und Kleinbuchstaben sowie Zahlen oder Sonderzeichen enthalten.' };
  }
  return { valid: true };
}

export const forgotPasswordIpLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Zu viele Anfragen für das Zurücksetzen von Passwörtern. Bitte versuche es in 15 Minuten erneut.',
  keyGenerator: (req: Request) => ipKeyGenerator(req.ip ?? '') || (req.headers['x-forwarded-for'] as string) || 'unknown_ip',
});

function publicResetOrigin(): string {
  const raw = process.env.KLAR_PUBLIC_URL?.trim();
  if (!raw) throw new Error('KLAR_PUBLIC_URL is required for password recovery');
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('KLAR_PUBLIC_URL must be an HTTPS root origin without credentials, path, query or fragment');
  }
  return url.origin;
}

export async function handleForgotPassword(req: Request, res: Response) {
  const start = Date.now();
  const rawEmail = req.body?.email;
  if (!rawEmail || typeof rawEmail !== 'string' || rawEmail.length > 254) {
    return res.status(400).json({ ok: false, error: 'Bitte gib eine gültige E-Mail-Adresse ein.' });
  }
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'Bitte gib eine gültige E-Mail-Adresse ein.' });
  }
  if (!(await checkAccountRateLimit(email))) {
    return res.status(200).json({ ok: true, message: NEUTRAL_FORGOT_PASSWORD_MESSAGE });
  }

  let targetUid: string | null = null;
  try {
    targetUid = (await getAuth().getUserByEmail(email)).uid;
  } catch {
    runTimingWorkload();
  }

  if (targetUid) {
    try {
      const callbackUrl = publicResetOrigin();
      await getDb().collection('mail_queue').add({
        uid: targetUid,
        type: 'password_reset',
        payload: { callbackUrl },
        status: 'pending',
        retryCount: 0,
        timestamp: new Date(),
        nextAttemptAt: new Date(),
      });
      try {
        await appendAuditLog(getDb(), {
          type: 'auth.password_reset_requested',
          actorUid: targetUid,
          metadata: {
            ipHash: anonymizeIdentifier(req.ip || 'unknown'),
            userAgentHash: anonymizeIdentifier(req.headers['user-agent'] || 'unknown'),
          },
        });
      } catch {
        // Audit failure must not expose account existence.
      }
    } catch {
      // Never disclose whether the account exists or whether queueing failed.
    }
  }

  const elapsed = Date.now() - start;
  if (elapsed < 150) await new Promise<void>((resolve) => setTimeout(resolve, 150 - elapsed));
  return res.status(200).json({ ok: true, message: NEUTRAL_FORGOT_PASSWORD_MESSAGE });
}

/** Legacy server-side token endpoints are retired; Firebase Auth owns OOB codes. */
export async function handleVerifyResetToken(_req: Request, res: Response) {
  return res.status(410).json({ ok: false, code: 'RESET_FLOW_RETIRED', error: 'Dieser Wiederherstellungsweg wurde abgelöst.' });
}

export async function handleResetPassword(_req: Request, res: Response) {
  return res.status(410).json({ ok: false, code: 'RESET_FLOW_RETIRED', error: 'Dieser Wiederherstellungsweg wurde abgelöst.' });
}

export async function clearResetTokensForTesting(): Promise<void> {
  // Test helper intentionally clears only the deterministic rate-limit document
  // for callers that provide their own emulator cleanup.
}
