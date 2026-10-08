/**
 * Account / consent routes.
 * Handlers live in datenschutz.ts and trustAndSafety.ts — this file only mounts them (move-only).
 */
import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Firestore } from 'firebase-admin/firestore';
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

export type AccountRouterDeps = {
  getFirestore: () => Firestore;
  /** Matches src/server/authorization.ts currentUserId */
  currentUserId: (req: Request) => string | null;
  getAuth?: () => Auth;
};

export function createAccountRouter(deps: AccountRouterDeps): Router {
  const router = Router();
  const { getFirestore, currentUserId } = deps;
  const authProvider = deps.getAuth ?? (() => getAdminAuth());
  const preferences = z.object({ language: z.enum(SUPPORTED_LANGUAGES) }).strict();
  const accountDeleteLimiter = async (req: Request, res: Response, next: () => void) => {
    const uid = currentUserId(req);
    if (!uid) return next();
    const db = getFirestore();
    const ref = db.collection('account_deletion_rate_limits').doc(crypto.createHash('sha256').update(`klar-account-delete:${uid}`).digest('hex'));
    const now = Date.now();
    try {
      const allowed = await db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        const data = snap.exists ? snap.data() : undefined;
        const windowStartedAt = Number(data?.windowStartedAt) || now;
        const count = Number(data?.count) || 0;
        const windowMs = 24 * 60 * 60 * 1000;
        if (now - windowStartedAt >= windowMs) {
          tx.set(ref, { count: 1, windowStartedAt: now, expiresAt: new Date(now + windowMs) });
          return true;
        }
        if (count >= 3) return false;
        tx.update(ref, { count: count + 1, expiresAt: new Date(windowStartedAt + windowMs) });
        return true;
      });
      if (!allowed) return res.status(429).json({ error: 'Zu viele Löschanträge. Bitte später erneut versuchen.' });
      return next();
    } catch (error) {
      console.error('Account deletion rate-limit unavailable', error);
      return res.status(503).json({ error: 'Löschantrag derzeit nicht verfügbar.' });
    }
  };
  const accountAlterLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    keyGenerator: (req) => currentUserId(req) ?? ipKeyGenerator(req.ip ?? ''),
    standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Zu viele Altersprüfungen. Bitte später erneut versuchen.' },
  });
  const accountAlterSchema = z.object({
    geburtsdatum: z.string().trim().min(1).max(10).regex(/^\d{4}-\d{2}-\d{2}$/, 'INVALID_DATE_FORMAT'),
  }).strict();
  const accountExportLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    limit: 2,
    keyGenerator: (req) => {
      const uid = currentUserId(req);
      return uid ? `account-export-${uid}` : `account-export-ip-${req.ip ?? 'unknown'}`;
    },
    standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Zu viele Auskunftsanfragen. Bitte später erneut versuchen.' },
  });
  const accountPreferencesLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    keyGenerator: (req) => currentUserId(req) ?? ipKeyGenerator(req.ip ?? ''),
    standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Zu viele Einstellungsänderungen. Bitte später erneut versuchen.' },
  });
  const consentWriteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    keyGenerator: (req) => currentUserId(req) ?? ipKeyGenerator(req.ip ?? ''),
    standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Zu viele Einwilligungsänderungen. Bitte später erneut versuchen.' },
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
      const tokenSnapshot = await getFirestore()
        .collection('users')
        .doc(uid)
        .collection('fcmTokens')
        .get();
      const tokenDocs = tokenSnapshot.docs ?? [];
      for (let offset = 0; offset < tokenDocs.length; offset += 500) {
        const batch = getFirestore().batch();
        for (const tokenDoc of tokenDocs.slice(offset, offset + 500)) batch.delete(tokenDoc.ref);
        await batch.commit();
      }

      res.clearCookie('__session');
      return res.json({ success: true, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error('Auth logout cleanup failed', error);
      return res.status(503).json({ error: 'Abmeldung konnte serverseitig nicht vollständig abgeschlossen werden.' });
    }
  });

  router.patch('/account/preferences', accountPreferencesLimiter, async (req, res) => {
    const uid = currentUserId(req);
    if (!uid) return res.status(401).json({ code: 'unauthorized' });
    const result = preferences.safeParse(req.body);
    if (!result.success) return res.status(400).json({ code: 'invalid_preferences' });
    try {
      await getFirestore().collection('users').doc(uid).set(result.data, { merge: true });
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
    return handleAlter(req, res).catch(next);
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
        const userDoc = await getFirestore().collection('users').doc(uid).get();
        const data = userDoc?.data();
        return res.json({
          ok: true,
          isAdult: data?.isAdult === true,
          einwilligung: data?.einwilligung ?? null,
        });
      } catch (dbErr) {
        console.error('/account/status database lookup failed:', dbErr);
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
