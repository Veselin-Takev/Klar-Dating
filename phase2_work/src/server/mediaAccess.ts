import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { TenantAwareFirestoreRepository } from '../../functions/src/firestoreRepository/TenantAwareFirestoreRepository';

const record = z.record(z.string(), z.unknown());

/** Defense in depth for APIs that return other people's profile/media data. */
export function createMediaAccessGuard(repository: () => TenantAwareFirestoreRepository): RequestHandler {
  return async (req, res, next) => {
    // Express path matching is case-insensitive and accepts a trailing slash.
    const path = req.path.replace(/\/+$/, '').toLowerCase();
    if (!/^\/(?:recommendations|profile\/publish|chats(?:\/[^/]+)?|date-planner\/connections|media(?:\/.*)?)$/.test(path)) return next();
    res.set('Cache-Control', 'no-store');
    const user = req.user;
    if (!user?.uid) { res.status(401).json({ code: 'auth_required' }); return; }
    const provider = user.firebase?.sign_in_provider;
    if (typeof provider !== 'string' || provider === 'anonymous') {
      res.status(403).json({ code: 'media_account_required' }); return;
    }
    try {
      const allowed = await repository().transaction(async tx => {
        const [owner, deletion] = await Promise.all([
          tx.read(`users/${user.uid}`, record), tx.read(`account_deletions/${user.uid}`, record),
        ]);
        return owner?.isAdult === true && owner.mediaAccessState === 'active' && deletion === null;
      });
      if (!allowed) { res.status(403).json({ code: 'media_access_denied' }); return; }
      next();
    } catch { res.status(503).json({ code: 'media_access_unavailable' }); }
  };
}
