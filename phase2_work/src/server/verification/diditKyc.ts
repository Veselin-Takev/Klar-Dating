import { readBoundedResponse } from '../boundedResponse';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Router, text, type Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';

const DIDIT_RESPONSE_MAX_BYTES = 64 * 1024;

async function readDiditJson(response: Response): Promise<unknown> {
  const body = await readBoundedResponse(response, DIDIT_RESPONSE_MAX_BYTES, 'didit_response_too_large');
  return JSON.parse(Buffer.from(body).toString('utf8'));
}

import { canonicalizeDiditJsonText, DiditCanonicalJsonError } from './diditCanonicalJson';

export class KycError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}
export type DiditConfig = {
  apiKey: string; webhookSecret: string; workflowId: string; applicationId: string;
  environment: 'live' | 'sandbox'; callback: string;
  privacyUrl: string; privacyVersion: string;
};
export function diditConfig(env = process.env): DiditConfig {
  const schema = z.object({ apiKey: z.string().min(1), webhookSecret: z.string().min(32),
    workflowId: z.string().uuid(), applicationId: z.string().uuid(), environment: z.enum(['live', 'sandbox']),
    privacyUrl: z.string().url().refine(value => { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; }),
    privacyVersion: z.string().min(1).max(80),
    callback: z.string().url().refine(value => { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; }),
  });
  const result = schema.safeParse({ apiKey: env.DIDIT_API_KEY, webhookSecret: env.DIDIT_WEBHOOK_SECRET,
    workflowId: env.DIDIT_WORKFLOW_ID, applicationId: env.DIDIT_APPLICATION_ID,
    environment: env.DIDIT_ENVIRONMENT, callback: env.DIDIT_CALLBACK_URL,
    privacyUrl: env.DIDIT_PRIVACY_NOTICE_URL, privacyVersion: env.DIDIT_PRIVACY_NOTICE_VERSION });
  if (env.DIDIT_ENABLED !== 'true' || !result.success) throw new KycError(503, 'kyc_unavailable');
  return result.data;
}

// Build JSON directly: object insertion order would reorder numeric keys ("10", "2").
// Never include this body in logs or persist it: decisions contain biometric/identity data.
export function canonicalDiditJson(value: unknown, depth = 0): string {
  if (depth > 32) throw new KycError(400, 'invalid_webhook');
  if (Array.isArray(value)) return '[' + value.map(item => canonicalDiditJson(item, depth + 1)).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.keys(value).sort()
    .map(key => JSON.stringify(key) + ':' + canonicalDiditJson((value as Record<string, unknown>)[key], depth + 1)).join(',') + '}';
  return JSON.stringify(value);
}
export function verifyDiditSignature(body: unknown, signature: string | undefined, timestamp: string | undefined, secret: string, now = Date.now()): boolean {
  if (!signature || !/^[a-fA-F0-9]{64}$/.test(signature) || !timestamp || !/^\d{10}$/.test(timestamp)) return false;
  const seconds = Number(timestamp);
  if (Math.abs(Math.floor(now / 1000) - seconds) > 300 || (body as { timestamp?: unknown })?.timestamp !== seconds) return false;
  const expected = createHmac('sha256', secret).update(canonicalDiditJson(body), 'utf8').digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

export function verifyDiditSignatureText(rawBody: string, signature: string | undefined, timestamp: string | undefined, secret: string, now = Date.now()): boolean {
  if (!signature || !/^[a-fA-F0-9]{64}$/.test(signature) || !timestamp || !/^\d{10}$/.test(timestamp)) return false;
  let body: unknown;
  try { body = JSON.parse(rawBody) as unknown; } catch { return false; }
  const seconds = Number(timestamp);
  if (Math.abs(Math.floor(now / 1000) - seconds) > 300 || (body as { timestamp?: unknown })?.timestamp !== seconds) return false;
  let canonical: string;
  try { canonical = canonicalizeDiditJsonText(rawBody); }
  catch (error) {
    if (error instanceof DiditCanonicalJsonError) return false;
    throw error;
  }
  const expected = createHmac('sha256', secret).update(canonical, 'utf8').digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
const step = z.object({ status: z.string(), node_id: z.string().min(1) });
const envelope = z.object({
  event_id: z.string().uuid(), webhook_type: z.enum(['status.updated', 'data.updated']),
  timestamp: z.number().int().positive(), created_at: z.number().int().positive(),
  application_id: z.string().uuid(), environment: z.enum(['live', 'sandbox']),
  session_id: z.string().uuid(), workflow_id: z.string().uuid(), workflow_version: z.number().int().positive(),
  vendor_data: z.string().min(1).max(128).refine(value => !value.includes('/')),
  status: z.string().min(1).max(64), session_kind: z.string().optional(),
  decision: z.object({ session_id: z.string().uuid(), status: z.string(),
    // Provider responses are signed, but still untrusted input from a third party:
    // bound every repeated decision list to prevent pathological payload work.
    id_verifications: z.array(step).max(16).optional(), liveness_checks: z.array(step).max(16).optional(), face_matches: z.array(step).max(16).optional(),
  }).optional(),
});
export type KycDependencies = { db: () => Firestore; config: () => DiditConfig; fetch?: typeof fetch; now?: () => number };
export type KycAccountStatus = 'pending' | 'review' | 'approved';
const RECENT_AUTH_MAX_AGE_SECONDS = 300;
const approvedSteps = (steps: z.infer<typeof step>[] | undefined) => !!steps?.length && steps.every(result => result.status === 'Approved');

/**
 * Firebase `auth_time` is the server-verified authentication event time.
 * Sensitive KYC session creation requires a recent interactive authentication
 * so a stolen long-lived ID token cannot silently start a biometric flow.
 */
export function hasRecentAuthentication(authTime: unknown, now = Date.now()): boolean {
  if (typeof authTime !== 'number' || !Number.isSafeInteger(authTime) || authTime <= 0) return false;
  const age = Math.floor(now / 1000) - authTime;
  return age >= 0 && age <= RECENT_AUTH_MAX_AGE_SECONDS;
}

const PROVIDER_TO_ACCOUNT_STATUS: Readonly<Record<string, KycAccountStatus>> = {
  'Not Started': 'pending',
  'In Progress': 'pending',
  'Approved': 'approved',
  'Declined': 'pending',
  'In Review': 'review',
  'Resubmitted': 'review',
  'Expired': 'pending',
  'Abandoned': 'pending',
  'Kyc Expired': 'pending',
};

/**
 * Explicitly enforce the Didit lifecycle instead of treating every unknown
 * provider status as pending. The local model intentionally collapses
 * non-terminal progress into `pending`/`review`, but terminal transitions
 * remain constrained by the provider lifecycle.
 */
export function transitionKycAccountStatus(current: KycAccountStatus | undefined, providerStatus: string, approved: boolean): KycAccountStatus {
  const target = PROVIDER_TO_ACCOUNT_STATUS[providerStatus];
  if (!target) throw new KycError(400, 'invalid_provider_status');
  if (providerStatus === 'Approved' && !approved) throw new KycError(400, 'incomplete_approval');
  if (providerStatus !== 'Approved' && approved) throw new KycError(400, 'invalid_approval_state');

  const from = current ?? 'pending';
  if (from === 'approved' && providerStatus !== 'Approved' && providerStatus !== 'Kyc Expired') {
    throw new KycError(409, 'invalid_kyc_transition');
  }
  if (from === 'review' && providerStatus === 'In Progress') {
    throw new KycError(409, 'invalid_kyc_transition');
  }
  return target;
}

export async function processDiditWebhook(deps: KycDependencies, body: unknown, signature?: string, timestamp?: string, rawBody?: string) {
  const config = deps.config(); const now = (deps.now ?? Date.now)();
  const verified = rawBody === undefined
    ? verifyDiditSignature(body, signature, timestamp, config.webhookSecret, now)
    : verifyDiditSignatureText(rawBody, signature, timestamp, config.webhookSecret, now);
  if (!verified) throw new KycError(401, 'invalid_signature');
  const parsed = envelope.safeParse(body);
  if (!parsed.success) throw new KycError(400, 'invalid_webhook');
  const event = parsed.data;
  if (event.application_id !== config.applicationId || event.workflow_id !== config.workflowId || event.environment !== config.environment || event.session_kind === 'business' || event.created_at > event.timestamp) throw new KycError(400, 'invalid_context');
  const decision = event.decision;
  const approved = event.status === 'Approved' && decision?.status === 'Approved' && decision.session_id === event.session_id
    && approvedSteps(decision.id_verifications) && approvedSteps(decision.liveness_checks) && approvedSteps(decision.face_matches);
  const db = deps.db();
  return db.runTransaction(async tx => {
    const eventRef = db.doc(`kyc_events/${event.event_id}`);
    const sessionRef = db.doc(`kyc_sessions/${event.session_id}`);
    const accountRef = db.doc(`kyc_accounts/${event.vendor_data}`);
    const userRef = db.doc(`users/${event.vendor_data}`);
    const [receipt, session, account, user, deletion, publicProfile] = await Promise.all([
      tx.get(eventRef), tx.get(sessionRef), tx.get(accountRef), tx.get(userRef),
      tx.get(db.doc(`account_deletions/${event.vendor_data}`)), tx.get(db.doc(`public_profiles/${event.vendor_data}`)),
    ]);
    if (receipt.exists) return { duplicate: true };
    if (deletion.exists) return { duplicate: false, applied: false };
    // A provider may deliver before the session-create transaction commits. Do not ACK a lost event.
    if (!session.exists && !deletion.exists) throw new KycError(503, 'session_pending');
    const bound = session.data();
    if (bound && (bound.uid !== event.vendor_data || bound.workflowVersion !== event.workflow_version)) throw new KycError(400, 'session_mismatch');
    const previousTime = bound?.eventTime ?? 0;
    // Conflicting decisions at the same second are resolved toward NOT granting trust.
    const newer = event.created_at > previousTime || (event.created_at === previousTime && !approved);
    const applicable = user.exists && !deletion.exists && account.data()?.sessionId === event.session_id && newer;
    const currentStatus = account.data()?.status as KycAccountStatus | undefined;
    const targetStatus = applicable ? transitionKycAccountStatus(currentStatus, event.status, approved) : currentStatus ?? 'pending';
    if (bound && newer) tx.update(sessionRef, { status: event.status, eventTime: event.created_at, approved, url: null });
    if (applicable) {
      tx.update(accountRef, { status: targetStatus, updatedAt: new Date(now) });
      tx.update(userRef, { isVerified: approved, verificationProvider: 'didit', identityVerificationStatus: approved ? 'approved' : 'pending' });
      if (publicProfile.exists) tx.update(publicProfile.ref, { isVerified: approved });
    }
    tx.create(eventRef, { sessionId: event.session_id, uid: event.vendor_data, applied: applicable,
      receivedAt: new Date(now), expiresAt: new Date(now + 30 * 86400_000) });
    return { duplicate: false, applied: applicable };
  });
}



export function validKycReconciliationJobSignature(body: Buffer, signature: string | undefined, secret: string, now = Date.now()) {
  if (secret.length < 32 || !signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
  let message: { timestamp?: unknown };
  try { message = JSON.parse(body.toString('utf8')); } catch { return false; }
  if (typeof message.timestamp !== 'number' || !Number.isSafeInteger(message.timestamp) || Math.abs(now - message.timestamp) > 300_000) return false;
  return timingSafeEqual(createHmac('sha256', secret).update(body).digest(), Buffer.from(signature, 'hex'));
}

export async function reconcileDiditSessions(deps: KycDependencies, maxSessions = 10) {
  const config = deps.config();
  const db = deps.db();
  const now = (deps.now ?? Date.now)();
  const candidates = await db.collection('kyc_accounts')
    .where('status', 'in', ['pending', 'review'])
    .limit(Math.max(1, Math.min(25, maxSessions)))
    .get();
  let checked = 0; let changed = 0; let failed = 0;
  for (const account of candidates.docs) {
    const uid = account.id;
    const lease = randomUUID();
    const claimed = await db.runTransaction(async tx => {
      const current = await tx.get(account.ref);
      const data = current.data();
      const sessionId = typeof data?.sessionId === 'string' ? data.sessionId : '';
      if (!sessionId || !['pending', 'review'].includes(data?.status) || (data?.reconcileLeaseUntil ?? 0) > now) return null;
      tx.update(account.ref, { reconcileLease: lease, reconcileLeaseUntil: now + 60_000 });
      return sessionId;
    });
    if (!claimed) continue;
    checked += 1;
    try {
      const response = await (deps.fetch ?? fetch)(`https://verification.didit.me/v3/session/${encodeURIComponent(claimed)}/decision/`, {
        method: 'GET', headers: { 'x-api-key': config.apiKey }, redirect: 'error', signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`didit_${response.status}`);
      const result = z.object({
        session_id: z.string().uuid(), status: z.string().min(1).max(64),
        id_verifications: z.array(step).optional(), liveness_checks: z.array(step).optional(), face_matches: z.array(step).optional(),
      }).safeParse(await readDiditJson(response));
      if (!result.success || result.data.session_id !== claimed) throw new Error('invalid_provider_response');
      const approved = result.data.status === 'Approved' && approvedSteps(result.data.id_verifications)
        && approvedSteps(result.data.liveness_checks) && approvedSteps(result.data.face_matches);
      const applied = await db.runTransaction(async tx => {
        const [currentAccount, user, deletion, publicProfile] = await Promise.all([
          tx.get(account.ref), tx.get(db.doc(`users/${uid}`)), tx.get(db.doc(`account_deletions/${uid}`)), tx.get(db.doc(`public_profiles/${uid}`)),
        ]);
        if (deletion.exists || currentAccount.data()?.sessionId !== claimed || currentAccount.data()?.reconcileLease !== lease) return false;
        const currentStatus = currentAccount.data()?.status as KycAccountStatus | undefined;
        const targetStatus = transitionKycAccountStatus(currentStatus, result.data.status, approved);
        if (currentStatus === targetStatus && (targetStatus !== 'approved' || user.data()?.isVerified === true)) {
          tx.update(account.ref, { reconcileLeaseUntil: 0, lastReconciledAt: new Date(now) });
          return false;
        }
        tx.update(account.ref, { status: targetStatus, updatedAt: new Date(now), lastReconciledAt: new Date(now), reconcileLeaseUntil: 0 });
        if (user.exists) tx.update(user.ref, { isVerified: approved, verificationProvider: 'didit', identityVerificationStatus: approved ? 'approved' : 'pending' });
        if (publicProfile.exists) tx.update(publicProfile.ref, { isVerified: approved });
        tx.set(db.doc(`kyc_reconciliation_events/${claimed}`), { uid, sessionId: claimed, status: result.data.status, approved, reconciledAt: new Date(now), expiresAt: new Date(now + 30 * 86400_000) }, { merge: true });
        return true;
      });
      if (applied) changed += 1;
    } catch {
      failed += 1;
      await db.runTransaction(async tx => {
        const current = await tx.get(account.ref);
        if (current.data()?.reconcileLease === lease) tx.update(account.ref, { reconcileLeaseUntil: 0, lastReconciledAt: new Date(now) });
      }).catch(() => undefined);
    }
  }
  return { checked, changed, failed };
}

export async function startDiditSession(deps: KycDependencies, uid: string, language: string) {
  const config = deps.config(); const db = deps.db(); const now = (deps.now ?? Date.now)();
  const accountRef = db.doc(`kyc_accounts/${uid}`); const lease = randomUUID();
  const day = new Date(now).toISOString().slice(0, 10);
  await db.runTransaction(async tx => {
    const [user, account, deletion] = await Promise.all([tx.get(db.doc(`users/${uid}`)), tx.get(accountRef), tx.get(db.doc(`account_deletions/${uid}`))]);
    if (!user.exists || user.data()?.isAdult !== true || deletion.exists) throw new KycError(409, 'account_unavailable');
    if (account.data()?.status === 'approved') throw new KycError(409, 'already_verified');
    const data = account.data();
    if ((data?.leaseUntil ?? 0) > now) throw new KycError(409, 'kyc_in_progress');
    const count = data?.day === day ? data.count : 0;
    if (count >= 3) throw new KycError(429, 'kyc_daily_limit');
    tx.set(accountRef, { day, count: count + 1, lease, leaseUntil: now + 60_000,
      consentVersion: config.privacyVersion, consentAt: new Date(now) }, { merge: true });
  });
  try {
    // Didit deduplicates unfinished sessions on workflow + vendor_data. No automatic retry after ambiguous timeouts.
    const response = await (deps.fetch ?? fetch)('https://verification.didit.me/v3/session/', { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': config.apiKey }, signal: AbortSignal.timeout(8000), redirect: 'error',
      body: JSON.stringify({ workflow_id: config.workflowId, vendor_data: uid, callback: config.callback, language }),
    });
    if (!response.ok) throw new KycError(503, 'kyc_unavailable');
    const result = z.object({ session_id: z.string().uuid(), workflow_id: z.literal(config.workflowId), workflow_version: z.number().int().positive(),
      vendor_data: z.literal(uid), url: z.string().url().refine(value => { const u = new URL(value); return u.origin === 'https://verify.didit.me' && !u.username && !u.password; }),
    }).safeParse(await readDiditJson(response));
    if (!result.success) throw new KycError(502, 'invalid_provider_response');
    const session = result.data;
    await db.runTransaction(async tx => {
      const [account, deletion] = await Promise.all([tx.get(accountRef), tx.get(db.doc(`account_deletions/${uid}`))]);
      if (deletion.exists || account.data()?.lease !== lease) throw new KycError(409, 'account_unavailable');
      tx.set(db.doc(`kyc_sessions/${session.session_id}`), { uid, workflowVersion: session.workflow_version, createdAt: new Date(now) }, { merge: true });
      tx.update(accountRef, { sessionId: session.session_id, status: 'pending', leaseUntil: 0 });
    });
    return { sessionId: session.session_id, url: session.url };
  } finally {
    await db.runTransaction(async tx => {
      const account = await tx.get(accountRef);
      if (account.data()?.lease === lease) tx.update(accountRef, { leaseUntil: 0 });
    });
  }
}

function respondError(res: import('express').Response, error: unknown) {
  const known = error instanceof KycError;
  res.status(known ? error.status : 503).json({ code: known ? error.code : 'kyc_unavailable' });
}
export function createDiditWebhookRouter(deps: KycDependencies) {
  const router = Router();
  router.post('/didit', text({ inflate: false, type: 'application/json', limit: '256kb' }), async (req, res) => {
    if (typeof req.body !== 'string') return res.status(400).json({ code: 'invalid_webhook' });
    let body: unknown;
    try { body = JSON.parse(req.body) as unknown; }
    catch { return res.status(400).json({ code: 'invalid_webhook' }); }
    try { return res.json(await processDiditWebhook(deps, body, req.get('X-Signature-V2'), req.get('X-Timestamp'), req.body)); }
    catch (error) { return respondError(res, error); }
  });
  return router;
}

export function createKycReconciliationRouter(deps: KycDependencies, secret = process.env.KYC_RECONCILIATION_JOB_SECRET ?? '') {
  const router = Router();
  router.post('/reconcile', text({ inflate: false, type: 'application/json', limit: '1kb' }), async (req, res) => {
    if (!Buffer.isBuffer(req.body) || !validKycReconciliationJobSignature(req.body, req.get('X-Klar-Job-Signature'), secret)) return res.sendStatus(401);
    try { return res.json({ ok: true, ...(await reconcileDiditSessions(deps, 10)) }); }
    catch { return res.status(503).json({ code: 'kyc_reconciliation_unavailable' }); }
  });
  return router;
}

const KYC_START_RATE_LIMIT_COLLECTION = 'kyc_start_rate_limits';
const KYC_START_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const KYC_START_RATE_LIMIT_MAX = 3;
const actor = (req: Request) => (req as Request & { user?: { uid: string; auth_time?: number; firebase?: { sign_in_provider?: string } } }).user;

export function kycStartRateLimitKey(uid: string): string {
  return createHash('sha256').update(`klar-kyc-start:${uid}`).digest('hex');
}

async function distributedKycStartRateLimit(deps: KycDependencies, req: Request, res: import('express').Response, next: () => void) {
  const user = actor(req);
  if (!user?.uid) return next();
  const now = (deps.now ?? Date.now)();
  const ref = deps.db().collection(KYC_START_RATE_LIMIT_COLLECTION).doc(kycStartRateLimitKey(user.uid));
  try {
    const allowed = await deps.db().runTransaction(async tx => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : undefined;
      const windowStartedAt = Number(data?.windowStartedAt) || now;
      const count = Number(data?.count) || 0;
      if (now - windowStartedAt >= KYC_START_RATE_LIMIT_WINDOW_MS) {
        tx.set(ref, {
          count: 1,
          windowStartedAt: now,
          expiresAt: new Date(now + KYC_START_RATE_LIMIT_WINDOW_MS),
        });
        return true;
      }
      if (count >= KYC_START_RATE_LIMIT_MAX) return false;
      tx.update(ref, {
        count: count + 1,
        expiresAt: new Date(windowStartedAt + KYC_START_RATE_LIMIT_WINDOW_MS),
      });
      return true;
    });
    if (!allowed) return res.status(429).json({ error: 'Zu viele KYC-Starts. Bitte später erneut versuchen.' });
    return next();
  } catch {
    return res.status(503).json({ error: 'KYC-Limit derzeit nicht verfügbar.' });
  }
}

export function createKycRouter(deps: KycDependencies) {
  const router = Router();
  const kycStartLimiter = (req: Request, res: import('express').Response, next: () => void) => distributedKycStartRateLimit(deps, req, res, next);
  const requireRecentKycAuthentication = (req: Request, res: import('express').Response, next: () => void) => {
    const user = actor(req);
    if (!user || user.firebase?.sign_in_provider === 'anonymous') return res.status(401).json({ code: 'account_required' });
    if (!hasRecentAuthentication(user.auth_time)) return res.status(401).json({ code: 'recent_login_required', error: 'Bitte vor der Identitätsprüfung erneut anmelden.' });
    return next();
  };
  const kycStatusReadLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    keyGenerator: (req) => actor(req)?.uid ?? ipKeyGenerator(req.ip ?? ''),
    standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Zu viele KYC-Statusabfragen. Bitte kurz warten.' },
  });
  router.post('/start', requireRecentKycAuthentication, kycStartLimiter, async (req, res) => {
    const user = actor(req);
    if (!user || user.firebase?.sign_in_provider === 'anonymous') return res.status(401).json({ code: 'account_required' });
    if (!hasRecentAuthentication(user.auth_time)) return res.status(401).json({ code: 'recent_login_required', error: 'Bitte vor der Identitätsprüfung erneut anmelden.' });
    const input = z.object({ consent: z.literal(true), consentVersion: z.string(), language: z.enum(['de', 'en', 'es', 'fr']) }).strict().safeParse(req.body);
    if (!input.success) return res.status(400).json({ code: 'consent_required' });
    try {
      if (input.data.consentVersion !== deps.config().privacyVersion) throw new KycError(409, 'consent_version_changed');
      return res.json(await startDiditSession(deps, user.uid, input.data.language));
    }
    catch (error) { return respondError(res, error); }
  });
  router.get('/status', kycStatusReadLimiter, async (req, res) => {
    const user = actor(req); if (!user) return res.status(401).json({ code: 'account_required' });
    try {
      let config: DiditConfig | null = null;
      try {
        config = deps.config();
      } catch (err: unknown) {
        if (err instanceof KycError && err.status === 503) {
          return res.json({ status: 'unavailable', privacyUrl: '', consentVersion: '' });
        }
        throw err;
      }
      try {
        const account = await deps.db().doc(`kyc_accounts/${user.uid}`).get();
        return res.json({ status: account.data()?.status ?? 'not_started', privacyUrl: config.privacyUrl, consentVersion: config.privacyVersion });
      } catch {
        return res.status(503).json({ status: 'unavailable', code: 'kyc_status_unavailable', privacyUrl: config.privacyUrl, consentVersion: config.privacyVersion });
      }
    } catch (error) { return respondError(res, error); }
  });
  return router;
}
