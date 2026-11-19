import { Router } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
import type { Auth } from 'firebase-admin/auth';

const PREFIX = 'klar-media:v1:';
export function createCanonicalMediaRef(uid: string, objectPath: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid) || !objectPath.startsWith(`profiles/${uid}/`) || objectPath.includes('\\') || objectPath.split('/').some(segment => segment === '..' || segment === '.' || segment === '')) {
    throw new Error('Invalid profile media path');
  }
  return PREFIX + Buffer.from(objectPath, 'utf8').toString('base64url');
}
export function parseCanonicalMediaRef(uid: string, value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith(PREFIX)) return null;
  try {
    const path = Buffer.from(value.slice(PREFIX.length), 'base64url').toString('utf8');
    if (!path.startsWith(`profiles/${uid}/`) || path.includes('..') || path.includes('\\')) return null;
    return path;
  } catch { return null; }
}
export function normalizeProfileMedia(uid: string, data: Record<string, unknown>): string | null {
  const explicit = typeof data.photoStoragePath === 'string' ? data.photoStoragePath : null;
  const legacy = typeof data.photoPath === 'string' ? data.photoPath : null;
  const aliases = [data.photoURL, data.photoUrl, ...(Array.isArray(data.photos) ? data.photos : [])]
    .filter((value): value is string => typeof value === 'string');
  const aliasPath = aliases.map(value => {
    try {
      const parsed = new URL(value);
      const marker = parsed.pathname.indexOf('/o/');
      return marker >= 0 ? decodeURIComponent(parsed.pathname.slice(marker + 3)) : null;
    } catch {
      return value.startsWith(`profiles/${uid}/`) ? value : null;
    }
  }).find((value): value is string => !!value && value.startsWith(`profiles/${uid}/`));
  const path = explicit ?? legacy ?? aliasPath;
  return path ? createCanonicalMediaRef(uid, path) : null;
}
export type ProfileMediaDeps = {
  getFirestore: () => Firestore;
  getAuth: () => Auth;
  getBucket: () => Bucket;
};
export function createProfileMediaRouter(deps: ProfileMediaDeps): Router {
  const router = Router();
  router.get('/profile-media/:uid/:mediaRef', async (req, res) => {
    try {
      const header = req.headers.authorization;
      if (typeof header !== 'string' || !/^Bearer\s+[^\s]+$/.test(header.trim())) return res.status(401).end();
      const token = header.trim().slice(7);
      const decoded = await deps.getAuth().verifyIdToken(token, true);
      const requester = decoded.uid;
      const target = req.params.uid;
      if (!requester || !target || decoded.firebase?.sign_in_provider === 'anonymous') return res.status(403).end();
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
          requesterData.isSuspended === true || requesterData.isBlocked === true || requesterData.status === 'blocked' || requesterData.status === 'suspended' || requesterData.status === 'deleted' || requesterDeletion.exists) {
        return res.status(403).end();
      }
      if (!targetSnap.exists || targetData.isAdult !== true || targetData.active !== true ||
          targetData.isSuspended === true || targetData.isBlocked === true || targetData.status === 'blocked' || targetData.status === 'suspended' || targetData.status === 'deleted' ||
          targetDeletion.exists || requester === target) return res.status(404).end();
      const [outgoing, incoming] = await Promise.all([
        db.collection('blocks').where('blockerUid', '==', requester).where('blockedUid', '==', target).limit(1).get(),
        db.collection('blocks').where('blockerUid', '==', target).where('blockedUid', '==', requester).limit(1).get(),
      ]);
      if (!outgoing.empty || !incoming.empty) return res.status(404).end();
      const objectPath = parseCanonicalMediaRef(target, req.params.mediaRef);
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
      res.setHeader('Cache-Control', 'private, no-store, max-age=0');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.status(200);
      const stream = file.createReadStream();
      stream.on('error', () => { if (!res.headersSent) res.status(404).end(); else res.destroy(); });
      stream.pipe(res);
    } catch {
      return res.status(401).end();
    }
  });
  return router;
}
