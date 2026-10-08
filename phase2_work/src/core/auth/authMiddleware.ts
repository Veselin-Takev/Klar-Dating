import type { Request, Response, NextFunction } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getServerFirebaseApp } from '../../server/db';

export type AuthenticatedRequest = Request;
/**
 * Verify Firebase ID tokens with the Admin SDK. Never decode JWT payloads
 * locally and never substitute a fixed/test identity in a runtime boundary.
 */
export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (typeof authHeader !== 'string' || !/^Bearer\s+[^\s]+$/.test(authHeader.trim())) {
    return res.status(401).json({ error: 'Unauthorized: Missing or malformed token' });
  }

  const token = authHeader.trim().slice('Bearer '.length).trim();
  if (!token) return res.status(401).json({ error: 'Unauthorized: Missing or malformed token' });

  try {
    const decoded = await getAuth(getServerFirebaseApp()).verifyIdToken(token, false);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      role: typeof decoded.role === 'string' ? decoded.role : undefined,
      roles: Array.isArray(decoded.roles) ? decoded.roles.filter((role): role is string => typeof role === 'string') : undefined,
      admin: decoded.admin === true,
      moderator: decoded.moderator === true,
      support: decoded.support === true,
      trust_safety: decoded.trust_safety === true,
      finance: decoded.finance === true,
      super_admin: decoded.super_admin === true,
    };
    return next();
  } catch {
    return res.status(401).json({ error: 'Forbidden: Invalid token' });
  }
}
