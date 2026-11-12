import { logSafeFailure } from '../safeErrorLog';
/**
 * Account / consent routes.
 * Handlers live in datenschutz.ts and trustAndSafety.ts — this file only mounts them (move-only).
 */
import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { distributedRateLimit } from '../distributedRateLimiter';
import { ipKeyGenerator } from 'express-rate-limit';
import type { TenantAwareFirestoreRepository } from '../../../functions/src/firestoreRepository/TenantAwareFirestoreRepository';
import { getAuth as getAdminAuth, type Auth } from 'firebase-admin/auth';
import {
  handleAlter,
  handleEinwilligung,
  handleEinwilligungZweck,
  handleEinwilligungLesen,
  handleEinwilligungWiderruf,
  handleExport,
} from '../datenschutz';
import { handleDeleteAccount } from '../trustAndSafety';
import { z } from 'zod';
import { SUPPORTED_LANGUAGES } from '../../i18n/locale';

const counterSchema = z.object({count: z.number().int().nonnegative().optional(), windowStartedAt: z.number().finite().optional()}).passthrough();
const record = z.record(z.string(), z.unknown());
export type AccountRouterDeps = {
  repository: () => TenantAwareFirestoreRepository;
  /** Matches src/server/authorization.ts currentUserId */
  currentUserId: (req: Request) => string | null;
  getAuth?: () => Auth;
};

export function createAccountRouter(deps: AccountRouterDeps): Router {
  const router = Router();
  const { repository, currentUserId } = deps;
  const authProvider = deps.getAuth ?? (() => getAdminAuth());
  const preferences = z.object({ language: z.enum(SUPPORTED_LANGUAGES) }).strict();
  const accountDeleteLimiter = async (req: Request, res: Response, next: () => void) => {
    const uid = currentUserId(req);
    if (!uid) return next();
    const db = repository();
    const ref = `account_deletion_rate_limits/${crypto.createHash('sha256').update(`klar-account-delete:${uid}`).digest('hex')}`;
    const now = Date.now();
    try {
      const allowed = await db.transaction(async tx => {
        const data = await tx.read(ref, counterSchema);
        const windowStartedAt = Number(data?.windowStartedAt) || now;
        const count = Number(data?.count) || 0;
        const windowMs = 24 * 60 * 60 * 1000;
        if (!data || now - windowStartedAt >= windowMs) {
          tx.write(ref, counterSchema, { count: 1, windowStartedAt: now, expiresAt: new Date(now + windowMs) });
          return true;
        }
        if (count >= 3) return false;
        tx.write(ref, counterSchema, { count: count + 1, expiresAt: new Date(windowStartedAt + windowMs) }, {merge:true});
        return true;
      });
      if (!allowed) return res.status(429).json({ error: 'Zu viele Löschanträge. Bitte später erneut versuchen.' });
      return next();
    } catch {
      logSafeFailure('account_deletion_limit_failure');
      return res.status(503).json({ error: 'Löschantrag derzeit nicht verfügbar.' });
    }
  };
  const accountAlterLimiter = distributedRateLimit({
    collection: 'rate_limit_account_alter',
    windowMs: 60 * 60 * 1000,
    limit: 5,
    keyGenerator: (req) => currentUserId(req) ?? '',
    message: { error: 'Zu viele Altersprüfungen. Bitte später erneut versuchen.' },
    repository,
  });
  const accountAlterSchema = z.object({
    geburtsdatum: z.string().trim().min(1).max(10).regex(/^\d{4}-\d{2}-\d{2}$/, 'INVALID_DATE_FORMAT'),
  }).strict();
  const accountExportLimiter = distributedRateLimit({
    collection: 'rate_limit_account_export',
    windowMs: 24 * 60 * 60 * 1000,
    limit: 2,
    keyGenerator: (req) => {
      const uid = currentUserId(req);
      return uid ? 'uid:' + uid : '';
    },
    message: { error: 'Zu viele Auskunftsanfragen. Bitte später erneut versuchen.' },
    repository,
  });
  const accountPreferencesLimiter = distributedRateLimit({
    collection: 'rate_limit_account_preferences',
    windowMs: 15 * 60 * 1000,
    limit: 30,
    keyGenerator: (req) => currentUserId(req) ?? 'ip:' + ipKeyGenerator(req.ip ?? ''),
    message: { error: 'Zu viele Einstellungsänderungen. Bitte später erneut versuchen.' },
    repository,
  });
  const consentWriteLimiter = distributedRateLimit({
    collection: 'rate_limit_consent_write',
    windowMs: 15 * 60 * 1000,
    limit: 20,
    keyGenerator: (req) => currentUserId(req) ?? 'ip:' + ipKeyGenerator(req.ip ?? ''),
    message: { error: 'Zu viele Einwilligungsänderungen. Bitte später erneut versuchen.' },
    repository,
  });
  router.post('/auth/logout', async (req, res) => {
    const uid = currentUserId(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    try {
      // Server-authoritative revocation: all existing Firebase refresh tokens
      // for this UID become unusable immediately after this request succeeds.
      await authProvider().revokeRefreshTokens(uid);

      // Push delivery must not survive an explicit sign-out. The canonical
      // device-token store is UID-scoped below users/{uid}/fcmTokens.
      // Read again after each bounded delete, so >200 tokens cannot survive logout.
      for (;;) {
        const tokens = await repository().list(`users/${uid}/fcmTokens`, record, {limit:200});
        if (!tokens.length) break;
        await repository().transaction(async tx => { for (const token of tokens) tx.delete(`users/${uid}/fcmTokens/${token.id}`); });
      }

      res.clearCookie('__session');
      return res.json({ success: true, timestamp: new Date().toISOString() });
    } catch {
      logSafeFailure('account_logout_failure');
      return res.status(503).json({ error: 'Abmeldung konnte serverseitig nicht vollständig abgeschlossen werden.' });
    }
  });

  router.patch('/account/preferences', accountPreferencesLimiter, async (req, res) => {
    const uid = currentUserId(req);
    if (!uid) return res.status(401).json({ code: 'unauthorized' });
    const result = preferences.safeParse(req.body);
    if (!result.success) return res.status(400).json({ code: 'invalid_preferences' });
    try {
      await repository().transaction(async tx => {
        const [owner, deletion] = await Promise.all([tx.read(`users/${uid}`, record), tx.read(`account_deletions/${uid}`, record)]);
        if (!owner || deletion) throw new Error('account_unavailable');
        tx.write(`users/${uid}`, record, result.data, {merge:true});
      });
      return res.json({ ok: true, preferences: result.data });
    } catch { return res.status(503).json({ code: 'preferences_unavailable' }); }
  });

  router.post('/account/delete', accountDeleteLimiter, handleDeleteAccount);
  router.post('/account/alter', accountAlterLimiter, (req, res, next) => {
    const parsed = accountAlterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'INVALID_DATE_FORMAT',
        error: 'Ungültiges Geburtsdatum. Verwende das Format JJJJ-MM-TT.',
      });
    }
    req.body = parsed.data;
    return handleAlter(req, res, repository()).catch(next);
  });
  router.get('/account/export', accountExportLimiter, handleExport);
  router.get('/einwilligung', handleEinwilligungLesen);
  router.post('/einwilligung', consentWriteLimiter, handleEinwilligung);
  router.post('/einwilligung/zweck', consentWriteLimiter, handleEinwilligungZweck);
  router.post('/einwilligung/widerruf', consentWriteLimiter, handleEinwilligungWiderruf);

  router.get('/account/status', async (req, res) => {
    try {
      const uid = currentUserId(req);
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });

      try {
        const data = await repository().read(`users/${uid}`, record);
        return res.json({
          ok: true,
          isAdult: data?.isAdult === true,
          einwilligung: data?.einwilligung ?? null,
        });
      } catch {
        logSafeFailure('account_status_read_failure');
        return res.status(503).json({ error: 'Account status unavailable' });
      }
    } catch {
      return res.status(401).json({
        error: 'Unauthorized',
      });
    }
  });

  return router;
}
