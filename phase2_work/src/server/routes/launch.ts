import express, { Router, type Request } from 'express';
import { distributedRateLimit } from '../distributedRateLimiter';
import { resolveActivationEventId } from './activationEventId';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import type { LaunchCity } from '../platform/launchPlatform';

export type LaunchRouterDeps = {
  currentUserId: (req: Request) => string | null;
  getFirestore: () => Firestore;
  normalizeLaunchCity: (value: unknown) => LaunchCity | null;
  getLocalDensity: (db: Firestore, city: import('../platform/launchPlatform').LaunchCity) => Promise<{ city: string; activeUsers: number; verifiedUsers: number; band: string; threshold: number }>;
  referralCodeFor: (uid: string) => string;
  recordActivation: (db: Firestore, uid: string, eventName: string, eventId?: string, metadata?: Record<string, unknown>) => Promise<unknown>;
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
    getDb: deps.getFirestore,
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
    getDb: deps.getFirestore,
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
    getDb: deps.getFirestore,
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
    getDb: deps.getFirestore,
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
    getDb: deps.getFirestore,
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
    getDb: deps.getFirestore,
  });

  router.get('/launch/summary', launchSummaryReadLimiter, async (req, res) => {
    try {
      const uid = deps.currentUserId(req);
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });
      const userSnap = await deps.getFirestore().collection('users').doc(uid).get();
      const userData = userSnap.data() ?? {};
      const city = deps.normalizeLaunchCity(req.query.city ?? userData.location);
      if (!city) return res.status(400).json({ error: 'Bitte wähle eine unterstützte Stadt.' });
      const density = await deps.getLocalDensity(deps.getFirestore(), city);
      return res.json({
        ...density,
        message: density.activeUsers < 5
          ? 'Wir bauen diese lokale Community gerade auf.'
          : density.activeUsers < 20
            ? 'Die lokale Community wächst – gute Zeit, dabei zu sein.'
            : 'In deiner Stadt ist bereits eine aktive Klar-Community.',
      });
    } catch (error) {
      console.error('Launch summary failed', error);
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
      const db = deps.getFirestore();
      const userRef = db.collection('users').doc(uid);
      const deletionRef = db.collection('account_deletions').doc(uid);
      const available = await db.runTransaction(async tx => {
        const [user, deletion] = await tx.getAll(userRef, deletionRef);
        if (!user || !deletion || !user.exists || deletion.exists) return false;
        tx.update(userRef, { referralCode: code });
        return true;
      });
      if (!available) return res.status(409).json({ error: 'Einladung für dieses Konto derzeit nicht verfügbar.' });

      return res.json({ code, shareUrl: `${publicUrl.replace(/\/$/, '')}/?ref=${encodeURIComponent(code)}` });
    } catch (error) {
      console.error('Referral generation failed', error);
      return res.status(503).json({ error: 'Einladungslink derzeit nicht verfügbar.' });
    }
  });

  router.post('/referral/claim', express.json({ inflate: false, limit: '8kb', strict: true }), referralClaimLimiter, async (req, res) => {
    try {
      const uid = deps.currentUserId(req);
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });
      const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
      if (!/^[A-Z0-9_-]{10}$/.test(code)) return res.status(400).json({ error: 'Ungültiger Einladungslink.' });
      const db = deps.getFirestore();
      const inviterSnap = await db.collection('users').where('referralCode', '==', code).limit(1).get();
      if (inviterSnap.empty || inviterSnap.docs[0]?.id === uid) return res.status(400).json({ error: 'Einladung nicht verfügbar.' });
      const userRef = db.collection('users').doc(uid);
      const inviterRef = inviterSnap.docs[0]?.ref;
      const available = await db.runTransaction(async (tx: Transaction) => {
        if (!inviterRef) return false;
        const [userSnap, inviter, userDeletion, inviterDeletion] = await tx.getAll(
          userRef, inviterRef,
          db.collection('account_deletions').doc(uid),
          db.collection('account_deletions').doc(inviterRef.id),
        );
        if (!userSnap || !inviter || !userDeletion || !inviterDeletion
          || !userSnap.exists || !inviter.exists || userDeletion.exists || inviterDeletion.exists
          || inviter.data()?.referralCode !== code) return false;
        if (userSnap.data()?.referredBy) return true;
        tx.update(userRef, { referredBy: inviterRef.id, referralQualified: false });
        tx.set(db.collection('referral_events').doc(`${inviterRef.id}_${uid}`), {
          inviterUid: inviterRef.id, inviteeUid: uid, createdAt: deps.serverTimestamp(), status: 'attributed',
        }, { merge: true });
        return true;
      });
      if (!available) return res.status(409).json({ error: 'Einladung für dieses Konto derzeit nicht verfügbar.' });

      return res.json({ ok: true });
    } catch (error) {
      console.error('Referral claim failed', error);
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
        deps.getFirestore(), uid, eventName, eventId,
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
      const db = deps.getFirestore();
      const userRef = db.collection('users').doc(uid);
      const cohortRef = db.collection('system').doc('founding_500');
      const result = await db.runTransaction(async (tx: Transaction) => {
        const userSnap = await tx.get(userRef);
        const cohortSnap = await tx.get(cohortRef);
        if (!userSnap.exists) throw new Error('User not found');
        const user = userSnap.data() ?? {};
        if (user.founding500Member === true) return { member: true, rank: user.founding500Rank ?? null, already: true };
        if (user.isAdult !== true || typeof user.location !== 'string' || !deps.normalizeLaunchCity(user.location)) {
          return { member: false, rank: null, reason: 'onboarding_incomplete' };
        }
        const current = Number(cohortSnap.data()?.count ?? 0);
        if (current >= foundingLimit) return { member: false, rank: null, reason: 'cohort_full' };
        const rank = current + 1;
        tx.set(cohortRef, { count: rank, updatedAt: deps.serverTimestamp() }, { merge: true });
        tx.set(userRef, { founding500Member: true, founding500Rank: rank, founding500JoinedAt: deps.serverTimestamp() }, { merge: true });
        return { member: true, rank, already: false };
      });
      if (result.member && !result.already) {
        await deps.recordActivation(db, uid, 'founding_500_claimed', `founding_500_claimed_${uid}`, { step: 'launch' });
      }
      return res.json(result);
    } catch (error) {
      console.error('Founding 500 claim failed', error);
      return res.status(503).json({ error: 'Founding-500-Status derzeit nicht verfügbar.' });
    }
  });

  // Activation history is account-private. Set headers before rate limiting and
  // authentication so success and error responses are never cacheable.
  router.use('/activation/summary', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
  router.get('/activation/summary', activationSummaryReadLimiter, async (req, res) => {
    try {
      const uid = deps.currentUserId(req);
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });
      // Read both the deletion marker and activity query in one Firestore
      // transaction, so a concurrent marker write conflicts with this read.
      // No activation data is returned when a deletion marker is present.
      const db = deps.getFirestore();
      const result = await db.runTransaction(async tx => {
        const deletion = await tx.get(db.collection('account_deletions').doc(uid));
        if (deletion.exists) return { deleting: true as const, events: [] as string[] };
        const snap = await tx.get(db.collection('activation_events').where('uid', '==', uid).limit(100));
        return { deleting: false as const, events: snap.docs.map(doc => String(doc.data()?.eventName ?? '')) };
      });
      if (result.deleting) return res.status(409).json({ error: 'Aktivierungsstatus für dieses Konto nicht verfügbar.' });
      const events = result.events;
      const unique = Array.from(new Set(events));
      return res.json({ ...deps.activationScore(unique), events: unique });
    } catch (error) {
      console.error('Activation summary failed', error);
      return res.status(503).json({ error: 'Aktivierungsstatus derzeit nicht verfügbar.' });
    }
  });

  return router;
}
