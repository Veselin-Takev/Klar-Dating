import express, { Router, type Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Firestore } from 'firebase-admin/firestore';

export type LaunchRouterDeps = {
  currentUserId: (req: Request) => string | null;
  getFirestore: () => Firestore;
  normalizeLaunchCity: (value: unknown) => string | null;
  getLocalDensity: (db: Firestore, city: unknown) => Promise<{ city: string; activeUsers: number; verifiedUsers: number; band: string; threshold: number }>;
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
  const referralClaimLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    keyGenerator: (req) => deps.currentUserId(req) ?? ipKeyGenerator(ipKeyGenerator(req.ip ?? '') ?? ''),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Zu viele Einladungsversuche. Bitte später erneut versuchen.' },
  });
  const activationWriteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    keyGenerator: (req) => deps.currentUserId(req) ?? ipKeyGenerator(ipKeyGenerator(req.ip ?? '') ?? ''),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Zu viele Aktivierungsereignisse. Bitte später erneut versuchen.' },
  });
  const foundingClaimLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 3,
    keyGenerator: (req) => deps.currentUserId(req) ?? ipKeyGenerator(ipKeyGenerator(req.ip ?? '') ?? ''),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Zu viele Founding-Member-Versuche. Bitte später erneut versuchen.' },
  });

  const referralGenerationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    keyGenerator: (req) => deps.currentUserId(req) ?? ipKeyGenerator(ipKeyGenerator(req.ip ?? '') ?? ''),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Zu viele Einladungslink-Anfragen. Bitte später erneut versuchen.' },
  });

  const launchSummaryReadLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    keyGenerator: (req) => deps.currentUserId(req) ?? ipKeyGenerator(ipKeyGenerator(req.ip ?? '') ?? ''),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Zu viele Launch-Status-Anfragen. Bitte später erneut versuchen.' },
  });

  const activationSummaryReadLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    keyGenerator: (req) => deps.currentUserId(req) ?? ipKeyGenerator(ipKeyGenerator(req.ip ?? '') ?? ''),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Zu viele Aktivierungsstatus-Anfragen. Bitte später erneut versuchen.' },
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
      await deps.getFirestore().collection('users').doc(uid).set({ referralCode: code }, { merge: true });
      return res.json({ code, shareUrl: `${publicUrl.replace(/\/$/, '')}/?ref=${encodeURIComponent(code)}` });
    } catch (error) {
      console.error('Referral generation failed', error);
      return res.status(503).json({ error: 'Einladungslink derzeit nicht verfügbar.' });
    }
  });

  router.post('/referral/claim', express.json({ limit: '8kb', strict: true }), referralClaimLimiter, async (req, res) => {
    try {
      const uid = deps.currentUserId(req);
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });
      const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
      if (!/^[A-Z0-9]{10}$/.test(code)) return res.status(400).json({ error: 'Ungültiger Einladungslink.' });
      const db = deps.getFirestore();
      const inviterSnap = await db.collection('users').where('referralCode', '==', code).limit(1).get();
      if (inviterSnap.empty || inviterSnap.docs[0]?.id === uid) return res.status(400).json({ error: 'Einladung nicht verfügbar.' });
      const userRef = db.collection('users').doc(uid);
      const inviterRef = inviterSnap.docs[0]?.ref;
      await db.runTransaction(async (tx: unknown) => {
        const userSnap = await tx.get(userRef);
        if (!inviterRef) return;
        const inviter = await tx.get(inviterRef) as unknown;
        if (userSnap.data()?.referredBy || inviter.data()?.referralCode !== code) return;
        tx.set(userRef, { referredBy: (inviterRef as unknown).id, referralQualified: false }, { merge: true });
        tx.set(db.collection('referral_events').doc(`${(inviterRef as unknown).id}_${uid}`), {
          inviterUid: (inviterRef as unknown).id, inviteeUid: uid, createdAt: deps.serverTimestamp(), status: 'attributed',
        }, { merge: true });
      });
      return res.json({ ok: true });
    } catch (error) {
      console.error('Referral claim failed', error);
      return res.status(500).json({ error: 'Einladung konnte nicht übernommen werden.' });
    }
  });

  router.post('/activation', express.json({ limit: '8kb', strict: true }), activationWriteLimiter, async (req, res) => {
    try {
      const uid = deps.currentUserId(req);
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });
      const result = await deps.recordActivation(
        deps.getFirestore(), uid, String(req.body?.eventName ?? ''),
        req.body?.eventId ?? (/^onboarding_v2_(started|completed)$/.test(String(req.body?.eventName ?? '')) ? `${String(req.body?.eventName)}_${uid}` : undefined),
        typeof req.body?.metadata === 'object' && req.body.metadata ? req.body.metadata : {},
      );
      return res.status(201).json(result);
    } catch (error: unknown) {
      if (error?.code === 6 || String(error?.message).includes('Already exists')) return res.status(200).json({ duplicate: true });
      return res.status(400).json({ error: 'Ungültiges Aktivierungsereignis.' });
    }
  });

  router.post('/launch/founding-claim', express.json({ limit: '8kb', strict: true }), foundingClaimLimiter, async (req, res) => {
    try {
      const uid = deps.currentUserId(req);
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });
      const db = deps.getFirestore();
      const userRef = db.collection('users').doc(uid);
      const cohortRef = db.collection('system').doc('founding_500');
      const result = await db.runTransaction(async (tx: unknown) => {
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

  router.get('/activation/summary', activationSummaryReadLimiter, async (req, res) => {
    try {
      const uid = deps.currentUserId(req);
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });
      const snap = await deps.getFirestore().collection('activation_events').where('uid', '==', uid).limit(100).get();
      const events: string[] = snap.docs.map((doc: unknown) => String(doc.data().eventName ?? ''));
      const unique = Array.from(new Set(events));
      return res.json({ ...deps.activationScore(unique), events: unique });
    } catch (error) {
      console.error('Activation summary failed', error);
      return res.status(503).json({ error: 'Aktivierungsstatus derzeit nicht verfügbar.' });
    }
  });

  return router;
}
