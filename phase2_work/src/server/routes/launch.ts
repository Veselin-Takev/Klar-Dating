import { logSafeFailure } from '../safeErrorLog';
import express, { Router, type Request } from 'express';
import { distributedRateLimit } from '../distributedRateLimiter';
import { resolveActivationEventId } from './activationEventId';
import type { TenantAwareFirestoreRepository } from '../../../functions/src/firestoreRepository/TenantAwareFirestoreRepository';
import { z } from 'zod';
const record = z.record(z.string(), z.unknown());
import type { LaunchCity } from '../platform/launchPlatform';

export type LaunchRouterDeps = {
  currentUserId: (req: Request) => string | null;
  repository: () => TenantAwareFirestoreRepository;
  normalizeLaunchCity: (value: unknown) => LaunchCity | null;
  getLocalDensity: (db: TenantAwareFirestoreRepository, city: import('../platform/launchPlatform').LaunchCity) => Promise<{ city: string; activeUsers: number; verifiedUsers: number; band: string; threshold: number }>;
  referralCodeFor: (uid: string) => string;
  recordActivation: (db: TenantAwareFirestoreRepository, uid: string, eventName: string, eventId?: string, metadata?: Record<string, unknown>) => Promise<unknown>;
  activationScore: (events: string[]) => { score: number; activated: boolean };
  serverTimestamp: () => unknown;
  publicUrl: () => string | undefined;
  foundingLimit?: number;
};

export function createLaunchRouter(deps: LaunchRouterDeps): Router {
  const router = Router();
  const foundingLimit = deps.foundingLimit ?? 500;

  // Sensitive launch/referral flows are authenticated but still business-write
  // surfaces. Keep their limits UID-scoped so IP rotation cannot multiply the
  // write budget, while preserving a stricter one-time claim limit.
  const referralClaimLimiter = distributedRateLimit({
    collection: 'rate_limit_launch_referral_claim',
    windowMs: 900000,
    limit: 10,
    keyGenerator: (req) => {
      const uid = deps.currentUserId(req);
      return uid ? 'uid:' + uid : '';
    },
    message: { error: 'Zu viele Einladungsversuche. Bitte später erneut versuchen.' },
    repository: deps.repository,
  });
  const activationWriteLimiter = distributedRateLimit({
    collection: 'rate_limit_launch_activation_write',
    windowMs: 900000,
    limit: 30,
    keyGenerator: (req) => {
      const uid = deps.currentUserId(req);
      return uid ? 'uid:' + uid : '';
    },
    message: { error: 'Zu viele Aktivierungsereignisse. Bitte später erneut versuchen.' },
    repository: deps.repository,
  });
  const foundingClaimLimiter = distributedRateLimit({
    collection: 'rate_limit_launch_founding_claim',
    windowMs: 3600000,
    limit: 3,
    keyGenerator: (req) => {
      const uid = deps.currentUserId(req);
      return uid ? 'uid:' + uid : '';
    },
    message: { error: 'Zu viele Founding-Member-Versuche. Bitte später erneut versuchen.' },
    repository: deps.repository,
  });

  const referralGenerationLimiter = distributedRateLimit({
    collection: 'rate_limit_launch_referral_generation',
    windowMs: 3600000,
    limit: 10,
    keyGenerator: (req) => {
      const uid = deps.currentUserId(req);
      return uid ? 'uid:' + uid : '';
    },
    message: { error: 'Zu viele Einladungslink-Anfragen. Bitte später erneut versuchen.' },
    repository: deps.repository,
  });

  const launchSummaryReadLimiter = distributedRateLimit({
    collection: 'rate_limit_launch_summary_read',
    windowMs: 60000,
    limit: 30,
    keyGenerator: (req) => {
      const uid = deps.currentUserId(req);
      return uid ? 'uid:' + uid : '';
    },
    message: { error: 'Zu viele Launch-Status-Anfragen. Bitte später erneut versuchen.' },
    repository: deps.repository,
  });

  const activationSummaryReadLimiter = distributedRateLimit({
    collection: 'rate_limit_launch_activation_summary_read',
    windowMs: 60000,
    limit: 30,
    keyGenerator: (req) => {
      const uid = deps.currentUserId(req);
      return uid ? 'uid:' + uid : '';
    },
    message: { error: 'Zu viele Aktivierungsstatus-Anfragen. Bitte später erneut versuchen.' },
    repository: deps.repository,
  });

  router.get('/launch/summary', launchSummaryReadLimiter, async (req, res) => {
    try {
      const uid = deps.currentUserId(req);
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });
      const userSnap = await deps.repository().read(`users/${uid}`, record);
      const userData = userSnap ?? {};
      const city = deps.normalizeLaunchCity(req.query.city ?? userData.location);
      if (!city) return res.status(400).json({ error: 'Bitte wähle eine unterstützte Stadt.' });
      const density = await deps.getLocalDensity(deps.repository(), city);
      return res.json({
        ...density,
        message: density.activeUsers < 5
          ? 'Wir bauen diese lokale Community gerade auf.'
          : density.activeUsers < 20
            ? 'Die lokale Community wächst – gute Zeit, dabei zu sein.'
            : 'In deiner Stadt ist bereits eine aktive Klar-Community.',
      });
    } catch (error) {
      logSafeFailure('unclassified_failure');
      return res.status(503).json({ error: 'Launch-Information derzeit nicht verfügbar.' });
    }
  });

  router.get('/referral', referralGenerationLimiter, async (req, res) => {
    try {
      const uid = deps.currentUserId(req);
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });
      const publicUrl = deps.publicUrl();
      if (!publicUrl || !/^https:\/\/[^\s]+$/i.test(publicUrl)) {
        return res.status(503).json({ error: 'Referral ist für diese Umgebung noch nicht konfiguriert.' });
      }
      const code = deps.referralCodeFor(uid);
      const db = deps.repository();
      const userRef = `users/${uid}`;
      const deletionRef = `account_deletions/${uid}`;
      const available = await db.transaction(async tx => {
        const [user, deletion] = await Promise.all([tx.read(userRef, record), tx.read(deletionRef, record)]);
        if (!user || deletion !== null) return false;
        tx.write(userRef, record, { referralCode: code }, { merge: true });
        return true;
      });
      if (!available) return res.status(409).json({ error: 'Einladung für dieses Konto derzeit nicht verfügbar.' });

      return res.json({ code, shareUrl: `${publicUrl.replace(/\/$/, '')}/?ref=${encodeURIComponent(code)}` });
    } catch (error) {
      logSafeFailure('unclassified_failure');
      return res.status(503).json({ error: 'Einladungslink derzeit nicht verfügbar.' });
    }
  });

  router.post('/referral/claim', express.json({ inflate: false, limit: '8kb', strict: true }), referralClaimLimiter, async (req, res) => {
    try {
      const uid = deps.currentUserId(req);
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });
      const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
      if (!/^[A-Z0-9_-]{10}$/.test(code)) return res.status(400).json({ error: 'Ungültiger Einladungslink.' });
      const db = deps.repository();
      const inviterSnap = await db.list('users', record, {where:['referralCode','==',code], limit:2});
      if (inviterSnap.length !== 1 || inviterSnap[0]?.id === uid) return res.status(400).json({ error: 'Einladung nicht verfügbar.' });
      const userRef = `users/${uid}`;
      const inviterId = inviterSnap[0]!.id, inviterRef = `users/${inviterId}`;
      const available = await db.transaction(async tx => {
        if (!inviterRef) return false;
        const [userSnap, inviter, userDeletion, inviterDeletion] = await Promise.all([
          tx.read(userRef, record), tx.read(inviterRef, record),
          tx.read(`account_deletions/${uid}`, record), tx.read(`account_deletions/${inviterId}`, record),
        ]);
        if (!userSnap || !inviter || userDeletion || inviterDeletion || inviter.referralCode !== code) return false;
        if (userSnap?.referredBy) return true;
        tx.write(userRef, record, { referredBy: inviterId, referralQualified: false }, { merge: true });
        tx.write(`referral_events/${inviterId}_${uid}`, record, {
          inviterUid: inviterId, inviteeUid: uid, createdAt: deps.serverTimestamp(), status: 'attributed',
        }, { merge: true });
        return true;
      });
      if (!available) return res.status(409).json({ error: 'Einladung für dieses Konto derzeit nicht verfügbar.' });

      return res.json({ ok: true });
    } catch (error) {
      logSafeFailure('unclassified_failure');
      return res.status(500).json({ error: 'Einladung konnte nicht übernommen werden.' });
    }
  });

  router.post('/activation', express.json({ inflate: false, limit: '8kb', strict: true }), activationWriteLimiter, async (req, res) => {
    try {
      const uid = deps.currentUserId(req);
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });
      const eventName = String(req.body?.eventName ?? '');
      const eventId = resolveActivationEventId(eventName, uid, req.body?.eventId);
      const result = await deps.recordActivation(
        deps.repository(), uid, eventName, eventId,
        typeof req.body?.metadata === 'object' && req.body.metadata ? req.body.metadata : {},
      );
      return res.status(201).json(result);
    } catch (error: unknown) {
      const code = error && typeof error === 'object' && 'code' in error ? (error as { code?: unknown }).code : undefined;
      const message = error instanceof Error ? error.message : '';
      if (code === 6 || message.includes('Already exists')) return res.status(200).json({ duplicate: true });
      return res.status(400).json({ error: 'Ungültiges Aktivierungsereignis.' });
    }
  });

  router.post('/launch/founding-claim', express.json({ inflate: false, limit: '8kb', strict: true }), foundingClaimLimiter, async (req, res) => {
    try {
      const uid = deps.currentUserId(req);
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });
      const db = deps.repository();
      const userRef = `users/${uid}`;
      const cohortRef = 'system/founding_500';
      const result = await db.transaction(async tx => {
        const userSnap = await tx.read(userRef, record);
        const cohortSnap = await tx.read(cohortRef, record);
        if (!userSnap) throw new Error('User not found');
        const user = userSnap ?? {};
        if (user.founding500Member === true) return { member: true, rank: user.founding500Rank ?? null, already: true };
        if (user.isAdult !== true || typeof user.location !== 'string' || !deps.normalizeLaunchCity(user.location)) {
          return { member: false, rank: null, reason: 'onboarding_incomplete' };
        }
        const current = Number(cohortSnap?.count ?? 0);
        if (current >= foundingLimit) return { member: false, rank: null, reason: 'cohort_full' };
        const rank = current + 1;
        tx.write(cohortRef, record, { count: rank, updatedAt: deps.serverTimestamp() }, { merge: true });
        tx.write(userRef, record, { founding500Member: true, founding500Rank: rank, founding500JoinedAt: deps.serverTimestamp() }, { merge: true });
        return { member: true, rank, already: false };
      });
      if (result.member && !result.already) {
        await deps.recordActivation(db, uid, 'founding_500_claimed', `founding_500_claimed_${uid}`, { step: 'launch' });
      }
      return res.json(result);
    } catch (error) {
      logSafeFailure('unclassified_failure');
      return res.status(503).json({ error: 'Founding-500-Status derzeit nicht verfügbar.' });
    }
  });

  router.get('/activation/summary', activationSummaryReadLimiter, async (req, res) => {
    try {
      const uid = deps.currentUserId(req);
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });
      const snap = await deps.repository().list('activation_events', record, {where:['uid','==',uid], limit:100});
      const events: string[] = snap.map((doc) => String(doc.data.eventName ?? ''));
      const unique = Array.from(new Set(events));
      return res.json({ ...deps.activationScore(unique), events: unique });
    } catch (error) {
      logSafeFailure('unclassified_failure');
      return res.status(503).json({ error: 'Aktivierungsstatus derzeit nicht verfügbar.' });
    }
  });

  return router;
}
