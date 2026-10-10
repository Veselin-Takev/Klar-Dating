import type { Request, Response, NextFunction } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getServerFirebaseApp } from '../../server/db';

export type AuthenticatedRequest = Request;
/**
 * Verify Firebase ID tokens with the Admin SDK. Never decode JWT payloads
 * locally; enforce revocation and disabled-user checks on every request.
 * Never substitute a fixed/test identity in a runtime boundary.
 */
export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (typeof authHeader !== 'string' || !/^Bearer\s+[^\s]+$/.test(authHeader.trim())) {
    return res.status(401).json({ error: 'Unauthorized: Missing or malformed token' });
  }

  const token = authHeader.trim().slice('Bearer '.length).trim();
  if (!token) return res.status(401).json({ error: 'Unauthorized: Missing or malformed token' });

  try {
    const decoded = await getAuth(getServerFirebaseApp()).verifyIdToken(token, true);
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: 'Forbidden: Invalid token' });
  }
}

