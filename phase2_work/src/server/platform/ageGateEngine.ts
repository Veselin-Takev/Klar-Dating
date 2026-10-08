/**
 * Klar Platform - Hard Age-Gate & Minor Protection Engine (P0 Zero-Tolerance Mandate)
 * 
 * Implements legal & security mandates:
 * - EU DSA Art. 28: Strictest protection of minors online. Dating services are strictly 18+.
 * - DSGVO Art. 8 / German JuSchG / BGB: Absolute bar against underage registration.
 * - Zero-Retention Policy: Immediate transactional purge of any minor personal data upon detection.
 * - Cryptographic audit trail: Tamper-evident logging of age verification attempts.
 */

import crypto from 'node:crypto';
import { alterInJahren } from '../pure';

export const MINIMUM_AGE = 18;
export const MAXIMUM_PLAUSIBLE_AGE = 120;

export interface AgeValidationResult {
  ok: boolean;
  age?: number;
  reason?: 'fehlt' | 'ungueltig' | 'zukunft' | 'unplausibel' | 'zu_jung';
  birthdateClean?: string;
}

export interface AgeAttemptDigestParams {
  userId: string;
  birthdateSubmitted: string;
  timestamp: string;
  outcome: 'verified_adult' | 'rejected_underage' | 'invalid_input';
  ipHash?: string;
}

/**
 * Normalizes input date from multiple regional formats (ISO YYYY-MM-DD, German DD.MM.YYYY, slash variants)
 * into canonical ISO-8601 YYYY-MM-DD.
 */
export function parseAndNormalizeBirthdate(input: unknown): { clean: string; y: number; m: number; d: number } | null {
  if (typeof input !== 'string' || !input.trim()) return null;
  let raw = input.trim();
  // Strip time component if full ISO timestamp was submitted
  if (raw.includes('T')) {
    raw = raw.split('T')[0] ?? '';
  }

  // 1. ISO format: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(raw);
  if (isoMatch && isoMatch[1] && isoMatch[2] && isoMatch[3]) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    const clean = `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    return { clean, y, m, d };
  }

  // 2. German / European format: DD.MM.YYYY or DD/MM/YYYY
  const deMatch = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(raw);
  if (deMatch && deMatch[1] && deMatch[2] && deMatch[3]) {
    const d = parseInt(deMatch[1], 10);
    const m = parseInt(deMatch[2], 10);
    const y = parseInt(deMatch[3], 10);
    const clean = `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    return { clean, y, m, d };
  }

  return null;
}

/**
 * Computes an immutable SHA-256 digest of the age verification attempt for auditability.
 */
export function computeAgeAttemptDigest(params: AgeAttemptDigestParams): string {
  const payload = JSON.stringify({
    userId: params.userId,
    birthdateHash: crypto.createHash('sha256').update(params.birthdateSubmitted || '').digest('hex'),
    timestamp: params.timestamp,
    outcome: params.outcome,
    ipHash: params.ipHash || 'none',
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Validates birthdate string against strict calendar rules and statutory 18+ limit.
 * Supports both ISO (YYYY-MM-DD) and German localized format (DD.MM.YYYY).
 * Respects Europe/Berlin legal calendar reckoning and § 188 Abs. 3 BGB for leap years.
 */
export function validateBirthdate(birthdateStr: unknown, now: Date = new Date()): AgeValidationResult {
  if (typeof birthdateStr !== 'string' || !birthdateStr.trim()) {
    return { ok: false, reason: 'fehlt' };
  }

  const parsed = parseAndNormalizeBirthdate(birthdateStr);
  if (!parsed) {
    return { ok: false, reason: 'ungueltig' };
  }

  const { clean, y, m, d } = parsed;

  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return { ok: false, reason: 'ungueltig' };
  }

  // Verify real calendar day (e.g. Feb 30th is invalid, Feb 29 in non-leap year is invalid)
  const candidate = new Date(Date.UTC(y, m - 1, d));
  if (
    candidate.getUTCFullYear() !== y ||
    candidate.getUTCMonth() !== m - 1 ||
    candidate.getUTCDate() !== d
  ) {
    return { ok: false, reason: 'ungueltig' };
  }

  // Future check
  if (candidate.getTime() > now.getTime()) {
    return { ok: false, reason: 'zukunft' };
  }

  // Statutory age calculation (Europe/Berlin timezone & § 188 Abs. 3 BGB leap-year handling)
  const age = alterInJahren(candidate, now);

  if (age < 0 || age > MAXIMUM_PLAUSIBLE_AGE) {
    return { ok: false, reason: 'unplausibel' };
  }

  if (age < MINIMUM_AGE) {
    return { ok: false, age, reason: 'zu_jung', birthdateClean: clean };
  }

  return { ok: true, age, birthdateClean: clean };
}

export interface AgeProcessOutcome {
  ok: boolean;
  status: 'verified_adult' | 'locked_underage' | 'rejected_invalid';
  age?: number;
  error?: string;
  code?: string;
  evidenceDigest?: string;
}

/**
 * Transactionally enforces the Hard Age-Gate:
 * - Prevents locked underage accounts from retry tampering.
 * - Underage submissions trigger immediate account lockdown and purge of draft data.
 * - Adult submissions record verified status with tamper-evident audit evidence.
 */
export async function processAgeVerification(
  firestore: unknown,
  userId: string,
  birthdateStr: unknown,
  options?: { now?: Date; ipHash?: string }
): Promise<AgeProcessOutcome> {
  const now = options?.now || new Date();
  const timestampStr = now.toISOString();

  const userRef = firestore.collection('users').doc(userId);
  const publicProfileRef = firestore.collection('public_profiles').doc(userId);
  const attemptRef = firestore.collection('age_verification_attempts').doc();

  let outcome: AgeProcessOutcome;

  await firestore.runTransaction(async (tx: unknown) => {
    const userDoc = await tx.get(userRef);
    const userData = userDoc.data() || {};

    // 1. Zero Tolerance: Check if account is already permanently locked as underage
    if (userData.accountStatus === 'locked_underage' || userData.isUnderage === true) {
      outcome = {
        ok: false,
        status: 'locked_underage',
        error: 'Dieser Account ist aufgrund von Unterschreitung des gesetzlichen Mindestalters dauerhaft gesperrt.',
        code: 'account_locked_underage',
      };
      return;
    }

    // 2. Validate birthdate
    const validation = validateBirthdate(birthdateStr, now);

    if (!validation.ok) {
      if (validation.reason === 'zu_jung') {
        const evidenceDigest = computeAgeAttemptDigest({
          userId,
          birthdateSubmitted: String(birthdateStr || ''),
          timestamp: timestampStr,
          outcome: 'rejected_underage',
          ipHash: options?.ipHash,
        });

        // Record immutable audit entry
        tx.set(attemptRef, {
          userId,
          outcome: 'rejected_underage',
          timestamp: timestampStr,
          evidenceDigest,
          ipHash: options?.ipHash || null,
        });

        // LOCK ACCOUNT & PURGE MINOR DATA (Zero Data Retention)
        tx.set(
          userRef,
          {
            isAdult: false,
            isUnderage: true,
            accountStatus: 'locked_underage',
            lockedAt: timestampStr,
            geburtsdatum: null,
            bio: null,
            interests: [],
            photos: [],
            sexualOrientation: null,
            seekingGender: null,
            draftProfile: null,
            updatedAt: timestampStr,
          },
          { merge: true }
        );

        // Delete public profile if present
        tx.delete(publicProfileRef);

        outcome = {
          ok: false,
          status: 'locked_underage',
          age: validation.age,
          error: `Klar ist erst ab ${MINIMUM_AGE} Jahren zugelassen. Der Account wurde gesperrt.`,
          code: 'underage_locked',
          evidenceDigest,
        };
        return;
      }

      // Invalid format or future date
      outcome = {
        ok: false,
        status: 'rejected_invalid',
        error: validation.reason === 'fehlt'
          ? 'Bitte gib dein Geburtsdatum an.'
          : validation.reason === 'zukunft'
          ? 'Das Datum liegt in der Zukunft.'
          : validation.reason === 'unplausibel'
          ? 'Das Datum ergibt kein plausibles Alter.'
          : 'Das Datum konnte nicht gelesen werden. Format: JJJJ-MM-TT.',
        code: `invalid_birthdate_${validation.reason}`,
      };
      return;
    }

    // 3. SUCCESSFUL ADULT VERIFICATION
    const evidenceDigest = computeAgeAttemptDigest({
      userId,
      birthdateSubmitted: validation.birthdateClean!,
      timestamp: timestampStr,
      outcome: 'verified_adult',
      ipHash: options?.ipHash,
    });

    tx.set(attemptRef, {
      userId,
      outcome: 'verified_adult',
      timestamp: timestampStr,
      evidenceDigest,
      ipHash: options?.ipHash || null,
    });

    tx.set(
      userRef,
      {
        geburtsdatum: validation.birthdateClean,
        isAdult: true,
        isUnderage: false,
        alterGeprueftAm: timestampStr,
        accountStatus: userData.accountStatus === 'pending_age' ? 'active' : (userData.accountStatus || 'active'),
        updatedAt: timestampStr,
      },
      { merge: true }
    );

    outcome = {
      ok: true,
      status: 'verified_adult',
      age: validation.age,
      evidenceDigest,
    };
  });

  return outcome!;
}
