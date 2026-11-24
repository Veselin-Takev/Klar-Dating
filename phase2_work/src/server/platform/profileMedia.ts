import { Router, type Request, type Response } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
import type { Auth } from 'firebase-admin/auth';

const PREFIX = 'klar-media:v1:';
const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const OBJECT_PATH_PATTERN = /^[A-Za-z0-9_./-]+$/;

function isOwnerScopedObjectPath(uid: string, path: string): boolean {
  return UID_PATTERN.test(uid)
    && path.startsWith(`profiles/${uid}/`)
    && OBJECT_PATH_PATTERN.test(path)
    && path.split('/').every(segment => segment.length > 0 && segment !== '.' && segment !== '..');
}

export function createCanonicalMediaRef(uid: string, objectPath: string): string {
  if (!isOwnerScopedObjectPath(uid, objectPath)) throw new Error('Invalid profile media path');
  return PREFIX + Buffer.from(objectPath, 'utf8').toString('base64url');
}

export function parseCanonicalMediaRef(uid: string, value: unknown): string | null {
  if (!UID_PATTERN.test(uid) || typeof value !== 'string' || !value.startsWith(PREFIX)) return null;
  const encoded = value.slice(PREFIX.length);
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
  try {
    const path = Buffer.from(encoded, 'base64url').toString('utf8');
    if (Buffer.from(path, 'utf8').toString('base64url') !== encoded) return null;
    return isOwnerScopedObjectPath(uid, path) ? path : null;
  } catch { return null; }
}

export function normalizeProfileMedia(uid: string, data: Record<string, unknown>): string | null {
  if (!UID_PATTERN.test(uid)) return null;
  const explicit = typeof data.photoStoragePath === 'string' ? data.photoStoragePath : null;
  const legacy = typeof data.photoPath === 'string' ? data.photoPath : null;
  const aliases = [data.photoURL, data.photoUrl, ...(Array.isArray(data.photos) ? data.photos : [])]
    .filter((value): value is string => typeof value === 'string');

  for (const alias of aliases) {
    const canonicalPath = parseCanonicalMediaRef(uid, alias);
    if (canonicalPath) return createCanonicalMediaRef(uid, canonicalPath);
  }

  // Transitional raw object-path aliases remain owner-scoped and are served
  // only through this authenticated proxy. URL-shaped values are never
  // normalized: Firebase/GCS download URLs are bearer capabilities, even
  // when their token query parameter is absent or malformed.
  const aliasPath = aliases.find(value =>
    value.startsWith(`profiles/${uid}/`) && isOwnerScopedObjectPath(uid, value),
  ) ?? null;

  const path = explicit ?? legacy ?? aliasPath;
  if (!path || !isOwnerScopedObjectPath(uid, path)) return null;
  try { return createCanonicalMediaRef(uid, path); } catch { return null; }
}
export type ProfileMediaDeps = {
  getFirestore: () => Firestore;
  getAuth: () => Auth;
  getBucket: () => Bucket;
};

async function streamAuthorizedProfileMedia(
  deps: ProfileMediaDeps,
  req: Request,
  res: Response,
  selfView: boolean,
) {
  // Media bytes are viewer-authorized capabilities: never let an intermediary
  // cache them or disclose the request path as a referrer.
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Vary', 'Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const header = req.headers.authorization;
  if (typeof header !== 'string' || !/^Bearer\s+[^\s]+$/i.test(header.trim())) {
    return res.status(401).end();
  }

  const token = header.trim().slice(7);
  let decoded: Awaited<ReturnType<Auth['verifyIdToken']>>;
  try {
    // Firebase Admin verifies signature, expiry and revocation. Only failures
    // in this authentication step are classified as HTTP 401.
    decoded = await deps.getAuth().verifyIdToken(token, true);
  } catch {
    return res.status(401).end();
  }

  try {
    const requester = decoded.uid;
    const requestedTarget = req.params.uid;
    const target = selfView ? requester : typeof requestedTarget === 'string' ? requestedTarget : '';
    if (!requester || !target || decoded.firebase?.sign_in_provider === 'anonymous') return res.status(403).end();

    // The public-profile route never grants self-read. Self-view has its own
    // route and derives the target exclusively from the verified token UID.
    if (!selfView && requester === target) return res.status(404).end();

    const db = deps.getFirestore();
    const [requesterSnap, targetSnap, requesterDeletion, targetDeletion] = await Promise.all([
      db.collection('users').doc(requester).get(),
      db.collection('users').doc(target).get(),
      db.collection('account_deletions').doc(requester).get(),
      db.collection('account_deletions').doc(target).get(),
    ]);
    const requesterData = requesterSnap.data() ?? {};
    const targetData = targetSnap.data() ?? {};
    if (!requesterSnap.exists || requesterData.isAdult !== true || requesterData.active !== true ||
        requesterData.isSuspended !== false || requesterData.isBlocked !== false || requesterData.deletionPending !== false ||
        requesterData.status === 'blocked' || requesterData.status === 'suspended' || requesterData.status === 'deleted' || requesterDeletion.exists) {
      return res.status(403).end();
    }
    if (!targetSnap.exists || targetData.isAdult !== true || targetData.active !== true ||
        targetData.isSuspended !== false || targetData.isBlocked !== false || targetData.deletionPending !== false ||
        targetData.status === 'blocked' || targetData.status === 'suspended' || targetData.status === 'deleted' ||
        targetDeletion.exists) return res.status(404).end();

    if (!selfView) {
      const [outgoing, incoming] = await Promise.all([
        db.collection('blocks').where('blockerUid', '==', requester).where('blockedUid', '==', target).limit(1).get(),
        db.collection('blocks').where('blockerUid', '==', target).where('blockedUid', '==', requester).limit(1).get(),
      ]);
      if (!outgoing.empty || !incoming.empty) return res.status(404).end();
    }

    // Self-view resolves media only from the authenticated user's own profile
    // document. Legacy/token-bearing, malformed, and URL-shaped media aliases
    // are rejected; they are never translated into Storage object paths.
    const requestedMediaRef = req.params.mediaRef;
    const canonicalRef = selfView
      ? normalizeProfileMedia(target, targetData)
      : typeof requestedMediaRef === 'string' ? requestedMediaRef : null;
    const objectPath = parseCanonicalMediaRef(target, canonicalRef);
    if (!objectPath) return res.status(404).end();
    const file = deps.getBucket().file(objectPath);
    const [exists] = await file.exists();
    if (!exists) return res.status(404).end();
    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(String(contentType))) return res.status(415).end();
    const size = Number(metadata.size);
    if (!Number.isFinite(size) || size <= 0 || size >= 8 * 1024 * 1024) return res.status(413).end();
    res.setHeader('Content-Type', String(contentType));
    res.status(200);
    const stream = file.createReadStream();
    stream.on('error', () => { if (!res.headersSent) res.status(404).end(); else res.destroy(); });
    stream.pipe(res);
  } catch {
    // Infrastructure/Firestore/Storage failures are server errors, not
    // authentication failures. Do not misreport them as invalid credentials.
    return res.status(500).end();
  }
}

export function createProfileMediaRouter(deps: ProfileMediaDeps): Router {
  const router = Router();
  // Self-view never accepts a UID or media reference from the browser.
  router.get('/profile-media/self', (req, res) => streamAuthorizedProfileMedia(deps, req, res, true));
  router.get('/profile-media/:uid/:mediaRef', (req, res) => streamAuthorizedProfileMedia(deps, req, res, false));
  return router;
}
