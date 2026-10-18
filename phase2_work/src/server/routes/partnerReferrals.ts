import { Router, type Request, type Response, type NextFunction } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { ipKeyGenerator } from 'express-rate-limit';
import { distributedRateLimit } from '../distributedRateLimiter';
import { getServerFirebaseApp } from '../db';
import {
  PartnerReferralError,
  PartnerConversionPayloadSchema,
  verifyPartnerWebhookSignature,
} from '../partnerReferralCore';
import {
  createPartnerCampaign,
  getPartnerConsentState,
  listPartnerCampaignsForAdmin,
  listPartnerReferralLinks,
  openPartnerReferral,
  recordPartnerClick,
  recordPartnerConversion,
  recordPartnerInteraction,
  setPartnerConsent,
  softDeletePartnerCampaign,
  updatePartnerCampaign,
  type PartnerReferralServiceDeps,
} from '../partnerReferralService';

export type PartnerReferralRouteDeps = PartnerReferralServiceDeps & {
  currentUserId: (req: Request) => string | null;
  webhookSecrets: () => Record<string, string>;
};

function handleError(res: Response, error: unknown, generic: string) {
  if (error instanceof PartnerReferralError) {
    return res.status(error.status).json({ code: error.code, error: error.message });
  }
  return res.status(503).json({ code: 'partner_service_unavailable', error: generic });
}

function uidFrom(req: Request, deps: PartnerReferralRouteDeps): string {
  const uid = deps.currentUserId(req);
  if (!uid) throw new PartnerReferralError(401, 'unauthorized', 'Bitte melde dich erneut an.');
  return uid;
}

function isGuest(req: Request): boolean {
  const user = (req as Request & { user?: Record<string, unknown> }).user;
  const firebase = user?.firebase;
  return !!firebase && typeof firebase === 'object'
    && (firebase as Record<string, unknown>).sign_in_provider === 'anonymous';
}

function requirePartnerAccount(deps: PartnerReferralRouteDeps) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!deps.currentUserId(req)) return res.status(401).json({ code: 'unauthorized', error: 'Bitte melde dich an.' });
    if (isGuest(req)) return res.status(403).json({ code: 'permanent_account_required', error: 'Partner-Empfehlungen stehen nur registrierten Konten zur Verfügung.' });
    return next();
  };
}

/** Admin access is intentionally stricter than generic role fallbacks: Firebase custom claim admin:true is mandatory. */
function requireStrictPartnerAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as Request & { user?: Record<string, unknown> }).user;
  if (!user) return res.status(401).json({ code: 'unauthorized', error: 'Bitte melde dich an.' });
  if (user.admin !== true) return res.status(403).json({ code: 'admin_claim_required', error: 'Für diese Aktion ist die Firebase-Admin-Berechtigung erforderlich.' });
  return next();
}

function optionalVisitorUid(req: Request): Promise<string | null> {
  // Anonymous Firebase authentication must not grant partner attribution.
  if (isGuest(req)) return Promise.resolve(null);
  const existingUid = (req as Request & { user?: { uid?: unknown } }).user?.uid;
  if (typeof existingUid === 'string' && existingUid.length > 0) return Promise.resolve(existingUid);
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !/^Bearer\s+\S+$/.test(header)) return Promise.resolve(null);
  const token = header.slice('Bearer '.length).trim();
  return getAuth(getServerFirebaseApp()).verifyIdToken(token, false)
    .then(decoded => decoded.firebase?.sign_in_provider !== 'anonymous' && typeof decoded.uid === 'string' ? decoded.uid : null)
    .catch(() => null);
}

export function createPartnerReferralPublicRouter(deps: PartnerReferralRouteDeps): Router {
  const router = Router();
  const clickLimiter = distributedRateLimit({
    collection: 'partner_referral_click_rate_limits',
    windowMs: 60_000,
    limit: 90,
    keyGenerator: req => 'ip:' + ipKeyGenerator(req.ip ?? ''),
    message: { code: 'partner_click_rate_limited', error: 'Zu viele Partnerlink-Aufrufe. Bitte später erneut versuchen.' },
    getDb: deps.getFirestore,
  });
  const webhookLimiter = distributedRateLimit({
    collection: 'partner_referral_webhook_rate_limits',
    windowMs: 60_000,
    limit: 120,
    keyGenerator: req => 'campaign:' + String(req.params.slug ?? 'unknown') + ':ip:' + ipKeyGenerator(req.ip ?? ''),
    message: { code: 'partner_webhook_rate_limited', error: 'Zu viele Partner-Rückmeldungen.' },
    getDb: deps.getFirestore,
  });

  const protectPublicPartnerRedirect = (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  };

  // Reject malformed public tokens without DB I/O; valid tokens still pass the
  // distributed limiter before any Firestore referral lookup.
  const validatePublicPartnerToken = (req: Request, res: Response, next: NextFunction) => {
    if (!/^[a-f0-9]{64}$/.test(String(req.params.token ?? ''))) {
      return res.status(404).json({ code: 'partner_link_not_found', error: 'Dieser Partnerlink ist nicht verfügbar.' });
    }
    return next();
  };

  router.get('/partner/click/:token', protectPublicPartnerRedirect, validatePublicPartnerToken, clickLimiter, async (req, res) => {
    try {
      const visitorUid = await optionalVisitorUid(req);
      const result = await recordPartnerClick(deps, String(req.params.token ?? ''), {
        userAgent: req.get('user-agent'),
        purpose: req.get('purpose'),
        secPurpose: req.get('sec-purpose'),
        method: req.method,
      }, visitorUid);
      res.setHeader('Cache-Control', 'no-store, private');
      res.setHeader('Referrer-Policy', 'no-referrer');
      return res.redirect(302, result.url);
    } catch (error) {
      if (error instanceof PartnerReferralError && error.status === 410) {
        return res.status(410).json({ code: error.code, error: error.message });
      }
      return handleError(res, error, 'Der Partnerlink konnte nicht aufgelöst werden.');
    }
  });

  router.post('/partner/webhook/:slug', webhookLimiter, async (req, res) => {
    try {
      const slug = String(req.params.slug ?? '');
      if (!/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(slug)) {
        return res.status(404).json({ code: 'partner_webhook_not_found', error: 'Der Partner-Rückkanal ist nicht verfügbar.' });
      }
      const parsed = PartnerConversionPayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ code: 'invalid_partner_event', error: 'Die Partner-Rückmeldung ist ungültig.' });
      }
      const timestamp = req.get('x-klar-partner-timestamp') ?? '';
      const signature = req.get('x-klar-partner-signature') ?? '';
      const secret = deps.webhookSecrets()[slug];
      if (!secret || !verifyPartnerWebhookSignature(parsed.data, timestamp, signature, secret)) {
        return res.status(401).json({ code: 'invalid_partner_signature', error: 'Die Signatur der Partner-Rückmeldung ist ungültig oder abgelaufen.' });
      }
      const result = await recordPartnerConversion(deps, slug, parsed.data, secret);
      return res.status(result.duplicate ? 200 : 201).json(result);
    } catch (error) {
      return handleError(res, error, 'Die Partner-Rückmeldung konnte nicht verarbeitet werden.');
    }
  });

  return router;
}

export function createPartnerReferralRouter(deps: PartnerReferralRouteDeps): Router {
  const router = Router();
  const userMutationLimiter = distributedRateLimit({
    collection: 'partner_referral_user_rate_limits',
    windowMs: 60_000,
    limit: 30,
    keyGenerator: req => {
      const uid = deps.currentUserId(req);
      return uid ? 'uid:' + uid : '';
    },
    message: { code: 'partner_action_rate_limited', error: 'Zu viele Partneraktionen. Bitte kurz warten.' },
    getDb: deps.getFirestore,
  });
  const adminLimiter = distributedRateLimit({
    collection: 'partner_referral_admin_rate_limits',
    windowMs: 60_000,
    limit: 60,
    keyGenerator: req => {
      const uid = deps.currentUserId(req);
      return uid ? 'uid:' + uid : '';
    },
    message: { code: 'partner_admin_rate_limited', error: 'Zu viele Verwaltungsaktionen. Bitte kurz warten.' },
    getDb: deps.getFirestore,
  });

  const accountGate = requirePartnerAccount(deps);
  // Consent state and individualized referral URLs must not be cached.
  const noStorePartnerPrivateData = (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  };

  router.get('/partner/consent', noStorePartnerPrivateData, accountGate, async (req, res) => {
    try { return res.json(await getPartnerConsentState(deps, uidFrom(req, deps))); }
    catch (error) { return handleError(res, error, 'Der Einwilligungsstatus konnte nicht geladen werden.'); }
  });

  router.post('/partner/consent', noStorePartnerPrivateData, accountGate, userMutationLimiter, async (req, res) => {
    if (!req.body || typeof req.body.allowed !== 'boolean' || Object.keys(req.body).some(key => key !== 'allowed')) {
      return res.status(400).json({ code: 'invalid_partner_consent', error: 'Bitte übermittle eine eindeutige Einwilligungsentscheidung.' });
    }
    try { return res.json(await setPartnerConsent(deps, uidFrom(req, deps), req.body.allowed)); }
    catch (error) { return handleError(res, error, 'Die Einwilligungsentscheidung konnte nicht bestätigt werden.'); }
  });

  router.get('/partner/referrals', noStorePartnerPrivateData, accountGate, async (req, res) => {
    try { return res.json(await listPartnerReferralLinks(deps, uidFrom(req, deps))); }
    catch (error) { return handleError(res, error, 'Die Partnerlinks konnten nicht geladen werden.'); }
  });

  router.post('/partner/interaction', accountGate, userMutationLimiter, async (req, res) => {
    const body = req.body as { campaignId?: unknown; action?: unknown } | undefined;
    const actions = new Set(['copy', 'share', 'qr_view']);
    if (!body || typeof body.campaignId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(body.campaignId)
      || typeof body.action !== 'string' || !actions.has(body.action)
      || Object.keys(body).some(key => !['campaignId', 'action'].includes(key))) {
      return res.status(400).json({ code: 'invalid_partner_interaction', error: 'Die Partneraktion ist ungültig.' });
    }
    try {
      return res.json(await recordPartnerInteraction(deps, uidFrom(req, deps), body.campaignId, body.action as 'copy' | 'share' | 'qr_view'));
    } catch (error) { return handleError(res, error, 'Die Partneraktion konnte nicht im Audit-Ledger bestätigt werden.'); }
  });

  router.post('/partner/open/:campaignId', noStorePartnerPrivateData, accountGate, userMutationLimiter, async (req, res) => {
    const campaignId = String(req.params.campaignId ?? '');
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(campaignId)) return res.status(400).json({ code: 'invalid_campaign_id', error: 'Die Kampagnenkennung ist ungültig.' });
    try { return res.json(await openPartnerReferral(deps, uidFrom(req, deps), campaignId)); }
    catch (error) { return handleError(res, error, 'Der Partnerlink konnte nicht sicher geöffnet werden.'); }
  });

  router.use('/admin/partners', requireStrictPartnerAdmin, adminLimiter);
  router.get('/admin/partners', async (_req, res) => {
    try { return res.json({ campaigns: await listPartnerCampaignsForAdmin(deps) }); }
    catch (error) { return handleError(res, error, 'Die Partnerkampagnen konnten nicht geladen werden.'); }
  });

  router.post('/admin/partners', async (req, res) => {
    try { return res.status(201).json({ campaign: await createPartnerCampaign(deps, uidFrom(req, deps), req.body) }); }
    catch (error) { return handleError(res, error, 'Die Kampagne konnte nicht angelegt werden.'); }
  });

  router.patch('/admin/partners/:id', async (req, res) => {
    try { return res.json({ campaign: await updatePartnerCampaign(deps, uidFrom(req, deps), String(req.params.id ?? ''), req.body) }); }
    catch (error) { return handleError(res, error, 'Die Kampagne konnte nicht geändert werden.'); }
  });

  router.post('/admin/partners/:id/disable', async (req, res) => {
    try { return res.json({ campaign: await updatePartnerCampaign(deps, uidFrom(req, deps), String(req.params.id ?? ''), { status: 'inactive' }) }); }
    catch (error) { return handleError(res, error, 'Die Kampagne konnte nicht deaktiviert werden.'); }
  });

  router.delete('/admin/partners/:id', async (req, res) => {
    try { return res.json(await softDeletePartnerCampaign(deps, uidFrom(req, deps), String(req.params.id ?? ''))); }
    catch (error) { return handleError(res, error, 'Die Kampagne konnte nicht gelöscht werden.'); }
  });

  return router;
}
